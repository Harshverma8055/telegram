import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveDealUrl, fetchAmazonDetails } from '@/lib/scrapers/rss';
import { scrapePriceAndMRP } from '@/app/api/deals/auto-import/route'; // We can import this or implement a fallback
import { sanitizeTitle } from '@/lib/telegram';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        category: 'watchlist'
      },
      include: {
        platform: true,
        history: {
          orderBy: {
            recordedAt: 'asc'
          }
        }
      },
      orderBy: {
        lastScrapedAt: 'desc'
      }
    });

    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error('Watchlist GET Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Resolve platform and external ID
    const resolved = await resolveDealUrl(url);
    if (!resolved) {
      return NextResponse.json({ error: 'Failed to resolve URL to a supported platform (Amazon/Flipkart/Myntra/Ajio)' }, { status: 400 });
    }

    const { platform: platformSlug, cleanUrl, externalId } = resolved;

    // 2. Fetch platform from db
    const platform = await prisma.platform.upsert({
      where: { slug: platformSlug },
      update: {},
      create: { name: platformSlug.charAt(0).toUpperCase() + platformSlug.slice(1), slug: platformSlug }
    });

    let title = 'Tracked Product';
    let currentPrice = 0;
    let mrp = 0;
    let imageUrl = '';

    // 3. Fetch product details
    if (platformSlug === 'amazon') {
      const details = await fetchAmazonDetails(externalId);
      if (details) {
        title = details.title;
        currentPrice = details.currentPrice;
        mrp = details.originalPrice || details.currentPrice;
        imageUrl = details.imageUrl;
      }
    } else {
      // Non-Amazon fallback/scraping using simple page scraper
      try {
        const response = await fetch(cleanUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
          }
        });
        const html = await response.text();
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);

        title = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Tracked Product';
        imageUrl = $('meta[property="og:image"]').attr('content') || '';
        
        // Try parsing price from HTML
        const priceRegex = /(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)/i;
        $('span, div, p').each((_: number, el: any) => {
          const text = $(el).text().trim();
          if (text.includes('₹') || text.includes('Rs.')) {
            const match = text.match(priceRegex);
            if (match && currentPrice === 0) {
              currentPrice = parseFloat(match[1].replace(/,/g, ''));
            }
          }
        });
      } catch (e) {
        console.error('Failed to scrape non-Amazon watchlist product details:', e);
      }
    }

    if (!currentPrice) {
      currentPrice = 0;
    }
    if (!mrp) {
      mrp = currentPrice;
    }

    // 4. Upsert Product marked as watchlist
    const product = await prisma.product.upsert({
      where: {
        platformId_externalId: {
          platformId: platform.id,
          externalId: externalId
        }
      },
      update: {
        category: 'watchlist',
        currentPrice,
        mrp,
        imageUrl: imageUrl || undefined,
        title: sanitizeTitle(title),
        url: cleanUrl
      },
      create: {
        platformId: platform.id,
        externalId: externalId,
        category: 'watchlist',
        title: sanitizeTitle(title),
        url: cleanUrl,
        imageUrl: imageUrl || null,
        currentPrice,
        mrp
      }
    });

    // 5. Save Price History
    if (currentPrice > 0) {
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: currentPrice
        }
      });
    }

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error('Watchlist POST Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Remove from watchlist by resetting category
    await prisma.product.update({
      where: { id },
      data: { category: null }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Watchlist DELETE Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
