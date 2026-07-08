'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, MoreVertical, Check, X, ExternalLink, Zap, Loader2 } from 'lucide-react';
import { getDealScoreClass, formatCurrency } from '@/lib/mock-data';

export default function DealsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const res = await fetch('/api/deals');
        const data = await res.json();
        if (data.deals) {
          setDeals(data.deals);
        }
      } catch (error) {
        console.error('Failed to fetch deals:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, []);

  const filteredDeals = deals.filter(deal => 
    deal.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    deal.platform.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', borderRadius: '10px', minWidth: '300px'
          }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search deals by product, brand or platform..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{ border: 'none', background: 'transparent', padding: 0 }}
            />
          </div>
          <button className="btn-secondary">
            <Filter size={16} /> Filters
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flex: 1, marginLeft: '16px' }}>
          <input id="manual-title" type="text" placeholder="Product Title..." style={{ flex: 1, padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', borderRadius: '10px', color: 'white' }} />
          <input id="manual-price" type="number" placeholder="Price (₹)..." style={{ width: '120px', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', borderRadius: '10px', color: 'white' }} />
          <input id="manual-link" type="text" placeholder="Amazon Link..." style={{ flex: 1, padding: '8px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', borderRadius: '10px', color: 'white' }} />
          
          <button 
            className="btn-primary"
            style={{ whiteSpace: 'nowrap' }}
            onClick={async () => {
              const title = (document.getElementById('manual-title') as HTMLInputElement).value;
              const price = (document.getElementById('manual-price') as HTMLInputElement).value;
              const link = (document.getElementById('manual-link') as HTMLInputElement).value;
              
              if (!title || !price || !link) return alert('Fill all fields!');
              setLoading(true);
              try {
                await fetch('/api/deals/manual', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title, price: Number(price), link })
                });
                
                (document.getElementById('manual-title') as HTMLInputElement).value = '';
                (document.getElementById('manual-price') as HTMLInputElement).value = '';
                (document.getElementById('manual-link') as HTMLInputElement).value = '';
                
                const res = await fetch('/api/deals');
                const data = await res.json();
                if (data.deals) setDeals(data.deals);
              } catch(e) {
                console.error(e);
              } finally {
                setLoading(false);
              }
            }}
          >
            <Zap size={16} /> Create Real Deal
          </button>
          
          {/* Restored Auto Deal Engine Button */}
          <button 
            className="btn-primary" 
            style={{ whiteSpace: 'nowrap', background: 'var(--accent-primary-light)' }}
            onClick={async () => {
              setLoading(true);
              try {
                await fetch('/api/cron');
                const res = await fetch('/api/deals');
                const data = await res.json();
                if (data.deals) setDeals(data.deals);
              } catch (e) {
                console.error(e);
              } finally {
                setLoading(false);
              }
            }}
          >
            <Zap size={16} /> Auto Scrape TG
          </button>
        </div>
      </div>

      {/* Deals Table */}
      <div className="chart-container" style={{ padding: 0, overflow: 'hidden', minHeight: '400px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', flexDirection: 'column', gap: '12px' }}>
            <Loader2 size={32} color="var(--accent-primary)" className="animate-spin" />
            <div style={{ color: 'var(--text-muted)' }}>Loading live data from SQLite...</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Details</th>
                  <th>Score</th>
                  <th>Price / Discount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => (
                  <tr key={deal.id}>
                    <td style={{ maxWidth: '350px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px', lineHeight: '1.4' }}>
                        {deal.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--accent-primary-light)', textTransform: 'capitalize' }}>{deal.platform}</span>
                        {deal.brand && <span>•</span>}
                        {deal.brand && <span>{deal.brand}</span>}
                        {deal.category && <span>•</span>}
                        {deal.category && <span>{deal.category}</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {deal.dealType?.replace('_', ' ')}
                      </div>
                      {(deal.couponCode || deal.bankOffer) && (
                        <div style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>
                          {deal.couponCode || 'Bank Offer'}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={`deal-score ${getDealScoreClass(deal.dealScore)}`} style={{ transform: 'scale(0.8)', transformOrigin: 'left center' }}>
                        {deal.dealScore}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{deal.dealPrice?.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {deal.originalPrice && (
                           <span style={{ textDecoration: 'line-through' }}>₹{deal.originalPrice.toLocaleString('en-IN')}</span>
                        )}
                        <span style={{ color: 'var(--accent-emerald)', marginLeft: '6px', fontWeight: 600 }}>{deal.discount}% OFF</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!deal.isPublished && (
                          <button 
                            className="btn-ghost" 
                            style={{ padding: '6px', color: 'var(--accent-emerald)' }} 
                            title="Approve & Publish to Telegram"
                            onClick={async () => {
                              try {
                                // Default to a simulated channel ID for the POC
                                const res = await fetch('/api/telegram/publish', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ dealId: deal.id, channelId: '@fantasticofffer' })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  // Update local state to reflect it's published
                                  setDeals(deals.map(d => d.id === deal.id ? { ...d, isPublished: true } : d));
                                  alert(`Successfully published to Telegram!\n\nCaption Generated:\n${data.caption}`);
                                } else {
                                  alert(`Error: ${data.error}`);
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button className="btn-ghost" style={{ padding: '6px', color: 'var(--text-muted)' }} title="View Source">
                          <ExternalLink size={16} />
                        </button>
                        <button className="btn-ghost" style={{ padding: '6px', color: 'var(--accent-rose)' }} title="Reject">
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredDeals.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No deals found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
