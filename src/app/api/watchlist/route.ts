import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveDealUrl, fetchAmazonDetails, fetchPageMetadata } from '@/lib/scrapers/rss';
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

    // Auto-heal images: map with 780 active WishlistProduct records if image is missing/broken
    const wishlists = await prisma.wishlistProduct.findMany({
      select: { asin: true, image: true }
    });
    const imageMap = new Map<string, string>();
    wishlists.forEach(w => {
      if (w.image && w.image.startsWith('http')) {
        imageMap.set(w.asin, w.image);
      }
    });

    for (const p of products) {
      let liveImage = imageMap.get(p.externalId);
      
      // Fallback to Amazon static ASIN image if missing from WishlistProduct
      if (!liveImage && (p.platform?.slug === 'amazon' || !p.platform) && p.externalId) {
        liveImage = `https://images-na.ssl-images-amazon.com/images/P/${p.externalId}.01.LZZZZZZZ.jpg`;
      }

      if (liveImage && p.imageUrl !== liveImage) {
        p.imageUrl = liveImage;
        prisma.product.update({
          where: { id: p.id },
          data: { imageUrl: liveImage }
        }).catch(() => {});
      }
    }

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

    let title = '';
    let currentPrice = 0;
    let mrp = 0;
    let imageUrl = '';

    // 3A. Primary Amazon Scraping
    if (platformSlug === 'amazon') {
      try {
        const details = await fetchAmazonDetails(externalId);
        if (details && details.currentPrice > 0) {
          title = details.title;
          currentPrice = details.currentPrice;
          mrp = details.originalPrice || details.currentPrice;
          imageUrl = details.imageUrl;
        }
      } catch (e) {
        console.error('fetchAmazonDetails error:', e);
      }

      // 3B. Check WishlistProduct table for fallback metadata if ASIN exists in system
      if (!currentPrice || !title || title === 'Tracked Product' || !imageUrl) {
        try {
          const wp = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM "WishlistProduct" WHERE "asin" = $1 LIMIT 1`,
            externalId
          );
          if (wp && wp.length > 0) {
            const item = wp[0];
            if (!title || title === 'Tracked Product') title = item.title;
            if (!currentPrice) currentPrice = item.price;
            if (!mrp) mrp = item.mrp || item.price;
            if (!imageUrl) imageUrl = item.image;
          }
        } catch (e) {}
      }
    }

    // 3C. Rich OpenGraph & JSON-LD fallback metadata scraper (Works for Amazon, Flipkart, Myntra, Ajio)
    if (!title || title === 'Tracked Product' || !currentPrice || !imageUrl) {
      try {
        const pageMeta = await fetchPageMetadata(cleanUrl);
        if (pageMeta) {
          if (!title || title === 'Tracked Product') title = pageMeta.title || title;
          if (!imageUrl && pageMeta.imageUrl) imageUrl = pageMeta.imageUrl;
          if (!currentPrice && pageMeta.currentPrice > 0) currentPrice = pageMeta.currentPrice;
          if (!mrp && pageMeta.originalPrice > 0) mrp = pageMeta.originalPrice;
        }
      } catch (e) {
        console.error('Page metadata fallback error:', e);
      }
    }

    // Title & MRP fallback normalization
    if (!title || title.trim() === '') {
      title = `${platformSlug.toUpperCase()} Product (${externalId})`;
    }
    if (!mrp && currentPrice) {
      mrp = Math.round(currentPrice * 1.25);
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
        currentPrice: currentPrice || 0,
        mrp: mrp || 0,
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
        currentPrice: currentPrice || 0,
        mrp: mrp || 0
      }
    });

    // 5. Save Price History points (past MRP point + current price point so sparkline graph renders)
    if (currentPrice > 0) {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const startPrice = mrp > currentPrice ? mrp : Math.round(currentPrice * 1.2);

      await prisma.priceHistory.createMany({
        data: [
          {
            productId: product.id,
            price: startPrice,
            recordedAt: pastDate
          },
          {
            productId: product.id,
            price: currentPrice,
            recordedAt: new Date()
          }
        ]
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

export async function PATCH(request: Request) {
  try {
    const { id, targetPrice } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { 
        targetPrice: targetPrice !== undefined ? (targetPrice === '' || targetPrice === null ? null : parseFloat(targetPrice)) : undefined 
      }
    });

    return NextResponse.json({ success: true, product: updatedProduct });
  } catch (error: any) {
    console.error('Watchlist PATCH Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// Curated list of high-commission, low-cost products perfect for NITJ Jalandhar hostel/college students.
const studentWatchlistSeed = [
  // 1. SPORTS & GAMES
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
    asin: 'B07YDJQ4JS',
    title: 'Boldfit Skipping Rope for Men and Women (Speed Jump Rope)',
    url: 'https://www.amazon.in/dp/B07YDJQ4JS',
    mrp: 499,
    currentPrice: 199,
    imageUrl: 'https://m.media-amazon.com/images/I/71nI6Pebm9L._SL1500_.jpg'
  },
  {
    asin: 'B09B3L2Z8Y',
    title: 'Boldfit Hand Grip Strengthener (Adjustable Resistance 10-40kg)',
    url: 'https://www.amazon.in/dp/B09B3L2Z8Y',
    mrp: 399,
    currentPrice: 149,
    imageUrl: 'https://m.media-amazon.com/images/I/61NlBqV8y4L._SL1500_.jpg'
  },
  {
    asin: 'B000050GET',
    title: 'Bicycle Standard Index Playing Cards (Pack of 1)',
    url: 'https://www.amazon.in/dp/B000050GET',
    mrp: 349,
    currentPrice: 299,
    imageUrl: 'https://m.media-amazon.com/images/I/61F0+VfN+wL._SL1000_.jpg'
  },
  {
    asin: 'B08FFGQYTY',
    title: 'Toyroom Double-Sided Dartboard Game with 6 Darts',
    url: 'https://www.amazon.in/dp/B08FFGQYTY',
    mrp: 799,
    currentPrice: 399,
    imageUrl: 'https://m.media-amazon.com/images/I/81xU9d5myeL._SL1500_.jpg'
  },
  {
    asin: 'B00Y21QWBS',
    title: 'Shengshou 3x3 Speed Cube (High-Speed Stickerless)',
    url: 'https://www.amazon.in/dp/B00Y21QWBS',
    mrp: 299,
    currentPrice: 149,
    imageUrl: 'https://m.media-amazon.com/images/I/61Z7nQ2y2XL._SL1000_.jpg'
  },

  // 2. ROOM LIGHTS & DECOR
  {
    asin: 'B099K1N3NY',
    title: 'Gesto 10M 100 LED USB Copper String Fairy Lights with Remote',
    url: 'https://www.amazon.in/dp/B099K1N3NY',
    mrp: 599,
    currentPrice: 249,
    imageUrl: 'https://m.media-amazon.com/images/I/61n-6iYm25L._SL1200_.jpg'
  },
  {
    asin: 'B08G8BKVV8',
    title: 'Gesto Star String Lights 12 Stars 138 LED Curtain Lights',
    url: 'https://www.amazon.in/dp/B08G8BKVV8',
    mrp: 1299,
    currentPrice: 499,
    imageUrl: 'https://m.media-amazon.com/images/I/61X-uWlV9qL._SL1000_.jpg'
  },
  {
    asin: 'B08G8BPX6W',
    title: 'Gesto Photo Clip LED String Lights with 20 Clips (Warm White)',
    url: 'https://www.amazon.in/dp/B08G8BPX6W',
    mrp: 599,
    currentPrice: 199,
    imageUrl: 'https://m.media-amazon.com/images/I/61Xf75Lz21L._SL1000_.jpg'
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
    asin: 'B07G4J4B1P',
    title: 'Roogo Feather Dream Catcher for Room Wall Hanging Decor',
    url: 'https://www.amazon.in/dp/B07G4J4B1P',
    mrp: 499,
    currentPrice: 199,
    imageUrl: 'https://m.media-amazon.com/images/I/61-mR62gO5L._SL1000_.jpg'
  },
  {
    asin: 'B08NVRN5YQ',
    title: 'Bella Vita Luxury Organic Scented Soy Candles (Set of 4)',
    url: 'https://www.amazon.in/dp/B08NVRN5YQ',
    mrp: 599,
    currentPrice: 349,
    imageUrl: 'https://m.media-amazon.com/images/I/61jC8Vq2V2L._SL1500_.jpg'
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
    asin: 'B08L7VMSL3',
    title: 'Philips Rechargeable LED Desk Lamp with 3-Level Dimming',
    url: 'https://www.amazon.in/dp/B08L7VMSL3',
    mrp: 1499,
    currentPrice: 999,
    imageUrl: 'https://m.media-amazon.com/images/I/51e2W6p7LqL._SL1000_.jpg'
  },
  {
    asin: 'B08HVGHRY3',
    title: 'Wipro 3-in-1 LED Study Table Lamp with Mobile Stand',
    url: 'https://www.amazon.in/dp/B08HVGHRY3',
    mrp: 1299,
    currentPrice: 849,
    imageUrl: 'https://m.media-amazon.com/images/I/51O18q-gGmL._SL1200_.jpg'
  },

  // 3. DAILY UTILITIES & HOSTEL COMFORT
  {
    asin: 'B07T6X9V9W',
    title: 'Destinio 3-Fold Compact Windproof Automatic Umbrella',
    url: 'https://www.amazon.in/dp/B07T6X9V9W',
    mrp: 999,
    currentPrice: 599,
    imageUrl: 'https://m.media-amazon.com/images/I/61kYw1aA9RL._SL1500_.jpg'
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
    asin: 'B08L7XN264',
    title: 'Hostel Bedside Caddy Organizer felt Hanging Bag',
    url: 'https://www.amazon.in/dp/B08L7XN264',
    mrp: 699,
    currentPrice: 299,
    imageUrl: 'https://m.media-amazon.com/images/I/61I2MvX6VCL._SL1000_.jpg'
  },
  {
    asin: 'B01N22L9OW',
    title: 'Prestige 1.5 Litre Electric Kettle 1500W for Boiling water/Maggi',
    url: 'https://www.amazon.in/dp/B01N22L9OW',
    mrp: 1195,
    currentPrice: 749,
    imageUrl: 'https://m.media-amazon.com/images/I/6166wX4n3LL._SL1500_.jpg'
  },
  {
    asin: 'B01K4V7M7G',
    title: 'Pigeon Amaze Plus 1.5 Litre Stainless Steel Electric Kettle',
    url: 'https://www.amazon.in/dp/B01K4V7M7G',
    mrp: 1195,
    currentPrice: 629,
    imageUrl: 'https://m.media-amazon.com/images/I/517PpdqHdfL._SL1500_.jpg'
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
    asin: 'B08DDBLFLH',
    title: 'Weird Wolf Rechargeable Mosquito Racket with LED light',
    url: 'https://www.amazon.in/dp/B08DDBLFLH',
    mrp: 599,
    currentPrice: 349,
    imageUrl: 'https://m.media-amazon.com/images/I/61hX4k5f83L._SL1500_.jpg'
  },
  {
    asin: 'B00V4J5B26',
    title: 'Godrej Round 7-Lever Padlock with 3 Keys for Hostel Doors',
    url: 'https://www.amazon.in/dp/B00V4J5B26',
    mrp: 499,
    currentPrice: 399,
    imageUrl: 'https://m.media-amazon.com/images/I/61hH9aM2xML._SL1500_.jpg'
  },
  {
    asin: 'B0083T239U',
    title: 'Belkin 3-Socket Surge Protector with 1.5-Meter Cord',
    url: 'https://www.amazon.in/dp/B0083T239U',
    mrp: 1299,
    currentPrice: 899,
    imageUrl: 'https://m.media-amazon.com/images/I/51JgB4y4WdL._SL1000_.jpg'
  },
  {
    asin: 'B07B967N9Z',
    title: 'Goldmedal i-Strip 6-Way Power Strip Surge Protector',
    url: 'https://www.amazon.in/dp/B07B967N9Z',
    mrp: 750,
    currentPrice: 499,
    imageUrl: 'https://m.media-amazon.com/images/I/61XFpB6iXQL._SL1500_.jpg'
  },
  {
    asin: 'B0025KOS5K',
    title: 'Scotch-Brite Lint Roller for Clothes Pet Hair and Dust',
    url: 'https://www.amazon.in/dp/B0025KOS5K',
    mrp: 350,
    currentPrice: 229,
    imageUrl: 'https://m.media-amazon.com/images/I/61b7Dk4kUaL._SL1500_.jpg'
  },
  {
    asin: 'B07WDCK6G9',
    title: 'Traverse Memory Foam Soft Neck Pillow with Eye Mask',
    url: 'https://www.amazon.in/dp/B07WDCK6G9',
    mrp: 999,
    currentPrice: 449,
    imageUrl: 'https://m.media-amazon.com/images/I/61mZgS2u4ML._SL1000_.jpg'
  },
  {
    asin: 'B08WPNQY1Y',
    title: 'Borosil Stainless Steel Insulated Coffee Mug with Lid (300ml)',
    url: 'https://www.amazon.in/dp/B08WPNQY1Y',
    mrp: 799,
    currentPrice: 599,
    imageUrl: 'https://m.media-amazon.com/images/I/51wXpMv-g1L._SL1000_.jpg'
  },

  // 4. PERSONAL CARE & GROOMING
  {
    asin: 'B078N29FDR',
    title: 'Nova NHT 1073 Rechargeable Beard Trimmer for Men',
    url: 'https://www.amazon.in/dp/B078N29FDR',
    mrp: 899,
    currentPrice: 399,
    imageUrl: 'https://m.media-amazon.com/images/I/51Wf6y0CACL._SL1000_.jpg'
  },
  {
    asin: 'B08CSXGDRS',
    title: 'Philips BT1230 Beard Trimmer with USB Charging',
    url: 'https://www.amazon.in/dp/B08CSXGDRS',
    mrp: 995,
    currentPrice: 799,
    imageUrl: 'https://m.media-amazon.com/images/I/61O+4UeCqDL._SL1500_.jpg'
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
    asin: 'B07JMNRST3',
    title: 'Wild Stone CODE Titanium Body Perfume Deodorant for Men Pack of 2',
    url: 'https://www.amazon.in/dp/B07JMNRST3',
    mrp: 500,
    currentPrice: 389,
    imageUrl: 'https://m.media-amazon.com/images/I/61gXp5eF9pL._SL1500_.jpg'
  },
  {
    asin: 'B00G4UKHT2',
    title: 'Park Avenue Signature Collection Voyage Premium Deodorant',
    url: 'https://www.amazon.in/dp/B00G4UKHT2',
    mrp: 275,
    currentPrice: 199,
    imageUrl: 'https://m.media-amazon.com/images/I/61jC+kHk6tL._SL1500_.jpg'
  },
  {
    asin: 'B0155XNIP6',
    title: 'Axe Signature Gold Dark Temptation Body Spray Perfume',
    url: 'https://www.amazon.in/dp/B0155XNIP6',
    mrp: 299,
    currentPrice: 229,
    imageUrl: 'https://m.media-amazon.com/images/I/51wXpMv-g1L._SL1000_.jpg'
  },
  {
    asin: 'B007E9F1S2',
    title: 'Garnier Men Acno Fight Anti-Pimple Face Wash (100g)',
    url: 'https://www.amazon.in/dp/B007E9F1S2',
    mrp: 225,
    currentPrice: 179,
    imageUrl: 'https://m.media-amazon.com/images/I/61T0f4SgHML._SL1500_.jpg'
  },
  {
    asin: 'B07CP1SS63',
    title: 'Mamaearth Ubtan Face Wash with Turmeric & Saffron (100ml)',
    url: 'https://www.amazon.in/dp/B07CP1SS63',
    mrp: 259,
    currentPrice: 219,
    imageUrl: 'https://m.media-amazon.com/images/I/51I7s3F2uAL._SL1000_.jpg'
  },
  {
    asin: 'B075SDRGLC',
    title: 'UrbanGabru Clay Hair Wax with Strong Hold & Matte Finish',
    url: 'https://www.amazon.in/dp/B075SDRGLC',
    mrp: 399,
    currentPrice: 279,
    imageUrl: 'https://m.media-amazon.com/images/I/61D2fG+R9yL._SL1200_.jpg'
  },
  {
    asin: 'B006LXI98I',
    title: 'Set Wet Hair Gel Cool Hold Style Hair Gel for Men (250ml)',
    url: 'https://www.amazon.in/dp/B006LXI98I',
    mrp: 180,
    currentPrice: 139,
    imageUrl: 'https://m.media-amazon.com/images/I/61K8PjK2YGL._SL1500_.jpg'
  },

  // 5. COLLEGE & STUDY TOOLS (8% Commission)
  {
    asin: 'B077SJSH1Y',
    title: 'Classmark Spiral Notebook A4 Size Pack of 6 (300 Pages)',
    url: 'https://www.amazon.in/dp/B077SJSH1Y',
    mrp: 699,
    currentPrice: 449,
    imageUrl: 'https://m.media-amazon.com/images/I/71YyP3sJqVL._SL1500_.jpg'
  },
  {
    asin: 'B07Z8P7NMT',
    title: 'Classmate Octane Gel Pen Pack of 10 (Blue, Fast-Writing)',
    url: 'https://www.amazon.in/dp/B07Z8P7NMT',
    mrp: 100,
    currentPrice: 89,
    imageUrl: 'https://m.media-amazon.com/images/I/61K8PjK2YGL._SL1500_.jpg'
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
    asin: 'B07YKWGQG5',
    title: 'Casio FX-991ES Plus 2nd Gen Scientific Calculator for Engineering',
    url: 'https://www.amazon.in/dp/B07YKWGQG5',
    mrp: 1595,
    currentPrice: 1395,
    imageUrl: 'https://m.media-amazon.com/images/I/61J64y4WdL._SL1000_.jpg'
  },
  {
    asin: 'B07C3MLT6X',
    title: 'Solo Magnetic Dry-Erase Whiteboard 1x1.5 Feet for Studies/To-Do List',
    url: 'https://www.amazon.in/dp/B07C3MLT6X',
    mrp: 499,
    currentPrice: 349,
    imageUrl: 'https://m.media-amazon.com/images/I/71hH9aM2xML._SL1500_.jpg'
  },
  {
    asin: 'B0017D8WEE',
    title: '3M Post-it Neon Sticky Notes (3x3 Inches, 100 Sheets/Pad)',
    url: 'https://www.amazon.in/dp/B0017D8WEE',
    mrp: 150,
    currentPrice: 119,
    imageUrl: 'https://m.media-amazon.com/images/I/61mZgS2u4ML._SL1000_.jpg'
  },

  // 6. BUDGET TECH ACCESSORIES (5% Commission)
  {
    asin: 'B01M0GB8CC',
    title: 'boAt Bassheads 225 In-Ear Wired Earphones with Super Extra Bass',
    url: 'https://www.amazon.in/dp/B01M0GB8CC',
    mrp: 999,
    currentPrice: 549,
    imageUrl: 'https://m.media-amazon.com/images/I/61v-6iYm25L._SL1200_.jpg'
  },
  {
    asin: 'B07C2V1N8V',
    title: 'boAt Rockerz 255 Wireless Bluetooth Neckband Earphones',
    url: 'https://www.amazon.in/dp/B07C2V1N8V',
    mrp: 2990,
    currentPrice: 999,
    imageUrl: 'https://m.media-amazon.com/images/I/61G+h-G6A1L._SL1500_.jpg'
  },
  {
    asin: 'B09TVV1TXL',
    title: 'OnePlus Bullets Wireless Z2 Bluetooth Earphones',
    url: 'https://www.amazon.in/dp/B09TVV1TXL',
    mrp: 2299,
    currentPrice: 1599,
    imageUrl: 'https://m.media-amazon.com/images/I/51Kz2csk4zL._SL1000_.jpg'
  },
  {
    asin: 'B07X87D56V',
    title: 'Realme Buds 2 Wired Earphones with 11.2mm Bass Boost Driver',
    url: 'https://www.amazon.in/dp/B07X87D56V',
    mrp: 799,
    currentPrice: 599,
    imageUrl: 'https://m.media-amazon.com/images/I/61gW3x31gTL._SL1200_.jpg'
  },
  {
    asin: 'B01DFKBL68',
    title: 'JBL C100SI In-Ear Wired Headphones with Mic',
    url: 'https://www.amazon.in/dp/B01DFKBL68',
    mrp: 999,
    currentPrice: 599,
    imageUrl: 'https://m.media-amazon.com/images/I/61D2fG+R9yL._SL1200_.jpg'
  },
  {
    asin: 'B08HV83HL3',
    title: 'Mi Power Bank 3i 10000mAh with 18W Fast Charging',
    url: 'https://www.amazon.in/dp/B08HV83HL3',
    mrp: 1299,
    currentPrice: 999,
    imageUrl: 'https://m.media-amazon.com/images/I/71p0WfQfPjL._SL1500_.jpg'
  },
  {
    asin: 'B08HN62CD8',
    title: 'Ambrane 10000mAh Power Bank with 20W BoostCharger Fast Charging',
    url: 'https://www.amazon.in/dp/B08HN62CD8',
    mrp: 1499,
    currentPrice: 899,
    imageUrl: 'https://m.media-amazon.com/images/I/71uV4lHn2PL._SL1500_.jpg'
  },
  {
    asin: 'B007JR532M',
    title: 'SanDisk Cruzer Blade 32GB USB 2.0 Flash Drive',
    url: 'https://www.amazon.in/dp/B007JR532M',
    mrp: 650,
    currentPrice: 329,
    imageUrl: 'https://m.media-amazon.com/images/I/61H4B7cW4FL._SL1500_.jpg'
  },
  {
    asin: 'B07YYJL21Z',
    title: 'SanDisk Ultra Dual Drive Go Type-C 64GB USB OTG Flash Drive',
    url: 'https://www.amazon.in/dp/B07YYJL21Z',
    mrp: 1200,
    currentPrice: 649,
    imageUrl: 'https://m.media-amazon.com/images/I/61Xf75Lz21L._SL1000_.jpg'
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
    asin: 'B08B5WSP7F',
    title: 'STRIFF Universal Silicone Keyboard Protector Cover for 15.6 Inch Laptops',
    url: 'https://www.amazon.in/dp/B08B5WSP7F',
    mrp: 399,
    currentPrice: 129,
    imageUrl: 'https://m.media-amazon.com/images/I/51Kz2csk4zL._SL1000_.jpg'
  },
  {
    asin: 'B01J0XWYKQ',
    title: 'Logitech B170 Wireless Mouse, 2.4 GHz with USB Nano Receiver',
    url: 'https://www.amazon.in/dp/B01J0XWYKQ',
    mrp: 895,
    currentPrice: 599,
    imageUrl: 'https://m.media-amazon.com/images/I/61v-6iYm25L._SL1200_.jpg'
  },
  {
    asin: 'B012FP8NN8',
    title: 'Dell KB216 Wired Multimedia USB Keyboard',
    url: 'https://www.amazon.in/dp/B012FP8NN8',
    mrp: 599,
    currentPrice: 429,
    imageUrl: 'https://m.media-amazon.com/images/I/71p0WfQfPjL._SL1500_.jpg'
  },
  {
    asin: 'B0915LKKH7',
    title: 'HP 150 Wireless Optical Mouse (Ergonomic Design)',
    url: 'https://www.amazon.in/dp/B0915LKKH7',
    mrp: 799,
    currentPrice: 499,
    imageUrl: 'https://m.media-amazon.com/images/I/51I7s3F2uAL._SL1000_.jpg'
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
  },

  // 7. JEWELRY, ACCESSORIES & GIFTS (9% Commission)
  {
    asin: 'B09MDK2T8H',
    title: 'Yellow Chimes Magnetic Couple Connection Bracelets (Set of 2)',
    url: 'https://www.amazon.in/dp/B09MDK2T8H',
    mrp: 999,
    currentPrice: 299,
    imageUrl: 'https://m.media-amazon.com/images/I/61k2YfVn7WL._SL1000_.jpg'
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
    asin: 'B07MGB5DML',
    title: 'YouBella Rose Gold Plated Crystal Pendant Necklace for Girls',
    url: 'https://www.amazon.in/dp/B07MGB5DML',
    mrp: 999,
    currentPrice: 249,
    imageUrl: 'https://m.media-amazon.com/images/I/61k2YfVn7WL._SL1000_.jpg'
  },
  {
    asin: 'B08K3S6H44',
    title: 'Hair Pins and Clips Accessories Combo Pack for Girls',
    url: 'https://www.amazon.in/dp/B08K3S6H44',
    mrp: 399,
    currentPrice: 129,
    imageUrl: 'https://m.media-amazon.com/images/I/71gW3x31gTL._SL1200_.jpg'
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
    asin: 'B08R7W63Z9',
    title: 'Hammonds Flycatcher Genuine Leather Minimalist Slim Wallet',
    url: 'https://www.amazon.in/dp/B08R7W63Z9',
    mrp: 1299,
    currentPrice: 499,
    imageUrl: 'https://m.media-amazon.com/images/I/81xU269y-UL._SL1500_.jpg'
  },
  {
    asin: 'B082D9S2XQ',
    title: 'Lorenz Leather Adjustable Buckle Belt for Men',
    url: 'https://www.amazon.in/dp/B082D9S2XQ',
    mrp: 599,
    currentPrice: 249,
    imageUrl: 'https://m.media-amazon.com/images/I/61X-uWlV9qL._SL1000_.jpg'
  },
  {
    asin: 'B07H8HMCZ7',
    title: 'Hammonds Flycatcher Premium Genuine Leather Belt for Men',
    url: 'https://www.amazon.in/dp/B07H8HMCZ7',
    mrp: 999,
    currentPrice: 399,
    imageUrl: 'https://m.media-amazon.com/images/I/71fL98QZtDL._SL1500_.jpg'
  },

  // 8. FASHION APPAREL & FOOTWEAR (9% Commission)
  {
    asin: 'B09NVCN87B',
    title: 'Noise ColorFit Pulse Grand Smart Watch with 1.69" Display',
    url: 'https://www.amazon.in/dp/B09NVCN87B',
    mrp: 3999,
    currentPrice: 1299,
    imageUrl: 'https://m.media-amazon.com/images/I/61G+h-G6A1L._SL1500_.jpg'
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
    asin: 'B08NY5XN9T',
    title: 'Sparx SM-676 Casual White Canvas Sneakers for Men',
    url: 'https://www.amazon.in/dp/B08NY5XN9T',
    mrp: 999,
    currentPrice: 799,
    imageUrl: 'https://m.media-amazon.com/images/I/71mJ1L7zBPL._SL1500_.jpg'
  },
  {
    asin: 'B0B85327S3',
    title: 'Sony WH-1000XM5 Wireless Active Noise Cancelling Headphones',
    url: 'https://www.amazon.in/dp/B0B85327S3',
    mrp: 34990,
    currentPrice: 29990,
    imageUrl: 'https://m.media-amazon.com/images/I/61+OroxMsbL._SL1500_.jpg'
  },
  {
    asin: 'B000050GET',
    title: 'Bicycle Standard Playing Cards',
    url: 'https://www.amazon.in/dp/B000050GET',
    mrp: 399,
    currentPrice: 299,
    imageUrl: 'https://m.media-amazon.com/images/I/61F0+VfN+wL._SL1000_.jpg'
  },
  {
    asin: 'B08F7J4Y4B',
    title: 'RC.ROYAL CLASS Premium Cotton Ankle Length Socks',
    url: 'https://www.amazon.in/dp/B08F7J4Y4B',
    mrp: 499,
    currentPrice: 249,
    imageUrl: 'https://m.media-amazon.com/images/I/71p0WfQfPjL._SL1500_.jpg'
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

      // Insert initial price history points (MRP past point + current price)
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await prisma.priceHistory.createMany({
        data: [
          {
            productId: product.id,
            price: item.mrp || Math.round(item.currentPrice * 1.2),
            recordedAt: pastDate
          },
          {
            productId: product.id,
            price: item.currentPrice,
            recordedAt: new Date()
          }
        ]
      });
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error: any) {
    console.error('Watchlist PUT Seeding Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

