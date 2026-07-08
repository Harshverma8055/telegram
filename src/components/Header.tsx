'use client';

import React, { useState } from 'react';
import {
  Bell,
  Search,
  Settings,
  ChevronDown,
  Zap,
  AlertTriangle,
  TrendingDown,
  Tag,
  Server,
  X,
} from 'lucide-react';
import { mockNotifications } from '@/lib/mock-data';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = mockNotifications.filter((n) => !n.isRead).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'flash_sale': return <Zap size={14} color="#f59e0b" />;
      case 'price_drop': return <TrendingDown size={14} color="#10b981" />;
      case 'system': return <Server size={14} color="#f43f5e" />;
      case 'deal_ending': return <AlertTriangle size={14} color="#f97316" />;
      case 'stock': return <Tag size={14} color="#6366f1" />;
      default: return <Bell size={14} color="#94a3b8" />;
    }
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 32px',
      borderBottom: '1px solid var(--border-primary)',
      background: 'rgba(10, 10, 15, 0.8)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Title */}
      <div>
        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontSize: 13,
            color: 'var(--text-muted)',
            marginTop: 2,
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-primary)',
          borderRadius: 10,
          minWidth: 220,
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search deals, products..."
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
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn-ghost"
            onClick={() => setShowNotifications(!showNotifications)}
            style={{ position: 'relative', padding: 10 }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'var(--accent-rose)',
                color: 'white',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 380,
              background: 'rgba(18, 18, 26, 0.98)',
              backdropFilter: 'blur(30px)',
              border: '1px solid var(--border-secondary)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
              zIndex: 100,
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-primary)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Notifications</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(244,63,94,0.1)',
                    color: '#fb7185',
                    fontWeight: 600,
                  }}>
                    {unreadCount} new
                  </span>
                  <button className="btn-ghost" style={{ padding: 4 }} onClick={() => setShowNotifications(false)}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                {mockNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-primary)',
                      background: notif.isRead ? 'transparent' : 'rgba(99,102,241,0.03)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = notif.isRead ? 'transparent' : 'rgba(99,102,241,0.03)'; }}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {getNotificationIcon(notif.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: notif.isRead ? 500 : 600,
                        color: notif.isRead ? 'var(--text-secondary)' : 'var(--text-primary)',
                        marginBottom: 2,
                      }}>
                        {notif.title}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {notif.message}
                      </div>
                    </div>
                    {!notif.isRead && <div className="notification-dot" style={{ marginTop: 4 }} />}
                  </div>
                ))}
              </div>

              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--border-primary)',
                textAlign: 'center',
              }}>
                <button className="btn-ghost" style={{ fontSize: 13, color: 'var(--accent-primary-light)' }}>
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <button className="btn-ghost" style={{ padding: 10 }}>
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
