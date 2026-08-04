import prisma from '../src/lib/prisma';
import { shouldPostToHostel, STUDENT_SCORE_THRESHOLD } from '../src/lib/hostel-filter';

async function main() {
  console.log('Starting hostel deals debug diagnostics...');
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pendingDeals = await prisma.deal.findMany({
    where: {
      isPublished: true,
      isPublishedHostel: false,
      createdAt: { gte: twentyFourHoursAgo },
    },
    include: {
      product: true,
      platform: true,
    },
    orderBy: { dealScore: 'desc' },
  });

  console.log(`Found ${pendingDeals.length} pending deals in the last 24h.`);

  let qualified = 0;
  for (const deal of pendingDeals) {
    const title = deal.product?.title || '';
    const price = deal.dealPrice || 0;
    const originalPrice = deal.originalPrice || price;
    const discountPct = deal.discountPct || 0;
    const platform = deal.platform?.slug || 'amazon';

    const filterResult = shouldPostToHostel({
      title,
      price,
      originalPrice,
      discountPct,
      platform,
    });

    console.log(`- Deal: "${title.substring(0, 50)}" | Price: ${price} | Platform: ${platform}`);
    console.log(`  Score: ${filterResult.score} (Threshold: ${STUDENT_SCORE_THRESHOLD}) | shouldPost: ${filterResult.shouldPost}`);
    if (filterResult.shouldPost) {
      qualified++;
    }
  }

  console.log(`Total qualified: ${qualified}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
