import { fetchAmazonDetails } from '../src/lib/stealth-scraper';

async function main() {
  const asins = ['B09G2H3GX1', 'B00MVV81MK'];
  for (const asin of asins) {
    console.log(`Fetching details for ASIN: ${asin}...`);
    const details = await fetchAmazonDetails(asin);
    console.log(`Result for ${asin}:`, details);
  }
}

main().catch(console.error);

