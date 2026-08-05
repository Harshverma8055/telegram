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
  'TrickXpert',
  'rapiddeals_unlimited'
];
const TELEGRAM_CHANNEL = process.env.TELEGRAM_CHANNEL || '@fantasticofffer';
const HOSTEL_CHANNEL = process.env.HOSTEL_CHANNEL || '@hosteldeals';

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

// ❌ These products MUST NEVER be posted to the main channel.
// Small growing channel (7 subscribers) needs affordable impulse-buy deals only.
// Expensive research items (phones, TVs) irritate users who already knew about them.
const BLOCKED_FROM_MAIN_KEYWORDS = [
  // Phones — all major Indian brands
  'smartphone', 'mobile phone', 'android phone',
  'iphone', 'samsung galaxy', 'samsung m', 'samsung s2', 'samsung f',
  'oneplus', 'realme narzo', 'realme c', 'realme gt', 'realme p',
  'redmi note', 'redmi a', 'redmi 1', 'redmi 2', 'redmi 3',
  'poco x', 'poco m', 'poco f', 'poco c',
  'vivo x', 'vivo y', 'vivo v', 'vivo t',
  'oppo a', 'oppo f', 'oppo reno', 'oppo k',
  'iqoo z', 'iqoo neo', 'iqoo 1', 'iqoo 2', 'iqoo 3',
  'nothing phone', 'motorola edge', 'motorola g', 'nokia c', 'nokia g',
  // TVs
  'smart tv', 'oled tv', 'qled tv', 'led tv', '4k tv', '8k tv', 'android tv',
  // Robots / Appliances
  'robot vacuum', 'robot cleaner', 'robovac', 'roomba', 'robot mop',
  'air purifier', 'water purifier', 'ro system', 'split ac',
  // Vehicles
  'electric vehicle', 'e-scooter', 'electric scooter'
];

function isBlockedFromMain(title: string, price: number = 0): boolean {
  const lower = title.toLowerCase();
  // Keyword-based block
  if (BLOCKED_FROM_MAIN_KEYWORDS.some(kw => lower.includes(kw))) return true;
  // Smart phone-spec detection: title has both "gb ram" and "storage" = phone/tablet
  // Combined with high price to avoid blocking USB hubs / laptops cheaply
  const hasRam = lower.includes('gb ram');
  const hasStorage = lower.includes('gb storage') || lower.includes('gb rom') || lower.includes('gb inbuilt');
  const hasChip = lower.includes('snapdragon') || lower.includes('dimensity') || lower.includes('mediatek helio') || lower.includes('exynos');
  if ((hasRam && hasStorage && price > 3000) || (hasChip && price > 5000)) return true;
  return false;
}

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

      // FIX: Increased from 15m → 45m to prevent same-deal spam on the growing main channel.
      // With only 6 subscribers, frequent re-posts of the same product irritate users.
      if (timeSinceLastPostMin >= 45) {
        const pendingDeal = await prisma.deal.findFirst({
          where: {
            isPublished: false,
            affiliateUrl: { not: null },
            createdAt: {
              gte: new Date(Date.now() - 12 * 60 * 60 * 1000)
            }
          },
          include: { product: true },
          orderBy: { dealScore: 'desc' }
        });

        if (pendingDeal && pendingDeal.product) {
          // FIX: Also check that this same product wasn't already posted to main in the last 6 hours
          // to prevent the same deal appearing twice in the same day.
          const recentMainPost = await prisma.deal.findFirst({
            where: {
              productId: pendingDeal.productId,
              isPublished: true,
              publishedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }
            }
          });

          // FIX: Also block expensive/irrelevant products from being drained to main channel.
          const isBlocked = isBlockedFromMain(pendingDeal.product.title || '');

          if (!recentMainPost && !isBlocked) {
            console.log(`📥 Draining queue: Auto-publishing pending deal ${pendingDeal.id} from queue.`);
            await publishToTelegram(pendingDeal.id, TELEGRAM_CHANNEL);
          } else if (recentMainPost) {
            console.log(`⏭️ Queue drain: Skipping deal ${pendingDeal.id} — same product already posted to main in last 6h.`);
          } else if (isBlocked) {
            console.log(`🚫 Queue drain: Blocking deal ${pendingDeal.id} — product type is restricted from main channel.`);
            // Mark as published so it doesn't keep blocking the queue, hostel cron will handle it
            await prisma.deal.update({ where: { id: pendingDeal.id }, data: { isPublished: true } });
          }
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

      // De-duplicate color/size/variant duplicates of the same product within one run
      // FIX: Increased prefix 30 → 50 chars so "AYSIS Shoe Rack 3-Door" and
      // "AYSIS Shoe Rack 5-Door" are treated as the SAME product family.
      const cleanTitle = sanitizeTitle(finalTitle);
      const titlePrefix = cleanTitle.substring(0, 50).toLowerCase().trim();
      if (processedTitlePrefixes.has(titlePrefix)) {
        console.log(`🚫 SKIPPED (in-run dedup): Variant already processed this run: "${finalTitle}"`);
        dealsSkippedCount++;
        continue;
      }
      processedTitlePrefixes.add(titlePrefix);

      // De-duplicate against recently posted deals in the last 24 hours
      // FIX: Use 50-char prefix (was 30) to catch brand+product-type duplicates.
      // e.g. "AYSIS Premium Foldable Plastic Shoe Rack for Hom" matches all door variants.
      const recentSimilarDeal = await prisma.deal.findFirst({
        where: {
          product: {
            title: {
              startsWith: cleanTitle.substring(0, 50),
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
        console.log(`🚫 SKIPPED (24h dedup): Same product family already posted: "${finalTitle.substring(0, 50)}"`);
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
      // COMMISSION SAFETY: We now use Cuelinks for Flipkart/Myntra/Ajio, so ALL platforms have a working affiliate link automatically.
      const hasWorkingAffiliate = true;

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

      // FIX: Block expensive/irrelevant products (mobiles, TVs, robot cleaners)
      // Pass finalDealPrice so smart phone-spec detection can use price threshold
      const blockedFromMain = isBlockedFromMain(finalTitle, finalDealPrice);
      if (blockedFromMain) {
        console.log(`🚫 BLOCKED FROM MAIN: "${finalTitle.substring(0, 50)}" — product type restricted from small channel.`);
        // Still saved in DB — hostel cron will evaluate it independently
        dealsSkippedCount++;
        continue;
      }

      // FIX: Fresh scrapes now respect the same 45-min cooldown as the queue drain.
      // Previously, fresh scrapes bypassed cooldown and published immediately,
      // causing 5 shoe-rack variants to post within 2 hours.
      // Now: if a deal was posted < 45 min ago, this deal is saved as pending
      // and the queue drain will publish it later with proper spacing.
      const lastPostedDeal = await prisma.deal.findFirst({
        where: { isPublished: true, publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' }
      });
      const minsSinceLastMainPost = lastPostedDeal?.publishedAt
        ? (Date.now() - new Date(lastPostedDeal.publishedAt).getTime()) / (1000 * 60)
        : 999;

      // Only auto-publish to Telegram if we have affiliate AND not silent AND 45-min gap met
      if (hasWorkingAffiliate && !isSilent && minsSinceLastMainPost >= 45) {
        try {
          await publishToTelegram(deal.id, TELEGRAM_CHANNEL);
          console.log(`✅ AUTO-PUBLISHED (${dealInfo.platform}): "${finalTitle.substring(0, 40)}..." [${priceVerified ? 'VERIFIED ✓' : 'NO PRICE'}]`);
          // NOTE: Hostel channel posting is handled independently by /api/cron-hostel.
        } catch (err) {
          console.error(`Failed to publish deal to main channel:`, err);
        }
      } else if (hasWorkingAffiliate && !isSilent && minsSinceLastMainPost < 45) {
        console.log(`⏳ QUEUED (cooldown): ${Math.round(minsSinceLastMainPost)}min since last post < 45min. "${finalTitle.substring(0, 40)}" saved for queue drain.`);
      } else if (hasWorkingAffiliate && isSilent) {
        console.log(`💤 SILENT HOURS: Saved "${finalTitle.substring(0, 40)}" to queue.`);
      } else {
        console.log(`📋 PENDING (${dealInfo.platform}): "${finalTitle.substring(0, 40)}" — No affiliate link.`);
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
