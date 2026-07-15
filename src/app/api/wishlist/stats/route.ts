import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { ensureWishlistTableExists, RESEARCH_CATEGORIES } from '@/lib/scrapers/amazon-research';

export async function GET() {
  try {
    await ensureWishlistTableExists();

    // Group counts by category
    const categoryCounts = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
      SELECT "category", COUNT(*)::bigint as "count" 
      FROM "WishlistProduct" 
      GROUP BY "category"
    `;

    const countsMap = new Map<string, number>();
    for (const row of categoryCounts) {
      countsMap.set(row.category, Number(row.count));
    }

    // Prepare category stats with progress
    const categoryStats = RESEARCH_CATEGORIES.map(cat => {
      const currentCount = countsMap.get(cat.name) || 0;
      const progress = Math.min(100, Math.round((currentCount / cat.targetCount) * 100));
      return {
        name: cat.name,
        target: cat.targetCount,
        current: currentCount,
        progress
      };
    });

    // Run aggregate stats (avg price, discount, counts of badges)
    const aggregates = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(*)::bigint as "total",
        COUNT(CASE WHEN "prime" = true THEN 1 END)::bigint as "primeCount",
        COUNT(CASE WHEN "amazon_choice" = true THEN 1 END)::bigint as "choiceCount",
        COUNT(CASE WHEN "best_seller" = true THEN 1 END)::bigint as "bestSellerCount",
        COUNT(CASE WHEN "coupon" = true THEN 1 END)::bigint as "couponCount",
        AVG("price")::double precision as "avgPrice",
        AVG("discount")::double precision as "avgDiscount",
        AVG("rating")::double precision as "avgRating"
      FROM "WishlistProduct"
    `;

    const agg = aggregates[0] || {};
    const total = Number(agg.total || 0);

    // Calculate overall target progress (total target is the sum of category targets)
    const totalTarget = RESEARCH_CATEGORIES.reduce((acc, cat) => acc + cat.targetCount, 0);
    const overallProgress = Math.min(100, Math.round((total / totalTarget) * 100));

    // Price bands count
    const priceBands = await prisma.$queryRaw<any[]>`
      SELECT
        COUNT(CASE WHEN "price" >= 99 AND "price" <= 299 THEN 1 END)::bigint as "band1",
        COUNT(CASE WHEN "price" > 299 AND "price" <= 499 THEN 1 END)::bigint as "band2",
        COUNT(CASE WHEN "price" > 499 AND "price" <= 999 THEN 1 END)::bigint as "band3",
        COUNT(CASE WHEN "price" > 999 AND "price" <= 1999 THEN 1 END)::bigint as "band4",
        COUNT(CASE WHEN "price" > 1999 THEN 1 END)::bigint as "band5"
      FROM "WishlistProduct"
    `;

    const bands = priceBands[0] || {};

    return NextResponse.json({
      success: true,
      stats: {
        total,
        totalTarget,
        overallProgress,
        primeCount: Number(bands.primeCount || agg.primeCount || 0),
        choiceCount: Number(agg.choiceCount || 0),
        bestSellerCount: Number(agg.bestSellerCount || 0),
        couponCount: Number(agg.couponCount || 0),
        avgPrice: Math.round(agg.avgPrice || 0),
        avgDiscount: Math.round(agg.avgDiscount || 0),
        avgRating: Number(agg.avgRating || 0).toFixed(1),
        priceBands: {
          '₹99–₹299': Number(bands.band1 || 0),
          '₹299–₹499': Number(bands.band2 || 0),
          '₹499–₹999': Number(bands.band3 || 0),
          '₹999–₹1999': Number(bands.band4 || 0),
          'Above ₹2000': Number(bands.band5 || 0)
        },
        categoryStats
      }
    });

  } catch (error: any) {
    console.error('❌ [WishlistStats] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
