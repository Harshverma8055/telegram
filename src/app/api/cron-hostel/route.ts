// =====================================================================
// 🎓 HOSTEL CHANNEL CRON — Independent Student Deal Filter
//
// This cron runs independently from the main cron.
// It reads deals already saved to the database by the main cron,
// scores them using the Smart Student Filter, and posts qualified
// ones to @hosteldeals.
//
// ⚠️  This file does NOT scrape Amazon or any external site.
// It only reads from our own database and applies the filter.
//
// SAFE TO MODIFY:
// - The number of deals processed per run (BATCH_SIZE)
// - The minimum score threshold (imported from hostel-filter.ts)
//
// DO NOT MODIFY:
// - The import from stealth-scraper.ts (not used here, but don't add it)
// - The publishToTelegram function call pattern
// =====================================================================

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { publishToTelegram } from '@/lib/telegram';
import { shouldPostToHostel, STUDENT_SCORE_THRESHOLD } from '@/lib/hostel-filter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds execution on Vercel

const HOSTEL_CHANNEL = process.env.HOSTEL_CHANNEL || '@hosteldeals';

// Process up to 20 deals per run
const BATCH_SIZE = 20;
const MAX_POSTS_PER_RUN = 3; // Post up to 3 deals per run (increased for hostel channel growth)
const MAX_MS = 50000; // 50 seconds safety guard (well within 60s maxDuration)
const HOSTEL_COOLDOWN_MIN = 20; // Min 20 min between hostel posts to prevent spam

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
  console.log(`🎓 [cron-hostel] Starting. Silent: ${isSilent}`);

  let processed = 0;
  let forwarded = 0;
  let skipped = 0;
  const logs: string[] = [];

  try {
    // =========================================================
    // 🔍 DUAL PIPELINE: Hostel gets deals from TWO sources
    //
    // Pipeline A: Deals already published to main channel ✅
    // Pipeline B: Deals QUEUED but not yet on main channel ✅ NEW
    //
    // WHY: Main channel can be slow (Vercel CPU limits, 45-min
    // cooldown). Previously hostel got ZERO deals during those
    // slow periods. Now hostel is fully independent.
    // =========================================================

    // Use a wide 72-hour window so no deals are missed
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

    // Pipeline A: Deals published to main channel, not yet sent to hostel
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

    // Pipeline B: Deals queued (not published to main yet) — direct to hostel
    // These are deals saved by the main scraper but waiting for 45-min cooldown
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

    // Merge both pipelines, deduplicate by ID, sort by score
    const seenIds = new Set<string>();
    const pendingDeals = [...mainChannelDeals, ...directDeals]
      .filter(d => {
        if (seenIds.has(d.id)) return false;
        seenIds.add(d.id);
        return true;
      })
      .sort((a, b) => b.dealScore - a.dealScore)
      .slice(0, BATCH_SIZE);

    logs.push(`Pipeline A (main channel): ${mainChannelDeals.length} deals`);
    logs.push(`Pipeline B (direct/queued): ${directDeals.length} deals`);
    logs.push(`Total to evaluate: ${pendingDeals.length} deals`);
    console.log(`🎓 [cron-hostel] A=${mainChannelDeals.length} B=${directDeals.length} Total=${pendingDeals.length}`);

    // Check time since last hostel post (to enforce cooldown between hostel posts)
    const lastHostelPost = await prisma.deal.findFirst({
      where: { isPublishedHostel: true, publishedHostelAt: { not: null } },
      orderBy: { publishedHostelAt: 'desc' },
    });
    const minsSinceLastHostelPost = lastHostelPost?.publishedHostelAt
      ? (Date.now() - new Date(lastHostelPost.publishedHostelAt).getTime()) / (1000 * 60)
      : 999;

    logs.push(`Time since last hostel post: ${Math.round(minsSinceLastHostelPost)} min`);

    for (const deal of pendingDeals) {
      // Timeout guard
      if (Date.now() - startTime > MAX_MS) {
        logs.push(`⏱️ Timeout after processing ${processed} deals.`);
        break;
      }

      processed++;

      const title = deal.product?.title || '';
      const price = deal.dealPrice || 0;
      const originalPrice = deal.originalPrice || price;
      const discountPct = deal.discountPct || 0;
      const platform = deal.platform?.slug || 'amazon';

      // Run through the Smart Student Filter
      const filterResult = shouldPostToHostel({
        title,
        price,
        originalPrice,
        discountPct,
        platform,
      });

      // Save the student score for analytics
      await prisma.deal.update({
        where: { id: deal.id },
        data: { studentScore: filterResult.score },
      });

      if (!filterResult.shouldPost) {
        skipped++;
        logs.push(`⏭️ Skipped: "${title.substring(0, 40)}" (score: ${filterResult.score} < ${STUDENT_SCORE_THRESHOLD})`);

        // Mark as hostel-processed so we don't re-evaluate next run
        await prisma.deal.update({
          where: { id: deal.id },
          data: { isPublishedHostel: true },
        });
        continue;
      }

      // 🎯 QUALIFIED FOR HOSTEL CHANNEL!
      logs.push(`✅ Qualified: "${title.substring(0, 40)}" (score: ${filterResult.score} ${filterResult.dealTag} ${filterResult.category})`);
      console.log(`🎓 [cron-hostel] QUALIFIED: score=${filterResult.score} "${title.substring(0, 50)}"`);

      if (!isSilent) {
        if (forwarded >= MAX_POSTS_PER_RUN) {
          logs.push(`⏳ Post limit (${MAX_POSTS_PER_RUN}) reached. "${title.substring(0, 40)}" stays queued.`);
          continue;
        }

        // Hostel cooldown: don't post if last hostel post was < 20 min ago
        const currentMinsSinceLast = lastHostelPost?.publishedHostelAt
          ? (Date.now() - new Date(lastHostelPost.publishedHostelAt).getTime()) / (1000 * 60) - (forwarded * HOSTEL_COOLDOWN_MIN)
          : 999;

        if (forwarded > 0 && currentMinsSinceLast < HOSTEL_COOLDOWN_MIN) {
          logs.push(`⏳ Hostel cooldown active. "${title.substring(0, 40)}" will post next run.`);
          continue;
        }

        try {
          await publishToTelegram(deal.id, HOSTEL_CHANNEL);

          await prisma.deal.update({
            where: { id: deal.id },
            data: {
              isPublishedHostel: true,
              publishedHostelAt: new Date(),
            },
          });

          forwarded++;
          logs.push(`📤 Posted to ${HOSTEL_CHANNEL}: "${title.substring(0, 40)}"`);
          console.log(`✅ [cron-hostel] Posted to ${HOSTEL_CHANNEL}: "${title.substring(0, 40)}"`);
        } catch (err: any) {
          logs.push(`❌ Failed to post: ${err.message}`);
          console.error(`[cron-hostel] Post error:`, err.message);
        }
      } else {
        // During silent hours, leave isPublishedHostel = false so morning cron posts them!
        logs.push(`💤 Silent hours — deal qualified, keeping queued for morning posting.`);
      }
    }

  } catch (err: any) {
    console.error('[cron-hostel] Fatal error:', err.message);
    return NextResponse.json({ success: false, error: err.message, logs }, { status: 500 });
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`✅ [cron-hostel] Done in ${elapsed}s. Processed: ${processed}, Forwarded: ${forwarded}, Skipped: ${skipped}`);

  return NextResponse.json({
    success: true,
    elapsed: `${elapsed}s`,
    processed,
    forwarded,
    skipped,
    threshold: STUDENT_SCORE_THRESHOLD,
    logs,
  });
}
