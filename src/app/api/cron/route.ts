import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { fetchTelegramDeals, fetchAmazonDetails, resolveDealUrl, fetchPageMetadata, scrapeAmazonDealsPage } from '@/lib/scrapers/rss';
import { publishToTelegram, sanitizeTitle, bot, escapeMarkdown } from '@/lib/telegram';
import { getAffiliateUrl } from '@/lib/affiliate';

const COMPETITOR_CHANNELS = [
  'amazinglootsdealsoffers',
  'lootdealsk_Alibaba_dc_DealDost',
  'LOOTS_DEAL_OFFER_ONLINE_SHOPPING',
  'TrickXpert'
];
const TELEGRAM_CHANNEL = process.env.TELEGRAM_CHANNEL || '@fantasticofffer';
const HOSTEL_CHANNEL = process.env.HOSTEL_CHANNEL || '';

const SUPER_PRIORITY_KEYWORDS = [
  'bag', 'luggage', 'suitcase', 'duffel', 'backpack', 'tote', 'handbag', 'purse',
  'shoes', 'sneakers', 'sandal', 'slipper', 'crocs', 'heel', 'boot',
  'watch', 'perfume', 'deodorant', 'deo', 'spray', 'lipstick', 'makeup', 'eyeliner',
  'kajal', 'cream', 'moisturizer', 'sunscreen', 'face wash', 'scrub', 'shampoo',
  'conditioner', 'hair oil', 'serum', 'lotion', 'jewelry', 'jewellery', 'necklace',
  'ring', 'earring', 'bracelet', 'bangle', 'gold', 'silver', 'lipstick', 'skincare'
];

const COLLEGE_ESSENTIALS_KEYWORDS = [
  'umbrella', 'raincoat', 'rain coat', 'bottle', 'flask', 'lunch box', 'lunchbox',
  'pen', 'pencil', 'notebook', 'register', 'diary', 'calculator', 'marker', 'highlighter',
  'laptop sleeve', 'laptop bag', 'mouse', 'keyboard', 'headphone', 'earbuds', 'earphone',
  'powerbank', 'power bank', 'charger', 'sports', 'cricket', 'badminton', 'football',
  'basketball', 'racket', 'shuttle', 'gym', 'dumbbells', 't-shirt', 'tshirt', 'jeans',
  'hoodie', 'jacket', 'socks', 'card holder', 'wallet'
];

const LOW_PRIORITY_KEYWORDS = [
  'ac', 'air conditioner', 'refrigerator', 'fridge', 'tv', 'television', 'washing machine',
  'geyser', 'microwave', 'oven', 'chimney', 'dishwasher', 'furniture', 'sofa', 'mattress'
];

function isToysDeal(title: string): boolean {
  const lower = title.toLowerCase();
  const regex = /\b(toys?|dolls?|barbie|play-?doh|action figures?|rattles?|teethers?|baby walkers?|soft toys?|plushies?|stuffed animals?|stuffed toys?|slime kits?|nerf guns?|legos?)\b/i;
  return regex.test(lower);
}

function calculatePriorityScore(title: string): number {
  let score = 0;
  const lower = title.toLowerCase();

  for (const kw of SUPER_PRIORITY_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 40;
      break;
    }
  }

  for (const kw of COLLEGE_ESSENTIALS_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 30;
      break;
    }
  }

  for (const kw of LOW_PRIORITY_KEYWORDS) {
    if (lower.includes(kw)) {
      score -= 20;
      break;
    }
  }

  return score;
}

function isSilentHoursIST(): boolean {
  const now = new Date();
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istString);
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  
  // Silent between 11:30 PM (23:30) and 7:00 AM
  if (hours === 23 && minutes >= 30) return true;
  if (hours < 7) return true;
  return false;
}

// Vercel Cron routes must be a GET request
export async function GET(request: Request) {
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

  console.log('📡 Starting Vercel Cron: Deal Scraper...');

  const isSilent = isSilentHoursIST();

  // 0. DRAIN QUEUE (Publish saved deals from silent hours if we are in active hours and spaced out)
  if (!isSilent) {
    try {
      const lastPublishedDeal = await prisma.deal.findFirst({
        where: { isPublished: true },
        orderBy: { publishedAt: 'desc' }
      });

      let timeSinceLastPostMin = 999;
      if (lastPublishedDeal && lastPublishedDeal.publishedAt) {
        timeSinceLastPostMin = (Date.now() - new Date(lastPublishedDeal.publishedAt).getTime()) / (1000 * 60);
      }

      // If we haven't posted in the last 15 minutes, fetch the highest score pending deal from the last 12 hours
      if (timeSinceLastPostMin >= 15) {
        const pendingDeal = await prisma.deal.findFirst({
          where: {
            isPublished: false,
            affiliateUrl: { not: null },
            createdAt: {
              gte: new Date(Date.now() - 12 * 60 * 60 * 1000)
            }
          },
          orderBy: { dealScore: 'desc' }
        });

        if (pendingDeal) {
          console.log(`📥 Draining queue: Auto-publishing pending deal ${pendingDeal.id} from queue.`);
          await publishToTelegram(pendingDeal.id, TELEGRAM_CHANNEL);
        }
      }
    } catch (drainErr: any) {
      console.error('Error draining deal queue:', drainErr.message);
    }
  }

  // 1. PROCESS RECURRING/REPOST SCHEDULES
  try {
    const now = new Date();
    const recurringPosts = await prisma.recurringPost.findMany({
      where: { isActive: true }
    });

    for (const post of recurringPosts) {
      const lastPosted = post.lastPostedAt ? new Date(post.lastPostedAt) : new Date(0);
      const diffMs = now.getTime() - lastPosted.getTime();
      const intervalMs = post.intervalMin * 60 * 1000;

      if (diffMs >= intervalMs) {
        console.log(`⏰ Reposting recurring post: "${post.title}"`);

        let message = post.content;
        let finalLink = post.link || '';

        if (finalLink) {
          const resolved = await resolveDealUrl(finalLink);
          if (resolved) {
            finalLink = getAffiliateUrl(resolved.platform, resolved.cleanUrl, resolved.externalId);
          }
        }

        const channelId = TELEGRAM_CHANNEL;
        let inlineKeyboard = undefined;

        if (finalLink) {
          const isTelegramLink = finalLink.toLowerCase().includes('t.me') || finalLink.toLowerCase().includes('telegram');
          const buttonText = isTelegramLink ? '👉 Join Channel' : '🛍️ View / Buy Deal';
          inlineKeyboard = {
            inline_keyboard: [
              [
                {
                  text: buttonText,
                  url: finalLink
                }
              ]
            ]
          };
        }

        if (bot) {
          if (post.imageUrl) {
            await bot.sendPhoto(channelId, post.imageUrl, {
              caption: message,
              parse_mode: 'Markdown',
              reply_markup: inlineKeyboard
            });
          } else {
            await bot.sendMessage(channelId, message, {
              parse_mode: 'Markdown',
              reply_markup: inlineKeyboard
            });
          }
        } else {
          console.log(`[SIMULATION] Cron recurring post: ${message} (Link: ${finalLink})`);
        }

        await prisma.recurringPost.update({
          where: { id: post.id },
          data: { lastPostedAt: now }
        });
      }
    }
  } catch (recurringError) {
    console.error('Error processing recurring posts in cron:', recurringError);
  }

  const startTime = Date.now();
  const isVercel = !!process.env.VERCEL;
  // Dynamic limits based on environment to prevent starvation on self-hosted/local runs
  const MAX_EXECUTION_TIME_MS = isVercel ? 8000 : 25000;
  const MAX_NEW_DEALS_PER_RUN = isVercel ? 2 : 6;

  try {
    let dealsFoundCount = 0;
    let dealsSkippedCount = 0;
    let timeLimitReached = false;

    const candidates: Array<{
      dealInfo: { platform: string; cleanUrl: string; externalId: string };
      item: any;
      priorityScore: number;
    }> = [];

    // NOTE: Watchlist (Stage 0) and Wishlist (Stage 0b) are handled by the dedicated
    // /api/cron-wishlist endpoint. They were removed from here because they consumed
    // 15-23 seconds, causing Vercel Hobby's 10s function timeout to kill the process
    // before competitor channel scraping (the core job of this cron) could even start.

    // Stage 1a: Direct Amazon Deals Page Scraper (Safe, official-source, no competitor copying)
    const amazonStageStart = Date.now();
    try {
      console.log('📡 Scraping Amazon Deals page for direct deals...');
      const amazonDealsAsins = await scrapeAmazonDealsPage();

      const amazonPlatform = await prisma.platform.upsert({
        where: { slug: 'amazon' },
        update: {},
        create: { name: 'Amazon', slug: 'amazon' }
      });

      // Slice to first 40 ASINs to keep execution extremely fast and fit in cron limits
      const slicedAsins = amazonDealsAsins.slice(0, 40);

      // Batch query products updated/scraped in the last 24 hours
      const existingProducts = await prisma.product.findMany({
        where: {
          platformId: amazonPlatform.id,
          externalId: { in: slicedAsins },
          lastScrapedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        select: { externalId: true }
      });
      const existingAsinsSet = new Set(existingProducts.map(p => p.externalId));

      for (const asin of slicedAsins) {
        // Skip if already posted in last 24h
        if (existingAsinsSet.has(asin)) {
          continue;
        }

        // Avoid duplicates in the candidate list
        if (candidates.some(c => c.dealInfo.externalId === asin && c.dealInfo.platform === 'amazon')) {
          continue;
        }

        candidates.push({
          dealInfo: {
            platform: 'amazon',
            cleanUrl: `https://www.amazon.in/dp/${asin}`,
            externalId: asin
          },
          item: {
            title: 'Amazon Goldbox Deal',
            content: 'Direct deal from Amazon Today\'s Deals page'
          },
          // Direct deals from the official Deals page get a high base score!
          priorityScore: 55
        });
      }
    } catch (amzDealsErr: any) {
      console.error('Error scraping Amazon Deals page in cron:', amzDealsErr.message);
    }

    // Stage 1b: Fast Scrape & De-duplicate competitor channels
    // Pick 1 random competitor channel on Vercel to stay within limit, otherwise scrape all channels
    const competitorStageStart = Date.now();
    const shuffledChannels = [...COMPETITOR_CHANNELS].sort(() => Math.random() - 0.5);
    const channelsToScrape = isVercel ? shuffledChannels.slice(0, 1) : COMPETITOR_CHANNELS;

    console.log(`📡 Starting competitor channel scrape. Time since cron start: ${Math.round((Date.now() - startTime) / 1000)}s`);

    const competitorMaxTimeMs = isVercel ? 5000 : 15000;
    const competitorMaxCandidates = isVercel ? 4 : 12;

    for (const channel of channelsToScrape) {
      if (Date.now() - competitorStageStart > competitorMaxTimeMs || candidates.length >= competitorMaxCandidates) {
        console.log(`⏰ Competitor stage timeout or candidate limit reached.`);
        break;
      }

      const deals = await fetchTelegramDeals(channel);
      console.log(`📡 Fetched ${deals.length} deals from @${channel}`);

      let resolvedCount = 0;
      for (const item of deals) {
        if (Date.now() - competitorStageStart > competitorMaxTimeMs || candidates.length >= competitorMaxCandidates || resolvedCount >= competitorMaxCandidates) {
          break;
        }
        resolvedCount++;

        const dealInfo = await resolveDealUrl(item.link, item.content);
        if (!dealInfo) continue;

        // Find or create platform
        const dealPlatform = await prisma.platform.upsert({
          where: { slug: dealInfo.platform },
          update: {},
          create: { name: dealInfo.platform.charAt(0).toUpperCase() + dealInfo.platform.slice(1), slug: dealInfo.platform }
        });

        // Skip if already posted/scraped in the last 24 hours
        const existingDeal = await prisma.product.findUnique({
          where: { platformId_externalId: { platformId: dealPlatform.id, externalId: dealInfo.externalId } }
        });

        if (existingDeal && existingDeal.lastScrapedAt) {
          const hoursSinceLastScraped = (Date.now() - new Date(existingDeal.lastScrapedAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastScraped < 24) {
            dealsSkippedCount++;
            continue;
          }
        }

        // Avoid duplicate candidates in the same run
        if (candidates.some(c => c.dealInfo.externalId === dealInfo.externalId && c.dealInfo.platform === dealInfo.platform)) {
          continue;
        }

        const titleText = item.title || item.previewTitle || item.content || '';
        const priorityScore = calculatePriorityScore(titleText);

        candidates.push({
          dealInfo,
          item,
          priorityScore
        });
      }
    }

    console.log(`📋 Found ${candidates.length} new candidates. Sorting by priority score...`);

    // Stage 2: Sort Candidates by Priority Score
    candidates.sort((a, b) => b.priorityScore - a.priorityScore);

    // Stage 3: Process the best deals — ALWAYS fetch fresh data from the SOURCE, never trust competitor text
    // ⚡ FIX: Use a dedicated timer so watchlist/wishlist latency doesn't prevent deal processing!
    const processingStageStart = Date.now();
    const PROCESSING_MAX_MS = MAX_EXECUTION_TIME_MS; // Use the main timeout budget
    const topCandidates = candidates.slice(0, MAX_NEW_DEALS_PER_RUN);
    const processedTitlePrefixes = new Set<string>();

    console.log(`📡 Starting Stage 3 deal processing. ${topCandidates.length} candidates. Time since cron start: ${Math.round((Date.now() - startTime) / 1000)}s`);

    for (const candidate of topCandidates) {
      if (Date.now() - processingStageStart > PROCESSING_MAX_MS) {
        console.log('⏰ Stage 3 processing time limit reached. Stopping to save progress.');
        timeLimitReached = true;
        break;
      }

      const { dealInfo } = candidate;

      // =====================================================================
      // TRUST RULE: IGNORE all competitor text. Only use the extracted LINK.
      // Fetch ALL product details fresh from the actual e-commerce platform.
      // This is the same process as when Gabbar manually pastes a link
      // in the dashboard — guaranteed accurate data every time.
      // =====================================================================

      let finalTitle = '';
      let finalDealPrice = 0;
      let finalOriginalPrice = 0;
      let finalImageUrl = '';
      let priceVerified = false;

      if (candidate.item.priceVerified) {
        // Reuse already-fetched data from watchlist
        finalTitle = candidate.item.title || '';
        finalDealPrice = candidate.item.customPrice || 0;
        finalOriginalPrice = candidate.item.customOriginalPrice || 0;
        finalImageUrl = candidate.item.imageUrl || '';
        priceVerified = true;
        console.log(`✅ WATCHLIST PRICE DROP VERIFIED: ${dealInfo.externalId} → "${finalTitle.substring(0, 40)}" ₹${finalDealPrice}`);
      } else if (dealInfo.platform === 'amazon') {
        // ✅ AMAZON: Use the Discord-bot scraper to get real Amazon data
        const amzData = await fetchAmazonDetails(dealInfo.externalId);

        if (amzData && amzData.title && amzData.title.length > 5) {
          finalTitle = amzData.title;
          finalImageUrl = amzData.imageUrl || '';

          if (amzData.currentPrice > 0) {
            finalDealPrice = amzData.currentPrice;
            finalOriginalPrice = amzData.originalPrice;
            priceVerified = true;
            console.log(`✅ AMAZON VERIFIED: ${dealInfo.externalId} → "${finalTitle.substring(0, 40)}" ₹${finalDealPrice} (MRP: ₹${finalOriginalPrice})`);
          }
        }
      } else {
        // ✅ FLIPKART / MYNTRA / AJIO: Fetch OpenGraph metadata from the actual product page
        const metaData = await fetchPageMetadata(dealInfo.cleanUrl);
        if (metaData) {
          finalTitle = metaData.title || '';
          finalImageUrl = metaData.imageUrl || '';
          // Note: OG metadata rarely has prices, so we don't set priceVerified
          console.log(`📋 ${dealInfo.platform.toUpperCase()} metadata: "${finalTitle.substring(0, 40)}" | Image: ${finalImageUrl ? 'YES' : 'NO'}`);
        }
      }

      // =====================================================================
      // QUALITY GATE: Skip deals that don't have proper verified data.
      // This prevents posting garbage like "316", "Special Offer", etc.
      // A deal MUST have a real title (>10 chars) and a valid image URL to be posted.
      // =====================================================================
      if (!finalTitle || finalTitle.length < 10) {
        console.log(`🚫 SKIPPED: No valid title found for ${dealInfo.platform}/${dealInfo.externalId}. Not posting to protect channel trust.`);
        dealsSkippedCount++;
        continue;
      }

      if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
        console.log(`🚫 SKIPPED: No valid image found for ${dealInfo.platform}/${dealInfo.externalId}. Skipping to avoid posts without images.`);
        dealsSkippedCount++;
        continue;
      }

      // Skip toy and children products
      if (isToysDeal(finalTitle)) {
        console.log(`🚫 SKIPPED: Toy/children product detected: "${finalTitle}"`);
        dealsSkippedCount++;
        continue;
      }

      // Also skip if the title looks like a number or garbage
      if (/^\d+$/.test(finalTitle.trim())) {
        console.log(`🚫 SKIPPED: Title "${finalTitle}" looks like garbage (just a number). Skipping.`);
        dealsSkippedCount++;
        continue;
      }

      // De-duplicate color/RAM/storage variants of the same product in the same run
      const cleanTitle = sanitizeTitle(finalTitle);
      const titlePrefix = cleanTitle.substring(0, 30).toLowerCase().trim();
      if (processedTitlePrefixes.has(titlePrefix)) {
        console.log(`🚫 SKIPPED: Similar product variant already processed in this run: "${finalTitle}"`);
        dealsSkippedCount++;
        continue;
      }
      processedTitlePrefixes.add(titlePrefix);

      // De-duplicate against recently posted deals in the last 24 hours
      const recentSimilarDeal = await prisma.deal.findFirst({
        where: {
          product: {
            title: {
              startsWith: cleanTitle.substring(0, 30),
              mode: 'insensitive'
            }
          },
          isPublished: true,
          publishedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });
      if (recentSimilarDeal) {
        console.log(`🚫 SKIPPED: Similar product already posted in the last 24 hours: "${finalTitle}"`);
        dealsSkippedCount++;
        continue;
      }

      const dealPlatform = await prisma.platform.upsert({
        where: { slug: dealInfo.platform },
        update: {},
        create: { name: dealInfo.platform.charAt(0).toUpperCase() + dealInfo.platform.slice(1), slug: dealInfo.platform }
      });

      // Generate the affiliate link using the unified wrapper
      const affiliateUrl = getAffiliateUrl(dealInfo.platform, dealInfo.cleanUrl, dealInfo.externalId);

      // COMMISSION SAFETY: Only auto-publish if we have a working affiliate solution.
      // Amazon = direct tag (always works) ✅
      // Flipkart/Myntra/Ajio = needs manual EarnKaro link (no API yet) → save as Pending
      const hasWorkingAffiliate = dealInfo.platform === 'amazon';

      // If price is NOT verified, post without price to maintain trust
      if (!priceVerified) {
        finalDealPrice = 0;
        finalOriginalPrice = 0;
        console.log(`⚠️ UNVERIFIED PRICE for ${dealInfo.externalId} — will post without price to maintain trust`);
      }

      const discountPct = (priceVerified && finalOriginalPrice > finalDealPrice)
        ? Math.round(((finalOriginalPrice - finalDealPrice) / finalOriginalPrice) * 100)
        : 0;

      dealsFoundCount++;

      // Save product (use upsert to be robust against concurrent inserts or manual entries)
      const product = await prisma.product.upsert({
        where: {
          platformId_externalId: {
            platformId: dealPlatform.id,
            externalId: dealInfo.externalId
          }
        },
        update: {
          title: sanitizeTitle(finalTitle),
          url: dealInfo.cleanUrl,
          currentPrice: finalDealPrice,
          imageUrl: finalImageUrl || null,
          lastScrapedAt: new Date()
        },
        create: {
          platformId: dealPlatform.id,
          externalId: dealInfo.externalId,
          title: sanitizeTitle(finalTitle),
          url: dealInfo.cleanUrl,
          currentPrice: finalDealPrice,
          imageUrl: finalImageUrl || null,
        }
      });

      // Save deal (initially unpublished; updated upon successful publish)
      const deal = await prisma.deal.create({
        data: {
          productId: product.id,
          platformId: dealPlatform.id,
          dealType: 'price_drop',
          dealScore: priceVerified ? 95 : 70,
          dealPrice: finalDealPrice,
          originalPrice: finalOriginalPrice,
          discountPct: discountPct,
          affiliateUrl: affiliateUrl,
          isGenuine: priceVerified,
          isPublished: false,
        }
      });

      // Only auto-publish to Telegram if we have a working affiliate link AND it's not silent hours
      if (hasWorkingAffiliate && !isSilent) {
        try {
          await publishToTelegram(deal.id, TELEGRAM_CHANNEL);
          console.log(`✅ AUTO-PUBLISHED (${dealInfo.platform}): "${finalTitle.substring(0, 30)}..." [${priceVerified ? 'VERIFIED ✓' : 'NO PRICE'}]`);
          
          // Post to Hostel channel if it's a college essential or super priority
          if (HOSTEL_CHANNEL && (priorityScore >= 30 || dealPlatform.slug === 'amazon')) {
             try {
                await publishToTelegram(deal.id, HOSTEL_CHANNEL);
                console.log(`✅ AUTO-PUBLISHED to Hostel Channel: "${finalTitle.substring(0, 30)}..."`);
             } catch (hostelErr) {
                console.error(`Failed to publish to hostel channel:`, hostelErr);
             }
          }
        } catch (err) {
          console.error(`Failed to publish deal to main channel:`, err);
        }
      } else if (hasWorkingAffiliate && isSilent) {
        console.log(`💤 SILENT HOURS ACTIVE (IST): Saved "${finalTitle.substring(0, 30)}..." to queue without publishing.`);
      } else {
        console.log(`📋 SAVED AS PENDING (${dealInfo.platform}): "${finalTitle.substring(0, 30)}..." — Needs manual EarnKaro link before publishing`);
      }
    }


    return NextResponse.json({
      success: true,
      newDealsFound: dealsFoundCount,
      dealsSkipped: dealsSkippedCount
    });

  } catch (error: any) {
    console.error('Vercel Cron Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
