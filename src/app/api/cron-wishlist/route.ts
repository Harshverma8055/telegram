import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds execution on Vercel
import prisma from '@/lib/prisma';
import { fetchAmazonDetails } from '@/lib/stealth-scraper';
import { publishToTelegram, sanitizeTitle, bot, escapeMarkdown } from '@/lib/telegram';
import { getAffiliateUrl } from '@/lib/affiliate';

// Wishlist deals go ONLY to hostel channel (student-curated products)
// Main channel has its own independent cron at /api/cron
const HOSTEL_CHANNEL = process.env.HOSTEL_CHANNEL || '@hosteldeals';

// How many wishlist items to check per cron run
const BATCH_SIZE = 15;
// Max execution time in ms (50s safety guard for Vercel 60s maxDuration)
const MAX_MS = 50000;

function isSilentHoursIST(): boolean {
  const now = new Date();
  const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istString);
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  if (hours === 23 && minutes >= 30) return true;
  if (hours < 7) return true;
  return false;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  
  // Support both Authorization header and ?key= query parameter
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const authHeader = request.headers.get('authorization');
  
  const isAuthorized = !process.env.CRON_SECRET || 
                       authHeader === `Bearer ${process.env.CRON_SECRET}` || 
                       key === process.env.CRON_SECRET;
                       
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isSilent = isSilentHoursIST();

  console.log(`📡 [cron-wishlist] Starting. Silent: ${isSilent}`);

  let checked = 0;
  let triggered = 0;
  let skipped = 0;
  const logs: string[] = [];

  try {
    // Fetch a rotating batch of wishlist products ordered by last_updated ASC
    // This ensures we cycle through all 700+ products over multiple runs
    const batch = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "WishlistProduct"
      WHERE "wishlist" = true
      ORDER BY "last_updated" ASC
      LIMIT ${BATCH_SIZE}
    `);

    logs.push(`Checking batch of ${batch.length} wishlist items (oldest first)`);
    console.log(`📡 [cron-wishlist] Checking batch of ${batch.length} wishlist items.`);

    // Process items in parallel mini-batches of 3 for speed
    const PARALLEL = 3;
    for (let i = 0; i < batch.length; i += PARALLEL) {
      // Hard timeout guard
      if (Date.now() - startTime > MAX_MS) {
        logs.push(`⏱️ Timeout guard hit after checking ${checked} items.`);
        break;
      }

      const chunk = batch.slice(i, i + PARALLEL);

      // Touch last_updated for all items in this chunk immediately
      // so they rotate to the end of the queue for the next run
      await Promise.all(chunk.map(prod =>
        prisma.$executeRawUnsafe(
          `UPDATE "WishlistProduct" SET "last_updated" = NOW() WHERE "id" = $1`,
          prod.id
        )
      ));

      // Fetch Amazon prices for all items in this chunk simultaneously
      const results = await Promise.allSettled(
        chunk.map(async (prod) => {
          const details = await fetchAmazonDetails(prod.asin);
          return { prod, details };
        })
      );

      for (const result of results) {
        checked++;

        if (result.status === 'rejected' || !result.value.details || !result.value.details.currentPrice) {
          const asin = result.status === 'fulfilled' ? result.value.prod.asin : 'unknown';
          logs.push(`⚠️ ${asin}: Could not fetch current price. Skipping.`);
          skipped++;
          continue;
        }

        const { prod, details } = result.value;

        const latestPrice = details.currentPrice;
        const originalPrice = details.originalPrice || prod.mrp || latestPrice;
        const latestDiscount = originalPrice > latestPrice
          ? Math.round(((originalPrice - latestPrice) / originalPrice) * 100)
          : 0;

        // Determine target
        let hasHitTargetPrice = false;
        let hasHitTargetDiscount = false;
        const hasCustomTargets = prod.target_price !== null || prod.target_discount !== null;

        if (hasCustomTargets) {
          hasHitTargetPrice = prod.target_price ? latestPrice <= prod.target_price : false;
          hasHitTargetDiscount = prod.target_discount ? latestDiscount >= prod.target_discount : false;
          logs.push(`🔎 ${prod.asin}: ₹${latestPrice} (${latestDiscount}% off) | Target: ₹${prod.target_price} OR ${prod.target_discount}% off`);
        } else {
          // Default: 5% drop below crawled price, OR ≥50% discount
          const defaultTargetPrice = Math.round(prod.price * 0.95);
          hasHitTargetPrice = latestPrice <= defaultTargetPrice;
          hasHitTargetDiscount = latestDiscount >= 50;
          logs.push(`🔎 ${prod.asin}: ₹${latestPrice} (${latestDiscount}% off) | Default target: ₹${defaultTargetPrice} or 50% off`);
        }

        if (!hasHitTargetPrice && !hasHitTargetDiscount) {
          continue;
        }

        // 🎯 TARGET MET!
        logs.push(`🎯 TARGET MET: ${prod.title?.substring(0, 50)} — ₹${latestPrice} (${latestDiscount}% off)`);
        console.log(`🎯 [cron-wishlist] TARGET MET: ${prod.asin} — ₹${latestPrice} (${latestDiscount}% off)`);

        triggered++;

        const affiliateUrl = getAffiliateUrl('amazon', prod.amazon_url, prod.asin);

        // Upsert into main Product table
        const amazonPlatform = await prisma.platform.upsert({
          where: { slug: 'amazon' },
          update: {},
          create: { name: 'Amazon', slug: 'amazon' }
        });

        const product = await prisma.product.upsert({
          where: {
            platformId_externalId: {
              platformId: amazonPlatform.id,
              externalId: prod.asin
            }
          },
          update: {
            title: sanitizeTitle(details.title || prod.title),
            currentPrice: latestPrice,
            imageUrl: details.imageUrl || prod.image,
            lastScrapedAt: new Date()
          },
          create: {
            platformId: amazonPlatform.id,
            externalId: prod.asin,
            title: sanitizeTitle(details.title || prod.title),
            url: prod.amazon_url,
            currentPrice: latestPrice,
            imageUrl: details.imageUrl || prod.image,
          }
        });

        // Create deal record
        const deal = await prisma.deal.create({
          data: {
            productId: product.id,
            platformId: amazonPlatform.id,
            dealType: 'price_drop',
            dealScore: 99,
            dealPrice: latestPrice,
            originalPrice: originalPrice,
            discountPct: latestDiscount,
            affiliateUrl: affiliateUrl,
            isGenuine: true,
            isPublished: false
          }
        });

        // Insert price history
        await prisma.priceHistory.create({
          data: {
            productId: product.id,
            price: latestPrice
          }
        });

        // Mark wishlist item so it's not re-triggered
        await prisma.$executeRawUnsafe(
          `UPDATE "WishlistProduct" SET "wishlist" = false, "last_updated" = NOW() WHERE "id" = $1`,
          prod.id
        );

        // Publish to hostel channel ONLY (wishlist = student products)
        // NOTE: Do NOT add main channel here. Main channel has /api/cron.
        if (!isSilent) {
          try {
            await publishToTelegram(deal.id, HOSTEL_CHANNEL);
            logs.push(`✅ Published to ${HOSTEL_CHANNEL}`);
            console.log(`✅ [cron-wishlist] Published to ${HOSTEL_CHANNEL}: ${prod.asin}`);
          } catch (err: any) {
            logs.push(`❌ Failed to publish to ${HOSTEL_CHANNEL}: ${err.message}`);
            console.error(`[cron-wishlist] Publish error (hostel):`, err.message);
          }
        } else {
          logs.push(`💤 Silent hours — deal saved but not posted.`);
          console.log(`💤 [cron-wishlist] Silent hours — skipping publish.`);
        }
      }
    }

    // =====================================================================
    // 📊 PRICE TRACKER WATCHLIST MONITORING (Product table with category = 'watchlist')
    // =====================================================================
    const watchlistProducts = await prisma.product.findMany({
      where: { category: 'watchlist' },
      include: { platform: true },
      orderBy: { lastScrapedAt: 'asc' },
      take: 10
    });

    if (watchlistProducts.length > 0) {
      logs.push(`📊 Tracing prices for ${watchlistProducts.length} Watchlist products...`);
      for (const wProd of watchlistProducts) {
        if (Date.now() - startTime > MAX_MS) {
          logs.push(`⏱️ Timeout guard hit during watchlist price tracing.`);
          break;
        }

        try {
          let latestPrice = 0;
          let originalPrice = wProd.mrp || 0;
          let imageUrl = wProd.imageUrl;
          let fetchedTitle = wProd.title;

          if (wProd.platform?.slug === 'amazon') {
            const details = await fetchAmazonDetails(wProd.externalId);
            if (details && details.currentPrice > 0) {
              latestPrice = details.currentPrice;
              originalPrice = details.originalPrice || wProd.mrp || latestPrice;
              if (details.imageUrl) imageUrl = details.imageUrl;
              if (details.title) fetchedTitle = details.title;
            }
          }

          if (latestPrice > 0) {
            // Touch lastScrapedAt
            await prisma.product.update({
              where: { id: wProd.id },
              data: {
                currentPrice: latestPrice,
                mrp: Math.max(originalPrice, wProd.mrp || 0, latestPrice),
                imageUrl: imageUrl || wProd.imageUrl,
                title: sanitizeTitle(fetchedTitle),
                lastScrapedAt: new Date()
              }
            });

            // Check price history
            const lastHistory = await prisma.priceHistory.findFirst({
              where: { productId: wProd.id },
              orderBy: { recordedAt: 'desc' }
            });

            if (!lastHistory || lastHistory.price !== latestPrice) {
              await prisma.priceHistory.create({
                data: {
                  productId: wProd.id,
                  price: latestPrice,
                  recordedAt: new Date()
                }
              });
              logs.push(`📈 [Watchlist] Recorded new price history for ${wProd.title.substring(0, 30)}...: ₹${latestPrice}`);
            }

            // Target price check
            const hasTargetPrice = wProd.targetPrice !== null && wProd.targetPrice > 0;
            const targetMet = hasTargetPrice ? latestPrice <= (wProd.targetPrice as number) : false;

            if (targetMet) {
              logs.push(`🎯 WATCHLIST TARGET MET: ${wProd.title} (₹${latestPrice} <= ₹${wProd.targetPrice})`);
              const affiliateUrl = getAffiliateUrl('amazon', wProd.url, wProd.externalId);
              const deal = await prisma.deal.create({
                data: {
                  productId: wProd.id,
                  platformId: wProd.platformId,
                  dealType: 'price_drop',
                  dealScore: 99,
                  dealPrice: latestPrice,
                  originalPrice: originalPrice || wProd.mrp || latestPrice,
                  discountPct: originalPrice > latestPrice ? Math.round(((originalPrice - latestPrice) / originalPrice) * 100) : 0,
                  affiliateUrl,
                  isGenuine: true,
                  isPublished: false
                }
              });

              if (!isSilent) {
                try {
                  await publishToTelegram(deal.id, HOSTEL_CHANNEL);
                  logs.push(`✅ Published watchlist alert to ${HOSTEL_CHANNEL}`);
                } catch (e: any) {
                  console.error('Failed to publish watchlist deal:', e.message);
                }
              }
            }
          }
        } catch (err: any) {
          console.error(`Failed tracing price for watchlist product ${wProd.id}:`, err.message);
        }
      }
    }

  } catch (err: any) {
    console.error('[cron-wishlist] Fatal error:', err.message);
    return NextResponse.json({ success: false, error: err.message, logs }, { status: 500 });
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`✅ [cron-wishlist] Done in ${elapsed}s. Checked: ${checked}, Triggered: ${triggered}, Skipped: ${skipped}`);

  return NextResponse.json({
    success: true,
    elapsed: `${elapsed}s`,
    checked,
    triggered,
    skipped,
    logs
  });
}
