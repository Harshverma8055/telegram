// =====================================================================
// 🎓 HOSTEL SHOWCASE CRON — Daily Student Essential Rotation
//
// This cron is DIFFERENT from cron-wishlist.
// Respects the same 15/day daily cap as cron-hostel.
//
// cron-wishlist   = Waits for price DROP target to be met → then posts
// cron-showcase   = Posts wishlist products DAILY regardless of price
//                   → Awareness posts → Student sees it → Buys from link
//
// WHY THIS EXISTS:
// Most wishlist products never hit their target discount.
// But students still NEED those products (umbrella, iron, slippers etc).
// By posting them daily with current price + affiliate link, we:
// 1. Keep hostel channel active with relevant content
// 2. Trigger buying intent (student: "oh I needed this!")
// 3. Earn affiliate commission on every click → buy (no discount needed)
//
// SCHEDULE (configure on cron-job.org):
// - 9:00 AM IST  → 1st showcase of the day
// - 2:00 PM IST  → 2nd showcase of the day
// - 7:00 PM IST  → 3rd showcase of the day
//
// Each run posts 1 product. That's 3 unique products per day.
// Rotation ensures all wishlist products cycle through over time.
// =====================================================================

import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Showcase is fast — no Amazon scraping
import prisma from '@/lib/prisma';
import { bot, sanitizeTitle, escapeMarkdown } from '@/lib/telegram';
import { getAffiliateUrl } from '@/lib/affiliate';

const HOSTEL_CHANNEL = process.env.HOSTEL_CHANNEL || '@hosteldeals';

// How many products to showcase per run
const SHOWCASE_PER_RUN = 1;

// Don't showcase the same product more than once every 7 days
const SHOWCASE_COOLDOWN_DAYS = 7;

// Max hostel posts per day (shared limit with cron-hostel)
const MAX_HOSTEL_POSTS_PER_DAY = 15;

function getTodayMidnightIST(): Date {
  const now = new Date();
  const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istString);
  istDate.setHours(0, 0, 0, 0);
  return new Date(istDate.getTime() - (5.5 * 60 * 60 * 1000));
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

// Category emojis to make posts look nicer
function getCategoryEmoji(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('umbrella') || lower.includes('raincoat')) return '☂️';
  if (lower.includes('iron') || lower.includes('press')) return '👕';
  if (lower.includes('slipper') || lower.includes('chappal') || lower.includes('sandal')) return '🩴';
  if (lower.includes('laptop') || lower.includes('bag') || lower.includes('backpack')) return '🎒';
  if (lower.includes('towel')) return '🛁';
  if (lower.includes('curtain')) return '🪟';
  if (lower.includes('shoes') || lower.includes('sneaker')) return '👟';
  if (lower.includes('bottle') || lower.includes('flask')) return '🍶';
  if (lower.includes('earphone') || lower.includes('earbuds') || lower.includes('headphone')) return '🎧';
  if (lower.includes('charger') || lower.includes('power bank')) return '🔋';
  if (lower.includes('pen') || lower.includes('notebook') || lower.includes('diary')) return '📒';
  if (lower.includes('lock') || lower.includes('padlock')) return '🔒';
  if (lower.includes('mirror')) return '🪞';
  if (lower.includes('fan')) return '💨';
  if (lower.includes('lamp') || lower.includes('light')) return '💡';
  if (lower.includes('yoga') || lower.includes('mat')) return '🧘';
  if (lower.includes('gym') || lower.includes('dumbbell')) return '🏋️';
  if (lower.includes('shampoo') || lower.includes('soap') || lower.includes('sanitizer')) return '🧴';
  if (lower.includes('watch')) return '⌚';
  return '🛒';
}

// Student benefit lines per category to make posts feel genuine
function getStudentBenefitLine(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('umbrella') || lower.includes('raincoat')) return 'Monsoon season mein hostel students ke liye must-have! ☔';
  if (lower.includes('iron') || lower.includes('press')) return 'College mein neat & pressed kapde ke liye zaruri! 👔';
  if (lower.includes('slipper') || lower.includes('chappal')) return 'Hostel bathroom aur common area ke liye perfect! 🚿';
  if (lower.includes('laptop bag') || lower.includes('backpack')) return 'College + laptop saath le jaane ke liye ideal! 💻';
  if (lower.includes('towel')) return 'Hostel mein apna towel rakho — hygiene first! 🧼';
  if (lower.includes('curtain')) return 'Room privacy aur better sleep ke liye helpful! 😴';
  if (lower.includes('shoes')) return 'Campus pe daily wear ke liye comfortable option! 🏫';
  if (lower.includes('bottle') || lower.includes('flask')) return 'Hot/cold drinks ke liye — hostel life saver! ☕';
  if (lower.includes('earphone') || lower.includes('earbuds')) return 'Study, music, calls — sab kuch ek product mein! 📚';
  if (lower.includes('charger') || lower.includes('power bank')) return 'Low battery? Never again during class! ⚡';
  if (lower.includes('lock')) return 'Room/almirah security ke liye essential! 🔐';
  if (lower.includes('fan')) return 'Summer mein hostel room thanda rakhne ke liye! 🌡️';
  return 'Hostel life ke liye useful product — check karo! 🎓';
}

export async function GET(request: Request) {
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
  if (isSilent) {
    return NextResponse.json({ success: true, message: 'Silent hours — showcase skipped.' });
  }

  console.log(`🎓 [cron-showcase] Starting daily showcase...`);
  const logs: string[] = [];
  let posted = 0;

  try {
    // ── DAILY CAP: Check total hostel posts today ──────────────
    const todayMidnight = getTodayMidnightIST();
    const hostelTodayCount = await prisma.$queryRawUnsafe<{count: bigint}[]>(
      `SELECT COUNT(*) as count FROM "Deal" WHERE "isPublishedHostel" = true AND "publishedHostelAt" >= $1`,
      todayMidnight
    );
    const todayCount = Number(hostelTodayCount[0]?.count ?? 0);
    logs.push(`Today hostel posts: ${todayCount}/${MAX_HOSTEL_POSTS_PER_DAY}`);

    if (todayCount >= MAX_HOSTEL_POSTS_PER_DAY) {
      return NextResponse.json({
        success: true,
        message: `Daily cap reached (${todayCount}/${MAX_HOSTEL_POSTS_PER_DAY}). Showcase skipped.`,
        logs,
      });
    }
    // ──────────────────────────────────────────────────────────

    // ── SHARED COOLDOWN: Same 45-min rule as cron-hostel ──────
    // Both crons write to hostel channel. If cron-hostel just posted,
    // showcase must wait too — otherwise 3 posts land in 1 minute.
    const HOSTEL_COOLDOWN_MIN = 45;
    const lastHostelPost = await prisma.deal.findFirst({
      where: { isPublishedHostel: true, publishedHostelAt: { not: null } },
      orderBy: { publishedHostelAt: 'desc' },
    });
    const minsSinceLastPost = lastHostelPost?.publishedHostelAt
      ? (Date.now() - new Date(lastHostelPost.publishedHostelAt).getTime()) / (1000 * 60)
      : 999;

    if (minsSinceLastPost < HOSTEL_COOLDOWN_MIN) {
      const waitMin = Math.ceil(HOSTEL_COOLDOWN_MIN - minsSinceLastPost);
      logs.push(`⏳ Hostel cooldown active — ${waitMin} min remaining. Showcase skipped.`);
      return NextResponse.json({ success: true, message: `Cooldown: wait ${waitMin} more minutes.`, logs });
    }
    // ──────────────────────────────────────────────────────────

    // Pick the wishlist products that haven't been showcased in the longest time.
    // We use last_updated ASC — the oldest-checked items are showcased first.
    // After showcasing, we update last_updated so they rotate to end of queue.
    const cooldownDate = new Date(Date.now() - SHOWCASE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

    const showcaseCandidates = await prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM "WishlistProduct"
      WHERE "wishlist" = true
        AND ("last_updated" IS NULL OR "last_updated" < $1)
      ORDER BY "last_updated" ASC NULLS FIRST
      LIMIT ${SHOWCASE_PER_RUN * 5}
    `, cooldownDate);

    if (showcaseCandidates.length === 0) {
      // All products showcased recently — use absolute oldest regardless of cooldown
      const fallback = await prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "WishlistProduct"
        WHERE "wishlist" = true
        ORDER BY "last_updated" ASC NULLS FIRST
        LIMIT ${SHOWCASE_PER_RUN}
      `);
      showcaseCandidates.push(...fallback);
      logs.push('All products within cooldown — using oldest product as fallback.');
    }

    logs.push(`Found ${showcaseCandidates.length} candidates for showcase.`);

    // Post up to SHOWCASE_PER_RUN products
    for (const prod of showcaseCandidates.slice(0, SHOWCASE_PER_RUN)) {
      const title = prod.title || 'Student Essential Product';
      const cleanTitle = sanitizeTitle(title);
      const escapedTitle = escapeMarkdown(cleanTitle.substring(0, 200));
      const price = prod.price || 0;
      const affiliateUrl = getAffiliateUrl('amazon', prod.amazon_url, prod.asin);
      const emoji = getCategoryEmoji(title);
      const benefitLine = getStudentBenefitLine(title);

      // Build a natural-looking showcase message (NOT a fake "deal" post)
      let msg = `${emoji} *Hostel Essential Pick!* ${emoji}\n\n`;
      msg += `*${escapedTitle}*\n\n`;
      msg += `💡 ${benefitLine}\n\n`;
      if (price > 0) {
        msg += `💰 Amazon par available — price check karo!\n`;
      }
      msg += `\n👇 *Tap below to check price & buy*`;

      const imageUrl = prod.image;
      const keyboard = {
        inline_keyboard: [[{
          text: '🛒 Check Price on Amazon',
          url: affiliateUrl
        }]]
      };

      try {
        if (bot) {
          if (imageUrl && imageUrl.startsWith('http')) {
            await bot.sendPhoto(HOSTEL_CHANNEL, imageUrl, {
              caption: msg,
              parse_mode: 'Markdown',
              reply_markup: keyboard
            });
          } else {
            await bot.sendMessage(HOSTEL_CHANNEL, msg, {
              parse_mode: 'Markdown',
              reply_markup: keyboard
            });
          }

          posted++;
          logs.push(`✅ Showcased: "${cleanTitle.substring(0, 50)}" (ASIN: ${prod.asin})`);
          console.log(`✅ [cron-showcase] Posted: "${cleanTitle.substring(0, 40)}"`);
        } else {
          logs.push(`[SIMULATION] Would post: "${cleanTitle.substring(0, 50)}"`);
        }

        // Update last_updated so this product rotates to end of queue
        await prisma.$executeRawUnsafe(
          `UPDATE "WishlistProduct" SET "last_updated" = NOW() WHERE "id" = $1`,
          prod.id
        );

      } catch (err: any) {
        logs.push(`❌ Failed to showcase ${prod.asin}: ${err.message}`);
        console.error(`[cron-showcase] Error:`, err.message);
      }
    }

  } catch (err: any) {
    console.error('[cron-showcase] Fatal error:', err.message);
    return NextResponse.json({ success: false, error: err.message, logs }, { status: 500 });
  }

  console.log(`✅ [cron-showcase] Done. Posted: ${posted}`);
  return NextResponse.json({ success: true, posted, logs });
}
