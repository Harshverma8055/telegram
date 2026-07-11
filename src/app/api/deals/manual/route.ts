import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sanitizeTitle } from '@/lib/telegram';
import { getAffiliateUrl } from '@/lib/affiliate';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      title, 
      dealPrice, 
      originalPrice, 
      discountPct, 
      cleanUrl, 
      imageUrl, 
      platform: platformSlug, 
      externalId 
    } = body;

    if (!title || !dealPrice || !cleanUrl || !platformSlug || !externalId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get or create platform
    const platformName = platformSlug.charAt(0).toUpperCase() + platformSlug.slice(1);
    const platform = await prisma.platform.upsert({
      where: { slug: platformSlug },
      update: {},
      create: { name: platformName, slug: platformSlug }
    });

    // 2. Generate custom affiliate link using the configured providers (Amazon, EarnKaro, or ExtraPe)
    const affiliateUrl = getAffiliateUrl(platformSlug, cleanUrl, externalId);

    // 3. Create or update product
    const product = await prisma.product.upsert({
      where: {
        platformId_externalId: {
          platformId: platform.id,
          externalId: externalId
        }
      },
      update: {
        title: sanitizeTitle(title),
        url: cleanUrl,
        imageUrl: imageUrl || null,
        currentPrice: dealPrice,
        mrp: originalPrice || dealPrice,
      },
      create: {
        platformId: platform.id,
        externalId: externalId,
        title: sanitizeTitle(title),
        url: cleanUrl,
        imageUrl: imageUrl || null,
        currentPrice: dealPrice,
        mrp: originalPrice || dealPrice,
      }
    });

    // 4. Create the deal
    const deal = await prisma.deal.create({
      data: {
        productId: product.id,
        platformId: platform.id,
        dealType: 'price_drop',
        dealScore: 98, // Manual deals are given top priority!
        dealPrice: dealPrice,
        originalPrice: originalPrice || dealPrice,
        discountPct: discountPct || 0,
        affiliateUrl: affiliateUrl,
        isGenuine: true,
        isPublished: false,
      }
    });

    return NextResponse.json({ success: true, dealId: deal.id });
  } catch (error: any) {
    console.error('Manual Deal Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
