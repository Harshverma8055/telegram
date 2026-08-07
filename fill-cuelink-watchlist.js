// =====================================================================
// 🌱 CUELINK WATCHLIST FILLER — Direct DB Script (No Vercel needed)
//
// Runs LOCALLY on your machine.
// Directly scrapes Flipkart + inserts into your Supabase DB.
// No Vercel timeout possible.
//
// USAGE:
//   node fill-cuelink-watchlist.js
//
// Make sure .env file has DATABASE_URL set.
// =====================================================================

const axios = require('axios');
const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// Load .env manually
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found at:', envPath);
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();
const prisma = new PrismaClient();

// ─── BOT HEADERS ─────────────────────────────────────────────────────
const BOT_IDENTITIES = [
  { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  { 'User-Agent': 'Twitterbot/1.0', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
];

// ─── STUDENT CATEGORIES ───────────────────────────────────────────────
const CATEGORIES = [
  { key: 'fans',       query: 'table fan hostel room',          category: 'Electronics', subcategory: 'Fans',           targetDiscount: 20 },
  { key: 'earphones',  query: 'earphones wired budget',         category: 'Electronics', subcategory: 'Earphones',      targetDiscount: 25 },
  { key: 'earbuds',    query: 'truly wireless earbuds budget',  category: 'Electronics', subcategory: 'Earbuds',        targetDiscount: 30 },
  { key: 'speaker',    query: 'bluetooth speaker portable',     category: 'Electronics', subcategory: 'Speakers',       targetDiscount: 25 },
  { key: 'powerbank',  query: 'power bank 10000mah',            category: 'Electronics', subcategory: 'Power Banks',    targetDiscount: 20 },
  { key: 'charger',    query: 'fast charger type c cable',      category: 'Electronics', subcategory: 'Chargers',       targetDiscount: 20 },
  { key: 'laptop_bag', query: 'laptop bag backpack 15.6 inch',  category: 'Bags',        subcategory: 'Laptop Bags',    targetDiscount: 25 },
  { key: 'backpack',   query: 'college backpack men women',     category: 'Bags',        subcategory: 'Backpacks',      targetDiscount: 25 },
  { key: 'tshirt',     query: 'men polo t-shirt pack',          category: 'Fashion',     subcategory: 'T-Shirts',       targetDiscount: 40 },
  { key: 'shoes',      query: 'men casual running shoes',       category: 'Fashion',     subcategory: 'Casual Shoes',   targetDiscount: 35 },
  { key: 'slippers',   query: 'men slippers flip flops',        category: 'Fashion',     subcategory: 'Slippers',       targetDiscount: 30 },
  { key: 'bottle',     query: 'steel water bottle flask',       category: 'Kitchen',     subcategory: 'Bottles',        targetDiscount: 20 },
  { key: 'umbrella',   query: 'travel umbrella compact',        category: 'Lifestyle',   subcategory: 'Umbrellas',      targetDiscount: 20 },
  { key: 'towel',      query: 'bath towel cotton quick dry',    category: 'Home',        subcategory: 'Towels',         targetDiscount: 30 },
  { key: 'stationery', query: 'pen set notebook diary',         category: 'Stationery',  subcategory: 'Pen & Notebooks',targetDiscount: 20 },
  { key: 'lock',       query: 'combination padlock room',       category: 'Home',        subcategory: 'Locks',          targetDiscount: 20 },
  { key: 'lamp',       query: 'study desk lamp led',            category: 'Furniture',   subcategory: 'Lamps',          targetDiscount: 25 },
  { key: 'watch',      query: 'digital watch men budget',       category: 'Watches',     subcategory: 'Digital Watches',targetDiscount: 35 },
  { key: 'skincare',   query: 'men face wash moisturizer',      category: 'Beauty',      subcategory: 'Skincare',       targetDiscount: 30 },
  { key: 'fitness',    query: 'resistance band gym set',        category: 'Sports',      subcategory: 'Fitness Bands',  targetDiscount: 25 },
];

const PRODUCTS_PER_CATEGORY = 5;
const DELAY_MS = 2000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractFlipkartId(url) {
  const match = url.match(/pid=([A-Z0-9]+)/i) || url.match(/\/p\/([a-z0-9]+)/i);
  return match ? match[1].toUpperCase() : null;
}

// Search Flipkart category page for product URLs
async function searchFlipkart(query) {
  const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
  for (const headers of BOT_IDENTITIES) {
    try {
      const res = await axios.get(searchUrl, { headers, timeout: 8000, maxRedirects: 5 });
      const $ = cheerio.load(res.data);
      const products = [];
      $('a[href*="/p/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/p/')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.flipkart.com${href}`;
          const pid = extractFlipkartId(fullUrl);
          if (pid && !products.some(p => p.pid === pid)) {
            products.push({ url: fullUrl.split('?')[0], pid });
          }
        }
      });
      if (products.length > 0) return products;
    } catch (_) {}
  }
  return [];
}

// Scrape real product details from a Flipkart product page
async function fetchProductDetails(productUrl) {
  for (const headers of BOT_IDENTITIES) {
    try {
      const res = await axios.get(productUrl, { headers, timeout: 8000, maxRedirects: 5 });
      const $ = cheerio.load(res.data);

      let title = $('meta[property="og:title"]').attr('content')
        || $('meta[name="title"]').attr('content')
        || $('title').text() || '';
      title = title.replace(/\s*[-|].*$/, '').trim();

      let imageUrl = $('meta[property="og:image"]').attr('content')
        || $('meta[name="twitter:image"]').attr('content') || '';

      let currentPrice = 0, originalPrice = 0;

      // JSON-LD structured data (most reliable)
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || '{}');
          const offers = json.offers || (json['@graph'] && json['@graph'].find(g => g.offers))?.offers;
          if (offers) {
            const offer = Array.isArray(offers) ? offers[0] : offers;
            if (offer.price) currentPrice = parseFloat(offer.price) || 0;
            if (offer.highPrice) originalPrice = parseFloat(offer.highPrice) || 0;
            if (offer.listPrice) originalPrice = parseFloat(offer.listPrice) || 0;
          }
        } catch (_) {}
      });

      // OG price meta
      if (!currentPrice) {
        const ogPrice = $('meta[property="product:price:amount"]').attr('content');
        if (ogPrice) currentPrice = parseFloat(ogPrice) || 0;
      }

      // Flipkart price selectors
      if (!currentPrice) {
        const txt = $('div._30jeq3, span._30jeq3').first().text().replace(/,/g, '');
        const m = txt.match(/(\d+)/);
        if (m) currentPrice = parseInt(m[1]);
      }
      if (!originalPrice) {
        const txt = $('div._3I9_wc, span._3I9_wc').first().text().replace(/,/g, '');
        const m = txt.match(/(\d+)/);
        if (m) originalPrice = parseInt(m[1]);
      }

      // Generic rupee pattern fallback
      if (!currentPrice) {
        const m = $('body').text().match(/₹\s?([\d,]+)/);
        if (m) currentPrice = parseInt(m[1].replace(/,/g, ''));
      }

      if (!originalPrice) originalPrice = currentPrice;
      const discount = originalPrice > currentPrice && currentPrice > 0
        ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

      if (title && title.length > 5) {
        return { title, currentPrice, originalPrice, imageUrl, discount };
      }
    } catch (_) {}
  }
  return null;
}

// ─── MAIN ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 DealFlow AI — Cuelink Watchlist Filler (Direct DB Mode)');
  console.log(`📋 Categories: ${CATEGORIES.length} | Products per category: ${PRODUCTS_PER_CATEGORY}`);
  console.log('━'.repeat(60));

  let grandTotal = 0;
  let grandSkipped = 0;
  let grandFailed = 0;

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    console.log(`\n[${i + 1}/${CATEGORIES.length}] 📂 ${cat.key} → "${cat.query}"`);

    // Search Flipkart
    let productLinks = [];
    try {
      productLinks = await searchFlipkart(cat.query);
      await sleep(DELAY_MS);
    } catch (err) {
      console.log(`  ❌ Search failed: ${err.message}`);
      grandFailed++;
      continue;
    }

    if (productLinks.length === 0) {
      console.log(`  ⚠️ No results found (Flipkart may have blocked)`);
      continue;
    }
    console.log(`  🔍 Found ${productLinks.length} products — scraping top ${Math.min(PRODUCTS_PER_CATEGORY, productLinks.length)}`);

    for (const { url, pid } of productLinks.slice(0, PRODUCTS_PER_CATEGORY)) {
      const externalId = pid || extractFlipkartId(url);
      if (!externalId) { grandFailed++; continue; }

      // Deduplication check
      const exists = await prisma.cuelinkWishlist.findUnique({ where: { externalId } });
      if (exists) {
        console.log(`  ⏭️  Already exists: ${externalId}`);
        grandSkipped++;
        continue;
      }

      // Scrape real data
      let details;
      try {
        details = await fetchProductDetails(url);
        await sleep(DELAY_MS);
      } catch (err) {
        console.log(`  ❌ Scrape error: ${err.message}`);
        grandFailed++;
        continue;
      }

      if (!details || !details.title || !details.currentPrice) {
        console.log(`  ⚠️  Incomplete data for ${externalId} — skip`);
        grandFailed++;
        continue;
      }

      const targetPrice = Math.round(details.currentPrice * (1 - cat.targetDiscount / 100));

      try {
        await prisma.cuelinkWishlist.create({
          data: {
            externalId,
            platform: 'flipkart',
            title: details.title.substring(0, 500),
            productUrl: url,
            brand: null,
            category: cat.category,
            subcategory: cat.subcategory,
            price: details.currentPrice,
            mrp: details.originalPrice || details.currentPrice,
            discount: details.discount || 0,
            image: details.imageUrl || '',
            targetPrice,
            targetDiscount: cat.targetDiscount,
            active: true,
          },
        });
        grandTotal++;
        console.log(`  ✅ Added: "${details.title.substring(0, 50)}" ₹${details.currentPrice}`);
      } catch (dbErr) {
        if (dbErr.code === 'P2002') { grandSkipped++; }
        else { console.log(`  ❌ DB: ${dbErr.message}`); grandFailed++; }
      }
    }

    if (i < CATEGORIES.length - 1) {
      console.log(`  💤 5s pause before next category...`);
      await sleep(5000);
    }
  }

  await prisma.$disconnect();
  console.log('\n' + '━'.repeat(60));
  console.log(`🎉 COMPLETE!`);
  console.log(`   ✅ Added:   ${grandTotal} new products`);
  console.log(`   ⏭️  Skipped: ${grandSkipped} (already existed)`);
  console.log(`   ❌ Failed:  ${grandFailed} (scrape/parse issues)`);
  console.log(`\n📡 cron-wishlist2 will now monitor these for price drops!`);
  console.log('━'.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
