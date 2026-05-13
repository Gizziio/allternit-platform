'use client';

import React, { lazy, Suspense } from 'react';

// Remotion Player is heavy — lazy load so it doesn't bloat the main bundle
const RemotionPlayerInner = lazy(() =>
  import('@remotion/player').then((mod) => ({ default: mod.Player }))
);

// ─── Compositions ─────────────────────────────────────────────────────────────

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

// Wraps Remotion hooks safely — only called inside <Player> which provides context
function TitleCard({ title, subtitle, backgroundColor, accentColor }: {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  accentColor?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, fps * 0.5], [30, 0], { extrapolateRight: 'clamp' });
  const subtitleOpacity = interpolate(frame, [fps * 0.4, fps * 0.9], [0, 1], { extrapolateRight: 'clamp' });
  const lineScale = interpolate(frame, [fps * 0.3, fps * 0.8], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: backgroundColor ?? 'linear-gradient(135deg, #0d0b09 0%, #1a1510 100%)',
      fontFamily: 'system-ui, sans-serif', color: '#fff', padding: 80, boxSizing: 'border-box',
    }}>
      <div style={{ opacity: titleOpacity, transform: `translateY(${titleY}px)`, textAlign: 'center' }}>
        {title && (
          <h1 style={{ fontSize: 72, fontWeight: 800, margin: 0, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
            {title}
          </h1>
        )}
        <div style={{
          width: `${lineScale * 120}px`, height: 4,
          background: accentColor ?? '#d4b08c',
          borderRadius: 2, margin: '24px auto',
        }} />
      </div>
      {subtitle && (
        <p style={{ fontSize: 28, fontWeight: 300, margin: 0, opacity: subtitleOpacity * 0.75, textAlign: 'center', maxWidth: 800 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function CounterCard({ from = 0, to = 100, label, suffix = '', color }: {
  from?: number;
  to?: number;
  label?: string;
  suffix?: string;
  color?: string;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 50, stiffness: 80 }, durationInFrames });
  const value = Math.round(interpolate(progress, [0, 1], [from, to]));
  const opacity = interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#0d0b09', fontFamily: 'system-ui, sans-serif', opacity,
    }}>
      <div style={{ fontSize: 120, fontWeight: 900, color: color ?? '#d4b08c', letterSpacing: '-0.04em', lineHeight: 1 }}>
        {value}{suffix}
      </div>
      {label && (
        <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.5)', marginTop: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {label}
        </div>
      )}
    </div>
  );
}

function CodeReveal({ code, language }: { code?: string; language?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = (code ?? '// No code provided').split('\n');
  const revealedLines = Math.floor(interpolate(frame, [0, fps * 2], [0, lines.length], { extrapolateRight: 'clamp' }));
  const opacity = interpolate(frame, [0, fps * 0.2], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      background: '#0d1117', fontFamily: 'monospace', padding: 60, boxSizing: 'border-box', opacity,
    }}>
      {language && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 24, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {language}
        </div>
      )}
      <pre style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: '#e2e8f0' }}>
        {lines.slice(0, revealedLines).map((line, i) => (
          <div key={i} style={{ opacity: i === revealedLines - 1 ? 0.7 : 1 }}>{line || ' '}</div>
        ))}
        <span style={{ display: 'inline-block', width: 10, height: '1.2em', background: '#d4b08c', verticalAlign: 'text-bottom', animation: 'none' }} />
      </pre>
    </div>
  );
}

// ─── Composition registry ─────────────────────────────────────────────────────

const CompositionRegistry: Record<string, React.ComponentType<Record<string, unknown>>> = {
  'title-card': TitleCard as React.ComponentType<Record<string, unknown>>,
  'counter': CounterCard as React.ComponentType<Record<string, unknown>>,
  'code-reveal': CodeReveal as React.ComponentType<Record<string, unknown>>,
};

export interface RemotionPlayerProps {
  compositionId?: string;
  durationInFrames?: number;
  fps?: number;
  width?: number;
  height?: number;
  inputProps?: Record<string, unknown>;
  title?: string;
}

export function RemotionPlayer({
  compositionId = 'title-card',
  durationInFrames = 150,
  fps = 30,
  width = 1280,
  height = 720,
  inputProps = {},
  title,
}: RemotionPlayerProps) {
  // Resolve component — fall back to TitleCard for unknown compositions
  const Component = CompositionRegistry[compositionId] ?? TitleCard;

  return (
    <div style={{
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
      background: '#0d0d14',
    }}>
      {title && (
        <div style={{
          padding: '8px 14px',
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#f43f5e', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
            ▶ Remotion
          </span>
          {title}
        </div>
      )}
      <div style={{ aspectRatio: `${width}/${height}`, width: '100%' }}>
        <Suspense fallback={
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 13,
            background: '#0d0d14',
          }}>
            Loading player…
          </div>
        }>
          <RemotionPlayerInner
            component={Component as React.ComponentType<Record<string, unknown>>}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={width}
            compositionHeight={height}
            style={{ width: '100%', height: '100%' }}
            controls
            inputProps={inputProps}
          />
        </Suspense>
      </div>
    </div>
  );
}
