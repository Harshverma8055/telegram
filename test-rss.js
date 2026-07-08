const Parser = require('rss-parser');
const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0' }
});
parser.parseURL('https://www.reddit.com/r/DealsIndia/new.rss').then(feed => {
  console.log("SUCCESS! Found " + feed.items.length + " items.");
}).catch(err => console.error("ERROR:", err.message));
