// =====================================================================
// 🎯 WISHLIST BULK MANAGER — Add/Remove/Clean wishlist items
//
// This API allows:
// POST: Add items to wishlist by ASIN (with auto-scrape for details)
// DELETE: Remove/deactivate wishlist items
// PATCH: Clean duplicates (e.g., remove excess sticky notes)
//
// This is a one-time utility endpoint. SAFE to modify.
// =====================================================================

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { fetchAmazonDetails } from '@/lib/stealth-scraper';
import { getAffiliateUrl } from '@/lib/affiliate';

interface WishlistItem {
  asin: string;
  category: string;
  subcategory: string;
  targetDiscount?: number;
  targetPrice?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items: WishlistItem[] = body.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Provide items array with asin, category, subcategory' }, { status: 400 });
    }

    const results: any[] = [];
    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of items) {
      try {
        // Check if already exists
        const existing = await prisma.$queryRaw<any[]>`
          SELECT "id", "title" FROM "WishlistProduct" WHERE "asin" = ${item.asin} LIMIT 1
        `;
        
        if (existing.length > 0) {
          results.push({ asin: item.asin, status: 'skipped', reason: 'Already exists', title: existing[0].title });
          skipped++;
          continue;
        }

        // Fetch product details from Amazon using stealth scraper
        const details = await fetchAmazonDetails(item.asin);
        
        if (!details || !details.title) {
          results.push({ asin: item.asin, status: 'failed', reason: 'Could not fetch from Amazon' });
          failed++;
          continue;
        }

        // Must have an image
        if (!details.imageUrl || !details.imageUrl.startsWith('http')) {
          results.push({ asin: item.asin, status: 'failed', reason: 'No product image found' });
          failed++;
          continue;
        }

        const price = details.currentPrice || 0;
        const mrp = details.originalPrice || price;
        const discount = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

        // Calculate target price from target discount
        const targetDiscount = item.targetDiscount || 15;
        const targetPrice = item.targetPrice || Math.round(price * (1 - targetDiscount / 100));

        // Insert into wishlist
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
          crypto.randomUUID(),
          item.asin,
          details.title,
          `https://www.amazon.in/dp/${item.asin}`,
          details.title.split(' ')[0], // rough brand from title
          item.category,
          item.subcategory,
          price,
          mrp,
          discount,
          false,        // coupon
          0,            // rating
          0,            // review_count
          'Available',
          details.imageUrl,
          null,         // seller
          true,         // prime
          false,        // amazon_choice
          false,        // best_seller
          'none',       // deal_type
          70,           // priority_score
          60,           // buy_score
          80,           // student_score
          80,           // hostel_score
          30,           // fashion_score
          40,           // gift_score
          70,           // affiliate_score
          true,         // wishlist active
          targetPrice,
          targetDiscount
        );

        added++;
        results.push({
          asin: item.asin,
          status: 'added',
          title: details.title,
          price,
          mrp,
          discount: `${discount}%`,
          image: details.imageUrl,
          targetPrice,
          targetDiscount: `${targetDiscount}%`,
        });

        // Small delay between scrapes
        await new Promise(r => setTimeout(r, 800));

      } catch (err: any) {
        results.push({ asin: item.asin, status: 'error', reason: err.message });
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      added,
      skipped,
      failed,
      total: items.length,
      results,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Remove sticky note duplicates and deactivate old items
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const action = body.action; // 'clean_sticky_notes' or 'deactivate'
    
    if (action === 'clean_sticky_notes') {
      // Keep only the top 2 sticky note products, deactivate the rest
      const stickyNotes = await prisma.$queryRaw<any[]>`
        SELECT "id", "title", "price", "discount" 
        FROM "WishlistProduct" 
        WHERE LOWER("title") LIKE '%sticky%note%' AND "wishlist" = true
        ORDER BY "discount" DESC, "price" ASC
      `;

      if (stickyNotes.length <= 2) {
        return NextResponse.json({ 
          success: true, 
          message: `Only ${stickyNotes.length} sticky note items found. No cleanup needed.`,
          items: stickyNotes 
        });
      }

      // Keep top 2, deactivate the rest
      const toKeep = stickyNotes.slice(0, 2);
      const toRemove = stickyNotes.slice(2);
      
      for (const item of toRemove) {
        await prisma.$executeRawUnsafe(
          `UPDATE "WishlistProduct" SET "wishlist" = false WHERE "id" = $1`,
          item.id
        );
      }

      return NextResponse.json({
        success: true,
        kept: toKeep.map((i: any) => ({ id: i.id, title: i.title })),
        removed: toRemove.map((i: any) => ({ id: i.id, title: i.title })),
      });

    } else if (action === 'deactivate') {
      // Deactivate specific ASINs
      const asins: string[] = body.asins || [];
      let deactivated = 0;
      for (const asin of asins) {
        await prisma.$executeRawUnsafe(
          `UPDATE "WishlistProduct" SET "wishlist" = false WHERE "asin" = $1`,
          asin
        );
        deactivated++;
      }
      return NextResponse.json({ success: true, deactivated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
