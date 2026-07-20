const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const cheerio = require('cheerio');

const prisma = new PrismaClient();

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function isImageValid(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const res = await axios.head(url, {
      headers: { 'User-Agent': getRandomUA() },
      timeout: 4000
    });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

async function fetchRealAmazonImage(asin) {
  // 1. Check WishlistProduct table first (780 pre-scraped items)
  try {
    const wp = await prisma.wishlistProduct.findFirst({
      where: { asin: asin }
    });
    if (wp && wp.image && await isImageValid(wp.image)) {
      return wp.image;
    }
  } catch (e) {}

  // 2. Fetch Amazon Product Page directly
  try {
    const url = `https://www.amazon.in/dp/${asin}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: 8000
    });

    const $ = cheerio.load(response.data);

    let imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src');

    if (!imageUrl) {
      imageUrl = $('meta[property="og:image"]').attr('content');
    }

    if (!imageUrl) {
      const match = response.data.match(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
      if (match && match[1]) imageUrl = match[1];
    }

    if (!imageUrl) {
      const match2 = response.data.match(/"large":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/);
      if (match2 && match2[1]) imageUrl = match2[1];
    }

    if (imageUrl && await isImageValid(imageUrl)) {
      return imageUrl;
    }
  } catch (e) {}

  return null;
}

async function main() {
  console.log('🖼️ Starting Real Product Image Doctor...');
  const products = await prisma.product.findMany({
    where: { category: 'watchlist' }
  });

  console.log(`Checking ${products.length} watchlist products...`);

  let fixed = 0;
  let valid = 0;

  for (const product of products) {
    const isValid = await isImageValid(product.imageUrl);

    if (isValid) {
      valid++;
      continue;
    }

    console.log(`⚠️ Broken image for (${product.externalId}): ${product.title.substring(0, 35)}...`);
    const realImage = await fetchRealAmazonImage(product.externalId);

    if (realImage) {
      await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: realImage }
      });
      fixed++;
      console.log(`✅ FIXED: ${product.externalId} => ${realImage}`);
    } else {
      console.log(`❌ Could not resolve image for ASIN: ${product.externalId}`);
    }
  }

  console.log(`🎉 Image Repair Complete! Valid images: ${valid + fixed}/${products.length}. Fixed: ${fixed}.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
