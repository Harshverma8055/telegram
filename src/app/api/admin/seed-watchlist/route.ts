// =====================================================================
// 🌱 WATCHLIST AUTO-SEEDER — Real Flipkart Product Fetcher
//
// HOW IT WORKS:
// 1. Searches Flipkart for each student-relevant category
// 2. Gets REAL product URLs from search results
// 3. Scrapes each product's REAL title, price, image using OG/JSON-LD
// 4. Inserts into CuelinkWishlist (skips duplicates by externalId)
//
// No fake/AI-generated products. 100% real Flipkart data.
//
// USAGE: GET /api/admin/seed-watchlist?key=<CRON_SECRET>&category=all
//        GET /api/admin/seed-watchlist?key=<CRON_SECRET>&category=fans
// =====================================================================

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { searchFlipkart, fetchProductDetails } from '@/lib/cuelink-scraper';

// =====================================================================
// 20 student-essential categories with search queries + metadata
// All searches are for products actually sold on Flipkart
// =====================================================================
const STUDENT_CATEGORIES = [
  { key: 'fans',        query: 'table fan hostel room',         category: 'Electronics',  subcategory: 'Fans',             targetDiscount: 20 },
  { key: 'earphones',   query: 'earphones wired budget',        category: 'Electronics',  subcategory: 'Earphones',        targetDiscount: 25 },
  { key: 'earbuds',     query: 'truly wireless earbuds budget', category: 'Electronics',  subcategory: 'Earbuds',          targetDiscount: 30 },
  { key: 'speaker',     query: 'bluetooth speaker portable',    category: 'Electronics',  subcategory: 'Speakers',         targetDiscount: 25 },
  { key: 'powerbank',   query: 'power bank 10000mah',           category: 'Electronics',  subcategory: 'Power Banks',      targetDiscount: 20 },
  { key: 'charger',     query: 'fast charger type c cable',     category: 'Electronics',  subcategory: 'Chargers',         targetDiscount: 20 },
  { key: 'laptop_bag',  query: 'laptop bag backpack 15.6 inch', category: 'Bags',         subcategory: 'Laptop Bags',      targetDiscount: 25 },
  { key: 'backpack',    query: 'college backpack men women',     category: 'Bags',         subcategory: 'Backpacks',        targetDiscount: 25 },
  { key: 'tshirt',      query: 'men polo t-shirt pack',         category: 'Fashion',      subcategory: 'T-Shirts',         targetDiscount: 40 },
  { key: 'shoes',       query: 'men casual running shoes',      category: 'Fashion',      subcategory: 'Casual Shoes',     targetDiscount: 35 },
  { key: 'slippers',    query: 'men slippers flip flops',       category: 'Fashion',      subcategory: 'Slippers',         targetDiscount: 30 },
  { key: 'bottle',      query: 'steel water bottle flask 1 litre', category: 'Kitchen',   subcategory: 'Bottles',          targetDiscount: 20 },
  { key: 'umbrella',    query: 'travel umbrella compact windproof', category: 'Lifestyle', subcategory: 'Umbrellas',        targetDiscount: 20 },
  { key: 'towel',       query: 'bath towel cotton quick dry',   category: 'Home',         subcategory: 'Towels',           targetDiscount: 30 },
  { key: 'stationery',  query: 'pen set notebook diary combo',  category: 'Stationery',   subcategory: 'Pen & Notebooks',  targetDiscount: 20 },
  { key: 'lock',        query: 'combination padlock room almirah', category: 'Home',      subcategory: 'Locks',            targetDiscount: 20 },
  { key: 'lamp',        query: 'study desk lamp led eye care',  category: 'Furniture',    subcategory: 'Lamps',            targetDiscount: 25 },
  { key: 'watch',       query: 'digital watch men budget',      category: 'Watches',      subcategory: 'Digital Watches',  targetDiscount: 35 },
  { key: 'skincare',    query: 'men face wash moisturizer combo', category: 'Beauty',     subcategory: 'Skincare',         targetDiscount: 30 },
  { key: 'fitness',     query: 'resistance band gym set',       category: 'Sports',       subcategory: 'Fitness Bands',    targetDiscount: 25 },
];

const PRODUCTS_PER_CATEGORY = 5; // Fetch top 5 real products per category = ~100 total
const DELAY_MS = 1500;           // Delay between requests to avoid being blocked

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract product ID from Flipkart URL (the /p/itm... part)
function extractFlipkartId(url: string): string | null {
  const match = url.match(/pid=([A-Z0-9]+)/i) || url.match(/\/p\/([a-z0-9]+)/i);
  return match ? match[1].toUpperCase() : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  const categoryFilter = searchParams.get('category') || 'all'; // 'all' or specific key

  const isAuthorized = !process.env.CRON_SECRET ||
                       authHeader === `Bearer ${process.env.CRON_SECRET}` ||
                       key === process.env.CRON_SECRET;

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logs: string[] = [];
  let totalAdded = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  const categoriesToProcess = categoryFilter === 'all'
    ? STUDENT_CATEGORIES
    : STUDENT_CATEGORIES.filter(c => c.key === categoryFilter);

  if (categoriesToProcess.length === 0) {
    return NextResponse.json({
      error: `Unknown category "${categoryFilter}". Valid: ${STUDENT_CATEGORIES.map(c => c.key).join(', ')} or "all"`,
    }, { status: 400 });
  }

  logs.push(`🌱 Starting seed for ${categoriesToProcess.length} categories...`);
  console.log(`[seed-watchlist] Processing ${categoriesToProcess.length} categories`);

  for (const cat of categoriesToProcess) {
    logs.push(`\n📂 Category: ${cat.key} | Query: "${cat.query}"`);
    console.log(`[seed-watchlist] Searching Flipkart: "${cat.query}"`);

    // Step 1: Search Flipkart for real product URLs
    let productUrls: { url: string; productId: string }[] = [];
    try {
      productUrls = await searchFlipkart(cat.query);
      await sleep(DELAY_MS);
    } catch (err: any) {
      logs.push(`  ❌ Search failed for "${cat.query}": ${err.message}`);
      totalFailed++;
      continue;
    }

    if (productUrls.length === 0) {
      logs.push(`  ⚠️ No products found for "${cat.query}" — Flipkart may have blocked this search`);
      continue;
    }

    logs.push(`  🔍 Found ${productUrls.length} product URLs — scraping top ${Math.min(PRODUCTS_PER_CATEGORY, productUrls.length)}...`);

    // Step 2: Scrape each product and add to DB
    let addedThisCategory = 0;
    for (const { url, productId } of productUrls.slice(0, PRODUCTS_PER_CATEGORY)) {
      // Use either the extracted PID or fallback productId
      const externalId = extractFlipkartId(url) || productId;

      if (!externalId) {
        logs.push(`  ⚠️ Could not extract product ID from: ${url}`);
        continue;
      }

      // Step 3: Skip if already in DB (deduplication)
      const existing = await prisma.cuelinkWishlist.findUnique({
        where: { externalId },
      });

      if (existing) {
        logs.push(`  ⏭️ Already in watchlist: ${externalId} ("${existing.title.substring(0, 40)}")`);
        totalSkipped++;
        continue;
      }

      // Step 4: Scrape REAL product details from Flipkart
      let details;
      try {
        details = await fetchProductDetails(url);
        await sleep(DELAY_MS);
      } catch (err: any) {
        logs.push(`  ❌ Scrape failed for ${url}: ${err.message}`);
        totalFailed++;
        continue;
      }

      if (!details || !details.title || details.currentPrice === 0) {
        logs.push(`  ⚠️ Incomplete data for ${externalId} — skipping`);
        totalFailed++;
        continue;
      }

      // Step 5: Insert REAL product into CuelinkWishlist
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

        addedThisCategory++;
        totalAdded++;
        logs.push(`  ✅ Added: "${details.title.substring(0, 50)}" ₹${details.currentPrice} (target: ₹${targetPrice})`);
        console.log(`[seed-watchlist] ✅ Added: "${details.title.substring(0, 40)}" ₹${details.currentPrice}`);
      } catch (dbErr: any) {
        if (dbErr.code === 'P2002') {
          // Unique constraint — already exists (race condition)
          logs.push(`  ⏭️ Duplicate (race): ${externalId}`);
          totalSkipped++;
        } else {
          logs.push(`  ❌ DB error for ${externalId}: ${dbErr.message}`);
          totalFailed++;
        }
      }
    }

    logs.push(`  📊 Category "${cat.key}" done: +${addedThisCategory} added`);
  }

  const summary = {
    success: true,
    totalAdded,
    totalSkipped,
    totalFailed,
    categoriesProcessed: categoriesToProcess.length,
    logs,
  };

  console.log(`[seed-watchlist] Done. Added: ${totalAdded}, Skipped: ${totalSkipped}, Failed: ${totalFailed}`);
  return NextResponse.json(summary);
}
