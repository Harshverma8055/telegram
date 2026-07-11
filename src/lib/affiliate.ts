/**
 * Direct & Sub-Affiliate Link Generator
 * Supports: Amazon, Flipkart, Myntra, Ajio
 * Providers: Direct (for Amazon), ExtraPe, EarnKaro (for others)
 */
export function getAffiliateUrl(platform: string, originalUrl: string, externalId: string): string {
  if (platform === 'amazon') {
    const tag = process.env.AMAZON_AFFILIATE_TAG || '';
    return tag ? `https://www.amazon.in/dp/${externalId}?tag=${tag}` : originalUrl;
  }

  // Determine provider (defaults to ExtraPe if not specified in .env)
  const envKey = `${platform.toUpperCase()}_PROVIDER`; // e.g. FLIPKART_PROVIDER
  const provider = (process.env[envKey] || 'extrape').toLowerCase();

  if (provider === 'extrape') {
    const token = process.env.EXTRAPE_API_TOKEN || '';
    if (!token) return originalUrl;
    // ExtraPe API redirect URL format
    return `https://extp.in/api/redirect?token=${token}&url=${encodeURIComponent(originalUrl)}`;
  }

  if (provider === 'earnkaro') {
    // SECURITY FIX: earnkaro.com/convert does NOT work for buyers (returns 404).
    // To prevent the bot from posting broken links and ruining trust, we fallback to the clean url.
    console.warn('WARNING: Automatic EarnKaro generation is disabled (causes 404 errors). Returning clean URL instead.');
    return originalUrl;
  }

  return originalUrl;
}
