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

const EXCLUDED_ASINS = new Set([
  'B09G2H3GX1', // Destinio Umbrella
  'B00MVV81MK', // JK Copier Paper
  'B089RD1SW9', // Hauser XO Ball Pen
  'B0H6WMWQ5B', // Red Tape Sneakers
  'B0CRVNPS3Y', // CELLBELL Chair
  'B0FPXN8WQP', // Panasonic Anchor Board
  'B00N8UGUOE', // D-Link LAN Cable
  'B0DPMGQT5B', // BSY Bedsheet
  'B0CQ59PP8Q', // Sleepwell Mattress
  'B0FQ5JPXG7', // Urban Space Curtain
  'B0BD42FZJR', // Desidiya Fairy Lights
  'B0CRS38863', // Denver Deodorant
  'B079TN3GCD', // Hornbull Wallet
  'B084X79CRW'  // AmazonBasics Cable Clips
]);

const VARIETY_QUERIES = [
  { category: 'Hostel Living', subcategory: 'Umbrella', query: 'automatic 3 fold windproof umbrella' },
  { category: 'Stationery', subcategory: 'A4 Paper', query: 'Double A A4 paper copier ream 500' },
  { category: 'Stationery', subcategory: 'Pens', query: 'Cello Finegrip ball pen pack' },
  { category: 'Fashion', subcategory: 'Sneakers', query: 'Sparx sneakers men white' },
  { category: 'Hostel Living', subcategory: 'Study Chair', query: 'Savya Home ergonomic office chair black' },
  { category: 'Hostel Living', subcategory: 'Extension Board', query: 'Goldmedal extension board strip' },
  { category: 'Electronics', subcategory: 'LAN Cable', query: 'Fedus Cat6 ethernet LAN cable' },
  { category: 'Hostel Living', subcategory: 'Bed Sheet', query: 'cotton single bedsheet pillow cover' },
  { category: 'Hostel Living', subcategory: 'Mattress', query: 'single bed foam mattress fold' },
  { category: 'Hostel Living', subcategory: 'Curtain', query: 'blackout door curtains 7 feet set of 2' },
  { category: 'Hostel Living', subcategory: 'Room Lights', query: 'RGB LED strip light remote decoration' },
  { category: 'Grooming', subcategory: 'Deodorant', query: 'Fogg body spray deodorant men pack' },
  { category: 'Fashion', subcategory: 'Wallet', query: 'WildHorn slim leather wallet men' },
  { category: 'Hostel Living', subcategory: 'Cable Organizer', query: 'cable manager organizer sleeve clips' }
];

async function searchAmazon(query: string): Promise<string[]> {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
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
        if (asin && asin.length === 10 && !EXCLUDED_ASINS.has(asin) && !asins.includes(asin)) {
          asins.push(asin);
        }
      });
      if (asins.length > 0) return asins;
    } catch (_) {}
  }
  return [];
}

async function main() {
  console.log('🔄 Launching automatic Variety Products generator...');
  const results: any[] = [];
  
  for (const item of VARIETY_QUERIES) {
    console.log(`\n🔍 Searching: "${item.query}" under ${item.category} -> ${item.subcategory}...`);
    const asins = await searchAmazon(item.query);
    
    if (asins.length === 0) {
      console.log(`❌ No ASINs found for: "${item.query}"`);
      continue;
    }
    
    // Try the first 3 ASINs until one works
    let success = false;
    for (const asin of asins.slice(0, 3)) {
      console.log(`   Trying ASIN: ${asin}...`);
      const details = await fetchAmazonDetails(asin);
      
      if (details && details.title && details.currentPrice > 0 && details.imageUrl) {
        // High-res image healer (change to large image if thumbnail format)
        let cleanedImage = details.imageUrl;
        if (cleanedImage.includes('._SX') || cleanedImage.includes('._SY') || cleanedImage.includes('._SL')) {
          cleanedImage = cleanedImage.replace(/\._S[XYZL]\d+_[^.]*/, '');
        }
        
        const targetDiscount = Math.round(item.subcategory === 'Umbrella' || item.subcategory === 'Sneakers' || item.subcategory === 'Wallet' ? 30 : 20);
        const targetPrice = Math.round(details.currentPrice * (1 - targetDiscount / 100));

        const product = {
          asin,
          title: details.title,
          category: item.category,
          subcategory: item.subcategory,
          mrp: details.originalPrice,
          price: details.currentPrice,
          image: cleanedImage,
          targetDiscount,
          targetPrice
        };
        
        results.push(product);
        console.log(`   ✅ Success! Found: ${details.title.substring(0, 50)}... | ₹${details.currentPrice}`);
        success = true;
        break;
      } else {
        console.log(`   ⚠️ Failed to get complete details for ASIN ${asin}`);
      }
      
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!success) {
      console.log(`❌ Failed to resolve variety product for query "${item.query}"`);
    }
  }
  
  console.log(`\n🎉 Completed! Resolved ${results.length} variety products.`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
