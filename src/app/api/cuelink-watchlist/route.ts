import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { fetchProductDetails } from '@/lib/cuelink-scraper';

// GET — list all CuelinkWishlist products with pagination
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const platform = searchParams.get('platform') || undefined;
  const category = searchParams.get('category') || undefined;

  const where: any = {};
  if (platform) where.platform = platform;
  if (category) where.category = category;

  const [products, total] = await Promise.all([
    prisma.cuelinkWishlist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cuelinkWishlist.count({ where }),
  ]);

  // Stats
  const stats = await prisma.cuelinkWishlist.groupBy({
    by: ['platform'],
    _count: true,
  });

  const categoryStats = await prisma.cuelinkWishlist.groupBy({
    by: ['category'],
    _count: true,
    orderBy: { _count: { category: 'desc' } },
  });

  return NextResponse.json({
    products,
    total,
    page,
    pages: Math.ceil(total / limit),
    platformStats: stats,
    categoryStats,
  });
}

// POST — add a new product by URL (scrapes real data)
export async function POST(request: Request) {
  const body = await request.json();
  const { productUrl, platform, category, subcategory, targetDiscount = 20 } = body;

  if (!productUrl || !platform) {
    return NextResponse.json({ error: 'productUrl and platform are required' }, { status: 400 });
  }

  // Scrape real product details
  const details = await fetchProductDetails(productUrl);
  if (!details || !details.title) {
    return NextResponse.json({ error: 'Could not fetch product details. Check the URL.' }, { status: 422 });
  }

  // Extract product ID from URL
  let externalId = '';
  if (platform === 'flipkart') {
    const m = productUrl.match(/pid=([A-Z0-9]+)/i) || productUrl.match(/\/p\/([a-z0-9]+)/i);
    externalId = m ? m[1].toUpperCase() : `fk_${Date.now()}`;
  } else if (platform === 'myntra') {
    const m = productUrl.match(/\/(\d+)\/buy/);
    externalId = m ? `myn_${m[1]}` : `myn_${Date.now()}`;
  } else if (platform === 'ajio') {
    const m = productUrl.match(/\/p\/([A-Z0-9-]+)/i);
    externalId = m ? `ajio_${m[1]}` : `ajio_${Date.now()}`;
  } else {
    externalId = `${platform}_${Date.now()}`;
  }

  // Check duplicate
  const existing = await prisma.cuelinkWishlist.findUnique({ where: { externalId } });
  if (existing) {
    return NextResponse.json({ error: 'Product already exists in watchlist', existing }, { status: 409 });
  }

  const targetPrice = Math.round(details.currentPrice * (1 - targetDiscount / 100));

  const product = await prisma.cuelinkWishlist.create({
    data: {
      externalId,
      platform,
      title: details.title.substring(0, 500),
      productUrl,
      brand: null,
      category: category || 'General',
      subcategory: subcategory || 'Other',
      price: details.currentPrice,
      mrp: details.originalPrice || details.currentPrice,
      discount: details.discount || 0,
      image: details.imageUrl || '',
      targetPrice,
      targetDiscount,
      active: true,
    },
  });

  return NextResponse.json({ success: true, product });
}

// DELETE — remove a product by id
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await prisma.cuelinkWishlist.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
