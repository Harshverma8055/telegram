const axios = require('axios');

const imageUrls = [
  'https://m.media-amazon.com/images/I/71t+U5d6L2L._SL1500_.jpg',
  'https://m.media-amazon.com/images/I/71fL98QZtDL._SL1500_.jpg',
  'https://m.media-amazon.com/images/I/61eG82dK3hL._SL1500_.jpg',
  'https://m.media-amazon.com/images/I/61n-6iYm25L._SL1200_.jpg',
  'https://m.media-amazon.com/images/I/51e2W6p7LqL._SL1000_.jpg'
];

async function check() {
  for (const url of imageUrls) {
    try {
      const res = await axios.head(url);
      console.log(`URL: ${url} -> Status: ${res.status}`);
    } catch (e) {
      console.log(`URL: ${url} -> Failed: ${e.message}`);
    }
  }
}

check();
