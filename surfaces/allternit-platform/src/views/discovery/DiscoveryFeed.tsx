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
} from 'lucide-react';
import { useDiscoveryFeed } from './hooks/useDiscoveryFeed';
import { type DiscoveryItem } from './hooks/usePublicationMapper';
import { GenerativeCover } from './components/GenerativeCover';

const ROTATION_INTERVAL = 8000;

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
      borderRadius: 16,
      background: 'var(--bg-secondary, #111113)',
      border: '1px solid var(--border-subtle, #27272a)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}>
      <Loader2 size={24} color="#a78bfa" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ fontSize: 14, color: 'var(--text-muted, #a1a1aa)', margin: 0 }}>
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
      borderRadius: 16,
      background: 'var(--bg-secondary, #111113)',
      border: '1px solid var(--border-subtle, #27272a)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}>
      <p style={{ fontSize: 14, color: '#f87171', margin: 0 }}>Research pipeline connecting...</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted, #71717a)', margin: 0 }}>{message}</p>
    </div>
  );
}

export function DiscoveryFeed() {
  const { heroItems, allItems, loading, error } = useDiscoveryFeed();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
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

  const handleCta = (item: DiscoveryItem) => {
    if (item.ctaAction === 'notebook' && item.ctaTarget) {
      window.dispatchEvent(
        new CustomEvent('allternit:open-research-notebook', {
          detail: { notebookId: item.ctaTarget },
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
    { label: 'Daily Brief', count: signalCount, color: '#10b981', desc: 'Curated AI intelligence every morning' },
    { label: 'Weekly Feature', count: featureCount, color: '#3b82f6', desc: 'Deep dives into engineering and product' },
    { label: 'Publications', count: publicationCount, color: '#f59e0b', desc: 'Comprehensive research reports' },
  ];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 0 32px' }}
    >
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
          borderRadius: 16,
          overflow: 'hidden',
          background: 'var(--bg-secondary, #111113)',
          border: '1px solid var(--border-subtle, #27272a)',
        }}>
          {/* Background */}
          {currentItem.imageUrl ? (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(to right, rgba(9,9,11,0.95) 0%, rgba(9,9,11,0.6) 50%, rgba(9,9,11,0.3) 100%), url(${currentItem.imageUrl})`,
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
              <span style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)' }}>
                {currentItem.date}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} />
                {currentItem.readTime}
              </span>
            </div>

            <h2 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15, margin: '0 0 8px', color: '#fff', letterSpacing: '-0.02em' }}>
              {currentItem.title}
            </h2>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#a78bfa', margin: '0 0 12px' }}>
              {currentItem.subtitle}
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary, #d4d4d8)', margin: '0 0 24px', maxWidth: 520 }}>
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
                  background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(124, 58, 237, 0.3)',
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
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 3, backdropFilter: 'blur(8px)',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={goNext}
            style={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 3, backdropFilter: 'blur(8px)',
            }}
          >
            <ChevronRight size={20} />
          </button>

          {/* Progress + Dots */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '16px 48px', display: 'flex', alignItems: 'center', gap: 16, zIndex: 3,
          }}>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
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
                    background: idx === currentIndex ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                    border: 'none', cursor: 'pointer', transition: 'all 0.3s',
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
          <h3 style={{
            fontSize: 16, fontWeight: 600, margin: '0 0 16px',
            color: 'var(--text-primary, #e5e5e5)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Newspaper size={18} color="#a78bfa" />
            Latest from the Pipeline
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {allItems.map(item => {
              const heroIdx = heroItems.findIndex(h => h.id === item.id);
              const isActive = heroIdx === currentIndex && heroIdx !== -1;
              return (
                <div
                  key={item.id}
                  onClick={() => heroIdx !== -1 ? goTo(heroIdx) : handleCta(item)}
                  style={{
                    background: 'var(--bg-secondary, #111113)',
                    border: `1px solid ${isActive ? 'var(--border-active, #7c3aed)' : 'var(--border-subtle, #27272a)'}`,
                    borderRadius: 12, padding: 20, cursor: 'pointer',
                    transition: 'all 0.2s', opacity: isActive ? 1 : 0.7,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: item.badgeColor }}>
                      {item.badge}
                    </span>
                    <TypeIcon type={item.type} color={item.badgeColor} />
                  </div>

                  <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px', color: 'var(--text-primary, #e5e5e5)', lineHeight: 1.4 }}>
                    {item.title}
                  </h4>

                  <p style={{
                    fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted, #a1a1aa)', margin: 0,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {item.excerpt}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: 'var(--text-muted, #a1a1aa)' }}>
                    <span>{item.date}</span>
                    <span>•</span>
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
            background: 'var(--bg-secondary, #111113)',
            border: '1px solid var(--border-subtle, #27272a)',
            borderRadius: 12, padding: 24,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, marginBottom: 12 }} />
            <h4 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary, #e5e5e5)' }}>
              {cat.count}
            </h4>
            <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px', color: cat.color }}>{cat.label}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted, #a1a1aa)', margin: 0 }}>{cat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
