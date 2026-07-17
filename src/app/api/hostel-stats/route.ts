// =====================================================================
// 📊 HOSTEL CHANNEL STATS API
// Returns analytics about the hostel channel performance.
// Used by the dashboard to show hostel-specific metrics.
// =====================================================================

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Today's hostel stats
    const todayHostelDeals = await prisma.deal.count({
      where: {
        isPublishedHostel: true,
        publishedHostelAt: { gte: todayStart },
      },
    });

    // Today's main channel deals
    const todayMainDeals = await prisma.deal.count({
      where: {
        isPublished: true,
        publishedAt: { gte: todayStart },
      },
    });

    // Flash deals today (student score = 100)
    const todayFlashDeals = await prisma.deal.count({
      where: {
        isPublishedHostel: true,
        publishedHostelAt: { gte: todayStart },
        studentScore: 100,
      },
    });

    // Average student score this week
    const weeklyScores = await prisma.deal.aggregate({
      _avg: { studentScore: true },
      _max: { studentScore: true },
      _min: { studentScore: true },
      where: {
        studentScore: { not: null },
        createdAt: { gte: weekAgo },
      },
    });

    // Deals skipped (scored below threshold)
    const skippedDeals = await prisma.deal.count({
      where: {
        isPublished: true,
        isPublishedHostel: true,
        studentScore: { lt: 40 },
        createdAt: { gte: todayStart },
      },
    });

    // Top scoring recent deals for hostel
    const topDeals = await prisma.deal.findMany({
      where: {
        isPublishedHostel: true,
        publishedHostelAt: { not: null },
        studentScore: { gte: 40 },
      },
      include: {
        product: { select: { title: true, imageUrl: true } },
      },
      orderBy: { publishedHostelAt: 'desc' },
      take: 10,
    });

    // Active wishlist count
    const activeWishlist = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "WishlistProduct" WHERE "wishlist" = true`
    );

    return NextResponse.json({
      success: true,
      today: {
        hostelDeals: todayHostelDeals,
        mainDeals: todayMainDeals,
        flashDeals: todayFlashDeals,
        skippedDeals: skippedDeals,
        conversionRate: todayMainDeals > 0 
          ? Math.round((todayHostelDeals / todayMainDeals) * 100) 
          : 0,
      },
      weekly: {
        avgStudentScore: Math.round(weeklyScores._avg.studentScore || 0),
        maxStudentScore: weeklyScores._max.studentScore || 0,
        minStudentScore: weeklyScores._min.studentScore || 0,
      },
      activeWishlistItems: Number(activeWishlist[0]?.count || 0),
      recentHostelDeals: topDeals.map(d => ({
        id: d.id,
        title: d.product?.title?.substring(0, 60) || 'Unknown',
        price: d.dealPrice,
        originalPrice: d.originalPrice,
        discount: d.discountPct,
        studentScore: d.studentScore,
        postedAt: d.publishedHostelAt,
        imageUrl: d.product?.imageUrl,
      })),
    });

  } catch (err: any) {
    console.error('[hostel-stats] Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
