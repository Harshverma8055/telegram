import { NextResponse } from 'next/server';
import { publishToTelegram } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const { dealId, channelId } = await request.json();

    if (!dealId || !channelId) {
      return NextResponse.json({ error: 'Deal ID and Channel ID are required' }, { status: 400 });
    }

    const channels = typeof channelId === 'string' 
      ? channelId.split(',').map((c: string) => c.trim()) 
      : Array.isArray(channelId) 
        ? channelId 
        : [channelId];

    let lastResult = null;
    let publishedCount = 0;
    
    for (const chan of channels) {
      try {
        lastResult = await publishToTelegram(dealId, chan);
        publishedCount++;
      } catch (err: any) {
        console.error(`Failed to publish deal to ${chan}:`, err.message);
      }
    }

    if (publishedCount === 0) {
      return NextResponse.json({ error: 'Failed to publish to any target channels' }, { status: 500 });
    }

    return NextResponse.json(lastResult);

  } catch (error: any) {
    console.error('API Error /telegram/publish:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
