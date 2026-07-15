import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();

    const [
      totalProducts,
      totalWishlist,
      activeWishlist,
      totalDeals,
      publishedDeals,
      unpublishedDeals,
      lastPublished,
      recentDeals,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "WishlistProduct"`).then(r => Number(r[0].count)),
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "WishlistProduct" WHERE wishlist = true`).then(r => Number(r[0].count)),
      prisma.deal.count(),
      prisma.deal.count({ where: { isPublished: true } }),
      prisma.deal.count({ where: { isPublished: false } }),
      prisma.deal.findFirst({
        where: { isPublished: true, publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        include: { product: true }
      }),
      prisma.deal.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { product: true }
      }),
    ]);

    const minutesSinceLastPost = lastPublished?.publishedAt
      ? Math.round((now.getTime() - new Date(lastPublished.publishedAt).getTime()) / 60000)
      : null;

    return NextResponse.json({
      status: '✅ Bot is running',
      serverTime: now.toISOString(),
      minutesSinceLastPost,
      lastPublishedDeal: lastPublished ? {
        title: lastPublished.product?.title?.substring(0, 60),
        publishedAt: lastPublished.publishedAt,
        dealPrice: lastPublished.dealPrice,
        discountPct: lastPublished.discountPct,
      } : null,
      counts: {
        totalProducts,
        totalWishlist,
        activeWishlist,
        totalDeals,
        publishedDeals,
        unpublishedDeals,
      },
      recentDeals: recentDeals.map(d => ({
        title: d.product?.title?.substring(0, 50),
        dealPrice: d.dealPrice,
        discountPct: d.discountPct,
        isPublished: d.isPublished,
        publishedAt: d.publishedAt,
        createdAt: d.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
