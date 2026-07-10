import { PrismaClient } from '@prisma/client';
import { fetchTelegramDeals, extractAmazonASIN, resolveASIN } from './src/lib/scrapers/rss';
import { publishToTelegram, sanitizeTitle } from './src/lib/telegram';

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
  'under_99_loot_deals'
];

// Target Distribution Channels
const TELEGRAM_CHANNEL = '@fantasticofffer';

async function runAutomationCycle() {
  console.log(`\n[${new Date().toLocaleTimeString()}] Starting Auto-Deal Cycle...`);

  const shuffledChannels = [...COMPETITOR_CHANNELS].sort(() => Math.random() - 0.5);

  for (const channel of shuffledChannels) {
    console.log(`\n📡 Checking Competitor Channel: @${channel}`);
    try {
      const deals = await fetchTelegramDeals(channel);
      console.log(`Found ${deals.length} recent posts.`);

      for (const item of deals) {
        // Use the global resolver to expand shortlinks and extract the ASIN
        const asin = await resolveASIN(item.link, item.content);
        
        if (!asin) continue; // Skip if it's not an Amazon deal

        // Check if we already processed this deal recently to avoid spam
        const platform = await prisma.platform.upsert({
          where: { slug: 'amazon' },
          update: {},
          create: { name: 'Amazon', slug: 'amazon' }
        });

        const existingDeal = await prisma.product.findUnique({
          where: { platformId_externalId: { platformId: platform.id, externalId: asin } }
        });

        if (existingDeal) {
          continue; // We already posted this!
        }

        console.log(`\n💎 New Amazon Deal Found! ASIN: ${asin}`);
        console.log(`Title: ${item.title}`);

        // Generate the affiliate link using your tag from .env
        const affiliateTag = process.env.AMAZON_AFFILIATE_TAG || '';
        const affiliateUrl = affiliateTag 
          ? `https://www.amazon.in/dp/${asin}?tag=${affiliateTag}` 
          : `https://www.amazon.in/dp/${asin}`;

        // Save to Database (sanitize title first)
        const product = await prisma.product.create({
          data: {
            platformId: platform.id,
            externalId: asin,
            title: sanitizeTitle(item.title),
            url: `https://www.amazon.in/dp/${asin}`,
            currentPrice: 0, // Price is unknown via RSS, but they click the link to see it!
            imageUrl: item.imageUrl,
          }
        });

        const deal = await prisma.deal.create({
          data: {
            productId: product.id,
            platformId: platform.id,
            dealType: 'price_drop',
            dealScore: 80, // Assume good score if posted on a deals forum
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
        console.log(`🚀 Triggering Auto-Publish Pipeline for ASIN: ${asin}`);
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
