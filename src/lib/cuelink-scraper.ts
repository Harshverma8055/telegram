// =====================================================================
// 🔗 FLIPKART / CUELINK PRODUCT SCRAPER
//
// Scrapes product details (title, price, image) from Flipkart, Myntra,
// Ajio product pages using OpenGraph metadata + JSON-LD structured data.
//
// This is a SEPARATE scraper from the Amazon stealth-scraper.
// It does NOT modify or depend on stealth-scraper.ts in any way.
// =====================================================================

import axios from 'axios';
import * as cheerio from 'cheerio';

const BOT_IDENTITIES = [
  {
    name: 'googlebot',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
    }
  },
  {
    name: 'facebookbot',
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  },
  {
    name: 'twitterbot',
    headers: {
      'User-Agent': 'Twitterbot/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  }
];

export interface ProductDetails {
  title: string;
  currentPrice: number;
  originalPrice: number;
  imageUrl: string;
  discount: number;
}

/**
 * Scrape product details from any Flipkart/Myntra/Ajio product page.
 * Uses OG metadata + JSON-LD + page content parsing.
 */
export async function fetchProductDetails(productUrl: string): Promise<ProductDetails | null> {
  for (const identity of BOT_IDENTITIES) {
    try {
      const response = await axios.get(productUrl, {
        headers: identity.headers,
        timeout: 6000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);

      // 1. Extract title from OG or page title
      let title = $('meta[property="og:title"]').attr('content')
        || $('meta[name="title"]').attr('content')
        || $('title').text()
        || '';
      title = title.replace(/\s*[-|].*$/, '').trim(); // Remove site name suffix

      // 2. Extract image from OG
      let imageUrl = $('meta[property="og:image"]').attr('content')
        || $('meta[name="twitter:image"]').attr('content')
        || '';

      // 3. Extract price from JSON-LD structured data
      let currentPrice = 0;
      let originalPrice = 0;

      // Try JSON-LD first (most reliable)
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const jsonData = JSON.parse($(el).html() || '{}');
          const offers = jsonData.offers || jsonData.Offers || (jsonData['@graph'] && jsonData['@graph'].find((g: any) => g.offers))?.offers;
          if (offers) {
            const offer = Array.isArray(offers) ? offers[0] : offers;
            if (offer.price) currentPrice = parseFloat(offer.price) || 0;
            if (offer.highPrice) originalPrice = parseFloat(offer.highPrice) || 0;
            if (offer.listPrice) originalPrice = parseFloat(offer.listPrice) || 0;
          }
          if (jsonData.offers?.price) currentPrice = parseFloat(jsonData.offers.price) || 0;
        } catch (_) {}
      });

      // Try OG price meta tags
      if (currentPrice === 0) {
        const ogPrice = $('meta[property="product:price:amount"]').attr('content')
          || $('meta[property="og:price:amount"]').attr('content');
        if (ogPrice) currentPrice = parseFloat(ogPrice) || 0;
      }

      // Try Flipkart-specific price selectors
      if (currentPrice === 0) {
        const priceText = $('div._30jeq3, span._30jeq3, div._16Jk6d').first().text();
        const match = priceText.replace(/,/g, '').match(/(\d+)/);
        if (match) currentPrice = parseInt(match[1], 10);
      }

      // Try Flipkart MRP selector
      if (originalPrice === 0) {
        const mrpText = $('div._3I9_wc, span._3I9_wc').first().text();
        const match = mrpText.replace(/,/g, '').match(/(\d+)/);
        if (match) originalPrice = parseInt(match[1], 10);
      }

      // Try generic price patterns in page content
      if (currentPrice === 0) {
        const bodyText = $('body').text();
        const priceMatch = bodyText.match(/₹\s?([\d,]+)/);
        if (priceMatch) currentPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
      }

      if (originalPrice === 0) originalPrice = currentPrice;

      const discount = originalPrice > currentPrice && currentPrice > 0
        ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
        : 0;

      if (title && title.length > 5) {
        console.log(`✅ [${identity.name}] Scraped: "${title.substring(0, 50)}" ₹${currentPrice} (MRP: ₹${originalPrice})`);
        return { title, currentPrice, originalPrice, imageUrl, discount };
      }
    } catch (err: any) {
      // Try next identity
    }
  }

  return null;
}

/**
 * Search Flipkart for products matching a query. Returns product URLs.
 */
export async function searchFlipkart(query: string): Promise<{ url: string; productId: string }[]> {
  const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;

  for (const identity of BOT_IDENTITIES) {
    try {
      const response = await axios.get(searchUrl, {
        headers: identity.headers,
        timeout: 6000,
      });

      const $ = cheerio.load(response.data);
      const products: { url: string; productId: string }[] = [];

      // Flipkart product links
      $('a[href*="/p/"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/p/')) {
          const fullUrl = href.startsWith('http') ? href : `https://www.flipkart.com${href}`;
          // Extract product ID (itm...) from URL
          const pidMatch = fullUrl.match(/pid=([A-Z0-9]+)/i) || fullUrl.match(/\/p\/([a-z0-9]+)/i);
          const productId = pidMatch ? pidMatch[1] : fullUrl.split('/p/')[1]?.split('?')[0] || '';
          if (productId && !products.some(p => p.productId === productId)) {
            products.push({ url: fullUrl.split('?')[0], productId });
          }
        }
      });

      if (products.length > 0) {
        console.log(`🔍 [Flipkart] Found ${products.length} products for "${query}"`);
        return products;
      }
    } catch (_) {}
  }

  return [];
}
