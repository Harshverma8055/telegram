import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function audit() {
  // Find all WishlistProduct items
  const all = await p.$queryRawUnsafe<any[]>(`
    SELECT "id", "asin", "title", "image", "price", "mrp", "discount", "rating", "review_count", "wishlist"
    FROM "WishlistProduct"
    ORDER BY "last_updated" DESC
  `);

  console.log(`\n📊 Total WishlistProduct items: ${all.length}\n`);

  const fakeItems: any[] = [];
  const goodItems: any[] = [];

  for (const item of all) {
    const isFake =
      // No image or placeholder image
      !item.image ||
      item.image.trim() === '' ||
      item.image === 'https://m.media-amazon.com/images/I/41-x3kM67ML._SL500_.jpg' ||
      // Generic fallback title
      item.title.startsWith('Amazon Product (') ||
      // Zero price
      item.price <= 0 ||
      // Image is not a valid URL
      !item.image.startsWith('http');

    if (isFake) {
      fakeItems.push(item);
    } else {
      goodItems.push(item);
    }
  }

  console.log(`✅ Good items (have valid image + title + price): ${goodItems.length}`);
  console.log(`❌ Fake/broken items (no image, placeholder title, or zero price): ${fakeItems.length}\n`);

  if (fakeItems.length > 0) {
    console.log('--- FAKE/BROKEN ITEMS ---');
    for (const item of fakeItems) {
      console.log(`  ASIN: ${item.asin} | Title: "${item.title?.substring(0, 50)}..." | Price: ₹${item.price} | Image: ${item.image?.substring(0, 60) || 'NONE'}`);
    }
  }

  // Delete the fake items
  if (fakeItems.length > 0) {
    const fakeIds = fakeItems.map((f: any) => f.id);
    console.log(`\n🗑️ Deleting ${fakeIds.length} fake/broken items...`);
    
    for (const id of fakeIds) {
      await p.$executeRawUnsafe(`DELETE FROM "WishlistProduct" WHERE "id" = $1`, id);
    }
    console.log(`✅ Deleted ${fakeIds.length} fake items successfully!`);
  }

  // Also check for items with very generic/small images (Amazon placeholder patterns)
  const suspiciousImages = await p.$queryRawUnsafe<any[]>(`
    SELECT "id", "asin", "title", "image", "price"
    FROM "WishlistProduct"
    WHERE "image" LIKE '%no-img%'
       OR "image" LIKE '%placeholder%'
       OR "image" LIKE '%1x1%'
       OR "image" LIKE '%pixel%'
       OR "image" LIKE '%spacer%'
       OR "image" LIKE '%transparent%'
       OR LENGTH("image") < 10
  `);

  if (suspiciousImages.length > 0) {
    console.log(`\n⚠️ Found ${suspiciousImages.length} items with suspicious placeholder images. Deleting...`);
    for (const item of suspiciousImages) {
      console.log(`  Deleting: ${item.asin} — "${item.title?.substring(0, 40)}"`);
      await p.$executeRawUnsafe(`DELETE FROM "WishlistProduct" WHERE "id" = $1`, item.id);
    }
    console.log(`✅ Cleaned up ${suspiciousImages.length} additional suspicious items.`);
  }

  // Final count
  const remaining = await p.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::bigint as "count" FROM "WishlistProduct"`);
  console.log(`\n📊 Remaining clean WishlistProduct items: ${Number(remaining[0]?.count || 0)}`);

  await p.$disconnect();
}

audit().catch(console.error);
