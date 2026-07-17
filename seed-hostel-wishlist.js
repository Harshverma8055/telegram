const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const STUDENT_WISHLIST_PRODUCTS = [
  {
    asin: 'B09G2H3GX1',
    title: 'Destinio Umbrella for Women, Umbrella for Men - Automatic 3 Fold Windproof with Travel Cover',
    category: 'Hostel Living',
    subcategory: 'Umbrella',
    mrp: 899,
    price: 499,
    image: 'https://images-eu.ssl-images-amazon.com/images/I/71WhIVKJVOL.jpg',
    targetDiscount: 20,
    targetPrice: 399,
  },
  {
    asin: 'B00MVV81MK',
    title: 'JK Copier Paper - A4, 75 GSM, 1 Ream (500 Sheets)',
    category: 'Stationery',
    subcategory: 'A4 Paper',
    mrp: 400,
    price: 340,
    image: 'https://m.media-amazon.com/images/I/71kmALRtskL.jpg',
    targetDiscount: 15,
    targetPrice: 289,
  },
  {
    asin: 'B089RD1SW9',
    title: 'Hauser XO Ball Pen Pack of 20 (Blue Ink) - Smooth Writing Pen for Students',
    category: 'Stationery',
    subcategory: 'Pens',
    mrp: 250,
    price: 199,
    image: 'https://m.media-amazon.com/images/I/618k-RIZB4S.jpg',
    targetDiscount: 20,
    targetPrice: 159,
  },
  {
    asin: 'B0H6WMWQ5B',
    title: 'Red Tape Sneakers for Men - Stylish Casual Walking Shoes (White)',
    category: 'Fashion',
    subcategory: 'Sneakers',
    mrp: 5299,
    price: 1599,
    image: 'https://m.media-amazon.com/images/I/71f81uWoaLL.jpg',
    targetDiscount: 30,
    targetPrice: 1119,
  },
  {
    asin: 'B0CRVNPS3Y',
    title: 'CELLBELL C190 Berlin Medium-Back Ergonomic Office Chair with Adjustable Lumbar Support (Black)',
    category: 'Hostel Living',
    subcategory: 'Study Chair',
    mrp: 9999,
    price: 3899,
    image: 'https://m.media-amazon.com/images/I/61R1LRBzEaL.jpg',
    targetDiscount: 20,
    targetPrice: 3119,
  },
  {
    asin: 'B0FPXN8WQP',
    title: 'Panasonic Anchor 4-Socket Surge Protector with Master Switch & Individual LED (1.5 Meter Cord)',
    category: 'Hostel Living',
    subcategory: 'Extension Board',
    mrp: 499,
    price: 349,
    image: 'https://m.media-amazon.com/images/I/51pOTcLg7CL.jpg',
    targetDiscount: 15,
    targetPrice: 296,
  },
  {
    asin: 'B00N8UGUOE',
    title: 'D-Link Cat6 UTP Ethernet Patch Cord LAN Cable (5 Meter, Blue)',
    category: 'Electronics',
    subcategory: 'LAN Cable',
    mrp: 350,
    price: 220,
    image: 'https://m.media-amazon.com/images/I/91g55MIMKTL.jpg',
    targetDiscount: 20,
    targetPrice: 176,
  },
  {
    asin: 'B0DPMGQT5B',
    title: 'BSY Premium Cotton Single Bedsheet with 1 Pillow Cover (Blue Floral)',
    category: 'Hostel Living',
    subcategory: 'Bed Sheet',
    mrp: 599,
    price: 299,
    image: 'https://m.media-amazon.com/images/I/91jTmutaf9L.jpg',
    targetDiscount: 20,
    targetPrice: 239,
  },
  {
    asin: 'B0CQ59PP8Q',
    title: 'Sleepwell Dual PRO Single Bed Reversible Foam Mattress (72x36x4 Inches)',
    category: 'Hostel Living',
    subcategory: 'Mattress',
    mrp: 4500,
    price: 2799,
    image: 'https://m.media-amazon.com/images/I/61ipLR27VzL.jpg',
    targetDiscount: 15,
    targetPrice: 2379,
  },
  {
    asin: 'B0FQ5JPXG7',
    title: 'Urban Space Blackout Door Curtain - Room Darkening & Noise Reduction (7 Feet, Single PC)',
    category: 'Hostel Living',
    subcategory: 'Curtain',
    mrp: 899,
    price: 399,
    image: 'https://m.media-amazon.com/images/I/71S78dKgyCL.jpg',
    targetDiscount: 20,
    targetPrice: 319,
  },
  {
    asin: 'B0BD42FZJR',
    title: 'Desidiya 10-Meter Waterproof Decorative LED Fairy String Lights for Room Decoration (Warm White)',
    category: 'Hostel Living',
    subcategory: 'Room Lights',
    mrp: 499,
    price: 189,
    image: 'https://m.media-amazon.com/images/I/71JaPHpDNlL.jpg',
    targetDiscount: 25,
    targetPrice: 141,
  },
  {
    asin: 'B0CRS38863',
    title: 'Denver Hamilton Deodorant Body Spray Combo Pack for Men (Hamilton & Imperial, 200ml Pack of 2)',
    category: 'Grooming',
    subcategory: 'Deodorant',
    mrp: 450,
    price: 320,
    image: 'https://m.media-amazon.com/images/I/617NRQrdpkL.jpg',
    targetDiscount: 25,
    targetPrice: 240,
  },
  {
    asin: 'B079TN3GCD',
    title: 'Hornbull Slim Leather Wallet for Men (Classic Brown)',
    category: 'Fashion',
    subcategory: 'Wallet',
    mrp: 999,
    price: 299,
    image: 'https://m.media-amazon.com/images/I/814btLjWMOL.jpg',
    targetDiscount: 30,
    targetPrice: 209,
  },
  {
    asin: 'B084X79CRW',
    title: 'AmazonBasics Multi-purpose Cable Organizer Clips Pack of 10 (Black)',
    category: 'Hostel Living',
    subcategory: 'Cable Organizer',
    mrp: 499,
    price: 249,
    image: 'https://images-eu.ssl-images-amazon.com/images/I/51ATSDvA-mL.jpg',
    targetDiscount: 20,
    targetPrice: 199,
  },
  {
    asin: 'B0F3HZVHDQ',
    title: 'Destinio Umbrella for Women, Umbrella for Men - Automatic 3 Fold Windproof with Travel Cover with Auto Open and Close',
    category: 'Hostel Living',
    subcategory: 'Umbrella',
    mrp: 1999,
    price: 649,
    image: 'https://m.media-amazon.com/images/I/31uN0czWoGL.jpg',
    targetDiscount: 30,
    targetPrice: 454,
  },
  {
    asin: 'B00MVV9NUY',
    title: 'JK Easy Copier Paper | A4 Size | 70 GSM | 500 Sheets | White Paper, 1 Ream',
    category: 'Stationery',
    subcategory: 'A4 Paper',
    mrp: 355,
    price: 285,
    image: 'https://m.media-amazon.com/images/I/41LcujaPSvL.jpg',
    targetDiscount: 20,
    targetPrice: 228,
  },
  {
    asin: 'B074VD1BVV',
    title: 'Cello Finegrip Ball Pen Set - Pack of 25 (Blue)',
    category: 'Stationery',
    subcategory: 'Pens',
    mrp: 245,
    price: 175,
    image: 'https://m.media-amazon.com/images/I/41g1ju63lwL.jpg',
    targetDiscount: 20,
    targetPrice: 140,
  },
  {
    asin: 'B07Y5BKQ5R',
    title: 'SPARX Shoes SM 439',
    category: 'Fashion',
    subcategory: 'Sneakers',
    mrp: 849,
    price: 594,
    image: 'https://m.media-amazon.com/images/I/21KsiDso4xL.jpg',
    targetDiscount: 30,
    targetPrice: 416,
  },
  {
    asin: 'B0CRVMD5RZ',
    title: 'CELLBELL C190 Berlin Office Chair, High Back Mesh Ergonomic Home Office Desk Chair (Black)',
    category: 'Hostel Living',
    subcategory: 'Study Chair',
    mrp: 19999,
    price: 5499,
    image: 'https://m.media-amazon.com/images/I/410W-18GVyL.jpg',
    targetDiscount: 20,
    targetPrice: 4399,
  },
  {
    asin: 'B0114BF6C0',
    title: 'Goldmedal i-Strip High-Grade Extension Board | 6 Universal Sockets | 2-Meter Cord with Surge Protector',
    category: 'Hostel Living',
    subcategory: 'Extension Board',
    mrp: 787,
    price: 697,
    image: 'https://m.media-amazon.com/images/I/412PgsP+A9L.jpg',
    targetDiscount: 20,
    targetPrice: 558,
  },
  {
    asin: 'B08CSKJT2R',
    title: 'FEDUS Cat6 Ethernet Cable, 5 Meter High-Speed 550MHZ / 10 Gigabit Speed UTP LAN Cable',
    category: 'Electronics',
    subcategory: 'LAN Cable',
    mrp: 499,
    price: 279,
    image: 'https://m.media-amazon.com/images/I/51jNo4QNTNL.jpg',
    targetDiscount: 20,
    targetPrice: 223,
  },
  {
    asin: 'B0DPMJ39XK',
    title: 'RajasthaniKart Pure 100% Cotton Single Bed Sheet with 1 Pillow Cover',
    category: 'Hostel Living',
    subcategory: 'Bed Sheet',
    mrp: 269,
    price: 269,
    image: 'https://m.media-amazon.com/images/I/51AwClcREyL.jpg',
    targetDiscount: 20,
    targetPrice: 215,
  },
  {
    asin: 'B0CFYDYTJZ',
    title: 'JY Dual Comfortable Reversible Foldable HD EPE Foam Single Bed Mattress 3 Fold for Travel (72 X 36 X 2)',
    category: 'Hostel Living',
    subcategory: 'Mattress',
    mrp: 999,
    price: 799,
    image: 'https://m.media-amazon.com/images/I/51f5ZC+QdfL.jpg',
    targetDiscount: 20,
    targetPrice: 639,
  },
  {
    asin: 'B0DW9ML99L',
    title: 'IVAZA Premium Velvet Burnout Pattern 70% Blackout Opaque Curtains for Door 7 Feet Pack of 2',
    category: 'Hostel Living',
    subcategory: 'Curtain',
    mrp: 1999,
    price: 748,
    image: 'https://m.media-amazon.com/images/I/519BskmLhBL.jpg',
    targetDiscount: 20,
    targetPrice: 598,
  },
  {
    asin: 'B0BX6YN2BQ',
    title: 'Gesto 5 Meter LED Strip Lights | 300 Led RGB Strip Light with Adaptor & Remote',
    category: 'Hostel Living',
    subcategory: 'Room Lights',
    mrp: 1999,
    price: 425,
    image: 'https://m.media-amazon.com/images/I/51PSyPk+IKL.jpg',
    targetDiscount: 20,
    targetPrice: 340,
  },
  {
    asin: 'B0CL4395X8',
    title: 'Fogg Marco No Gas Deodorant for Men, Long-Lasting Perfume Body Spray, 150 ml (Pack of 2)',
    category: 'Grooming',
    subcategory: 'Deodorant',
    mrp: 448,
    price: 320,
    image: 'https://m.media-amazon.com/images/I/41+DT8K-lCL.jpg',
    targetDiscount: 20,
    targetPrice: 256,
  },
  {
    asin: 'B08PKH9JPQ',
    title: 'WildHorn Genuine Leather Wallet for Men | Slim Bifold Wallet with RFID Blocking',
    category: 'Fashion',
    subcategory: 'Wallet',
    mrp: 1499,
    price: 299,
    image: 'https://m.media-amazon.com/images/I/41ZE59cNrWL.jpg',
    targetDiscount: 30,
    targetPrice: 209,
  },
  {
    asin: 'B0BBZKX9N6',
    title: 'INOVERA Wire Organizer Cable Management Clip Desktop Cord Hook with 3M Adhesive Foam (Pack of 20)',
    category: 'Hostel Living',
    subcategory: 'Cable Organizer',
    mrp: 699,
    price: 205,
    image: 'https://m.media-amazon.com/images/I/41FsEoqPUFL.jpg',
    targetDiscount: 20,
    targetPrice: 164,
  }
];

async function main() {
  console.log('🧹 Cleaning up duplicate sticky notes...');
  
  // Find all active sticky note items
  const stickyNotes = await prisma.$queryRaw`
    SELECT id, title, price, discount 
    FROM "WishlistProduct" 
    WHERE (LOWER("title") LIKE '%sticky%note%' OR LOWER("subcategory") = 'sticky notes') AND "wishlist" = true
    ORDER BY "discount" DESC, "price" ASC
  `;

  console.log(`Found ${stickyNotes.length} active sticky notes.`);
  
  if (stickyNotes.length > 2) {
    const toKeep = stickyNotes.slice(0, 2);
    const toRemove = stickyNotes.slice(2);
    
    for (const item of toRemove) {
      await prisma.$executeRawUnsafe(
        `UPDATE "WishlistProduct" SET "wishlist" = false WHERE "id" = $1`,
        item.id
      );
    }
    console.log(`Deactivated ${toRemove.length} duplicate sticky notes.`);
  }

  console.log('🌱 Seeding curated student/hostel products directly...');
  for (const item of STUDENT_WISHLIST_PRODUCTS) {
    const discountPct = Math.round(((item.mrp - item.price) / item.mrp) * 100);
    
    // Check if ASIN already exists
    const existing = await prisma.$queryRaw`
      SELECT id FROM "WishlistProduct" WHERE "asin" = ${item.asin} LIMIT 1
    `;

    if (existing.length > 0) {
      // Update existing item to be active and set target parameters
      await prisma.$executeRawUnsafe(`
        UPDATE "WishlistProduct" 
        SET "title" = $1, "price" = $2, "mrp" = $3, "discount" = $4, "image" = $5, "wishlist" = true,
            "target_price" = $6, "target_discount" = $7, "last_updated" = NOW()
        WHERE "asin" = $8
      `,
        item.title,
        item.price,
        item.mrp,
        discountPct,
        item.image,
        item.targetPrice,
        item.targetDiscount,
        item.asin
      );
      console.log(`🔄 Updated existing item: ${item.title}`);
    } else {
      // Insert new item directly with custom scores
      await prisma.$executeRawUnsafe(`
        INSERT INTO "WishlistProduct" (
          "id", "asin", "title", "amazon_url", "brand", "category", "subcategory", 
          "price", "mrp", "discount", "coupon", "rating", "review_count", "availability", 
          "image", "seller", "prime", "amazon_choice", "best_seller", "deal_type", 
          "priority_score", "buy_score", "student_score", "hostel_score", "fashion_score", 
          "gift_score", "affiliate_score", "wishlist", "target_price", "target_discount", "last_updated"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, NOW()
        )
      `,
        crypto.randomUUID(),
        item.asin,
        item.title,
        `https://www.amazon.in/dp/${item.asin}`,
        item.title.split(' ')[0],
        item.category,
        item.subcategory,
        item.price,
        item.mrp,
        discountPct,
        false,        // coupon
        4.3,          // rating
        120,          // review_count
        'Available',
        item.image,
        'Amazon.in',  // seller
        true,         // prime
        false,        // amazonChoice
        false,        // bestSeller
        'none',       // dealType
        80,           // priorityScore
        70,           // buyScore
        90,           // studentScore
        95,           // hostelScore
        50,           // fashionScore
        40,           // giftScore
        80,           // affiliateScore
        true,         // wishlist
        item.targetPrice,
        item.targetDiscount
      );
      console.log(`✅ Inserted new item: ${item.title}`);
    }
  }

  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
