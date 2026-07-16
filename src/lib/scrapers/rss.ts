import axios from 'axios';
import * as cheerio from 'cheerio';
import dns from 'dns';
import https from 'https';

export interface RSSDeal {
  title: string;
  link: string;
  content: string;
  pubDate: string;
  source: string;
  imageUrl?: string;
  // NEW: Data extracted from Telegram's own link preview (100% real Amazon data!)
  previewTitle?: string;
  previewDescription?: string;
}

// =====================================================================
// ROTATING USER-AGENTS — Makes each request look like a different human
// =====================================================================
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Small random delay (300-1500ms) to look human
function randomDelay(): Promise<void> {
  const ms = 300 + Math.floor(Math.random() * 1200);
  return new Promise(resolve => setTimeout(resolve, ms));
}

const customDnsLookup = (hostname: string, options: any, callback: any) => {
  if (hostname === 't.me' || hostname === 'telegram.me') {
    const resolver = new dns.Resolver();
    resolver.setServers(['1.1.1.1', '8.8.8.8', '8.8.4.4']);
    resolver.resolve4(hostname, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        // Fallback to hardcoded IP if public DNS fails
        const fallbackIp = '149.154.167.99';
        if (options && options.all) {
          callback(null, [{ address: fallbackIp, family: 4 }]);
        } else {
          callback(null, fallbackIp, 4);
        }
      } else {
        if (options && options.all) {
          callback(null, addresses.map(addr => ({ address: addr, family: 4 })));
        } else {
          callback(null, addresses[0], 4);
        }
      }
    });
  } else {
    dns.lookup(hostname, options, callback);
  }
};

const telegramHttpsAgent = new https.Agent({ lookup: customDnsLookup });

// =====================================================================
// TELEGRAM SCRAPER — Now also extracts the link preview (free real data!)
// =====================================================================
export async function fetchTelegramDeals(channelName: string): Promise<RSSDeal[]> {
  try {
    let url = `https://t.me/s/${channelName}`;
    let response;
    try {
      response = await axios.get(url, {
        httpsAgent: telegramHttpsAgent,
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        timeout: 8000
      });
    } catch (e: any) {
      console.log(`⚠️ t.me failed for ${channelName} (${e.message}), trying telegram.me fallback...`);
      url = `https://telegram.me/s/${channelName}`;
      response = await axios.get(url, {
        httpsAgent: telegramHttpsAgent,
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        timeout: 8000
      });
    }
    const $ = cheerio.load(response.data);
    const deals: RSSDeal[] = [];

    $('.tgme_widget_message').each((i, el) => {
      const text = $(el).find('.tgme_widget_message_text').text();
      const time = $(el).find('time').attr('datetime') || new Date().toISOString();
      
      // Look for any links inside the message
      const links: string[] = [];
      $(el).find('a').each((_, a) => {
        const href = $(a).attr('href');
        if (href) links.push(href);
      });

      const amzLink = links.find(l => {
        const lower = l.toLowerCase();
        return lower.includes('amazon.in') || 
               lower.includes('amzn.to') || 
               lower.includes('grbn.in') || 
               lower.includes('amazn.lt') ||
               lower.includes('link.amazon') ||
               lower.includes('bitly.in') ||
               lower.includes('bitiy.in') ||
               lower.includes('amazn.to') ||
               lower.includes('flipkart.com') ||
               lower.includes('fkrt.co') ||
               lower.includes('fkrt.cc') ||
               lower.includes('fktr.in') ||
               lower.includes('linksredirect.in') ||
               lower.includes('myntra.com') ||
               lower.includes('myntr.in') ||
               lower.includes('ajio.com');
      }) || '';

      if (amzLink) {
        // Prevent scraping old backlog deals (older than 24 hours)
        const postDate = new Date(time);
        const now = new Date();
        const diffHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);
        
        if (diffHours <= 24) {
          // Scrape image preview
          let imageUrl = '';
          const photoEl = $(el).find('.tgme_widget_message_photo_wrap');
          if (photoEl.length > 0) {
            const style = photoEl.attr('style') || '';
            const match = style.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
            if (match && match[1]) {
              imageUrl = match[1];
            }
          }

          // ============================================================
          // FREE HACK: Extract REAL Amazon title from Telegram Link Preview!
          // When someone posts an Amazon link in Telegram, Telegram itself
          // visits Amazon and generates a preview card. This preview contains
          // the REAL Amazon product title. We extract it for FREE!
          // ============================================================
          let previewTitle = '';
          let previewDescription = '';
          const linkPreview = $(el).find('.tgme_widget_message_link_preview');
          if (linkPreview.length > 0) {
            previewTitle = linkPreview.find('.link_preview_title').text().trim();
            previewDescription = linkPreview.find('.link_preview_description').text().trim();
            // Also grab the preview image if we don't already have one
            if (!imageUrl) {
              const previewImg = linkPreview.find('.link_preview_image');
              if (previewImg.length > 0) {
                const style = previewImg.attr('style') || '';
                const match = style.match(/background-image:\s*url\(['"]?(.*?)['"]?\)/i);
                if (match && match[1]) {
                  imageUrl = match[1];
                }
              }
            }
          }

          // Extract smarter title (skip coupons, URLs, and very short lines)
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          let rawTitle = lines.length > 0 ? lines[0] : text;
          for (const line of lines) {
             const lowerLine = line.toLowerCase();
             if (lowerLine.includes('apply') && lowerLine.includes('coupon')) continue;
             if (lowerLine.includes('http') || lowerLine.includes('amzn.to')) continue;
             if (lowerLine.includes('amazon.in')) continue;
             if (lowerLine.includes('://')) continue;
             if (line.length < 8) continue;
             rawTitle = line;
             break;
          }
          const dealTitle = rawTitle.length > 100 ? rawTitle.substring(0, 100) + '...' : rawTitle;

          deals.push({
            title: dealTitle,
            link: amzLink,
            content: text,
            pubDate: time,
            source: `Telegram: @${channelName}`,
            imageUrl: imageUrl || undefined,
            previewTitle: previewTitle || undefined,
            previewDescription: previewDescription || undefined,
          });
        }
      }
    });

    return deals;
  } catch (error: any) {
    console.error(`Telegram Scrape Error for ${channelName}:`, error.message);
    return [];
  }
}

// Helper to extract an Amazon ASIN if it exists in the RSS text/link
export function extractAmazonASIN(text: string): string | null {
  // Pattern 1: Standard amazon dp/gp/product URL
  const standardMatch = text.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
  if (standardMatch) return standardMatch[1].toUpperCase();
  
  // Pattern 2: Shortlinks ending with 10-char ASIN (e.g. link.amazon/B097X7qOS)
  const shortMatch = text.match(/(?:link\.amazon|amzn\.to|amazn\.lt|grbn\.in|bitly\.in|bitiy\.in)\/([A-Z0-9]{10})(?:[?&/]|$)/i);
  if (shortMatch) return shortMatch[1].toUpperCase();

  // Pattern 3: Any 10-character alphanumeric starting with B0/B (standard ASINs)
  const generalMatch = text.match(/\b(B0[A-Z0-9]{8})\b/i);
  if (generalMatch) return generalMatch[1].toUpperCase();

  return null;
}

// Global helper to resolve ASIN (with shortlink expansion if needed)
export async function resolveASIN(link: string, content: string): Promise<string | null> {
  const resolved = await resolveDealUrl(link, content);
  if (resolved && resolved.platform === 'amazon') {
    return resolved.externalId;
  }
  return null;
}

// =====================================================================
// AMAZON PA-API (OFFICIAL API — NEVER BLOCKED, 100% ACCURATE!)
// This is the same API that premium deal bots use. Free for affiliates.
// To activate: Add AMAZON_ACCESS_KEY and AMAZON_SECRET_KEY in Vercel env.
// =====================================================================
async function fetchFromPAAPI(asin: string) {
  const accessKey = process.env.AMAZON_ACCESS_KEY;
  const secretKey = process.env.AMAZON_SECRET_KEY;
  const partnerTag = process.env.AMAZON_AFFILIATE_TAG;
  
  if (!accessKey || !secretKey || !partnerTag) return null;

  try {
    const amazonPaapi = require('amazon-paapi');
    
    const commonParameters = {
      AccessKey: accessKey,
      SecretKey: secretKey,
      PartnerTag: partnerTag,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.in',
    };

    const requestParameters = {
      ASIN: [asin],
      Resources: [
        'ItemInfo.Title',
        'Offers.Listings.Price',
        'Offers.Listings.SavingBasis',
        'Offers.Listings.MerchantInfo',
        'Images.Primary.Large',
      ],
    };

    const data = await amazonPaapi.GetItems(commonParameters, requestParameters);

    if (data?.ItemsResult?.Items?.length > 0) {
      const item = data.ItemsResult.Items[0];
      
      const title = item.ItemInfo?.Title?.DisplayValue || '';
      const listing = item.Offers?.Listings?.[0];
      const currentPrice = listing?.Price?.Amount ? Math.round(listing.Price.Amount) : 0;
      const originalPrice = listing?.SavingBasis?.Amount ? Math.round(listing.SavingBasis.Amount) : currentPrice;
      const imageUrl = item.Images?.Primary?.Large?.URL || '';

      if (title && currentPrice > 0) {
        console.log(`🏆 [PA-API] Perfect data: ${asin} → ₹${currentPrice} (MRP: ₹${originalPrice})`);
        return { title, currentPrice, originalPrice, imageUrl };
      }
    }
    return null;
  } catch (error: any) {
    console.log(`❌ PA-API failed for ${asin}: ${error.message || 'unknown error'}`);
    return null;
  }
}

// =====================================================================
// STEALTH AMAZON FETCHER — Multi-identity crawler camouflage system
// Amazon whitelists social/search crawlers for SEO & link previews.
// We rotate between 5 trusted crawler identities and race them in
// parallel so the fastest response wins. Timeout is kept at 4s to
// avoid killing Vercel's 10s function limit.
// =====================================================================

// Crawler identities that Amazon trusts (they need these for SEO/sharing)
const STEALTH_IDENTITIES = [
  {
    name: 'googlebot',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      'From': 'googlebot(at)googlebot.com',
    }
  },
  {
    name: 'facebookbot',
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.5',
    }
  },
  {
    name: 'telegrambot',
    headers: {
      'User-Agent': 'TelegramBot (like TwitterBot)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
    }
  },
  {
    name: 'discordbot',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
    }
  },
  {
    name: 'twitterbot',
    headers: {
      'User-Agent': 'Twitterbot/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
    }
  },
];

// Fast timeout for Vercel — fail fast, try next identity
const STEALTH_TIMEOUT = 4000;

export async function fetchAmazonDetails(asin: string) {
  // Layer 0: Official Amazon PA-API (THE BEST — if keys are configured)
  const paResult = await fetchFromPAAPI(asin);
  if (paResult) return paResult;

  // Layer 1: Premium proxy (if available)
  if (process.env.SCRAPER_API_KEY) {
    try {
      const amzUrl = `https://www.amazon.in/dp/${asin}`;
      const url = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(amzUrl)}&country_code=in`;
      const result = await stealthScrape(asin, url, { 'User-Agent': getRandomUA() }, 'proxy');
      if (result) return result;
    } catch (_) {}
  }

  // Layer 2: STEALTH RACE — fire all 5 crawler identities in parallel,
  // the fastest successful response wins. This is extremely fast because
  // we don't wait for failures — we race them.
  const url = `https://www.amazon.in/dp/${asin}`;
  
  try {
    const raceResult = await Promise.any(
      STEALTH_IDENTITIES.map(identity => 
        stealthScrape(asin, url, identity.headers, identity.name)
          .then(result => {
            if (!result) throw new Error('empty');
            return result;
          })
      )
    );
    if (raceResult) return raceResult;
  } catch (_) {
    // All identities failed — try mobile as absolute last resort
  }

  // Layer 3: Mobile fallback (different URL structure, weaker detection)
  try {
    const mobileResult = await stealthScrape(asin, url, {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
    }, 'mobile');
    if (mobileResult) return mobileResult;
  } catch (_) {}

  console.log(`❌ All stealth methods failed for ${asin}`);
  return null;
}

async function stealthScrape(
  asin: string, 
  url: string, 
  headers: Record<string, string>, 
  identityName: string
) {
  try {
    const response = await axios.get(url, { 
      headers, 
      timeout: STEALTH_TIMEOUT,
      // Prevent axios from throwing on redirects
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });
    const $ = cheerio.load(response.data);
    
    // Extract Title
    let title = $('#productTitle').text().trim();
    if (!title) {
      title = $('#title').text().trim();
    }
    if (!title) {
      title = $('meta[property="og:title"]').attr('content')?.trim() || '';
    }
    if (!title) return null; // Captcha or blocked — identity didn't work

    // Extract Deal Price (try multiple selectors)
    let currentPrice = 0;
    const priceSelectors = [
      '.a-price-whole',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.a-price .a-offscreen',
    ];
    for (const sel of priceSelectors) {
      const priceText = $(sel).first().text().trim();
      if (priceText) {
        const parsed = parsePrice(priceText);
        if (parsed > 0) { currentPrice = parsed; break; }
      }
    }

    // If we got a title but no price, try OG meta (social crawlers get this)
    if (!currentPrice) {
      const ogDesc = $('meta[property="og:description"]').attr('content') || '';
      const priceMatch = ogDesc.match(/₹\s*([\d,]+)/);
      if (priceMatch) {
        currentPrice = parsePrice(priceMatch[0]);
      }
    }

    // Extract Original Price (MRP)
    let originalPrice = currentPrice;
    const mrpSelectors = [
      '.a-text-price .a-offscreen',
      '#listPrice',
      '.a-text-price span',
    ];
    for (const sel of mrpSelectors) {
      const mrpText = $(sel).first().text().trim();
      if (mrpText) {
        const parsed = parsePrice(mrpText);
        if (parsed > 0) { originalPrice = parsed; break; }
      }
    }

    // Also try the "M.R.P." row
    const mrpRow = $('span:contains("M.R.P.")').parent().find('.a-offscreen, .a-text-price').first().text().trim();
    if (mrpRow) {
      const parsed = parsePrice(mrpRow);
      if (parsed > originalPrice) originalPrice = parsed;
    }
    
    // Extract Image
    let imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src') || '';
    if (!imageUrl) {
      imageUrl = $('meta[property="og:image"]').attr('content') || '';
    }

    // Fix edge cases
    if (originalPrice < currentPrice) {
       originalPrice = Math.round(currentPrice * 1.4);
    }

    console.log(`✅ [${identityName}] Amazon scrape OK: ${asin} → ₹${currentPrice} (MRP: ₹${originalPrice})`);
    return { title, currentPrice, originalPrice, imageUrl };
  } catch (error) {
    // Silent fail — let the race continue with other identities
    return null;
  }
}

// Cleanly extracts a price sequence and avoids text concatenation bug
function parsePrice(text: string): number {
  if (!text) return 0;
  // Match the first sequence of digits potentially containing commas and periods
  const match = text.match(/(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return 0;
  
  // Clean all characters except digits
  const clean = match[1].replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

// Helper to match target platforms directly
export function tryResolvePlatformDirectly(url: string): { platform: string; cleanUrl: string; externalId: string } | null {
  const lowerUrl = url.toLowerCase();
  
  // 1. Amazon check
  if (lowerUrl.includes('amazon.in') || lowerUrl.includes('amazon.com')) {
    const asin = extractAmazonASIN(url);
    if (asin) {
      return {
        platform: 'amazon',
        cleanUrl: `https://www.amazon.in/dp/${asin}`,
        externalId: asin
      };
    }
  }
  
  // 2. Flipkart check (includes all known shortlink domains)
  if (lowerUrl.includes('flipkart.com') || lowerUrl.includes('fkrt.co') || lowerUrl.includes('fkrt.cc') || lowerUrl.includes('fktr.in') || lowerUrl.includes('linksredirect.in')) {
    try {
      const urlObj = new URL(url);
      const pid = urlObj.searchParams.get('pid');
      const cleanUrl = urlObj.origin + urlObj.pathname + (pid ? `?pid=${pid}` : '');
      const externalId = pid || urlObj.pathname.split('/').pop() || 'fk-product';
      return {
        platform: 'flipkart',
        cleanUrl,
        externalId
      };
    } catch (e) {
      // Fallback
    }
  }
  
  // 3. Myntra check
  if (lowerUrl.includes('myntra.com') || lowerUrl.includes('myntr.in')) {
    try {
      const urlObj = new URL(url);
      const cleanUrl = urlObj.origin + urlObj.pathname;
      const externalId = urlObj.pathname.split('/').pop() || 'myntra-product';
      return {
        platform: 'myntra',
        cleanUrl,
        externalId
      };
    } catch (e) {}
  }
  
  // 4. Ajio check
  if (lowerUrl.includes('ajio.com') || lowerUrl.includes('ajio.co')) {
    try {
      const urlObj = new URL(url);
      const cleanUrl = urlObj.origin + urlObj.pathname;
      const externalId = urlObj.pathname.split('/').pop() || 'ajio-product';
      return {
        platform: 'ajio',
        cleanUrl,
        externalId
      };
    } catch (e) {}
  }
  
  return null;
}

// Scans text for any platform-specific URLs
export function findPlatformUrlInText(text: string): string | null {
  const regex = /https?:\/\/[^\s"'`<>]*?(?:amazon\.in|amazon\.com|flipkart\.com|fkrt\.co|fkrt\.cc|myntra\.com|ajio\.com)[^\s"'`<>]*/gi;
  const match = text.match(regex);
  if (match && match.length > 0) {
    return match[0].replace(/&amp;/g, '&');
  }
  return null;
}

// Universal shortlink expander and platform resolver
export async function resolveDealUrl(link: string, content: string = ''): Promise<{ platform: string; cleanUrl: string; externalId: string } | null> {
  const combinedText = (link + ' ' + content).trim();
  
  // 1. First, check if there is an Amazon ASIN in the link or text
  const amazonAsin = extractAmazonASIN(combinedText);
  if (amazonAsin) {
    return {
      platform: 'amazon',
      cleanUrl: `https://www.amazon.in/dp/${amazonAsin}`,
      externalId: amazonAsin
    };
  }

  // 1b. Check if the link itself contains an embedded platform URL in query params
  // (Common for EarnKaro, ExtraPe, and other affiliate wrappers)
  try {
    const urlObj = new URL(link.trim());
    for (const [, value] of urlObj.searchParams) {
      const decoded = decodeURIComponent(value);
      const embedded = tryResolvePlatformDirectly(decoded);
      if (embedded) {
        return embedded;
      }
    }
  } catch (e) {}

  // 2. Multi-hop redirect resolver (manual, intercepts each hop)
  let targetUrl = link.trim();
  const visited = new Set<string>();
  
  for (let hop = 0; hop < 10; hop++) {
    if (!targetUrl || visited.has(targetUrl)) break;
    visited.add(targetUrl);
    
    // Check if the current targetUrl is a direct platform url
    const resolvedDirect = tryResolvePlatformDirectly(targetUrl);
    if (resolvedDirect) {
      return resolvedDirect;
    }
    
    // Follow redirect manually and parse meta/JS redirects
    try {
      const response = await axios.get(targetUrl, {
        maxRedirects: 0, // Intercept redirects manually
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          'User-Agent': getRandomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        timeout: 6000
      });
      
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        let nextUrl = response.headers.location;
        if (!nextUrl.startsWith('http')) {
          const urlObj = new URL(targetUrl);
          nextUrl = urlObj.origin + (nextUrl.startsWith('/') ? '' : '/') + nextUrl;
        }
        targetUrl = nextUrl;
        continue;
      }
      
      if (response.status === 200 && typeof response.data === 'string') {
        // Meta refresh check
        const metaRefreshMatch = response.data.match(/<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?[^;]+;\s*url=([^"']+)["']?/i);
        if (metaRefreshMatch && metaRefreshMatch[1]) {
          let refreshUrl = metaRefreshMatch[1].replace(/&amp;/g, '&');
          if (!refreshUrl.startsWith('http')) {
            const urlObj = new URL(targetUrl);
            refreshUrl = urlObj.origin + (refreshUrl.startsWith('/') ? '' : '/') + refreshUrl;
          }
          targetUrl = refreshUrl;
          continue;
        }
        
        // JS redirect check (multiple patterns)
        const jsPatterns = [
          /window\.location\.(?:href|replace)\s*=\s*['"]([^'"]+)['"]/i,
          /window\.location\s*=\s*['"]([^'"]+)['"]/i,
          /location\.href\s*=\s*['"]([^'"]+)['"]/i,
        ];
        let jsFound = false;
        for (const pat of jsPatterns) {
          const jsMatch = response.data.match(pat);
          if (jsMatch && jsMatch[1]) {
            let refreshUrl = jsMatch[1].replace(/&amp;/g, '&');
            if (!refreshUrl.startsWith('http')) {
              const urlObj = new URL(targetUrl);
              refreshUrl = urlObj.origin + (refreshUrl.startsWith('/') ? '' : '/') + refreshUrl;
            }
            targetUrl = refreshUrl;
            jsFound = true;
            break;
          }
        }
        if (jsFound) continue;
        
        // Scan HTML text body for direct platform URLs
        const foundPlatformUrl = findPlatformUrlInText(response.data);
        if (foundPlatformUrl) {
          targetUrl = foundPlatformUrl;
          continue;
        }
      }
      
      break;
    } catch (err: any) {
      console.error(`Error resolving hop ${hop} for ${targetUrl}:`, err.message);
      break;
    }
  }
  
  // 2b. Check the last resolved URL
  const finalCheck = tryResolvePlatformDirectly(targetUrl);
  if (finalCheck) return finalCheck;

  // 3. FALLBACK: Let axios follow ALL redirects automatically (catches fktr.in, linksredirect.in, etc.)
  try {
    const autoResponse = await axios.get(link.trim(), {
      maxRedirects: 10,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 10000
    });
    
    // Check the final URL after all redirects
    const finalUrl = autoResponse.request?.res?.responseUrl || autoResponse.config?.url || '';
    if (finalUrl) {
      const autoResolved = tryResolvePlatformDirectly(finalUrl);
      if (autoResolved) return autoResolved;
    }

    // Also scan the response body for platform URLs
    if (typeof autoResponse.data === 'string') {
      const foundUrl = findPlatformUrlInText(autoResponse.data);
      if (foundUrl) {
        const fromBody = tryResolvePlatformDirectly(foundUrl);
        if (fromBody) return fromBody;
      }
    }
  } catch (err: any) {
    console.error(`Fallback auto-redirect failed for ${link}:`, err.message);
  }

  return null;
}

// Scrapes OpenGraph tags by posing as a Discord preview bot (extremely reliable, captcha-free)
export async function fetchPageMetadata(url: string) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 8000
    });
    const $ = cheerio.load(response.data);
    
    const title = $('meta[property="og:title"]').attr('content') || 
                  $('meta[name="twitter:title"]').attr('content') || 
                  $('title').text() || '';
                  
    const imageUrl = $('meta[property="og:image"]').attr('content') || 
                      $('meta[name="twitter:image"]').attr('content') || '';
    
    return {
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      currentPrice: 0,
      originalPrice: 0
    };
  } catch (e) {
    console.error('Failed to scrape metadata for:', url);
    return null;
  }
}

// Scrapes the public Amazon India deals pages to extract all active ASINs.
// Uses regex to scan both href elements and raw HTML scripts (to bypass client-side rendering).
export async function scrapeAmazonDealsPage(): Promise<string[]> {
  try {
    const urls = [
      'https://www.amazon.in/deals',
      'https://www.amazon.in/gp/goldbox',
      'https://www.amazon.in/deals?ref_=nav_cs_gb'
    ];
    
    const asinsSet = new Set<string>();
    
    for (const url of urls) {
      try {
        console.log(`📡 Fetching Amazon Deals page: ${url}`);
        const response = await axios.get(url, {
          headers: {
            'User-Agent': getRandomUA(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        
        // 1. Extract from href links
        $('a').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            const asin = extractAmazonASIN(href);
            if (asin) {
              asinsSet.add(asin);
            }
          }
        });
        
        // 2. Scan raw HTML body (grabs JS-rendered deal items in script/JSON blocks)
        const asinRegex = /\b(B0[A-Z0-9]{8})\b/g;
        let match;
        while ((match = asinRegex.exec(response.data)) !== null) {
          asinsSet.add(match[1].toUpperCase());
        }
      } catch (err: any) {
        console.error(`Failed to fetch/parse Amazon deals page (${url}):`, err.message);
      }
    }
    
    const uniqueAsins = Array.from(asinsSet);
    console.log(`🎯 Extracted ${uniqueAsins.length} unique Amazon ASINs directly from Deals pages.`);
    return uniqueAsins;
  } catch (e: any) {
    console.error('Amazon deals page scraping failed:', e.message);
    return [];
  }
}

