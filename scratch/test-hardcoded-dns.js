const dns = require('dns');
const https = require('https');
const axios = require('axios');

const customLookup = (hostname, options, callback) => {
  if (hostname === 't.me' || hostname === 'telegram.me') {
    console.log(`Bypassing DNS lookup for ${hostname} -> resolving to 149.154.167.99 (options: ${JSON.stringify(options)})`);
    if (options && options.all) {
      callback(null, [{ address: '149.154.167.99', family: 4 }]);
    } else {
      callback(null, '149.154.167.99', 4);
    }
  } else {
    dns.lookup(hostname, options, callback);
  }
};

const agent = new https.Agent({ lookup: customLookup });

async function test() {
  try {
    const res = await axios.get('https://t.me/s/IndiaFreeStuff', {
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });
    console.log('Success! HTML Length:', res.data.length);
    console.log('Sample content:', res.data.substring(0, 500));
  } catch (err) {
    console.error('Error fetching Telegram page:', err.message);
  }
}

test();
