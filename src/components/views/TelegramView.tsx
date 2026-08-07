'use client';

import React from 'react';
import { Send, Users, Activity, Settings, Plus } from 'lucide-react';

export default function TelegramView() {
  const liveChannels = [
    {
      id: '1',
      name: 'Fantastic Offers',
      username: '@fantasticofffer',
      isActive: true,
      members: 0,
      postsToday: 'LIVE',
      categories: ['All Deals', 'Flash Sales', 'Price Drops'],
      description: 'Main channel — all deals, max 20/day',
      color: 'linear-gradient(135deg, #0088cc 0%, #00aaff 100%)',
      shadowColor: 'rgba(0, 136, 204, 0.3)',
    },
    {
      id: '2',
      name: 'Hostel Deals',
      username: '@hosteldeals',
      isActive: true,
      members: 0,
      postsToday: 'LIVE',
      categories: ['Student Essentials', 'Amazon Wishlist', 'Flipkart Drops'],
      description: 'Hostel channel — curated picks, max 15/day, 45min gap',
      color: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
      shadowColor: 'rgba(124, 58, 237, 0.3)',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Telegram Channels</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Manage auto-publishing channels and groups</p>
        </div>
        <button className="btn-primary" onClick={() => alert('To add more target channels, please upgrade your database to the Multi-Channel tier, or update the TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL in your .env file.')}>
          <Plus size={16} /> Add Channel
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {liveChannels.map((channel) => (
          <div key={channel.id} className="glass-card" style={{ padding: '20px', borderTop: `3px solid ${channel.color.includes('#0088') ? '#0088cc' : '#7c3aed'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: '44px', height: '44px', borderRadius: '50%', 
                  background: channel.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 10px ${channel.shadowColor}`
                }}>
                  <Send size={20} color="white" style={{ marginLeft: '-2px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{channel.name}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>{channel.username}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>{channel.description}</div>
                </div>
              </div>
              <label className="toggle-switch" title={channel.isActive ? "Active" : "Inactive"}>
                <input type="checkbox" checked={channel.isActive} readOnly />
                <span className="slider"></span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={12} /> Subscribers
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{(channel.members / 1000).toFixed(1)}k</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Activity size={12} /> Posts Today
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600 }}>{channel.postsToday}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {channel.categories.map((cat, idx) => (
                  <span key={idx} style={{ 
                    fontSize: '11px', padding: '2px 8px', borderRadius: '12px', 
                    background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' 
                  }}>
                    {cat}
                  </span>
                ))}
              </div>
              <button className="btn-ghost" style={{ padding: '6px' }} title="Channel Settings">
                <Settings size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <style>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 40px;
          height: 22px;
        }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider {
          position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(255,255,255,0.1); transition: .3s; border-radius: 22px;
        }
        .slider:before {
          position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px;
          background-color: white; transition: .3s; border-radius: 50%;
        }
        input:checked + .slider { background-color: var(--accent-primary); }
        input:checked + .slider:before { transform: translateX(18px); }
      `}</style>
    </div>
  );
}
