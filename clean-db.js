const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDB() {
  console.log('Cleaning old messy deals from the database...');
  // Run both deletions in a single transaction to prevent race conditions
  await prisma.$transaction([
    prisma.deal.deleteMany({}),
    prisma.product.deleteMany({})
  ]);
  console.log('Database cleaned! Ready for fresh, clean deals.');
}

cleanDB()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
