'use client';
import React, { useEffect, useState } from 'react';
import { Trash2, Plus, ExternalLink, RefreshCw, Search, Filter, Package } from 'lucide-react';

const PLATFORM_COLORS: Record<string, string> = {
  flipkart: '#2874f0',
  myntra: '#ff3f6c',
  ajio: '#f26522',
  meesho: '#9c27b0',
  nykaa: '#fc2779',
};

const PLATFORM_LABELS: Record<string, string> = {
  flipkart: 'Flipkart',
  myntra: 'Myntra',
  ajio: 'Ajio',
  meesho: 'Meesho',
  nykaa: 'Nykaa',
};

export default function CuelinkWatchlistView() {
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any[]>([]);
  const [catStats, setCatStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Add product modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addPlatform, setAddPlatform] = useState('flipkart');
  const [addCategory, setAddCategory] = useState('');
  const [addSubcategory, setAddSubcategory] = useState('');
  const [addDiscount, setAddDiscount] = useState(20);
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  const load = async (p = page, platform = filterPlatform) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '40' });
      if (platform) params.set('platform', platform);
      const res = await fetch(`/api/cuelink-watchlist?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setStats(data.platformStats || []);
      setCatStats((data.categoryStats || []).slice(0, 8));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this product from Cuelink watchlist?')) return;
    await fetch(`/api/cuelink-watchlist?id=${id}`, { method: 'DELETE' });
    load();
  };

  const handleAdd = async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    setAddMsg('Fetching product details...');
    try {
      const res = await fetch('/api/cuelink-watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productUrl: addUrl.trim(),
          platform: addPlatform,
          category: addCategory || 'General',
          subcategory: addSubcategory || 'Other',
          targetDiscount: addDiscount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAddMsg(`✅ Added: "${data.product.title?.substring(0, 60)}"`);
        setAddUrl('');
        load();
        setTimeout(() => setShowAdd(false), 2000);
      } else {
        setAddMsg(`❌ ${data.error}`);
      }
    } catch (e: any) {
      setAddMsg(`❌ Error: ${e.message}`);
    } finally {
      setAdding(false);
    }
  };

  const filtered = products.filter(p =>
    !search || p.title?.toLowerCase().includes(search.toLowerCase()) || p.subcategory?.toLowerCase().includes(search.toLowerCase())
  );

  const totalProducts = stats.reduce((s: number, p: any) => s + p._count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-primary-light)' }}>{totalProducts}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Total Products</div>
        </div>
        {stats.map((s: any) => (
          <div key={s.platform} className="glass-card" style={{ padding: '20px', textAlign: 'center', borderTop: `3px solid ${PLATFORM_COLORS[s.platform] || '#666'}` }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{s._count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{PLATFORM_LABELS[s.platform] || s.platform}</div>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {catStats.length > 0 && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--text-primary)' }}>Categories Being Monitored</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {catStats.map((c: any) => (
              <span key={c.category} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary-light)',
                border: '1px solid rgba(99,102,241,0.2)',
              }}>
                {c.category} ({c._count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', borderRadius: 8 }}>
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: '100%' }} />
        </div>
        <select value={filterPlatform} onChange={e => { setFilterPlatform(e.target.value); load(1, e.target.value); }} style={{ padding: '8px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13 }}>
          <option value="">All Platforms</option>
          <option value="flipkart">Flipkart</option>
          <option value="myntra">Myntra</option>
          <option value="ajio">Ajio</option>
        </select>
        <button onClick={() => load()} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={() => { setShowAdd(true); setAddMsg(''); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--gradient-primary)', border: 'none', borderRadius: 8, color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          <Plus size={14} /> Add Product
        </button>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-card" style={{ padding: 32, width: '100%', maxWidth: 520, borderRadius: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add Flipkart / Myntra / Ajio Product</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Product URL *</label>
                <input value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://www.flipkart.com/..." style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-secondary)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Platform *</label>
                  <select value={addPlatform} onChange={e => setAddPlatform(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13 }}>
                    <option value="flipkart">Flipkart</option>
                    <option value="myntra">Myntra</option>
                    <option value="ajio">Ajio</option>
                    <option value="meesho">Meesho</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Target Discount %</label>
                  <input type="number" value={addDiscount} onChange={e => setAddDiscount(parseInt(e.target.value) || 20)} min={5} max={90} style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-secondary)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Category</label>
                  <input value={addCategory} onChange={e => setAddCategory(e.target.value)} placeholder="e.g. Electronics" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-secondary)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Subcategory</label>
                  <input value={addSubcategory} onChange={e => setAddSubcategory(e.target.value)} placeholder="e.g. Fans" style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-secondary)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>

            {addMsg && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: addMsg.includes('✅') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 8, fontSize: 13, color: addMsg.includes('✅') ? '#34d399' : '#f87171' }}>
                {addMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdd(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleAdd} disabled={adding || !addUrl.trim()} style={{ padding: '10px 24px', background: adding ? 'rgba(99,102,241,0.4)' : 'var(--gradient-primary)', border: 'none', borderRadius: 8, color: 'white', cursor: adding ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}>
                {adding ? 'Fetching...' : 'Add to Watchlist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Monitoring {total} products for price drops</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} of {pages}</div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Package size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div>No products found. Add some Flipkart/Myntra/Ajio products above.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Product</th>
                  <th>Platform</th>
                  <th>Price</th>
                  <th>Target</th>
                  <th>Discount</th>
                  <th>Category</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {p.image ? (
                          <img src={p.image} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, background: '#111' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Package size={18} color="var(--text-muted)" />
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13, lineHeight: 1.4 }}>{p.title?.substring(0, 70)}{p.title?.length > 70 ? '...' : ''}</div>
                          <a href={p.productUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <ExternalLink size={10} /> View on {PLATFORM_LABELS[p.platform] || p.platform}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${PLATFORM_COLORS[p.platform] || '#666'}22`, color: PLATFORM_COLORS[p.platform] || '#999', border: `1px solid ${PLATFORM_COLORS[p.platform] || '#666'}44` }}>
                        {PLATFORM_LABELS[p.platform] || p.platform}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>₹{p.price?.toLocaleString('en-IN')}</div>
                      {p.mrp > p.price && <div style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{p.mrp?.toLocaleString('en-IN')}</div>}
                    </td>
                    <td>
                      <div style={{ color: '#34d399', fontWeight: 600 }}>₹{p.targetPrice?.toLocaleString('en-IN') || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>at {p.targetDiscount}% off</div>
                    </td>
                    <td>
                      {p.discount > 0 ? (
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'rgba(16,185,129,0.1)', color: '#34d399' }}>
                          {p.discount}% OFF
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.subcategory || p.category}</td>
                    <td>
                      <button onClick={() => handleDelete(p.id)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: 'pointer', color: '#f87171' }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => { setPage(p => Math.max(1, p - 1)); load(Math.max(1, page - 1)); }} disabled={page === 1} className="btn-ghost">← Prev</button>
            <span style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{page} / {pages}</span>
            <button onClick={() => { setPage(p => Math.min(pages, p + 1)); load(Math.min(pages, page + 1)); }} disabled={page === pages} className="btn-ghost">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
