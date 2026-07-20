import { PrismaClient } from '@prisma/client';
import { publishToTelegram } from '../src/lib/telegram';
import { shouldPostToHostel } from '../src/lib/hostel-filter';

const p = new PrismaClient();
const HOSTEL_CHANNEL = process.env.HOSTEL_CHANNEL || '@hosteldeals';

async function drainBacklog() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pendingDeals = await p.deal.findMany({
    where: {
      isPublished: true,
      isPublishedHostel: false,
      createdAt: { gte: twentyFourHoursAgo },
    },
    include: { product: true, platform: true },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`🚀 Found ${pendingDeals.length} pending deals to evaluate for Hostel channel.`);

  let posted = 0;
  let skipped = 0;

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
      platform
    });

    if (!filterResult.shouldPost) {
      console.log(`⏭️ Skipped: "${title.substring(0, 40)}" (Score: ${filterResult.score})`);
      await p.deal.update({
        where: { id: deal.id },
        data: { isPublishedHostel: true }
      });
      skipped++;
      continue;
    }

    // QUALIFIED!
    console.log(`✅ Posting to ${HOSTEL_CHANNEL}: "${title.substring(0, 40)}" (Score: ${filterResult.score})`);
    try {
      await publishToTelegram(deal.id, HOSTEL_CHANNEL);
      await p.deal.update({
        where: { id: deal.id },
        data: {
          isPublishedHostel: true,
          publishedHostelAt: new Date()
        }
      });
      posted++;
      // Sleep 2 seconds between posts to avoid Telegram rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`❌ Error posting deal ${deal.id}:`, err.message);
    }
  }

  console.log(`\n🎉 Backlog processing complete! Posted: ${posted}, Skipped: ${skipped}`);
  await p.$disconnect();
}

drainBacklog().catch(console.error);
