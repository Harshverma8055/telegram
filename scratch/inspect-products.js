const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    take: 50,
    orderBy: {
      lastScrapedAt: 'desc'
    }
  });

  console.log(`Found ${products.length} products:`);
  products.forEach(p => {
    console.log(`- ID: ${p.id}, ExternalId: ${p.externalId}, Title: ${p.title.substring(0, 50)}, ImageUrl: "${p.imageUrl}"`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
