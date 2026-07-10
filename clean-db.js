const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDB() {
  console.log('Cleaning old messy deals from the database...');
  await prisma.deal.deleteMany({});
  await prisma.product.deleteMany({});
  console.log('Database cleaned! Ready for fresh, clean deals.');
}

cleanDB()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
