const axios = require('axios');

async function test() {
  try {
    const res = await axios.get('https://cloudflare-dns.com/dns-query?name=telegram.me&type=A', {
      headers: { 'Accept': 'application/dns-json' }
    });
    console.log('CF Answer:', res.data);
  } catch (e) {
    console.error('CF Error:', e.message);
  }

  try {
    const res = await axios.get('https://dns.google/resolve?name=telegram.me&type=A');
    console.log('Google Answer:', res.data);
  } catch (e) {
    console.error('Google Error:', e.message);
  }
}

test();
