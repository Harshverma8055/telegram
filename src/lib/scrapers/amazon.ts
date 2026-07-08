import axios from 'axios';
import * as cheerio from 'cheerio';

interface ScrapedProduct {
  title: string;
  price: number | null;
  mrp: number | null;
  imageUrl: string | null;
  brand: string | null;
  platform: string;
  externalId: string;
  url: string;
  affiliateUrl: string;
}

export async function scrapeAmazonProduct(url: string): Promise<ScrapedProduct | null> {
  let externalId = `amz_${Date.now()}`;
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
  if (asinMatch) externalId = asinMatch[1];
  
  const cleanUrl = `https://www.amazon.in/dp/${externalId}`;
  const affiliateTag = process.env.AMAZON_AFFILIATE_TAG || '';
  const affiliateUrl = affiliateTag ? `${cleanUrl}?tag=${affiliateTag}` : cleanUrl;

  try {
    // Attempt real scrape
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      timeout: 10000,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const title = $('#productTitle').text().trim();
    if (!title) throw new Error("Title not found (Bot blocked)");
    
    let priceText = $('.a-price.aok-align-center .a-offscreen').first().text().trim() ||
                    $('#corePriceDisplay_desktop_feature_div .a-price .a-offscreen').first().text().trim() ||
                    $('.a-price .a-offscreen').first().text().trim();
                    
    let mrpText = $('.a-price.a-text-price .a-offscreen').first().text().trim() ||
                  $('.basisPrice .a-offscreen').first().text().trim();

    const imageUrl = $('#landingImage').attr('src') || null;
    const brand = $('#bylineInfo').text().replace('Visit the ', '').replace(' Store', '').trim() || null;

    const parsePrice = (str: string) => {
      if (!str) return null;
      const numStr = str.replace(/[^0-9.]/g, '');
      return parseFloat(numStr) || null;
    };

    const price = parsePrice(priceText);
    const mrp = parsePrice(mrpText);

    if (price) {
      return {
        title,
        price,
        mrp: mrp || price * 1.5, // Mock MRP if missing
        imageUrl,
        brand,
        platform: 'amazon',
        externalId,
        url: cleanUrl,
        affiliateUrl,
      };
    }
    throw new Error("Price not found");

  } catch (error: any) {
    console.error(`Scrape failed for ${url}: ${error.message}.`);
    return null;
  }
}
