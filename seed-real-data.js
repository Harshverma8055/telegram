import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REAL_PRODUCTS = [
  {
    asin: 'B08R7K2J4Y',
    title: 'Solimo Non-Stick 3-Piece Kitchen Set (Tawa, Fry Pan, Kadhai)',
    url: 'https://www.amazon.in/dp/B08R7K2J4Y',
    mrp: 2000,
    currentPrice: 1249,
    imageUrl: 'https://m.media-amazon.com/images/I/71N7e61h1tL._SL1500_.jpg'
  },
  {
    asin: 'B0CHX1W1XY',
    title: 'Apple iPhone 15 (128 GB) - Black',
    url: 'https://www.amazon.in/dp/B0CHX1W1XY',
    mrp: 79900,
    currentPrice: 70999,
    imageUrl: 'https://m.media-amazon.com/images/I/71657TiFeHL._SL1500_.jpg'
  },
  {
    asin: 'B0C5N3XV33',
    title: 'Samsung Galaxy M34 5G (Prism Silver, 6GB, 128GB Storage)',
    url: 'https://www.amazon.in/dp/B0C5N3XV33',
    mrp: 24499,
    currentPrice: 15999,
    imageUrl: 'https://m.media-amazon.com/images/I/91ItZJh1FDL._SL1500_.jpg'
  },
  {
    asin: 'B0BRJ26L3R',
    title: 'boAt Airdopes 141 Bluetooth TWS Earbuds with 42H Playtime',
    url: 'https://www.amazon.in/dp/B0BRJ26L3R',
    mrp: 4490,
    currentPrice: 1299,
    imageUrl: 'https://m.media-amazon.com/images/I/61KNJav3S9L._SL1500_.jpg'
  },
  {
    asin: 'B07YYJL21Z',
    title: 'SanDisk Ultra Dual Drive Go Type-C 64GB Flash Drive',
    url: 'https://www.amazon.in/dp/B07YYJL21Z',
    mrp: 1200,
    currentPrice: 649,
    imageUrl: 'https://m.media-amazon.com/images/I/61Xf75Lz21L._SL1000_.jpg'
  },
  {
    asin: 'B0B85327S3',
    title: 'Sony WH-1000XM5 Wireless Active Noise Cancelling Headphones',
    url: 'https://www.amazon.in/dp/B0B85327S3',
    mrp: 34990,
    currentPrice: 29990,
    imageUrl: 'https://m.media-amazon.com/images/I/61+OroxMsbL._SL1500_.jpg'
  },
  {
    asin: 'B000050GET',
    title: 'Bicycle Standard Playing Cards',
    url: 'https://www.amazon.in/dp/B000050GET',
    mrp: 399,
    currentPrice: 299,
    imageUrl: 'https://m.media-amazon.com/images/I/61F0+VfN+wL._SL1000_.jpg'
  },
  {
    asin: 'B08F7J4Y4B',
    title: 'RC.ROYAL CLASS Premium Cotton Ankle Length Socks',
    url: 'https://www.amazon.in/dp/B08F7J4Y4B',
    mrp: 499,
    currentPrice: 249,
    imageUrl: 'https://m.media-amazon.com/images/I/71p0WfQfPjL._SL1500_.jpg'
  }
];

async function main() {
  console.log('🗑️  Deleting fake products...');
  
  await prisma.product.deleteMany({
    where: { category: 'watchlist' }
  });

  const platform = await prisma.platform.upsert({
    where: { slug: 'amazon' },
    update: {},
    create: { name: 'Amazon', slug: 'amazon' }
  });

  console.log('🌱 Seeding real products...');
  for (const item of REAL_PRODUCTS) {
    const product = await prisma.product.upsert({
      where: {
        platformId_externalId: {
          platformId: platform.id,
          externalId: item.asin
        }
      },
      update: {
        category: 'watchlist',
        title: item.title,
        url: item.url,
        mrp: item.mrp,
        currentPrice: item.currentPrice,
        imageUrl: item.imageUrl
      },
      create: {
        platformId: platform.id,
        externalId: item.asin,
        category: 'watchlist',
        title: item.title,
        url: item.url,
        mrp: item.mrp,
        currentPrice: item.currentPrice,
        imageUrl: item.imageUrl
      }
    });

    await prisma.priceHistory.create({
      data: {
        productId: product.id,
        price: item.currentPrice
      }
    });
    console.log(`✅ Added: ${item.title}`);
  }

  console.log('🎉 Done seeding real products!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
