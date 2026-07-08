import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || 50;
    const offset = Number(searchParams.get('offset')) || 0;
    
    // Optional filters
    const platformSlug = searchParams.get('platform');
    const dealType = searchParams.get('type');
    const isPublished = searchParams.has('published') ? searchParams.get('published') === 'true' : undefined;

    const whereClause: any = {};
    if (platformSlug) whereClause.platform = { slug: platformSlug };
    if (dealType) whereClause.dealType = dealType;
    if (isPublished !== undefined) whereClause.isPublished = isPublished;

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where: whereClause,
        include: {
          product: true,
          platform: true,
        },
        orderBy: { dealScore: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.deal.count({ where: whereClause })
    ]);

    // Transform to match frontend types if necessary, though direct consumption is often fine
    const formattedDeals = deals.map(deal => ({
      id: deal.id,
      title: deal.product.title,
      brand: deal.product.brand,
      category: deal.product.category,
      imageUrl: deal.product.imageUrl,
      platform: deal.platform.slug,
      originalPrice: deal.originalPrice,
      dealPrice: deal.dealPrice,
      discount: deal.discountPct,
      dealScore: deal.dealScore,
      dealType: deal.dealType,
      couponCode: deal.couponCode,
      bankOffer: deal.bankOffer,
      isGenuine: deal.isGenuine,
      isPublished: deal.isPublished,
      clicks: deal.clicks,
      conversions: deal.conversions,
      revenue: deal.revenue,
      expiresAt: deal.expiresAt?.toISOString(),
      publishedAt: deal.publishedAt?.toISOString(),
    }));

    return NextResponse.json({
      deals: formattedDeals,
      pagination: {
        total,
        limit,
        offset,
      }
    });
  } catch (error) {
    console.error('API Error /deals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deals' },
      { status: 500 }
    );
  }
}
