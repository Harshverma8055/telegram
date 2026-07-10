import axios from 'axios';
import * as cheerio from 'cheerio';

export interface RSSDeal {
  title: string;
  link: string;
  content: string;
  pubDate: string;
  source: string;
  imageUrl?: string;
}

// Secret unblockable method: Scrape competitors' public Telegram channels!
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

          // Extract smarter title (skip coupons, URLs, and very short lines)
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          let rawTitle = lines.length > 0 ? lines[0] : text;
          for (const line of lines) {
             const lowerLine = line.toLowerCase();
             if (lowerLine.includes('apply') && lowerLine.includes('coupon')) continue;
             if (lowerLine.includes('http') || lowerLine.includes('amzn.to')) continue;
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
            imageUrl: imageUrl || undefined
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


export async function fetchAmazonDetails(asin: string) {
  try {
    const url = `https://www.amazon.in/dp/${asin}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Extract Title
    let title = $('#productTitle').text().trim();
    if (!title) return null; // If no title, page failed or is captcha

    // Extract Deal Price
    let currentPrice = 0;
    const priceText = $('.a-price-whole').first().text().trim();
    if (priceText) {
      currentPrice = parseInt(priceText.replace(/[,.]/g, ''), 10);
    }

    // Extract Original Price (MRP)
    let originalPrice = currentPrice;
    const mrpText = $('.a-text-price .a-offscreen').first().text().trim();
    if (mrpText) {
      originalPrice = parseInt(mrpText.replace(/[^0-9]/g, ''), 10);
    }
    
    // Extract Image
    const imageUrl = $('#landingImage').attr('src') || '';

    // Fix edge cases where MRP is lower than price for some reason
    if (originalPrice < currentPrice) {
       originalPrice = Math.round(currentPrice * 1.4);
    }

    return { title, currentPrice, originalPrice, imageUrl };
  } catch (error) {
    console.error(`Direct Amazon Scrape Failed for ${asin}`);
    return null; // Return null so we can fallback to Telegram data
  }
}
