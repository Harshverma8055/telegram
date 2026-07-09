import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchTelegramDeals, extractAmazonASIN } from '@/lib/scrapers/rss';
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

        // Try to extract price from Telegram text (e.g., "Rs 399" or "@ 38999" or "₹400")
        const priceMatch = item.content.match(/(?:rs\.?|₹|@)\s*([0-9,]+)/i);
        let extractedPrice = 0;
        if (priceMatch) {
          extractedPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
        }

        // Save product
        const product = await prisma.product.create({
          data: {
            platformId: platform.id,
            externalId: asin,
            title: item.title,
            url: `https://www.amazon.in/dp/${asin}`,
            currentPrice: extractedPrice, 
            imageUrl: item.imageUrl,
          }
        });

        // Save deal as published
        const deal = await prisma.deal.create({
          data: {
            productId: product.id,
            platformId: platform.id,
            dealType: 'price_drop',
            dealScore: 85,
            dealPrice: extractedPrice, 
            originalPrice: extractedPrice > 0 ? Math.round(extractedPrice * 1.4) : 0, 
            discountPct: extractedPrice > 0 ? 40 : 0,
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
