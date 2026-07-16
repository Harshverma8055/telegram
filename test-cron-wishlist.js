const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const cheerio = require('cheerio');
const prisma = new PrismaClient();

// Helper functions copied from rss.ts / telegram.ts for clean execution
function getRandomUA() {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0'
  ];
  return uas[Math.floor(Math.random() * uas.length)];
}

async function scrapeAmazon(asin) {
  // Use the Discordbot user agent since it bypasses captchas very well
  const url = `https://www.amazon.in/dp/${asin}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
  };

  try {
    console.log(`[Scraper] Fetching ${asin}...`);
    const response = await axios.get(url, { headers, timeout: 10000 });
    const $ = cheerio.load(response.data);
    
    // Title
    const title = $('#productTitle').text().trim();
    
    // Price
    let priceText = $('.a-price-whole').first().text().replace(/[^\d]/g, '');
    let currentPrice = priceText ? parseInt(priceText, 10) : 0;
    
    // Original Price (MRP)
    let mrpText = $('.a-size-small .a-offscreen').first().text().replace(/[^\d]/g, '') || 
                  $('.basisPrice .a-offscreen').first().text().replace(/[^\d]/g, '');
    let originalPrice = mrpText ? parseInt(mrpText, 10) : currentPrice;

    console.log(`[Scraper] Scraped details for ${asin}: Title: "${title.substring(0, 30)}", Price: ₹${currentPrice}, MRP: ₹${originalPrice}`);
    
    return { title, currentPrice, originalPrice };
  } catch (err) {
    console.error(`[Scraper] Failed to scrape ${asin}: ${err.message}`);
    return null;
  }
}

async function testWishlistCron() {
  console.log('🚀 Starting local simulation of cron-wishlist...');
  
  // 1. Fetch products from DB
  const batch = await prisma.$queryRawUnsafe(`
    SELECT * FROM "WishlistProduct"
    WHERE "wishlist" = true
    ORDER BY "last_updated" ASC
    LIMIT 5
  `);

  console.log(`Found ${batch.length} active wishlist products to check.`);

  if (batch.length === 0) {
    console.log('⚠️ No products have wishlist = true! The wishlist is empty or all items have already triggered.');
    return;
  }

  for (const prod of batch) {
    console.log(`\n-----------------------------------------`);
    console.log(`Checking ASIN: ${prod.asin} (${prod.title?.substring(0, 50)})`);
    console.log(`DB Price: ₹${prod.price} | Target Price: ₹${prod.target_price || 'None'} | Target Discount: ${prod.target_discount || 'None'}%`);

    // 2. Fetch from Amazon
    const details = await scrapeAmazon(prod.asin);
    if (!details || !details.currentPrice) {
      console.log(`❌ Could not fetch current price from Amazon for ${prod.asin}. Skipping.`);
      continue;
    }

    const latestPrice = details.currentPrice;
    const originalPrice = details.originalPrice || prod.mrp || latestPrice;
    const latestDiscount = originalPrice > latestPrice
      ? Math.round(((originalPrice - latestPrice) / originalPrice) * 100)
      : 0;

    console.log(`Live Amazon price: ₹${latestPrice} (${latestDiscount}% off)`);

    // 3. Determine if target is met
    let hasHitTargetPrice = false;
    let hasHitTargetDiscount = false;
    const hasCustomTargets = prod.target_price !== null || prod.target_discount !== null;

    if (hasCustomTargets) {
      hasHitTargetPrice = prod.target_price ? latestPrice <= prod.target_price : false;
      hasHitTargetDiscount = prod.target_discount ? latestDiscount >= prod.target_discount : false;
      console.log(`🔎 Target check: Live ₹${latestPrice} <= Target ₹${prod.target_price} ? ${hasHitTargetPrice}`);
    } else {
      const defaultTargetPrice = Math.round(prod.price * 0.95);
      hasHitTargetPrice = latestPrice <= defaultTargetPrice;
      hasHitTargetDiscount = latestDiscount >= 50;
      console.log(`🔎 Default Target check: Live ₹${latestPrice} <= Default Target ₹${defaultTargetPrice} ? ${hasHitTargetPrice}`);
    }

    if (hasHitTargetPrice || hasHitTargetDiscount) {
      console.log(`🎯 TARGET MET! This product qualifies to post to Telegram!`);
      
      // Let's test sending to Telegram (using the token in env)
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        console.log('⚠️ TELEGRAM_BOT_TOKEN is missing in env, cannot test Telegram send.');
        continue;
      }
      
      console.log('Sending test message to @hosteldeals...');
      try {
        const TelegramBotRaw = require('node-telegram-bot-api');
        const TelegramBot = TelegramBotRaw.default || TelegramBotRaw;
        const bot = new TelegramBot(token, { polling: false });
        
        const text = `🎯 *Target Met (Test Run)*:\n[${details.title.substring(0, 50)}](https://www.amazon.in/dp/${prod.asin})\n\n💰 Live Price: *₹${latestPrice}* (MRP: ~₹${originalPrice}~)\n📉 Discount: *${latestDiscount}% OFF*`;
        
        await bot.sendMessage('@hosteldeals', text, { parse_mode: 'Markdown' });
        console.log('✅ Message successfully posted to Telegram!');
      } catch (tgErr) {
        console.error(`❌ Telegram send failed: ${tgErr.message}`);
        console.log(`Please make sure your bot is an ADMIN in @hosteldeals and the handle is correct!`);
      }
    } else {
      console.log(`⏳ Target not met. No Telegram alert triggered.`);
    }
  }
}

testWishlistCron()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
