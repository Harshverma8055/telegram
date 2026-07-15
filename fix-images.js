import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// A simple robust scraper just for images to fix the DB
async function getRealAmazonImage(asin) {
  try {
    const url = `https://www.amazon.in/dp/${asin}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Find the high-res landing image or the main image
    let imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src');
    
    // Fallback to OpenGraph image
    if (!imageUrl) {
      imageUrl = $('meta[property="og:image"]').attr('content');
    }

    // Try finding it in the dynamic image scripts if still missing
    if (!imageUrl) {
        const html = response.data;
        const match = html.match(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
        if (match && match[1]) {
            imageUrl = match[1];
        }
    }

    return imageUrl || null;
  } catch (error) {
    console.error(`Failed to scrape ${asin}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 Starting Database Image Healer...');
  
  const products = await prisma.product.findMany({
    where: { category: 'watchlist' },
    include: { platform: true }
  });

  console.log(`Found ${products.length} watchlist products. Checking for fake images...`);

  let fixedCount = 0;
  let failedCount = 0;

  for (const product of products) {
    if (product.platform?.slug === 'amazon') {
      const asin = product.externalId;
      console.log(`\nChecking: ${product.title} (ASIN: ${asin})`);
      
      const realImageUrl = await getRealAmazonImage(asin);
      
      if (realImageUrl && realImageUrl !== product.imageUrl) {
        console.log(`✅ Found REAL image: ${realImageUrl}`);
        await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl: realImageUrl }
        });
        fixedCount++;
      } else if (!realImageUrl) {
        console.log(`❌ Could not fetch real image for ${asin}`);
        failedCount++;
      } else {
        console.log(`⏭️ Image is already correct.`);
      }
      
      // Sleep for 1 second to avoid Amazon rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  console.log(`\n🎉 Image Healing Complete!`);
  console.log(`Fixed: ${fixedCount} | Failed: ${failedCount}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
