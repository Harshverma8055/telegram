import { POST } from '../src/app/api/wishlist/products/route';

async function testPost() {
  const req = new Request('http://localhost:3000/api/wishlist/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://link.amazon/B0crWu6uH',
      category: 'Room Decoration',
      subcategory: 'General',
      targetPrice: '284',
    }),
  });

  try {
    const res = await POST(req);
    const data = await res.json();
    console.log('STATUS:', res.status);
    console.log('RESPONSE:', JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error('ERROR:', err);
  }
}

testPost();
