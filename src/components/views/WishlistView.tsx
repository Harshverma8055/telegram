'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Loader2, 
  ExternalLink, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Target, 
  Edit2, 
  Save, 
  X,
  Play,
  RotateCcw,
  Zap,
  ShoppingBag,
  Send,
  Eye,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import Image from 'next/image';
import { formatCurrency } from '@/lib/mock-data';

interface CategoryStat {
  name: string;
  target: number;
  current: number;
  progress: number;
}

interface WishlistStats {
  total: number;
  totalTarget: number;
  overallProgress: number;
  primeCount: number;
  choiceCount: number;
  bestSellerCount: number;
  couponCount: number;
  avgPrice: number;
  avgDiscount: number;
  avgRating: string;
  priceBands: Record<string, number>;
  categoryStats: CategoryStat[];
}

export default function WishlistView() {
  // Stats
  const [stats, setStats] = useState<WishlistStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Products Table
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('priority_score');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Crawler Controls
  const [crawling, setCrawling] = useState(false);
  const [crawlLimit, setCrawlLimit] = useState(5);
  const [crawlLog, setCrawlLog] = useState<string[]>([]);
  const [crawlTargetCategory, setCrawlTargetCategory] = useState('');
  const [crawlTargetQuery, setCrawlTargetQuery] = useState('');

  // Editing state
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Telegram publish state
  const [publishingProduct, setPublishingProduct] = useState<any | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedSuccess, setPublishedSuccess] = useState<string | null>(null);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial data
  useEffect(() => {
    fetchStats();
    fetchProducts();
  }, [selectedCategory, selectedSubcategory, minPrice, maxPrice, sortBy, sortOrder, page]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [crawlLog]);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await fetch('/api/wishlist/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      const queryParams = new URLSearchParams({
        search,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        minPrice,
        maxPrice,
        sortBy,
        sortOrder,
        page: page.toString(),
        limit: '2000'
      });
      const res = await fetch(`/api/wishlist/products?${queryParams}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
        setTotalPages(data.pagination.pages);
        setTotalProducts(data.pagination.total);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  // Run self-guided crawler chunk
  const triggerCrawler = async (isManual = false) => {
    try {
      setCrawling(true);
      setCrawlLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🚀 Launching Research Crawler Job...`]);
      
      const queryParams = new URLSearchParams({
        limit: crawlLimit.toString()
      });

      if (isManual && crawlTargetCategory && crawlTargetQuery) {
        queryParams.append('category', crawlTargetCategory);
        queryParams.append('query', crawlTargetQuery);
        setCrawlLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Target: Category="${crawlTargetCategory}", Query="${crawlTargetQuery}"`]);
      } else {
        setCrawlLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Auto mode: Finding under-filled wishlist category...`]);
      }

      const res = await fetch(`/api/wishlist/research?${queryParams}`);
      const data = await res.json();

      if (data.success) {
        const timestamp = new Date().toLocaleTimeString();
        setCrawlLog(prev => [
          ...prev,
          `[${timestamp}] ✅ Run Complete! Category checked: "${data.category || 'N/A'}"`,
          `[${timestamp}] 🔎 Scanned ${data.scanned} links. Added ${data.added} new products.`
        ]);

        if (data.addedProducts && data.addedProducts.length > 0) {
          data.addedProducts.forEach((p: any) => {
            setCrawlLog(prev => [
              ...prev,
              `✨ [ADDED] ${p.title.substring(0, 45)}... (ASIN: ${p.asin}, Price: ₹${p.price}, Score: ${p.scores.priorityScore})`
            ]);
          });
        }

        if (data.skippedReasons && Object.keys(data.skippedReasons).length > 0) {
          Object.entries(data.skippedReasons).slice(0, 5).forEach(([asin, reason]: any) => {
            setCrawlLog(prev => [...prev, `ℹ️ [SKIPPED] ${asin}: ${reason}`]);
          });
        }

        setNotification({ type: 'success', text: `Crawler successfully found & added ${data.added} products for "${data.category}"!` });
        fetchStats();
        fetchProducts();
      } else {
        setCrawlLog(prev => [...prev, `❌ Crawler Error: ${data.error || 'Unknown issue occurred'}`]);
        setNotification({ type: 'error', text: data.error || 'Crawler execution failed' });
      }
    } catch (err: any) {
      setCrawlLog(prev => [...prev, `❌ Connection error: ${err.message}`]);
      setNotification({ type: 'error', text: 'Error contacting crawler endpoint' });
    } finally {
      setCrawling(false);
    }
  };

  const handleClearLog = () => setCrawlLog([]);

  // Save edited product
  const saveProductEdits = async () => {
    if (!editingProduct) return;
    try {
      setSavingEdit(true);
      const res = await fetch('/api/wishlist/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct)
      });
      const data = await res.json();
      if (data.success) {
        setProducts(products.map(p => p.id === editingProduct.id ? data.product : p));
        setEditingProduct(null);
        setNotification({ type: 'success', text: 'Product updated successfully!' });
        fetchStats();
      } else {
        setNotification({ type: 'error', text: data.error || 'Failed to update product' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Error saving changes' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product from the research catalog?')) return;
    try {
      const res = await fetch(`/api/wishlist/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', text: 'Product removed from research database.' });
        fetchStats();
        fetchProducts();
      } else {
        setNotification({ type: 'error', text: data.error || 'Failed to delete' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Error deleting product' });
    }
  };

  // Publish to Telegram
  const handlePublish = async (id: string) => {
    try {
      setPublishing(true);
      setPublishedSuccess(null);
      const res = await fetch('/api/wishlist/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        setPublishedSuccess(data.message);
        setNotification({ type: 'success', text: 'Deal published successfully!' });
        fetchStats();
        fetchProducts();
        setTimeout(() => {
          setPublishingProduct(null);
          setPublishedSuccess(null);
        }, 4000);
      } else {
        setNotification({ type: 'error', text: data.error || 'Failed to publish to Telegram' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Error publishing deal' });
    } finally {
      setPublishing(false);
    }
  };

  // Color mapper for Priority Score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--accent-emerald)';
    if (score >= 60) return '#10B981';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative' }}>
      
      {/* 1. TOP METRICS ROW */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '24px',
      }}>
        {/* Total Products Researched */}
        <div className="glass-card metric-card purple" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShoppingBag size={18} color="var(--accent-primary-light)" />
            </div>
            <div className="status-badge active" style={{ fontSize: '11px' }}>
              Target {stats?.totalTarget || 780}
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Researched Wishlist</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {stats?.total || 0}
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              ({stats?.overallProgress || 0}% Complete)
            </span>
          </div>
          <div className="progress-bar" style={{ marginTop: '12px', height: '4px' }}>
            <div 
              className="progress-bar-fill" 
              style={{ width: `${stats?.overallProgress || 0}%`, background: 'var(--gradient-primary)' }} 
            />
          </div>
        </div>

        {/* Avg Discount */}
        <div className="glass-card metric-card emerald" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Zap size={18} color="var(--accent-emerald)" />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Avg. Discount</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {stats?.avgDiscount || 0}% OFF
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Across all categories
          </div>
        </div>

        {/* Badged Products */}
        <div className="glass-card metric-card cyan" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Sparkles size={18} color="#22d3ee" />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Special Badges</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', marginTop: '6px' }}>
            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
              📦 Prime: {stats?.primeCount || 0}
            </span>
            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
              🎖️ Choice: {stats?.choiceCount || 0}
            </span>
            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
              🏆 Best: {stats?.bestSellerCount || 0}
            </span>
          </div>
        </div>

        {/* Average Rating */}
        <div className="glass-card metric-card amber" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Target size={18} color="#fbbf24" />
            </div>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Average Rating</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)' }}>
            ⭐ {stats?.avgRating || '0.0'} / 5
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Coupons Active: {stats?.couponCount || 0}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div 
          onClick={() => setNotification(null)}
          style={{
            padding: '12px 20px',
            borderRadius: '10px',
            background: notification.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${notification.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-red-light)'}`,
            color: notification.type === 'success' ? 'var(--emerald-light)' : 'var(--accent-red-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontSize: '14px',
            animation: 'fadeIn 0.3s ease'
          }}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.text}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.5 }}>✕</span>
        </div>
      )}

      {/* 2. BODY LAYOUT: LEFT SIDE PANEL & RIGHT SIDE GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: '32px',
        alignItems: 'start'
      }}>
        {/* LEFT COLUMN: Categories Progress & Crawler Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Category List Progress */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
              Category Targets
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {stats?.categoryStats?.map((cat) => (
                <div 
                  key={cat.name} 
                  onClick={() => setSelectedCategory(selectedCategory === cat.name ? '' : cat.name)}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '8px', 
                    borderRadius: '8px',
                    background: selectedCategory === cat.name ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: `1px solid ${selectedCategory === cat.name ? 'var(--border-primary)' : 'transparent'}`,
                    transition: 'all 0.2s'
                  }}
                  className="category-row"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                    <span style={{ 
                      fontWeight: selectedCategory === cat.name ? 600 : 500, 
                      color: selectedCategory === cat.name ? 'var(--accent-primary-light)' : 'var(--text-secondary)'
                    }}>
                      {cat.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {cat.current} / {cat.target}
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: '4px' }}>
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        width: `${cat.progress}%`, 
                        background: cat.progress >= 100 ? 'var(--accent-emerald)' : 'var(--accent-primary)' 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Research Crawler Dashboard */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="var(--accent-primary-light)" />
              Research Crawler
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Limit */}
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Target added per run:
                </label>
                <select 
                  value={crawlLimit} 
                  onChange={(e) => setCrawlLimit(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    color: 'white',
                    padding: '8px',
                    fontSize: '13px'
                  }}
                >
                  <option value={2}>2 Products (Fast/Safe)</option>
                  <option value={5}>5 Products (Normal)</option>
                  <option value={10}>10 Products (Slow)</option>
                  <option value={20}>20 Products (Bulk)</option>
                </select>
              </div>

              {/* Autopilot Button */}
              <button
                onClick={() => triggerCrawler(false)}
                disabled={crawling}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-glow)'
                }}
              >
                {crawling ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Crawling...
                  </>
                ) : (
                  <>
                    <Play size={16} /> Run Autopilot Crawler
                  </>
                )}
              </button>

              <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 2, margin: '8px 0' }} />

              {/* Targeted Manual Search */}
              <h5 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Targeted Search</h5>
              <div>
                <select
                  value={crawlTargetCategory}
                  onChange={(e) => setCrawlTargetCategory(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    color: 'white',
                    padding: '8px',
                    fontSize: '13px',
                    marginBottom: '8px'
                  }}
                >
                  <option value="">-- Choose Category --</option>
                  {stats?.categoryStats.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="e.g. bluetooth neckband"
                  value={crawlTargetQuery}
                  onChange={(e) => setCrawlTargetQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    color: 'white',
                    padding: '8px',
                    fontSize: '13px',
                    marginBottom: '8px'
                  }}
                />
                <button
                  onClick={() => triggerCrawler(true)}
                  disabled={crawling || !crawlTargetCategory || !crawlTargetQuery}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'rgba(255,255,255,0.06)',
                    color: 'white',
                    border: '1px solid var(--border-primary)',
                    cursor: 'pointer'
                  }}
                >
                  Fetch Category Term
                </button>
              </div>
            </div>
          </div>

          {/* Live Scraper Log */}
          {crawlLog.length > 0 && (
            <div className="glass-card" style={{ padding: '16px', background: 'black', border: '1px solid #333' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: '#10B981', fontFamily: 'monospace', fontWeight: 'bold' }}>CRAWLER_LOGS</span>
                <button onClick={handleClearLog} style={{ background: 'none', border: 'none', color: '#666', fontSize: '11px', cursor: 'pointer' }}>
                  Clear
                </button>
              </div>
              <div style={{
                height: '180px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#aaa',
                lineHeight: '1.4',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {crawlLog.map((log, idx) => (
                  <div key={idx} style={{ 
                    color: log.includes('✅') || log.includes('ADDED') ? '#10B981' : log.includes('❌') ? '#EF4444' : '#aaa',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {log}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Researched Products Grid / Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filter Toolbar */}
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search Title, Brand, ASIN..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '8px 12px 8px 36px',
                  fontSize: '13px'
                }}
              />
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            </div>

            {/* Price Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                placeholder="₹ Min"
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                style={{ width: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '13px' }}
              />
              <span style={{ color: 'var(--text-muted)' }}>-</span>
              <input
                type="number"
                placeholder="₹ Max"
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                style={{ width: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', padding: '8px', fontSize: '13px' }}
              />
            </div>

            {/* Sorting */}
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', padding: '8px 12px', fontSize: '13px' }}
            >
              <option value="priority_score">Sort by Priority Score</option>
              <option value="student_score">Sort by Student Score</option>
              <option value="price">Sort by Price</option>
              <option value="discount">Sort by Discount %</option>
              <option value="rating">Sort by Rating</option>
              <option value="review_count">Sort by Reviews</option>
              <option value="last_updated">Sort by Newly Found</option>
            </select>

            <button 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                color: 'white',
                padding: '8px 12px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {sortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
            </button>

            {/* Clear Filters */}
            {(selectedCategory || search || minPrice || maxPrice || sortBy !== 'priority_score') && (
              <button
                onClick={() => {
                  setSelectedCategory('');
                  setSearch('');
                  setMinPrice('');
                  setMaxPrice('');
                  setSortBy('priority_score');
                  setSortOrder('desc');
                  setPage(1);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary-light)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RotateCcw size={12} /> Clear Filters
              </button>
            )}
          </div>

          {/* Products List Grid */}
          {productsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
              <Loader2 size={36} className="animate-spin" color="var(--accent-primary-light)" />
            </div>
          ) : products.length === 0 ? (
            <div className="glass-card" style={{ padding: '80px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <ShoppingBag size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <h4>No Researched Products Found</h4>
              <p style={{ fontSize: '14px', marginTop: '6px' }}>Try running the crawler or clearing filters to populate the wishlist.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
              {(Object.entries(products.reduce((acc, product) => {
                const cat = product.category || 'Uncategorized';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(product);
                return acc;
              }, {} as Record<string, any[]>)) as [string, any[]][]).map(([category, items]) => (
                <div key={category}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {category}
                    <span style={{ fontSize: '13px', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary-light)', padding: '2px 8px', borderRadius: '12px' }}>{items.length} Products</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {items.map((product) => (
                      <div 
                        key={product.id}
                  className="glass-card"
                  style={{
                    padding: '20px',
                    display: 'grid',
                    gridTemplateColumns: '100px 1.5fr 1fr 120px',
                    alignItems: 'center',
                    gap: '24px',
                    transition: 'transform 0.2s',
                    position: 'relative'
                  }}
                >
                  {/* Image */}
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '8px',
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '1px solid var(--border-primary)',
                    position: 'relative'
                  }}>
                    {product.image ? (
                      <Image 
                        src={product.image}
                        alt={product.title}
                        fill
                        style={{ objectFit: 'contain', padding: '6px' }}
                      />
                    ) : (
                      <ShoppingBag size={32} color="var(--text-muted)" style={{ opacity: 0.2 }} />
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                    <h4 style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      lineHeight: '1.3',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      margin: 0
                    }} title={product.title}>
                      {product.title}
                    </h4>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ASIN: {product.asin}
                      </span>
                      {product.brand && (
                        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          {product.brand}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', background: 'rgba(99,102,241,0.06)', padding: '1px 6px', borderRadius: '4px', color: 'var(--accent-primary-light)' }}>
                        {product.category}
                      </span>
                      <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                        {product.subcategory}
                      </span>
                    </div>

                    {/* Price, MRP, Discount */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(product.price)}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        ₹{product.mrp.toLocaleString('en-IN')}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                        ({Math.round(product.discount)}% OFF)
                      </span>
                    </div>

                    {/* Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 1 }}>
                      {product.prime && <span style={{ fontSize: '10px', background: 'rgba(6,182,212,0.1)', color: '#22d3ee', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>🚚 Prime</span>}
                      {product.coupon && <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.1)', color: '#fbbf24', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>🎟️ Coupon</span>}
                      {product.best_seller && <span style={{ fontSize: '10px', background: 'rgba(16,185,129,0.1)', color: '#34d399', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>🏆 Best Seller</span>}
                      {product.amazon_choice && <span style={{ fontSize: '10px', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary-light)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>🎖️ Choice</span>}
                      {product.deal_type === 'lightning' && <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>⚡ Lightning Deal</span>}
                    </div>
                  </div>

                  {/* Scores breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Priority Score circular tag */}
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        border: `2px solid ${getScoreColor(product.priority_score)}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                        color: getScoreColor(product.priority_score)
                      }} title="Priority Score">
                        {Math.round(product.priority_score)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Priority Score</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Overall Rank</span>
                      </div>
                    </div>

                    {/* Micro score breakdown values */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '4px 8px',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border-primary)',
                      paddingTop: '6px'
                    }}>
                      <div>🎒 Stud: <span style={{ color: 'white', fontWeight: 500 }}>{Math.round(product.student_score)}</span></div>
                      <div>🏠 Host: <span style={{ color: 'white', fontWeight: 500 }}>{Math.round(product.hostel_score)}</span></div>
                      <div>🕶️ Fash: <span style={{ color: 'white', fontWeight: 500 }}>{Math.round(product.fashion_score)}</span></div>
                      <div>🎁 Gift: <span style={{ color: 'white', fontWeight: 500 }}>{Math.round(product.gift_score)}</span></div>
                      <div>⚡ Imp: <span style={{ color: 'white', fontWeight: 500 }}>{Math.round(product.buy_score)}</span></div>
                      <div>💵 Aff: <span style={{ color: 'white', fontWeight: 500 }}>{Math.round(product.affiliate_score)}</span></div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                    <button
                      onClick={() => setPublishingProduct(product)}
                      className="btn-primary"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: 'var(--gradient-primary)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Send size={13} /> Publish
                    </button>
                    
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => setEditingProduct(product)}
                        style={{
                          flex: 1,
                          padding: '6px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Edit Details"
                      >
                        <Edit2 size={12} />
                      </button>
                      <a
                        href={product.amazon_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '6px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: '8px',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Open Source Link"
                      >
                        <ExternalLink size={12} />
                      </a>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        style={{
                          padding: '6px',
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.15)',
                          borderRadius: '8px',
                          color: 'var(--accent-red-light)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Delete Product"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. POPUP MODAL: EDIT PRODUCT DETAILS */}
      {editingProduct && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s'
        }}>
          <div className="glass-card" style={{
            width: '500px',
            padding: '24px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Edit Product Metadata</h3>
              <button onClick={() => setEditingProduct(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Title</label>
              <textarea 
                value={editingProduct.title}
                onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                rows={2}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '8px 12px',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Deal Price (₹)</label>
                <input 
                  type="number"
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    color: 'white',
                    padding: '8px 12px',
                    fontSize: '13px'
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>MRP (₹)</label>
                <input 
                  type="number"
                  value={editingProduct.mrp}
                  onChange={(e) => setEditingProduct({ ...editingProduct, mrp: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    color: 'white',
                    padding: '8px 12px',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-primary)', margin: '4px 0' }} />
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tune Target & Intent Scores (0–100)</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>🎒 Student Score</label>
                <input type="number" min={0} max={100} value={editingProduct.student_score} onChange={(e) => setEditingProduct({ ...editingProduct, student_score: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', padding: '6px 10px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>🏠 Hostel Score</label>
                <input type="number" min={0} max={100} value={editingProduct.hostel_score} onChange={(e) => setEditingProduct({ ...editingProduct, hostel_score: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', padding: '6px 10px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>🕶️ Fashion Score</label>
                <input type="number" min={0} max={100} value={editingProduct.fashion_score} onChange={(e) => setEditingProduct({ ...editingProduct, fashion_score: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', padding: '6px 10px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>🎁 Gift Score</label>
                <input type="number" min={0} max={100} value={editingProduct.gift_score} onChange={(e) => setEditingProduct({ ...editingProduct, gift_score: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', padding: '6px 10px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>⚡ Impulse Buy Score</label>
                <input type="number" min={0} max={100} value={editingProduct.buy_score} onChange={(e) => setEditingProduct({ ...editingProduct, buy_score: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', padding: '6px 10px', fontSize: '12px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}> Overall Priority</label>
                <input type="number" min={0} max={100} value={editingProduct.priority_score} onChange={(e) => setEditingProduct({ ...editingProduct, priority_score: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', padding: '6px 10px', fontSize: '12px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button 
                onClick={() => setEditingProduct(null)} 
                disabled={savingEdit}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'none',
                  border: '1px solid var(--border-primary)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={saveProductEdits} 
                disabled={savingEdit}
                className="btn-primary"
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: 'var(--gradient-primary)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {savingEdit ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. POPUP MODAL: CONFIRM TELEGRAM PUBLISHING */}
      {publishingProduct && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fadeIn 0.2s'
        }}>
          <div className="glass-card" style={{
            width: '500px',
            padding: '24px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={18} color="var(--accent-primary-light)" /> Publish to Telegram
              </h3>
              <button onClick={() => setPublishingProduct(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {publishedSuccess ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '20px 0', textAlign: 'center' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: 'rgba(16,185,129,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px'
                }}>
                  <CheckCircle2 size={30} color="var(--accent-emerald)" />
                </div>
                <h4 style={{ color: 'white', fontWeight: 600 }}>Message Posted Successfully!</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{publishedSuccess}</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '8px',
                    background: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    {publishingProduct.image && (
                      <Image src={publishingProduct.image} alt="preview" fill style={{ objectFit: 'contain', padding: '4px' }} />
                    )}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '360px' }}>
                      {publishingProduct.title}
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      ASIN: {publishingProduct.asin} • Category: {publishingProduct.category}
                    </span>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary-light)', marginBottom: '8px' }}>TELEGRAM PREVIEW TEXT:</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}>
                    {`🔥 Spot Deal! 🔥\n\n*${publishingProduct.title.substring(0, 70)}...*\n\n❌ MRP: ₹${publishingProduct.mrp.toLocaleString('en-IN')}\n✅ Deal Price: ₹${publishingProduct.price.toLocaleString('en-IN')} (${Math.round(publishingProduct.discount)}% OFF)\n\n${publishingProduct.prime ? '🚚 Prime Eligible\n' : ''}${publishingProduct.coupon ? '🎟️ Coupon Available\n' : ''}👇 Buy on Amazon (Button Link)`}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setPublishingProduct(null)} 
                    disabled={publishing}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      background: 'none',
                      border: '1px solid var(--border-primary)',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handlePublish(publishingProduct.id)} 
                    disabled={publishing}
                    className="btn-primary"
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      background: 'var(--gradient-primary)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {publishing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Publishing...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Send to Telegram
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
