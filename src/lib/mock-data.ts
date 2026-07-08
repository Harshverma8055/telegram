// ==========================================
// DealFlow AI — Mock Data
// ==========================================

import { Deal, ScraperStatus, TelegramChannel, DashboardStats, AnalyticsData, Notification } from '@/types';

export const PLATFORM_NAMES: Record<string, string> = {
  amazon: 'Amazon',
  flipkart: 'Flipkart',
  myntra: 'Myntra',
  ajio: 'AJIO',
  meesho: 'Meesho',
  nykaa: 'Nykaa',
  croma: 'Croma',
  reliance_digital: 'Reliance Digital',
  tata_cliq: 'Tata CLiQ',
  jiomart: 'JioMart',
  snapdeal: 'Snapdeal',
  firstcry: 'FirstCry',
  boat: 'boAt',
  samsung: 'Samsung',
  apple: 'Apple',
  oneplus: 'OnePlus',
  mi: 'Mi',
  lenovo: 'Lenovo',
  hp: 'HP',
  dell: 'Dell',
  asus: 'ASUS',
  nike: 'Nike',
  adidas: 'Adidas',
  puma: 'Puma',
};

export const PLATFORM_COLORS: Record<string, string> = {
  amazon: '#ff9900',
  flipkart: '#2874f0',
  myntra: '#ff3f6c',
  ajio: '#4a4a4a',
  meesho: '#570a57',
  nykaa: '#fc2779',
  croma: '#0f7c40',
  reliance_digital: '#005bab',
  tata_cliq: '#d93067',
  jiomart: '#0078ad',
  snapdeal: '#e40046',
  firstcry: '#3daaf0',
  boat: '#1a1a2e',
  samsung: '#1428a0',
  apple: '#a2aaad',
  oneplus: '#eb0028',
  mi: '#ff6700',
  lenovo: '#e2231a',
  hp: '#0096d6',
  dell: '#007db8',
  asus: '#00bce4',
  nike: '#111111',
  adidas: '#000000',
  puma: '#d50032',
};

export const DEAL_TYPE_LABELS: Record<string, string> = {
  flash_sale: '⚡ Flash Sale',
  lightning_deal: '🔥 Lightning Deal',
  price_drop: '📉 Price Drop',
  coupon: '🎟️ Coupon',
  bank_offer: '🏦 Bank Offer',
  cashback: '💰 Cashback',
  exchange: '🔄 Exchange',
  combo: '📦 Combo',
  clearance: '🏷️ Clearance',
  festival: '🎉 Festival',
  emi: '💳 EMI',
  open_box: '📭 Open Box',
  warehouse: '🏪 Warehouse',
};

export const mockDeals: Deal[] = [
  {
    id: '1',
    title: 'Samsung Galaxy S25 Ultra 5G (Titanium Black, 12GB RAM, 256GB)',
    platform: 'amazon',
    category: 'Smartphones',
    brand: 'Samsung',
    originalPrice: 134999,
    dealPrice: 89999,
    discount: 33,
    dealScore: 97,
    dealType: 'lightning_deal',
    bankOffer: 'Extra ₹4,000 off with HDFC Bank Cards',
    cashback: '₹2,000 Amazon Pay Cashback',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.5,
    reviewCount: 12847,
    isGenuine: true,
    expiresAt: '2026-07-08T18:00:00Z',
    publishedAt: '2026-07-08T10:00:00Z',
    isPublished: true,
    clicks: 4523,
    conversions: 234,
    revenue: 45670,
  },
  {
    id: '2',
    title: 'Apple MacBook Air M4 15-inch (16GB RAM, 512GB SSD, Space Gray)',
    platform: 'flipkart',
    category: 'Laptops',
    brand: 'Apple',
    originalPrice: 179900,
    dealPrice: 139900,
    discount: 22,
    dealScore: 94,
    dealType: 'price_drop',
    bankOffer: 'Extra ₹5,000 off with Axis Bank Cards',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.8,
    reviewCount: 3241,
    isGenuine: true,
    expiresAt: '2026-07-10T23:59:00Z',
    publishedAt: '2026-07-08T09:30:00Z',
    isPublished: true,
    clicks: 3891,
    conversions: 156,
    revenue: 89230,
  },
  {
    id: '3',
    title: 'Sony WH-1000XM6 Wireless Noise Cancelling Headphones (Black)',
    platform: 'amazon',
    category: 'Audio',
    brand: 'Sony',
    originalPrice: 34990,
    dealPrice: 22990,
    discount: 34,
    dealScore: 91,
    dealType: 'flash_sale',
    couponCode: 'SONY3K',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.7,
    reviewCount: 8923,
    isGenuine: true,
    expiresAt: '2026-07-08T15:00:00Z',
    isPublished: true,
    clicks: 2340,
    conversions: 189,
    revenue: 23450,
  },
  {
    id: '4',
    title: 'Nike Air Max Dn8 (White/Black/Pure Platinum)',
    platform: 'myntra',
    category: 'Footwear',
    brand: 'Nike',
    originalPrice: 16995,
    dealPrice: 9497,
    discount: 44,
    dealScore: 88,
    dealType: 'clearance',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.3,
    reviewCount: 2134,
    isGenuine: true,
    expiresAt: '2026-07-15T23:59:00Z',
    isPublished: true,
    clicks: 1890,
    conversions: 145,
    revenue: 12340,
  },
  {
    id: '5',
    title: 'LG 65" 4K OLED Evo TV (OLED65C4) with AI ThinQ',
    platform: 'croma',
    category: 'TVs',
    brand: 'LG',
    originalPrice: 299990,
    dealPrice: 189990,
    discount: 37,
    dealScore: 95,
    dealType: 'festival',
    bankOffer: 'Extra ₹10,000 off with ICICI Bank',
    cashback: '₹5,000 Croma Cashback',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.6,
    reviewCount: 1567,
    isGenuine: true,
    expiresAt: '2026-07-12T23:59:00Z',
    isPublished: false,
    clicks: 567,
    conversions: 23,
    revenue: 56780,
  },
  {
    id: '6',
    title: 'boAt Airdopes 511 ANC True Wireless Earbuds',
    platform: 'amazon',
    category: 'Audio',
    brand: 'boAt',
    originalPrice: 4999,
    dealPrice: 1499,
    discount: 70,
    dealScore: 82,
    dealType: 'lightning_deal',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.1,
    reviewCount: 45231,
    isGenuine: true,
    expiresAt: '2026-07-08T20:00:00Z',
    isPublished: true,
    clicks: 8923,
    conversions: 1234,
    revenue: 8900,
  },
  {
    id: '7',
    title: 'Dyson V15s Detect Submarine Wet & Dry Vacuum',
    platform: 'flipkart',
    category: 'Home Appliances',
    brand: 'Dyson',
    originalPrice: 79900,
    dealPrice: 59900,
    discount: 25,
    dealScore: 86,
    dealType: 'bank_offer',
    bankOffer: '₹3,000 off on SBI Credit Card',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.4,
    reviewCount: 891,
    isGenuine: true,
    expiresAt: '2026-07-20T23:59:00Z',
    isPublished: true,
    clicks: 1234,
    conversions: 67,
    revenue: 34560,
  },
  {
    id: '8',
    title: 'OnePlus 13 5G (Midnight Ocean, 12GB/256GB, Snapdragon 8 Elite)',
    platform: 'oneplus',
    category: 'Smartphones',
    brand: 'OnePlus',
    originalPrice: 69999,
    dealPrice: 57999,
    discount: 17,
    dealScore: 78,
    dealType: 'coupon',
    couponCode: 'OP5K',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.5,
    reviewCount: 6789,
    isGenuine: true,
    expiresAt: '2026-07-09T23:59:00Z',
    isPublished: true,
    clicks: 3456,
    conversions: 234,
    revenue: 23450,
  },
  {
    id: '9',
    title: 'Pampers Premium Care Pants (Pack of 132) - Large',
    platform: 'firstcry',
    category: 'Baby Products',
    brand: 'Pampers',
    originalPrice: 3499,
    dealPrice: 1749,
    discount: 50,
    dealScore: 92,
    dealType: 'combo',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.6,
    reviewCount: 23456,
    isGenuine: true,
    expiresAt: '2026-07-30T23:59:00Z',
    isPublished: true,
    clicks: 5678,
    conversions: 890,
    revenue: 15670,
  },
  {
    id: '10',
    title: 'ASUS ROG Strix G16 Gaming Laptop (i9-14900HX, RTX 4070, 32GB)',
    platform: 'amazon',
    category: 'Laptops',
    brand: 'ASUS',
    originalPrice: 199990,
    dealPrice: 149990,
    discount: 25,
    dealScore: 89,
    dealType: 'price_drop',
    bankOffer: '₹7,500 off with HDFC Bank EMI',
    imageUrl: '/api/placeholder/300/300',
    rating: 4.5,
    reviewCount: 2345,
    isGenuine: true,
    expiresAt: '2026-07-15T23:59:00Z',
    isPublished: false,
    clicks: 2345,
    conversions: 89,
    revenue: 67890,
  },
];

export const mockScraperStatus: ScraperStatus[] = [
  { id: '1', platform: 'amazon', status: 'running', productsScanned: 45672, dealsFound: 234, lastRunAt: '2026-07-08T13:00:00Z', nextRunAt: '2026-07-08T14:00:00Z', duration: 0, errors: 0 },
  { id: '2', platform: 'flipkart', status: 'completed', productsScanned: 38901, dealsFound: 189, lastRunAt: '2026-07-08T12:30:00Z', nextRunAt: '2026-07-08T13:30:00Z', duration: 1234, errors: 2 },
  { id: '3', platform: 'myntra', status: 'completed', productsScanned: 12345, dealsFound: 78, lastRunAt: '2026-07-08T12:00:00Z', nextRunAt: '2026-07-08T14:00:00Z', duration: 890, errors: 0 },
  { id: '4', platform: 'ajio', status: 'idle', productsScanned: 0, dealsFound: 0, lastRunAt: '2026-07-08T11:00:00Z', nextRunAt: '2026-07-08T15:00:00Z', duration: 0, errors: 0 },
  { id: '5', platform: 'meesho', status: 'queued', productsScanned: 0, dealsFound: 0, lastRunAt: '2026-07-08T10:00:00Z', nextRunAt: '2026-07-08T13:15:00Z', duration: 0, errors: 0 },
  { id: '6', platform: 'nykaa', status: 'completed', productsScanned: 8901, dealsFound: 45, lastRunAt: '2026-07-08T12:45:00Z', nextRunAt: '2026-07-08T14:45:00Z', duration: 567, errors: 1 },
  { id: '7', platform: 'croma', status: 'failed', productsScanned: 2345, dealsFound: 12, lastRunAt: '2026-07-08T12:15:00Z', nextRunAt: '2026-07-08T13:15:00Z', duration: 345, errors: 5 },
  { id: '8', platform: 'samsung', status: 'completed', productsScanned: 5678, dealsFound: 34, lastRunAt: '2026-07-08T12:30:00Z', nextRunAt: '2026-07-08T14:30:00Z', duration: 678, errors: 0 },
  { id: '9', platform: 'oneplus', status: 'idle', productsScanned: 0, dealsFound: 0, lastRunAt: '2026-07-08T11:30:00Z', nextRunAt: '2026-07-08T15:30:00Z', duration: 0, errors: 0 },
  { id: '10', platform: 'firstcry', status: 'completed', productsScanned: 4567, dealsFound: 23, lastRunAt: '2026-07-08T12:00:00Z', nextRunAt: '2026-07-08T14:00:00Z', duration: 456, errors: 0 },
];

export const mockTelegramChannels: TelegramChannel[] = [
  { id: '1', name: 'DealFlow — Hot Deals 🔥', username: '@dealflow_hot', members: 125400, postsToday: 47, isActive: true, autoPublish: true, categories: ['All'] },
  { id: '2', name: 'DealFlow — Electronics', username: '@dealflow_tech', members: 89200, postsToday: 23, isActive: true, autoPublish: true, categories: ['Smartphones', 'Laptops', 'Audio', 'TVs'] },
  { id: '3', name: 'DealFlow — Fashion', username: '@dealflow_fashion', members: 67800, postsToday: 31, isActive: true, autoPublish: true, categories: ['Footwear', 'Clothing', 'Accessories'] },
  { id: '4', name: 'DealFlow — Home & Kitchen', username: '@dealflow_home', members: 45600, postsToday: 15, isActive: true, autoPublish: false, categories: ['Home Appliances', 'Kitchen'] },
  { id: '5', name: 'DealFlow — Premium Only', username: '@dealflow_premium', members: 23400, postsToday: 8, isActive: true, autoPublish: true, categories: ['All'] },
];

export const mockDashboardStats: DashboardStats = {
  totalRevenue: 4567890,
  revenueChange: 23.5,
  totalClicks: 892345,
  clicksChange: 15.2,
  totalDeals: 12456,
  dealsChange: 8.7,
  conversionRate: 4.8,
  conversionChange: 1.2,
  activeScrapers: 8,
  telegramPosts: 124,
  avgDealScore: 78,
  topPlatform: 'Amazon',
};

export const mockRevenueTimeline = [
  { date: '2026-07-01', value: 123456 },
  { date: '2026-07-02', value: 145678 },
  { date: '2026-07-03', value: 167890 },
  { date: '2026-07-04', value: 189012 },
  { date: '2026-07-05', value: 234567 },
  { date: '2026-07-06', value: 289012 },
  { date: '2026-07-07', value: 345678 },
  { date: '2026-07-08', value: 456789 },
];

export const mockClicksTimeline = [
  { date: '2026-07-01', value: 23456 },
  { date: '2026-07-02', value: 28901 },
  { date: '2026-07-03', value: 34567 },
  { date: '2026-07-04', value: 39012 },
  { date: '2026-07-05', value: 45678 },
  { date: '2026-07-06', value: 56789 },
  { date: '2026-07-07', value: 67890 },
  { date: '2026-07-08', value: 89234 },
];

export const mockPlatformBreakdown = [
  { platform: 'amazon' as const, deals: 4567, clicks: 234567, conversions: 12345, revenue: 1890456 },
  { platform: 'flipkart' as const, deals: 3456, clicks: 189012, conversions: 8901, revenue: 1234567 },
  { platform: 'myntra' as const, deals: 1234, clicks: 78901, conversions: 3456, revenue: 456789 },
  { platform: 'croma' as const, deals: 890, clicks: 45678, conversions: 2345, revenue: 345678 },
  { platform: 'nykaa' as const, deals: 678, clicks: 34567, conversions: 1890, revenue: 234567 },
  { platform: 'meesho' as const, deals: 567, clicks: 23456, conversions: 1234, revenue: 178901 },
];

export const mockCategoryBreakdown = [
  { category: 'Smartphones', deals: 2345, revenue: 1234567, percentage: 28 },
  { category: 'Laptops', deals: 1234, revenue: 890123, percentage: 20 },
  { category: 'Audio', deals: 890, revenue: 456789, percentage: 10 },
  { category: 'Fashion', deals: 1567, revenue: 567890, percentage: 13 },
  { category: 'Home Appliances', deals: 789, revenue: 345678, percentage: 8 },
  { category: 'TVs', deals: 567, revenue: 289012, percentage: 7 },
  { category: 'Baby Products', deals: 456, revenue: 234567, percentage: 5 },
  { category: 'Others', deals: 1608, revenue: 549264, percentage: 9 },
];

export const mockNotifications: Notification[] = [
  { id: '1', type: 'flash_sale', title: 'Amazon Flash Sale Started', message: 'Amazon Prime Flash Sale is now live with 500+ deals', isRead: false, createdAt: '2026-07-08T13:00:00Z' },
  { id: '2', type: 'price_drop', title: 'Massive Price Drop Detected', message: 'Samsung Galaxy S25 Ultra dropped to ₹61,999 — Lowest Ever!', isRead: false, createdAt: '2026-07-08T12:45:00Z' },
  { id: '3', type: 'system', title: 'Scraper Alert: Croma Failed', message: 'Croma scraper failed with 5 errors. Retrying in 15 minutes.', isRead: false, createdAt: '2026-07-08T12:30:00Z' },
  { id: '4', type: 'deal_ending', title: 'Deal Expiring Soon', message: '23 deals are expiring in the next 2 hours', isRead: true, createdAt: '2026-07-08T12:00:00Z' },
  { id: '5', type: 'stock', title: 'Low Stock Alert', message: 'Sony WH-1000XM6 has only 12 units left at deal price', isRead: true, createdAt: '2026-07-08T11:30:00Z' },
];

export function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatNumber(num: number): string {
  if (num >= 10000000) {
    return `${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `${(num / 100000).toFixed(1)}L`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString('en-IN');
}

export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function getDealScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Average';
  return 'Poor';
}

export function getDealScoreClass(score: number): string {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'average';
  return 'poor';
}

export function getTimeSince(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
