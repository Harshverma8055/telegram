const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activeCount = await prisma.wishlistProduct.count({
    where: { wishlist: true }
  });
  
  console.log(`\n📊 Active Wishlist Items: ${activeCount}`);
  
  const items = await prisma.wishlistProduct.findMany({
    where: { wishlist: true },
    select: {
      asin: true,
      subcategory: true,
      price: true,
      title: true
    },
    orderBy: { lastUpdated: 'desc' },
    take: 15
  });

  console.log('\n🔍 Latest 15 active products in Wishlist:');
  items.forEach((item, index) => {
    console.log(`${index + 1}. [${item.subcategory}] ASIN: ${item.asin} | ₹${item.price} | ${item.title.substring(0, 50)}...`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
