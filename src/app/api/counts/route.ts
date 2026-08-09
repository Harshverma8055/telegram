import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';

// Lightweight endpoint — just returns product counts for sidebar badges
// Called on every page load, so MUST be fast (no heavy queries)
export async function GET() {
  try {
    const [amazonCount, flipkartCount] = await Promise.all([
      // Amazon Wishlist count
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM "WishlistProduct"
      `.then(r => Number(r[0]?.count ?? 0)).catch(() => 0),

      // Cuelink (Flipkart/Myntra/Ajio) Watchlist count
      prisma.cuelinkWishlist.count().catch(() => 0),
    ]);

    return NextResponse.json({
      amazon: amazonCount,
      flipkart: flipkartCount,
    });
  } catch (error: any) {
    console.error('[counts] Error:', error.message);
    return NextResponse.json({ amazon: 0, flipkart: 0 }, { status: 500 });
  }
}
