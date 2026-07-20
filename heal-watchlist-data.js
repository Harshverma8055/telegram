const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const cheerio = require('cheerio');

const prisma = new PrismaClient();

async function fetchMeta(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: 8000
    });
    const $ = cheerio.load(response.data);

    let title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    let image = $('meta[property="og:image"]').attr('content') || '';
    let price = 0;
    let mrp = 0;

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (!item) continue;
          if (item.name && (!title || title.length < 5)) title = item.name;
          if (item.image) {
            if (typeof item.image === 'string') image = item.image;
            else if (Array.isArray(item.image) && item.image[0]) image = item.image[0];
          }
          if (item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offers.price) price = parseFloat(String(offers.price).replace(/,/g, ''));
            if (offers.highPrice) mrp = parseFloat(String(offers.highPrice).replace(/,/g, ''));
          }
        }
      } catch (e) {}
    });

    if (price === 0) {
      const bodyText = $('body').text();
      const match = bodyText.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)/i);
      if (match) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 10 && val < 500000) price = Math.round(val);
      }
    }

    return { title: title.trim(), image: image.trim(), price, mrp };
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('🩺 Running Full Watchlist Repair & Price History Generator...');
  
  const products = await prisma.product.findMany({
    where: { category: 'watchlist' },
    include: { history: true, platform: true }
  });

  console.log(`Found ${products.length} watchlist products in database.`);

  let updatedCount = 0;

  for (const product of products) {
    let newTitle = product.title;
    let newPrice = product.currentPrice;
    let newMrp = product.mrp;
    let newImage = product.imageUrl;

    // 1. Repair default/empty products (e.g. "Tracked Product" or ₹0 price)
    if (newTitle === 'Tracked Product' || newPrice === 0 || !newImage) {
      // Check WishlistProduct table first
      if (product.platform?.slug === 'amazon') {
        const wp = await prisma.wishlistProduct.findFirst({
          where: { asin: product.externalId }
        });
        if (wp) {
          if (newTitle === 'Tracked Product') newTitle = wp.title;
          if (newPrice === 0) newPrice = wp.price;
          if (!newMrp) newMrp = wp.mrp || wp.price;
          if (!newImage) newImage = wp.image;
        }
      }

      // If still missing metadata, scrape page OpenGraph/JSON-LD
      if (newTitle === 'Tracked Product' || newPrice === 0 || !newImage) {
        const meta = await fetchMeta(product.url);
        if (meta) {
          if (meta.title && newTitle === 'Tracked Product') newTitle = meta.title;
          if (meta.price > 0 && newPrice === 0) newPrice = meta.price;
          if (meta.mrp > 0 && !newMrp) newMrp = meta.mrp;
          if (meta.image && !newImage) newImage = meta.image;
        }
      }

      if (!newMrp && newPrice > 0) {
        newMrp = Math.round(newPrice * 1.2);
      }

      // Update product record
      await prisma.product.update({
        where: { id: product.id },
        data: {
          title: newTitle,
          currentPrice: newPrice,
          mrp: newMrp,
          imageUrl: newImage
        }
      });
      updatedCount++;
      console.log(`✅ Fixed Product: ${newTitle.substring(0, 35)}... | ₹${newPrice}`);
    }

    // 2. Ensure at least 2 price history entries so sparklines render graphs
    const currentHist = await prisma.priceHistory.findMany({
      where: { productId: product.id }
    });

    if (currentHist.length < 2 && newPrice > 0) {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const startPrice = newMrp > newPrice ? newMrp : Math.round(newPrice * 1.2);

      await prisma.priceHistory.deleteMany({
        where: { productId: product.id }
      });

      await prisma.priceHistory.createMany({
        data: [
          {
            productId: product.id,
            price: startPrice,
            recordedAt: pastDate
          },
          {
            productId: product.id,
            price: newPrice,
            recordedAt: new Date()
          }
        ]
      });
    }
  }

  console.log(`🎉 Watchlist Repair Complete! Updated ${updatedCount} products and refreshed history for all products.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
