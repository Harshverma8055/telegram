import { fetchAmazonDetails } from './rss';

async function testFetch() {
  console.log('Fetching details for ASIN: B0GVS9X6Z3...');
  try {
    const details = await fetchAmazonDetails('B0GVS9X6Z3');
    console.log('Scraped Details Result:', details);
  } catch (e: any) {
    console.error('Fetch failed with error:', e.message);
  }
}

testFetch();
