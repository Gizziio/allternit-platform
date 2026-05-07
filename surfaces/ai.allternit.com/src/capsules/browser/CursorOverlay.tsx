"use client";

/**
 * CursorOverlay
 *
 * Canvas-based animated cursor overlay for the Computer Use screen feed.
 * Ported from background-computer-use's CursorCoordinator.swift + CursorRenderer.swift.
 *
 * Features:
 * - Smooth cubic ease-out Bezier interpolation between positions (200ms)
 * - Per-agent cursor profiles (color, size)
 * - Visual effects: ripple, glow, spark, none
 * - Coordinate contract mapping (model space → display space)
 */

import React, { useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CursorEffect = 'ripple' | 'glow' | 'spark' | 'none';

export interface CursorProfile {
  agentId: string;
  color: string;   // e.g. '#a855f7'
  size: number;    // cursor dot radius in px
  label?: string;
}

export interface CursorPosition {
  x: number;
  y: number;
  agentId: string;
  effect: CursorEffect;
  timestamp?: number;
}

export interface CursorOverlayProps {
  position: CursorPosition | null;
  profiles?: CursorProfile[];
  containerWidth: number;
  containerHeight: number;
  coordinateContract?: {
    scale_factor: number;
    offset_x: number;
    offset_y: number;
    model_width: number;
    model_height: number;
    raw_width: number;
    raw_height: number;
  } | null;
}

// ─────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─────────────────────────────────────────────────────────────
// Animation state (held in refs, never causes re-renders)
// ─────────────────────────────────────────────────────────────

interface ActiveRipple {
  startedAt: number;
  x: number;
  y: number;
  duration: number;
}

interface ActiveSpark {
  startedAt: number;
  x: number;
  y: number;
  duration: number;
}

interface AnimState {
  // Current rendered position
  curX: number;
  curY: number;
  // Target position
  tgtX: number;
  tgtY: number;
  // Bezier interpolation start
  animStartedAt: number | null;
  animFromX: number;
  animFromY: number;
  // Glow pulse phase (radians)
  glowPhase: number;
  // Active effect instances
  ripples: ActiveRipple[];
  sparks: ActiveSpark[];
  // Last known effect type
  effect: CursorEffect;
  // RAF handle
  rafId: number | null;
}

const ANIM_DURATION_MS = 200;
const RIPPLE_DURATION_MS = 400;
const SPARK_DURATION_MS = 300;
const GLOW_HZ = 1.2;

const DEFAULT_PROFILE: CursorProfile = { agentId: 'primary', color: '#a855f7', size: 8 };

// ─────────────────────────────────────────────────────────────
// Drawing helpers
// ─────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const len = clean.length;
  let r = 0, g = 0, b = 0;
  if (len === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (len === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawCursorDot(ctx: CanvasRenderingContext2D, x: number, y: number, profile: CursorProfile) {
  const { color, size } = profile;

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(color, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Filled dot
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(color, 0.9);
  ctx.fill();
}

function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  profile: CursorProfile,
  phase: number,
) {
  const pulseAlpha = 0.12 + 0.06 * Math.sin(phase);
  const radius = profile.size * 6;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, hexToRgba(profile.color, pulseAlpha * 2.5));
  gradient.addColorStop(0.5, hexToRgba(profile.color, pulseAlpha));
  gradient.addColorStop(1, hexToRgba(profile.color, 0));
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function drawRipples(
  ctx: CanvasRenderingContext2D,
  ripples: ActiveRipple[],
  profile: CursorProfile,
  now: number,
): ActiveRipple[] {
  const alive: ActiveRipple[] = [];
  for (const r of ripples) {
    const elapsed = now - r.startedAt;
    if (elapsed >= r.duration) continue;
    alive.push(r);
    const t = elapsed / r.duration;
    const radius = profile.size * 2 + t * profile.size * 8;
    const alpha = (1 - t) * 0.6;
    ctx.beginPath();
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(profile.color, alpha);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  return alive;
}

function drawSparks(
  ctx: CanvasRenderingContext2D,
  sparks: ActiveSpark[],
  profile: CursorProfile,
  now: number,
): ActiveSpark[] {
  const alive: ActiveSpark[] = [];
  const COUNT = 7;
  for (const sp of sparks) {
    const elapsed = now - sp.startedAt;
    if (elapsed >= sp.duration) continue;
    alive.push(sp);
    const t = elapsed / sp.duration;
    const alpha = (1 - t) * 0.8;
    const outerR = profile.size * 2 + t * profile.size * 5;
    const innerR = profile.size * 1.5;
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2;
      const x1 = sp.x + Math.cos(angle) * innerR;
      const y1 = sp.y + Math.sin(angle) * innerR;
      const x2 = sp.x + Math.cos(angle) * outerR;
      const y2 = sp.y + Math.sin(angle) * outerR;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = hexToRgba(profile.color, alpha);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  return alive;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function CursorOverlay({
  position,
  profiles = [],
  containerWidth,
  containerHeight,
  coordinateContract,
}: CursorOverlayProps): JSX.Element | null {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<AnimState>({
    curX: 0, curY: 0,
    tgtX: 0, tgtY: 0,
    animStartedAt: null,
    animFromX: 0, animFromY: 0,
    glowPhase: 0,
    ripples: [],
    sparks: [],
    effect: 'none',
    rafId: null,
  });

  // Map model coords → display coords
  function mapCoords(x: number, y: number): { dx: number; dy: number } {
    if (coordinateContract) {
      const dx = (x / coordinateContract.model_width) * containerWidth;
      const dy = (y / coordinateContract.model_height) * containerHeight;
      return { dx, dy };
    }
    const dx = (x / 1280) * containerWidth;
    const dy = (y / 800) * containerHeight;
    return { dx, dy };
  }

  // When position changes → queue a new Bezier interpolation
  useEffect(() => {
    if (!position) return;
    const state = animRef.current;
    const { dx, dy } = mapCoords(position.x, position.y);

    // Snap start to current rendered pos
    state.animFromX = state.curX;
    state.animFromY = state.curY;
    state.tgtX = dx;
    state.tgtY = dy;
    state.animStartedAt = performance.now();
    state.effect = position.effect;

    // Spawn effect instances
    if (position.effect === 'ripple') {
      state.ripples.push({ startedAt: performance.now(), x: dx, y: dy, duration: RIPPLE_DURATION_MS });
    } else if (position.effect === 'spark') {
      state.sparks.push({ startedAt: performance.now(), x: dx, y: dy, duration: SPARK_DURATION_MS });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, coordinateContract, containerWidth, containerHeight]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number;

    function tick(now: number) {
      const state = animRef.current;
      const ctx = canvas!.getContext('2d');
      if (!ctx) { rafId = requestAnimationFrame(tick); return; }

      // Interpolate position
      if (state.animStartedAt !== null) {
        const elapsed = now - state.animStartedAt;
        const t = Math.min(1, elapsed / ANIM_DURATION_MS);
        const easedT = easeOut(t);
        state.curX = lerp(state.animFromX, state.tgtX, easedT);
        state.curY = lerp(state.animFromY, state.tgtY, easedT);
        if (t >= 1) {
          state.curX = state.tgtX;
          state.curY = state.tgtY;
          state.animStartedAt = null;
        }
      }

      // Advance glow phase
      state.glowPhase += (2 * Math.PI * GLOW_HZ) / 60;

      // Clear
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      // Only draw if we have a valid position (tgt was set at least once)
      const hasPosition = state.tgtX !== 0 || state.tgtY !== 0;
      if (!hasPosition) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const agentId = (position?.agentId) ?? 'primary';
      const profile = profiles.find(p => p.agentId === agentId) ??
        profiles[0] ??
        DEFAULT_PROFILE;

      const cx = state.curX;
      const cy = state.curY;

      // Glow (always on when effect === 'glow', pulsing)
      if (state.effect === 'glow') {
        drawGlow(ctx, cx, cy, profile, state.glowPhase);
      }

      // Ripples
      state.ripples = drawRipples(ctx, state.ripples, profile, now);

      // Sparks
      state.sparks = drawSparks(ctx, state.sparks, profile, now);

      // Cursor dot
      drawCursorDot(ctx, cx, cy, profile);

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    animRef.current.rafId = rafId;

    return () => {
      cancelAnimationFrame(rafId);
      animRef.current.rafId = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, position]);

  if (!containerWidth || !containerHeight) return null;

  return (
    <canvas
      ref={canvasRef}
      width={containerWidth}
      height={containerHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
}

export default CursorOverlay;
