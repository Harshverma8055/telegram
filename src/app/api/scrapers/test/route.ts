import { NextResponse } from 'next/server';
import { scrapeAmazonProduct } from '@/lib/scrapers/amazon';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('amazon.')) {
      return NextResponse.json({ error: 'Valid Amazon URL required' }, { status: 400 });
    }

    console.log(`Starting scraper for URL: ${url}`);
    
    // 1. Scrape the product data
    const scrapedData = await scrapeAmazonProduct(url);
    
    if (!scrapedData) {
      return NextResponse.json({ error: 'Failed to scrape product data. Anti-bot protection may be active.' }, { status: 500 });
    }

    // 2. Mock an AI Deal Quality Engine score (0-100)
    // In production, this would call OpenAI/Gemini
    let dealScore = 50;
    let discountPct = 0;
    
    if (scrapedData.mrp && scrapedData.price && scrapedData.mrp > scrapedData.price) {
      discountPct = Math.round(((scrapedData.mrp - scrapedData.price) / scrapedData.mrp) * 100);
      dealScore = Math.min(100, 50 + (discountPct * 1.5)); // Simple algorithm for POC
    }

    // 3. Save to database
    // Find or create platform
    const platform = await prisma.platform.upsert({
      where: { slug: 'amazon' },
      update: {},
      create: { name: 'Amazon', slug: 'amazon' }
    });

    // Create/Update Product
    const product = await prisma.product.upsert({
      where: {
        platformId_externalId: {
          platformId: platform.id,
          externalId: scrapedData.externalId,
        }
      },
      update: {
        currentPrice: scrapedData.price,
        mrp: scrapedData.mrp,
        lastScrapedAt: new Date(),
      },
      create: {
        platformId: platform.id,
        externalId: scrapedData.externalId,
        title: scrapedData.title,
        brand: scrapedData.brand,
        currentPrice: scrapedData.price,
        mrp: scrapedData.mrp,
        imageUrl: scrapedData.imageUrl,
        url: url,
      }
    });

    // Create Deal if discount is significant (> 10%)
    let deal = null;
    if (discountPct >= 10) {
      deal = await prisma.deal.create({
        data: {
          productId: product.id,
          platformId: platform.id,
          dealType: 'price_drop',
          dealScore: Math.round(dealScore),
          originalPrice: scrapedData.mrp,
          dealPrice: scrapedData.price || 0,
          discountPct: discountPct,
          affiliateUrl: scrapedData.affiliateUrl, // Added affiliate URL
          isGenuine: true,
          isPublished: false,
        }
      });
    }

    return NextResponse.json({
      success: true,
      scrapedData,
      dealGenerated: deal !== null,
      dealScore: Math.round(dealScore),
      discount: discountPct,
    });

  } catch (error: any) {
    console.error('API Error /scrapers/test:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
