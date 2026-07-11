import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { bot } from '@/lib/telegram';
import { resolveDealUrl } from '@/lib/scrapers/rss';
import { getAffiliateUrl } from '@/lib/affiliate';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const post = await prisma.recurringPost.findUnique({
      where: { id }
    });

    if (!post) {
      return NextResponse.json({ error: 'Recurring post not found' }, { status: 404 });
    }

    let message = post.content;
    let finalLink = post.link || '';

    // If a link is provided, resolve and format it as an affiliate link if it's e-commerce
    if (finalLink) {
      const resolved = await resolveDealUrl(finalLink);
      if (resolved) {
        finalLink = getAffiliateUrl(resolved.platform, resolved.cleanUrl, resolved.externalId);
      }
    }

    const channelId = '@fantasticofffer';
    let inlineKeyboard = undefined;

    if (finalLink) {
      // Custom label based on link type
      const isTelegramLink = finalLink.toLowerCase().includes('t.me') || finalLink.toLowerCase().includes('telegram');
      const buttonText = isTelegramLink ? '👉 Join Channel' : '🛍️ View / Buy Deal';
      
      inlineKeyboard = {
        inline_keyboard: [
          [
            {
              text: buttonText,
              url: finalLink
            }
          ]
        ]
      };
    }

    if (bot) {
      if (post.imageUrl) {
        await bot.sendPhoto(channelId, post.imageUrl, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard
        });
      } else {
        await bot.sendMessage(channelId, message, {
          parse_mode: 'Markdown',
          reply_markup: inlineKeyboard
        });
      }
    } else {
      console.log(`[SIMULATION] Sending recurring post to Telegram:\n${message}\nLink: ${finalLink}`);
    }

    // Update the lastPostedAt timestamp in the database
    await prisma.recurringPost.update({
      where: { id },
      data: { lastPostedAt: new Date() }
    });

    return NextResponse.json({ success: true, simulated: !bot });

  } catch (error: any) {
    console.error('Trigger Recurring Post Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
