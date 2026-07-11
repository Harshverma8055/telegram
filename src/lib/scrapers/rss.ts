import axios from 'axios';
import * as cheerio from 'cheerio';

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

// =====================================================================
// TELEGRAM SCRAPER — Now also extracts the link preview (free real data!)
// =====================================================================
export async function fetchTelegramDeals(channelName: string): Promise<RSSDeal[]> {
  try {
    const url = `https://t.me/s/${channelName}`;
    const response = await axios.get(url);
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
               lower.includes('amazn.to');
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
  let asin = extractAmazonASIN(link + ' ' + content);
  if (asin) return asin;

  const isShortlink = link.includes('amzn.to') || 
                      link.includes('grbn.in') || 
                      link.includes('amazn.lt') || 
                      link.includes('link.amazon') ||
                      link.includes('bitly.in') ||
                      link.includes('bitiy.in') ||
                      link.includes('amazn.to');
  if (isShortlink) {
    try {
      const expandRes = await fetch(link, { redirect: 'follow' });
      asin = extractAmazonASIN(expandRes.url);
    } catch (e) {
      console.error('Failed to expand shortlink:', link);
    }
  }
  return asin;
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
// MASTER AMAZON FETCHER — 4-layer priority system!
// Layer 0: Amazon PA-API (OFFICIAL — never blocked, 100% accurate)
// Layer 1: ScraperAPI proxy (if user has premium key)
// Layer 2: Direct fetch with rotating User-Agent + random delay
// Layer 3: Amazon mobile site (weaker bot detection)
// =====================================================================
export async function fetchAmazonDetails(asin: string) {
  // Layer 0: Official Amazon PA-API (THE BEST — if keys are configured)
  const paResult = await fetchFromPAAPI(asin);
  if (paResult) return paResult;

  // Layer 1: Premium proxy (if available)
  if (process.env.SCRAPER_API_KEY) {
    const result = await tryAmazonFetch(asin, 'proxy');
    if (result) return result;
  }

  // Layer 2: Direct desktop with rotating UA + delay
  await randomDelay();
  const result = await tryAmazonFetch(asin, 'desktop');
  if (result) return result;

  // Layer 3: Amazon mobile site (less aggressive blocking)
  await randomDelay();
  return tryAmazonFetch(asin, 'mobile');
}

async function tryAmazonFetch(asin: string, mode: 'proxy' | 'desktop' | 'mobile') {
  try {
    let url: string;
    let headers: Record<string, string>;

    if (mode === 'proxy') {
      const amzUrl = `https://www.amazon.in/dp/${asin}`;
      url = `http://api.scraperapi.com?api_key=${process.env.SCRAPER_API_KEY}&url=${encodeURIComponent(amzUrl)}&country_code=in`;
      headers = { 'User-Agent': getRandomUA() };
    } else if (mode === 'mobile') {
      // Amazon mobile site has weaker bot detection
      url = `https://www.amazon.in/dp/${asin}`;
      headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      };
    } else {
      url = `https://www.amazon.in/dp/${asin}`;
      headers = {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="126", "Google Chrome";v="126", "Not=A?Brand";v="8"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      };
    }

    const response = await axios.get(url, { headers, timeout: 15000 });
    const $ = cheerio.load(response.data);
    
    // Extract Title
    let title = $('#productTitle').text().trim();
    if (!title) {
      // Mobile site sometimes uses a different selector
      title = $('#title').text().trim();
    }
    if (!title) return null; // Captcha or blocked

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
    const imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src') || '';

    // Fix edge cases
    if (originalPrice < currentPrice) {
       originalPrice = Math.round(currentPrice * 1.4);
    }

    console.log(`✅ Amazon ${mode} scrape OK: ${asin} → ₹${currentPrice} (MRP: ₹${originalPrice})`);
    return { title, currentPrice, originalPrice, imageUrl };
  } catch (error) {
    console.log(`❌ Amazon ${mode} scrape failed for ${asin}`);
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

  // 2. Expand shortlink if needed
  let targetUrl = link;
  const isShortlink = 
    link.includes('amzn.to') || link.includes('grbn.in') || link.includes('amazn.lt') || link.includes('link.amazon') ||
    link.includes('bitly.in') || link.includes('bitiy.in') || link.includes('amazn.to') ||
    link.includes('fkrt.co') || link.includes('fkrt.cc') || link.includes('fktr.in') ||
    link.includes('myntr.in') || link.includes('ajio.co') || link.includes('bit.ly') || link.includes('tinyurl.com');

  if (isShortlink) {
    try {
      const expandRes = await fetch(link, { redirect: 'follow' });
      targetUrl = expandRes.url;
    } catch (e) {
      console.error('Failed to expand shortlink:', link);
    }
  }

  // 3. Resolve platform from the clean URL
  const lowerUrl = targetUrl.toLowerCase();

  // Double check Amazon after redirect
  if (lowerUrl.includes('amazon.in') || lowerUrl.includes('amazon.com')) {
    const asin = extractAmazonASIN(targetUrl);
    if (asin) {
      return {
        platform: 'amazon',
        cleanUrl: `https://www.amazon.in/dp/${asin}`,
        externalId: asin
      };
    }
  }

  if (lowerUrl.includes('flipkart.com') || lowerUrl.includes('fkrt.co') || lowerUrl.includes('fkrt.cc')) {
    try {
      const urlObj = new URL(targetUrl);
      const pid = urlObj.searchParams.get('pid');
      const cleanUrl = urlObj.origin + urlObj.pathname + (pid ? `?pid=${pid}` : '');
      const externalId = pid || urlObj.pathname.split('/').pop() || 'fk-product';
      return {
        platform: 'flipkart',
        cleanUrl,
        externalId
      };
    } catch (e) {
      return null;
    }
  }

  if (lowerUrl.includes('myntra.com') || lowerUrl.includes('myntr.in')) {
    try {
      const urlObj = new URL(targetUrl);
      const cleanUrl = urlObj.origin + urlObj.pathname;
      const externalId = urlObj.pathname.split('/').pop() || 'myntra-product';
      return {
        platform: 'myntra',
        cleanUrl,
        externalId
      };
    } catch (e) {
      return null;
    }
  }

  if (lowerUrl.includes('ajio.com') || lowerUrl.includes('ajio.co')) {
    try {
      const urlObj = new URL(targetUrl);
      const cleanUrl = urlObj.origin + urlObj.pathname;
      const externalId = urlObj.pathname.split('/').pop() || 'ajio-product';
      return {
        platform: 'ajio',
        cleanUrl,
        externalId
      };
    } catch (e) {
      return null;
    }
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
