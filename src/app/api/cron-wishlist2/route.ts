// =====================================================================
// 🔗 CUELINK WISHLIST CRON — Non-Amazon Price Drop Monitor
//
// This cron runs independently from the Amazon wishlist cron.
// It monitors Flipkart, Myntra, Ajio products in the CuelinkWishlist
// table and posts deals to @hosteldeals when prices drop.
//
// ⚠️  This file does NOT touch WishlistProduct (Amazon) in any way.
// ⚠️  This file does NOT modify stealth-scraper.ts or telegram.ts.
//
// SAFE TO MODIFY:
// - BATCH_SIZE, MAX_MS constants
// - Target discount thresholds
// =====================================================================

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds execution on Vercel
import prisma from '@/lib/prisma';
import { fetchProductDetails } from '@/lib/cuelink-scraper';
import { bot, sanitizeTitle, escapeMarkdown } from '@/lib/telegram';
import { getAffiliateUrlAsync } from '@/lib/affiliate';

const HOSTEL_CHANNEL = process.env.HOSTEL_CHANNEL || '@hosteldeals';
const MAIN_CHANNEL = process.env.TELEGRAM_CHANNEL || '@fantasticofffer';

const BATCH_SIZE = 10;
const MAX_MS = 50000; // 50s safety guard for Vercel 60s maxDuration

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
  console.log(`🔗 [cron-wishlist2] Starting. Silent: ${isSilent}`);

  let checked = 0;
  let triggered = 0;
  let skipped = 0;
  const logs: string[] = [];

  try {
    // Fetch oldest-checked batch of active cuelink wishlist items
    const batch = await prisma.cuelinkWishlist.findMany({
      where: { active: true },
      orderBy: { lastCheckedAt: 'asc' },
      take: BATCH_SIZE,
    });

    logs.push(`Checking batch of ${batch.length} Cuelink wishlist items`);
    console.log(`🔗 [cron-wishlist2] Checking ${batch.length} items.`);

    for (const prod of batch) {
      if (Date.now() - startTime > MAX_MS) {
        logs.push(`⏱️ Timeout after checking ${checked} items.`);
        break;
      }

      checked++;

      // Touch lastCheckedAt so it rotates to end of queue
      await prisma.cuelinkWishlist.update({
        where: { id: prod.id },
        data: { lastCheckedAt: new Date() },
      });

      // Scrape current price from product page
      const details = await fetchProductDetails(prod.productUrl);

      if (!details || details.currentPrice <= 0) {
        logs.push(`⚠️ ${prod.externalId}: Could not fetch price. Skipping.`);
        skipped++;
        continue;
      }

      const latestPrice = details.currentPrice;
      const originalPrice = details.originalPrice || prod.mrp || latestPrice;
      const latestDiscount = originalPrice > latestPrice
        ? Math.round(((originalPrice - latestPrice) / originalPrice) * 100)
        : 0;

      // Check if target is met
      let hasHitTarget = false;
      const hasCustomTargets = prod.targetPrice !== null || prod.targetDiscount !== null;

      if (hasCustomTargets) {
        const hitPrice = prod.targetPrice ? latestPrice <= prod.targetPrice : false;
        const hitDiscount = prod.targetDiscount ? latestDiscount >= prod.targetDiscount : false;
        hasHitTarget = hitPrice || hitDiscount;
        logs.push(`🔎 ${prod.externalId}: ₹${latestPrice} (${latestDiscount}% off) | Target: ₹${prod.targetPrice} OR ${prod.targetDiscount}% off`);
      } else {
        // Default: 5% price drop OR 50%+ discount
        const defaultTargetPrice = Math.round(prod.price * 0.95);
        hasHitTarget = latestPrice <= defaultTargetPrice || latestDiscount >= 50;
        logs.push(`🔎 ${prod.externalId}: ₹${latestPrice} (${latestDiscount}% off) | Default target: ₹${defaultTargetPrice} or 50% off`);
      }

      if (!hasHitTarget) continue;

      // 🎯 TARGET MET!
      logs.push(`🎯 TARGET MET: ${prod.title?.substring(0, 50)} — ₹${latestPrice} (${latestDiscount}% off) [${prod.platform}]`);
      console.log(`🎯 [cron-wishlist2] TARGET MET: ${prod.externalId} — ₹${latestPrice} (${latestDiscount}% off)`);

      triggered++;

      // Get Cuelinks affiliate URL
      const affiliateUrl = await getAffiliateUrlAsync(prod.platform, prod.productUrl, prod.externalId, HOSTEL_CHANNEL);

      // Mark as inactive so we don't re-trigger
      await prisma.cuelinkWishlist.update({
        where: { id: prod.id },
        data: { active: false, lastCheckedAt: new Date() },
      });

      // Create deal record in the main Deal table
      const dealPlatform = await prisma.platform.upsert({
        where: { slug: prod.platform },
        update: {},
        create: { name: prod.platform.charAt(0).toUpperCase() + prod.platform.slice(1), slug: prod.platform },
      });

      const product = await prisma.product.upsert({
        where: {
          platformId_externalId: {
            platformId: dealPlatform.id,
            externalId: prod.externalId,
          },
        },
        update: {
          title: sanitizeTitle(details.title || prod.title),
          currentPrice: latestPrice,
          imageUrl: details.imageUrl || prod.image,
          lastScrapedAt: new Date(),
        },
        create: {
          platformId: dealPlatform.id,
          externalId: prod.externalId,
          title: sanitizeTitle(details.title || prod.title),
          url: prod.productUrl,
          currentPrice: latestPrice,
          imageUrl: details.imageUrl || prod.image,
        },
      });

      const deal = await prisma.deal.create({
        data: {
          productId: product.id,
          platformId: dealPlatform.id,
          dealType: 'price_drop',
          dealScore: 95,
          dealPrice: latestPrice,
          originalPrice: originalPrice,
          discountPct: latestDiscount,
          affiliateUrl: affiliateUrl,
          isGenuine: true,
          isPublished: false,
        },
      });

      // Publish to both channels
      if (!isSilent && bot) {
        try {
          // Build caption
          const cleanTitle = sanitizeTitle(details.title || prod.title);
          const escapedTitle = escapeMarkdown(cleanTitle);
          let msg = `🔥 *${prod.platform.toUpperCase()} Deal!* 🔥\n\n`;
          msg += `*${escapedTitle}*\n\n`;
          if (latestPrice > 0 && originalPrice > latestPrice) {
            msg += `❌ MRP: ~₹${originalPrice.toLocaleString('en-IN')}~\n`;
            msg += `✅ *Deal Price: ₹${latestPrice.toLocaleString('en-IN')}* _(${latestDiscount}% OFF)_\n\n`;
          }
          msg += `👇 *Grab it now* 👇`;

          const imageUrl = details.imageUrl || prod.image;

          // Post to main channel
          if (imageUrl && imageUrl.startsWith('http')) {
            await bot.sendPhoto(MAIN_CHANNEL, imageUrl, {
              caption: msg,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '🛒 Buy Now', url: affiliateUrl }]] },
            });
          } else {
            await bot.sendMessage(MAIN_CHANNEL, msg, {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '🛒 Buy Now', url: affiliateUrl }]] },
            });
          }

          // Post to hostel channel
          if (imageUrl && imageUrl.startsWith('http')) {
            await bot.sendPhoto(HOSTEL_CHANNEL, imageUrl, {
              caption: msg,
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '🛒 Buy Now', url: affiliateUrl }]] },
            });
          } else {
            await bot.sendMessage(HOSTEL_CHANNEL, msg, {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '🛒 Buy Now', url: affiliateUrl }]] },
            });
          }

          await prisma.deal.update({
            where: { id: deal.id },
            data: { isPublished: true, publishedAt: new Date(), isPublishedHostel: true, publishedHostelAt: new Date() },
          });

          logs.push(`✅ Published to ${MAIN_CHANNEL} + ${HOSTEL_CHANNEL}`);
          console.log(`✅ [cron-wishlist2] Published: ${prod.externalId} to both channels`);
        } catch (err: any) {
          logs.push(`❌ Failed to publish: ${err.message}`);
          console.error(`[cron-wishlist2] Publish error:`, err.message);
        }
      } else {
        logs.push(`💤 Silent hours — deal saved but not posted.`);
      }
    }

  } catch (err: any) {
    console.error('[cron-wishlist2] Fatal error:', err.message);
    return NextResponse.json({ success: false, error: err.message, logs }, { status: 500 });
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`✅ [cron-wishlist2] Done in ${elapsed}s. Checked: ${checked}, Triggered: ${triggered}, Skipped: ${skipped}`);

  return NextResponse.json({
    success: true,
    elapsed: `${elapsed}s`,
    checked,
    triggered,
    skipped,
    logs,
  });
}
