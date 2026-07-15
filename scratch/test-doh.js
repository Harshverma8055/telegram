const axios = require('axios');
const https = require('https');
const dns = require('dns');

async function resolveDoH(hostname) {
  try {
    // Try Cloudflare DoH first
    console.log(`Querying Cloudflare DoH for ${hostname}...`);
    const cfRes = await axios.get(`https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`, {
      headers: { 'Accept': 'application/dns-json' },
      timeout: 3000
    });
    if (cfRes.data && cfRes.data.Answer && cfRes.data.Answer.length > 0) {
      const ip = cfRes.data.Answer[0].data;
      console.log(`Cloudflare DoH resolved ${hostname} to ${ip}`);
      return ip;
    }
  } catch (e) {
    console.log(`Cloudflare DoH failed: ${e.message}`);
  }

  try {
    // Try Google DoH fallback
    console.log(`Querying Google DoH for ${hostname}...`);
    const googleRes = await axios.get(`https://dns.google/resolve?name=${hostname}&type=A`, {
      timeout: 3000
    });
    if (googleRes.data && googleRes.data.Answer && googleRes.data.Answer.length > 0) {
      const ip = googleRes.data.Answer[0].data;
      console.log(`Google DoH resolved ${hostname} to ${ip}`);
      return ip;
    }
  } catch (e) {
    console.log(`Google DoH failed: ${e.message}`);
  }

  return null;
}

const customLookup = (hostname, options, callback) => {
  if (hostname === 't.me' || hostname === 'telegram.me') {
    resolveDoH(hostname).then(ip => {
      if (ip) {
        callback(null, ip, 4);
      } else {
        console.log(`DoH failed, falling back to system DNS...`);
        dns.lookup(hostname, options, callback);
      }
    }).catch(err => {
      dns.lookup(hostname, options, callback);
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
    console.error('Error fetching Telegram page:', err.message);
  }
}

test();
