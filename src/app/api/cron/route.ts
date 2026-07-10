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

    for (const channel of COMPETITOR_CHANNELS) {
      const deals = await fetchTelegramDeals(channel);
      
      for (const item of deals) {
        let textToSearch = item.link + ' ' + item.content;
        let asin = extractAmazonASIN(textToSearch);

        // If it's a shortlink and we didn't find an ASIN, we must expand it!
        if (!asin && item.link.includes('amzn.to')) {
          try {
            // Fetch the shortlink and let it redirect, then grab the final URL
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

        dealsFoundCount++;

        // Generate affiliate link
        const affiliateTag = process.env.AMAZON_AFFILIATE_TAG || '';
        const affiliateUrl = affiliateTag 
          ? `https://www.amazon.in/dp/${asin}?tag=${affiliateTag}` 
          : `https://www.amazon.in/dp/${asin}`;

        // ============================================================
        // 3-LAYER PRIORITY SYSTEM (ALL FREE!)
        // Layer 1: Direct Amazon scrape (rotating UA + mobile fallback)
        // Layer 2: Telegram Link Preview (Telegram visited Amazon for us!)
        // Layer 3: Telegram message text (last resort)
        // ============================================================

        let finalTitle = item.title;
        let finalDealPrice = 0;
        let finalOriginalPrice = 0;
        let finalImageUrl = item.imageUrl || '';
        let dataSource = 'telegram_text';

        // LAYER 1: Try direct Amazon (3 sub-attempts: proxy, desktop, mobile)
        const amzData = await fetchAmazonDetails(asin);
        
        if (amzData && amzData.currentPrice > 0) {
           dataSource = 'amazon_direct';
           finalTitle = amzData.title;
           finalDealPrice = amzData.currentPrice;
           finalOriginalPrice = amzData.originalPrice;
           if (amzData.imageUrl) finalImageUrl = amzData.imageUrl;
           console.log(`✅ [LAYER 1] Amazon direct: ${asin} → ₹${finalDealPrice}`);
        }

        // LAYER 2: If Amazon blocked us, use Telegram's own link preview!
        // This is FREE and always accurate because Telegram visited Amazon itself.
        if (dataSource !== 'amazon_direct' && item.previewTitle) {
           dataSource = 'telegram_preview';
           finalTitle = item.previewTitle;
           console.log(`✅ [LAYER 2] Telegram preview title: ${finalTitle.substring(0, 50)}...`);
        }

        // LAYER 3: If we still have no price, parse Telegram text
        if (finalDealPrice === 0) {
           const priceRegex = /(?:mrp|rs\.?|₹)\s*[:~]*\s*([0-9,]+)/gi;
           const prices: number[] = [];
           let match;
           while ((match = priceRegex.exec(item.content)) !== null) {
             const val = parseInt(match[1].replace(/,/g, ''), 10);
             if (val > 0 && val < 500000) prices.push(val); // Ignore crazy numbers
           }
           
           if (prices.length >= 2) {
              finalOriginalPrice = Math.max(...prices);
              finalDealPrice = Math.min(...prices);
           } else if (prices.length === 1) {
              finalDealPrice = prices[0];
              finalOriginalPrice = Math.round(finalDealPrice * 1.4);
           }
           console.log(`⚠️ [LAYER 3] Telegram text prices: deal=₹${finalDealPrice}, mrp=₹${finalOriginalPrice}`);
        }

        // Final safety nets
        if (finalDealPrice === 0) finalDealPrice = 999;
        if (finalOriginalPrice <= finalDealPrice) finalOriginalPrice = Math.round(finalDealPrice * 1.4);
        const discountPct = Math.round(((finalOriginalPrice - finalDealPrice) / finalOriginalPrice) * 100);
        
        console.log(`📊 Final: "${finalTitle.substring(0, 40)}..." ₹${finalDealPrice} (MRP: ₹${finalOriginalPrice}, ${discountPct}% OFF) [${dataSource}]`);

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

        // Save deal as published
        const deal = await prisma.deal.create({
          data: {
            productId: product.id,
            platformId: platform.id,
            dealType: 'price_drop',
            dealScore: 85,
            dealPrice: finalDealPrice, 
            originalPrice: finalOriginalPrice, 
            discountPct: discountPct,
            affiliateUrl: affiliateUrl,
            isGenuine: true,
            isPublished: true, // Auto-publish mode enabled!
          }
        });

        // Instantly push to Telegram!
        try {
          await publishToTelegram(deal.id, TELEGRAM_CHANNEL);
          console.log(`✅ Auto-published deal to Telegram: ${item.title.substring(0, 30)}...`);
        } catch (err) {
          console.error(`Failed to auto-publish deal to Telegram:`, err);
        }
      }
    }

    return NextResponse.json({ success: true, newDealsFound: dealsFoundCount });

  } catch (error: any) {
    console.error('Vercel Cron Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
