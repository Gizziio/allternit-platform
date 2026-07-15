'use client';

import React from 'react';
import type { ContentType } from '@/types/publication';

/*
 * Illustrated hero covers, one scene per content type. Each is a small
 * hand-built SVG motif (not a photo, not a hashed gradient blob) so every
 * publication kind reads as a distinct, designed piece rather than filler.
 */

interface GenerativeCoverProps {
  contentType: ContentType;
  badgeColor: string;
  style?: React.CSSProperties;
}

const CANVAS_DARK = '#0d0c0f';
const CANVAS_DARK_2 = '#151318';
const LINE = 'rgba(255,255,255,0.09)';

function Base({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(135deg, ${CANVAS_DARK_2} 0%, ${CANVAS_DARK} 70%)`,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

/** Annual report — a stacked ledger of horizon bars, like a year in review. */
function AnnualScene({ color }: { color: string }) {
  const bars = [38, 62, 45, 78, 54, 91, 66, 100, 72, 84];
  return (
    <svg viewBox="0 0 640 420" className="size-full" preserveAspectRatio="xMaxYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
      <defs>
        <linearGradient id="annual-fade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.06" />
        </linearGradient>
      </defs>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={340 + i * 27}
          y={340 - h * 2.6}
          width="16"
          height={h * 2.6}
          rx="3"
          fill="url(#annual-fade)"
        />
      ))}
      <line x1="330" y1="342" x2="640" y2="342" stroke={LINE} strokeWidth="1" />
    </svg>
  );
}

/** Quarterly index — a dot-grid map, like plotted coordinates across a quarter. */
function IndexScene({ color }: { color: string }) {
  const cols = 9;
  const rows = 7;
  const seedActive = new Set([3, 7, 11, 14, 19, 22, 26, 30, 33, 38, 41, 44, 48]);
  return (
    <svg viewBox="0 0 640 420" className="size-full" preserveAspectRatio="xMaxYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const idx = r * cols + c;
          const active = seedActive.has(idx);
          return (
            <circle
              key={idx}
              cx={340 + c * 33}
              cy={60 + r * 44}
              r={active ? 5 : 2.5}
              fill={active ? color : LINE}
              opacity={active ? 0.75 : 1}
            />
          );
        })
      )}
    </svg>
  );
}

/** Weekly feature — a node/edge diagram, like a system or architecture sketch. */
function FeatureScene({ color }: { color: string }) {
  const nodes: [number, number][] = [[420, 100], [560, 80], [500, 200], [620, 220], [440, 300], [580, 330]];
  const edges: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5]];
  return (
    <svg viewBox="0 0 640 420" className="size-full" preserveAspectRatio="xMaxYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke={LINE} strokeWidth="1.5" />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 2 === 0 ? 6 : 4} fill={i === 0 ? color : CANVAS_DARK_2} stroke={color} strokeWidth="1.5" opacity={i === 0 ? 0.9 : 0.6} />
      ))}
    </svg>
  );
}

/** Daily brief — radiating signal arcs, like a broadcast ping. */
function SignalScene({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 640 420" className="size-full" preserveAspectRatio="xMaxYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
      <circle cx="540" cy="150" r="4" fill={color} />
      {[36, 66, 96, 126].map((r, i) => (
        <circle key={i} cx="540" cy="150" r={r} fill="none" stroke={color} strokeWidth="1.5" opacity={0.32 - i * 0.06} />
      ))}
      <line x1="380" y1="330" x2="600" y2="330" stroke={LINE} strokeWidth="1" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={390 + i * 30} y={330 - (8 + (i % 3) * 10)} width="6" height={8 + (i % 3) * 10} rx="2" fill={LINE} />
      ))}
    </svg>
  );
}

/** Course — a connected module path, matching the Labs tier-progression motif. */
function CourseScene({ color }: { color: string }) {
  const stops: [number, number][] = [[380, 260], [460, 160], [540, 220], [610, 120]];
  return (
    <svg viewBox="0 0 640 420" className="size-full" preserveAspectRatio="xMaxYMid slice" style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
      <path
        d={`M ${stops[0][0]} ${stops[0][1]} C ${stops[0][0] + 40} ${stops[0][1] - 60}, ${stops[1][0] - 40} ${stops[1][1] + 60}, ${stops[1][0]} ${stops[1][1]} S ${stops[2][0] - 20} ${stops[2][1] + 40}, ${stops[2][0]} ${stops[2][1]} S ${stops[3][0] - 30} ${stops[3][1] + 60}, ${stops[3][0]} ${stops[3][1]}`}
        fill="none"
        stroke={LINE}
        strokeWidth="2"
        strokeDasharray="1 10"
        strokeLinecap="round"
      />
      {stops.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="14" fill={CANVAS_DARK_2} stroke={color} strokeWidth="1.5" opacity={i === stops.length - 1 ? 1 : 0.55} />
          {i === stops.length - 1 && <circle cx={x} cy={y} r="5" fill={color} />}
        </g>
      ))}
    </svg>
  );
}

const SCENES: Record<ContentType, React.ComponentType<{ color: string }>> = {
  annual: AnnualScene,
  index: IndexScene,
  feature: FeatureScene,
  signal: SignalScene,
  course: CourseScene,
  lesson: CourseScene,
};

export function GenerativeCover({ contentType, badgeColor, style }: GenerativeCoverProps) {
  const Scene = SCENES[contentType] ?? FeatureScene;
  return (
    <div style={style}>
      <Base>
        <Scene color={badgeColor} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to right, rgba(13,12,15,0.98) 0%, rgba(13,12,15,0.7) 42%, rgba(13,12,15,0.15) 68%, transparent 100%)',
          }}
        />
      </Base>
    </div>
  );
}
