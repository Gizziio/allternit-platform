'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  BookOpen,
  Newspaper,
  Image as ImageIcon,
  FileText,
  ArrowRight,
  Clock,
  Loader2,
  X,
  Zap,
} from 'lucide-react';
import { useDiscoveryFeed } from './hooks/useDiscoveryFeed';
import { type DiscoveryItem } from './hooks/usePublicationMapper';
import { GenerativeCover } from './components/GenerativeCover';
import { LiveFeed } from './components/LiveFeed';
import type { Publication } from '@/types/publication';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openInBrowser } from '@/lib/openInBrowser';

const ROTATION_INTERVAL = 8000;

// ─── Allternit Design Tokens (inline fallbacks) ─────────────────────────────
const ACCENT = 'var(--accent-primary)';
const ACCENT_SOFT = 'color-mix(in srgb, var(--accent-primary) 15%, transparent)';
const ACCENT_GLOW = 'color-mix(in srgb, var(--accent-primary) 25%, transparent)';
const BG_PRIMARY = 'var(--surface-canvas)';
const BG_SECONDARY = 'var(--surface-panel)';
const BG_TERTIARY = 'var(--surface-active)';
const TEXT_PRIMARY = 'var(--ui-text-primary)';
const TEXT_SECONDARY = 'var(--ui-text-secondary)';
const TEXT_MUTED = 'var(--ui-text-muted)';
const BORDER_SUBTLE = 'var(--ui-border-muted)';
const BORDER_DEFAULT = 'var(--ui-border-default)';
const BORDER_STRONG = 'var(--ui-border-strong)';
const GLASS_BG = 'var(--surface-floating)';
const GLASS_BORDER = 'var(--ui-border-default)';
const STATUS_SUCCESS = 'var(--status-success)';
const STATUS_WARNING = 'var(--status-warning)';
const STATUS_ERROR = 'var(--status-error)';
const STATUS_INFO = 'var(--status-info)';

function TypeIcon({ type, color }: { type: DiscoveryItem['type']; color: string }) {
  if (type === 'video') return <Play size={14} color={color} />;
  if (type === 'article') return <FileText size={14} color={color} />;
  if (type === 'gallery') return <ImageIcon size={14} color={color} />;
  if (type === 'publication') return <Newspaper size={14} color={color} />;
  return <BookOpen size={14} color={color} />;
}

function LoadingState() {
  return (
    <div style={{
      height: 420,
      borderRadius: 'var(--radius-lg, 16px)',
      background: BG_SECONDARY,
      border: `1px solid ${BORDER_SUBTLE}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}>
      <Loader2 size={24} color={ACCENT} style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>
        Research pipeline connecting...
      </p>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{
      height: 420,
      borderRadius: 'var(--radius-lg, 16px)',
      background: BG_SECONDARY,
      border: `1px solid ${BORDER_SUBTLE}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}>
      <p style={{ fontSize: 14, color: STATUS_ERROR, margin: 0 }}>Research pipeline connecting...</p>
      <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0 }}>{message}</p>
    </div>
  );
}

interface BriefingData {
  id: string;
  title: string;
  subtitle: string;
  abstract: string;
  content: {
    body: string;
    sources: {
      source: string;
      title: string;
      url: string;
      engagement?: { score?: number; commentCount?: number; stars?: number; forks?: number };
      relevanceScore?: number;
    }[];
  };
  reading_time: number;
  source_count: number;
  created_at: string;
  issueNumber?: string;
  tags?: string[];
}

function publicationToBriefingData(pub: Publication): BriefingData {
  return {
    id: pub.id,
    title: pub.title,
    subtitle: pub.subtitle || 'Allternit Signal',
    abstract: pub.abstract,
    content: {
      body: pub.content?.markdown || '',
      sources: pub.content?.sources || [],
    },
    reading_time: pub.readingTime,
    source_count: pub.content?.sources?.length || 0,
    created_at: pub.publishedAt || pub.createdAt,
    issueNumber: pub.issueNumber,
    tags: pub.tags,
  };
}

function BriefingReader({ briefing, onClose }: { briefing: BriefingData; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={onClose}>
      <div style={{
        background: GLASS_BG,
        border: `1px solid ${GLASS_BORDER}`,
        borderRadius: 'var(--radius-xl, 20px)',
        maxWidth: 760, width: '100%', maxHeight: '85vh',
        overflow: 'auto', padding: 32,
        boxShadow: '0 16px 48px var(--shell-overlay-backdrop)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                color: STATUS_SUCCESS, background: 'var(--status-success-bg)', padding: '4px 10px', borderRadius: 4,
                border: '1px solid var(--status-success-bg)',
              }}>Daily Brief</span>
              {briefing.issueNumber && (
                <span style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
                  color: TEXT_MUTED, background: 'var(--surface-hover)', padding: '4px 10px', borderRadius: 4,
                  border: `1px solid ${BORDER_SUBTLE}`,
                }}>{briefing.issueNumber}</span>
              )}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '12px 0 4px', color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}>
              {briefing.title}
            </h2>
            <p style={{ fontSize: 13, color: ACCENT, margin: 0, fontWeight: 500 }}>{briefing.subtitle}</p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: TEXT_MUTED,
            cursor: 'pointer', padding: 4,
            transition: 'color 150ms ease',
          }} onMouseEnter={e => (e.currentTarget.style.color = TEXT_SECONDARY)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_MUTED)}>
            <X size={20} />
          </button>
        </div>

        {/* Abstract */}
        <p style={{
          fontSize: 14, lineHeight: 1.6, color: TEXT_SECONDARY, marginBottom: 12,
          padding: '12px 16px', background: 'color-mix(in srgb, var(--accent-primary) 5%, transparent)', borderRadius: 8,
          borderLeft: `3px solid ${ACCENT}`,
        }}>
          {briefing.abstract}
        </p>

        {/* Tags */}
        {briefing.tags && briefing.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
            {briefing.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
                color: ACCENT, background: 'color-mix(in srgb, var(--accent-primary) 6%, transparent)', padding: '3px 10px', borderRadius: 4,
                border: `1px solid color-mix(in srgb, var(--accent-primary) 12%, transparent)`,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Markdown Content */}
        <div className="allternit-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2 style={{
                  fontSize: 18, fontWeight: 600, margin: '28px 0 12px',
                  color: ACCENT, letterSpacing: '-0.01em',
                  borderBottom: `1px solid ${BORDER_SUBTLE}`, paddingBottom: 8,
                }}>{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: '20px 0 8px', color: 'rgba(212,176,140,0.8)' }}>{children}</h3>
              ),
              p: ({ children }) => (
                <p style={{ fontSize: 14, lineHeight: 1.7, color: TEXT_PRIMARY, margin: '8px 0' }}>{children}</p>
              ),
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 500 }}>{children}</a>
              ),
              strong: ({ children }) => (
                <strong style={{ color: 'var(--ui-text-primary)', fontWeight: 600 }}>{children}</strong>
              ),
              em: ({ children }) => (
                <em style={{ color: TEXT_SECONDARY }}>{children}</em>
              ),
              ul: ({ children }) => (
                <ul style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ul>
              ),
              li: ({ children }) => (
                <li style={{ fontSize: 14, lineHeight: 1.7, color: TEXT_PRIMARY, margin: '4px 0' }}>{children}</li>
              ),
              code: ({ children }) => (
                <code style={{
                  fontSize: 13, background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)', padding: '2px 6px', borderRadius: 4,
                  color: 'rgba(212,176,140,0.9)', border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                }}>{children}</code>
              ),
              hr: () => (
                <hr style={{ border: 'none', borderTop: `1px solid ${BORDER_SUBTLE}`, margin: '24px 0' }} />
              ),
            }}
          >
            {briefing.content.body}
          </ReactMarkdown>
        </div>

        {/* Source Provenance */}
        {briefing.content.sources && briefing.content.sources.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${BORDER_SUBTLE}` }}>
            <p style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: TEXT_MUTED, margin: '0 0 10px',
            }}>
              Sources
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {briefing.content.sources.slice(0, 8).map((src, idx) => (
                <a
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 12, color: TEXT_SECONDARY,
                    textDecoration: 'none', padding: '6px 10px', borderRadius: 6,
                    background: 'var(--surface-hover)',
                    border: `1px solid transparent`,
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--ui-border-muted)';
                    e.currentTarget.style.borderColor = BORDER_SUBTLE;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--surface-hover)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                    <span style={{
                      color: ACCENT, fontWeight: 600, textTransform: 'uppercase', fontSize: 10, marginRight: 8,
                    }}>
                      {src.source}
                    </span>
                    {src.title}
                  </span>
                  <span style={{ color: TEXT_MUTED, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {src.engagement?.stars ? `★ ${src.engagement.stars}` : ''}
                    {src.engagement?.score ? `▲ ${src.engagement.score}` : ''}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 20, paddingTop: 12, borderTop: `1px solid ${BORDER_SUBTLE}`,
          display: 'flex', gap: 16, fontSize: 12, color: TEXT_MUTED,
        }}>
          <span>{briefing.source_count} sources</span>
          <span>{briefing.reading_time} min read</span>
          <span>{briefing.created_at ? briefing.created_at.slice(0, 10) : ''}</span>
        </div>
      </div>
    </div>
  );
}


export function DiscoveryFeed() {
  const { heroItems, allItems, publications, loading, error } = useDiscoveryFeed();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [activeBriefing, setActiveBriefing] = useState<BriefingData | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'curated' | 'live'>('curated');
  const progressRef = useRef(0);
  const rafRef = useRef<number>();

  const itemCount = heroItems.length;
  const currentItem = heroItems[currentIndex] ?? null;

  // Reset index when hero items change so we don't go out of bounds
  useEffect(() => {
    if (currentIndex >= itemCount && itemCount > 0) {
      setCurrentIndex(0);
      setProgress(0);
      progressRef.current = 0;
    }
  }, [itemCount, currentIndex]);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index);
    setProgress(0);
    progressRef.current = 0;
  }, []);

  const goNext = useCallback(() => {
    if (itemCount === 0) return;
    goTo((currentIndex + 1) % itemCount);
  }, [currentIndex, itemCount, goTo]);

  const goPrev = useCallback(() => {
    if (itemCount === 0) return;
    goTo((currentIndex - 1 + itemCount) % itemCount);
  }, [currentIndex, itemCount, goTo]);

  useEffect(() => {
    if (isPaused || itemCount === 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      progressRef.current += delta;
      const pct = Math.min((progressRef.current / ROTATION_INTERVAL) * 100, 100);
      setProgress(pct);

      if (progressRef.current >= ROTATION_INTERVAL) {
        goNext();
        progressRef.current = 0;
        lastTime = performance.now();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPaused, itemCount, goNext]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ briefingId: string }>) => {
      const pub = publications.find(
        p => p.slug === e.detail.briefingId || p.id === e.detail.briefingId,
      );
      if (pub && pub.content?.markdown) {
        setActiveBriefing(publicationToBriefingData(pub));
      }
    };
    window.addEventListener('allternit:open-briefing' as any, handler);
    return () => window.removeEventListener('allternit:open-briefing' as any, handler);
  }, [publications]);

  const handleCta = (item: DiscoveryItem) => {
    if (item.ctaAction === 'notebook' && item.ctaTarget) {
      window.dispatchEvent(
        new CustomEvent('allternit:open-research-notebook', {
          detail: { notebookId: item.ctaTarget },
        }),
      );
    } else if (item.ctaAction === 'external' && item.ctaTarget) {
      openInBrowser(item.ctaTarget);
    } else if (item.ctaAction === 'read' && item.ctaTarget) {
      window.dispatchEvent(
        new CustomEvent('allternit:open-briefing', {
          detail: { briefingId: item.ctaTarget },
        }),
      );
    }
  };

  // Derive pipeline stats from live data
  const signalCount = allItems.filter(i => i.badge === 'Daily Brief').length;
  const featureCount = allItems.filter(i => i.badge === 'Weekly Feature').length;
  const publicationCount = allItems.filter(
    i => i.badge === 'Annual Report' || i.badge === 'Quarterly Index',
  ).length;

  const pipelineStats = [
    { label: 'Daily Brief', count: signalCount, color: STATUS_SUCCESS, desc: 'Curated AI intelligence every morning' },
    { label: 'Weekly Feature', count: featureCount, color: STATUS_INFO, desc: 'Deep dives into engineering and product' },
    { label: 'Publications', count: publicationCount, color: STATUS_WARNING, desc: 'Comprehensive research reports' },
  ];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 0 32px' }}
    >
      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 4, padding: '4px',
        background: BG_SECONDARY, borderRadius: 10,
        border: `1px solid ${BORDER_SUBTLE}`, width: 'fit-content',
      }}>
        {[
          { key: 'curated' as const, label: 'Curated', icon: BookOpen },
          { key: 'live' as const, label: 'Live', icon: Zap },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8, border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: isActive ? ACCENT_SOFT : 'transparent',
                color: isActive ? ACCENT : TEXT_MUTED,
                transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'live' ? (
        <LiveFeed />
      ) : (
        <>
          {/* ── Hero Carousel ─────────────────────────────────────────────── */}
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} />
          ) : currentItem ? (
            <div style={{
              position: 'relative',
              width: '100%',
              height: 420,
              borderRadius: 'var(--radius-lg, 16px)',
              overflow: 'hidden',
              background: BG_SECONDARY,
              border: `1px solid ${BORDER_SUBTLE}`,
            }}>
              {/* Background */}
              {currentItem.imageUrl ? (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(to right, var(--surface-floating) 0%, var(--surface-panel) 50%, var(--surface-hover) 100%), url(${currentItem.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }} />
              ) : (
                <GenerativeCover id={currentItem.id} badgeColor={currentItem.badgeColor} />
              )}

              {/* Content */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                height: '100%',
                padding: '40px 48px',
                maxWidth: 720,
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: currentItem.badgeColor,
                    background: `${currentItem.badgeColor}15`,
                    padding: '4px 10px',
                    borderRadius: 4,
                  }}>
                    {currentItem.badge}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                    {currentItem.date}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT_MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} />
                    {currentItem.readTime}
                  </span>
                </div>

                <h2 style={{
                  fontSize: 32, fontWeight: 700, lineHeight: 1.15, margin: '0 0 8px',
                  color: 'var(--ui-text-primary)', letterSpacing: '-0.02em',
                }}>
                  {currentItem.title}
                </h2>
                <p style={{ fontSize: 15, fontWeight: 500, color: ACCENT, margin: '0 0 12px' }}>
                  {currentItem.subtitle}
                </p>
                <p style={{
                  fontSize: 14, lineHeight: 1.6, color: TEXT_SECONDARY, margin: '0 0 24px', maxWidth: 520,
                }}>
                  {currentItem.excerpt}
                </p>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => handleCta(currentItem)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 20px',
                      background: ACCENT,
                      border: 'none',
                      borderRadius: 'var(--radius-md, 12px)',
                      color: BG_PRIMARY,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: `0 4px 16px ${ACCENT_GLOW}`,
                      transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = `0 6px 24px ${ACCENT_GLOW}`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = `0 4px 16px ${ACCENT_GLOW}`;
                    }}
                  >
                    {currentItem.type === 'video' ? <Play size={16} /> : <ArrowRight size={16} />}
                    {currentItem.ctaLabel}
                  </button>
                </div>
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={goPrev}
                style={{
                  position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.4)', border: `1px solid ${BORDER_SUBTLE}`,
                  color: 'var(--ui-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', zIndex: 3, backdropFilter: 'blur(8px)',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--shell-overlay-backdrop)';
                  e.currentTarget.style.borderColor = BORDER_DEFAULT;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
                  e.currentTarget.style.borderColor = BORDER_SUBTLE;
                }}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={goNext}
                style={{
                  position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.4)', border: `1px solid ${BORDER_SUBTLE}`,
                  color: 'var(--ui-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', zIndex: 3, backdropFilter: 'blur(8px)',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--shell-overlay-backdrop)';
                  e.currentTarget.style.borderColor = BORDER_DEFAULT;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
                  e.currentTarget.style.borderColor = BORDER_SUBTLE;
                }}
              >
                <ChevronRight size={20} />
              </button>

              {/* Progress + Dots */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '16px 48px', display: 'flex', alignItems: 'center', gap: 16, zIndex: 3,
              }}>
                <div style={{ flex: 1, height: 3, background: 'var(--surface-active)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${progress}%`,
                    background: `linear-gradient(90deg, ${ACCENT}, rgba(212,176,140,0.6))`,
                    borderRadius: 2, transition: 'width 0.05s linear',
                  }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {heroItems.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => goTo(idx)}
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: idx === currentIndex ? ACCENT : 'rgba(255,255,255,0.3)',
                        border: 'none', cursor: 'pointer', transition: 'var(--transition-base)',
                        transform: idx === currentIndex ? 'scale(1.3)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)',
                  fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right',
                }}>
                  {currentIndex + 1} / {itemCount}
                </span>
              </div>
            </div>
          ) : null}

          {/* ── Latest from the Pipeline ───────────────────────────────────── */}
          {allItems.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{
                  fontSize: 16, fontWeight: 600, margin: 0,
                  color: TEXT_PRIMARY, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Newspaper size={18} color={ACCENT} />
                  Latest from the Pipeline
                </h3>
                <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                  Updated {new Date().toLocaleDateString()}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {allItems.map(item => {
                  const heroIdx = heroItems.findIndex(h => h.id === item.id);
                  const isActive = heroIdx === currentIndex && heroIdx !== -1;
                  return (
                    <div
                      key={item.id}
                      onClick={() => heroIdx !== -1 ? goTo(heroIdx) : handleCta(item)}
                      style={{
                        background: BG_SECONDARY,
                        border: `1px solid ${isActive ? ACCENT : BORDER_SUBTLE}`,
                        borderRadius: 'var(--radius-lg, 16px)', padding: 20, cursor: 'pointer',
                        transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                        opacity: isActive ? 1 : 0.7,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
                        e.currentTarget.style.borderColor = BORDER_DEFAULT;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.opacity = isActive ? '1' : '0.7';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                        e.currentTarget.style.borderColor = isActive ? ACCENT : BORDER_SUBTLE;
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                          color: item.badgeColor,
                        }}>
                          {item.badge}
                        </span>
                        <TypeIcon type={item.type} color={item.badgeColor} />
                      </div>

                      <h4 style={{
                        fontSize: 14, fontWeight: 600, margin: '0 0 6px',
                        color: TEXT_PRIMARY, lineHeight: 1.4,
                      }}>
                        {item.title}
                      </h4>

                      <p style={{
                        fontSize: 12, lineHeight: 1.5, color: TEXT_MUTED, margin: 0,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {item.excerpt}
                      </p>

                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
                        fontSize: 11, color: TEXT_MUTED,
                      }}>
                        <span>{item.date}</span>
                        <span style={{ color: BORDER_DEFAULT }}>•</span>
                        <span>{item.readTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Pipeline Stats ─────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {pipelineStats.map(cat => (
              <div key={cat.label} style={{
                background: BG_SECONDARY,
                border: `1px solid ${BORDER_SUBTLE}`,
                borderRadius: 'var(--radius-lg, 16px)', padding: 24,
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = BORDER_DEFAULT;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = BORDER_SUBTLE;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, marginBottom: 12 }} />
                <h4 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: TEXT_PRIMARY }}>
                  {cat.count}
                </h4>
                <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: cat.color }}>{cat.label}</p>
                <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0 }}>{cat.desc}</p>
              </div>
            ))}
          </div>

        </>
      )}

      {/* ── Briefing Reader Modal ──────────────────────────────────────── */}
      {activeBriefing && (
        <BriefingReader briefing={activeBriefing} onClose={() => setActiveBriefing(null)} />
      )}

    </div>
  );
}
