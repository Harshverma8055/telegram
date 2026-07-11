async function test() {
  const targetUrl = 'https://www.myntra.com/shoes/roadster/roadster-men-grey-sneakers/1364628/buy';
  const sharedby = '5433991';
  const convertUrl = `https://earnkaro.com/convert?url=${encodeURIComponent(targetUrl)}&sharedby=${sharedby}`;
  
  console.log('Testing EarnKaro conversion URL:', convertUrl);
  try {
    const res = await fetch(convertUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      redirect: 'manual'
    });
    console.log('Response Status:', res.status);
    console.log('Response Headers:', Object.fromEntries(res.headers.entries()));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
test();
