const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- 📊 DETAILED TIME CHECKS ---');

  const lastPublishedWithTime = await prisma.deal.findFirst({
    where: { isPublished: true, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    include: { product: true }
  });

  if (lastPublishedWithTime) {
    console.log(`Last published with timestamp: [${lastPublishedWithTime.publishedAt}] ID: ${lastPublishedWithTime.id} | Title: ${lastPublishedWithTime.product?.title}`);
  } else {
    console.log('No published deals found with non-null publishedAt!');
  }

  const lastCreatedDeal = await prisma.deal.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { product: true }
  });

  if (lastCreatedDeal) {
    console.log(`Last created deal overall: [${lastCreatedDeal.createdAt}] ID: ${lastCreatedDeal.id} | Title: ${lastCreatedDeal.product?.title} | Published: ${lastCreatedDeal.isPublished} | PublishedAt: ${lastCreatedDeal.publishedAt}`);
  }

  // Count how many deals have publishedAt as null vs non-null
  const nullPublishedAtCount = await prisma.deal.count({
    where: { isPublished: true, publishedAt: null }
  });
  console.log(`Published deals with NULL publishedAt: ${nullPublishedAtCount}`);

  const validPublishedAtCount = await prisma.deal.count({
    where: { isPublished: true, publishedAt: { not: null } }
  });
  console.log(`Published deals with VALID publishedAt: ${validPublishedAtCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
