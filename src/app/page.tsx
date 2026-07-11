'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  CreditCard,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Activity,
  Package,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import DealsView from '@/components/views/DealsView';
import ScrapersView from '@/components/views/ScrapersView';
import TelegramView from '@/components/views/TelegramView';
import RecurringView from '@/components/views/RecurringView';
import WatchlistView from '@/components/views/WatchlistView';
import {
  mockDashboardStats,
  mockRevenueTimeline,
  mockPlatformBreakdown,
  mockDeals,
  formatCurrency,
  formatNumber,
  getDealScoreClass,
} from '@/lib/mock-data';

// Internal Dashboard View component to keep code clean
function DashboardView() {
  const [stats, setStats] = React.useState({
    totalDeals: 0,
    dealsChange: 100,
    conversionRate: 0,
    liveDeals: [] as any[],
  });

  React.useEffect(() => {
    fetch('/api/deals')
      .then(res => res.json())
      .then(data => {
        if (data.deals) {
          setStats({
            totalDeals: data.deals.length,
            dealsChange: 100, // 100% since start
            conversionRate: 0, // Pending Amazon API
            liveDeals: data.deals,
          });
        }
      });
  }, []);

  // Generate a flatline chart for revenue until API is connected
  const liveRevenueTimeline = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toISOString().split('T')[0],
      value: 0
    };
  });

  const livePlatformBreakdown = [
    { platform: 'Amazon', revenue: 0 },
    { platform: 'Flipkart', revenue: 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px',
      }}>
        {/* Revenue - Awaiting Amazon API */}
        <div className="glass-card metric-card purple" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <DollarSign size={20} color="var(--accent-primary-light)" />
            </div>
            <div className="status-badge warning">
              Awaiting Amazon API
            </div>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>Total Revenue</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            ₹0.00
          </div>
        </div>

        {/* Clicks - Awaiting Amazon API */}
        <div className="glass-card metric-card cyan" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'rgba(6,182,212,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Activity size={20} color="#22d3ee" />
            </div>
            <div className="status-badge warning">
              Awaiting Amazon API
            </div>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>Total Clicks</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            0
          </div>
        </div>

        {/* Live Deals Published */}
        <div className="glass-card metric-card emerald" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Package size={20} color="#34d399" />
            </div>
            <div className="status-badge active">
              <ArrowUpRight size={14} /> LIVE 
            </div>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>Deals Scraped & Published</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {formatNumber(stats.totalDeals)}
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="glass-card metric-card amber" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShoppingCart size={20} color="#fbbf24" />
            </div>
            <div className="status-badge warning">
              Awaiting Amazon API
            </div>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 500 }}>Avg. Conversion Rate</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            0%
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
      }}>
        {/* Revenue Chart */}
        <div className="chart-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Revenue Overview</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Awaiting Amazon Associates API integration</p>
            </div>
            <div className="tab-list">
              <button className="tab-item active">7D</button>
              <button className="tab-item">30D</button>
              <button className="tab-item">90D</button>
            </div>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveRevenueTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dy={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(value) => `₹${value}`} />
                <RechartsTooltip 
                  contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)', borderRadius: '12px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: '8px' }}
                  formatter={(value: any) => [formatCurrency(value || 0), 'Revenue']}
                />
                <Area type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Breakdown */}
        <div className="chart-container">
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '24px' }}>Platform Performance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {livePlatformBreakdown.map((platform, idx) => {
              const maxRevenue = 1; // Prevent div by 0
              const percentage = 0;
              
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{platform.platform.replace('_', ' ')}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>₹0.00</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-bar-fill" 
                      style={{ 
                        width: `${percentage}%`,
                        background: `var(--accent-primary)`,
                        opacity: 1 - (idx * 0.15)
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Deals Table */}
      <div className="chart-container" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Recently Published Deals</h3>
          <button className="btn-ghost" style={{ color: 'var(--accent-primary-light)' }}>View All Deals</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Product / Deal</th>
                <th style={{ width: '12%' }}>Platform</th>
                <th style={{ width: '12%' }}>Score</th>
                <th style={{ width: '12%' }}>Price</th>
                <th style={{ width: '15%' }}>Revenue</th>
                <th style={{ width: '10%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.liveDeals.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No deals scraped yet today. Run the scraper to populate!
                  </td>
                </tr>
              ) : (
                stats.liveDeals.slice(0, 5).map((deal) => (
                  <tr key={deal.id}>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '8px',
                          background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                           <Package size={20} color="var(--text-muted)" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {deal.title}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {deal.category}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                      Amazon
                    </td>
                    <td>
                      <div className={`deal-score ${getDealScoreClass(deal.dealScore)}`} style={{ transform: 'scale(0.8)', transformOrigin: 'left center' }}>
                        {deal.dealScore}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{deal.currentPrice?.toLocaleString('en-IN') || 0}</div>
                      <div style={{ fontSize: '12px', color: 'var(--accent-emerald)', marginTop: '2px' }}>{deal.discountPct || 0}% OFF</div>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-muted)' }}>
                      Pending API
                    </td>
                    <td>
                      <div className={`status-badge ${deal.isPublished ? 'active' : 'warning'}`}>
                        {deal.isPublished ? 'Published' : 'Pending'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState('dashboard');

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardView />;
      case 'deals':
      case 'flash-sales':
        return <DealsView />;
      case 'price-drops':
        return <WatchlistView />;
      case 'scrapers':
        return <ScrapersView />;
      case 'telegram':
        return <TelegramView />;
      case 'recurring':
        return <RecurringView />;
      default:
        return (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h2 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '12px' }}>Coming Soon</h2>
            <p>The <strong>{activeSection.replace('-', ' ')}</strong> module is under active development for Phase 2.</p>
          </div>
        );
    }
  };

  const getPageTitle = () => {
    switch (activeSection) {
      case 'dashboard': return 'Dashboard';
      case 'deals': return 'Deal Engine';
      case 'flash-sales': return 'Flash Sales';
      case 'price-drops': return 'Price Tracker Watchlist';
      case 'scrapers': return 'Scraper Engine';
      case 'telegram': return 'Telegram Automation';
      case 'recurring': return 'Smart Recurring Reposter';
      default: return activeSection.charAt(0).toUpperCase() + activeSection.slice(1).replace('-', ' ');
    }
  };

  const getPageSubtitle = () => {
    switch (activeSection) {
      case 'dashboard': return "Welcome back, here's what's happening today.";
      case 'deals': return "Review, score, and publish the latest deals.";
      case 'scrapers': return "Monitor live bot performance across 24 platforms.";
      case 'telegram': return "Manage multi-channel auto-publishing.";
      case 'recurring': return "Schedule and manage automated recurring repost campaigns.";
      case 'price-drops': return 'Add specific products to track their prices hourly and alert your Telegram channel on drops.';
      default: return '';
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar activeSection={activeSection} onNavigate={setActiveSection} />
      
      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header 
          title={getPageTitle()} 
          subtitle={getPageSubtitle()}
        />

        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
