'use client';

import React, { useState, useEffect } from 'react';
import { Zap, ExternalLink, MessageSquare, ArrowUpCircle } from 'lucide-react';

interface LiveItem {
  id: string;
  title: string;
  url: string;
  author: string;
  score?: number;
  commentCount?: number;
  source: 'hackernews' | 'reddit' | 'arxiv' | 'twitter' | 'bookmark';
  publishedAt: string;
  excerpt?: string;
}

// Allternit Design Tokens
const ACCENT = 'var(--accent-primary)';
const BG_SECONDARY = 'var(--surface-panel)';
const BG_TERTIARY = 'var(--surface-hover)';
const TEXT_PRIMARY = 'var(--ui-text-primary)';
const TEXT_SECONDARY = 'var(--ui-text-secondary)';
const TEXT_MUTED = 'var(--ui-text-muted)';
const BORDER_SUBTLE = 'rgba(212, 176, 140, 0.10)';
const BORDER_DEFAULT = 'rgba(212, 176, 140, 0.16)';
const STATUS_SUCCESS = 'var(--status-success)';
const STATUS_WARNING = 'var(--status-warning)';
const STATUS_INFO = 'var(--status-info)';

const SOURCE_COLORS: Record<string, string> = {
  hackernews: STATUS_WARNING,
  reddit: '#D97757',
  arxiv: STATUS_INFO,
  twitter: '#1DA1F2',
  bookmark: ACCENT,
};

const SOURCE_LABELS: Record<string, string> = {
  hackernews: 'Hacker News',
  reddit: 'Reddit r/MachineLearning',
  arxiv: 'arXiv cs.AI',
  twitter: 'X / Twitter',
  bookmark: 'Curated',
};

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function LiveFeed() {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hn, reddit, arxiv] = await Promise.all([
        fetchHN(),
        fetchReddit(),
        fetchArxiv(),
      ]);
      // Note: LiveFeed doesn't fetch Twitter to avoid rate limits on client-side
      const all = [...hn, ...reddit, ...arxiv].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
      setItems(all.slice(0, 30));
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  if (loading && items.length === 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 300, gap: 12, color: TEXT_MUTED,
      }}>
        <Zap size={20} color={ACCENT} style={{ animation: 'pulse 1.5s infinite' }} />
        <span style={{ fontSize: 14 }}>Connecting to live sources...</span>
        <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }`}</style>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: 300, gap: 12,
      }}>
        <p style={{ fontSize: 14, color: 'var(--status-error)', margin: 0 }}>{error}</p>
        <button onClick={fetchAll} style={{
          padding: '8px 16px', background: 'rgba(212,176,140,0.08)', border: `1px solid var(--ui-border-default)`,
          borderRadius: 'var(--radius-md, 12px)', color: ACCENT, fontSize: 13, cursor: 'pointer',
          transition: 'all 200ms ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-primary) 12%, transparent)';
          e.currentTarget.style.borderColor = 'rgba(212,176,140,0.3)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(212,176,140,0.08)';
          e.currentTarget.style.borderColor = 'var(--ui-border-default)';
        }}
        >Retry</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 4px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} color={ACCENT} />
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>
            Live Feed
          </span>
          <span style={{
            fontSize: 11, color: STATUS_SUCCESS, background: 'rgba(74,222,128,0.08)',
            padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(74,222,128,0.12)',
          }}>
            {items.length} items
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: 12, color: TEXT_MUTED }}>
              Updated {timeAgo(lastUpdated.toISOString())}
            </span>
          )}
          <button onClick={fetchAll} style={{
            padding: '6px 12px', background: 'rgba(212,176,140,0.06)', border: `1px solid color-mix(in srgb, var(--accent-primary) 12%, transparent)`,
            borderRadius: 'var(--radius-md, 12px)', color: ACCENT, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 200ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-primary) 10%, transparent)';
            e.currentTarget.style.borderColor = 'var(--ui-border-default)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(212,176,140,0.06)';
            e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-primary) 12%, transparent)';
          }}
          >
            <Zap size={12} />
            Refresh
          </button>
        </div>
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '16px 20px',
              background: BG_SECONDARY,
              border: `1px solid ${BORDER_SUBTLE}`,
              borderRadius: 'var(--radius-lg, 16px)',
              textDecoration: 'none',
              transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = BORDER_DEFAULT;
              (e.currentTarget as HTMLElement).style.background = BG_TERTIARY;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = BORDER_SUBTLE;
              (e.currentTarget as HTMLElement).style.background = BG_SECONDARY;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                color: SOURCE_COLORS[item.source], background: `${SOURCE_COLORS[item.source]}15`,
                padding: '3px 8px', borderRadius: 4,
              }}>
                {SOURCE_LABELS[item.source]}
              </span>
              <ExternalLink size={12} color={TEXT_MUTED} />
            </div>

            <h4 style={{
              fontSize: 14, fontWeight: 600, margin: '0 0 6px',
              color: TEXT_PRIMARY, lineHeight: 1.4,
            }}>
              {item.title}
            </h4>

            {item.excerpt && (
              <p style={{
                fontSize: 12, lineHeight: 1.5, color: TEXT_MUTED,
                margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {item.excerpt}
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: TEXT_MUTED }}>
              <span>{item.author}</span>
              {item.score !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowUpCircle size={11} />
                  {item.score}
                </span>
              )}
              {item.commentCount !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MessageSquare size={11} />
                  {item.commentCount}
                </span>
              )}
              <span>{timeAgo(item.publishedAt)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Source Fetchers ────────────────────────────────────────────────────────

async function fetchHN(): Promise<LiveItem[]> {
  try {
    const r = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = (await r.json()).slice(0, 10);
    const items = await Promise.all(
      ids.map(async (id: number) => {
        const r2 = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return r2.json();
      }),
    );
    return items
      .filter((i: any) => i && !i.deleted && !i.dead && i.title)
      .map((i: any) => ({
        id: `hn-${i.id}`,
        title: i.title,
        url: i.url || `https://news.ycombinator.com/item?id=${i.id}`,
        author: i.by || 'unknown',
        score: i.score || 0,
        commentCount: i.descendants || 0,
        source: 'hackernews' as const,
        publishedAt: new Date(i.time * 1000).toISOString(),
      }));
  } catch {
    return [];
  }
}

async function fetchReddit(): Promise<LiveItem[]> {
  try {
    const r = await fetch('https://www.reddit.com/r/MachineLearning/hot/.rss?limit=10', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    return entries
      .map((entry, idx) => {
        const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = entry.match(/<link href="([^"]+)"/);
        const authorMatch = entry.match(/<name>([\s\S]*?)<\/name>/);
        const updatedMatch = entry.match(/<updated>([\s\S]*?)<\/updated>/);
        return {
          id: `reddit-${idx}`,
          title: titleMatch ? titleMatch[1].trim().replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&') : '',
          url: linkMatch ? linkMatch[1] : '',
          author: authorMatch ? authorMatch[1] : '',
          source: 'reddit' as const,
          publishedAt: updatedMatch ? updatedMatch[1] : new Date().toISOString(),
        };
      })
      .filter(i => i.title && i.url);
  } catch {
    return [];
  }
}

async function fetchArxiv(): Promise<LiveItem[]> {
  try {
    const url =
      'http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=10';
    const r = await fetch(url);
    const xml = await r.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    return entries
      .map((entry, idx) => {
        const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
        const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
        const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
        const authorMatches = entry.match(/<name>([\s\S]*?)<\/name>/g);
        const publishedMatch = entry.match(/<published>([\s\S]*?)<\/published>/);
        const authors = authorMatches
          ? authorMatches.map((m: string) => m.replace(/<\/?name>/g, ''))
          : [];
        return {
          id: `arxiv-${idx}`,
          title: titleMatch ? titleMatch[1].trim().replace('\n', ' ') : '',
          url: idMatch ? idMatch[1].trim() : '',
          author: authors[0] || 'Unknown',
          source: 'arxiv' as const,
          publishedAt: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
          excerpt: summaryMatch ? summaryMatch[1].trim().slice(0, 200) + '...' : undefined,
        };
      })
      .filter(i => i.title && i.url);
  } catch {
    return [];
  }
}
