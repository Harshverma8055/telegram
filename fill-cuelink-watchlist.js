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

// ─── STUDENT CATEGORIES ─────────────────────────────────────────────────────────
// Each category has MULTIPLE queries → more variety, more unique products
// Running once gives ~500 products. Duplicates are auto-skipped.
const CATEGORIES = [
  { key: 'fans',       queries: ['table fan hostel room', 'mini desk fan portable', 'usb fan silent rechargeable'],           category: 'Electronics', subcategory: 'Fans',            targetDiscount: 20 },
  { key: 'earphones',  queries: ['earphones wired budget under 500', 'boat earphones wired', 'jbl earphones in-ear'],         category: 'Electronics', subcategory: 'Earphones',       targetDiscount: 25 },
  { key: 'earbuds',    queries: ['truly wireless earbuds budget', 'boat airdopes earbuds', 'boult earbuds under 1000'],       category: 'Electronics', subcategory: 'Earbuds',         targetDiscount: 30 },
  { key: 'speaker',    queries: ['bluetooth speaker portable', 'boat stone speaker', 'mini speaker waterproof'],              category: 'Electronics', subcategory: 'Speakers',        targetDiscount: 25 },
  { key: 'powerbank',  queries: ['power bank 10000mah', 'mi power bank 20000mah', 'fast charging power bank'],               category: 'Electronics', subcategory: 'Power Banks',     targetDiscount: 20 },
  { key: 'charger',    queries: ['fast charger type c', 'usb c cable braided', '65w gan charger'],                            category: 'Electronics', subcategory: 'Chargers',        targetDiscount: 20 },
  { key: 'laptop_bag', queries: ['laptop bag 15.6 inch', 'laptop backpack waterproof', 'office laptop bag men'],              category: 'Bags',        subcategory: 'Laptop Bags',     targetDiscount: 25 },
  { key: 'backpack',   queries: ['college backpack men', 'school bag 30 litre', 'travel backpack casual'],                    category: 'Bags',        subcategory: 'Backpacks',       targetDiscount: 25 },
  { key: 'tshirt',     queries: ['men polo t-shirt pack', 'men round neck tshirt combo', 'men half sleeve t-shirt'],          category: 'Fashion',     subcategory: 'T-Shirts',        targetDiscount: 40 },
  { key: 'jeans',      queries: ['men slim fit jeans', 'men casual jeans stretchable', 'men regular fit jeans'],              category: 'Fashion',     subcategory: 'Jeans',           targetDiscount: 40 },
  { key: 'shoes',      queries: ['men casual running shoes', 'men sport shoes lightweight', 'men sneakers'],                  category: 'Fashion',     subcategory: 'Casual Shoes',    targetDiscount: 35 },
  { key: 'slippers',   queries: ['men slippers flip flops', 'men bathroom slippers', 'men slides chappal'],                   category: 'Fashion',     subcategory: 'Slippers',        targetDiscount: 30 },
  { key: 'bottle',     queries: ['steel water bottle flask', 'insulated water bottle 1 litre', 'sipper bottle leakproof'],    category: 'Kitchen',     subcategory: 'Bottles',         targetDiscount: 20 },
  { key: 'umbrella',   queries: ['travel umbrella compact windproof', '3 fold umbrella', 'automatic umbrella'],               category: 'Lifestyle',   subcategory: 'Umbrellas',       targetDiscount: 20 },
  { key: 'towel',      queries: ['bath towel cotton', 'microfibre towel gym', 'face towel soft'],                             category: 'Home',        subcategory: 'Towels',          targetDiscount: 30 },
  { key: 'stationery', queries: ['pen set notebook diary', 'parker pen set', 'highlighter marker set'],                       category: 'Stationery',  subcategory: 'Pen & Notebooks', targetDiscount: 20 },
  { key: 'lock',       queries: ['combination padlock room', 'numeric lock almirah', 'travel lock bag'],                      category: 'Home',        subcategory: 'Locks',           targetDiscount: 20 },
  { key: 'lamp',       queries: ['study desk lamp led', 'table lamp rechargeable', 'eye care led study light'],               category: 'Furniture',   subcategory: 'Lamps',           targetDiscount: 25 },
  { key: 'watch',      queries: ['digital watch men budget', 'analog watch men under 500', 'fastrack watch men'],             category: 'Watches',     subcategory: 'Digital Watches', targetDiscount: 35 },
  { key: 'skincare',   queries: ['men face wash moisturizer', 'men grooming kit', 'men sunscreen spf 50'],                    category: 'Beauty',      subcategory: 'Skincare',        targetDiscount: 30 },
  { key: 'fitness',    queries: ['resistance band gym set', 'yoga mat non-slip', 'skipping rope'],                            category: 'Sports',      subcategory: 'Fitness Bands',   targetDiscount: 25 },
  { key: 'curtain',    queries: ['door curtain blackout', 'window curtain eyelet', 'room divider curtain'],                   category: 'Home',        subcategory: 'Curtains',        targetDiscount: 30 },
  { key: 'mirror',     queries: ['wall mirror room', 'table mirror makeup', 'full length mirror'],                            category: 'Home',        subcategory: 'Mirrors',         targetDiscount: 25 },
  { key: 'mosquito',   queries: ['mosquito racket electric', 'mosquito net single bed', 'mosquito killer lamp'],              category: 'Home',        subcategory: 'Mosquito Control',targetDiscount: 20 },
  { key: 'wallet',     queries: ['men leather wallet slim', 'men bifold wallet', 'rfid wallet men'],                          category: 'Accessories', subcategory: 'Wallets',         targetDiscount: 35 },
];

// 500 products = 25 categories × 3 queries × ~7 products each
// Duplicates auto-skipped by externalId unique constraint
const PRODUCTS_PER_QUERY = 8;
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
  console.log(`📋 Categories: ${CATEGORIES.length} | Queries/category: 3 | Products/query: ${PRODUCTS_PER_QUERY}`);
  console.log(`🎯 Target: ~${CATEGORIES.length * 3 * PRODUCTS_PER_QUERY} unique products (duplicates auto-skipped)`);
  console.log('━'.repeat(60));

  let grandTotal = 0;
  let grandSkipped = 0;
  let grandFailed = 0;

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    console.log(`\n[${i + 1}/${CATEGORIES.length}] 📂 ${cat.key} (${cat.queries.length} queries)`);

    // Run each search query for this category
    for (const query of cat.queries) {
      console.log(`  🔍 Searching: "${query}"`);

      let productLinks = [];
      try {
        productLinks = await searchFlipkart(query);
        await sleep(DELAY_MS);
      } catch (err) {
        console.log(`    ❌ Search failed: ${err.message}`);
        grandFailed++;
        continue;
      }

      if (productLinks.length === 0) {
        console.log(`    ⚠️ No results (Flipkart blocked this query)`);
        continue;
      }
      console.log(`    Found ${productLinks.length} → using top ${Math.min(PRODUCTS_PER_QUERY, productLinks.length)}`);

      for (const { url, pid } of productLinks.slice(0, PRODUCTS_PER_QUERY)) {
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
            console.log(`    ⚠️  Incomplete data — skip`);
            grandFailed++;
            continue;
          }

          // ── CORRECT MRP + TARGET PRICE LOGIC ──────────────────────────────────
          // Only use originalPrice as MRP if it is meaningfully HIGHER than current price.
          // Flipkart often returns the same price for both current and original.
          const hasRealMrp = details.originalPrice && details.originalPrice > details.currentPrice * 1.10;
          const mrpToStore = hasRealMrp ? details.originalPrice : details.currentPrice;

          // NEVER base targetPrice on the already-discounted currentPrice!
          // If we have a real MRP → target = MRP * (1 - targetDiscount%)
          // If no real MRP → null (cron triggers on any 3%+ price drop from stored price)
          const targetPrice = hasRealMrp
            ? Math.round(details.originalPrice * (1 - cat.targetDiscount / 100))
            : null;
          // ──────────────────────────────────────────────────────────────────────

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
                mrp: mrpToStore,
                discount: details.discount || 0,
                image: details.imageUrl || '',
                targetPrice,
                targetDiscount: null, // deprecated — cron uses smart price-drop trigger
                active: true,
              },
            });
            grandTotal++;
            const mrpNote = hasRealMrp ? ` (real MRP ₹${details.originalPrice})` : ' (no MRP — price-drop trigger)';
            console.log(`    ✅ Added: "${details.title.substring(0, 50)}" ₹${details.currentPrice}${mrpNote}`);
          } catch (dbErr) {
            if (dbErr.code === 'P2002') { grandSkipped++; }
            else { console.log(`    ❌ DB: ${dbErr.message}`); grandFailed++; }
          }
        } // end products loop

        console.log(`    💤 3s pause...`);
        await sleep(3000);
      } // end queries loop

    if (i < CATEGORIES.length - 1) {
      console.log(`  ⏸️  5s pause before next category...`);
      await sleep(5000);
    }
  } // end categories loop

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
