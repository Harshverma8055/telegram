'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Tag,
  Zap,
  Globe,
  BarChart3,
  Send,
  MessageCircle,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Cpu,
  Users,
  Sparkles,
  Shield,
  Database,
  Link2,
  TrendingUp,
  ImageIcon,
  Bot,
  ChevronLeft,
  Menu,
  LogOut,
  Clock,
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  children?: { id: string; label: string }[];
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, badge: 'Live' },
    ],
  },
  {
    title: 'DEAL ENGINE',
    items: [
      { id: 'deals', label: 'All Deals', icon: <Tag size={18} /> },
      { id: 'flash-sales', label: 'Flash Sales', icon: <Zap size={18} /> },
      { id: 'price-drops', label: 'Price Drops', icon: <TrendingUp size={18} /> },
      { id: 'coupons', label: 'Coupons', icon: <Link2 size={18} /> },
      { id: 'ai-scoring', label: 'AI Scoring', icon: <Sparkles size={18} /> },
    ],
  },
  {
    title: 'SCRAPERS',
    items: [
      { id: 'scrapers', label: 'Scraper Status', icon: <Globe size={18} />, badge: '1 active' },
      { id: 'platforms', label: 'Platforms', icon: <Database size={18} /> },
    ],
  },
  {
    title: 'DISTRIBUTION',
    items: [
      { id: 'telegram', label: 'Telegram', icon: <Send size={18} />, badge: '1 channel' },
      { id: 'recurring', label: 'Smart Reposter', icon: <Clock size={18} /> },
      { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={18} /> },
      { id: 'content', label: 'Content AI', icon: <Bot size={18} /> },
      { id: 'images', label: 'Image Studio', icon: <ImageIcon size={18} /> },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { id: 'users', label: 'Users', icon: <Users size={18} /> },
      { id: 'security', label: 'Security', icon: <Shield size={18} /> },
      { id: 'api', label: 'API Keys', icon: <Cpu size={18} /> },
      { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
    ],
  },
];

export default function Sidebar({ activeSection, onNavigate }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="btn-ghost"
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 100,
          display: 'none',
        }}
        id="mobile-menu-toggle"
      >
        <Menu size={20} />
      </button>

      <style>{`
        @media (max-width: 1024px) {
          #mobile-menu-toggle { display: flex !important; }
        }
      `}</style>

      {/* Overlay */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 49,
          }}
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <Zap size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              DealFlow
              <span style={{ color: 'var(--accent-primary-light)', marginLeft: 4 }}>AI</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              DEAL AUTOMATION
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-primary)',
            borderRadius: 8,
          }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 13,
                width: '100%',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            <kbd style={{
              padding: '2px 6px',
              fontSize: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              color: 'var(--text-muted)',
            }}>⌘K</kbd>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflow: 'auto', padding: '4px 12px' }}>
          {navGroups.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.1em',
                padding: '0 16px',
                marginBottom: 6,
              }}>
                {group.title}
              </div>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={`sidebar-nav-item ${activeSection === item.id ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsMobileOpen(false);
                  }}
                >
                  {item.icon}
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: activeSection === item.id
                        ? 'rgba(99,102,241,0.2)'
                        : 'rgba(255,255,255,0.05)',
                      color: activeSection === item.id
                        ? 'var(--accent-primary-light)'
                        : 'var(--text-muted)',
                      fontWeight: 600,
                    }}>
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom User Section */}
        <div style={{
          padding: 16,
          borderTop: '1px solid var(--border-primary)',
        }}>
          {/* Server Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'rgba(16,185,129,0.05)',
            borderRadius: 8,
            marginBottom: 12,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px rgba(16,185,129,0.5)',
            }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>All Systems Operational</span>
          </div>

          {/* User */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 4px',
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: 'white',
            }}>
              G
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Gabbar</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Admin</div>
            </div>
            <button className="btn-ghost" style={{ padding: 6 }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
