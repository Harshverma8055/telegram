const axios = require('axios');
const cheerio = require('cheerio');

async function testDeals() {
  try {
    const url = 'https://www.amazon.in/deals';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      }
    });
    
    const $ = cheerio.load(response.data);
    
    console.log('HTML Length:', response.data.length);
    console.log('Title:', $('title').text());
    
    // Look for links that look like products or deals
    const links = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && (href.includes('/dp/') || href.includes('/gp/product/') || href.includes('/d/'))) {
        links.push(href);
      }
    });
    
    console.log('Found product links:', links.slice(0, 10));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testDeals();
