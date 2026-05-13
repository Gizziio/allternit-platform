"use client";
import { useIsClient } from '@/lib/hooks/use-is-client';
import React, { useState, useEffect, useRef } from 'react';
import { useDesignSessionStore, useDesignSessionActions } from './DesignSessionStore';

// ── Brand SVG icons ───────────────────────────────────────────────────────────

function IconX({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function IconLinkedIn({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconInstagram({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function IconTikTok({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function IconYouTube({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function IconThreads({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-.505-1.865-1.38-3.267-2.599-4.168-1.298-.962-3.013-1.47-5.095-1.493-2.547.023-4.529.833-5.895 2.408-1.343 1.545-2.046 3.85-2.07 6.852.024 3.003.727 5.308 2.07 6.853 1.366 1.575 3.348 2.385 5.895 2.408 1.983-.02 3.611-.568 4.953-1.675 1.525-1.257 2.29-3.063 2.372-5.385H12.19v-2.045h9.385v.002c-.065 2.937-.875 5.3-2.41 7.024-1.745 1.97-4.34 2.986-7.574 3H12.186z" />
    </svg>
  );
}

function IconNewsletter({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconBluesky({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.3-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z" />
    </svg>
  );
}

// ── Platform definitions ───────────────────────────────────────────────────────

interface Platform {
  id: string;
  label: string;
  handle: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  charLimit: number;
  formats: string[];
  imageSpec: string;
  freq: string;
  contentType: string;
}

const PLATFORMS: Platform[] = [
  {
    id: 'twitter', label: 'X / Twitter', handle: '@yourhandle', color: '#000000', bg: '#000000',
    icon: <IconX size={15} />, charLimit: 280,
    formats: ['Text', 'Image', 'Video', 'Thread'],
    imageSpec: '1600×900 (16:9) or 1200×1200',
    freq: '5×/week', contentType: 'Short-form text + media',
  },
  {
    id: 'linkedin', label: 'LinkedIn', handle: 'your-company', color: '#0a66c2', bg: '#0a66c2',
    icon: <IconLinkedIn size={15} />, charLimit: 3000,
    formats: ['Article', 'Post', 'Carousel', 'Video'],
    imageSpec: '1200×627 (1.91:1) or 1080×1080',
    freq: '3×/week', contentType: 'Professional insights',
  },
  {
    id: 'instagram', label: 'Instagram', handle: '@yourhandle', color: '#e1306c', bg: 'linear-gradient(45deg,#833ab4,#fd1d1d,#fcb045)',
    icon: <IconInstagram size={15} />, charLimit: 2200,
    formats: ['Feed Post', 'Reel', 'Story', 'Carousel'],
    imageSpec: '1080×1350 (4:5 feed) or 1080×1920 (story)',
    freq: '4×/week', contentType: 'Visual-first content',
  },
  {
    id: 'tiktok', label: 'TikTok', handle: '@yourhandle', color: '#010101', bg: '#010101',
    icon: <IconTikTok size={15} />, charLimit: 4000,
    formats: ['Video', 'Photo Carousel', 'Live'],
    imageSpec: '1080×1920 (9:16 video)',
    freq: '5×/week', contentType: 'Short video content',
  },
  {
    id: 'youtube', label: 'YouTube', handle: '@yourchannel', color: '#ff0000', bg: '#ff0000',
    icon: <IconYouTube size={15} />, charLimit: 5000,
    formats: ['Video', 'Short', 'Community Post'],
    imageSpec: '1280×720 thumbnail, 1920×1080 video',
    freq: '2×/week', contentType: 'Long-form video',
  },
  {
    id: 'threads', label: 'Threads', handle: '@yourhandle', color: '#000000', bg: '#000000',
    icon: <IconThreads size={15} />, charLimit: 500,
    formats: ['Text', 'Image', 'Video'],
    imageSpec: '1080×1080 or 1080×1350',
    freq: '3×/week', contentType: 'Conversational posts',
  },
  {
    id: 'bluesky', label: 'Bluesky', handle: '@you.bsky.social', color: '#0085ff', bg: '#0085ff',
    icon: <IconBluesky size={15} />, charLimit: 300,
    formats: ['Text', 'Image', 'Video'],
    imageSpec: '2000×2000 max',
    freq: '3×/week', contentType: 'Decentralized social',
  },
  {
    id: 'newsletter', label: 'Newsletter', handle: 'your@email.com', color: '#f59e0b', bg: '#f59e0b',
    icon: <IconNewsletter size={15} />, charLimit: 100000,
    formats: ['HTML Email', 'Plain Text'],
    imageSpec: '600px max width',
    freq: '1×/week', contentType: 'Long-form newsletter',
  },
];

// Small (11px) icon map avoids React.cloneElement type casts on ReactNode
const PLATFORM_ICON_SM: Record<string, React.ReactNode> = {
  twitter: <IconX size={11} />, linkedin: <IconLinkedIn size={11} />,
  instagram: <IconInstagram size={11} />, tiktok: <IconTikTok size={11} />,
  youtube: <IconYouTube size={11} />, threads: <IconThreads size={11} />,
  bluesky: <IconBluesky size={11} />, newsletter: <IconNewsletter size={11} />,
};

// ── Types ─────────────────────────────────────────────────────────────────────

type PostStatus = 'idle' | 'generating' | 'draft' | 'scheduled' | 'published';

interface PostState {
  content: string;
  status: PostStatus;
  scheduledDay: number | null; // 0-6 (day offset from today)
  scheduledTime: string;
}

// ── Platform-native preview cards ────────────────────────────────────────────

function TwitterPreview({ content, handle }: { content: string; handle: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e7e7e7', padding: '16px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <IconX size={18} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f1419' }}>Your Brand</div>
          <div style={{ fontSize: 13, color: '#536471' }}>{handle}</div>
        </div>
      </div>
      <div style={{ fontSize: 15, color: '#0f1419', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 40 }}>
        {content || <span style={{ color: '#9ca3af' }}>Your post will appear here…</span>}
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #eff3f4', display: 'flex', gap: 20 }}>
        {['💬 Reply', '🔁 Repost', '❤️ Like', '📊 View'].map(a => (
          <span key={a} style={{ fontSize: 13, color: '#536471', cursor: 'default' }}>{a}</span>
        ))}
      </div>
    </div>
  );
}

function LinkedInPreview({ content, handle }: { content: string; handle: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 10 }}>
        <div style={{ width: 48, height: 48, borderRadius: 8, background: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
          <IconLinkedIn size={20} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#000' }}>Your Brand</div>
          <div style={{ fontSize: 12, color: '#666' }}>Company · {handle}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Just now · 🌍</div>
        </div>
      </div>
      <div style={{ padding: '0 16px 12px', fontSize: 14, color: '#000', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 40 }}>
        {content || <span style={{ color: '#9ca3af' }}>Your post will appear here…</span>}
      </div>
      <div style={{ padding: '8px 16px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: 16 }}>
        {['👍 Like', '💬 Comment', '↗️ Share'].map(a => (
          <span key={a} style={{ fontSize: 13, color: '#666', cursor: 'default' }}>{a}</span>
        ))}
      </div>
    </div>
  );
}

function InstagramPreview({ content, handle }: { content: string; handle: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #dbdbdb', overflow: 'hidden', fontFamily: 'var(--font-sans)' }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(45deg,#833ab4,#fd1d1d,#fcb045)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
          <IconInstagram size={14} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#000' }}>{handle}</span>
        <span style={{ marginLeft: 'auto', fontSize: 18, color: '#000' }}>⋯</span>
      </div>
      <div style={{ background: '#f0f0f0', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 12 }}>
        📷 Image / Reel preview
      </div>
      <div style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
          {['❤️', '💬', '📤', '🔖'].map((i, idx) => (
            <span key={idx} style={{ fontSize: 20, cursor: 'default' }}>{i}</span>
          ))}
        </div>
        <div style={{ fontSize: 13, color: '#000', lineHeight: 1.5 }}>
          <strong>{handle}</strong>{' '}
          <span style={{ whiteSpace: 'pre-wrap' }}>{content || <span style={{ color: '#9ca3af' }}>Your caption here…</span>}</span>
        </div>
      </div>
    </div>
  );
}

function GenericPreview({ content, platform }: { content: string; platform: Platform }) {
  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-subtle)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: platform.color + '20', color: platform.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {platform.icon}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{platform.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{platform.handle}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', minHeight: 40 }}>
        {content || <span style={{ color: 'var(--text-tertiary)' }}>Post content will appear here…</span>}
      </div>
    </div>
  );
}

// ── Week calendar mini ────────────────────────────────────────────────────────

function WeekCalendar({ posts }: { posts: Record<string, PostState> }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date().getDay(); // 0=Sun

  // Count posts per day offset
  const byDay: Record<number, { platform: Platform; status: PostStatus }[]> = {};
  for (const [pid, state] of Object.entries(posts)) {
    if (state.scheduledDay !== null) {
      if (!byDay[state.scheduledDay]) byDay[state.scheduledDay] = [];
      const plat = PLATFORMS.find(p => p.id === pid);
      if (plat) byDay[state.scheduledDay].push({ platform: plat, status: state.status });
    }
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>This Week</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days.map((d, i) => {
          const dayItems = byDay[i] ?? [];
          const isToday = (today === 0 ? 6 : today - 1) === i;
          return (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? 'var(--accent-primary)' : 'var(--text-tertiary)', marginBottom: 2 }}>{d}</div>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: isToday ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' : 'var(--bg-secondary)', border: `1px solid ${isToday ? 'var(--accent-primary)' : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: isToday ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                {dayItems.length > 0 ? dayItems.length : ''}
              </div>
              {dayItems.slice(0, 3).map((item, j) => (
                <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: item.platform.color === '#000000' || item.platform.color === '#010101' ? 'var(--text-secondary)' : item.platform.color }} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContentPipelineView({ projectName = '' }: { projectName?: string }) {
  const activeSessionId = useDesignSessionStore(s => s.activeSessionId);
  const sessions = useDesignSessionStore(s => s.sessions);
  const { sendMessageStream } = useDesignSessionActions();

  const [selected, setSelected] = useState<string | null>('twitter');
  const [posts, setPosts] = useState<Record<string, PostState>>(() =>
    Object.fromEntries(PLATFORMS.map(p => [p.id, { content: '', status: 'idle' as PostStatus, scheduledDay: null, scheduledTime: '09:00' }]))
  );
  const [activePreviewTab, setActivePreviewTab] = useState<'editor' | 'preview'>('editor');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const platform = PLATFORMS.find(p => p.id === selected) ?? PLATFORMS[0];
  const post = posts[platform.id];
  const charCount = post.content.length;
  const charPct = Math.min(charCount / platform.charLimit, 1);
  const charOver = charCount > platform.charLimit;

  // After generation completes, pull the last assistant message as content
  useEffect(() => {
    if (post.status !== 'generating') return;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    const lastAsst = [...session.messages].reverse().find(m => m.role === 'assistant');
    if (lastAsst && typeof lastAsst.content === 'string' && lastAsst.content.length > 10) {
      const extracted = extractPostContent(lastAsst.content, platform.charLimit);
      setPosts(prev => ({ ...prev, [platform.id]: { ...prev[platform.id], content: extracted, status: 'draft' } }));
    }
  }, [sessions, post.status, activeSessionId, platform]);

  function extractPostContent(raw: string, limit: number): string {
    // Strip markdown headers, code blocks, and trim to char limit
    const cleaned = raw
      .replace(/^#+\s+.*/gm, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .trim();
    return cleaned.slice(0, limit);
  }

  async function generate() {
    if (!activeSessionId) return;
    setPosts(prev => ({ ...prev, [platform.id]: { ...prev[platform.id], status: 'generating' } }));
    await sendMessageStream(activeSessionId, {
      text: `[Content Pipeline] Write a ${platform.label} post for the project "${projectName || 'this project'}". Platform: ${platform.label}. Content type: ${platform.contentType}. Character limit: ${platform.charLimit}. Format guidelines: ${platform.formats.join(', ')}. Write ONLY the post content, no preamble or explanations.`,
    });
    // status update handled by the useEffect above watching sessions
  }

  function schedulePost(day: number) {
    setPosts(prev => ({ ...prev, [platform.id]: { ...prev[platform.id], scheduledDay: day, status: 'scheduled' } }));
  }

  function publishPost() {
    setPosts(prev => ({ ...prev, [platform.id]: { ...prev[platform.id], status: 'published' } }));
  }

  const counts = {
    idle: Object.values(posts).filter(p => p.status === 'idle').length,
    draft: Object.values(posts).filter(p => p.status === 'draft').length,
    scheduled: Object.values(posts).filter(p => p.status === 'scheduled').length,
    published: Object.values(posts).filter(p => p.status === 'published').length,
    generating: Object.values(posts).filter(p => p.status === 'generating').length,
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* ── Left: platform sidebar ── */}
      <div style={{ width: 220, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Content Pipeline</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{projectName || 'All platforms'}</div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '10px 10px 8px' }}>
          {([
            ['draft', counts.draft, '#f59e0b'],
            ['scheduled', counts.scheduled, '#6366f1'],
            ['published', counts.published, '#22c55e'],
            ['generating', counts.generating, 'var(--accent-primary)'],
          ] as const).map(([key, count, color]) => (
            <div key={key} style={{ padding: '6px 8px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{key}</div>
            </div>
          ))}
        </div>

        {/* Platform list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {PLATFORMS.map(p => {
            const pPost = posts[p.id];
            const isActive = selected === p.id;
            const statusColor = pPost.status === 'published' ? '#22c55e' : pPost.status === 'scheduled' ? '#6366f1' : pPost.status === 'draft' ? '#f59e0b' : pPost.status === 'generating' ? 'var(--accent-primary)' : 'var(--border-default)';
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 8px',
                  borderRadius: 9, border: `1px solid ${isActive ? 'var(--accent-primary)' : 'transparent'}`,
                  background: isActive ? 'color-mix(in srgb, var(--accent-primary) 6%, transparent)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', marginBottom: 2, transition: 'all 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: (p.color === '#000000' || p.color === '#010101') ? '#18181b' : p.color + '18',
                  color: (p.color === '#000000' || p.color === '#010101') ? '#fff' : p.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {p.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>{p.freq}</div>
                </div>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Center: content editor ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Platform header */}
        <div style={{ height: 52, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', flexShrink: 0, background: 'var(--bg-secondary)' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: (platform.color === '#000000' || platform.color === '#010101') ? '#18181b' : platform.color + '18',
            color: (platform.color === '#000000' || platform.color === '#010101') ? '#fff' : platform.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {platform.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{platform.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{platform.contentType} · {platform.charLimit.toLocaleString()} char limit · {platform.imageSpec}</div>
          </div>
          {/* Format pills */}
          <div style={{ display: 'flex', gap: 4 }}>
            {platform.formats.map(f => (
              <span key={f} style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--bg-tertiary, var(--bg-primary))', border: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{f}</span>
            ))}
          </div>
          {/* Editor / Preview toggle */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            {(['editor', 'preview'] as const).map(t => (
              <button key={t} onClick={() => setActivePreviewTab(t)}
                style={{ padding: '5px 12px', border: 'none', background: activePreviewTab === t ? 'var(--accent-primary)' : 'transparent', color: activePreviewTab === t ? '#fff' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Editor / Preview body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {activePreviewTab === 'editor' ? (
            <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Textarea */}
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={textareaRef}
                  value={post.content}
                  onChange={e => setPosts(prev => ({ ...prev, [platform.id]: { ...prev[platform.id], content: e.target.value, status: prev[platform.id].status === 'idle' ? 'draft' : prev[platform.id].status } }))}
                  placeholder={`Write your ${platform.label} post here…\n\nTip: Click "Generate with AI" to let the agent draft this for you based on your project.`}
                  style={{
                    width: '100%', boxSizing: 'border-box', minHeight: 160, maxHeight: 320,
                    padding: '14px', borderRadius: 10, border: `1px solid ${charOver ? '#ef4444' : 'var(--border-default)'}`,
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6,
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  }}
                  disabled={post.status === 'generating'}
                />
                {/* Char counter ring */}
                <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width={24} height={24} style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx={12} cy={12} r={9} fill="none" stroke="var(--border-subtle)" strokeWidth={2.5} />
                    <circle cx={12} cy={12} r={9} fill="none"
                      stroke={charOver ? '#ef4444' : charPct > 0.8 ? '#f59e0b' : 'var(--accent-primary)'}
                      strokeWidth={2.5}
                      strokeDasharray={`${2 * Math.PI * 9}`}
                      strokeDashoffset={`${2 * Math.PI * 9 * (1 - Math.min(charPct, 1))}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: charOver ? '#ef4444' : 'var(--text-tertiary)' }}>
                    {charOver ? `-${charCount - platform.charLimit}` : platform.charLimit - charCount}
                  </span>
                </div>
              </div>

              {/* Action bar */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={generate}
                  disabled={!activeSessionId || post.status === 'generating'}
                  style={{
                    flex: 1, padding: '9px 14px', borderRadius: 9, border: 'none',
                    background: post.status === 'generating' ? 'var(--bg-tertiary, var(--bg-secondary))' : 'var(--accent-primary)',
                    color: post.status === 'generating' ? 'var(--text-tertiary)' : '#fff',
                    fontSize: 12, fontWeight: 700, cursor: post.status === 'generating' ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {post.status === 'generating' ? (
                    <>
                      <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--text-tertiary)', borderTopColor: 'var(--accent-primary)', animation: 'spin 0.8s linear infinite' }} />
                      Generating…
                    </>
                  ) : '✦ Generate with AI'}
                </button>
                {post.status === 'draft' && (
                  <button
                    onClick={() => schedulePost(Math.floor(Math.random() * 5))}
                    style={{ padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    📅 Schedule
                  </button>
                )}
                {(post.status === 'draft' || post.status === 'scheduled') && (
                  <button
                    onClick={publishPost}
                    style={{ padding: '9px 14px', borderRadius: 9, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    ↗ Publish
                  </button>
                )}
              </div>

              {/* Status chip */}
              {post.status !== 'idle' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: post.status === 'published' ? '#22c55e' : post.status === 'scheduled' ? '#6366f1' : post.status === 'generating' ? 'var(--accent-primary)' : '#f59e0b',
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {post.status === 'scheduled' ? `Scheduled · Day ${(post.scheduledDay ?? 0) + 1} at ${post.scheduledTime}` : post.status}
                  </span>
                </div>
              )}

              {/* Format spec reminder */}
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Format Spec</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Image:</strong> {platform.imageSpec}<br />
                  <strong>Formats:</strong> {platform.formats.join(', ')}<br />
                  <strong>Frequency:</strong> {platform.freq}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Platform Preview</div>
              {platform.id === 'twitter' && <TwitterPreview content={post.content} handle={platform.handle} />}
              {platform.id === 'linkedin' && <LinkedInPreview content={post.content} handle={platform.handle} />}
              {platform.id === 'instagram' && <InstagramPreview content={post.content} handle={platform.handle} />}
              {!['twitter', 'linkedin', 'instagram'].includes(platform.id) && (
                <GenericPreview content={post.content} platform={platform} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: calendar + queue ── */}
      <div style={{ width: 240, borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', flexShrink: 0, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Queue</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <WeekCalendar posts={posts} />

          {/* Scheduled posts */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Scheduled</div>
            {PLATFORMS.filter(p => posts[p.id].status === 'scheduled').length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>No posts scheduled yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PLATFORMS.filter(p => posts[p.id].status === 'scheduled').map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: (p.color === '#000000' || p.color === '#010101') ? '#18181b' : p.color + '20', color: (p.color === '#000000' || p.color === '#010101') ? '#fff' : p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {PLATFORM_ICON_SM[p.id]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Day {(posts[p.id].scheduledDay ?? 0) + 1} · {posts[p.id].scheduledTime}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Published */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Published</div>
            {PLATFORMS.filter(p => posts[p.id].status === 'published').length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '8px 0' }}>Nothing published yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PLATFORMS.filter(p => posts[p.id].status === 'published').map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'color-mix(in srgb, #22c55e 6%, transparent)', border: '1px solid color-mix(in srgb, #22c55e 20%, transparent)' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: (p.color === '#000000' || p.color === '#010101') ? '#18181b' : p.color + '20', color: (p.color === '#000000' || p.color === '#010101') ? '#fff' : p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {PLATFORM_ICON_SM[p.id]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>✓ Published</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generate all drafts */}
          {activeSessionId && (
            <button
              onClick={async () => {
                for (const p of PLATFORMS.filter(pl => posts[pl.id].status === 'idle')) {
                  setSelected(p.id);
                  setPosts(prev => ({ ...prev, [p.id]: { ...prev[p.id], status: 'generating' } }));
                  await sendMessageStream(activeSessionId, {
                    text: `[Content Pipeline] Write a ${p.label} post for "${projectName}". Content type: ${p.contentType}. Char limit: ${p.charLimit}. Write ONLY the post text.`,
                  });
                  setPosts(prev => ({ ...prev, [p.id]: { ...prev[p.id], status: 'draft' } }));
                }
              }}
              style={{ width: '100%', padding: '10px', borderRadius: 9, border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              ✦ Generate All Drafts
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
