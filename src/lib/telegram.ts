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
}

export function generateDealCaption(deal: DealMessageParams, platform: 'telegram' | 'whatsapp' = 'telegram'): string {
  const scoreStars = '⭐'.repeat(Math.round(deal.score / 20));
  
  if (platform === 'whatsapp') {
    // WhatsApp Formatting: *bold*, _italic_, ~strikethrough~
    let msg = `🔥 *MASSIVE PRICE DROP!* 🔥\n\n`;
    msg += `*${deal.title.substring(0, 80)}...*\n\n`;
    
    if (deal.originalPrice) {
      msg += `❌ MRP: ~₹${deal.originalPrice.toLocaleString('en-IN')}~\n`;
    }
    msg += `✅ *Deal Price: ₹${deal.dealPrice.toLocaleString('en-IN')}*`;
    
    if (deal.discountPct) {
      msg += ` _(${deal.discountPct}% OFF)_`;
    }
    msg += `\n\n`;

    if (deal.bankOffer) {
      msg += `🏦 *Extra Offer:* ${deal.bankOffer}\n\n`;
    }

    msg += `Deal Quality: ${scoreStars}\n\n`;
    msg += `👇 *Buy Now Link:* 👇\n${deal.affiliateUrl}`;
    
    return msg;
  }

  // Telegram Formatting: Markdown parsing used by the bot
  let msg = `🔥 *Massive Deal Found!* 🔥\n\n`;
  msg += `*${deal.title}*\n\n`;
  
  if (deal.originalPrice && deal.originalPrice > 0) {
    msg += `❌ MRP: ~₹${deal.originalPrice.toLocaleString('en-IN')}~\n`;
  }
  
  if (deal.dealPrice > 0) {
    msg += `✅ *Deal Price: ₹${deal.dealPrice.toLocaleString('en-IN')}*`;
    if (deal.discountPct && deal.discountPct > 0) {
      msg += ` _(${deal.discountPct}% OFF)_`;
    }
    msg += `\n\n`;
  } else {
    msg += `✅ *Massive Discount Available!*\n👉 Click the link to reveal current price.\n\n`;
  }

  if (deal.bankOffer) {
    msg += `🏦 *Extra Offer:* ${deal.bankOffer}\n\n`;
  }

  msg += `Deal Quality: ${scoreStars} (${deal.score}/100)\n\n`;
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

    const caption = generateDealCaption({
      title: deal.product.title,
      originalPrice: deal.originalPrice,
      dealPrice: deal.dealPrice,
      discountPct: deal.discountPct,
      affiliateUrl: deal.affiliateUrl || deal.product.url,
      score: deal.dealScore,
      bankOffer: deal.bankOffer,
    });

    // In a real scenario with a valid bot token:
    if (bot) {
      const inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: '🛒 BUY NOW',
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
      // Simulation mode
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
