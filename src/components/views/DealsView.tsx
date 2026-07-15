'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Check, 
  X, 
  ExternalLink, 
  Zap, 
  Loader2, 
  Link as LinkIcon, 
  Tag, 
  Percent, 
  Image as ImageIcon,
  Send,
  Plus
} from 'lucide-react';
import Image from 'next/image';
import { getDealScoreClass, formatCurrency } from '@/lib/mock-data';

export default function DealsView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Quick Import States
  const [importLink, setImportLink] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchedDeal, setFetchedDeal] = useState<any | null>(null);
  
  // Custom manual edit values
  const [title, setTitle] = useState('');
  const [dealPrice, setDealPrice] = useState(0);
  const [originalPrice, setOriginalPrice] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [platform, setPlatform] = useState('');
  const [externalId, setExternalId] = useState('');
  const [cleanUrl, setCleanUrl] = useState('');
  const [customAffiliateUrl, setCustomAffiliateUrl] = useState('');

  // Helper to parse pasted Telegram deal posts
  const parseTelegramPostText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // 1. Extract link
    const urlRegex = /https?:\/\/[^\s"'`<>]+/gi;
    const urls = text.match(urlRegex) || [];
    const link = urls.find(url => {
      const l = url.toLowerCase();
      return l.includes('amazon') || l.includes('amzn') || l.includes('flipkart') || l.includes('fkrt') || l.includes('myntra') || l.includes('ajio') || l.includes('ekaro') || l.includes('extrape');
    }) || urls[0] || '';

    // 2. Extract MRP
    let mrp = 0;
    const mrpRegexes = [
      /(?:mrp|original|list\s*price|retail\s*price|actual\s*price)\s*(?::|-|Rs\.?|₹)?\s*([\d,]+)/i,
      /~~([\d,]+)~~/
    ];
    for (const regex of mrpRegexes) {
      const match = text.match(regex);
      if (match) {
        mrp = Math.round(parseFloat(match[1].replace(/,/g, '')));
        break;
      }
    }

    // 3. Extract Deal Price
    let price = 0;
    const priceRegexes = [
      /(?:deal|offer|selling|effective|sale|promo|special)?\s*price\s*(?::|-|Rs\.?|₹)?\s*([\d,]+)/i,
      /(?:buy\s*at|grab\s*for|loot\s*at|effective\s*at)\s*(?::|-|Rs\.?|₹)?\s*([\d,]+)/i,
      /(?:Rs\.?|₹)\s*([\d,]+)/i
    ];
    for (const regex of priceRegexes) {
      const match = text.match(regex);
      if (match) {
        const parsed = Math.round(parseFloat(match[1].replace(/,/g, '')));
        if (parsed !== mrp || price === 0) {
          price = parsed;
          if (price !== mrp) break;
        }
      }
    }

    // 4. Extract Title
    let title = '';
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes('http') || lower.includes('www') || lower.includes('://')) continue;
      if (lower.includes('mrp') || lower.includes('price') || lower.includes('off') || lower.includes('%')) continue;
      if (line.replace(/[^\d]/g, '').length > 4) continue;
      
      title = line.replace(/^[\s\u2700-\u27BF\u2600-\u26FF\uFE0F\u20E3]+/g, '').replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '').trim();
      if (title.length > 5) break;
    }

    if (!title && lines.length > 0) {
      title = lines[0].replace(/^[\s\u2700-\u27BF\u2600-\u26FF\uFE0F\u20E3]+/g, '').replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '').trim();
    }

    return { title, mrp, price, link };
  };

  const handleImportInputChange = async (value: string) => {
    setImportLink(value);
    
    // Detect if they pasted a Telegram post or multiline text
    if (value.includes('\n') || (value.length > 50 && !value.startsWith('http'))) {
      const parsed = parseTelegramPostText(value);
      if (parsed.link) {
        // Prefill state fields instantly from text
        setImportLink(parsed.link);
        setTitle(parsed.title);
        setDealPrice(parsed.price);
        setOriginalPrice(parsed.mrp);
        setFetchedDeal({ title: parsed.title, currentPrice: parsed.price, originalPrice: parsed.mrp });
        
        // If they pasted an ekaro.in link directly, preserve it!
        if (parsed.link.includes('ekaro.in')) {
          setCustomAffiliateUrl(parsed.link);
        } else {
          setCustomAffiliateUrl('');
        }
        
        // Resolve target shortlink and fetch image in the background
        setFetching(true);
        try {
          const res = await fetch('/api/deals/auto-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link: parsed.link })
          });
          const data = await res.json();
          if (!data.error) {
            if (data.imageUrl) setImageUrl(data.imageUrl);
            if (data.cleanUrl) setCleanUrl(data.cleanUrl);
            if (data.platform) setPlatform(data.platform);
            if (data.externalId) setExternalId(data.externalId);
            
            // Fallback updates
            if (!parsed.title && data.title) setTitle(data.title);
            if (!parsed.price && data.currentPrice) setDealPrice(data.currentPrice);
            if (!parsed.mrp && data.originalPrice) setOriginalPrice(data.originalPrice);
            
            setFetchedDeal(data);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setFetching(false);
        }
      }
    }
  };

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

  useEffect(() => {
    fetchDeals();
  }, []);

  // Update discount percentage when prices change
  useEffect(() => {
    if (originalPrice > 0 && dealPrice > 0 && originalPrice > dealPrice) {
      setDiscountPct(Math.round(((originalPrice - dealPrice) / originalPrice) * 100));
    } else {
      setDiscountPct(0);
    }
  }, [dealPrice, originalPrice]);

  const handleFetchLink = async () => {
    if (!importLink) return alert('Please paste a link first!');
    setFetching(true);
    setFetchedDeal(null);
    setCustomAffiliateUrl('');
    
    // If they pasted an ekaro.in link directly, preserve it!
    if (importLink.includes('ekaro.in')) {
      setCustomAffiliateUrl(importLink);
    }
    
    try {
      const res = await fetch('/api/deals/auto-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: importLink })
      });
      
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      
      // Load details into form states
      setFetchedDeal(data);
      setTitle(data.title || '');
      setDealPrice(data.currentPrice || 0);
      setOriginalPrice(data.originalPrice || 0);
      setDiscountPct(data.discountPct || 0);
      setImageUrl(data.imageUrl || '');
      setPlatform(data.platform || '');
      setExternalId(data.externalId || '');
      setCleanUrl(data.cleanUrl || '');
      
    } catch (e) {
      console.error(e);
      alert('Failed to resolve link. Please try again.');
    } finally {
      setFetching(false);
    }
  };

  const handleSaveDeal = async (publishImmediately = false) => {
    if (!title || !dealPrice || !cleanUrl) {
      return alert('Please fill in all required fields.');
    }
    
    setLoading(true);
    try {
      // Save manual/auto-imported deal
      const res = await fetch('/api/deals/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          dealPrice: Number(dealPrice),
          originalPrice: Number(originalPrice),
          discountPct: Number(discountPct),
          cleanUrl,
          imageUrl,
          platform,
          externalId,
          customAffiliateUrl
        })
      });
      
      const data = await res.json();
      if (data.error) {
        alert(`Error saving deal: ${data.error}`);
        return;
      }
      
      // If requested, publish directly to Telegram
      if (publishImmediately && data.dealId) {
        const publishRes = await fetch('/api/telegram/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId: data.dealId, channelId: '@fantasticofffer' })
        });
        const publishData = await publishRes.json();
        if (publishData.success) {
          alert('Deal saved and published to Telegram successfully!');
        } else {
          alert(`Deal saved, but failed to publish: ${publishData.error}`);
        }
      } else {
        alert('Deal saved successfully to pending queue.');
      }
      
      // Reset states
      setImportLink('');
      setFetchedDeal(null);
      fetchDeals();
      
    } catch (e) {
      console.error(e);
      alert('An error occurred while saving the deal.');
    } finally {
      setLoading(false);
    }
  };

  const filteredDeals = deals.filter(deal => 
    deal.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    deal.platform.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* SECTION 1: SMART DEAL IMPORTER */}
      <div className="glass-card" style={{ padding: '28px', border: '1px solid var(--border-primary)' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LinkIcon size={20} color="var(--accent-primary-light)" />
          Quick Import Deal via Link
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Paste any product link or affiliate link from Amazon, Flipkart, Myntra, Ajio, EarnKaro, or ExtraPe. We will auto-extract the name, pricing, discount, and product image.
        </p>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', borderRadius: '12px', flex: 1
          }}>
            <LinkIcon size={18} color="var(--text-muted)" style={{ marginTop: '3px' }} />
            <textarea
              placeholder="Paste product link OR paste the entire Telegram post text here to auto-fill details instantly..."
              value={importLink}
              onChange={(e) => handleImportInputChange(e.target.value)}
              rows={2}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'white',
                fontSize: '14px',
                width: '100%',
                resize: 'vertical',
                minHeight: '44px',
                fontFamily: 'inherit'
              }}
            />
          </div>
          <button 
            className="btn-primary"
            style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-primary)', minWidth: '150px', justifyContent: 'center' }}
            onClick={handleFetchLink}
            disabled={fetching}
          >
            {fetching ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Fetching...
              </>
            ) : (
              <>
                <Zap size={16} /> Auto-Fetch Deal
              </>
            )}
          </button>
        </div>

        {/* PREVIEW & EDIT SECTION (Appears after fetching) */}
        {fetchedDeal && (
          <div className="glass-card" style={{ marginTop: '24px', padding: '24px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            
            {/* Left Column: Image Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '160px' }}>
              <div style={{
                width: '160px', height: '160px', borderRadius: '12px', background: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-primary)', position: 'relative'
              }}>
                {imageUrl ? (
                  <Image src={imageUrl} alt="Product Preview" fill style={{ objectFit: 'contain', padding: '4px' }} />
                ) : (
                  <ImageIcon size={40} color="var(--text-muted)" />
                )}
              </div>
              <div style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                {platform}
              </div>
            </div>

            {/* Right Column: Fields & Details */}
            <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Product Title */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Product Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
                />
              </div>

              {/* Pricing Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Deal Price (₹)</label>
                  <input
                    type="number"
                    value={dealPrice || ''}
                    onChange={(e) => setDealPrice(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>MRP Price (₹)</label>
                  <input
                    type="number"
                    value={originalPrice || ''}
                    onChange={(e) => setOriginalPrice(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Discount (%)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'var(--accent-emerald)', fontSize: '14px', fontWeight: 600 }}>
                    <Percent size={14} />
                    {discountPct}% OFF
                  </div>
                </div>
              </div>

              {/* Image & Target Link Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Image URL</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Clean Destination URL</label>
                  <input
                    type="text"
                    value={cleanUrl}
                    readOnly
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '12px', cursor: 'not-allowed' }}
                  />
                </div>
              </div>
              
              {/* Custom Affiliate Link Override */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Custom Affiliate URL (Optional - Overrides Auto-generation)</label>
                <input
                  type="text"
                  value={customAffiliateUrl}
                  onChange={(e) => setCustomAffiliateUrl(e.target.value)}
                  placeholder="Paste your ekaro.in or custom tracking link here if you don't want the system to auto-generate one..."
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'var(--accent-emerald)', fontSize: '12px' }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button 
                  className="btn-ghost" 
                  style={{ color: 'var(--text-secondary)' }}
                  onClick={() => setFetchedDeal(null)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={() => handleSaveDeal(false)}
                >
                  <Plus size={16} /> Save to Pending
                </button>
                <button 
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-emerald)' }}
                  onClick={() => handleSaveDeal(true)}
                >
                  <Send size={16} /> Save & Publish Live
                </button>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* SECTION 2: LIVE DEALS LIST */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', width: '100%' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', borderRadius: '10px', width: '400px'
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
          
          <button 
            className="btn-primary" 
            style={{ marginLeft: 'auto', whiteSpace: 'nowrap', background: 'var(--accent-primary-light)' }}
            onClick={async () => {
              setLoading(true);
              try {
                await fetch('/api/cron');
                await fetchDeals();
              } catch (e) {
                console.error(e);
              } finally {
                setLoading(false);
              }
            }}
          >
            <Zap size={16} /> Auto Scrape TG Channels
          </button>
        </div>
      </div>

      {/* Deals Table */}
      <div className="chart-container" style={{ padding: 0, overflow: 'hidden', minHeight: '400px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', flexDirection: 'column', gap: '12px' }}>
            <Loader2 size={32} color="var(--accent-primary)" className="animate-spin" />
            <div style={{ color: 'var(--text-muted)' }}>Loading live database...</div>
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
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {deal.imageUrl ? (
                          <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border-primary)' }}>
                            <Image src={deal.imageUrl} alt="" fill style={{ objectFit: 'contain', padding: '4px' }} />
                          </div>
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <ImageIcon size={18} color="var(--text-muted)" />
                          </div>
                        )}
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4' }}>
                            {deal.title}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: 'var(--accent-primary-light)', textTransform: 'capitalize' }}>{deal.platform}</span>
                            {deal.category && <span>•</span>}
                            {deal.category && <span>{deal.category}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {deal.dealType?.replace('_', ' ')}
                      </div>
                      {deal.affiliateUrl && (
                        <div style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginTop: '4px' }}>
                          <LinkIcon size={10} /> Link Connected
                        </div>
                      )}
                    </td>
                    <td>
                      <div className={`deal-score ${getDealScoreClass(deal.dealScore)}`} style={{ transform: 'scale(0.8)', transformOrigin: 'left center' }}>
                        {deal.dealScore}
                      </div>
                    </td>
                    <td>
                      {deal.dealPrice > 0 ? (
                        <>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{deal.dealPrice.toLocaleString('en-IN')}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {deal.originalPrice && deal.originalPrice > 0 && (
                               <span style={{ textDecoration: 'line-through' }}>₹{deal.originalPrice.toLocaleString('en-IN')}</span>
                            )}
                            {deal.discountPct && deal.discountPct > 0 ? (
                              <span style={{ color: 'var(--accent-emerald)', marginLeft: '6px', fontWeight: 600 }}>{deal.discountPct}% OFF</span>
                            ) : deal.discount && deal.discount > 0 ? (
                              <span style={{ color: 'var(--accent-emerald)', marginLeft: '6px', fontWeight: 600 }}>{deal.discount}% OFF</span>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Unverified Price
                        </div>
                      )}
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
                                const res = await fetch('/api/telegram/publish', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ dealId: deal.id, channelId: '@fantasticofffer' })
                                });
                                const data = await res.json();
                                if (data.success) {
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
                        <a 
                          href={deal.url || '#'} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn-ghost" 
                          style={{ padding: '6px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} 
                          title="View Original Product Link"
                        >
                          <ExternalLink size={16} />
                        </a>
                        <button 
                          className="btn-ghost" 
                          style={{ padding: '6px', color: 'var(--accent-rose)' }} 
                          title="Reject / Delete"
                          onClick={async () => {
                            if (!confirm('Are you sure you want to delete this deal?')) return;
                            try {
                              await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' });
                              setDeals(deals.filter(d => d.id !== deal.id));
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        >
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
