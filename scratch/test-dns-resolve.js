const dns = require('dns');
const https = require('https');
const axios = require('axios');

const customLookup = (hostname, options, callback) => {
  if (hostname === 't.me' || hostname === 'telegram.me') {
    console.log(`Resolving ${hostname} using custom DNS resolver...`);
    const resolver = new dns.Resolver();
    resolver.setServers(['1.1.1.1', '8.8.8.8']);
    resolver.resolve4(hostname, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        console.log(`Custom DNS failed, falling back to system DNS...`);
        dns.lookup(hostname, options, callback);
      } else {
        console.log(`Successfully resolved ${hostname} to ${addresses[0]}`);
        callback(null, addresses[0], 4);
      }
    });
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
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
