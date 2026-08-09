import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

import { getCuelinkAffiliateUrl } from '@/lib/cuelinks';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Supported platforms and their display names
const SUPPORTED_PLATFORMS: Record<string, { name: string; color: string }> = {
  'flipkart.com':  { name: 'Flipkart', color: '#F9A825' },
  'myntra.com':    { name: 'Myntra',   color: '#FF3F6C' },
  'ajio.com':      { name: 'Ajio',     color: '#000000' },
  'nykaa.com':     { name: 'Nykaa',    color: '#FC2779' },
  'meesho.com':    { name: 'Meesho',   color: '#9B26AF' },
  'snapdeal.com':  { name: 'Snapdeal', color: '#E40046' },
  'tatacliq.com':  { name: 'Tata CLiQ',color: '#6B0C8F' },
  'amazon.in':     { name: 'Amazon',   color: '#FF9900' },
};

function detectPlatform(url: string): { name: string; color: string } | null {
  for (const [domain, info] of Object.entries(SUPPORTED_PLATFORMS)) {
    if (url.includes(domain)) return info;
  }
  return null;
}

// Lightly scrape product title + image from the URL
async function scrapeProductMeta(url: string): Promise<{ title: string; image: string; price: string }> {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: 7000,
      maxRedirects: 5,
    });
    const $ = cheerio.load(res.data);
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      '';
    const image =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '';
    const desc = $('meta[property="og:description"]').attr('content') || '';
    const priceMatch = desc.match(/(?:₹|Rs\.?)\s*([\d,]+)/);
    const price = priceMatch ? `₹${priceMatch[1]}` : '';

    return {
      title: title.replace(/\s*[-|].*$/, '').trim().substring(0, 120),
      image,
      price,
    };
  } catch {
    return { title: '', image: '', price: '' };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, subid } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'Product URL is required' }, { status: 400 });
    }

    const cleanUrl = url.trim();

    // Detect platform
    const platform = detectPlatform(cleanUrl);
    if (!platform) {
      return NextResponse.json({
        success: false,
        error: 'Unsupported platform. Supported: Flipkart, Myntra, Ajio, Nykaa, Meesho, Snapdeal, Tata CLiQ, Amazon',
      }, { status: 400 });
    }

    // Generate Cuelink affiliate link
    const affiliateLink = await getCuelinkAffiliateUrl(cleanUrl, subid || 'manual');

    if (!affiliateLink) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate affiliate link. Check CUELINKS_API_KEY in environment.',
      }, { status: 500 });
    }

    // Scrape product metadata (title, image, price) — best effort, don't fail if this fails
    const meta = await scrapeProductMeta(cleanUrl);

    return NextResponse.json({
      success: true,
      affiliateLink,
      originalUrl: cleanUrl,
      platform: platform.name,
      platformColor: platform.color,
      title: meta.title,
      image: meta.image,
      price: meta.price,
    });
  } catch (error: any) {
    console.error('[link-converter] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
