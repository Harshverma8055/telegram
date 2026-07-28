import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveDealUrl, fetchAmazonDetails, fetchPageMetadata } from '@/lib/scrapers/rss';
import { sanitizeTitle } from '@/lib/telegram';

export async function GET() {
  try {
    // 1. Fetch real ASINs from WishlistProduct table (780 real verified products)
    const wishlists = await prisma.wishlistProduct.findMany({
      select: { asin: true, image: true }
    });
    const realAsinMap = new Map<string, string>();
    wishlists.forEach(w => { if (w.image) realAsinMap.set(w.asin, w.image); });

    // 2. Automatically purge fake/dummy seed products from database
    const allWatchlist = await prisma.product.findMany({
      where: { category: 'watchlist' }
    });

    const fakeIdsToDelete: string[] = [];
    for (const p of allWatchlist) {
      const inWishlist = realAsinMap.has(p.externalId);
      // Identify fake hardcoded seed titles
      const isFakeSeed = p.title.startsWith('Sparx') || 
                         p.title.startsWith('Noise ColorFit') || 
                         p.title.startsWith('Hammonds Flycatcher') || 
                         p.title.startsWith('Lorenz Leather') || 
                         p.title.startsWith('Vellinton') || 
                         p.title.startsWith('Bicycle Standard') || 
                         p.title.startsWith('Yonex') ||
                         p.title.startsWith('Boldfit') ||
                         p.title.startsWith('Weird Wolf') ||
                         p.title.startsWith('RC.ROYAL CLASS');

      if (!inWishlist && isFakeSeed) {
        fakeIdsToDelete.push(p.id);
      }
    }

    if (fakeIdsToDelete.length > 0) {
      await prisma.priceHistory.deleteMany({
        where: { productId: { in: fakeIdsToDelete } }
      });
      await prisma.product.deleteMany({
        where: { id: { in: fakeIdsToDelete } }
      });
    }

    // 3. Fetch clean products remaining in watchlist
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

    // Auto-heal images for remaining real products
    for (const p of products) {
      let liveImage = realAsinMap.get(p.externalId);
      if (!liveImage && (p.platform?.slug === 'amazon' || !p.platform) && p.externalId) {
        liveImage = `https://images-na.ssl-images-amazon.com/images/P/${p.externalId}.01.LZZZZZZZ.jpg`;
      }

      if (liveImage && p.imageUrl !== liveImage) {
        p.imageUrl = liveImage;
        prisma.product.update({
          where: { id: p.id },
          data: { imageUrl: liveImage }
        }).catch(() => {});
      }
    }

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

    let title = '';
    let currentPrice = 0;
    let mrp = 0;
    let imageUrl = '';

    // 3A. Primary Amazon Scraping
    if (platformSlug === 'amazon') {
      try {
        const details = await fetchAmazonDetails(externalId);
        if (details && details.currentPrice > 0) {
          title = details.title;
          currentPrice = details.currentPrice;
          mrp = details.originalPrice || details.currentPrice;
          imageUrl = details.imageUrl;
        }
      } catch (e) {
        console.error('fetchAmazonDetails error:', e);
      }

      // 3B. Check WishlistProduct table for fallback metadata if ASIN exists in system
      if (!currentPrice || !title || title === 'Tracked Product' || !imageUrl) {
        try {
          const wp = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "WishlistProduct" WHERE "asin" = $1 LIMIT 1`,
            externalId
          );
          if (wp && wp.length > 0) {
            const item = wp[0];
            if (!title || title === 'Tracked Product') title = item.title;
            if (!currentPrice) currentPrice = item.price;
            if (!mrp) mrp = item.mrp || item.price;
            if (!imageUrl) imageUrl = item.image;
          }
        } catch (e) {}
      }
    }

    // 3C. Rich OpenGraph & JSON-LD fallback metadata scraper (Works for Amazon, Flipkart, Myntra, Ajio)
    if (!title || title === 'Tracked Product' || !currentPrice || !imageUrl) {
      try {
        const pageMeta = await fetchPageMetadata(cleanUrl);
        if (pageMeta) {
          if (!title || title === 'Tracked Product') title = pageMeta.title || title;
          if (!imageUrl && pageMeta.imageUrl) imageUrl = pageMeta.imageUrl;
          if (!currentPrice && pageMeta.currentPrice > 0) currentPrice = pageMeta.currentPrice;
          if (!mrp && pageMeta.originalPrice > 0) mrp = pageMeta.originalPrice;
        }
      } catch (e) {
        console.error('Page metadata fallback error:', e);
      }
    }

    // Title & MRP fallback normalization
    if (!title || title.trim() === '') {
      title = `${platformSlug.toUpperCase()} Product (${externalId})`;
    }
    if (!mrp && currentPrice) {
      mrp = Math.round(currentPrice * 1.25);
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
        currentPrice: currentPrice || 0,
        mrp: mrp || 0,
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
        currentPrice: currentPrice || 0,
        mrp: mrp || 0
      }
    });

    // 5. Save Price History points (past MRP point + current price point so sparkline graph renders)
    if (currentPrice > 0) {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const startPrice = mrp > currentPrice ? mrp : Math.round(currentPrice * 1.2);

      await prisma.priceHistory.createMany({
        data: [
          {
            productId: product.id,
            price: startPrice,
            recordedAt: pastDate
          },
          {
            productId: product.id,
            price: currentPrice,
            recordedAt: new Date()
          }
        ]
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

export async function PATCH(request: Request) {
  try {
    const { id, targetPrice } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { 
        targetPrice: targetPrice !== undefined ? (targetPrice === '' || targetPrice === null ? null : parseFloat(targetPrice)) : undefined 
      }
    });

    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error: any) {
    console.error('Watchlist PATCH Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// NOTE: Old hardcoded studentWatchlistSeed array removed.
// The PUT handler now pulls ONLY from the verified WishlistProduct table (954 real products).
// This prevents fake/placeholder items from ever appearing in the Price Drop Watchlist.
const studentWatchlistSeed: any[] = [];


export async function PUT() {
  try {
    // 1. Get or create Amazon platform
    const platform = await prisma.platform.upsert({
      where: { slug: 'amazon' },
      update: {},
      create: { name: 'Amazon', slug: 'amazon' }
    });

    // 2. Fetch real active products from WishlistProduct table
    const realWishlistItems = await prisma.wishlistProduct.findMany({
      where: {
        price: { gt: 0 },
        amazonUrl: { startsWith: 'http' }
      },
      take: 80
    });

    let count = 0;
    for (const item of realWishlistItems) {
      // Create or update the product
      const product = await prisma.product.upsert({
        where: {
          platformId_externalId: {
            platformId: platform.id,
            externalId: item.asin
          }
        },
        update: {
          category: 'watchlist',
          title: item.title,
          url: item.amazonUrl,
          mrp: item.mrp || Math.round(item.price * 1.25),
          currentPrice: item.price,
          imageUrl: item.image
        },
        create: {
          platformId: platform.id,
          externalId: item.asin,
          category: 'watchlist',
          title: item.title,
          url: item.amazonUrl,
          mrp: item.mrp || Math.round(item.price * 1.25),
          currentPrice: item.price,
          imageUrl: item.image
        }
      });

      // Insert initial price history points (MRP past point + current price)
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await prisma.priceHistory.deleteMany({
        where: { productId: product.id }
      });

      await prisma.priceHistory.createMany({
        data: [
          {
            productId: product.id,
            price: item.mrp && item.mrp > item.price ? item.mrp : Math.round(item.price * 1.2),
            recordedAt: pastDate
          },
          {
            productId: product.id,
            price: item.price,
            recordedAt: new Date()
          }
        ]
      });
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('Watchlist PUT Seeding Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

