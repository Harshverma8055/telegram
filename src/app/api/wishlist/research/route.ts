import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { 
  RESEARCH_CATEGORIES, 
  searchAmazonASINs, 
  fetchFullAmazonProductDetails, 
  verifyProduct, 
  calculateScores, 
  ensureWishlistTableExists 
} from '@/lib/scrapers/amazon-research';

// GET: Run a chunk of self-guided research
export async function GET(request: Request) {
  try {
    // 1. Ensure table exists (self-healing DB schema)
    await ensureWishlistTableExists();

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');
    const subcategoryParam = searchParams.get('subcategory');
    const keywordParam = searchParams.get('query');
    const maxToProcessParam = searchParams.get('limit');

    const limit = maxToProcessParam ? parseInt(maxToProcessParam, 10) : 5; // Safe default limit of 5 new products per run

    let targetCategory = '';
    let targetSubcategory = '';
    let targetKeyword = '';

    if (categoryParam && keywordParam) {
      // Manual targeted research
      targetCategory = categoryParam;
      targetSubcategory = subcategoryParam || 'General';
      targetKeyword = keywordParam;
    } else {
      // Self-guided automatic research: find an under-filled category
      // Fetch current counts
      const counts = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
        SELECT "category", COUNT(*)::bigint as "count" 
        FROM "WishlistProduct" 
        GROUP BY "category"
      `;

      const countsMap = new Map<string, number>();
      for (const row of counts) {
        countsMap.set(row.category, Number(row.count));
      }

      // Find the first category that hasn't reached its target count
      let selectedCat = RESEARCH_CATEGORIES.find(c => {
        const currentCount = countsMap.get(c.name) || 0;
        return currentCount < c.targetCount;
      });

      // Fallback to random if all are filled
      if (!selectedCat) {
        selectedCat = RESEARCH_CATEGORIES[Math.floor(Math.random() * RESEARCH_CATEGORIES.length)];
      }

      targetCategory = selectedCat.name;
      // Pick a random keyword from its list
      const randomKw = selectedCat.keywords[Math.floor(Math.random() * selectedCat.keywords.length)];
      targetSubcategory = randomKw.subcategory;
      targetKeyword = randomKw.query;
    }

    console.log(`📡 Starting Research Run: Category="${targetCategory}", Subcategory="${targetSubcategory}", Keyword="${targetKeyword}", Limit=${limit}`);

    // 2. Fetch ASINs from Amazon India
    const asins = await searchAmazonASINs(targetKeyword);
    if (asins.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No products found on Amazon search for keyword "${targetKeyword}"`,
        scanned: 0,
        added: 0
      });
    }

    let addedCount = 0;
    let scannedCount = 0;
    const addedProducts: any[] = [];
    const skippedReasons: Record<string, string> = {};

    // 3. Process products one by one
    for (const asin of asins) {
      // Respect limit to prevent serverless timeouts
      if (addedCount >= limit) {
        console.log(`⏱️ Limit of ${limit} added products reached for this run. Stopping.`);
        break;
      }

      scannedCount++;

      // Check if ASIN already exists in db
      try {
        const existing = await prisma.$queryRaw<any[]>`
          SELECT "id" FROM "WishlistProduct" WHERE "asin" = ${asin} LIMIT 1
        `;
        if (existing.length > 0) {
          skippedReasons[asin] = 'Already in wishlist';
          continue;
        }
      } catch (dbErr) {
        // Fallback if table query fails
        console.log(`DB query error for duplicate check of ASIN ${asin}:`, dbErr);
      }

      // Small delay to look human and avoid bans
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));

      // Fetch full details
      const details = await fetchFullAmazonProductDetails(asin);
      if (!details) {
        skippedReasons[asin] = 'Failed to fetch details / CAPTCHA';
        continue;
      }

      // Verify product conditions
      const verification = verifyProduct(details, targetCategory);
      if (!verification.valid) {
        skippedReasons[asin] = verification.reason || 'Failed verification rules';
        continue;
      }

      // Calculate scores
      const scores = calculateScores(details, targetCategory, targetSubcategory);

      // Save to database
      try {
        await prisma.$executeRawUnsafe(`
          INSERT INTO "WishlistProduct" (
            "id", "asin", "title", "amazon_url", "brand", "category", "subcategory", 
            "price", "mrp", "discount", "coupon", "rating", "review_count", "availability", 
            "image", "seller", "prime", "amazon_choice", "best_seller", "deal_type", 
            "priority_score", "buy_score", "student_score", "hostel_score", "fashion_score", 
            "gift_score", "affiliate_score", "wishlist", "last_updated"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, NOW()
          ) ON CONFLICT ("asin") DO UPDATE SET
            "title" = EXCLUDED."title",
            "price" = EXCLUDED."price",
            "mrp" = EXCLUDED."mrp",
            "discount" = EXCLUDED."discount",
            "coupon" = EXCLUDED."coupon",
            "rating" = EXCLUDED."rating",
            "review_count" = EXCLUDED."review_count",
            "availability" = EXCLUDED."availability",
            "image" = EXCLUDED."image",
            "seller" = EXCLUDED."seller",
            "prime" = EXCLUDED."prime",
            "amazon_choice" = EXCLUDED."amazon_choice",
            "best_seller" = EXCLUDED."best_seller",
            "deal_type" = EXCLUDED."deal_type",
            "priority_score" = EXCLUDED."priority_score",
            "buy_score" = EXCLUDED."buy_score",
            "student_score" = EXCLUDED."student_score",
            "hostel_score" = EXCLUDED."hostel_score",
            "fashion_score" = EXCLUDED."fashion_score",
            "gift_score" = EXCLUDED."gift_score",
            "affiliate_score" = EXCLUDED."affiliate_score",
            "last_updated" = NOW()
        `,
          crypto.randomUUID(),
          details.asin,
          details.title,
          details.amazonUrl,
          details.brand,
          targetCategory,
          targetSubcategory,
          details.price,
          details.mrp,
          details.discount,
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
          true
        );

        addedCount++;
        addedProducts.push({
          asin: details.asin,
          title: details.title,
          price: details.price,
          discount: details.discount,
          scores
        });

      } catch (dbInsertErr: any) {
        console.error(`❌ [Research] DB Insert failed for ${asin}:`, dbInsertErr.message);
        skippedReasons[asin] = `DB Insert error: ${dbInsertErr.message}`;
      }
    }

    return NextResponse.json({
      success: true,
      category: targetCategory,
      subcategory: targetSubcategory,
      keyword: targetKeyword,
      scanned: scannedCount,
      added: addedCount,
      addedProducts,
      skippedReasons
    });

  } catch (error: any) {
    console.error('❌ [Research] Error in research route:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Run bulk automated crawl step
export async function POST(request: Request) {
  // Can be used to trigger bulk operations from an automation scheduler
  return GET(request);
}
