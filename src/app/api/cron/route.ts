import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { fetchTelegramDeals, fetchAmazonDetails, resolveDealUrl, fetchPageMetadata, scrapeAmazonDealsPage } from '@/lib/scrapers/rss';
import { publishToTelegram, sanitizeTitle, bot } from '@/lib/telegram';
import { getAffiliateUrl } from '@/lib/affiliate';

const COMPETITOR_CHANNELS = [
  'LootDealsIndia',
  'dealsindia',
  'GrabOnIndiaOfficial',
  'Bigtricks',
  'offerbot',
  'IndiaFreeStuff',
  'amazinglootsdealsoffers',
  'lootdealsk_Alibaba_dc_DealDost',
  'LOOTS_DEAL_OFFER_ONLINE_SHOPPING',
  'TrickXpert',
  'under_99_loot_deals'
];
const TELEGRAM_CHANNEL = '@fantasticofffer';

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

// Vercel Cron routes must be a GET request
export async function GET(request: Request) {
  // Optional: Add a secret key check so random people can't trigger your cron
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📡 Starting Vercel Cron: Deal Scraper...');
  
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
  // Vercel Hobby plan gives 60s for cron-triggered routes.
  // We use 50s as our safe ceiling to leave buffer for DB writes.
  const MAX_EXECUTION_TIME_MS = 50000;
  const MAX_NEW_DEALS_PER_RUN = 8; // Process up to 8 new deals per run

  try {
    let dealsFoundCount = 0;
    let dealsSkippedCount = 0;
    let timeLimitReached = false;

    const candidates: Array<{
      dealInfo: { platform: string; cleanUrl: string; externalId: string };
      item: any;
      priorityScore: number;
    }> = [];

    // Stage 0: Watchlist Price Drop Checker (Professional, future-proof, 100% original)
    try {
      console.log('📡 Checking watchlisted products for price drops...');
      const watchedProducts = await prisma.product.findMany({
        where: { category: 'watchlist' },
        include: { platform: true }
      });

      for (const prod of watchedProducts) {
        // Limit processing inside cron to keep it under execution limit
        // Allow up to 15s for watchlist checks (they're important for price drops)
        if (Date.now() - startTime > 15000) break;

        let latestPrice = 0;
        let originalPrice = prod.mrp || 0;
        let latestTitle = prod.title;
        let latestImage = prod.imageUrl;

        if (prod.platform.slug === 'amazon') {
          const details = await fetchAmazonDetails(prod.externalId);
          if (details) {
            latestPrice = details.currentPrice;
            originalPrice = details.originalPrice || details.currentPrice;
            latestTitle = details.title;
            latestImage = details.imageUrl;
          }
        } else {
          // Scraping non-Amazon watchlisted product
          try {
            const response = await fetch(prod.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
              }
            });
            const html = await response.text();
            const cheerio = require('cheerio');
            const $ = cheerio.load(html);
            
            // Try parsing price from HTML
            const priceRegex = /(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)/i;
            $('span, div, p').each((_: number, el: any) => {
              const text = $(el).text().trim();
              if (text.includes('₹') || text.includes('Rs.')) {
                const match = text.match(priceRegex);
                if (match && latestPrice === 0) {
                  latestPrice = parseFloat(match[1].replace(/,/g, ''));
                }
              }
            });
          } catch (e) {
            console.error(`Failed to scrape watchlist details for ${prod.externalId}:`, e);
          }
        }

        if (latestPrice > 0) {
          const previousPrice = prod.currentPrice || latestPrice;
          
          // Save price history if price changed
          if (latestPrice !== previousPrice) {
            await prisma.priceHistory.create({
              data: {
                productId: prod.id,
                price: latestPrice
              }
            });
            
            // Update current price on product
            await prisma.product.update({
              where: { id: prod.id },
              data: {
                currentPrice: latestPrice,
                mrp: originalPrice,
                title: latestTitle,
                imageUrl: latestImage,
                lastScrapedAt: new Date()
              }
            });
          }

          // Check if price dropped significantly! (e.g. drop of 5% or more compared to previousPrice or MRP)
          const dropFromPrevious = previousPrice - latestPrice;
          const dropFromMRP = originalPrice - latestPrice;
          
          if (dropFromPrevious > 0 || (dropFromMRP / originalPrice) >= 0.1) {
            console.log(`🔥 WATCHLIST PRICE DROP DETECTED for "${prod.title}": ₹${previousPrice} -> ₹${latestPrice}`);
            
            // Add as high-priority candidate!
            candidates.push({
              dealInfo: {
                platform: prod.platform.slug,
                cleanUrl: prod.url,
                externalId: prod.externalId
              },
              item: {
                title: latestTitle,
                content: `Price drop alert! Was ₹${previousPrice}, now only ₹${latestPrice}!`,
                customPrice: latestPrice,
                customOriginalPrice: originalPrice,
                imageUrl: latestImage,
                priceVerified: true
              },
              // Price drop watchlists are the highest priority deals
              priorityScore: 99
            });
          }
        }
      }
    } catch (watchlistErr: any) {
      console.error('Error checking watchlist in cron:', watchlistErr.message);
    }

    // Stage 1a: Direct Amazon Deals Page Scraper (Safe, official-source, no competitor copying)
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

      // Batch query all existing products in one single database call
      const existingProducts = await prisma.product.findMany({
        where: {
          platformId: amazonPlatform.id,
          externalId: { in: slicedAsins }
        },
        select: { externalId: true }
      });
      const existingAsinsSet = new Set(existingProducts.map(p => p.externalId));

      for (const asin of slicedAsins) {
        // Skip if already in database (using our fast O(1) set lookup)
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
    const shuffledChannels = [...COMPETITOR_CHANNELS].sort(() => Math.random() - 0.5);

    for (const channel of shuffledChannels) {
      // Check timeout to make sure we leave enough time for Stage 3 (Amazon/Metadata fetching)
      // Allow up to 35s total for competitor scraping
      if (Date.now() - startTime > 35000 || candidates.length >= 20) {
        break;
      }

      const deals = await fetchTelegramDeals(channel);
      
      for (const item of deals) {
        if (Date.now() - startTime > 35000 || candidates.length >= 20) {
          break;
        }

        const dealInfo = await resolveDealUrl(item.link, item.content);
        if (!dealInfo) continue;

        // Find or create platform
        const dealPlatform = await prisma.platform.upsert({
          where: { slug: dealInfo.platform },
          update: {},
          create: { name: dealInfo.platform.charAt(0).toUpperCase() + dealInfo.platform.slice(1), slug: dealInfo.platform }
        });

        // Skip if already in database
        const existingDeal = await prisma.product.findUnique({
          where: { platformId_externalId: { platformId: dealPlatform.id, externalId: dealInfo.externalId } }
        });

        if (existingDeal) {
          dealsSkippedCount++;
          continue;
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
    const topCandidates = candidates.slice(0, MAX_NEW_DEALS_PER_RUN);
    const processedTitlePrefixes = new Set<string>();

    for (const candidate of topCandidates) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.log('⏰ Reaching Vercel 10s timeout limit. Stopping early to save progress.');
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
      // A deal MUST have a real title (>10 chars) to be posted.
      // =====================================================================
      if (!finalTitle || finalTitle.length < 10) {
        console.log(`🚫 SKIPPED: No valid title found for ${dealInfo.platform}/${dealInfo.externalId}. Not posting to protect channel trust.`);
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

      // De-duplicate against recently posted products in the last 24 hours
      const recentSimilarProduct = await prisma.product.findFirst({
        where: {
          title: {
            startsWith: cleanTitle.substring(0, 30),
            mode: 'insensitive'
          },
          lastScrapedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });
      if (recentSimilarProduct) {
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

      // Save deal
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
          isPublished: hasWorkingAffiliate, // Only mark published if auto-posting
        }
      });

      // Only auto-publish to Telegram if we have a working affiliate link
      if (hasWorkingAffiliate) {
        try {
          await publishToTelegram(deal.id, TELEGRAM_CHANNEL);
          console.log(`✅ AUTO-PUBLISHED (${dealInfo.platform}): "${finalTitle.substring(0, 30)}..." [${priceVerified ? 'VERIFIED ✓' : 'NO PRICE'}]`);
        } catch (err) {
          console.error(`Failed to publish deal:`, err);
        }
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
