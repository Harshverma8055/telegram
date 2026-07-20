import { PrismaClient } from '@prisma/client';
import { shouldPostToHostel, STUDENT_SCORE_THRESHOLD } from '../src/lib/hostel-filter';

const p = new PrismaClient();

async function testFilterOnDeals() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Check pending deals (isPublished = true, isPublishedHostel = false)
  const pendingDeals = await p.deal.findMany({
    where: {
      isPublished: true,
      isPublishedHostel: false,
      createdAt: { gte: twentyFourHoursAgo },
    },
    include: { product: true, platform: true }
  });

  console.log(`Found ${pendingDeals.length} pending deals (isPublished: true, isPublishedHostel: false)`);

  for (const deal of pendingDeals) {
    const title = deal.product?.title || '';
    const price = deal.dealPrice || 0;
    const originalPrice = deal.originalPrice || price;
    const discountPct = deal.discountPct || 0;
    const platform = deal.platform?.slug || 'amazon';

    const res = shouldPostToHostel({ title, price, originalPrice, discountPct, platform });

    console.log(`\nDeal ID: ${deal.id}`);
    console.log(`Title: "${title.substring(0, 50)}"`);
    console.log(`Price: ₹${price} (MRP: ₹${originalPrice}) | Discount: ${discountPct}%`);
    console.log(`Score: ${res.score} | Threshold: ${STUDENT_SCORE_THRESHOLD} | Should Post? ${res.shouldPost ? '✅ YES' : '❌ NO'}`);
    console.log(`Reason: ${res.reason}`);
  }

  // 2. Also check deals where isPublished = false (deals from main cron that were NOT published to main channel)
  const unpublishedDeals = await p.deal.findMany({
    where: {
      isPublished: false,
      isPublishedHostel: false,
      createdAt: { gte: twentyFourHoursAgo },
    },
    take: 10,
    include: { product: true }
  });

  console.log(`\nFound ${unpublishedDeals.length} UNPUBLISHED deals in main DB (isPublished: false)`);

  await p.$disconnect();
}

testFilterOnDeals().catch(console.error);
