// =====================================================================
// 🔗 CUELINKS AFFILIATE LINK GENERATOR
//
// Cuelinks is the ONLY Indian affiliate platform with a proper API.
// It supports: Flipkart, Myntra, Ajio, Nykaa, Meesho, and 1000+ stores.
//
// HOW TO ACTIVATE:
// 1. Sign up at https://www.cuelinks.com
// 2. Add your Telegram channel URL as your "website"
// 3. Once approved: Resource Centre → API Key
// 4. Add CUELINKS_API_KEY to Vercel environment variables
//
// NOTE: EarnKaro and ExtraPe do NOT have APIs.
// They cannot be automated. Cuelinks is the only option.
// =====================================================================

import axios from 'axios';

const CUELINKS_API_URL = 'https://api.cuelinks.com/v2/link';

/**
 * Convert any product URL into a Cuelinks affiliate tracking link.
 * Works for Flipkart, Myntra, Ajio, Nykaa, Meesho, and 1000+ stores.
 * 
 * @param productUrl - The original product URL
 * @param subId - Optional tracking sub-ID (e.g., 'hostel' or 'main')
 * @returns Affiliate link or null if Cuelinks is not configured
 */
export async function getCuelinkAffiliateUrl(
  productUrl: string, 
  subId?: string
): Promise<string | null> {
  const apiKey = process.env.CUELINKS_API_KEY;
  
  if (!apiKey) {
    // Cuelinks not configured — return null (caller will use original URL)
    return null;
  }

  try {
    const response = await axios.post(
      CUELINKS_API_URL,
      {
        url: productUrl,
        shorten: true,
        ...(subId ? { subid: subId } : {}),
      },
      {
        headers: {
          'token': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    if (response.data && response.data.shortUrl) {
      console.log(`🔗 [Cuelinks] Generated affiliate link: ${response.data.shortUrl}`);
      return response.data.shortUrl;
    }

    // Some responses use different field names
    if (response.data && response.data.short_url) {
      return response.data.short_url;
    }

    if (response.data && response.data.link) {
      return response.data.link;
    }

    console.log(`⚠️ [Cuelinks] No link in response:`, JSON.stringify(response.data));
    return null;
  } catch (error: any) {
    console.error(`❌ [Cuelinks] Failed for ${productUrl}: ${error.message}`);
    return null;
  }
}

/**
 * Check if Cuelinks is configured and available.
 */
export function isCuelinksConfigured(): boolean {
  return !!process.env.CUELINKS_API_KEY;
}
