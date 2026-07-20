import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fetchAmazonDetails } from '../src/lib/stealth-scraper';

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
  
  if (args.length < 3) {
    console.log('Usage: npx tsx scratch/add_to_wishlist.ts "<search-query>" "<category>" "<subcategory>" [target-discount]');
    console.log('Example: npx tsx scratch/add_to_wishlist.ts "automatic 3 fold umbrella" "Hostel Living" "Umbrella" 20');
    process.exit(1);
  }

  const query = args[0];
  const category = args[1];
  const subcategory = args[2];
  const targetDiscount = args[3] ? parseInt(args[3], 10) : 20;

  console.log(`🔍 Searching Amazon for "${query}"...`);
  const asins = await searchAmazon(query);

  if (asins.length === 0) {
    console.error('❌ No ASINs found for search query.');
    process.exit(1);
  }

  console.log(`Found ASINs: ${asins.slice(0, 5).join(', ')}`);
  
  let added = false;

  for (const asin of asins.slice(0, 3)) {
    console.log(`🔍 Scrape details for ASIN: ${asin}...`);
    const details = await fetchAmazonDetails(asin);

    if (details && details.title && details.currentPrice > 0 && details.imageUrl) {
      console.log(`✅ Scraped successfully: "${details.title.substring(0, 60)}..."`);
      
      // Clean up image url (large image)
      let cleanedImage = details.imageUrl;
      if (cleanedImage.includes('._SX') || cleanedImage.includes('._SY') || cleanedImage.includes('._SL')) {
        cleanedImage = cleanedImage.replace(/\._S[XYZL]\d+_[^.]*/, '');
      }

      const mrp = details.originalPrice || details.currentPrice;
      const discount = mrp > 0 ? Math.round(((mrp - details.currentPrice) / mrp) * 100) : 0;
      const targetPrice = Math.round(details.currentPrice * (1 - targetDiscount / 100));

      console.log(`🌱 Adding to database wishlist...`);
      
      await prisma.wishlistProduct.upsert({
        where: { asin },
        update: {
          title: details.title,
          category,
          subcategory,
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
          brand: details.title.split(' ')[0],
          category,
          subcategory,
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

      console.log(`🎉 Successfully added "${details.title.substring(0, 50)}..." to database wishlist with ASIN ${asin}!`);
      added = true;
      break;
    } else {
      console.log(`⚠️ ASIN ${asin} did not return complete details, trying next...`);
    }
  }

  if (!added) {
    console.error('❌ Failed to add any of the top products to the wishlist.');
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
