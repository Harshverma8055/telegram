import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, price, link } = body;

    if (!title || !price || !link) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Extract ASIN
    const asinMatch = link.match(/\/(?:dp|product)\/([A-Z0-9]{10})/i);
    const asin = asinMatch ? asinMatch[1] : `manual_${Date.now()}`;

    // Create affiliate URL
    const affiliateTag = process.env.AMAZON_AFFILIATE_TAG || '';
    const affiliateUrl = affiliateTag && asin.length === 10
      ? `https://www.amazon.in/dp/${asin}?tag=${affiliateTag}` 
      : link;

    const platform = await prisma.platform.upsert({
      where: { slug: 'amazon' },
      update: {},
      create: { name: 'Amazon', slug: 'amazon' }
    });

    const product = await prisma.product.create({
      data: {
        platformId: platform.id,
        externalId: asin,
        title: title,
        url: link,
        currentPrice: price, 
      }
    });

    await prisma.deal.create({
      data: {
        productId: product.id,
        platformId: platform.id,
        dealType: 'price_drop',
        dealScore: 95, // Manual deals are high quality!
        dealPrice: price,
        originalPrice: Math.round(price * 1.5), // Estimate MRP for UI 
        discountPct: 33, // Estimate discount for UI
        affiliateUrl: affiliateUrl,
        isGenuine: true,
        isPublished: false,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Manual Deal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
