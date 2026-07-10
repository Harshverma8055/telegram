import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { fetchTelegramDeals, extractAmazonASIN, fetchAmazonDetails } from '@/lib/scrapers/rss';
import { publishToTelegram } from '@/lib/telegram';

const COMPETITOR_CHANNELS = [
  'LootDealsIndia',
  'dealsindia',
  'GrabOnIndiaOfficial',
  'Bigtricks',
  'offerbot',
  'IndiaFreeStuff',
  'amazinglootsdealsoffers',
  'lootdealsk_Alibaba_dc_DealDost',
  'LOOTS_DEAL_OFFER_ONLINE_SHOPPING',
  'TrickXpert',
  'under_99_loot_deals'
];
const TELEGRAM_CHANNEL = '@fantasticofffer';

// Vercel Cron routes must be a GET request
export async function GET(request: Request) {
  // Optional: Add a secret key check so random people can't trigger your cron
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📡 Starting Vercel Cron: Deal Scraper...');

  try {
    let dealsFoundCount = 0;
    let dealsSkippedCount = 0;

    for (const channel of COMPETITOR_CHANNELS) {
      const deals = await fetchTelegramDeals(channel);
      
      for (const item of deals) {
        let textToSearch = item.link + ' ' + item.content;
        let asin = extractAmazonASIN(textToSearch);

        // If it's a shortlink and we didn't find an ASIN, we must expand it!
        if (!asin && item.link.includes('amzn.to')) {
          try {
            const expandRes = await fetch(item.link, { redirect: 'follow' });
            asin = extractAmazonASIN(expandRes.url);
          } catch (e) {
            console.error('Failed to expand shortlink:', item.link);
          }
        }

        if (!asin) continue;

        const platform = await prisma.platform.upsert({
          where: { slug: 'amazon' },
          update: {},
          create: { name: 'Amazon', slug: 'amazon' }
        });

        const existingDeal = await prisma.product.findUnique({
          where: { platformId_externalId: { platformId: platform.id, externalId: asin } }
        });

        if (existingDeal) continue; // Skip duplicates

        // Generate affiliate link (ALWAYS use our own tag, never competitor's)
        const affiliateTag = process.env.AMAZON_AFFILIATE_TAG || '';
        const affiliateUrl = affiliateTag 
          ? `https://www.amazon.in/dp/${asin}?tag=${affiliateTag}` 
          : `https://www.amazon.in/dp/${asin}`;

        // ============================================================
        // TRUST-FIRST SYSTEM: Only post what we are 100% sure about!
        // 
        // VERIFIED = Data came from Amazon directly (PA-API or scrape)
        // UNVERIFIED = Data came from Telegram text (competitor may have 
        //              posted wrong prices to get clicks)
        //
        // Rule: If price is NOT verified, don't show any price at all.
        //       Just show product name + "Check Deal on Amazon" button.
        //       This way we NEVER mislead our users.
        // ============================================================

        let finalTitle = '';
        let finalDealPrice = 0;
        let finalOriginalPrice = 0;
        let finalImageUrl = item.imageUrl || '';
        let priceVerified = false; // THE KEY FLAG!

        // STEP 1: Try Amazon direct fetch (PA-API → proxy → desktop → mobile)
        const amzData = await fetchAmazonDetails(asin);
        
        if (amzData && amzData.title) {
          finalTitle = amzData.title;
          if (amzData.imageUrl) finalImageUrl = amzData.imageUrl;
          
          if (amzData.currentPrice > 0) {
            finalDealPrice = amzData.currentPrice;
            finalOriginalPrice = amzData.originalPrice;
            priceVerified = true; // ✅ We got REAL price from Amazon!
            console.log(`✅ VERIFIED: ${asin} → "${finalTitle.substring(0, 40)}" ₹${finalDealPrice} (MRP: ₹${finalOriginalPrice})`);
          }
        }

        // STEP 2: If Amazon didn't give us a title, use Telegram link preview
        // (This is the preview card that Telegram generates — it's real Amazon data)
        if (!finalTitle && item.previewTitle) {
          finalTitle = item.previewTitle;
          console.log(`📋 Title from Telegram preview: ${finalTitle.substring(0, 50)}...`);
        }

        // STEP 3: Last resort for title only — use cleaned Telegram text
        if (!finalTitle) {
          finalTitle = item.title;
          console.log(`⚠️ Title from Telegram text: ${finalTitle.substring(0, 50)}...`);
        }

        // STEP 4: If price is NOT verified, we have two choices:
        // Option A: Skip the deal entirely (safest but loses deals)
        // Option B: Post it WITHOUT price, just say "Check price on Amazon" (chosen!)
        if (!priceVerified) {
          // Set price to 0 so the caption generator knows to show "Check price" instead
          finalDealPrice = 0;
          finalOriginalPrice = 0;
          console.log(`⚠️ UNVERIFIED PRICE for ${asin} — will post without price to maintain trust`);
        }

        const discountPct = (priceVerified && finalOriginalPrice > finalDealPrice) 
          ? Math.round(((finalOriginalPrice - finalDealPrice) / finalOriginalPrice) * 100) 
          : 0;
        
        dealsFoundCount++;

        // Save product
        const product = await prisma.product.create({
          data: {
            platformId: platform.id,
            externalId: asin,
            title: finalTitle,
            url: `https://www.amazon.in/dp/${asin}`,
            currentPrice: finalDealPrice, 
            imageUrl: finalImageUrl,
          }
        });

        // Save deal
        const deal = await prisma.deal.create({
          data: {
            productId: product.id,
            platformId: platform.id,
            dealType: 'price_drop',
            dealScore: priceVerified ? 95 : 70, // Verified deals get higher score
            dealPrice: finalDealPrice, 
            originalPrice: finalOriginalPrice, 
            discountPct: discountPct,
            affiliateUrl: affiliateUrl,
            isGenuine: priceVerified,
            isPublished: true,
          }
        });

        // Publish to Telegram!
        try {
          await publishToTelegram(deal.id, TELEGRAM_CHANNEL);
          console.log(`✅ Published: "${finalTitle.substring(0, 30)}..." [${priceVerified ? 'VERIFIED ✓' : 'NO PRICE'}]`);
        } catch (err) {
          console.error(`Failed to publish deal:`, err);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      newDealsFound: dealsFoundCount,
      dealsSkipped: dealsSkippedCount 
    });

  } catch (error: any) {
    console.error('Vercel Cron Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
