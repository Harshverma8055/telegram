import { PrismaClient } from '@prisma/client';
import { mockDeals } from '../src/lib/mock-data';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create default platforms
  const platformsToCreate = [
    { name: 'Amazon', slug: 'amazon' },
    { name: 'Flipkart', slug: 'flipkart' },
    { name: 'Myntra', slug: 'myntra' },
    { name: 'Croma', slug: 'croma' },
    { name: 'OnePlus', slug: 'oneplus' },
    { name: 'FirstCry', slug: 'firstcry' },
  ];

  const platforms = {};
  for (const p of platformsToCreate) {
    const created = await prisma.platform.upsert({
      where: { slug: p.slug },
      update: {},
      create: { name: p.name, slug: p.slug },
    });
    platforms[p.slug] = created;
  }
  console.log('Created platforms.');

  // 2. Map mock deals to DB
  for (const deal of mockDeals) {
    // Check if platform exists
    const platform = platforms[deal.platform];
    if (!platform) continue;

    // Create product
    const product = await prisma.product.upsert({
      where: {
        platformId_externalId: {
          platformId: platform.id,
          externalId: `ext_${deal.id}`, // Mock external ID
        },
      },
      update: {},
      create: {
        platformId: platform.id,
        externalId: `ext_${deal.id}`,
        title: deal.title,
        brand: deal.brand,
        category: deal.category,
        mrp: deal.originalPrice,
        currentPrice: deal.dealPrice,
        url: `https://${deal.platform}.com/product/${deal.id}`,
        imageUrl: deal.imageUrl,
        rating: deal.rating,
        reviewCount: deal.reviewCount,
      },
    });

    // Create deal
    await prisma.deal.create({
      data: {
        productId: product.id,
        platformId: platform.id,
        dealType: deal.dealType,
        dealScore: deal.dealScore,
        originalPrice: deal.originalPrice,
        dealPrice: deal.dealPrice,
        discountPct: deal.discount,
        couponCode: deal.couponCode,
        bankOffer: deal.bankOffer,
        isGenuine: deal.isGenuine,
        isPublished: deal.isPublished,
        clicks: deal.clicks,
        conversions: deal.conversions,
        revenue: deal.revenue,
        expiresAt: new Date(deal.expiresAt),
        publishedAt: deal.publishedAt ? new Date(deal.publishedAt) : null,
      },
    });
  }

  // 3. Create mock ScraperJobs
  await prisma.scraperJob.createMany({
    data: [
      { platformId: platforms['amazon'].id, status: 'running', productsScanned: 45672, dealsFound: 234, errors: 0 },
      { platformId: platforms['flipkart'].id, status: 'completed', productsScanned: 38901, dealsFound: 189, errors: 2 },
    ]
  });

  // 4. Create mock TelegramChannels
  await prisma.telegramChannel.createMany({
    data: [
      { name: 'DealFlow — Hot Deals 🔥', username: '@dealflow_hot', members: 125400, isActive: true, autoPublish: true, categories: '["All"]' },
      { name: 'DealFlow — Electronics', username: '@dealflow_tech', members: 89200, isActive: true, autoPublish: true, categories: '["Smartphones", "Laptops", "Audio", "TVs"]' },
    ]
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
