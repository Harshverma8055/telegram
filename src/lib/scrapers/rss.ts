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
// AMAZON SCRAPER — PROTECTED MODULE
// ⚠️  DO NOT ADD AMAZON SCRAPING CODE HERE ⚠️
// The stealth scraper lives in @/lib/stealth-scraper.ts
// It is a protected file that should NEVER be modified.
// We simply re-export fetchAmazonDetails from that module.
// =====================================================================
export { fetchAmazonDetails } from '@/lib/stealth-scraper';

// Price parser — used by other parts of this file (not Amazon-specific)
function parsePrice(text: string): number {
  if (!text) return 0;
  const match = text.match(/(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return 0;
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

// Scrapes OpenGraph & JSON-LD metadata reliably (captcha-free fallback)
export async function fetchPageMetadata(url: string) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-US,en;q=0.9',
      },
      timeout: 8000
    });
    const $ = cheerio.load(response.data);
    
    let title = $('meta[property="og:title"]').attr('content') || 
                $('meta[name="twitter:title"]').attr('content') || 
                $('title').text() || '';
                  
    let imageUrl = $('meta[property="og:image"]').attr('content') || 
                    $('meta[name="twitter:image"]').attr('content') || '';
    
    let currentPrice = 0;
    let originalPrice = 0;

    // Check OpenGraph price meta tags
    const ogPrice = $('meta[property="product:price:amount"]').attr('content') ||
                    $('meta[property="og:price:amount"]').attr('content');
    if (ogPrice) {
      currentPrice = parseFloat(ogPrice);
    }

    // Parse JSON-LD structured metadata (<script type="application/ld+json">)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const text = $(el).html() || '';
        const json = JSON.parse(text);
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (!item) continue;
          if (item.name && (!title || title.length < 5)) title = item.name;
          if (item.image) {
            if (typeof item.image === 'string') imageUrl = item.image;
            else if (Array.isArray(item.image) && item.image[0]) imageUrl = typeof item.image[0] === 'string' ? item.image[0] : item.image[0].url;
            else if (item.image.url) imageUrl = item.image.url;
          }
          if (item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offers.price) currentPrice = parseFloat(String(offers.price).replace(/,/g, ''));
            else if (offers.lowPrice) currentPrice = parseFloat(String(offers.lowPrice).replace(/,/g, ''));
            if (offers.highPrice) originalPrice = parseFloat(String(offers.highPrice).replace(/,/g, ''));
          }
        }
      } catch (e) {}
    });

    // Fallback: price regex search in page body if still missing
    if (currentPrice === 0) {
      const bodyText = $('body').text();
      const match = bodyText.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)/i);
      if (match) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 10 && val < 500000) {
          currentPrice = Math.round(val);
        }
      }
    }

    return {
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      currentPrice: isNaN(currentPrice) ? 0 : currentPrice,
      originalPrice: isNaN(originalPrice) ? 0 : originalPrice
    };
  } catch (e: any) {
    console.error('Failed to scrape metadata for:', url, e.message);
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

