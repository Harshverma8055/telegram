const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.deal.deleteMany({});
  await prisma.product.deleteMany({});
  console.log("Database cleared! Ready for a fresh auto-publish test.");
}
main().catch(console.error).finally(() => prisma.$disconnect());
