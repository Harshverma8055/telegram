const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.wishlistProduct.findMany({
    where: { wishlist: true }
  });
  console.log(JSON.stringify(items, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
