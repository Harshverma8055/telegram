'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Send, 
  Link as LinkIcon, 
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  RotateCw,
  Loader2
} from 'lucide-react';

export default function RecurringView() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [link, setLink] = useState('');
  const [intervalMin, setIntervalMin] = useState(60); // Default 1 hour

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/recurring');
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
      }
    } catch (e) {
      console.error('Failed to fetch recurring posts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) {
      alert('Please fill in title and content fields.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          imageUrl,
          link,
          intervalMin
        })
      });
      const data = await res.json();
      if (data.success) {
        // Reset form
        setTitle('');
        setContent('');
        setImageUrl('');
        setLink('');
        setIntervalMin(60);
        fetchPosts();
        alert('Recurring repost schedule created successfully!');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save recurring post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setActionLoading(id);
    try {
      await fetch('/api/recurring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentActive })
      });
      fetchPosts();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerNow = async (id: string) => {
    if (!confirm('Are you sure you want to trigger this post to Telegram immediately?')) return;
    setActionLoading(id);
    try {
      const res = await fetch('/api/recurring/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        alert('Message posted to Telegram successfully!');
        fetchPosts();
      } else {
        alert(`Failed to post: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Failed to post message.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this repost schedule?')) return;
    setActionLoading(id);
    try {
      await fetch(`/api/recurring?id=${id}`, {
        method: 'DELETE'
      });
      fetchPosts();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  // Helper to get formatted interval string
  const formatInterval = (min: number) => {
    if (min === 5) return 'Every 5 Minutes (Test)';
    if (min < 60) return `${min} Minutes`;
    if (min === 60) return 'Every 1 Hour';
    if (min % 1440 === 0) {
      const days = min / 1440;
      return days === 1 ? 'Every Day (24h)' : `Every ${days} Days`;
    }
    const hours = Math.round(min / 60);
    return `Every ${hours} Hours`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Introduction Banner */}
      <div className="glass-card" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99,102,241,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Clock size={24} color="var(--accent-primary-light)" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Smart Recurring Reposter</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Schedule important deals, coupon alerts, or target channel links to post again and again to Telegram so subscribers never miss out.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: CREATE FORM */}
        <div className="glass-card" style={{ padding: '24px', border: '1px solid var(--border-primary)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} color="var(--accent-primary-light)" />
            Add Repost Schedule
          </h3>
          
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Campaign Title (Internal)</label>
              <input
                type="text"
                placeholder="e.g. Channel Join Promo, Umbrella Deal Alert"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
                required
              />
            </div>

            {/* Content Textarea */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Post Message (Markdown Supported)</label>
              <textarea
                placeholder="Write your promo caption here. Keep it high converting!"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', fontSize: '14px', resize: 'vertical' }}
                required
              />
            </div>

            {/* Target Link */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><LinkIcon size={12} /> Target Link (Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Paste new channel invite link or affiliate product URL"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', fontSize: '13px' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>E-commerce links automatically wrap with your EarnKaro/ExtraPe tracking code.</span>
            </div>

            {/* Image URL */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ImageIcon size={12} /> Image URL (Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Paste image link to display a preview photo card"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', fontSize: '13px' }}
              />
            </div>

            {/* Interval Time Gap */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>Time Gap (Repost Frequency)</label>
              <select
                value={intervalMin}
                onChange={(e) => setIntervalMin(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: '8px', color: 'white', fontSize: '14px', cursor: 'pointer' }}
              >
                <option value={5}>Every 5 Minutes (For testing)</option>
                <option value={60}>Every 1 Hour</option>
                <option value={120}>Every 2 Hours</option>
                <option value={240}>Every 4 Hours</option>
                <option value={480}>Every 8 Hours</option>
                <option value={720}>Every 12 Hours</option>
                <option value={1440}>Every Day (24 Hours)</option>
                <option value={2880}>Every 2 Days</option>
                <option value={4320}>Every 3 Days</option>
                <option value={10080}>Every Week (7 Days)</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', width: '100%', background: 'var(--accent-primary)', marginTop: '8px' }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving Campaign...
                </>
              ) : (
                <>
                  <Clock size={16} /> Schedule Campaign
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: ACTIVE LIST */}
        <div className="glass-card" style={{ padding: '24px', border: '1px solid var(--border-primary)', minHeight: '400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--accent-primary-light)" />
              Active Campaigns
            </h3>
            <button className="btn-ghost" style={{ padding: '6px' }} onClick={fetchPosts} title="Refresh list">
              <RotateCw size={14} />
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '10px' }}>
              <Loader2 size={24} className="animate-spin" color="var(--accent-primary)" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fetching schedules...</span>
            </div>
          ) : posts.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', border: '1px dashed var(--border-primary)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)' }}>
              <AlertCircle size={28} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>No Recurring Campaigns</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>Create a schedule in the left form to automate your reposts!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {posts.map((post) => (
                <div key={post.id} className="glass-card" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                  
                  {/* Campaign Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{post.title}</h4>
                      <div style={{ fontSize: '11px', color: 'var(--accent-primary-light)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} /> {formatInterval(post.intervalMin)}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Toggle Active status */}
                      <button
                        className="btn-ghost"
                        style={{ padding: '6px', color: post.isActive ? 'var(--accent-emerald)' : 'var(--text-muted)' }}
                        onClick={() => handleToggleActive(post.id, post.isActive)}
                        disabled={actionLoading === post.id}
                        title={post.isActive ? "Pause Campaign" : "Resume Campaign"}
                      >
                        {post.isActive ? <CheckCircle size={16} /> : <Pause size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Message Snippet */}
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '8px 0', lineHeight: 1.4 }}>
                    {post.content}
                  </p>

                  {/* Links / Metadata */}
                  {(post.link || post.imageUrl) && (
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                      {post.link && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}><LinkIcon size={10} /> {post.link}</span>}
                      {post.imageUrl && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ImageIcon size={10} /> Has Photo</span>}
                    </div>
                  )}

                  {/* Actions & Last Run Timestamp */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', marginTop: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Last run: {post.lastPostedAt ? new Date(post.lastPostedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Trigger manually */}
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)' }}
                        onClick={() => handleTriggerNow(post.id)}
                        disabled={actionLoading === post.id}
                      >
                        <Send size={11} /> Post Now
                      </button>
                      
                      {/* Delete */}
                      <button
                        className="btn-ghost"
                        style={{ padding: '6px', color: 'var(--accent-rose)' }}
                        onClick={() => handleDelete(post.id)}
                        disabled={actionLoading === post.id}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
