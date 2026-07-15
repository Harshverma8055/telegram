import axios from 'axios';
import * as cheerio from 'cheerio';
import prisma from '@/lib/prisma';
import { fetchAmazonDetails as fetchBaseAmazonDetails } from './rss';

// -------------------------------------------------------------------------
// CATEGORY DEFINITIONS & KEYWORDS
// -------------------------------------------------------------------------
export interface ResearchKeyword {
  subcategory: string;
  query: string;
}

export interface ResearchCategory {
  name: string;
  targetCount: number;
  keywords: ResearchKeyword[];
}

export const RESEARCH_CATEGORIES: ResearchCategory[] = [
  {
    name: 'Mobile Accessories',
    targetCount: 80,
    keywords: [
      { subcategory: 'Charging Cables', query: 'charging cable Type C fast charging' },
      { subcategory: 'Chargers', query: 'mobile charger fast adapter 18W 20W' },
      { subcategory: 'Power Banks', query: 'power bank 10000mah 20000mah' },
      { subcategory: 'Phone Covers', query: 'iphone oneplus mobile cover silicone case' },
      { subcategory: 'Tempered Glass', query: 'tempered glass screen protector' },
      { subcategory: 'Phone Stands', query: 'phone stand metal desk holder' },
      { subcategory: 'Tripods', query: 'mobile tripod stand ring light' },
      { subcategory: 'OTG Adapters', query: 'otg adapter type c micro usb' },
      { subcategory: 'USB Hubs', query: 'usb hub multi port type c splitter' },
      { subcategory: 'Memory Cards', query: 'memory card 64gb 128gb micro sd' },
      { subcategory: 'Pendrives', query: 'pendrive 64gb sandisk otg' },
      { subcategory: 'Selfie Sticks', query: 'selfie stick bluetooth tripod' },
      { subcategory: 'Neckbands', query: 'neckband bluetooth earphones wireless' },
      { subcategory: 'Earbuds', query: 'earbuds wireless bluetooth noise cancelling' },
      { subcategory: 'Bluetooth Speakers', query: 'bluetooth speaker portable waterproof' },
      { subcategory: 'Mobile Gaming Triggers', query: 'mobile gaming triggers L1R1 pubg' },
      { subcategory: 'Ring Holders', query: 'ring holder finger stand for mobile' },
      { subcategory: 'Car Chargers', query: 'car charger fast charging dual port' },
      { subcategory: 'Wireless Chargers', query: 'wireless charger pad fast charge' },
      { subcategory: 'Cable Protectors', query: 'cable protector spiral pack' }
    ]
  },
  {
    name: 'Laptop Accessories',
    targetCount: 80,
    keywords: [
      { subcategory: 'Laptop Sleeves', query: 'laptop sleeve 14 15.6 inch bag' },
      { subcategory: 'Cooling Pads', query: 'cooling pad for gaming laptop rgb' },
      { subcategory: 'Laptop Stands', query: 'laptop stand aluminium adjustable folding' },
      { subcategory: 'Wireless Mouse', query: 'wireless mouse silent rechargeable' },
      { subcategory: 'Gaming Mouse', query: 'gaming mouse rgb wired wireless' },
      { subcategory: 'Mouse Pads', query: 'mouse pad large anti slip office' },
      { subcategory: 'RGB Mouse Pads', query: 'rgb mouse pad gaming extended' },
      { subcategory: 'Keyboard Covers', query: 'keyboard cover protector silicone' },
      { subcategory: 'Keyboard Skins', query: 'keyboard skin sticker laptop' },
      { subcategory: 'Screen Cleaners', query: 'screen cleaner spray microfiber' },
      { subcategory: 'Cleaning Kits', query: 'laptop keyboard cleaning brush kit' },
      { subcategory: 'HDMI Cables', query: 'hdmi cable 4k 1.5m 3m' },
      { subcategory: 'Type-C Hubs', query: 'type c hub hdmi ethernet adapter' },
      { subcategory: 'Docking Stations', query: 'docking station dual monitor laptop' },
      { subcategory: 'SSD Enclosures', query: 'ssd enclosure nvme m2 usb c' },
      { subcategory: 'External SSDs', query: 'external ssd 500gb 1tb portable' },
      { subcategory: 'External HDDs', query: 'external hdd 1tb 2tb hard drive' },
      { subcategory: 'Cable Organizers', query: 'cable organizer box silicone sleeve' },
      { subcategory: 'Privacy Screens', query: 'privacy screen filter laptop guard' }
    ]
  },
  {
    name: 'Hostel Essentials',
    targetCount: 100,
    keywords: [
      { subcategory: 'Water Bottles', query: 'water bottle steel copper plastic' },
      { subcategory: 'Steel Bottles', query: 'water bottle stainless steel 1 litre' },
      { subcategory: 'Vacuum Flasks', query: 'vacuum flask hot and cold water bottle' },
      { subcategory: 'Coffee Mugs', query: 'coffee mug insulated with lid spill proof' },
      { subcategory: 'Electric Kettles', query: 'electric kettle 1.5L fast boiling' },
      { subcategory: 'Lunch Boxes', query: 'lunch box steel insulated office bag' },
      { subcategory: 'Laundry Bags', query: 'laundry bag foldable mesh bucket' },
      { subcategory: 'Storage Boxes', query: 'storage box organizer underbed wardrobe' },
      { subcategory: 'Bedsheets', query: 'bedsheet single cotton hostel' },
      { subcategory: 'Pillow Covers', query: 'pillow cover pack of 2 cotton' },
      { subcategory: 'Blankets', query: 'blanket single bed lightweight fleece AC' },
      { subcategory: 'Hangers', query: 'hangers pack of 12 plastic metal clothes' },
      { subcategory: 'Hooks', query: 'hooks self adhesive wall hooks heavy duty' },
      { subcategory: 'Extension Boards', query: 'extension board multi plug surge protector' },
      { subcategory: 'Night Lamps', query: 'night lamp led plug in sensor' },
      { subcategory: 'Study Lamps', query: 'study lamp rechargeable led desk table' },
      { subcategory: 'Mini Fans', query: 'mini fan portable rechargeable usb desk' },
      { subcategory: 'Shoe Racks', query: 'shoe rack organizer plastic metal collapsible' },
      { subcategory: 'Door Organizers', query: 'door hanging organizer pocket holder' },
      { subcategory: 'Medicine Boxes', query: 'medicine box first aid kit storage organizer' },
      { subcategory: 'Toiletry Organizers', query: 'toiletry organizer bag hanging kit' },
      { subcategory: 'Toothbrush Holders', query: 'toothbrush holder wall mount automatic paste' },
      { subcategory: 'Shower Baskets', query: 'shower basket bathroom caddy mesh' },
      { subcategory: 'Mosquito Rackets', query: 'mosquito racket rechargeable bat' },
      { subcategory: 'Umbrellas', query: 'umbrella windproof compact folding automatic' },
      { subcategory: 'Raincoats', query: 'raincoat waterproof suit men women' }
    ]
  },
  {
    name: 'Study Essentials',
    targetCount: 80,
    keywords: [
      { subcategory: 'Notebooks', query: 'spiral notebook college ruled A4 pack' },
      { subcategory: 'Registers', query: 'register notebooks pack for college notes' },
      { subcategory: 'Pens', query: 'pens gel ball blue black gel pens pack' },
      { subcategory: 'Highlighters', query: 'highlighters pack pastel fluorescent marker' },
      { subcategory: 'Sticky Notes', query: 'sticky notes multi color index tabs pack' },
      { subcategory: 'Whiteboards', query: 'whiteboard small study board wall hang' },
      { subcategory: 'Whiteboard Markers', query: 'whiteboard markers ink duster refill' },
      { subcategory: 'Calculators', query: 'scientific calculator casio fx-991EX' },
      { subcategory: 'Geometry Boxes', query: 'geometry box maped classmate school math' },
      { subcategory: 'Desk Organizers', query: 'desk organizer metal mesh pen stand' },
      { subcategory: 'Book Stands', query: 'book stand reading adjustable hands free holder' },
      { subcategory: 'Clipboards', query: 'clipboard exam writing pad plastic cardboard' },
      { subcategory: 'Planners', query: 'planner diary journal notebook undated' },
      { subcategory: 'Exam Pads', query: 'exam pad board for student writing' },
      { subcategory: 'Files', query: 'files folder document file bag button sleeve' }
    ]
  },
  {
    name: 'Sports',
    targetCount: 60,
    keywords: [
      { subcategory: 'Badminton Rackets', query: 'badminton racket carbon fiber set' },
      { subcategory: 'Shuttles', query: 'shuttlecock feather nylon Yonex pack' },
      { subcategory: 'Footballs', query: 'football size 5 machine stitched' },
      { subcategory: 'Basketballs', query: 'basketball size 7 leather rubber' },
      { subcategory: 'Skipping Ropes', query: 'skipping rope adjustable speed jump gym' },
      { subcategory: 'Resistance Bands', query: 'resistance bands set pull up loops fabric' },
      { subcategory: 'Gym Gloves', query: 'gym gloves half finger wrist support breathable' },
      { subcategory: 'Yoga Mats', query: 'yoga mat 6mm thick anti skid cushioning' },
      { subcategory: 'Running Bottles', query: 'running water bottle sports shaker gym' },
      { subcategory: 'Sports Caps', query: 'sports cap running adjustable mesh dry fit' },
      { subcategory: 'Sweat Bands', query: 'sweat wristband headband tennis badminton set' },
      { subcategory: 'Cricket Tennis Balls', query: 'cricket tennis ball heavy duty red pack' },
      { subcategory: 'Volleyballs', query: 'volleyball size 5 soft touch' }
    ]
  },
  {
    name: "Men's Fashion",
    targetCount: 100,
    keywords: [
      { subcategory: 'Oversized T-shirts', query: 'oversized t shirt men cotton graphic drop shoulder' },
      { subcategory: 'Graphic T-shirts', query: 'graphic t shirt men crew neck anime gaming' },
      { subcategory: 'Polo T-shirts', query: 'polo t shirt men collar cotton solid fit' },
      { subcategory: 'Cargo Pants', query: 'cargo pants men relaxed fit multi pocket tactical' },
      { subcategory: 'Joggers', query: 'joggers men slim fit cotton trackpants gym' },
      { subcategory: 'Jeans', query: 'jeans men stretchable slim fit denim light wash' },
      { subcategory: 'Shorts', query: 'shorts men cotton gym sports cargo wear' },
      { subcategory: 'Caps', query: 'cap men baseball sports adjustable outdoor' },
      { subcategory: 'Belts', query: 'belt men leather formal casual metal buckle' },
      { subcategory: 'Wallets', query: 'wallet men leather slim card holder coin pocket' },
      { subcategory: 'Bracelets', query: 'bracelet men stainless steel leather charm' },
      { subcategory: 'Chains', query: 'chain necklace men silver steel curb cuban' },
      { subcategory: 'Sunglasses', query: 'sunglasses men uv protection square aviator retro' },
      { subcategory: 'Sports Shoes', query: 'sports shoes men running walking gym training' },
      { subcategory: 'Sneakers', query: 'sneakers men casual streetwear white shoes' },
      { subcategory: 'Slippers', query: 'slippers men anti slip slides flip flops bedroom' },
      { subcategory: 'Sandals', query: 'sandals men outdoor casual velcro strap leather' },
      { subcategory: 'Formal Shoes', query: 'formal shoes men derby oxford slip on leather' },
      { subcategory: 'Socks', query: 'socks men pack of 5 ankle length cotton' }
    ]
  },
  {
    name: "Women's Fashion",
    targetCount: 100,
    keywords: [
      { subcategory: 'Tote Bags', query: 'tote bag women canvas large zipper shoulder' },
      { subcategory: 'Sling Bags', query: 'sling bag women stylish crossbody mini clutch' },
      { subcategory: 'Wallets', query: 'wallet women clutch organizer zipper cardholder' },
      { subcategory: 'Hair Clips', query: 'hair claw clips women matte finish pastel set' },
      { subcategory: 'Hair Bands', query: 'hair bands headband scrunchies satin velvet pack' },
      { subcategory: 'Earrings', query: 'earrings women silver gold hoops jhumkas studs' },
      { subcategory: 'Necklaces', query: 'necklace pendant chain women minimal aesthetic' },
      { subcategory: 'Bracelets', query: 'bracelet women minimal gold plated charm' },
      { subcategory: 'Rings', query: 'rings set women silver stylish adjustable crystal' },
      { subcategory: 'Anklets', query: 'anklets women silver style traditional simple metal' },
      { subcategory: 'Pendants', query: 'pendant necklace girls gift minimalist crystal' },
      { subcategory: 'Mini Handbags', query: 'mini handbag women small party purse top handle' },
      { subcategory: 'Makeup Pouches', query: 'makeup pouch organizer bag cosmetic traveling toilet' },
      { subcategory: 'Cosmetic Organizers', query: 'cosmetic organizer box drawer display stand acrylic' },
      { subcategory: 'Compact Mirrors', query: 'compact mirror led light pocket double sided' },
      { subcategory: 'Lip Balms', query: 'lip balm tinted organic moisture dry chapped' },
      { subcategory: 'Perfumes', query: 'perfume women long lasting body mist spray' },
      { subcategory: 'Nail Polishes', query: 'nail polish set combo matte gel quick dry' },
      { subcategory: 'Hair Brushes', query: 'hair brush detangler paddle comb comb set' }
    ]
  },
  {
    name: 'Watches',
    targetCount: 60,
    keywords: [
      { subcategory: 'Casio Watches', query: 'casio vintage digital watch unisex F-91W' },
      { subcategory: 'Titan Watches', query: 'titan watch men formal analog leather' },
      { subcategory: 'Fastrack Watches', query: 'fastrack watch youth boys casual black' },
      { subcategory: 'Noise Smartwatches', query: 'noise smart watch touch display amoled calling' },
      { subcategory: 'Fire-Boltt Smartwatches', query: 'fire boltt smart watch calling tracker fitness' },
      { subcategory: 'boAt Smartwatches', query: 'boat smart watch fitness tracker heart rate' },
      { subcategory: 'Timex Watches', query: 'timex watch men classic dial expansion strap' },
      { subcategory: 'Sonata Watches', query: 'sonata watch men gold silver stainless steel' },
      { subcategory: 'Smart Watches', query: 'smart watch unisex voice assistant screen guard' },
      { subcategory: 'Analog Watches', query: 'analog watch men minimalist quartz style' }
    ]
  },
  {
    name: 'Room Decoration',
    targetCount: 80,
    keywords: [
      { subcategory: 'LED Strips', query: 'led strip lights rgb remote app controls 5m 10m' },
      { subcategory: 'Fairy Lights', query: 'fairy lights copper wire string warm white usb' },
      { subcategory: 'Moon Lamps', query: 'moon lamp led 3d color changing rechargeable desk' },
      { subcategory: 'Galaxy Projectors', query: 'galaxy projector sky night star planetarium room' },
      { subcategory: 'Wall Stickers', query: 'wall stickers aesthetic posters frame set college' },
      { subcategory: 'Mini Plants', query: 'mini artificial plants pots table office decor set' },
      { subcategory: 'Photo Clips', query: 'photo clips string lights polaroid wall display' },
      { subcategory: 'Desk Clocks', query: 'desk digital clock led smart alarm temperature date' },
      { subcategory: 'Digital Clocks', query: 'wall digital clock led remote display temperature' },
      { subcategory: 'Desk Organizers', query: 'aesthetic desk organizer drawers stationery holder' },
      { subcategory: 'Pen Holders', query: 'pen holder pencil stand desk tidy organizer' },
      { subcategory: 'Aroma Diffusers', query: 'aroma diffuser ultrasonic humidifier essential oil' },
      { subcategory: 'Mini Vacuum Cleaners', query: 'mini desktop vacuum cleaner keyboard duster USB' },
      { subcategory: 'Bluetooth Lamps', query: 'bluetooth speaker lamp touch sensor table color' }
    ]
  },
  {
    name: 'Gifts',
    targetCount: 60,
    keywords: [
      { subcategory: 'Couple Mugs', query: 'couple coffee mugs set anniversary ceramic gift' },
      { subcategory: 'Chocolate Boxes', query: 'chocolate gift pack assorted premium Cadbury' },
      { subcategory: 'Greeting Cards', query: 'greeting cards birthday love friendship pack' },
      { subcategory: 'Photo Frames', query: 'photo frame collage wall mount tabletop set' },
      { subcategory: 'Keychains', query: 'keychains cute cartoon anime keychain pack keys' },
      { subcategory: 'Cute Lamps', query: 'cute night light silicon cat duck rechargeable lamp' },
      { subcategory: 'Gift Hampers', query: 'gift hamper birthday anniversary corporate premium' },
      { subcategory: 'Mini Teddy Bears', query: 'mini teddy bear small soft toy pack gifts' }
    ]
  }
];

// Helper user agent rotator
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// -------------------------------------------------------------------------
// AMAZON SEARCH SCRAPER (ASIN Extractor)
// -------------------------------------------------------------------------
export async function searchAmazonASINs(keyword: string): Promise<string[]> {
  const asinsSet = new Set<string>();
  
  // Try different search URL strategies and User-Agents
  const strategies = [
    {
      // Strategy 1: Legacy Mobile search (very low bot protection)
      url: `https://www.amazon.in/gp/aw/s/ref=nb_sb_noss?k=${encodeURIComponent(keyword)}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      }
    },
    {
      // Strategy 2: Standard search with Discordbot UA
      url: `https://www.amazon.in/s?k=${encodeURIComponent(keyword)}`,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9'
      }
    },
    {
      // Strategy 3: Alternative desktop search format with rotating UA
      url: `https://www.amazon.in/s/ref=nb_sb_noss?url=search-alias%3Daps&field-keywords=${encodeURIComponent(keyword)}`,
      headers: {
        'User-Agent': getRandomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      }
    }
  ];

  for (let i = 0; i < strategies.length; i++) {
    const strat = strategies[i];
    try {
      console.log(`🔍 [Research] Searching Amazon (Strategy ${i + 1}): "${keyword}"`);
      const response = await axios.get(strat.url, {
        headers: strat.headers,
        timeout: 10000
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Check if blocked by captcha
      if ($('title').text().includes('Robot') || $('#captchacharacters').length > 0) {
        console.log(`⚠️ [Research] Strategy ${i + 1} hit CAPTCHA/Robot check. Trying next strategy...`);
        continue;
      }

      // 1. Scan data-asin attributes (Highly reliable for both mobile and desktop)
      $('[data-asin]').each((_, el) => {
        const asin = $(el).attr('data-asin');
        if (asin && asin.length === 10 && asin.toUpperCase().startsWith('B0')) {
          asinsSet.add(asin.toUpperCase());
        }
      });

      // 2. Scan links for ASINs (matches dp, gp/product, aw/d, gp/aw/d)
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          const match = href.match(/\/(?:dp|gp\/product|aw\/d|gp\/aw\/d)\/([A-Z0-9]{10})/i);
          if (match && match[1]) {
            asinsSet.add(match[1].toUpperCase());
          }
          // Query param matching (e.g. ?asin=B0...)
          const qMatch = href.match(/[?&]asin=([A-Z0-9]{10})/i);
          if (qMatch && qMatch[1]) {
            asinsSet.add(qMatch[1].toUpperCase());
          }
        }
      });

      // 3. Scan raw HTML for standard ASIN pattern
      const regex = /\b(B0[A-Z0-9]{8})\b/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        asinsSet.add(match[1].toUpperCase());
      }

      if (asinsSet.size > 0) {
        const asinsList = Array.from(asinsSet);
        console.log(`🎯 [Research] Strategy ${i + 1} succeeded! Extracted ${asinsList.length} unique ASIN candidates.`);
        return asinsList;
      }

    } catch (error: any) {
      console.warn(`⚠️ [Research] Strategy ${i + 1} failed: ${error.message}`);
    }
  }

  console.error(`❌ [Research] All search strategies failed to retrieve products for "${keyword}"`);
  return [];
}

// -------------------------------------------------------------------------
// AMAZON PRODUCT DETAILS SCRAPER & VERIFIER
// -------------------------------------------------------------------------
export interface DetailedAmazonProduct {
  asin: string;
  title: string;
  amazonUrl: string;
  brand: string | null;
  price: number;
  mrp: number;
  discount: number;
  coupon: boolean;
  rating: number | null;
  reviewCount: number;
  availability: string;
  image: string;
  seller: string | null;
  prime: boolean;
  amazonChoice: boolean;
  bestSeller: boolean;
  dealType: string;
  description: string;
  features: string[];
}

export async function fetchFullAmazonProductDetails(asin: string): Promise<DetailedAmazonProduct | null> {
  const cleanUrl = `https://www.amazon.in/dp/${asin}`;
  
  try {
    // We reuse the master fetcher logic but enrich it for wishlist fields!
    // Try layers (Layer 0 = PA-API, Layer 2 = Discordbot, Layer 3 = desktop)
    const baseDetails = await fetchBaseAmazonDetails(asin);
    if (!baseDetails || !baseDetails.title) {
      console.log(`🚫 [Research] Could not scrape base details for ${asin}`);
      return null;
    }

    // Now, load the full page to parse secondary details (seller, badges, etc.)
    // Pose as Discordbot UA first to get clean, quick metadata
    const response = await axios.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Parse brand
    let brand = $('#bylineInfo').text().replace('Visit the ', '').replace(' Store', '').trim() || null;
    if (!brand) {
      brand = $('#brand').text().trim() || null;
    }

    // Parse coupon
    let coupon = false;
    const couponText = $('#applicable_promo_fitment_trigger').text().toLowerCase() ||
                       $('.promoPriceBlock').text().toLowerCase() ||
                       $('#couponBadge').text().toLowerCase() ||
                       $('.coupon-badge-strip').text().toLowerCase();
    if (couponText.includes('coupon') || couponText.includes('save') || couponText.includes('% off')) {
      coupon = true;
    }

    // Parse rating & reviews
    let rating: number | null = baseDetails.rating || null;
    if (!rating) {
      const ratingText = $('.a-icon-alt').first().text().trim() || 
                         $('#acrPopover').attr('title') || '';
      const rMatch = ratingText.match(/([0-9.]+)\s*out of/i);
      if (rMatch) rating = parseFloat(rMatch[1]);
    }

    let reviewCount = 0;
    const reviewsText = $('#acrCustomerReviewText').first().text().trim() || '';
    if (reviewsText) {
      const revMatch = reviewsText.replace(/,/g, '').match(/(\d+)\s*ratings?/i);
      if (revMatch) reviewCount = parseInt(revMatch[1], 10);
    }

    // Parse availability
    let availability = 'Available';
    const availabilityText = $('#availability').text().trim().toLowerCase() || '';
    if (availabilityText.includes('currently unavailable') || availabilityText.includes('out of stock')) {
      availability = 'Currently Unavailable';
    } else if (availabilityText.includes('only') && availabilityText.includes('left')) {
      availability = 'Low Stock';
    }

    // Parse seller
    let seller = $('#merchantInfoFeature_div').text().trim() || null;
    if (seller) {
      const sMatch = seller.match(/Sold by\s+([^and\n.]+)/i);
      if (sMatch) seller = sMatch[1].trim();
      else seller = seller.substring(0, 50).trim();
    }
    if (!seller || seller.length < 3) {
      seller = $('#sellerProfileTriggerId').text().trim() || 'Amazon Retail';
    }

    // Badges & features
    const prime = $('.a-icon-prime').length > 0 || 
                  $('#primeBadge').length > 0 || 
                  response.data.includes('prime-badge');
                  
    const amazonChoice = $('.ac-badge-wrapper').length > 0 || 
                         response.data.includes('amazon\'s choice') || 
                         response.data.includes('Choice');
                         
    const bestSeller = $('.cat-badge-wrapper').length > 0 || 
                       response.data.includes('Best Seller') || 
                       response.data.includes('best-seller-badge');

    // Deal type
    let dealType = 'none';
    const dealBadgeText = $('.lightning-deal-badge').text() || 
                          $('.deal-badge').text() || 
                          $('#dealBadge').text() || '';
    if (dealBadgeText.toLowerCase().includes('lightning')) {
      dealType = 'lightning';
    } else if (dealBadgeText.toLowerCase().includes('deal of the day')) {
      dealType = 'deal_of_the_day';
    } else if (baseDetails.originalPrice > baseDetails.currentPrice) {
      dealType = 'price_drop';
    }

    // Features / Bullets
    const features: string[] = [];
    $('#feature-bullets ul li').each((_, el) => {
      const text = $(el).find('span').text().trim();
      if (text && text.length > 5 && !text.includes('Make sure this fits')) {
        features.push(text);
      }
    });

    const description = $('#productDescription').text().trim() || 
                        features.slice(0, 2).join('. ') || 
                        baseDetails.title;

    const price = baseDetails.currentPrice || 0;
    const mrp = baseDetails.originalPrice || price;
    const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

    return {
      asin,
      title: baseDetails.title,
      amazonUrl: cleanUrl,
      brand,
      price,
      mrp,
      discount,
      coupon,
      rating,
      reviewCount,
      availability,
      image: baseDetails.imageUrl || '',
      seller,
      prime,
      amazonChoice,
      bestSeller,
      dealType,
      description,
      features
    };

  } catch (error: any) {
    console.error(`❌ [Research] Details failed for ${asin}: ${error.message}`);
    return null;
  }
}

// -------------------------------------------------------------------------
// PRODUCT VERIFICATION RULES
// -------------------------------------------------------------------------
export function verifyProduct(product: DetailedAmazonProduct, allowedCategory: string): { valid: boolean; reason?: string } {
  // Rules checking
  if (!product.asin) return { valid: false, reason: 'Missing ASIN' };
  if (!product.title || product.title.length < 8) return { valid: false, reason: 'Invalid or short title' };
  if (!product.price || product.price <= 0) return { valid: false, reason: 'Missing or zero price' };
  if (!product.image || !product.image.startsWith('http')) return { valid: false, reason: 'Missing valid image URL' };
  if (product.availability === 'Currently Unavailable') return { valid: false, reason: 'Currently unavailable on Amazon' };

  // Price range verification (Avoid luxury or high price items, priority is ₹99 - ₹1999)
  if (product.price > 2500) return { valid: false, reason: 'Price too high (> ₹2500)' };
  if (product.price < 80) return { valid: false, reason: 'Price too low (< ₹80)' };

  // Avoid disallowed categories
  const lowerTitle = product.title.toLowerCase();
  const avoidKeywords = [
    'adult', 'sex', 'condom', 'lubricant', 'medicine', 'syrup', 'tablet',
    'refrigerator', 'fridge', 'washing machine', 'air conditioner', 'television', 'tv', 'sofa',
    'bed', 'dining table', 'wardrobe', 'drill machine', 'saw', 'screwdriver kit',
    'diaper', 'baby toy', 'infant', 'toddler', 'pregnancy', 'luxury', 'rolex'
  ];

  for (const kw of avoidKeywords) {
    if (lowerTitle.includes(kw)) {
      return { valid: false, reason: `Matches avoid keyword: "${kw}"` };
    }
  }

  return { valid: true };
}

// -------------------------------------------------------------------------
// PRODUCT SCORING ALGORITHM
// -------------------------------------------------------------------------
export interface ProductScores {
  studentScore: number;
  hostelScore: number;
  fashionScore: number;
  giftScore: number;
  impulseScore: number;
  affiliateScore: number;
  priorityScore: number;
}

export function calculateScores(product: DetailedAmazonProduct, categoryName: string, subcategory: string): ProductScores {
  const price = product.price;
  const discount = product.discount;
  const rating = product.rating || 4.0;
  const reviews = product.reviewCount;
  
  // 1. Student Score (0-100)
  // Highly budget oriented. Fits Study Essentials, Laptops, Hostel, or student Fashion.
  let studentScore = 50; // Base score
  if (categoryName === 'Study Essentials') studentScore += 30;
  if (categoryName === 'Laptop Accessories') studentScore += 20;
  if (categoryName === 'Hostel Essentials') studentScore += 15;
  
  // Budget booster (students love deals under ₹499)
  if (price >= 99 && price <= 299) studentScore += 15;
  else if (price > 299 && price <= 499) studentScore += 10;
  else if (price > 999) studentScore -= 15; // Expensive for students
  
  // Discount booster
  if (discount > 40) studentScore += 10;
  studentScore = Math.max(0, Math.min(100, studentScore));

  // 2. Hostel Score (0-100)
  let hostelScore = 30;
  if (categoryName === 'Hostel Essentials') {
    hostelScore = 90;
  } else if (subcategory.includes('Kettle') || subcategory.includes('Board') || subcategory.includes('Fan')) {
    hostelScore = 95;
  } else if (categoryName === 'Room Decoration') {
    hostelScore = 75;
  }
  // Budget fit for hostels
  if (price > 1200) hostelScore -= 10;
  hostelScore = Math.max(0, Math.min(100, hostelScore));

  // 3. Fashion Score (0-100)
  let fashionScore = 10;
  if (categoryName === "Men's Fashion" || categoryName === "Women's Fashion") {
    fashionScore = 90;
  } else if (categoryName === 'Watches') {
    fashionScore = 80;
  }
  fashionScore = Math.max(0, Math.min(100, fashionScore));

  // 4. Gift Score (0-100)
  let giftScore = 20;
  if (categoryName === 'Gifts') {
    giftScore = 90;
  } else if (categoryName === 'Room Decoration' || categoryName === 'Watches') {
    giftScore = 70;
  }
  giftScore = Math.max(0, Math.min(100, giftScore));

  // 5. Impulse Buy Score (0-100)
  // Low price + high discount + high rating + reviews = high impulse buy
  let impulseScore = 30;
  if (price >= 99 && price <= 399) impulseScore += 30; // Easy impulse price
  else if (price > 399 && price <= 799) impulseScore += 15;
  else if (price > 1499) impulseScore -= 20; // High friction

  if (discount >= 50) impulseScore += 25;
  else if (discount >= 30) impulseScore += 15;

  if (rating >= 4.2) impulseScore += 10;
  if (reviews > 1000) impulseScore += 10;
  
  if (product.bestSeller || product.amazonChoice) impulseScore += 10;
  impulseScore = Math.max(0, Math.min(100, impulseScore));

  // 6. Affiliate Score (0-100)
  // High commission categories (Fashion = 9%, Electronics Accessories = 6-8%, books = 8%, other = 5%)
  let commissionPct = 5.0; // Base 5%
  if (categoryName === "Men's Fashion" || categoryName === "Women's Fashion" || subcategory.includes('Bag') || subcategory.includes('Sleeve')) {
    commissionPct = 9.0;
  } else if (categoryName === 'Laptop Accessories' || categoryName === 'Mobile Accessories') {
    commissionPct = 7.0;
  } else if (categoryName === 'Study Essentials') {
    commissionPct = 8.0;
  }
  let affiliateScore = commissionPct * 10; // e.g. 9% = 90 score
  if (product.prime) affiliateScore += 5; // Prime products convert better
  if (reviews > 500) affiliateScore += 5;
  affiliateScore = Math.max(0, Math.min(100, affiliateScore));

  // 7. Priority Score (0-100) - Overall rank formula
  // Priority Score = 40% Student Demand + 20% Discount Frequency + 15% Review Count + 10% Rating + 10% Commission + 5% Price Stability
  // Let's model each:
  const studentDemandScore = studentScore; // 40%
  const discountFreqScore = Math.min(100, discount * 1.5); // 20%
  const reviewScoreVal = Math.min(100, Math.log10(reviews + 1) * 22); // 15%
  const ratingScoreVal = Math.min(100, rating * 20); // 10%
  const commissionScoreVal = commissionPct * 10; // 10%
  const priceStabilityScore = 90; // Default high for Amazon products (5%)

  const priorityScore = Math.round(
    (studentDemandScore * 0.40) +
    (discountFreqScore * 0.20) +
    (reviewScoreVal * 0.15) +
    (ratingScoreVal * 0.10) +
    (commissionScoreVal * 0.10) +
    (priceStabilityScore * 0.05)
  );

  return {
    studentScore,
    hostelScore,
    fashionScore,
    giftScore,
    impulseScore,
    affiliateScore,
    priorityScore: Math.max(0, Math.min(100, priorityScore))
  };
}

// -------------------------------------------------------------------------
// RE RESEARCH TABLE CREATOR FOR SELF-HEALING ARCHITECTURE
// -------------------------------------------------------------------------
export async function ensureWishlistTableExists() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WishlistProduct" (
        "id" TEXT NOT NULL,
        "asin" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "amazon_url" TEXT NOT NULL,
        "brand" TEXT,
        "category" TEXT NOT NULL,
        "subcategory" TEXT NOT NULL,
        "price" DOUBLE PRECISION NOT NULL,
        "mrp" DOUBLE PRECISION NOT NULL,
        "discount" DOUBLE PRECISION NOT NULL,
        "coupon" BOOLEAN NOT NULL DEFAULT false,
        "rating" DOUBLE PRECISION,
        "review_count" INTEGER NOT NULL DEFAULT 0,
        "availability" TEXT NOT NULL DEFAULT 'Available',
        "image" TEXT NOT NULL,
        "seller" TEXT,
        "prime" BOOLEAN NOT NULL DEFAULT false,
        "amazon_choice" BOOLEAN NOT NULL DEFAULT false,
        "best_seller" BOOLEAN NOT NULL DEFAULT false,
        "deal_type" TEXT NOT NULL DEFAULT 'none',
        "priority_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "buy_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "student_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "hostel_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "fashion_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "gift_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "affiliate_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "wishlist" BOOLEAN NOT NULL DEFAULT true,
        "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "WishlistProduct_pkey" PRIMARY KEY ("id")
      );
    `);
    
    // Create unique index
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "WishlistProduct_asin_key" ON "WishlistProduct"("asin");
    `);
    console.log(`✅ [DB] Verified WishlistProduct database table structure.`);
  } catch (error: any) {
    console.error(`❌ [DB] Failed to verify/create WishlistProduct table: ${error.message}`);
  }
}
