const axios = require('axios');
const dns = require('dns');

dns.resolve4('t.me', (err, addresses) => {
  console.log('Real t.me IPs from DNS resolver:', err || addresses);
});

dns.resolve4('telegram.me', (err, addresses) => {
  console.log('Real telegram.me IPs from DNS resolver:', err || addresses);
});

// Let's test calling t.me using default DNS resolution first
axios.get('https://t.me/s/LootDealsIndia', { timeout: 5000 })
  .then(res => {
    console.log('Default DNS connection to t.me: SUCCESS (HTML length:', res.data.length, ')');
  })
  .catch(err => {
    console.log('Default DNS connection to t.me: FAILED:', err.message);
  });

// Let's test calling with the hardcoded agent IP 149.154.167.99
const https = require('https');
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

axios.get('https://t.me/s/LootDealsIndia', { httpsAgent: telegramHttpsAgent, timeout: 5000 })
  .then(res => {
    console.log('Hardcoded IP Agent connection to t.me: SUCCESS (HTML length:', res.data.length, ')');
  })
  .catch(err => {
    console.log('Hardcoded IP Agent connection to t.me: FAILED:', err.message);
  });
