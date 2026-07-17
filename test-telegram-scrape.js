const { fetchTelegramDeals, resolveDealUrl } = require('./src/lib/scrapers/rss');
const dns = require('dns');
const https = require('https');
const axios = require('axios');

async function testChannel(channel) {
  console.log(`\n--- Testing channel: ${channel} ---`);
  try {
    const deals = await fetchTelegramDeals(channel);
    console.log(`Successfully fetched ${deals.length} messages.`);
    
    if (deals.length > 0) {
      console.log('Sample Deal 1:', JSON.stringify(deals[0], null, 2));
      
      let resolveCount = 0;
      for (const d of deals.slice(0, 5)) {
        const resolved = await resolveDealUrl(d.link, d.content);
        console.log(`- Link: ${d.link} -> Resolved: ${resolved ? `${resolved.platform} (${resolved.externalId})` : 'Failed'}`);
      }
    }
  } catch (err) {
    console.error(`Error fetching channel ${channel}:`, err.message);
  }
}

async function main() {
  const channels = [
    'amazinglootsdealsoffers',
    'lootdealsk_Alibaba_dc_DealDost',
    'LOOTS_DEAL_OFFER_ONLINE_SHOPPING',
    'TrickXpert',
    'rapiddeals_unlimited'
  ];
  for (const c of channels) {
    await testChannel(c);
  }
}

main();
