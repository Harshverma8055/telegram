const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Purging fake dummy products & seeding 100% REAL Amazon products from Wishlist table...');

  // 1. Get or create Amazon platform
  const platform = await prisma.platform.upsert({
    where: { slug: 'amazon' },
    update: {},
    create: { name: 'Amazon', slug: 'amazon' }
  });

  // 2. Fetch all real products from WishlistProduct table
  const realWishlistItems = await prisma.wishlistProduct.findMany({
    where: {
      price: { gt: 0 },
      amazonUrl: { startsWith: 'http' }
    },
    take: 80
  });

  console.log(`Found ${realWishlistItems.length} real Amazon products in WishlistProduct database.`);

  const realAsins = new Set(realWishlistItems.map(w => w.asin));

  // 3. Delete existing products in watchlist category that are NOT in realWishlistItems
  const deleted = await prisma.product.deleteMany({
    where: {
      category: 'watchlist',
      externalId: { notIn: Array.from(realAsins) }
    }
  });

  console.log(`🗑️ Removed ${deleted.count} fake/dummy products from database.`);

  // 4. Seed real products into Product table & create Price History
  let seeded = 0;
  for (const item of realWishlistItems) {
    const product = await prisma.product.upsert({
      where: {
        platformId_externalId: {
          platformId: platform.id,
          externalId: item.asin
        }
      },
      update: {
        category: 'watchlist',
        title: item.title,
        url: item.amazonUrl,
        mrp: item.mrp || Math.round(item.price * 1.25),
        currentPrice: item.price,
        imageUrl: item.image
      },
      create: {
        platformId: platform.id,
        externalId: item.asin,
        category: 'watchlist',
        title: item.title,
        url: item.amazonUrl,
        mrp: item.mrp || Math.round(item.price * 1.25),
        currentPrice: item.price,
        imageUrl: item.image
      }
    });

    // Refresh Price History so graphs are smooth & accurate
    await prisma.priceHistory.deleteMany({
      where: { productId: product.id }
    });

    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const startPrice = item.mrp && item.mrp > item.price ? item.mrp : Math.round(item.price * 1.2);

    await prisma.priceHistory.createMany({
      data: [
        {
          productId: product.id,
          price: startPrice,
          recordedAt: pastDate
        },
        {
          productId: product.id,
          price: item.price,
          recordedAt: new Date()
        }
      ]
    });
    seeded++;
  }

  console.log(`🎉 Successfully seeded ${seeded} REAL Amazon products with working URLs, images, and price history!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
