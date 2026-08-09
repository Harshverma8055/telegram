'use client';

import React, { useState, useRef } from 'react';
import { Link2, Copy, Check, Zap, ExternalLink, AlertCircle, Loader2, RefreshCw, Share2, ChevronDown } from 'lucide-react';

const PLATFORMS = [
  { name: 'Flipkart',  domain: 'flipkart.com',  color: '#F9A825', bg: 'rgba(249,168,37,0.12)',  emoji: '🛒' },
  { name: 'Myntra',    domain: 'myntra.com',     color: '#FF3F6C', bg: 'rgba(255,63,108,0.12)',  emoji: '👗' },
  { name: 'Ajio',      domain: 'ajio.com',       color: '#a855f7', bg: 'rgba(168,85,247,0.12)',  emoji: '✨' },
  { name: 'Nykaa',     domain: 'nykaa.com',      color: '#FC2779', bg: 'rgba(252,39,121,0.12)', emoji: '💄' },
  { name: 'Meesho',    domain: 'meesho.com',     color: '#9B26AF', bg: 'rgba(155,38,175,0.12)', emoji: '🛍️' },
  { name: 'Amazon',    domain: 'amazon.in',      color: '#FF9900', bg: 'rgba(255,153,0,0.12)',  emoji: '📦' },
  { name: 'Snapdeal',  domain: 'snapdeal.com',   color: '#E40046', bg: 'rgba(228,0,70,0.12)',   emoji: '🔴' },
  { name: 'Tata CLiQ', domain: 'tatacliq.com',  color: '#6B0C8F', bg: 'rgba(107,12,143,0.12)', emoji: '🏆' },
];

interface Result {
  affiliateLink: string;
  originalUrl: string;
  platform: string;
  platformColor: string;
  title: string;
  image: string;
  price: string;
}

interface HistoryItem extends Result {
  convertedAt: string;
}

// Platforms with no API — open their link generator manually
const HIGH_COMMISSION = [
  { name: 'EarnKaro', url: 'https://earnkaro.com/link-generator', commission: '~9%', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', emoji: '💰' },
  { name: 'ExtraPe',  url: 'https://www.extrape.com/converter', commission: '~11%', color: '#10b981', bg: 'rgba(16,185,129,0.1)', emoji: '💎' },
];

export default function LinkConverterView() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Copy URL + open platform (for EarnKaro/ExtraPe manual flow)
  const handleOpenHighCommission = async (platformUrl: string, platformName: string) => {
    const productUrl = result?.originalUrl || url.trim();
    if (!productUrl) return;
    try { await navigator.clipboard.writeText(productUrl); } catch {}
    setCopiedPlatform(platformName);
    setTimeout(() => setCopiedPlatform(null), 3000);
    window.open(platformUrl, '_blank');
  };

  const handleConvert = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);

    try {
      const res = await fetch('/api/link-converter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, subid: 'manual' }),
      });
      const data = await res.json();

      if (data.success) {
        setResult(data);
        const item: HistoryItem = { ...data, convertedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) };
        setHistory(prev => [item, ...prev.slice(0, 19)]); // Keep last 20
      } else {
        setError(data.error || 'Conversion failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      inputRef.current?.focus();
    } catch {
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setUrl('');
    setResult(null);
    setError(null);
    setCopied(false);
    inputRef.current?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 40, padding: '8px 20px', marginBottom: 16,
        }}>
          <Zap size={16} color="#a78bfa" />
          <span style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600 }}>Cuelinks Powered</span>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 700, background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>
          Affiliate Link Converter
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto' }}>
          Paste any product URL from Flipkart, Myntra, Ajio or 1000+ stores — get your personal affiliate link instantly. Share it and earn commission! 💸
        </p>
      </div>

      {/* Supported Platforms */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Supported Platforms
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PLATFORMS.map(p => (
            <span key={p.name} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: p.bg, color: p.color,
              border: `1px solid ${p.color}30`,
            }}>
              <span>{p.emoji}</span> {p.name}
            </span>
          ))}
        </div>
      </div>

      {/* Main Converter */}
      <div className="glass-card" style={{ padding: '28px' }}>
        <form onSubmit={handleConvert}>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Link2 size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste Flipkart / Myntra / Ajio product URL here..."
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px 110px 16px 48px',
                background: 'rgba(255,255,255,0.03)',
                border: '1.5px solid var(--border-primary)',
                borderRadius: 14,
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                transition: 'border 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.currentTarget.style.border = '1.5px solid rgba(99,102,241,0.6)'}
              onBlur={e => e.currentTarget.style.border = '1.5px solid var(--border-primary)'}
            />
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 6 }}>
              {url && (
                <button type="button" onClick={handleClear}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>
                  ✕
                </button>
              )}
              <button type="button" onClick={handlePaste}
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a78bfa', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                Paste
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !url.trim()}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: (loading || !url.trim()) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: (loading || !url.trim()) ? 'var(--text-muted)' : 'white',
              border: 'none', cursor: (loading || !url.trim()) ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
              boxShadow: (!loading && url.trim()) ? '0 4px 20px rgba(99,102,241,0.3)' : 'none',
            }}
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Converting...</>
            ) : (
              <><Zap size={18} /> Convert to Affiliate Link</>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 10,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ marginTop: 20, borderRadius: 14, border: '1.5px solid rgba(99,102,241,0.25)', overflow: 'hidden' }}>
            {/* Product Info Row */}
            {(result.title || result.image) && (
              <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 14, alignItems: 'center' }}>
                {result.image && (
                  <img src={result.image} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, background: 'white', padding: 4 }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {result.title && <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.title}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                      background: `${result.platformColor}20`, color: result.platformColor,
                      border: `1px solid ${result.platformColor}30`,
                    }}>{result.platform}</span>
                    {result.price && <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{result.price}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Affiliate Link */}
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                ✅ Your Affiliate Link (Cuelinks)
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{
                  flex: 1, padding: '12px 14px', background: 'rgba(16,185,129,0.05)',
                  border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10,
                  fontFamily: 'monospace', fontSize: 13, color: '#10b981',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {result.affiliateLink}
                </div>
                <button
                  onClick={() => handleCopy(result.affiliateLink)}
                  style={{
                    padding: '12px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: copied ? 'rgba(16,185,129,0.2)' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                    color: 'white', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13,
                    transition: 'all 0.2s', whiteSpace: 'nowrap',
                    boxShadow: copied ? 'none' : '0 4px 12px rgba(99,102,241,0.3)',
                  }}
                >
                  {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy</>}
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <a href={result.affiliateLink} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', cursor: 'pointer' }}>
                  <ExternalLink size={13} /> Preview Link
                </a>
                <button
                  onClick={handleClear}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
                  <RefreshCw size={13} /> Convert Another
                </button>
                <button
                  onClick={() => {
                    const msg = `${result.title || 'Product'}\n${result.price ? result.price + '\n' : ''}Buy here: ${result.affiliateLink}`;
                    handleCopy(msg);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-primary)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
                  <Share2 size={13} /> Copy as Message
                </button>
              </div>
            </div>
          </div>
        )}

        {/* High Commission Options — always visible when URL is present */}
        {(url.trim() || result) && (
          <div style={{ marginTop: 16, padding: '16px 20px', borderRadius: 14, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <p style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              💰 Higher Commission Options (No API — Manual Step Required)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {HIGH_COMMISSION.map(p => (
                <button key={p.name} onClick={() => handleOpenHighCommission(p.url, p.name)}
                  style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${p.color}40`, background: p.bg, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.emoji} {p.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.color, background: `${p.color}20`, padding: '2px 8px', borderRadius: 6 }}>{p.commission}</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                    {copiedPlatform === p.name ? '✅ URL copied! Paste in their link generator' : '↗ Opens site + auto-copies URL to clipboard'}
                  </p>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
              How: Click → site opens → paste URL in their link generator → get 9% commission link
            </p>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            <span>🕑 Recent Conversions ({history.length})</span>
            <ChevronDown size={16} style={{ transform: showHistory ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showHistory && (
            <div style={{ borderTop: '1px solid var(--border-primary)' }}>
              {history.map((item, idx) => (
                <div key={idx} style={{ padding: '12px 20px', borderBottom: idx < history.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 42 }}>{item.convertedAt}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${item.platformColor}20`, color: item.platformColor, minWidth: 56, textAlign: 'center' }}>{item.platform}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || item.originalUrl}</span>
                  <button
                    onClick={() => handleCopy(item.affiliateLink)}
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#a78bfa', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Copy size={11} /> Copy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>How It Works</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { step: '1', icon: '📋', title: 'Paste Product URL', desc: 'Copy any link from Flipkart, Myntra, Ajio app and paste it here' },
            { step: '2', icon: '⚡', title: 'Convert Instantly', desc: 'Our system wraps it with your Cuelinks affiliate tracking code' },
            { step: '3', icon: '📤', title: 'Share & Earn', desc: 'Send the affiliate link to your friend. Earn commission when they buy!' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{s.title}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
