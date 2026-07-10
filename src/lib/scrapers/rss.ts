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

      const amzLink = links.find(l => l.includes('amazon.in') || l.includes('amzn.to')) || '';

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
  const asinMatch = text.match(/\/(?:dp|product)\/([A-Z0-9]{10})/i);
  if (asinMatch) return asinMatch[1];
  return null;
}

// =====================================================================
// DIRECT AMAZON SCRAPER — 3-layer free bypass system!
// Layer 1: ScraperAPI proxy (if user has premium key)
// Layer 2: Direct fetch with rotating User-Agent + random delay
// Layer 3: Amazon mobile site (weaker bot detection)
// =====================================================================
export async function fetchAmazonDetails(asin: string) {
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
        const parsed = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
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
        const parsed = parseInt(mrpText.replace(/[^0-9]/g, ''), 10);
        if (parsed > 0) { originalPrice = parsed; break; }
      }
    }

    // Also try the "M.R.P." row
    const mrpRow = $('span:contains("M.R.P.")').parent().find('.a-offscreen, .a-text-price').first().text().trim();
    if (mrpRow) {
      const parsed = parseInt(mrpRow.replace(/[^0-9]/g, ''), 10);
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
