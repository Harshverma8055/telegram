import TelegramBot from 'node-telegram-bot-api';
import prisma from '@/lib/prisma';

// Initialize bot if token is available in env
const token = process.env.TELEGRAM_BOT_TOKEN || '';
// We disable polling because this will be triggered by API calls/cron jobs in a serverless environment
export const bot = token ? new TelegramBot(token, { polling: false }) : null;

interface DealMessageParams {
  title: string;
  originalPrice: number | null;
  dealPrice: number;
  discountPct: number | null;
  affiliateUrl: string;
  imageUrl?: string | null;
  score: number;
  bankOffer?: string | null;
  isVerified?: boolean; // NEW: Whether price data is from Amazon directly
}

// =====================================================================
// TITLE SANITIZER — Removes ALL traces of competitor channels
// =====================================================================
export function sanitizeTitle(rawTitle: string): string {
  return rawTitle
    // Remove all types of links
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/:\/\/\S+/gi, '')
    .replace(/(?:www\.)?amazon\.in\S*/gi, '')
    .replace(/amzn\.to\S*/gi, '')
    .replace(/t\.me\/\S*/gi, '')
    // Remove affiliate tags (e.g., ?tag=Rickeykaran77-21)
    .replace(/[?&]tag=\S+/gi, '')
    // Remove @handles
    .replace(/@\w+/g, '')
    // Remove promotional keywords
    .replace(/(?:join|telegram|channel|subscribe|group|admin|click here|link below|check bio)/gi, '')
    // Remove emoji spam at start/end
    .replace(/^[🔥⚡💥🏷️✨🎯💰🛒👇👆🔗📢]+/, '')
    .replace(/[🔥⚡💥🏷️✨🎯💰🛒👇👆🔗📢]+$/, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeMarkdown(text: string): string {
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/`/g, '\\`');
}

export function generateDealCaption(deal: DealMessageParams, platform: 'telegram' | 'whatsapp' = 'telegram'): string {
  const cleanTitle = sanitizeTitle(deal.title);
  const escapedTitle = platform === 'telegram' ? escapeMarkdown(cleanTitle) : cleanTitle;
  const escapedBankOffer = (deal.bankOffer && platform === 'telegram') ? escapeMarkdown(deal.bankOffer) : (deal.bankOffer || '');
  
  // Random templates to avoid copy detection
  const intros = [
    `⚡ Loot Alert! ⚡`,
    `🔥 Hot Deal Spotted! 🔥`,
    `💥 Massive Price Drop! 💥`,
    `🏷️ Special Offer! 🏷️`,
    `✨ Grab it Before it's Gone! ✨`,
    `🎯 Deal of the Day! 🎯`,
    `💰 Mega Savings! 💰`,
  ];
  
  const seed = cleanTitle.length || 0;
  const intro = intros[seed % intros.length];

  if (platform === 'whatsapp') {
    let msg = `${intro}\n\n`;
    msg += `*${cleanTitle.substring(0, 100)}*\n\n`;
    
    if (deal.dealPrice > 0 && deal.originalPrice && deal.originalPrice > 0) {
      msg += `❌ MRP: ~₹${deal.originalPrice.toLocaleString('en-IN')}~\n`;
      msg += `✅ *Deal Price: ₹${deal.dealPrice.toLocaleString('en-IN')}*`;
      if (deal.discountPct && deal.discountPct > 0) {
        msg += ` _(${deal.discountPct}% OFF)_`;
      }
      msg += `\n\n`;
    } else {
      msg += `✅ *Great Deal Available!*\n👉 Check the latest price on Amazon\n\n`;
    }
    
    msg += `👇 *Buy Now:* 👇\n${deal.affiliateUrl}`;
    return msg;
  }

  // =====================================================================
  // TELEGRAM CAPTION — Two modes based on price verification
  // =====================================================================
  let msg = `${intro}\n\n`;
  msg += `*${escapedTitle}*\n\n`;
  
  if (deal.dealPrice > 0 && deal.originalPrice && deal.originalPrice > 0) {
    // ✅ VERIFIED: We have real prices from Amazon — show them proudly!
    msg += `❌ MRP: ~₹${deal.originalPrice.toLocaleString('en-IN')}~\n`;
    msg += `✅ *Deal Price: ₹${deal.dealPrice.toLocaleString('en-IN')}*`;
    if (deal.discountPct && deal.discountPct > 0) {
      msg += ` _(${deal.discountPct}% OFF)_`;
    }
    msg += `\n\n`;
  } else {
    // ⚠️ UNVERIFIED: We don't have confirmed prices — be honest!
    msg += `✅ *Amazing Deal Available on Amazon!*\n`;
    msg += `👉 _Tap the button below to check the latest price_\n\n`;
  }

  if (escapedBankOffer) {
    msg += `🏦 *Bank Offer:* ${escapedBankOffer}\n\n`;
  }

  msg += `👇 *Buy Now (Link in button below)* 👇`;

  return msg;
}

export async function publishToTelegram(dealId: string, channelId: string) {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { product: true }
    });

    if (!deal) throw new Error('Deal not found');

    if (!deal.product.imageUrl || !deal.product.imageUrl.trim().startsWith('http')) {
      throw new Error('Cannot publish to Telegram: Product does not have a valid image URL');
    }

    const caption = generateDealCaption({
      title: deal.product.title,
      originalPrice: deal.originalPrice,
      dealPrice: deal.dealPrice,
      discountPct: deal.discountPct,
      affiliateUrl: deal.affiliateUrl || deal.product.url,
      score: deal.dealScore,
      bankOffer: deal.bankOffer,
      isVerified: deal.isGenuine,
    });

    if (bot) {
      const buttonOptions = [
        '👉 Check Offer',
        '⚡ Check Deal',
        '🛍️ View Deal',
        '🔥 Grab Offer',
        '🎯 Check Price'
      ];
      // Keep button text consistent per post, but diverse across different products
      const buttonText = buttonOptions[deal.product.title.length % buttonOptions.length];

      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: buttonText,
              url: deal.affiliateUrl || deal.product.url
            }
          ]
        ]
      };

      if (deal.product.imageUrl) {
        await bot.sendPhoto(channelId, deal.product.imageUrl, {
          caption: caption,
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard
        });
      } else {
        await bot.sendMessage(channelId, caption, {
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard
        });
      }
    } else {
      console.log(`[SIMULATION] Sending to ${channelId}:\n${caption}`);
    }

    // Record the post in database
    await prisma.deal.update({
      where: { id: dealId },
      data: { isPublished: true, publishedAt: new Date() }
    });

    return { success: true, caption, simulated: !bot };

  } catch (error: any) {
    console.error('Telegram publish error:', error);
    throw error;
  }
}
