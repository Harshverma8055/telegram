import { NextResponse } from 'next/server';
import { resolveDealUrl, fetchPageMetadata, fetchAmazonDetails } from '@/lib/scrapers/rss';
import * as cheerio from 'cheerio';
import axios from 'axios';
import prisma from '@/lib/prisma';

// Helper to scrape HTML and extract pricing info for Flipkart, Myntra, Ajio
export async function scrapePriceAndMRP(url: string, platform: string) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: 8000
    });
    const $ = cheerio.load(response.data);
    
    let price = 0;
    let mrp = 0;

    // 1. Try JSON-LD
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        
        function searchJson(obj: any) {
          if (!obj || typeof obj !== 'object') return;
          if (obj['@type'] === 'Offer' || obj['price'] !== undefined) {
            const p = parseFloat(obj['price']);
            if (p > 0) price = Math.round(p);
          }
          if (obj['priceSpecification']) {
            const specs = Array.isArray(obj['priceSpecification']) ? obj['priceSpecification'] : [obj['priceSpecification']];
            for (const spec of specs) {
              const p = parseFloat(spec.price);
              if (p > 0) {
                if (spec.priceType === 'http://schema.org/ListPrice' || spec.name?.toLowerCase().includes('mrp')) {
                  mrp = Math.round(p);
                } else {
                  price = Math.round(p);
                }
              }
            }
          }
          for (const key in obj) {
            searchJson(obj[key]);
          }
        }
        searchJson(json);
      } catch (e) {}
    });

    // 2. Try Meta tags
    if (price === 0) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') || 
                        $('meta[property="og:price:amount"]').attr('content') ||
                        $('meta[property="product:sale_price:amount"]').attr('content');
      if (metaPrice) price = Math.round(parseFloat(metaPrice));
    }
    if (mrp === 0) {
      const metaMrp = $('meta[property="product:retail_price:amount"]').attr('content') ||
                      $('meta[property="product:original_price:amount"]').attr('content');
      if (metaMrp) mrp = Math.round(parseFloat(metaMrp));
    }

    // 3. Platform-specific fallback HTML selectors
    if (platform === 'flipkart') {
      if (price === 0) {
        const text = $('._30jeq3').first().text() || $('.Nx9bqj').first().text();
        if (text) price = parsePrice(text);
      }
      if (mrp === 0) {
        const text = $('._3I9_R0').first().text() || $('.yKfJKb').first().text() || $('.y30UQb').first().text();
        if (text) mrp = parsePrice(text);
      }
    } else if (platform === 'myntra') {
      if (price === 0) {
        const text = $('.pdp-price').first().text();
        if (text) price = parsePrice(text);
      }
      if (mrp === 0) {
        const text = $('.pdp-mrp').first().text();
        if (text) mrp = parsePrice(text);
      }
    } else if (platform === 'ajio') {
      if (price === 0) {
        const text = $('.prod-sp').first().text();
        if (text) price = parsePrice(text);
      }
      if (mrp === 0) {
        const text = $('.prod-cp').first().text();
        if (text) mrp = parsePrice(text);
      }
    }

    if (mrp < price) mrp = price;

    return { price, mrp };
  } catch (e) {
    console.error('Failed to scrape prices:', e);
    return { price: 0, mrp: 0 };
  }
}

function parsePrice(text: string): number {
  if (!text) return 0;
  const match = text.match(/([\d,]+)/);
  if (!match) return 0;
  return Math.round(parseFloat(match[1].replace(/,/g, '')));
}

export async function POST(request: Request) {
  try {
    const { link } = await request.json();
    if (!link) {
      return NextResponse.json({ error: 'Link is required' }, { status: 400 });
    }

    // 1. Resolve shortlinks / EarnKaro / ExtraPe redirects to get the clean destination URL
    const resolved = await resolveDealUrl(link);
    if (!resolved) {
      return NextResponse.json({ error: 'Could not resolve e-commerce platform from link. Supported platforms: Amazon, Flipkart, Myntra, Ajio.' }, { status: 400 });
    }

    const { platform, cleanUrl, externalId } = resolved;
    let title = '';
    let imageUrl = '';
    let currentPrice = 0;
    let originalPrice = 0;

    // A. Check database first to avoid scraping blocks and speed up page load
    const existingProduct = await prisma.product.findFirst({
      where: {
        platform: { slug: platform },
        externalId: externalId
      }
    });

    if (existingProduct) {
      title = existingProduct.title;
      imageUrl = existingProduct.imageUrl || '';
      currentPrice = existingProduct.currentPrice || 0;
      originalPrice = existingProduct.mrp || 0;
    } else {
      // B. Fetch platform details if not cached in DB
      if (platform === 'amazon') {
        const details = await fetchAmazonDetails(externalId);
        if (details) {
          title = details.title;
          imageUrl = details.imageUrl || '';
          currentPrice = details.currentPrice;
          originalPrice = details.originalPrice;
        } else {
          // Fallback to fetchPageMetadata to at least get Title and Image
          const meta = await fetchPageMetadata(cleanUrl);
          if (meta) {
            title = meta.title;
            imageUrl = meta.imageUrl;
          }
        }
      } else {
        // Scrape Flipkart / Myntra / Ajio metadata and price info
        const meta = await fetchPageMetadata(cleanUrl);
        if (meta) {
          title = meta.title;
          imageUrl = meta.imageUrl;
        }
        const prices = await scrapePriceAndMRP(cleanUrl, platform);
        currentPrice = prices.price;
        originalPrice = prices.mrp;
      }
    }

    // Standardize title (clean up "Buy ... online at Flipkart/Myntra/Ajio")
    if (title) {
      title = title
        .replace(/Buy\s+/i, '')
        .replace(/\s+Online\s+at\s+Best\s+Prices\s+.*$/i, '')
        .replace(/\s+-\s+Flipkart\.com$/i, '')
        .replace(/\s+\|\s+Myntra.*$/i, '')
        .replace(/\s+-\s+Ajio.*$/i, '')
        .trim();
    }

    // Calculate discount percent
    let discountPct = 0;
    if (originalPrice > 0 && currentPrice > 0 && originalPrice > currentPrice) {
      discountPct = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }

    return NextResponse.json({
      success: true,
      platform,
      cleanUrl,
      externalId,
      title,
      imageUrl,
      currentPrice,
      originalPrice,
      discountPct
    });

  } catch (error: any) {
    console.error('Auto Import Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
