import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { fetchTelegramDeals, fetchAmazonDetails, resolveDealUrl, fetchPageMetadata } from '@/lib/scrapers/rss';
import { publishToTelegram, sanitizeTitle } from '@/lib/telegram';
import { getAffiliateUrl } from '@/lib/affiliate';

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

const SUPER_PRIORITY_KEYWORDS = [
  'bag', 'luggage', 'suitcase', 'duffel', 'backpack', 'tote', 'handbag', 'purse',
  'shoes', 'sneakers', 'sandal', 'slipper', 'crocs', 'heel', 'boot',
  'watch', 'perfume', 'deodorant', 'deo', 'spray', 'lipstick', 'makeup', 'eyeliner',
  'kajal', 'cream', 'moisturizer', 'sunscreen', 'face wash', 'scrub', 'shampoo',
  'conditioner', 'hair oil', 'serum', 'lotion', 'jewelry', 'jewellery', 'necklace',
  'ring', 'earring', 'bracelet', 'bangle', 'gold', 'silver', 'lipstick', 'skincare'
];

const COLLEGE_ESSENTIALS_KEYWORDS = [
  'umbrella', 'raincoat', 'rain coat', 'bottle', 'flask', 'lunch box', 'lunchbox',
  'pen', 'pencil', 'notebook', 'register', 'diary', 'calculator', 'marker', 'highlighter',
  'laptop sleeve', 'laptop bag', 'mouse', 'keyboard', 'headphone', 'earbuds', 'earphone',
  'powerbank', 'power bank', 'charger', 'sports', 'cricket', 'badminton', 'football',
  'basketball', 'racket', 'shuttle', 'gym', 'dumbbells', 't-shirt', 'tshirt', 'jeans',
  'hoodie', 'jacket', 'socks', 'card holder', 'wallet'
];

const LOW_PRIORITY_KEYWORDS = [
  'ac', 'air conditioner', 'refrigerator', 'fridge', 'tv', 'television', 'washing machine',
  'geyser', 'microwave', 'oven', 'chimney', 'dishwasher', 'furniture', 'sofa', 'mattress'
];

function calculatePriorityScore(title: string): number {
  let score = 0;
  const lower = title.toLowerCase();

  for (const kw of SUPER_PRIORITY_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 40;
      break;
    }
  }

  for (const kw of COLLEGE_ESSENTIALS_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 30;
      break;
    }
  }

  for (const kw of LOW_PRIORITY_KEYWORDS) {
    if (lower.includes(kw)) {
      score -= 20;
      break;
    }
  }

  return score;
}

// Vercel Cron routes must be a GET request
export async function GET(request: Request) {
  // Optional: Add a secret key check so random people can't trigger your cron
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📡 Starting Vercel Cron: Deal Scraper...');
  const startTime = Date.now();
  const MAX_EXECUTION_TIME_MS = 8000; // 8 seconds limit for Vercel Free Tier (10s max)
  const MAX_NEW_DEALS_PER_RUN = 5; // Only process 5 new deals at a time

  try {
    let dealsFoundCount = 0;
    let dealsSkippedCount = 0;
    let timeLimitReached = false;

    const candidates: Array<{
      dealInfo: { platform: string; cleanUrl: string; externalId: string };
      item: any;
      priorityScore: number;
    }> = [];

    // Stage 1: Fast Scrape & De-duplicate
    const shuffledChannels = [...COMPETITOR_CHANNELS].sort(() => Math.random() - 0.5);

    for (const channel of shuffledChannels) {
      // Check timeout to make sure we leave enough time for Stage 3 (Amazon/Metadata fetching)
      if (Date.now() - startTime > 3500 || candidates.length >= 15) {
        break;
      }

      const deals = await fetchTelegramDeals(channel);
      
      for (const item of deals) {
        if (Date.now() - startTime > 3500 || candidates.length >= 15) {
          break;
        }

        const dealInfo = await resolveDealUrl(item.link, item.content);
        if (!dealInfo) continue;

        // Find or create platform
        const dealPlatform = await prisma.platform.upsert({
          where: { slug: dealInfo.platform },
          update: {},
          create: { name: dealInfo.platform.charAt(0).toUpperCase() + dealInfo.platform.slice(1), slug: dealInfo.platform }
        });

        // Skip if already in database
        const existingDeal = await prisma.product.findUnique({
          where: { platformId_externalId: { platformId: dealPlatform.id, externalId: dealInfo.externalId } }
        });

        if (existingDeal) {
          dealsSkippedCount++;
          continue;
        }

        // Avoid duplicate candidates in the same run
        if (candidates.some(c => c.dealInfo.externalId === dealInfo.externalId && c.dealInfo.platform === dealInfo.platform)) {
          continue;
        }

        const titleText = item.title || item.previewTitle || item.content || '';
        const priorityScore = calculatePriorityScore(titleText);

        candidates.push({
          dealInfo,
          item,
          priorityScore
        });
      }
    }

    console.log(`📋 Found ${candidates.length} new candidates. Sorting by priority score...`);

    // Stage 2: Sort Candidates by Priority Score
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);

    // Stage 3: Process the best deals (up to MAX_NEW_DEALS_PER_RUN)
    const topCandidates = candidates.slice(0, MAX_NEW_DEALS_PER_RUN);

    for (const candidate of topCandidates) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log('⏰ Reaching Vercel 10s timeout limit. Stopping early to save progress.');
        timeLimitReached = true;
        break;
      }

      const { dealInfo, item } = candidate;

      const dealPlatform = await prisma.platform.upsert({
        where: { slug: dealInfo.platform },
        update: {},
        create: { name: dealInfo.platform.charAt(0).toUpperCase() + dealInfo.platform.slice(1), slug: dealInfo.platform }
      });

      // Generate the affiliate link using the unified wrapper
      const affiliateUrl = getAffiliateUrl(dealInfo.platform, dealInfo.cleanUrl, dealInfo.externalId);

      let finalTitle = '';
      let finalDealPrice = 0;
      let finalOriginalPrice = 0;
      let finalImageUrl = item.imageUrl || '';
      let priceVerified = false;

      if (dealInfo.platform === 'amazon') {
        // Direct Amazon Scraping
        const amzData = await fetchAmazonDetails(dealInfo.externalId);
        
        if (amzData && amzData.title) {
          finalTitle = amzData.title;
          if (amzData.imageUrl) finalImageUrl = amzData.imageUrl;
          
          if (amzData.currentPrice > 0) {
            finalDealPrice = amzData.currentPrice;
            finalOriginalPrice = amzData.originalPrice;
            priceVerified = true;
            console.log(`✅ VERIFIED: ${dealInfo.externalId} → "${finalTitle.substring(0, 40)}" ₹${finalDealPrice} (MRP: ₹${finalOriginalPrice})`);
          }
        }
      } else {
        // Flipkart / Myntra / Ajio Metadata Scraping
        const metaData = await fetchPageMetadata(dealInfo.cleanUrl);
        if (metaData && metaData.title) {
          finalTitle = metaData.title;
          if (metaData.imageUrl) finalImageUrl = metaData.imageUrl;
        }
      }

      // Fallback 1: Use Telegram link preview title
      if (!finalTitle && item.previewTitle) {
        finalTitle = item.previewTitle;
        console.log(`📋 Title from Telegram preview: ${finalTitle.substring(0, 50)}...`);
      }

      // Fallback 2: Last resort — cleaned Telegram text title
      if (!finalTitle) {
        finalTitle = item.title;
        console.log(`⚠️ Title from Telegram text: ${finalTitle.substring(0, 50)}...`);
      }

      // If price is NOT verified, post without price
      if (!priceVerified) {
        finalDealPrice = 0;
        finalOriginalPrice = 0;
        console.log(`⚠️ UNVERIFIED PRICE for ${dealInfo.externalId} — will post without price to maintain trust`);
      }

      const discountPct = (priceVerified && finalOriginalPrice > finalDealPrice) 
        ? Math.round(((finalOriginalPrice - finalDealPrice) / finalOriginalPrice) * 100) 
        : 0;
      
      dealsFoundCount++;

      // Save product
      const product = await prisma.product.create({
        data: {
          platformId: dealPlatform.id,
          externalId: dealInfo.externalId,
          title: sanitizeTitle(finalTitle),
          url: dealInfo.cleanUrl,
          currentPrice: finalDealPrice, 
          imageUrl: finalImageUrl,
        }
      });

      // Save deal
      const deal = await prisma.deal.create({
        data: {
          productId: product.id,
          platformId: dealPlatform.id,
          dealType: 'price_drop',
          dealScore: priceVerified ? 95 : 70,
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
