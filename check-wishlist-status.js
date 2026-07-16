const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Wishlist Product Status ---');
  
  // 1. Total active wishlist items
  const activeCount = await prisma.wishlistProduct.count({
    where: { wishlist: true }
  });
  console.log(`Total active wishlist items (wishlist = true): ${activeCount}`);

  // 2. Total inactive wishlist items (already triggered/deleted)
  const inactiveCount = await prisma.wishlistProduct.count({
    where: { wishlist: false }
  });
  console.log(`Total inactive/triggered wishlist items (wishlist = false): ${inactiveCount}`);

  // 3. Last updated times
  const oldest = await prisma.wishlistProduct.findFirst({
    where: { wishlist: true },
    orderBy: { last_updated: 'asc' }
  });
  const newest = await prisma.wishlistProduct.findFirst({
    where: { wishlist: true },
    orderBy: { last_updated: 'desc' }
  });

  if (oldest) console.log(`Oldest checked item was updated at: ${oldest.last_updated}`);
  if (newest) console.log(`Newest checked item was updated at: ${newest.last_updated}`);

  // 4. Sample items
  const sample = await prisma.wishlistProduct.findMany({
    where: { wishlist: true },
    take: 5,
    orderBy: { last_updated: 'asc' }
  });
  console.log('\nSample items in queue to be checked:');
  sample.forEach(item => {
    console.log(`- ASIN: ${item.asin} | Price: ₹${item.price} | Target Price: ₹${item.target_price || 'None'} | Title: ${item.title?.substring(0, 40)}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
