import { PrismaClient } from '@prisma/client';
import { fetchTelegramDeals, resolveDealUrl } from './src/lib/scrapers/rss';
import { publishToTelegram, sanitizeTitle } from './src/lib/telegram';
import { getAffiliateUrl } from './src/lib/affiliate';

const prisma = new PrismaClient();

// The Competitor Telegram Channels we are monitoring
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
  'under_99_loot_deals',
  'rapiddeals_unlimited'
];

// Target Distribution Channels
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

async function runAutomationCycle() {
  console.log(`\n[${new Date().toLocaleTimeString()}] Starting Auto-Deal Cycle...`);

  const shuffledChannels = [...COMPETITOR_CHANNELS].sort(() => Math.random() - 0.5);

  for (const channel of shuffledChannels) {
    console.log(`\n📡 Checking Competitor Channel: @${channel}`);
    try {
      const deals = await fetchTelegramDeals(channel);
      console.log(`Found ${deals.length} recent posts.`);

      for (const item of deals) {
        // Use the global resolver to expand shortlinks and detect the platform
        const dealInfo = await resolveDealUrl(item.link, item.content);
        
        if (!dealInfo) continue; // Skip if it's not a recognized platform deal

        // Find or create the platform (e.g. Amazon, Flipkart, Myntra, Ajio)
        const platformObj = await prisma.platform.upsert({
          where: { slug: dealInfo.platform },
          update: {},
          create: { 
            name: dealInfo.platform.charAt(0).toUpperCase() + dealInfo.platform.slice(1), 
            slug: dealInfo.platform 
          }
        });

        const existingDeal = await prisma.product.findUnique({
          where: { platformId_externalId: { platformId: platformObj.id, externalId: dealInfo.externalId } }
        });

        if (existingDeal) {
          continue; // We already posted this!
        }

        console.log(`\n💎 New ${dealInfo.platform.toUpperCase()} Deal Found! ID: ${dealInfo.externalId}`);
        console.log(`Title: ${item.title}`);

        // Generate the affiliate link using your mapping from .env
        const affiliateUrl = getAffiliateUrl(dealInfo.platform, dealInfo.cleanUrl, dealInfo.externalId);

        const titleText = item.title || item.previewTitle || '';
        const priorityAdjustment = calculatePriorityScore(titleText);
        const dealScore = Math.max(10, Math.min(100, 75 + priorityAdjustment));

        // Save to Database (sanitize title first)
        const product = await prisma.product.create({
          data: {
            platformId: platformObj.id,
            externalId: dealInfo.externalId,
            title: sanitizeTitle(item.title),
            url: dealInfo.cleanUrl,
            currentPrice: 0, // Price is unknown via RSS, but they click the link to see it!
            imageUrl: item.imageUrl,
          }
        });

        const deal = await prisma.deal.create({
          data: {
            productId: product.id,
            platformId: platformObj.id,
            dealType: 'price_drop',
            dealScore: dealScore, 
            dealPrice: 0, 
            affiliateUrl: affiliateUrl,
            isGenuine: true,
            isPublished: false,
          }
        });

        // QUALITY CONTROL MODE: Save to database for manual review in the Dashboard
        // Instead of auto-publishing, you click the Green Checkmark in your dashboard to publish.
        console.log(`\n⏸️  Deal saved to Dashboard for Manual Review: ${item.title}`);
        
        /* 
        // If you want to turn full 100% auto-pilot back on, uncomment this block:
        console.log(`🚀 Triggering Auto-Publish Pipeline for ID: ${dealInfo.externalId}`);
        try {
          await publishToTelegram(deal.id, TELEGRAM_CHANNEL);
          console.log(`✅ Auto-Published to Telegram: ${TELEGRAM_CHANNEL}`);
        } catch (e: any) {
          console.error(`❌ Telegram Publish Error:`, e.message);
        }
        */

        // Wait 3 seconds to avoid spamming the database
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (err: any) {
      console.error(`Error processing channel ${channel}:`, err.message);
    }
  }
  
  console.log(`\n[${new Date().toLocaleTimeString()}] Cycle Complete. Waiting 15 minutes for next check...`);
}

async function start() {
  console.log('🤖 DealFlow AI RSS Automation Engine Starting...');
  
  // Run cycle immediately, then every 15 minutes
  await runAutomationCycle();
  setInterval(runAutomationCycle, 15 * 60 * 1000);
}

start().catch(console.error);
