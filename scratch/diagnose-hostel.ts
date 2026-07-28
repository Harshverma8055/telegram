import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. How many deals were published to MAIN channel in last 7 days?
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const mainPublished = await prisma.deal.count({
    where: { isPublished: true, publishedAt: { gte: sevenDaysAgo } }
  });
  console.log(`\n=== LAST 7 DAYS STATS ===`);
  console.log(`Main channel published: ${mainPublished}`);

  // 2. How many were forwarded to hostel?
  const hostelPublished = await prisma.deal.count({
    where: { isPublishedHostel: true, publishedHostelAt: { gte: sevenDaysAgo } }
  });
  console.log(`Hostel channel published: ${hostelPublished}`);

  // 3. How many deals are isPublished=true BUT isPublishedHostel=false (pending for hostel)?
  const pendingHostel = await prisma.deal.count({
    where: { isPublished: true, isPublishedHostel: false, createdAt: { gte: sevenDaysAgo } }
  });
  console.log(`Pending for hostel (published but not hostel-processed): ${pendingHostel}`);

  // 4. How many deals have isPublishedHostel=true but publishedHostelAt=null (skipped by filter)?
  const skippedByFilter = await prisma.deal.count({
    where: { isPublishedHostel: true, publishedHostelAt: null, createdAt: { gte: sevenDaysAgo } }
  });
  console.log(`Skipped by hostel filter (processed but not posted): ${skippedByFilter}`);

  // 5. Check student scores of recent deals
  const recentDeals = await prisma.deal.findMany({
    where: { isPublished: true, createdAt: { gte: sevenDaysAgo } },
    include: { product: true, platform: true },
    orderBy: { createdAt: 'desc' },
    take: 15
  });
  
  console.log(`\n=== RECENT 15 DEALS (scores) ===`);
  for (const d of recentDeals) {
    const hasImage = d.product?.imageUrl ? 'IMG:✅' : 'IMG:❌';
    console.log(`  Score:${d.studentScore ?? 'null'} | ₹${d.dealPrice} | ${d.discountPct}%off | ${hasImage} | Hostel:${d.isPublishedHostel} | "${d.product?.title?.substring(0, 50)}"`);
  }

  // 6. Check WishlistProduct count with wishlist=true
  const wishlistActive = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) as cnt FROM "WishlistProduct" WHERE "wishlist" = true`
  );
  console.log(`\n=== WISHLIST ===`);
  console.log(`Active wishlist items (wishlist=true): ${wishlistActive[0]?.cnt}`);

  // 7. Check if HOSTEL_CHANNEL env is set
  console.log(`\n=== ENV CHECK ===`);
  console.log(`HOSTEL_CHANNEL: "${process.env.HOSTEL_CHANNEL || '(not set, defaults to @hosteldeals)'}"`);
  console.log(`TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'SET ✅' : 'NOT SET ❌'}`);
}

main().finally(() => prisma.$disconnect());
