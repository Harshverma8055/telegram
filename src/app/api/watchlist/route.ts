import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveDealUrl, fetchAmazonDetails } from '@/lib/scrapers/rss';
import { scrapePriceAndMRP } from '@/app/api/deals/auto-import/route'; // We can import this or implement a fallback
import { sanitizeTitle } from '@/lib/telegram';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: {
        category: 'watchlist'
      },
      include: {
        platform: true,
        history: {
          orderBy: {
            recordedAt: 'asc'
          }
        }
      },
      orderBy: {
        lastScrapedAt: 'desc'
      }
    });

    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error('Watchlist GET Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 1. Resolve platform and external ID
    const resolved = await resolveDealUrl(url);
    if (!resolved) {
      return NextResponse.json({ error: 'Failed to resolve URL to a supported platform (Amazon/Flipkart/Myntra/Ajio)' }, { status: 400 });
    }

    const { platform: platformSlug, cleanUrl, externalId } = resolved;

    // 2. Fetch platform from db
    const platform = await prisma.platform.upsert({
      where: { slug: platformSlug },
      update: {},
      create: { name: platformSlug.charAt(0).toUpperCase() + platformSlug.slice(1), slug: platformSlug }
    });

    let title = 'Tracked Product';
    let currentPrice = 0;
    let mrp = 0;
    let imageUrl = '';

    // 3. Fetch product details
    if (platformSlug === 'amazon') {
      const details = await fetchAmazonDetails(externalId);
      if (details) {
        title = details.title;
        currentPrice = details.currentPrice;
        mrp = details.originalPrice || details.currentPrice;
        imageUrl = details.imageUrl;
      }
    } else {
      // Non-Amazon fallback/scraping using simple page scraper
      try {
        const response = await fetch(cleanUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
          }
        });
        const html = await response.text();
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);

        title = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Tracked Product';
        imageUrl = $('meta[property="og:image"]').attr('content') || '';
        
        // Try parsing price from HTML
        const priceRegex = /(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)/i;
        $('span, div, p').each((_: number, el: any) => {
          const text = $(el).text().trim();
          if (text.includes('₹') || text.includes('Rs.')) {
            const match = text.match(priceRegex);
            if (match && currentPrice === 0) {
              currentPrice = parseFloat(match[1].replace(/,/g, ''));
            }
          }
        });
      } catch (e) {
        console.error('Failed to scrape non-Amazon watchlist product details:', e);
      }
    }

    if (!currentPrice) {
      currentPrice = 0;
    }
    if (!mrp) {
      mrp = currentPrice;
    }

    // 4. Upsert Product marked as watchlist
    const product = await prisma.product.upsert({
      where: {
        platformId_externalId: {
          platformId: platform.id,
          externalId: externalId
        }
      },
      update: {
        category: 'watchlist',
        currentPrice,
        mrp,
        imageUrl: imageUrl || undefined,
        title: sanitizeTitle(title),
        url: cleanUrl
      },
      create: {
        platformId: platform.id,
        externalId: externalId,
        category: 'watchlist',
        title: sanitizeTitle(title),
        url: cleanUrl,
        imageUrl: imageUrl || null,
        currentPrice,
        mrp
      }
    });

    // 5. Save Price History
    if (currentPrice > 0) {
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: currentPrice
        }
      });
    }

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error('Watchlist POST Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    // Remove from watchlist by resetting category
    await prisma.product.update({
      where: { id },
      data: { category: null }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Watchlist DELETE Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// Curated list of high-commission, low-cost products perfect for NITJ Jalandhar hostel/college students.
const studentWatchlistSeed = [
  {
    asin: 'B00P2QLCZO',
    title: 'Yonex ZR 100 Light Aluminum Badminton Racquet',
    url: 'https://www.amazon.in/dp/B00P2QLCZO',
    mrp: 1050,
    currentPrice: 849,
    imageUrl: 'https://m.media-amazon.com/images/I/71t+U5d6L2L._SL1500_.jpg'
  },
  {
    asin: 'B00T54Q63C',
    title: 'Yonex Mavis 350 Nylon Shuttlecock (Yellow)',
    url: 'https://www.amazon.in/dp/B00T54Q63C',
    mrp: 1150,
    currentPrice: 999,
    imageUrl: 'https://m.media-amazon.com/images/I/71fL98QZtDL._SL1500_.jpg'
  },
  {
    asin: 'B07T6X9V9W',
    title: 'Destinio 3-Fold Compact Windproof Automatic Umbrella',
    url: 'https://www.amazon.in/dp/B07T6X9V9W',
    mrp: 999,
    currentPrice: 599,
    imageUrl: 'https://m.media-amazon.com/images/I/61kYw1aA9RL._SL1500_.jpg'
  },
  {
    asin: 'B099K1N3NY',
    title: 'Gesto 10M 100 LED USB Copper String Fairy Lights with Remote',
    url: 'https://www.amazon.in/dp/B099K1N3NY',
    mrp: 599,
    currentPrice: 249,
    imageUrl: 'https://m.media-amazon.com/images/I/61n-6iYm25L._SL1200_.jpg'
  },
  {
    asin: 'B08J3Z8C96',
    title: 'STRIFF Adjustable Laptop Stand Multi-Angle Aluminum',
    url: 'https://www.amazon.in/dp/B08J3Z8C96',
    mrp: 999,
    currentPrice: 299,
    imageUrl: 'https://m.media-amazon.com/images/I/61V1AByi+XL._SL1500_.jpg'
  },
  {
    asin: 'B08CDSCK3V',
    title: 'Tukzer Extended Desk Mouse Pad (Waterproof, Anti-Slip)',
    url: 'https://www.amazon.in/dp/B08CDSCK3V',
    mrp: 999,
    currentPrice: 349,
    imageUrl: 'https://m.media-amazon.com/images/I/61tD99H9X+L._SL1500_.jpg'
  },
  {
    asin: 'B07Q56P4WN',
    title: 'Milton Thermosteel Duo Deluxe Stainless Steel Water Bottle 1L',
    url: 'https://www.amazon.in/dp/B07Q56P4WN',
    mrp: 1140,
    currentPrice: 949,
    imageUrl: 'https://m.media-amazon.com/images/I/61U0aD-zD3L._SL1500_.jpg'
  },
  {
    asin: 'B08HMR2SFT',
    title: 'Classmark Mesh Desk Organizer with Drawer and Pencil Holder',
    url: 'https://www.amazon.in/dp/B08HMR2SFT',
    mrp: 899,
    currentPrice: 399,
    imageUrl: 'https://m.media-amazon.com/images/I/71p0WfQfPjL._SL1500_.jpg'
  },
  {
    asin: 'B07YDJQ4JS',
    title: 'Boldfit Skipping Rope for Men and Women (Speed Jump Rope)',
    url: 'https://www.amazon.in/dp/B07YDJQ4JS',
    mrp: 499,
    currentPrice: 199,
    imageUrl: 'https://m.media-amazon.com/images/I/71nI6Pebm9L._SL1500_.jpg'
  },
  {
    asin: 'B07GLY9D1H',
    title: 'Spider Gym Protein Shaker Bottle with Storage Compartments',
    url: 'https://www.amazon.in/dp/B07GLY9D1H',
    mrp: 499,
    currentPrice: 179,
    imageUrl: 'https://m.media-amazon.com/images/I/71uV4lHn2PL._SL1500_.jpg'
  },
  {
    asin: 'B08R7W63Z9',
    title: 'Hammonds Flycatcher Genuine Leather Minimalist Slim Wallet',
    url: 'https://www.amazon.in/dp/B08R7W63Z9',
    mrp: 1299,
    currentPrice: 499,
    imageUrl: 'https://m.media-amazon.com/images/I/81xU269y-UL._SL1500_.jpg'
  },
  {
    asin: 'B09MDK2T8H',
    title: 'Yellow Chimes Magnetic Couple Connection Bracelets (Set of 2)',
    url: 'https://www.amazon.in/dp/B09MDK2T8H',
    mrp: 999,
    currentPrice: 299,
    imageUrl: 'https://m.media-amazon.com/images/I/61k2YfVn7WL._SL1000_.jpg'
  },
  {
    asin: 'B09KV76N83',
    title: 'Paper Plane Design Aesthetic Wall Collage Kit (50 Cards for Room Decor)',
    url: 'https://www.amazon.in/dp/B09KV76N83',
    mrp: 799,
    currentPrice: 249,
    imageUrl: 'https://m.media-amazon.com/images/I/81g02uGv2FL._SL1500_.jpg'
  },
  {
    asin: 'B08PBDZ1G6',
    title: 'Vills Laurrens Silk Satin Hair Scrunchies Set of 12 for Girls',
    url: 'https://www.amazon.in/dp/B08PBDZ1G6',
    mrp: 499,
    currentPrice: 149,
    imageUrl: 'https://m.media-amazon.com/images/I/71gW3x31gTL._SL1200_.jpg'
  },
  {
    asin: 'B09YRHVBD8',
    title: 'Yellow Chimes Korean Style Silver Plated Statement Hoop Earrings',
    url: 'https://www.amazon.in/dp/B09YRHVBD8',
    mrp: 1499,
    currentPrice: 199,
    imageUrl: 'https://m.media-amazon.com/images/I/51rR5+p2EEL._SL1000_.jpg'
  },
  {
    asin: 'B08B5WSP7F',
    title: 'STRIFF Universal Silicone Keyboard Protector Cover for 15.6 Inch Laptops',
    url: 'https://www.amazon.in/dp/B08B5WSP7F',
    mrp: 399,
    currentPrice: 129,
    imageUrl: 'https://m.media-amazon.com/images/I/51Kz2csk4zL._SL1000_.jpg'
  },
  {
    asin: 'B09NVCN87B',
    title: 'Noise ColorFit Pulse Grand Smart Watch with 1.69" Display',
    url: 'https://www.amazon.in/dp/B09NVCN87B',
    mrp: 3999,
    currentPrice: 1299,
    imageUrl: 'https://m.media-amazon.com/images/I/61G+h-G6A1L._SL1500_.jpg'
  },
  {
    asin: 'B079Y7ND7X',
    title: 'Fogg Master Intense Body Spray Deodorant (150ml)',
    url: 'https://www.amazon.in/dp/B079Y7ND7X',
    mrp: 299,
    currentPrice: 219,
    imageUrl: 'https://m.media-amazon.com/images/I/61+9sU1pSFL._SL1500_.jpg'
  },
  {
    asin: 'B09C6DHMK2',
    title: 'Luxor Pastel Highlighters and Sticky Notes Combo Stationery Set',
    url: 'https://www.amazon.in/dp/B09C6DHMK2',
    mrp: 350,
    currentPrice: 249,
    imageUrl: 'https://m.media-amazon.com/images/I/71YyP3sJqVL._SL1500_.jpg'
  },
  {
    asin: 'B07M6T3X7K',
    title: 'Vellinton Vintage Retro Square Sunglasses for Men & Women',
    url: 'https://www.amazon.in/dp/B07M6T3X7K',
    mrp: 999,
    currentPrice: 249,
    imageUrl: 'https://m.media-amazon.com/images/I/61WfQ1n0D0L._SL1500_.jpg'
  },
  {
    asin: 'B08NXY3JTL',
    title: 'Sparx Men casual Sneaker Shoes (Comfortable Daily Wear)',
    url: 'https://www.amazon.in/dp/B08NXY3JTL',
    mrp: 1249,
    currentPrice: 999,
    imageUrl: 'https://m.media-amazon.com/images/I/71mJ1L7zBPL._SL1500_.jpg'
  },
  {
    asin: 'B09RK8H7L5',
    title: 'Sparx Men Soft Comfort Hostel Slippers / Sandals',
    url: 'https://www.amazon.in/dp/B09RK8H7L5',
    mrp: 549,
    currentPrice: 399,
    imageUrl: 'https://m.media-amazon.com/images/I/61c-kF+W9YL._SL1500_.jpg'
  },
  {
    asin: 'B07C5VBYF5',
    title: 'Fur Jaden Anti-Theft College Backpack with USB Charging Port',
    url: 'https://www.amazon.in/dp/B07C5VBYF5',
    mrp: 2000,
    currentPrice: 699,
    imageUrl: 'https://m.media-amazon.com/images/I/61eG82dK3hL._SL1500_.jpg'
  },
  {
    asin: 'B0827B7WYR',
    title: 'Mi Micro USB to Type C OTG Adapter (Compact Connector)',
    url: 'https://www.amazon.in/dp/B0827B7WYR',
    mrp: 299,
    currentPrice: 99,
    imageUrl: 'https://m.media-amazon.com/images/I/61H4B7cW4FL._SL1500_.jpg'
  },
  {
    asin: 'B08P1Q1T5K',
    title: 'DIGITEK 10" Ring Light with Tripod Stand for Mobile/Vlogging',
    url: 'https://www.amazon.in/dp/B08P1Q1T5K',
    mrp: 1995,
    currentPrice: 499,
    imageUrl: 'https://m.media-amazon.com/images/I/61u9e5K64PL._SL1500_.jpg'
  }
];

export async function PUT() {
  try {
    // 1. Get or create Amazon platform
    const platform = await prisma.platform.upsert({
      where: { slug: 'amazon' },
      update: {},
      create: { name: 'Amazon', slug: 'amazon' }
    });

    let count = 0;
    for (const item of studentWatchlistSeed) {
      // Create or update the product
      const product = await prisma.product.upsert({
        where: {
          platformId_externalId: {
            platformId: platform.id,
            externalId: item.asin
          }
        },
        update: {
          category: 'watchlist',
          title: item.title,
          url: item.url,
          mrp: item.mrp,
          currentPrice: item.currentPrice,
          imageUrl: item.imageUrl
        },
        create: {
          platformId: platform.id,
          externalId: item.asin,
          category: 'watchlist',
          title: item.title,
          url: item.url,
          mrp: item.mrp,
          currentPrice: item.currentPrice,
          imageUrl: item.imageUrl
        }
      });

      // Insert initial price history
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: item.currentPrice
        }
      });
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('Watchlist PUT Seeding Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

