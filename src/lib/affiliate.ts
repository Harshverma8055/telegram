/**
 * 🔗 Affiliate Link Generator
 * 
 * Amazon: Uses direct affiliate tag (gabbar0d07-21)
 * Flipkart/Myntra/Ajio/Others: Uses Cuelinks API (when configured)
 * 
 * HOW TO ACTIVATE CUELINKS:
 * Add CUELINKS_API_KEY to Vercel environment variables.
 * Sign up at https://www.cuelinks.com to get your API key.
 */

import { getCuelinkAffiliateUrl } from '@/lib/cuelinks';

// Platforms supported by Cuelinks
const CUELINKS_PLATFORMS = [
  'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tatacliq',
  'croma', 'reliance', 'snapdeal', 'shopclues', 'paytm',
];

export function getAffiliateUrl(platform: string, originalUrl: string, externalId: string): string {
  // Amazon: Direct affiliate tag (instant, no API call needed)
  if (platform === 'amazon') {
    const tag = process.env.AMAZON_AFFILIATE_TAG || '';
    return tag ? `https://www.amazon.in/dp/${externalId}?tag=${tag}` : originalUrl;
  }

  // All other platforms: Return original URL synchronously
  // (Cuelinks conversion happens async in getAffiliateUrlAsync below)
  return originalUrl;
}

/**
 * Async version — tries Cuelinks for non-Amazon platforms.
 * Use this when you can await (e.g., before posting to Telegram).
 */
export async function getAffiliateUrlAsync(
  platform: string, 
  originalUrl: string, 
  externalId: string,
  channel?: string
): Promise<string> {
  // Amazon: Direct tag
  if (platform === 'amazon') {
    const tag = process.env.AMAZON_AFFILIATE_TAG || '';
    return tag ? `https://www.amazon.in/dp/${externalId}?tag=${tag}` : originalUrl;
  }

  // Other platforms: Try Cuelinks
  if (CUELINKS_PLATFORMS.includes(platform.toLowerCase())) {
    const subId = channel === '@hosteldeals' ? 'hostel' : 'main';
    const cuelinkUrl = await getCuelinkAffiliateUrl(originalUrl, subId);
    if (cuelinkUrl) return cuelinkUrl;
  }

  // Fallback: return original URL
  return originalUrl;
}
