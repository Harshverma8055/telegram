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
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { publishToTelegram } from '@/lib/telegram';
import { shouldPostToHostel, STUDENT_SCORE_THRESHOLD } from '@/lib/hostel-filter';

const HOSTEL_CHANNEL = process.env.HOSTEL_CHANNEL || '@hosteldeals';

// Process up to 8 deals per run (these are just DB reads + Telegram sends, very fast)
const BATCH_SIZE = 15;
const MAX_MS = 9000;

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
    // Find deals that:
    // 1. Were published to main channel (isPublished = true)
    // 2. NOT yet sent to hostel channel (isPublishedHostel = false)
    // 3. Created in the last 24 hours (wide window to handle infrequent cron runs)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pendingDeals = await prisma.deal.findMany({
      where: {
        isPublished: true,
        isPublishedHostel: false,
        createdAt: { gte: twentyFourHoursAgo },
      },
      include: {
        product: true,
        platform: true,
      },
      orderBy: { dealScore: 'desc' },
      take: BATCH_SIZE,
    });

    logs.push(`Found ${pendingDeals.length} unprocessed deals from main channel`);
    console.log(`🎓 [cron-hostel] Found ${pendingDeals.length} deals to filter.`);

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
        logs.push(`⏭️ Skipped: "${title.substring(0, 40)}" (score: ${filterResult.score}, threshold: ${STUDENT_SCORE_THRESHOLD})`);
        
        // Mark as processed so we don't check it again
        await prisma.deal.update({
          where: { id: deal.id },
          data: { isPublishedHostel: true }, // mark as "processed" even if not posted
        });
        continue;
      }

      // 🎯 QUALIFIED FOR HOSTEL CHANNEL!
      logs.push(`✅ Qualified: "${title.substring(0, 40)}" (score: ${filterResult.score} ${filterResult.dealTag} ${filterResult.category})`);
      console.log(`🎓 [cron-hostel] QUALIFIED: score=${filterResult.score} "${title.substring(0, 50)}"`);

      if (!isSilent) {
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
          logs.push(`📤 Posted to ${HOSTEL_CHANNEL}`);
          console.log(`✅ [cron-hostel] Posted to ${HOSTEL_CHANNEL}: "${title.substring(0, 40)}"`);
        } catch (err: any) {
          logs.push(`❌ Failed to post: ${err.message}`);
          console.error(`[cron-hostel] Post error:`, err.message);
        }
      } else {
        // During silent hours, mark as processed but don't post
        await prisma.deal.update({
          where: { id: deal.id },
          data: { isPublishedHostel: true },
        });
        logs.push(`💤 Silent hours — deal qualified but not posted.`);
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
