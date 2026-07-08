// ==========================================
// DealFlow AI — Type Definitions
// ==========================================

export interface Deal {
  id: string;
  title: string;
  platform: Platform;
  category: string;
  brand: string;
  originalPrice: number;
  dealPrice: number;
  discount: number;
  dealScore: number;
  dealType: DealType;
  couponCode?: string;
  bankOffer?: string;
  cashback?: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  isGenuine: boolean;
  expiresAt: string;
  publishedAt?: string;
  isPublished: boolean;
  affiliateUrl?: string;
  clicks: number;
  conversions: number;
  revenue: number;
}

export type Platform =
  | 'amazon'
  | 'flipkart'
  | 'myntra'
  | 'ajio'
  | 'meesho'
  | 'nykaa'
  | 'croma'
  | 'reliance_digital'
  | 'tata_cliq'
  | 'jiomart'
  | 'snapdeal'
  | 'firstcry'
  | 'boat'
  | 'samsung'
  | 'apple'
  | 'oneplus'
  | 'mi'
  | 'lenovo'
  | 'hp'
  | 'dell'
  | 'asus'
  | 'nike'
  | 'adidas'
  | 'puma';

export type DealType =
  | 'flash_sale'
  | 'lightning_deal'
  | 'price_drop'
  | 'coupon'
  | 'bank_offer'
  | 'cashback'
  | 'exchange'
  | 'combo'
  | 'clearance'
  | 'festival'
  | 'emi'
  | 'open_box'
  | 'warehouse';

export interface ScraperStatus {
  id: string;
  platform: Platform;
  status: 'running' | 'completed' | 'failed' | 'idle' | 'queued';
  productsScanned: number;
  dealsFound: number;
  lastRunAt: string;
  nextRunAt: string;
  duration: number; // seconds
  errors: number;
}

export interface AnalyticsData {
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  avgDealScore: number;
  dealsPublished: number;
  activeDeals: number;
  platformBreakdown: PlatformStats[];
  revenueTimeline: TimelinePoint[];
  clicksTimeline: TimelinePoint[];
  categoryBreakdown: CategoryStats[];
  topDeals: Deal[];
}

export interface PlatformStats {
  platform: Platform;
  deals: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface CategoryStats {
  category: string;
  deals: number;
  revenue: number;
  percentage: number;
}

export interface TimelinePoint {
  date: string;
  value: number;
}

export interface TelegramChannel {
  id: string;
  name: string;
  username: string;
  members: number;
  postsToday: number;
  isActive: boolean;
  autoPublish: boolean;
  categories: string[];
}

export interface Notification {
  id: string;
  type: 'price_drop' | 'deal_ending' | 'stock' | 'flash_sale' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  revenueChange: number;
  totalClicks: number;
  clicksChange: number;
  totalDeals: number;
  dealsChange: number;
  conversionRate: number;
  conversionChange: number;
  activeScrapers: number;
  telegramPosts: number;
  avgDealScore: number;
  topPlatform: string;
}
