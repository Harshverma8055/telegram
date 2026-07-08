'use client';

import React, { useState } from 'react';
import { Play, Square, RefreshCw, AlertCircle, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { mockScraperStatus, PLATFORM_COLORS, getTimeSince } from '@/lib/mock-data';

export default function ScrapersView() {
  const [testUrl, setTestUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleTestScrape = async () => {
    if (!testUrl) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/scrapers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (error: any) {
      setTestResult({ error: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Live Testing Section */}
      <div className="glass-card" style={{ padding: '24px', border: '1px solid var(--border-accent)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Play size={18} color="var(--accent-primary-light)" /> 
          Live Scraper Test (Amazon POC)
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Paste an Amazon product URL below. The scraper will fetch the live price, mock an AI score, and instantly insert it into your database.
        </p>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)', borderRadius: '10px', flex: 1
          }}>
            <LinkIcon size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="https://www.amazon.in/dp/B0..."
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              className="input-field"
              style={{ border: 'none', background: 'transparent', padding: 0, width: '100%' }}
            />
          </div>
          <button 
            className="btn-primary" 
            onClick={handleTestScrape}
            disabled={isTesting || !testUrl}
            style={{ minWidth: '140px', opacity: (isTesting || !testUrl) ? 0.7 : 1 }}
          >
            {isTesting ? <><RefreshCw size={16} className="animate-spin" /> Scraping...</> : 'Test Scraper'}
          </button>
        </div>

        {testResult && (
          <div style={{ 
            marginTop: '16px', padding: '16px', borderRadius: '10px', 
            background: testResult.error ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${testResult.error ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}`
          }}>
            {testResult.error ? (
              <div style={{ color: '#fb7185', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> {testResult.error}
              </div>
            ) : (
              <div>
                <div style={{ color: '#34d399', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <CheckCircle2 size={16} /> Successfully scraped & processed!
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Title:</span>
                    <div style={{ fontWeight: 500, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{testResult.scrapedData.title}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Price:</span>
                    <div style={{ fontWeight: 500, marginTop: '4px' }}>₹{testResult.scrapedData.price} <span style={{ color: 'var(--accent-emerald)', fontSize: '12px' }}>({testResult.discount}% OFF)</span></div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Deal Generated:</span>
                    <div style={{ fontWeight: 500, marginTop: '4px' }}>
                      {testResult.dealGenerated ? <span className="status-badge active">Yes (Score: {testResult.dealScore})</span> : 'No (Discount too low)'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Scraper Status & Control</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => alert('All scrapers are managed by Vercel Cron in the cloud.')}>
            <Square size={16} /> Stop All
          </button>
          <button className="btn-primary" onClick={async (e) => {
            const btn = e.currentTarget;
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Running...';
            try {
              await fetch('/api/cron');
              alert('Successfully triggered all scrapers in the background!');
            } catch (err) {
              alert('Failed to run scrapers.');
            } finally {
              btn.innerHTML = originalText;
            }
          }}>
            <Play size={16} /> Run All Scrapers
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {[
          {
            id: '1',
            platform: 'Telegram Amazon Extractor',
            status: 'running',
            productsScanned: 'LIVE',
            dealsFound: 'LIVE',
            lastRunAt: new Date().toISOString(),
            errors: 0
          }
        ].map((scraper) => {
          const isRunning = scraper.status === 'running';
          const hasError = scraper.status === 'failed';
          
          return (
            <div key={scraper.id} className={`glass-card ${hasError ? 'error-border' : ''}`} style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
              {isRunning && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent-primary)', animation: 'pulse-glow 1.5s infinite' }} />
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '10px', 
                    background: 'linear-gradient(135deg, #0088cc 0%, #00aaff 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: '18px', textTransform: 'uppercase'
                  }}>
                    T
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, textTransform: 'capitalize' }}>{scraper.platform}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginTop: '4px' }}>
                      <span className={`status-badge ${isRunning ? 'active' : hasError ? 'error' : scraper.status === 'completed' ? 'info' : 'warning'}`} style={{ padding: '2px 8px', fontSize: '10px' }}>
                        {scraper.status}
                      </span>
                      {isRunning && <span style={{ color: 'var(--text-muted)' }}><RefreshCw size={10} className="animate-spin" /></span>}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-ghost" style={{ padding: '6px', background: 'rgba(244,63,94,0.1)', color: '#fb7185' }} title="Stop Scraper">
                    <Square size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Products Scanned</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>{scraper.productsScanned}</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Deals Found</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-primary-light)' }}>{scraper.dealsFound}</div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-primary)', paddingTop: '12px' }}>
                <span>Always On (Vercel Cron)</span>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        .error-border { border-color: rgba(244,63,94,0.3) !important; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
