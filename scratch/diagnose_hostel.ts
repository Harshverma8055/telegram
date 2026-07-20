import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function diagnose() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const total48h = await p.deal.count({ where: { createdAt: { gte: fortyEightHoursAgo } } });
  const publishedMain = await p.deal.count({ where: { isPublished: true } });
  const publishedHostel = await p.deal.count({ where: { isPublishedHostel: true } });

  const pendingHostel = await p.deal.findMany({
    where: {
      isPublishedHostel: false,
      createdAt: { gte: twentyFourHoursAgo }
    },
    take: 30,
    include: { product: true }
  });

  console.log('--- DIAGNOSTIC RESULTS ---');
  console.log('Total deals created (48h):', total48h);
  console.log('Deals published to Main (total):', publishedMain);
  console.log('Deals published to Hostel (total):', publishedHostel);
  console.log('Pending deals for Hostel in last 24h:', pendingHostel.length);

  if (pendingHostel.length > 0) {
    console.log('\nSample pending deals for Hostel:');
    for (const d of pendingHostel) {
      console.log(`- ID: ${d.id} | Platform: ${d.platformId} | Title: "${d.product?.title?.substring(0, 40)}" | Price: ₹${d.dealPrice} (MRP: ₹${d.originalPrice}) | Disc: ${d.discountPct}%`);
    }
  }

  // Also check last published hostel deal
  const lastHostelDeals = await p.deal.findMany({
    where: { isPublishedHostel: true },
    orderBy: { publishedHostelAt: 'desc' },
    take: 10,
    include: { product: true }
  });
  console.log('\nLast published Hostel deals:');
  for (const d of lastHostelDeals) {
    console.log(`- Title: "${d.product?.title?.substring(0, 40)}" | Date: ${d.publishedHostelAt}`);
  }

  // Also check Wishlist items
  const wishlistSample = await p.wishlistProduct.findMany({
    where: { wishlist: true },
    orderBy: { lastUpdated: 'asc' },
    take: 5
  });
  console.log('\nWishlist sample (oldest lastUpdated):');
  for (const w of wishlistSample) {
    console.log(`- ASIN: ${w.asin} | Price: ₹${w.price} | TargetPrice: ₹${w.targetPrice} | TargetDiscount: ${w.targetDiscount}% | LastUpdated: ${w.lastUpdated}`);
  }

  await p.$disconnect();
}

diagnose().catch(console.error);
