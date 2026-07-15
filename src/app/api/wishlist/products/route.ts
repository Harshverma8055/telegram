import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { ensureWishlistTableExists } from '@/lib/scrapers/amazon-research';

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

// PUT: Update a product (e.g. toggle wishlist status, update target price or scores)
export async function PUT(request: Request) {
  try {
    await ensureWishlistTableExists();
    const body = await request.json();
    const { id, title, price, mrp, wishlist, priorityScore, studentScore, hostelScore, fashionScore, giftScore, buyScore } = body;

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
