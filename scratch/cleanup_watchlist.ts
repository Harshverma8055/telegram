import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function cleanupWatchlist() {
  // 1. Find all watchlist products
  const watchlistItems = await p.product.findMany({
    where: { category: 'watchlist' },
    include: { platform: true, history: true }
  });

  console.log(`\n📊 Total watchlist items in Product table: ${watchlistItems.length}\n`);

  // 2. Check which ones are real (exist in WishlistProduct with verified data)
  const realAsins = await p.$queryRawUnsafe<any[]>(`
    SELECT "asin", "image", "title", "price" FROM "WishlistProduct"
  `);
  const realAsinMap = new Map<string, any>();
  realAsins.forEach((r: any) => realAsinMap.set(r.asin, r));

  let fakeCount = 0;
  let goodCount = 0;
  const fakeIds: string[] = [];

  for (const item of watchlistItems) {
    const realData = realAsinMap.get(item.externalId);
    const hasNoImage = !item.imageUrl || item.imageUrl.trim() === '' || !item.imageUrl.startsWith('http');
    const hasPlaceholderImage = item.imageUrl?.includes('images-na.ssl-images-amazon.com/images/P/');
    const hasBrokenImage = item.imageUrl?.includes('_SL1500_') && !realData;
    const hasGenericTitle = item.title?.startsWith('Amazon Product') || item.title?.startsWith('Tracked Product');
    const hasZeroPrice = !item.currentPrice || item.currentPrice <= 0;

    // Check if image URL actually works by checking if it's from the seed data
    // Seed data images are often reused/wrong (same image for different products)
    const isFromSeed = !realData && item.currentPrice > 0;

    if (hasNoImage || hasPlaceholderImage || hasGenericTitle || hasZeroPrice) {
      console.log(`❌ FAKE: ${item.externalId} | "${item.title?.substring(0, 50)}" | Price: ₹${item.currentPrice} | Image: ${item.imageUrl?.substring(0, 50) || 'NONE'}`);
      fakeIds.push(item.id);
      fakeCount++;
    } else if (!realData) {
      // Not in WishlistProduct — this is likely from the hardcoded seed
      console.log(`⚠️  SEED: ${item.externalId} | "${item.title?.substring(0, 50)}" | Price: ₹${item.currentPrice} (not in WishlistProduct)`);
      fakeIds.push(item.id);
      fakeCount++;
    } else {
      goodCount++;
    }
  }

  console.log(`\n✅ Good (verified in WishlistProduct): ${goodCount}`);
  console.log(`❌ Fake/Seed (not in WishlistProduct or broken): ${fakeCount}`);

  if (fakeIds.length > 0) {
    console.log(`\n🗑️ Deleting ${fakeIds.length} fake/seed watchlist items and their price history...`);

    // Delete price history first (foreign key)
    await p.priceHistory.deleteMany({
      where: { productId: { in: fakeIds } }
    });

    // Delete any deals referencing these products
    await p.deal.deleteMany({
      where: { productId: { in: fakeIds } }
    });

    // Delete the products themselves
    await p.product.deleteMany({
      where: { id: { in: fakeIds } }
    });

    console.log(`✅ Deleted ${fakeIds.length} fake items and their associated data!`);
  }

  // Final count
  const remaining = await p.product.count({ where: { category: 'watchlist' } });
  console.log(`\n📊 Remaining clean watchlist items: ${remaining}`);

  await p.$disconnect();
}

cleanupWatchlist().catch(console.error);
