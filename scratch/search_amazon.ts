import axios from 'axios';
import * as cheerio from 'cheerio';
import { fetchAmazonDetails } from '../src/lib/stealth-scraper';

const STEALTH_IDENTITIES = [
  {
    name: 'googlebot',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
    }
  },
  {
    name: 'facebookbot',
    headers: {
      'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  },
  {
    name: 'telegrambot',
    headers: {
      'User-Agent': 'TelegramBot (like TwitterBot)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  }
];

async function searchAmazon(query: string): Promise<string[]> {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  
  // Try all identities until one succeeds
  for (const identity of STEALTH_IDENTITIES) {
    try {
      const response = await axios.get(url, {
        headers: identity.headers,
        timeout: 5000
      });
      const $ = cheerio.load(response.data);
      const asins: string[] = [];
      
      $('div[data-asin]').each((_, el) => {
        const asin = $(el).attr('data-asin');
        if (asin && asin.length === 10 && !asins.includes(asin)) {
          asins.push(asin);
        }
      });
      
      if (asins.length > 0) {
        console.log(`🔍 [${identity.name}] Found ${asins.length} ASINs for query: "${query}"`);
        return asins;
      }
    } catch (e: any) {
      // Continue to next identity
    }
  }
  
  console.log(`❌ Failed to search Amazon for query: "${query}"`);
  return [];
}

async function main() {
  const query = process.argv[2] || 'Sparx sneakers men';
  const asins = await searchAmazon(query);
  console.log('Top ASINs found:', asins.slice(0, 5));
  
  if (asins.length > 0) {
    const details = await fetchAmazonDetails(asins[0]);
    console.log('Top product details:', details);
  }
}

main().catch(console.error);
