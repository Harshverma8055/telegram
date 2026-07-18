import { PrismaClient } from '@prisma/client';
import { searchFlipkart, fetchProductDetails } from '../src/lib/cuelink-scraper';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BulkQuery {
  query: string;
  category: string;
  subcategory: string;
  targetDiscount?: number;
}

const DEFAULT_QUERIES: BulkQuery[] = [
  { query: "boAt Rockerz 255 neckband", category: "Electronics", subcategory: "Earphones", targetDiscount: 30 },
  { query: "JBL Tune 510BT headphone", category: "Electronics", subcategory: "Headphones", targetDiscount: 25 },
  { query: "Noise ColorFit smartwatch", category: "Electronics", subcategory: "Smartwatch", targetDiscount: 30 },
  { query: "Redgear gaming mouse", category: "Electronics", subcategory: "Mouse", targetDiscount: 20 },
  { query: "Ambrane 10000mAh power bank", category: "Electronics", subcategory: "Power Bank", targetDiscount: 25 },
  { query: "Campus sneakers men white", category: "Fashion", subcategory: "Sneakers", targetDiscount: 30 },
  { query: "Puma running shoes men", category: "Fashion", subcategory: "Shoes", targetDiscount: 30 },
  { query: "Allen Solly polo t-shirt men", category: "Fashion", subcategory: "T-Shirt", targetDiscount: 30 },
  { query: "Levi's slim fit jeans men", category: "Fashion", subcategory: "Jeans", targetDiscount: 30 },
  { query: "Wildcraft backpack laptop bag", category: "Bags", subcategory: "Backpack", targetDiscount: 25 },
  { query: "American Tourister trolley bag", category: "Bags", subcategory: "Luggage", targetDiscount: 30 },
  { query: "Philips trimmer men BT1233", category: "Grooming", subcategory: "Trimmer", targetDiscount: 25 },
  { query: "Denver deodorant combo pack", category: "Grooming", subcategory: "Deodorant", targetDiscount: 25 },
  { query: "Cetaphil face wash gentle", category: "Grooming", subcategory: "Face Wash", targetDiscount: 20 },
  { query: "Lakme kajal eyeliner", category: "Beauty", subcategory: "Kajal", targetDiscount: 20 },
  { query: "Maybelline lipstick matte", category: "Beauty", subcategory: "Lipstick", targetDiscount: 25 },
  { query: "Mamaearth vitamin C serum", category: "Beauty", subcategory: "Serum", targetDiscount: 20 },
  { query: "Strauss yoga mat 6mm", category: "Sports", subcategory: "Yoga", targetDiscount: 20 },
  { query: "Yonex badminton racket", category: "Sports", subcategory: "Badminton", targetDiscount: 20 },
  { query: "Casio scientific calculator fx-991", category: "Stationery", subcategory: "Calculator", targetDiscount: 15 },
  { query: "Samsung Galaxy Buds earbuds", category: "Electronics", subcategory: "Earbuds", targetDiscount: 25 },
  { query: "Fire-Boltt smartwatch men", category: "Electronics", subcategory: "Smartwatch", targetDiscount: 30 },
  { query: "Logitech wireless mouse", category: "Electronics", subcategory: "Mouse", targetDiscount: 20 },
  { query: "boAt bluetooth speaker Stone", category: "Electronics", subcategory: "Speaker", targetDiscount: 25 },
  { query: "SanDisk 64GB pendrive USB 3.0", category: "Electronics", subcategory: "Pen Drive", targetDiscount: 20 },
  { query: "Nike Revolution running shoes men", category: "Fashion", subcategory: "Shoes", targetDiscount: 30 },
  { query: "Adidas track pants men slim", category: "Fashion", subcategory: "Track Pants", targetDiscount: 30 },
  { query: "US Polo Assn casual shirt men", category: "Fashion", subcategory: "Shirt", targetDiscount: 30 },
  { query: "Woodland leather belt men", category: "Fashion", subcategory: "Belt", targetDiscount: 25 },
  { query: "Fastrack sunglasses men UV", category: "Fashion", subcategory: "Sunglasses", targetDiscount: 25 },
  { query: "Tommy Hilfiger wallet men leather", category: "Fashion", subcategory: "Wallet", targetDiscount: 30 },
  { query: "Jockey cotton brief pack men", category: "Fashion", subcategory: "Innerwear", targetDiscount: 20 },
  { query: "Puma socks pack of 6", category: "Fashion", subcategory: "Socks", targetDiscount: 20 },
  { query: "Safari duffel bag travel", category: "Bags", subcategory: "Duffel", targetDiscount: 25 },
  { query: "Fur Jaden sling bag men", category: "Bags", subcategory: "Sling Bag", targetDiscount: 25 },
  { query: "Fogg body spray men deodorant", category: "Grooming", subcategory: "Deodorant", targetDiscount: 25 },
  { query: "Wild Stone perfume men", category: "Grooming", subcategory: "Perfume", targetDiscount: 25 },
  { query: "Nivea Men face wash", category: "Grooming", subcategory: "Face Wash", targetDiscount: 20 },
  { query: "Neutrogena sunscreen SPF50", category: "Grooming", subcategory: "Sunscreen", targetDiscount: 20 },
  { query: "Plum green tea face wash", category: "Beauty", subcategory: "Face Wash", targetDiscount: 20 },
  { query: "sugar cosmetics lipstick matte", category: "Beauty", subcategory: "Lipstick", targetDiscount: 25 },
  { query: "WOW apple cider shampoo", category: "Beauty", subcategory: "Shampoo", targetDiscount: 20 },
  { query: "Dove body lotion moisturizer", category: "Beauty", subcategory: "Body Lotion", targetDiscount: 20 },
  { query: "Boldfit skipping rope adjustable", category: "Sports", subcategory: "Fitness", targetDiscount: 20 },
  { query: "Cosco cricket ball tennis", category: "Sports", subcategory: "Cricket", targetDiscount: 15 },
  { query: "Nivia football size 5", category: "Sports", subcategory: "Football", targetDiscount: 20 },
  { query: "Milton thermosteel bottle 1L", category: "Hostel Living", subcategory: "Bottle", targetDiscount: 20 },
  { query: "electric kettle 1 liter steel", category: "Hostel Living", subcategory: "Kettle", targetDiscount: 20 },
  { query: "LED desk lamp study light", category: "Hostel Living", subcategory: "Desk Lamp", targetDiscount: 20 },
  { query: "portable laptop stand adjustable", category: "Hostel Living", subcategory: "Laptop Stand", targetDiscount: 20 },
];

async function main() {
  const args = process.argv.slice(2);
  let queries: BulkQuery[] = DEFAULT_QUERIES;

  if (args.length > 0) {
    const filePath = path.resolve(args[0]);
    if (fs.existsSync(filePath)) {
      console.log(`📂 Loading custom queries from: ${filePath}`);
      queries = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  }

  console.log(`🔗 Flipkart Wishlist 2 Autopilot Seeder`);
  console.log(`Processing ${queries.length} search queries...\n`);

  let addedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < queries.length; i++) {
    const item = queries[i];
    console.log(`[${i + 1}/${queries.length}] 🔍 Searching Flipkart for "${item.query}"...`);

    try {
      const products = await searchFlipkart(item.query);
      if (products.length === 0) {
        console.warn(`  ⚠️ No products found for: "${item.query}"`);
        failedCount++;
        continue;
      }

      let success = false;

      for (const prod of products.slice(0, 5)) {
        // Skip if already in cuelink wishlist
        const existing = await prisma.cuelinkWishlist.findUnique({
          where: { externalId: prod.productId }
        });
        if (existing) {
          console.log(`  ⏭️ Skipping ${prod.productId} (already exists)`);
          continue;
        }

        console.log(`  Scraping: ${prod.url.substring(0, 60)}...`);
        const details = await fetchProductDetails(prod.url);

        if (details && details.title && details.title.length > 5 && details.imageUrl) {
          const targetDiscount = item.targetDiscount || 20;
          const targetPrice = details.currentPrice > 0 ? Math.round(details.currentPrice * (1 - targetDiscount / 100)) : null;

          await prisma.cuelinkWishlist.create({
            data: {
              externalId: prod.productId,
              platform: 'flipkart',
              title: details.title,
              productUrl: prod.url,
              brand: details.title.split(' ')[0] || 'Generic',
              category: item.category,
              subcategory: item.subcategory,
              price: details.currentPrice || 0,
              mrp: details.originalPrice || details.currentPrice || 0,
              discount: details.discount || 0,
              image: details.imageUrl,
              targetPrice,
              targetDiscount,
              active: true,
            },
          });

          console.log(`  ✅ Added: "${details.title.substring(0, 45)}..." | ₹${details.currentPrice} | Target: ₹${targetPrice}`);
          addedCount++;
          success = true;
          break;
        }

        await new Promise(r => setTimeout(r, 1000));
      }

      if (!success) {
        console.error(`  ❌ Failed for: "${item.query}"`);
        failedCount++;
      }

    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
      failedCount++;
    }

    await new Promise(r => setTimeout(r, 1500));
    console.log();
  }

  console.log(`\n🎉 Flipkart Wishlist 2 Seeding Completed!`);
  console.log(`✅ Added: ${addedCount} items`);
  console.log(`❌ Failed: ${failedCount} items`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
