const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const cheerio = require('cheerio');
const dns = require('dns');
const https = require('https');

const prisma = new PrismaClient();

// Mirror setup from rss.ts
const customDnsLookup = (hostname, options, callback) => {
  if (hostname === 't.me' || hostname === 'telegram.me') {
    if (options && options.all) {
      callback(null, [{ address: '149.154.167.99', family: 4 }]);
    } else {
      callback(null, '149.154.167.99', 4);
    }
  } else {
    dns.lookup(hostname, options, callback);
  }
};
const telegramHttpsAgent = new https.Agent({ lookup: customDnsLookup });

async function fetchTelegramDeals(channelName) {
  try {
    const url = `https://t.me/s/${channelName}`;
    const response = await axios.get(url, {
      httpsAgent: telegramHttpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
      timeout: 8000
    });
    const $ = cheerio.load(response.data);
    const deals = [];
    $('.tgme_widget_message').each((i, el) => {
      const text = $(el).find('.tgme_widget_message_text').text();
      const time = $(el).find('time').attr('datetime') || new Date().toISOString();
      
      const links = [];
      $(el).find('a').each((_, a) => {
        const href = $(a).attr('href');
        if (href) links.push(href);
      });

      const amzLink = links.find(l => {
        const lower = l.toLowerCase();
        return lower.includes('amazon.in') || 
               lower.includes('amzn.to') || 
               lower.includes('grbn.in') || 
               lower.includes('amazn.lt') ||
               lower.includes('link.amazon') ||
               lower.includes('bitly.in') ||
               lower.includes('bitiy.in') ||
               lower.includes('amazn.to') ||
               lower.includes('flipkart.com') ||
               lower.includes('fkrt.co') ||
               lower.includes('fkrt.cc') ||
               lower.includes('fktr.in') ||
               lower.includes('linksredirect.in') ||
               lower.includes('myntra.com') ||
               lower.includes('myntr.in') ||
               lower.includes('ajio.com');
      }) || '';

      if (amzLink) {
        deals.push({
          title: $(el).find('.tgme_widget_message_link_preview_title').text().trim(),
          link: amzLink,
          content: text,
          time
        });
      }
    });
    return deals;
  } catch (e) {
    console.error(`Error fetching channel ${channelName}:`, e.message);
    return [];
  }
}

async function run() {
  console.log('--- STARTING CRON DIAGNOSTIC TEST ---');
  
  const testChannel = 'LootDealsIndia';
  console.log(`Scraping latest deals from competitor channel: ${testChannel}...`);
  const deals = await fetchTelegramDeals(testChannel);
  console.log(`Found ${deals.length} deals in the last channel scrape.`);

  if (deals.length === 0) {
    console.log('No deals found. Scraping failed or no links in feed.');
    return;
  }

  for (let i = 0; i < Math.min(5, deals.length); i++) {
    const item = deals[i];
    console.log(`\nCandidate [${i + 1}]:`);
    console.log(`- Title: "${item.title || 'No Title'}"`);
    console.log(`- Link: ${item.link}`);
    console.log(`- Time: ${item.time}`);
    
    const postDate = new Date(item.time);
    const now = new Date();
    const diffHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);
    console.log(`- Hours since posted: ${diffHours.toFixed(2)}h (Limit: <= 24h)`);
    
    if (diffHours > 24) {
      console.log('  ❌ SKIPPED: Older than 24 hours');
      continue;
    }
    
    // Check if duplicate in DB
    // Since we don't resolve the short URL here, let's check resolveDealUrl equivalent if needed
    console.log('  ✓ Good age. Needs link resolution & deduplication check...');
  }
  
  prisma.$disconnect();
}

run();
