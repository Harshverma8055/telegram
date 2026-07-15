import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { bot, escapeMarkdown } from '@/lib/telegram';
import { getAffiliateUrl } from '@/lib/affiliate';
import { ensureWishlistTableExists } from '@/lib/scrapers/amazon-research';

const DEFAULT_TELEGRAM_CHANNEL = process.env.TELEGRAM_CHANNEL || '@fantasticofffer';

export async function POST(request: Request) {
  try {
    await ensureWishlistTableExists();
    const body = await request.json();
    const { id, channel } = body;
    const targetChannel = channel || DEFAULT_TELEGRAM_CHANNEL;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing product ID' }, { status: 400 });
    }

    // 1. Fetch the wishlist product
    const wishlistProduct = await prisma.$queryRaw<any[]>`
      SELECT * FROM "WishlistProduct" WHERE "id" = ${id} LIMIT 1
    `;

    if (wishlistProduct.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const prod = wishlistProduct[0];

    // 2. Generate the Amazon Affiliate Link
    const affiliateUrl = getAffiliateUrl('amazon', prod.amazon_url, prod.asin);

    // 3. Format the Telegram Message Caption
    const intros = [
      `⚡ *Loot Alert!* ⚡`,
      `🔥 *Hot Deal Spotted!* 🔥`,
      `💥 *Massive Price Drop!* 💥`,
      `🏷️ *Special Offer!* 🏷️`,
      `✨ *Grab it Before it's Gone!* ✨`,
      `🎯 *Deal of the Day!* 🎯`,
      `💰 *Mega Savings!* 💰`,
    ];
    const intro = intros[prod.title.length % intros.length];
    const escapedTitle = escapeMarkdown(prod.title);

    let caption = `${intro}\n\n`;
    caption += `*${escapedTitle}*\n\n`;
    
    // Add Price/MRP info
    caption += `❌ MRP: ~₹${prod.mrp.toLocaleString('en-IN')}~\n`;
    caption += `✅ *Deal Price: ₹${prod.price.toLocaleString('en-IN')}*`;
    if (prod.discount > 0) {
      caption += ` _(${Math.round(prod.discount)}% OFF)_`;
    }
    caption += `\n\n`;

    // Add Badges / Promo info
    let hasBadges = false;
    if (prod.coupon) {
      caption += `🎟️ *Coupon Available!* (Tick box on Amazon to save)\n`;
      hasBadges = true;
    }
    if (prod.prime) {
      caption += `🚚 *Prime Eligible* (Free & Fast delivery)\n`;
      hasBadges = true;
    }
    if (prod.amazon_choice) {
      caption += `🎖️ *Amazon's Choice*\n`;
      hasBadges = true;
    }
    if (prod.best_seller) {
      caption += `🏆 *Best Seller*\n`;
      hasBadges = true;
    }
    if (prod.deal_type === 'lightning') {
      caption += `⚡ *Lightning Deal* (Limited time offer)\n`;
      hasBadges = true;
    }
    if (hasBadges) {
      caption += `\n`;
    }

    // Add ratings & reviews if available
    if (prod.rating && prod.review_count > 0) {
      caption += `⭐ *Rating:* ${prod.rating} / 5 (${prod.review_count.toLocaleString('en-IN')} reviews)\n\n`;
    }

    caption += `👇 *Grab the deal now! (Link in button below)* 👇`;

    // Add Hashtags
    const hashCat = prod.category.replace(/[^a-zA-Z0-9]/g, '');
    const hashSubcat = prod.subcategory.replace(/[^a-zA-Z0-9]/g, '');
    caption += `\n\n#${hashCat} #${hashSubcat} #AmazonDeals #CollegeEssentials`;

    // 4. Send to Telegram
    let messageSent = false;
    if (bot) {
      const buttonText = '🛍️ Buy on Amazon';
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: buttonText,
              url: affiliateUrl
            }
          ]
        ]
      };

      if (prod.image && prod.image.startsWith('http')) {
        await bot.sendPhoto(targetChannel, prod.image, {
          caption: caption,
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard
        });
      } else {
        await bot.sendMessage(targetChannel, caption, {
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard
        });
      }
      messageSent = true;
    } else {
      console.log(`[SIMULATION] Publishing Wishlist Product ${prod.asin} to Telegram:\n${caption}`);
    }

    // 5. Integrate into the main Deals/Products tables so it registers in Analytics
    try {
      // Find or create Amazon platform in main table
      const amazonPlatform = await prisma.platform.upsert({
        where: { slug: 'amazon' },
        update: {},
        create: { name: 'Amazon', slug: 'amazon' }
      });

      // Upsert into main Product table
      const mainProduct = await prisma.product.upsert({
        where: {
          platformId_externalId: {
            platformId: amazonPlatform.id,
            externalId: prod.asin
          }
        },
        update: {
          title: prod.title,
          brand: prod.brand,
          category: prod.category,
          mrp: prod.mrp,
          currentPrice: prod.price,
          imageUrl: prod.image,
          rating: prod.rating,
          reviewCount: prod.review_count,
          lastScrapedAt: new Date()
        },
        create: {
          platformId: amazonPlatform.id,
          externalId: prod.asin,
          title: prod.title,
          brand: prod.brand,
          category: prod.category,
          mrp: prod.mrp,
          currentPrice: prod.price,
          url: prod.amazon_url,
          imageUrl: prod.image,
          rating: prod.rating,
          reviewCount: prod.review_count,
        }
      });

      // Create record in Deal table
      await prisma.deal.create({
        data: {
          productId: mainProduct.id,
          platformId: amazonPlatform.id,
          dealType: prod.deal_type === 'none' ? 'wishlist_publish' : prod.deal_type,
          dealScore: Math.round(prod.priority_score),
          originalPrice: prod.mrp,
          dealPrice: prod.price,
          discountPct: prod.discount,
          affiliateUrl: affiliateUrl,
          isGenuine: true,
          isPublished: true,
          publishedAt: new Date(),
        }
      });

      // Mark as published in WishlistProduct (optional or keep it to track status)
      await prisma.$executeRawUnsafe(
        `UPDATE "WishlistProduct" SET "wishlist" = false, "last_updated" = NOW() WHERE "id" = $1`,
        id
      );

    } catch (integrationErr: any) {
      console.error('⚠️ [PublishWishlist] Main tables integration error:', integrationErr.message);
    }

    return NextResponse.json({
      success: true,
      message: messageSent ? 'Published successfully to Telegram!' : 'Published (Simulation mode, bot token missing)',
      caption
    });

  } catch (error: any) {
    console.error('❌ [PublishWishlist] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
