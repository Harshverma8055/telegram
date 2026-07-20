'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  TrendingDown, 
  TrendingUp, 
  Loader2, 
  ExternalLink, 
  Bell,
  Search,
  CheckCircle2,
  AlertCircle,
  Target,
  Edit2,
  Save,
  ShoppingBag,
  X
} from 'lucide-react';
import Image from 'next/image';
import { formatCurrency } from '@/lib/mock-data';

export default function WatchlistView() {
  const [url, setUrl] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Target price editing state
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState<string>('');
  const [updatingTarget, setUpdatingTarget] = useState(false);

  const handlePrepopulate = async () => {
    try {
      setSeeding(true);
      setMessage(null);
      const res = await fetch('/api/watchlist', {
        method: 'PUT'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Successfully imported ${data.count} high-commission student products into your Watchlist!` });
        fetchProducts();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to populate watchlist' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error occurred while contacting server' });
    } finally {
      setSeeding(false);
    }
  };

  // Fetch watchlist products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/watchlist');
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      setAdding(true);
      setMessage(null);
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: `Successfully watchlisted: "${data.product.title.substring(0, 30)}..."` });
        setUrl('');
        fetchProducts();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to add product to watchlist' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error occurred while contacting server' });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to stop tracking this product?')) return;

    try {
      const res = await fetch(`/api/watchlist?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateTarget = async (id: string) => {
    try {
      setUpdatingTarget(true);
      const res = await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, targetPrice: targetInput })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(products.map(p => p.id === id ? { ...p, targetPrice: data.product.targetPrice } : p));
        setEditingTargetId(null);
        setMessage({ type: 'success', text: 'Target price updated successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update target' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: 'An error occurred while saving target price' });
    } finally {
      setUpdatingTarget(false);
    }
  };

  // Renders a premium mini-trend sparkline using SVG
  const renderTrendSparkline = (history: any[]) => {
    if (!history || history.length < 2) {
      return (
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Stable (No history)</span>
      );
    }

    const prices = history.map(h => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    // SVG parameters
    const width = 120;
    const height = 30;
    const points = prices.map((price, i) => {
      const x = (i / (prices.length - 1)) * (width - 10) + 5;
      const y = height - ((price - min) / range) * (height - 10) - 5;
      return `${x},${y}`;
    }).join(' ');

    const lastPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const isDropping = lastPrice < prevPrice;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          <polyline
            fill="none"
            stroke={isDropping ? '#10B981' : '#EF4444'}
            strokeWidth="2"
            points={points}
          />
          {/* Highlight latest price point */}
          <circle
            cx={(prices.length - 1) / (prices.length - 1) * (width - 10) + 5}
            cy={height - ((lastPrice - min) / range) * (height - 10) - 5}
            r="3"
            fill={isDropping ? '#10B981' : '#EF4444'}
          />
        </svg>
        <span style={{ 
          fontSize: '12px', 
          fontWeight: 600,
          color: isDropping ? 'var(--emerald-light)' : 'var(--accent-red-light)',
          display: 'flex',
          alignItems: 'center',
          gap: '2px'
        }}>
          {isDropping ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
          {isDropping ? '-' : '+'}
          {Math.abs(Math.round(((lastPrice - prevPrice) / prevPrice) * 100))}%
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Search / Add Bar */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Track New Product Price Drop
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Paste any Amazon, Flipkart, Myntra, or Ajio product URL. The bot will automatically check its price every hour and publish a Telegram deal the moment it drops.
        </p>

        <form onSubmit={handleAddProduct} style={{ display: 'flex', gap: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Paste Amazon, Flipkart, Myntra, or Ajio product URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-input"
              style={{
                width: '100%',
                padding: '14px 16px 14px 44px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-primary)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
              disabled={adding}
            />
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          <button 
            type="submit" 
            className="btn-primary" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '14px 24px',
              borderRadius: '12px',
              fontWeight: 600,
              background: 'var(--gradient-primary)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-glow)'
            }}
            disabled={adding}
          >
            {adding ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Plus size={18} />
                Add Watchlist
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '12px' }}>
          <button
            type="button"
            onClick={handlePrepopulate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            disabled={seeding || adding}
          >
            {seeding ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Seeding Essentials...
              </>
            ) : (
              <>
                🎒 Pre-populate 90+ Student & Hostel Essentials (High Commission)
              </>
            )}
          </button>
        </div>

        {message && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${message.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: message.type === 'success' ? 'var(--emerald-light)' : 'var(--accent-red-light)'
          }}>
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Watchlist Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Currently Tracking ({products.length} Products)
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Bell size={14} /> Checking hourly
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <Loader2 size={36} className="animate-spin" color="var(--accent-primary-light)" />
          </div>
        ) : products.length === 0 ? (
          <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <TrendingDown size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Your Watchlist is Empty</h4>
            <p style={{ fontSize: '14px' }}>Paste a product URL above to monitor its price and get alerts on Telegram.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {products.map((product) => {
              const discount = product.mrp && product.currentPrice && product.mrp > product.currentPrice
                ? Math.round(((product.mrp - product.currentPrice) / product.mrp) * 100)
                : 0;

              return (
                <div 
                  key={product.id} 
                  className="glass-card" 
                  style={{ 
                    padding: '16px 20px', 
                    display: 'grid', 
                    gridTemplateColumns: '80px 1.5fr 1fr 1.2fr 1.2fr 60px', 
                    alignItems: 'center', 
                    gap: '20px' 
                  }}
                >
                  {/* Image */}
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '10px', 
                    background: 'rgba(255, 255, 255, 0.04)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '1px solid var(--border-primary)',
                    position: 'relative',
                    padding: '4px'
                  }}>
                    {product.imageUrl ? (
                      <img 
                        src={product.imageUrl} 
                        alt={product.title}
                        referrerPolicy="no-referrer"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: 'white', borderRadius: '6px', padding: '2px' }} 
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.dataset.triedProxy) {
                            target.dataset.triedProxy = 'true';
                            target.src = `/api/proxy-image?url=${encodeURIComponent(product.imageUrl)}`;
                          } else {
                            target.style.display = 'none';
                            if (target.parentElement) {
                              target.parentElement.style.background = 'rgba(255, 255, 255, 0.04)';
                              target.parentElement.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);opacity:0.5;gap:4px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>';
                            }
                          }
                        }}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', opacity: 0.5, gap: '4px' }}>
                        <ShoppingBag size={24} />
                      </div>
                    )}
                  </div>

                  {/* Title & Platform */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                    <h4 style={{ 
                      fontSize: '15px', 
                      fontWeight: 600, 
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      margin: 0
                    }}>
                      {product.title}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`platform-tag ${product.platform.slug}`} style={{ fontSize: '11px', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        {product.platform.name}
                      </span>
                      <a 
                        href={product.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}
                      >
                        Source Link <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  {/* Price info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(product.currentPrice || 0)}
                      </span>
                      {discount > 0 && (
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          color: '#10B981', 
                          background: 'rgba(16,185,129,0.1)', 
                          padding: '1px 6px', 
                          borderRadius: '4px' 
                        }}>
                          {discount}% OFF
                        </span>
                      )}
                    </div>
                    {product.mrp && product.mrp > (product.currentPrice || 0) && (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        MRP {formatCurrency(product.mrp)}
                      </span>
                    )}
                  </div>

                  {/* Target Price */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {editingTargetId === product.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>₹</span>
                        <input 
                          type="number"
                          value={targetInput}
                          onChange={(e) => setTargetInput(e.target.value)}
                          placeholder="Amount"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '4px',
                            color: 'white',
                            padding: '4px 8px',
                            width: '80px',
                            fontSize: '14px'
                          }}
                          autoFocus
                          disabled={updatingTarget}
                        />
                        <button 
                          onClick={() => handleUpdateTarget(product.id)}
                          disabled={updatingTarget}
                          style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', padding: '4px' }}
                        >
                          <Save size={16} />
                        </button>
                        <button 
                          onClick={() => setEditingTargetId(null)}
                          disabled={updatingTarget}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          color: product.targetPrice ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontSize: '14px',
                          fontWeight: 600
                        }}>
                          <Target size={14} color={product.targetPrice ? '#F59E0B' : 'var(--text-muted)'} />
                          {product.targetPrice ? formatCurrency(product.targetPrice) : 'No Target'}
                        </div>
                        <button 
                          onClick={() => {
                            setTargetInput(product.targetPrice?.toString() || '');
                            setEditingTargetId(product.id);
                          }}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--accent-blue)', 
                            cursor: 'pointer', 
                            padding: '4px',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                          className="hover-opacity-1"
                          title="Edit Target Price"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {product.targetPrice ? 'Will alert if price drops below' : 'Alerts on 10% drop'}
                    </span>
                  </div>

                  {/* Trend Indicator (Sparkline) */}
                  <div>
                    {renderTrendSparkline(product.history)}
                  </div>

                  {/* Action */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleDeleteProduct(product.id)}
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: 'var(--accent-red-light)',
                        padding: '10px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      title="Stop Tracking"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
