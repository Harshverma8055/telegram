// =====================================================================
// 🔗 CUELINKS AFFILIATE LINK GENERATOR — V3 API
//
// V3 API (2024+): https://developers.cuelinks.com/pub_api/v3
// Auth: Authorization: Token <key>   (NOT the old 'token' header)
//
// HOW TO GET V3 API KEY:
// 1. Go to https://www.cuelinks.com/api-key
// 2. Sign in → Resource Center → API Key
// 3. Create new key with scopes: read:campaigns + write:links
// 4. Add CUELINKS_API_KEY to Vercel environment variables
//
// NOTE: Old V2 key (api.cuelinks.com) is DEPRECATED — use V3 key.
// =====================================================================

import axios from 'axios';

const CUELINKS_V3_BASE = 'https://developers.cuelinks.com/pub_api/v3';

/**
 * Convert any product URL into a Cuelinks V3 affiliate tracking link.
 * Works for Flipkart, Myntra, Ajio, Nykaa, Meesho, and 1000+ stores.
 *
 * @param productUrl - The original product URL
 * @param subId - Optional tracking sub-ID (e.g., 'hostel' or 'main' or 'manual')
 * @returns Affiliate link or null if Cuelinks is not configured
 */
export async function getCuelinkAffiliateUrl(
  productUrl: string,
  subId?: string
): Promise<string | null> {
  const apiKey = process.env.CUELINKS_API_KEY;

  if (!apiKey) {
    console.warn('[Cuelinks] CUELINKS_API_KEY not configured');
    return null;
  }

  try {
    const body: Record<string, any> = { url: productUrl };
    if (subId) body.sub_id_1 = subId; // V3 uses sub_id_1 to sub_id_5

    const response = await axios.post(
      `${CUELINKS_V3_BASE}/links/convert`,
      body,
      {
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );

    const data = response.data;

    // V3 response fields
    if (data?.tracking_url) {
      console.log(`🔗 [Cuelinks V3] Generated: ${data.tracking_url}`);
      return data.tracking_url;
    }
    if (data?.short_url)  return data.short_url;
    if (data?.shortUrl)   return data.shortUrl;
    if (data?.link)       return data.link;
    if (data?.url)        return data.url;

    console.warn('[Cuelinks V3] Unexpected response shape:', JSON.stringify(data).substring(0, 200));
    return null;
  } catch (error: any) {
    const status = error.response?.status;
    const body   = error.response?.data;
    console.error(`❌ [Cuelinks V3] Failed (${status}) for ${productUrl}: ${JSON.stringify(body) || error.message}`);
    return null;
  }
}

/**
 * Check if Cuelinks is configured and available.
 */
export function isCuelinksConfigured(): boolean {
  return !!process.env.CUELINKS_API_KEY;
}


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
