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
    const sharedById = process.env.EARNKARO_SHARED_BY_ID || '';
    if (!sharedById) return originalUrl;
    // EarnKaro Link wrap format
    return `https://earnkaro.com/convert?url=${encodeURIComponent(originalUrl)}&sharedby=${sharedById}`;
  }

  return originalUrl;
}
