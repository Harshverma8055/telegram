import { PrismaClient } from '@prisma/client';
import { fetchAmazonDetails } from '../src/lib/scrapers/rss';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { category: 'watchlist' }
  });

  console.log(`Found ${products.length} watchlist products`);

  for (const p of products) {
    console.log(`Fetching details for ${p.externalId}...`);
    try {
      const details = await fetchAmazonDetails(p.externalId);
      if (details && details.imageUrl) {
        await prisma.product.update({
          where: { id: p.id },
          data: { 
            imageUrl: details.imageUrl,
            currentPrice: details.currentPrice > 0 ? details.currentPrice : undefined
          }
        });
        console.log(`Updated ${p.externalId} with image ${details.imageUrl}`);
      } else {
        console.log(`Could not fetch details for ${p.externalId}`);
      }
    } catch(e: any) {
      console.error(`Error for ${p.externalId}: ${e.message}`);
    }
    // sleep for 2s to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
}

main().finally(() => prisma.$disconnect());
