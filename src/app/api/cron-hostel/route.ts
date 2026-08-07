// =====================================================================
// 🎓 HOSTEL CHANNEL CRON — Smart Student Deal Filter
//
// FIX LOG (Aug 2026):
// Problem: 500+ posts/day → users irritated
// Root cause: No daily cap + no category dedup + 3 posts/run × 180 runs/day
//
// FIXES APPLIED:
// 1. DAILY CAP: Max 15 posts/day to hostel channel (hard limit)
// 2. CATEGORY DEDUP: Same category not posted within 4 hours
//    e.g., if fan posted at 10 AM → no other fan until 2 PM
// 3. MAX 1 POST PER RUN (was 3)
// 4. COOLDOWN: 45 min between any two hostel posts
//
// RESULT: ~10-15 varied posts/day instead of 500+ spam
// =====================================================================

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { publishToTelegram } from '@/lib/telegram';
import { shouldPostToHostel, STUDENT_SCORE_THRESHOLD } from '@/lib/hostel-filter';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HOSTEL_CHANNEL = process.env.HOSTEL_CHANNEL || '@hosteldeals';

const BATCH_SIZE = 10;
const MAX_POSTS_PER_RUN = 1;            // ← Only 1 post per cron run (was 3)
const MAX_MS = 23000;
const HOSTEL_COOLDOWN_MIN = 45;         // ← 45 min between posts (was 20)
const MAX_HOSTEL_POSTS_PER_DAY = 15;    // ← Hard daily cap
const CATEGORY_COOLDOWN_HOURS = 4;      // ← Same category blocked for 4 hours

// =====================================================================
// CATEGORY DETECTION — Extracts product category from title
// Used to prevent posting 8 fans or 10 t-shirts in a row
// =====================================================================
function extractCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.match(/\bfan\b|table fan|ceiling fan|desk fan|portable fan|mini fan|cooler/)) return 'fans';
  if (t.match(/t[- ]?shirt|polo|half sleeve|full sleeve|round neck tee/)) return 'clothing_tshirt';
  if (t.match(/jeans|trouser|pant\b|chino/)) return 'clothing_bottoms';
  if (t.match(/smartwatch|smart watch|digital watch|analog watch|\bwatch\b|fitness band|smart band/)) return 'watches';
  if (t.match(/phone case|mobile case|back cover|back case|phone cover|tempered glass/)) return 'phone_accessories';
  if (t.match(/bracelet|bangle|necklace|chain|anklet|jewellery|jewelry|ring\b/)) return 'jewelry';
  if (t.match(/keychain|key chain|key ring/)) return 'keychains';
  if (t.match(/resistance band|yoga band|exercise band|loop band|workout band|gym band/)) return 'fitness_bands';
  if (t.match(/mosquito|electric bat|racket bat|insect killer/)) return 'mosquito_control';
  if (t.match(/kettle|electric kettle/)) return 'kettles';
  if (t.match(/backpack|laptop bag|school bag|college bag/)) return 'bags';
  if (t.match(/earphone|earbuds|headphone|headset|neckband/)) return 'earphones';
  if (t.match(/charger|power bank|charging cable|usb cable/)) return 'chargers';
  if (t.match(/pen\b|pencil|notebook|diary|highlighter|marker/)) return 'stationery';
  if (t.match(/towel/)) return 'towels';
  if (t.match(/shoes|sneaker|boot\b|sport shoe/)) return 'footwear';
  if (t.match(/slipper|chappal|sandal|flip flop/)) return 'footwear_casual';
  if (t.match(/curtain|blind\b/)) return 'curtains';
  if (t.match(/iron\b|steam iron/)) return 'iron';
  if (t.match(/umbrella|raincoat/)) return 'umbrella';
  if (t.match(/whiteboard|blackboard|chalk board|notice board/)) return 'boards';
  if (t.match(/wallet|card holder|purse/)) return 'wallets';
  if (t.match(/mug|cup\b|thermos|flask\b|bottle\b|sipper/)) return 'bottles';
  if (t.match(/clock\b|alarm|wall clock/)) return 'clocks';
  if (t.match(/light\b|lamp\b|led strip|fairy light|string light/)) return 'lights';
  if (t.match(/mouse\b|keyboard|usb hub|adapter\b|hdmi/)) return 'computer_accessories';
  if (t.match(/shampoo|conditioner|serum|face wash|moisturizer|sunscreen/)) return 'skincare';
  if (t.match(/deodorant|perfume|body spray/)) return 'fragrance';
  if (t.match(/protein|supplement|multivitamin/)) return 'supplements';
  return 'general';
}

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

function getTodayMidnightIST(): Date {
  const now = new Date();
  const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istString);
  istDate.setHours(0, 0, 0, 0);
  // Convert back to UTC (IST = UTC+5:30)
  return new Date(istDate.getTime() - (5.5 * 60 * 60 * 1000));
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
  console.log(`🎓 [cron-hostel] Starting. Silent: ${isSilent}`);

  let processed = 0;
  let forwarded = 0;
  let skipped = 0;
  const logs: string[] = [];

  try {
    // =========================================================
    // GUARD 1: Daily cap check
    // If hostel channel already got MAX_HOSTEL_POSTS_PER_DAY
    // deals today → stop immediately, no more posts today.
    // =========================================================
    const todayMidnight = getTodayMidnightIST();
    const hostelTodayCount = await prisma.deal.count({
      where: {
        isPublishedHostel: true,
        publishedHostelAt: { gte: todayMidnight },
      },
    });

    logs.push(`Today's hostel posts: ${hostelTodayCount}/${MAX_HOSTEL_POSTS_PER_DAY}`);

    if (hostelTodayCount >= MAX_HOSTEL_POSTS_PER_DAY) {
      console.log(`🛑 [cron-hostel] Daily cap reached: ${hostelTodayCount}/${MAX_HOSTEL_POSTS_PER_DAY}`);
      return NextResponse.json({
        success: true,
        message: `Daily hostel cap reached (${hostelTodayCount}/${MAX_HOSTEL_POSTS_PER_DAY}). Come back tomorrow!`,
        hostelTodayCount,
        logs,
      });
    }

    // =========================================================
    // GUARD 2: Category dedup — what categories posted recently?
    // Don't allow same category within CATEGORY_COOLDOWN_HOURS
    // =========================================================
    const categoryWindowStart = new Date(Date.now() - CATEGORY_COOLDOWN_HOURS * 60 * 60 * 1000);
    const recentHostelDeals = await prisma.deal.findMany({
      where: {
        isPublishedHostel: true,
        publishedHostelAt: { gte: categoryWindowStart },
      },
      select: { product: { select: { title: true } } },
    });

    const recentCategories = new Set(
      recentHostelDeals
        .map(d => extractCategory(d.product?.title || ''))
        .filter(cat => cat !== 'general') // 'general' is too broad to block
    );

    logs.push(`Categories blocked (posted in last ${CATEGORY_COOLDOWN_HOURS}h): [${[...recentCategories].join(', ')}]`);
    console.log(`🎓 [cron-hostel] Blocked categories: ${[...recentCategories].join(', ')}`);

    // =========================================================
    // DUAL PIPELINE: Get deals from main + queue
    // =========================================================
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

    const mainChannelDeals = await prisma.deal.findMany({
      where: {
        isPublished: true,
        isPublishedHostel: false,
        createdAt: { gte: seventyTwoHoursAgo },
      },
      include: { product: true, platform: true },
      orderBy: { dealScore: 'desc' },
      take: BATCH_SIZE,
    });

    const directDeals = await prisma.deal.findMany({
      where: {
        isPublished: false,
        isPublishedHostel: false,
        affiliateUrl: { not: null },
        createdAt: { gte: seventyTwoHoursAgo },
      },
      include: { product: true, platform: true },
      orderBy: { dealScore: 'desc' },
      take: BATCH_SIZE,
    });

    const seenIds = new Set<string>();
    const pendingDeals = [...mainChannelDeals, ...directDeals]
      .filter(d => {
        if (seenIds.has(d.id)) return false;
        seenIds.add(d.id);
        return true;
      })
      .sort((a, b) => b.dealScore - a.dealScore)
      .slice(0, BATCH_SIZE);

    logs.push(`Pipeline A: ${mainChannelDeals.length} | Pipeline B: ${directDeals.length} | Evaluating: ${pendingDeals.length}`);

    // =========================================================
    // GUARD 3: Cooldown between posts
    // =========================================================
    const lastHostelPost = await prisma.deal.findFirst({
      where: { isPublishedHostel: true, publishedHostelAt: { not: null } },
      orderBy: { publishedHostelAt: 'desc' },
    });
    const minsSinceLastHostelPost = lastHostelPost?.publishedHostelAt
      ? (Date.now() - new Date(lastHostelPost.publishedHostelAt).getTime()) / (1000 * 60)
      : 999;

    logs.push(`Mins since last hostel post: ${Math.round(minsSinceLastHostelPost)} (cooldown: ${HOSTEL_COOLDOWN_MIN}min)`);

    if (!isSilent && minsSinceLastHostelPost < HOSTEL_COOLDOWN_MIN) {
      console.log(`⏳ [cron-hostel] Cooldown active. ${Math.round(HOSTEL_COOLDOWN_MIN - minsSinceLastHostelPost)} min remaining.`);
      return NextResponse.json({
        success: true,
        message: `Cooldown: ${Math.round(HOSTEL_COOLDOWN_MIN - minsSinceLastHostelPost)} min remaining.`,
        logs,
      });
    }

    // =========================================================
    // MAIN LOOP: Evaluate and post deals
    // =========================================================
    for (const deal of pendingDeals) {
      if (Date.now() - startTime > MAX_MS) {
        logs.push(`⏱️ Timeout after ${processed} deals.`);
        break;
      }

      processed++;

      const title = deal.product?.title || '';
      const price = deal.dealPrice || 0;
      const originalPrice = deal.originalPrice || price;
      const discountPct = deal.discountPct || 0;
      const platform = deal.platform?.slug || 'amazon';

      // Student filter check
      const filterResult = shouldPostToHostel({ title, price, originalPrice, discountPct, platform });

      await prisma.deal.update({
        where: { id: deal.id },
        data: { studentScore: filterResult.score },
      });

      if (!filterResult.shouldPost) {
        skipped++;
        logs.push(`⏭️ Skipped (score ${filterResult.score}): "${title.substring(0, 40)}"`);
        await prisma.deal.update({
          where: { id: deal.id },
          data: { isPublishedHostel: true }, // Mark done so we don't re-evaluate
        });
        continue;
      }

      // ── CATEGORY DEDUP CHECK ──────────────────────────────────
      const dealCategory = extractCategory(title);
      if (dealCategory !== 'general' && recentCategories.has(dealCategory)) {
        logs.push(`🚫 Category repeat blocked [${dealCategory}]: "${title.substring(0, 40)}"`);
        skipped++;
        // Don't mark isPublishedHostel = true here!
        // Keep it queued → next run (4h later) it won't be blocked anymore
        continue;
      }
      // ─────────────────────────────────────────────────────────

      logs.push(`✅ Qualified (score ${filterResult.score}, cat:${dealCategory}): "${title.substring(0, 40)}"`);

      if (!isSilent) {
        if (forwarded >= MAX_POSTS_PER_RUN) {
          logs.push(`⏳ Run limit (${MAX_POSTS_PER_RUN}) reached. Queued for next run.`);
          break;
        }

        try {
          await publishToTelegram(deal.id, HOSTEL_CHANNEL);

          await prisma.deal.update({
            where: { id: deal.id },
            data: { isPublishedHostel: true, publishedHostelAt: new Date() },
          });

          forwarded++;
          // Add this category to blocked set for THIS run
          if (dealCategory !== 'general') recentCategories.add(dealCategory);

          logs.push(`📤 Posted: "${title.substring(0, 40)}" [${dealCategory}]`);
          console.log(`✅ [cron-hostel] Posted: "${title.substring(0, 50)}" [${dealCategory}]`);
        } catch (err: any) {
          logs.push(`❌ Post failed: ${err.message}`);
          console.error(`[cron-hostel] Post error:`, err.message);
        }
      } else {
        logs.push(`💤 Silent hours — qualified deal kept for morning.`);
      }
    }

  } catch (err: any) {
    console.error('[cron-hostel] Fatal error:', err.message);
    return NextResponse.json({ success: false, error: err.message, logs }, { status: 500 });
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`✅ [cron-hostel] Done in ${elapsed}s. Processed:${processed} Posted:${forwarded} Skipped:${skipped}`);

  return NextResponse.json({ success: true, elapsed: `${elapsed}s`, processed, forwarded, skipped, hostelTodayCount: 0, logs });
}
