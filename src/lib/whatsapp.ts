import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { generateDealCaption } from './telegram';
import prisma from './prisma';

// Initialize WhatsApp Client
// LocalAuth saves the session locally so you don't have to scan the QR code every time
let client: Client | null = null;
let isReady = false;

export function initWhatsApp() {
  if (client) return client;

  console.log('Initializing WhatsApp Client...');
  
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
  });

  client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('\n======================================================');
    console.log('WHATSAPP QR CODE: Scan this with your WhatsApp app');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    isReady = true;
    console.log('✅ WhatsApp Client is READY!');
  });

  client.on('auth_failure', msg => {
    console.error('❌ WhatsApp Authentication failure', msg);
  });

  client.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp:', err);
  });

  return client;
}

export async function publishToWhatsApp(dealId: string, targetGroupId: string) {
  if (!isReady || !client) {
    console.log('[SIMULATION] WhatsApp client not ready. Simulating publish...');
  }

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
    }, 'whatsapp');

    if (isReady && client) {
      // Send message to WhatsApp Group/Number
      await client.sendMessage(targetGroupId, caption);
    } else {
      console.log(`[SIMULATION] Sending to WhatsApp Group ${targetGroupId}:\n${caption}`);
    }

    // Record the post in database
    await prisma.deal.update({
      where: { id: dealId },
      data: { isPublished: true, publishedAt: new Date() }
    });

    return { success: true, caption, simulated: !isReady };

  } catch (error: any) {
    console.error('WhatsApp publish error:', error);
    throw error;
  }
}
