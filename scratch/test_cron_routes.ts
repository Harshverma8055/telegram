import { GET as hostelGET } from '../src/app/api/cron-hostel/route';
import { GET as wishlistGET } from '../src/app/api/cron-wishlist/route';

async function test() {
  console.log('Testing /api/cron-hostel...');
  try {
    const mockRequestHostel = new Request('http://localhost:3000/api/cron-hostel');
    const responseHostel = await hostelGET(mockRequestHostel);
    const jsonHostel = await responseHostel.json();
    console.log('Hostel response:', JSON.stringify(jsonHostel, null, 2));
  } catch (err: any) {
    console.error('Hostel test failed:', err);
  }

  console.log('\nTesting /api/cron-wishlist...');
  try {
    const mockRequestWishlist = new Request('http://localhost:3000/api/cron-wishlist');
    const responseWishlist = await wishlistGET(mockRequestWishlist);
    const jsonWishlist = await responseWishlist.json();
    console.log('Wishlist response:', JSON.stringify(jsonWishlist, null, 2));
  } catch (err: any) {
    console.error('Wishlist test failed:', err);
  }
}

test();
