import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { ensureWishlistTableExists, fetchFullAmazonProductDetails, calculateScores } from '@/lib/scrapers/amazon-research';
import crypto from 'crypto';

// GET: Retrieve and filter wishlist products
export async function GET(request: Request) {
  try {
    await ensureWishlistTableExists();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const sortBy = searchParams.get('sortBy') || 'priority_score'; // default sort by priority score
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const wishlistParam = searchParams.get('wishlist'); // 'true', 'false', or null

    const offset = (page - 1) * limit;

    // Build raw SQL query where clauses dynamically to prevent SQL injection and support prisma limitations
    const queryParams: any[] = [];
    let whereClause = 'WHERE 1=1';

    if (category) {
      queryParams.push(category);
      whereClause += ` AND "category" = $${queryParams.length}`;
    }

    if (subcategory) {
      queryParams.push(subcategory);
      whereClause += ` AND "subcategory" = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      whereClause += ` AND ("title" ILIKE $${queryParams.length} OR "brand" ILIKE $${queryParams.length} OR "asin" ILIKE $${queryParams.length})`;
    }

    if (minPrice) {
      queryParams.push(parseFloat(minPrice));
      whereClause += ` AND "price" >= $${queryParams.length}`;
    }

    if (maxPrice) {
      queryParams.push(parseFloat(maxPrice));
      whereClause += ` AND "price" <= $${queryParams.length}`;
    }

    if (wishlistParam === 'true') {
      whereClause += ` AND "wishlist" = true`;
    } else if (wishlistParam === 'false') {
      whereClause += ` AND "wishlist" = false`;
    }

    // Determine Sort Clause
    let orderBy = 'ORDER BY "priority_score" DESC';
    if (sortBy === 'price') {
      orderBy = `ORDER BY "price" ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (sortBy === 'discount') {
      orderBy = `ORDER BY "discount" ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (sortBy === 'rating') {
      orderBy = `ORDER BY "rating" ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (sortBy === 'review_count') {
      orderBy = `ORDER BY "review_count" ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (sortBy === 'student_score') {
      orderBy = `ORDER BY "student_score" ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    } else if (sortBy === 'last_updated') {
      orderBy = `ORDER BY "last_updated" ${sortOrder === 'asc' ? 'ASC' : 'DESC'}`;
    }

    // Execute query for data
    const dataQuery = `
      SELECT * FROM "WishlistProduct"
      ${whereClause}
      ${orderBy}
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Execute query for total count
    const countQuery = `
      SELECT COUNT(*)::bigint as "total" FROM "WishlistProduct"
      ${whereClause}
    `;

    const [products, countResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(dataQuery, ...queryParams),
      prisma.$queryRawUnsafe<any[]>(countQuery, ...queryParams)
    ]);

    const total = Number(countResult[0]?.total || 0);

    return NextResponse.json({
      success: true,
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('❌ [WishlistProducts] Query Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper to extract ASIN
function extractAsin(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 10 && /^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  // Try resolving as URL
  const match = trimmed.match(/\/(?:dp|gp\/product|aw\/d|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  const qMatch = trimmed.match(/[?&]asin=([A-Z0-9]{10})/i);
  if (qMatch && qMatch[1]) {
    return qMatch[1].toUpperCase();
  }
  return null;
}

// POST: Manually add a product to wishlist catalog
export async function POST(request: Request) {
  try {
    await ensureWishlistTableExists();
    const body = await request.json();
    const { url, category, subcategory, targetPrice, targetDiscount } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'Amazon URL or ASIN is required' }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ success: false, error: 'Category is required' }, { status: 400 });
    }

    const asin = extractAsin(url);
    if (!asin) {
      return NextResponse.json({ success: false, error: 'Could not extract a valid 10-character Amazon ASIN from the provided input.' }, { status: 400 });
    }

    // Check if product already exists
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "wishlist" FROM "WishlistProduct" WHERE "asin" = $1 LIMIT 1`,
      asin
    );

    const targetSubcategory = subcategory || 'General';

    // Fetch details from Amazon
    const details = await fetchFullAmazonProductDetails(asin);
    if (!details) {
      return NextResponse.json({ success: false, error: 'Failed to fetch details from Amazon (robot check or invalid ASIN).' }, { status: 500 });
    }

    // Calculate scores
    const scores = calculateScores(details, category, targetSubcategory);

    const price = details.price;
    const mrp = details.mrp;
    const discount = details.discount;

    const parsedTargetPrice = targetPrice ? parseFloat(targetPrice) : null;
    const parsedTargetDiscount = targetDiscount ? parseFloat(targetDiscount) : null;

    if (existing.length > 0) {
      // Update existing product to be active on the wishlist
      await prisma.$executeRawUnsafe(`
        UPDATE "WishlistProduct" SET
          "title" = $1,
          "price" = $2,
          "mrp" = $3,
          "discount" = $4,
          "coupon" = $5,
          "rating" = $6,
          "review_count" = $7,
          "availability" = $8,
          "image" = $9,
          "seller" = $10,
          "prime" = $11,
          "amazon_choice" = $12,
          "best_seller" = $13,
          "deal_type" = $14,
          "priority_score" = $15,
          "buy_score" = $16,
          "student_score" = $17,
          "hostel_score" = $18,
          "fashion_score" = $19,
          "gift_score" = $20,
          "affiliate_score" = $21,
          "wishlist" = true,
          "category" = $22,
          "subcategory" = $23,
          "target_price" = COALESCE($24, "target_price"),
          "target_discount" = COALESCE($25, "target_discount"),
          "last_updated" = NOW()
        WHERE "asin" = $26
      `,
        details.title,
        price,
        mrp,
        discount,
        details.coupon,
        details.rating,
        details.reviewCount,
        details.availability,
        details.image,
        details.seller,
        details.prime,
        details.amazonChoice,
        details.bestSeller,
        details.dealType,
        scores.priorityScore,
        scores.impulseScore,
        scores.studentScore,
        scores.hostelScore,
        scores.fashionScore,
        scores.giftScore,
        scores.affiliateScore,
        category,
        targetSubcategory,
        parsedTargetPrice,
        parsedTargetDiscount,
        asin
      );

      return NextResponse.json({
        success: true,
        message: `Product ${asin} already existed. Updated details and reactivated in wishlist!`,
        product: { ...details, category, subcategory: targetSubcategory, scores }
      });
    }

    // Insert new product
    const uuid = crypto.randomUUID();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "WishlistProduct" (
        "id", "asin", "title", "amazon_url", "brand", "category", "subcategory", 
        "price", "mrp", "discount", "coupon", "rating", "review_count", "availability", 
        "image", "seller", "prime", "amazon_choice", "best_seller", "deal_type", 
        "priority_score", "buy_score", "student_score", "hostel_score", "fashion_score", 
        "gift_score", "affiliate_score", "wishlist", "target_price", "target_discount", "last_updated"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, NOW()
      )
    `,
      uuid,
      asin,
      details.title,
      details.amazonUrl,
      details.brand,
      category,
      targetSubcategory,
      price,
      mrp,
      discount,
      details.coupon,
      details.rating,
      details.reviewCount,
      details.availability,
      details.image,
      details.seller,
      details.prime,
      details.amazonChoice,
      details.bestSeller,
      details.dealType,
      scores.priorityScore,
      scores.impulseScore,
      scores.studentScore,
      scores.hostelScore,
      scores.fashionScore,
      scores.giftScore,
      scores.affiliateScore,
      true,
      parsedTargetPrice,
      parsedTargetDiscount
    );

    return NextResponse.json({
      success: true,
      message: `Successfully added "${details.title.substring(0, 45)}..." to wishlist catalog!`,
      product: { id: uuid, ...details, category, subcategory: targetSubcategory, scores }
    });

  } catch (error: any) {
    console.error('❌ [WishlistProducts] POST Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Update a product (e.g. toggle wishlist status, update target price or scores)
export async function PUT(request: Request) {
  try {
    await ensureWishlistTableExists();
    const body = await request.json();
    const id = body.id;
    const title = body.title;
    const price = body.price;
    const mrp = body.mrp;
    const wishlist = body.wishlist;
    const priorityScore = body.priorityScore !== undefined ? body.priorityScore : body.priority_score;
    const studentScore = body.studentScore !== undefined ? body.studentScore : body.student_score;
    const hostelScore = body.hostelScore !== undefined ? body.hostelScore : body.hostel_score;
    const fashionScore = body.fashionScore !== undefined ? body.fashionScore : body.fashion_score;
    const giftScore = body.giftScore !== undefined ? body.giftScore : body.gift_score;
    const buyScore = body.buyScore !== undefined ? body.buyScore : body.buy_score;
    const targetPrice = body.targetPrice !== undefined ? body.targetPrice : body.target_price;
    const targetDiscount = body.targetDiscount !== undefined ? body.targetDiscount : body.target_discount;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing product ID' }, { status: 400 });
    }

    // Run updates dynamically
    const fieldsToUpdate: string[] = [];
    const values: any[] = [];

    const addField = (colName: string, val: any) => {
      if (val !== undefined) {
        values.push(val);
        fieldsToUpdate.push(`"${colName}" = $${values.length}`);
      }
    };

    addField('title', title);
    addField('price', price !== undefined ? parseFloat(price) : undefined);
    addField('mrp', mrp !== undefined ? parseFloat(mrp) : undefined);
    addField('wishlist', wishlist);
    addField('priority_score', priorityScore !== undefined ? parseFloat(priorityScore) : undefined);
    addField('student_score', studentScore !== undefined ? parseFloat(studentScore) : undefined);
    addField('hostel_score', hostelScore !== undefined ? parseFloat(hostelScore) : undefined);
    addField('fashion_score', fashionScore !== undefined ? parseFloat(fashionScore) : undefined);
    addField('gift_score', giftScore !== undefined ? parseFloat(giftScore) : undefined);
    addField('buy_score', buyScore !== undefined ? parseFloat(buyScore) : undefined);
    addField('target_price', targetPrice !== undefined ? (targetPrice === null ? null : parseFloat(targetPrice)) : undefined);
    addField('target_discount', targetDiscount !== undefined ? (targetDiscount === null ? null : parseFloat(targetDiscount)) : undefined);

    if (fieldsToUpdate.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    // Set updated timestamp
    values.push(id);
    const query = `
      UPDATE "WishlistProduct"
      SET ${fieldsToUpdate.join(', ')}, "last_updated" = NOW()
      WHERE "id" = $${values.length}
      RETURNING *
    `;

    const updated = await prisma.$queryRawUnsafe<any[]>(query, ...values);

    if (updated.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      product: updated[0]
    });

  } catch (error: any) {
    console.error('❌ [WishlistProducts] Update Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove product from wishlist
export async function DELETE(request: Request) {
  try {
    await ensureWishlistTableExists();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('all') === 'true';

    if (clearAll) {
      await prisma.$executeRawUnsafe(`DELETE FROM "WishlistProduct"`);
      return NextResponse.json({ success: true, message: 'All wishlist products deleted' });
    }

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing product ID' }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM "WishlistProduct" WHERE "id" = $1`, id);

    return NextResponse.json({
      success: true,
      message: 'Product removed from wishlist research db'
    });

  } catch (error: any) {
    console.error('❌ [WishlistProducts] Delete Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
