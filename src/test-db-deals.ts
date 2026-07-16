import prisma from './lib/prisma';

async function main() {
  console.log('🔍 Checking latest 10 Products in Database:');
  const products = await prisma.product.findMany({
    orderBy: { lastScrapedAt: 'desc' },
    take: 10,
    include: { platform: true }
  });
  console.log(products.map(p => ({
    id: p.id,
    title: p.title?.substring(0, 40),
    platform: p.platform.slug,
    externalId: p.externalId,
    lastScrapedAt: p.lastScrapedAt
  })));

  console.log('\n🔍 Checking latest 10 Deals in Database:');
  const deals = await prisma.deal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { product: true }
  });
  console.log(deals.map(d => ({
    id: d.id,
    title: d.product?.title?.substring(0, 40),
    isPublished: d.isPublished,
    publishedAt: d.publishedAt,
    createdAt: d.createdAt
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
