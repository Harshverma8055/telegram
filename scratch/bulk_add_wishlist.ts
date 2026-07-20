import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fetchAmazonDetails } from '../src/lib/stealth-scraper';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const STEALTH_IDENTITIES = [
  {
    name: 'googlebot',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
    }
  },
  {
    name: 'facebookbot',
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  },
  {
    name: 'telegrambot',
    headers: {
      'User-Agent': 'TelegramBot (like TwitterBot)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  }
];

interface BulkQuery {
  query: string;
  category: string;
  subcategory: string;
  targetDiscount?: number;
}

// Default list of items to scrape if no custom file is provided
const DEFAULT_BULK_QUERIES: BulkQuery[] = [
  { category: 'Hostel Living', subcategory: 'Umbrella', query: 'Destinio Umbrella 3 fold automatic', targetDiscount: 20 },
  { category: 'Stationery', subcategory: 'A4 Paper', query: 'JK Copier A4 Paper 75 GSM', targetDiscount: 15 },
  { category: 'Stationery', subcategory: 'Pens', query: 'Hauser XO Ball Pen pack of 20', targetDiscount: 20 },
  { category: 'Fashion', subcategory: 'Sneakers', query: 'Red Tape Sneakers men white', targetDiscount: 30 },
  { category: 'Hostel Living', subcategory: 'Study Chair', query: 'CELLBELL C190 Berlin office chair', targetDiscount: 20 },
  { category: 'Hostel Living', subcategory: 'Extension Board', query: 'Panasonic Anchor extension board surge protector', targetDiscount: 15 },
  { category: 'Electronics', subcategory: 'LAN Cable', query: 'D-Link Cat6 UTP LAN Cable 5m', targetDiscount: 20 },
  { category: 'Hostel Living', subcategory: 'Bed Sheet', query: 'BSY Premium Cotton Single Bedsheet', targetDiscount: 20 },
  { category: 'Hostel Living', subcategory: 'Mattress', query: 'Sleepwell Dual PRO Single Mattress', targetDiscount: 20 },
  { category: 'Hostel Living', subcategory: 'Curtain', query: 'Urban Space Blackout Door Curtain', targetDiscount: 20 },
  { category: 'Hostel Living', subcategory: 'Room Lights', query: 'Desidiya 10m waterproof LED string fairy lights', targetDiscount: 20 },
  { category: 'Grooming', subcategory: 'Deodorant', query: 'Denver Hamilton Deodorant combo pack', targetDiscount: 20 },
  { category: 'Fashion', subcategory: 'Wallet', query: 'Hornbull slim leather wallet men', targetDiscount: 30 },
  { category: 'Hostel Living', subcategory: 'Cable Organizer', query: 'AmazonBasics multi-purpose cable organizer clips', targetDiscount: 15 }
];

async function searchAmazon(query: string): Promise<string[]> {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  for (const identity of STEALTH_IDENTITIES) {
    try {
      const response = await axios.get(url, {
        headers: identity.headers,
        timeout: 5000
      });
      const $ = cheerio.load(response.data);
      const asins: string[] = [];
      $('div[data-asin]').each((_, el) => {
        const asin = $(el).attr('data-asin');
        if (asin && asin.length === 10 && !asins.includes(asin)) {
          asins.push(asin);
        }
      });
      if (asins.length > 0) return asins;
    } catch (_) {}
  }
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  let queriesToProcess: BulkQuery[] = DEFAULT_BULK_QUERIES;

  // If a JSON file is passed as argument, load queries from it
  if (args.length > 0) {
    const filePath = path.resolve(args[0]);
    if (fs.existsSync(filePath)) {
      try {
        console.log(`📂 Loading custom queries from: ${filePath}`);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        queriesToProcess = JSON.parse(fileContent);
      } catch (err: any) {
        console.error(`❌ Error reading custom JSON file: ${err.message}`);
        process.exit(1);
      }
    } else {
      console.error(`❌ File not found: ${filePath}`);
      console.log('Usage: npx tsx scratch/bulk_add_wishlist.ts [optional-queries-file.json]');
      process.exit(1);
    }
  }

  console.log(`🤖 DealFlow AI Autopilot Wishlist Seeder`);
  console.log(`Processing ${queriesToProcess.length} search queries on autopilot...\n`);

  let addedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < queriesToProcess.length; i++) {
    const item = queriesToProcess[i];
    console.log(`[${i + 1}/${queriesToProcess.length}] 🔍 Searching for "${item.query}"...`);
    
    try {
      const asins = await searchAmazon(item.query);
      if (asins.length === 0) {
        console.warn(`  ⚠️ No ASINs found for query: "${item.query}"`);
        failedCount++;
        continue;
      }

      console.log(`  Found ASINs: ${asins.slice(0, 10).join(', ')}`);
      let success = false;

      // Try top 10 ASINs to find a new one not already in the wishlist
      for (const asin of asins.slice(0, 10)) {
        // Skip if already in wishlist database
        const existing = await prisma.wishlistProduct.findUnique({
          where: { asin }
        });
        if (existing && existing.wishlist) {
          console.log(`  ⏭️ Skipping ASIN ${asin} (already exists in wishlist)`);
          continue;
        }

        console.log(`  Scraping details for ASIN: ${asin}...`);
        const details = await fetchAmazonDetails(asin);

        if (details && details.title && details.currentPrice > 0 && details.imageUrl) {
          // Heal the image url (large size image)
          let cleanedImage = details.imageUrl;
          if (cleanedImage.includes('._SX') || cleanedImage.includes('._SY') || cleanedImage.includes('._SL')) {
            cleanedImage = cleanedImage.replace(/\._S[XYZL]\d+_[^.]*/, '');
          }

          const targetDiscount = item.targetDiscount || 20;
          const mrp = details.originalPrice || details.currentPrice;
          const discount = mrp > 0 ? Math.round(((mrp - details.currentPrice) / mrp) * 100) : 0;
          const targetPrice = Math.round(details.currentPrice * (1 - targetDiscount / 100));

          await prisma.wishlistProduct.upsert({
            where: { asin },
            update: {
              title: details.title,
              category: item.category,
              subcategory: item.subcategory,
              price: details.currentPrice,
              mrp,
              discount,
              image: cleanedImage,
              targetPrice,
              targetDiscount,
              wishlist: true,
              lastUpdated: new Date()
            },
            create: {
              asin,
              title: details.title,
              amazonUrl: `https://www.amazon.in/dp/${asin}`,
              brand: details.title.split(' ')[0] || 'Generic',
              category: item.category,
              subcategory: item.subcategory,
              price: details.currentPrice,
              mrp,
              discount,
              image: cleanedImage,
              targetPrice,
              targetDiscount,
              wishlist: true,
              rating: 4.3,
              reviewCount: 120,
              availability: 'Available',
              prime: true,
              priorityScore: 80,
              buyScore: 70,
              studentScore: 90,
              hostelScore: 95,
              fashionScore: 50,
              giftScore: 40,
              affiliateScore: 80
            }
          });

          console.log(`  ✅ Added: "${details.title.substring(0, 45)}..." | Price: ₹${details.currentPrice} | Target: ₹${targetPrice}`);
          success = true;
          addedCount++;
          break;
        } else {
          console.warn(`  ⚠️ ASIN ${asin} did not return complete details.`);
        }

        // Delay to avoid Amazon rate limiting between ASIN tries
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!success) {
        console.error(`  ❌ Failed to resolve any working product for: "${item.query}"`);
        failedCount++;
      }

    } catch (err: any) {
      console.error(`  ❌ Unexpected error: ${err.message}`);
      failedCount++;
    }

    // Delay to avoid Amazon rate limiting between query searches
    await new Promise(r => setTimeout(r, 1500));
    console.log();
  }

  console.log(`🎉 Autopilot Seeding Completed!`);
  console.log(`✅ Successfully added/updated: ${addedCount} items`);
  console.log(`❌ Failed to add: ${failedCount} items`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
