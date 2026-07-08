import { NextResponse } from 'next/server';
import { publishToTelegram } from '@/lib/telegram';

export async function POST(request: Request) {
  try {
    const { dealId, channelId } = await request.json();

    if (!dealId || !channelId) {
      return NextResponse.json({ error: 'Deal ID and Channel ID are required' }, { status: 400 });
    }

    const result = await publishToTelegram(dealId, channelId);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('API Error /telegram/publish:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
