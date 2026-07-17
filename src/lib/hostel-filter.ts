// ╔═══════════════════════════════════════════════════════════════════════╗
// ║                                                                       ║
// ║   🧠  SMART STUDENT FILTER — Hostel Channel Intelligence Engine      ║
// ║                                                                       ║
// ║   ⚠️  DO NOT MODIFY THIS FILE ⚠️                                     ║
// ║                                                                       ║
// ║   This file decides which deals get posted to the hostel channel.     ║
// ║   It uses a scoring algorithm based on price, discount, and product   ║
// ║   category to determine student relevance.                            ║
// ║                                                                       ║
// ║   WHY YOU MUST NOT CHANGE THIS FILE:                                 ║
// ║   - The keyword lists and scoring weights are carefully tuned         ║
// ║   - Changing thresholds can flood the channel with irrelevant deals   ║
// ║   - Or starve the channel by filtering too aggressively               ║
// ║                                                                       ║
// ║   SAFE CHANGES (only these):                                         ║
// ║   - Adding new keywords to existing category arrays                   ║
// ║   - Adjusting STUDENT_SCORE_THRESHOLD (default: 40)                  ║
// ║                                                                       ║
// ║   Last verified working: July 2026                                    ║
// ║   Author: Claude (Opus)                                               ║
// ║                                                                       ║
// ╚═══════════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────
export interface StudentScoreResult {
  score: number;
  reason: string;
  isFlashDeal: boolean;
  dealTag: string;       // e.g. "🔥 FLASH DEAL", "💥 MEGA DEAL", etc.
  category: string;      // e.g. "📱 Tech", "👟 Fashion", etc.
}

export interface DealInput {
  title: string;
  price: number;
  originalPrice: number;
  discountPct: number;
  platform: string;
}

// ─────────────────────────────────────────────────────────────────────────
// MINIMUM SCORE TO POST TO HOSTEL CHANNEL
// ─────────────────────────────────────────────────────────────────────────
export const STUDENT_SCORE_THRESHOLD = 40;

// ─────────────────────────────────────────────────────────────────────────
// CATEGORY KEYWORDS — Products students actually buy
// ─────────────────────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: { name: string; emoji: string; keywords: string[]; bonus: number }[] = [
  {
    name: 'Stationery',
    emoji: '✏️',
    bonus: 35,
    keywords: [
      'pen', 'pencil', 'notebook', 'diary', 'planner', 'calculator', 'marker',
      'highlighter', 'stapler', 'file', 'folder', 'sticky notes', 'whiteboard',
      'register', 'eraser', 'sharpener', 'compass', 'geometry', 'ruler', 'scale',
      'sketch', 'drawing', 'paper', 'envelope', 'clipboard', 'binder'
    ]
  },
  {
    name: 'Hostel Living',
    emoji: '🏠',
    bonus: 35,
    keywords: [
      'umbrella', 'raincoat', 'rain coat', 'bottle', 'flask', 'lunch box', 'lunchbox',
      'mug', 'cup', 'plate', 'spoon', 'fork', 'bucket', 'hanger', 'curtain',
      'bedsheet', 'bed sheet', 'pillow', 'towel', 'mat', 'lock', 'padlock',
      'mosquito net', 'mosquito racket', 'cloth stand', 'drying stand', 'cloth drying',
      'iron', 'press', 'mini fan', 'table fan', 'storage box', 'organizer',
      'organiser', 'mirror', 'dustbin', 'broom', 'chair', 'stool', 'lamp',
      'table lamp', 'study lamp', 'LED light', 'extension board', 'power strip',
      'multi plug', 'alarm clock', 'door mat', 'shoe rack', 'laundry bag',
      'clothes pin', 'clip', 'rope', 'wire', 'hook'
    ]
  },
  {
    name: 'Electronics',
    emoji: '📱',
    bonus: 30,
    keywords: [
      'earbuds', 'earphone', 'headphone', 'speaker', 'charger', 'powerbank',
      'power bank', 'cable', 'mouse', 'keyboard', 'pen drive', 'pendrive',
      'hard disk', 'ssd', 'laptop stand', 'laptop sleeve', 'laptop bag',
      'webcam', 'microphone', 'mic', 'usb', 'hub', 'adapter', 'dongle',
      'smartwatch', 'smart watch', 'fitness band', 'tablet', 'kindle',
      'trimmer', 'shaver', 'hair dryer', 'straightener'
    ]
  },
  {
    name: 'Fashion',
    emoji: '👟',
    bonus: 25,
    keywords: [
      'shoes', 'sneakers', 'sandal', 'slipper', 'crocs', 'watch', 'wallet',
      'belt', 'sunglasses', 'cap', 'hat', 'hoodie', 'jacket', 'jeans',
      't-shirt', 'tshirt', 'shirt', 'kurta', 'socks', 'bag', 'backpack',
      'duffle', 'duffel', 'tote', 'handbag', 'purse', 'clutch',
      'track pants', 'joggers', 'shorts', 'boxers', 'innerwear'
    ]
  },
  {
    name: 'Fitness',
    emoji: '🏋️',
    bonus: 25,
    keywords: [
      'gym', 'dumbbells', 'dumbbell', 'yoga mat', 'skipping rope', 'jump rope',
      'resistance band', 'cricket', 'badminton', 'football', 'basketball',
      'racket', 'shuttle', 'sports shoes', 'gloves', 'bat', 'ball',
      'tennis', 'swimming', 'goggles', 'shaker', 'gym bag', 'wrist band',
      'head band', 'knee cap', 'ankle support', 'gripper', 'pull up bar',
      'push up bar', 'ab roller', 'cycling'
    ]
  },
  {
    name: 'Grooming',
    emoji: '💈',
    bonus: 20,
    keywords: [
      'perfume', 'deodorant', 'deo', 'body spray', 'face wash', 'moisturizer',
      'moisturiser', 'sunscreen', 'shampoo', 'conditioner', 'hair oil', 'serum',
      'skincare', 'lip balm', 'comb', 'brush', 'razor', 'blade', 'cream',
      'lotion', 'body wash', 'soap', 'handwash', 'sanitizer', 'tissue',
      'wet wipes', 'cotton', 'nail cutter', 'tweezer', 'cologne', 'aftershave'
    ]
  },
  {
    name: 'Food & Kitchen',
    emoji: '🍜',
    bonus: 20,
    keywords: [
      'noodles', 'maggi', 'protein', 'whey', 'peanut butter', 'oats',
      'green tea', 'coffee', 'tea', 'snacks', 'dry fruits', 'chocolate',
      'biscuit', 'cookies', 'chips', 'mixer', 'blender', 'kettle',
      'induction', 'cooker', 'tiffin', 'container', 'jar', 'dabba',
      'chopper', 'grinder', 'juicer', 'toaster', 'sandwich maker', 'pan',
      'kadhai', 'spice', 'masala', 'honey', 'jam', 'sauce'
    ]
  },
];

// ─────────────────────────────────────────────────────────────────────────
// PENALTY KEYWORDS — Products students DON'T buy
// ─────────────────────────────────────────────────────────────────────────

const PENALTY_KEYWORDS: { keywords: string[]; penalty: number }[] = [
  {
    // Home Appliances — way too expensive & not for hostel
    penalty: -50,
    keywords: [
      'air conditioner', ' ac ', 'split ac', 'window ac', 'refrigerator', 'fridge',
      'washing machine', 'geyser', 'water heater', 'dishwasher', 'chimney',
      'ro ', 'water purifier', 'air cooler', 'room heater', 'vacuum cleaner'
    ]
  },
  {
    // Baby & Kids — not relevant for college students
    penalty: -40,
    keywords: [
      'baby', 'toddler', 'infant', 'diaper', 'stroller', 'cradle', 'crib',
      'rattle', 'teether', 'baby walker', 'feeding bottle', 'baby food',
      'kids toy', 'barbie', 'hot wheels', 'lego '
    ]
  },
  {
    // Heavy Furniture — can't keep in hostel
    penalty: -40,
    keywords: [
      'sofa', 'dining table', 'double bed', 'king size', 'queen size',
      'wardrobe', 'almirah', 'cupboard', 'dressing table', 'tv stand',
      'center table', 'coffee table', 'recliner'
    ]
  },
  {
    // Industrial / Commercial — not consumer products
    penalty: -30,
    keywords: [
      'drill machine', 'welding', 'industrial', 'commercial grade',
      'heavy duty motor', 'generator', 'compressor', 'pump set'
    ]
  },
  {
    // Medical / Senior — not for young students
    penalty: -20,
    keywords: [
      'blood pressure', 'bp monitor', 'glucometer', 'hearing aid',
      'walking stick', 'wheelchair', 'orthopedic', 'knee brace'
    ]
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 🚀 MAIN EXPORT — Calculate student relevance score for a deal
// ─────────────────────────────────────────────────────────────────────────
export function calculateStudentScore(deal: DealInput): StudentScoreResult {
  const title = deal.title.toLowerCase();
  const price = deal.price;
  const discountPct = deal.discountPct;

  // ── Flash Deal Override ──
  // 70%+ off AND under ₹999 → ALWAYS post, no questions asked
  if (discountPct >= 70 && price <= 999) {
    const category = detectCategory(title);
    // Still check for hard penalties (baby items, AC, etc.)
    const penaltyScore = calculatePenalty(title);
    if (penaltyScore <= -40) {
      // Even flash deals are skipped if it's baby/furniture/appliance
      return {
        score: penaltyScore + 30,
        reason: `Flash deal but irrelevant category (penalty: ${penaltyScore})`,
        isFlashDeal: false,
        dealTag: '',
        category: category.emoji + ' ' + category.name,
      };
    }
    return {
      score: 100,
      reason: `🔥 Flash Deal Override: ${discountPct}% off at ₹${price}`,
      isFlashDeal: true,
      dealTag: '🔥 FLASH DEAL — Grab before stock ends!',
      category: category.emoji + ' ' + category.name,
    };
  }

  // ── Calculate Score ──
  let score = 10; // Base score
  const reasons: string[] = [];

  // 1. Category Bonus
  const category = detectCategory(title);
  if (category.bonus > 0) {
    score += category.bonus;
    reasons.push(`Category: ${category.name} (+${category.bonus})`);
  }

  // 2. Price Bonus
  const priceBonus = calculatePriceBonus(price);
  score += priceBonus;
  if (priceBonus !== 0) {
    reasons.push(`Price ₹${price} (${priceBonus > 0 ? '+' : ''}${priceBonus})`);
  }

  // 3. Discount Bonus
  const discountBonus = calculateDiscountBonus(discountPct);
  score += discountBonus;
  if (discountBonus > 0) {
    reasons.push(`Discount ${discountPct}% (+${discountBonus})`);
  }

  // 4. Penalties
  const penaltyScore = calculatePenalty(title);
  score += penaltyScore;
  if (penaltyScore < 0) {
    reasons.push(`Penalty: irrelevant category (${penaltyScore})`);
  }

  // ── Determine Deal Tag ──
  let dealTag = '';
  if (discountPct >= 70) dealTag = '🔥 MEGA DEAL';
  else if (discountPct >= 60) dealTag = '💥 SUPER DEAL';
  else if (discountPct >= 50) dealTag = '🎯 GREAT DEAL';
  else if (discountPct >= 40) dealTag = '👍 GOOD DEAL';

  return {
    score: Math.max(0, Math.min(100, score)),
    reason: reasons.join(' | '),
    isFlashDeal: false,
    dealTag,
    category: category.emoji + ' ' + category.name,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Detect product category from title
// ─────────────────────────────────────────────────────────────────────────
function detectCategory(title: string): { name: string; emoji: string; bonus: number } {
  let bestMatch = { name: 'General', emoji: '🛒', bonus: 0 };
  let maxKeywordMatches = 0;

  for (const cat of CATEGORY_KEYWORDS) {
    let matchCount = 0;
    for (const keyword of cat.keywords) {
      if (title.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount > maxKeywordMatches) {
      maxKeywordMatches = matchCount;
      bestMatch = { name: cat.name, emoji: cat.emoji, bonus: cat.bonus };
    }
  }

  return bestMatch;
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Calculate price bonus for student budgets
// ─────────────────────────────────────────────────────────────────────────
function calculatePriceBonus(price: number): number {
  if (price <= 199) return 30;      // Impulse buy
  if (price <= 499) return 25;      // Pocket money
  if (price <= 999) return 20;      // Affordable
  if (price <= 1999) return 10;     // Reasonable if useful
  if (price <= 2999) return 5;      // Only if really needed
  return -5;                         // Expensive for most students
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Calculate discount bonus
// ─────────────────────────────────────────────────────────────────────────
function calculateDiscountBonus(discountPct: number): number {
  if (discountPct >= 70) return 35;
  if (discountPct >= 60) return 25;
  if (discountPct >= 50) return 15;
  if (discountPct >= 40) return 5;
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Calculate penalty for irrelevant categories
// ─────────────────────────────────────────────────────────────────────────
function calculatePenalty(title: string): number {
  let totalPenalty = 0;

  for (const penaltyGroup of PENALTY_KEYWORDS) {
    for (const keyword of penaltyGroup.keywords) {
      if (title.includes(keyword.toLowerCase())) {
        totalPenalty += penaltyGroup.penalty;
        break; // Only penalize once per group
      }
    }
  }

  return totalPenalty;
}

// ─────────────────────────────────────────────────────────────────────────
// UTILITY: Check if a deal should be posted to hostel channel
// ─────────────────────────────────────────────────────────────────────────
export function shouldPostToHostel(deal: DealInput): StudentScoreResult & { shouldPost: boolean } {
  const result = calculateStudentScore(deal);
  return {
    ...result,
    shouldPost: result.isFlashDeal || result.score >= STUDENT_SCORE_THRESHOLD,
  };
}
