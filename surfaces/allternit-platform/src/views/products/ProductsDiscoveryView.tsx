"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X, Sparkle, ArrowRight, CaretLeft, CaretRight,
  HardDrives, RocketLaunch, Cpu, Stack, Shield, Key, Globe,
  CheckCircle, Copy, ArrowSquareOut, Wrench, Command,
  Cursor, Chat, Camera, FileText, TextT, Lightning,
  PuzzlePiece as Puzzle,
  Laptop, ShoppingBag, GraduationCap,
  Brain, Robot, Palette, Note, GitBranch, UsersThree,
  Monitor, Code,
} from '@phosphor-icons/react';
import { useNav } from '@/nav/useNav';
import { openInBrowser } from '@/lib/openInBrowser';

// ─── Browser SVG icons ────────────────────────────────────────────────────────

const ChromeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.909c2.298 0 4.332.993 5.758 2.56L12 17.5 5.564 6.256C7.193 5.46 9.045 4.909 12 4.909zM4.056 8.056l5.636 9.838C5.228 16.538 3.5 13.29 3.5 11.5c0-1.146.222-2.24.556-3.444zm15.888 0c.334 1.204.556 2.298.556 3.444 0 1.79-1.728 5.038-6.192 6.394l5.636-9.838z"/>
  </svg>
);
const FirefoxIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c2.437 0 4.698-.73 6.593-1.98l-5.636-9.838c.895-.438 1.902-.685 2.965-.685s2.07.247 2.965.685l3.346-5.85C20.698 4.73 16.437 2 12 2z"/>
  </svg>
);
const EdgeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.3 10.3c.2-1.3.7-2.5 1.5-3.4.8-.9 1.9-1.5 3.2-1.8 1.3-.3 2.7-.2 4.1.3v2.4c-.5-.3-1.1-.5-1.7-.6-.6-.1-1.2 0-1.7.3-.5.3-.9.7-1.2 1.3-.3.6-.4 1.3-.3 2.2.1.9.5 1.6 1 2.1.5.5 1.2.8 1.9.9.7.1 1.4 0 2.1-.3v2.4c-1.4.5-2.8.6-4.1.3-1.3-.3-2.4-.9-3.2-1.8-.8-.9-1.3-2.1-1.5-3.4z"/>
  </svg>
);
const AppleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);
const WindowsIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 12V6.75l6-1.32v6.48L3 12m17-9v8.75l-10 .15V5.21L20 3M3 13l6 .09v6.81l-6-1.15V13m17 .25V22l-10-1.91V13.1l10 .15z"/>
  </svg>
);
const LinuxIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489.117.779.437 1.512.913 2.13.476.618 1.092 1.116 1.804 1.456.712.34 1.51.52 2.354.52.845 0 1.642-.18 2.354-.52.712-.34 1.328-.838 1.804-1.456.476-.618.796-1.351.913-2.13.123-.805-.009-1.657-.287-2.489-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021z"/>
  </svg>
);
const VSCodeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.583.063a1.5 1.5 0 0 0-1.092.46l-8.953 8.952-3.47-2.766a1.2 1.2 0 0 0-1.544.06l-1.15 1.032a.8.8 0 0 0 0 1.197l3.08 2.757-3.08 2.758a.8.8 0 0 0 0 1.197l1.15 1.032a1.2 1.2 0 0 0 1.544.06l3.47-2.767 8.953 8.953a1.5 1.5 0 0 0 1.092.46h1.917a.6.6 0 0 0 .6-.6V.663a.6.6 0 0 0-.6-.6h-1.917zM19.5 3.6v16.8l-7.033-5.625L19.5 3.6z"/>
  </svg>
);

// ─── Design Tokens ────────────────────────────────────────────────────────────

const T = {
  bg:          'var(--surface-canvas)',
  bgCard:      'var(--surface-panel)',
  bgElevated:  'var(--surface-floating)',
  border:      'var(--ui-border-muted)',
  borderMed:   'var(--ui-border-default)',
  borderStr:   'var(--ui-border-strong)',
  textPrimary: 'var(--ui-text-primary)',
  textSec:     'var(--ui-text-secondary)',
  textTer:     'var(--ui-text-muted)',
  brand:       'var(--accent-primary)',
  brandDim:    'color-mix(in srgb, var(--accent-primary) 12%, var(--surface-panel))',
  brandBorder: 'color-mix(in srgb, var(--accent-primary) 22%, transparent)',
};

// ─── Global keyframes ─────────────────────────────────────────────────────────

const PDV_CSS = `
  /* Allternit Typography System — no external font imports */

  /* ── Grain overlay ──────────────────────────────────────────────── */
  .pdv-root {
    position: relative;
    scrollbar-width: thin;
    scrollbar-color: rgba(212,176,140,.18) transparent;
  }
  .pdv-root::before {
    content: '';
    position: fixed; inset: 0;
    pointer-events: none; z-index: 9999;
    opacity: .038;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23g)'/%3E%3C/svg%3E");
    background-size: 256px;
  }
  .pdv-root::-webkit-scrollbar { width: 5px; }
  .pdv-root::-webkit-scrollbar-thumb { background: rgba(212,176,140,.18); border-radius: 99px; }
  .pdv-root::-webkit-scrollbar-track { background: transparent; }

  /* ── Typefaces ──────────────────────────────────────────────────── */
  .pdv-serif  { font-family: 'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', serif !important; }
  .pdv-display{ font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, -apple-system, sans-serif !important; }

  /* ── Scroll-reveal ──────────────────────────────────────────────── */
  @keyframes pdv-reveal { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
  .pdv-reveal { opacity: 0; }
  .pdv-reveal.is-visible { animation: pdv-reveal .72s cubic-bezier(.16,1,.3,1) forwards; }
  .pdv-reveal:nth-child(2) { animation-delay:.08s }
  .pdv-reveal:nth-child(3) { animation-delay:.14s }

  /* ── Quote mark ─────────────────────────────────────────────────── */
  .pdv-quote-mark {
    font-family: 'Allternit Serif', Georgia, ui-serif, serif;
    font-size: 96px; line-height: 1; font-weight: 900; font-style: italic;
    color: rgba(212,176,140,.09);
    position: absolute; top: 8px; left: 20px;
    pointer-events: none; user-select: none;
    letter-spacing: -4px;
  }

  /* ── Link hover underline ───────────────────────────────────────── */
  .pdv-link-ul { position: relative; display: inline-block; }
  .pdv-link-ul::after {
    content: ''; position: absolute; bottom: -2px; left: 0; right: 0;
    height: 1px; background: #D4B08C;
    transform: scaleX(0); transform-origin: left;
    transition: transform .28s cubic-bezier(.16,1,.3,1);
  }
  .pdv-link-ul:hover::after { transform: scaleX(1); }

  /* ── Existing keyframes ─────────────────────────────────────────── */
  @keyframes pdv-float-a { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-12px) scale(1.02)} }
  @keyframes pdv-float-b { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-8px) rotate(3deg)} }
  @keyframes pdv-float-c { 0%,100%{transform:translateY(-6px)} 50%{transform:translateY(6px)} }
  @keyframes pdv-breathe  { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }
  @keyframes pdv-spin-slow{ from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes pdv-spin-rev { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
  @keyframes pdv-ping     { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(2.2);opacity:0} }
  @keyframes pdv-ping2    { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.8);opacity:0} }
  @keyframes pdv-progress { from{width:0} to{width:100%} }
  @keyframes pdv-slide-in { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
  @keyframes pdv-fade-in  { from{opacity:0} to{opacity:1} }
  @keyframes pdv-blink    { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes pdv-draw-line{ from{stroke-dashoffset:200} to{stroke-dashoffset:0} }
  @keyframes pdv-node-pop { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
  @keyframes pdv-radar    { 0%{transform:scale(.3);opacity:.9} 100%{transform:scale(2.4);opacity:0} }
  @keyframes pdv-shimmer  {
    0%   { background-position: -200% center }
    100% { background-position:  200% center }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

type ArtType = 'chat'|'code'|'computer-use'|'swarm'|'browser-capsule'|'local-brain'|'canvas-doc';
type ProductStatus = 'live'|'beta'|'soon';

interface SpotlightItem {
  id: string;
  title: string;
  tagline: string;
  description: string;
  gradient: string;
  accent: string;
  icon: React.ReactNode;
  badges: string[];
  art: ArtType;
  videoSrc?: string;
  ctaPrimary: { label: string; action: () => void };
  ctaSecondary?: { label: string; action: () => void };
}

interface MiniProduct {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  gradient: string;
  viewType?: string;
  status: ProductStatus;
  category: string;
}

// ─── Abstract Art Panels ──────────────────────────────────────────────────────

function useCanvasArt(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    let raf: number, t = 0;
    const resize = () => {
      el.width  = el.offsetWidth  * window.devicePixelRatio;
      el.height = el.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);
    const loop = () => {
      ctx.clearRect(0, 0, el.offsetWidth, el.offsetHeight);
      draw(ctx, el.offsetWidth, el.offsetHeight, t);
      t += 0.008;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [draw]);
  return ref;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('pdv-reveal');
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('is-visible'); obs.disconnect(); }
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

// Chat art: warm bubble compositions
function ChatArt() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    // Background glow
    const g1 = ctx.createRadialGradient(w*.7, h*.3, 0, w*.7, h*.3, w*.55);
    g1.addColorStop(0, 'rgba(217,119,87,0.14)'); g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);
    const g2 = ctx.createRadialGradient(w*.2, h*.7, 0, w*.2, h*.7, w*.4);
    g2.addColorStop(0, 'rgba(176,141,110,0.10)'); g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);

    const bubbles = [
      { x: w*.12, y: h*.18, bw: w*.62, bh: h*.2, r: 22, a: 0.13, ta: 0 },
      { x: w*.28, y: h*.46, bw: w*.52, bh: h*.17, r: 18, a: 0.09, ta: 1.8 },
      { x: w*.10, y: h*.70, bw: w*.40, bh: h*.14, r: 16, a: 0.06, ta: 3.4 },
    ];
    bubbles.forEach(b => {
      const fy = Math.sin(t * 0.5 + b.ta) * 7;
      rr(ctx, b.x, b.y + fy, b.bw, b.bh, b.r);
      ctx.fillStyle = `rgba(217,119,87,${b.a})`; ctx.fill();
      ctx.strokeStyle = `rgba(217,119,87,${b.a * 1.8})`; ctx.lineWidth = 1; ctx.stroke();
      // Inner lines (text simulation)
      for (let i = 0; i < 3; i++) {
        const lw = b.bw * (0.55 - i * 0.12);
        ctx.fillStyle = `rgba(217,119,87,${b.a * 0.6})`;
        ctx.fillRect(b.x + 16, b.y + fy + 14 + i * 14, lw, 4);
      }
    });
    // Floating dots
    for (let i = 0; i < 6; i++) {
      const px = w * (0.15 + (i * 0.14));
      const py = h * 0.88 + Math.sin(t + i * 1.1) * 5;
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(217,119,87,${0.15 + Math.sin(t * 1.5 + i) * 0.08})`; ctx.fill();
    }
  }, []);
  const ref = useCanvasArt(draw);
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />;
}

// Code art: syntax-colored column rain
function CodeArt() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const g = ctx.createRadialGradient(w*.5, h*.4, 0, w*.5, h*.4, w*.5);
    g.addColorStop(0, 'rgba(245,158,11,0.10)'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    const cols = ['rgba(245,158,11,.18)', 'rgba(156,220,254,.14)', 'rgba(78,201,176,.12)', 'rgba(206,145,120,.16)', 'rgba(180,180,180,.10)'];
    const bars = [
      { y: 0.12, wr: 0.55, ci: 0, delay: 0 },
      { y: 0.24, wr: 0.35, ci: 1, delay: 0.4 },
      { y: 0.36, wr: 0.70, ci: 2, delay: 0.8 },
      { y: 0.48, wr: 0.42, ci: 3, delay: 1.2 },
      { y: 0.60, wr: 0.60, ci: 0, delay: 1.6 },
      { y: 0.72, wr: 0.28, ci: 4, delay: 2.0 },
      { y: 0.84, wr: 0.50, ci: 1, delay: 2.4 },
    ];
    bars.forEach(b => {
      const prog = Math.min(1, Math.max(0, (Math.sin(t * 0.4 + b.delay) + 1) / 2));
      const barW = w * b.wr * prog;
      const fy = Math.sin(t * 0.3 + b.delay * 0.5) * 3;
      ctx.fillStyle = cols[b.ci];
      ctx.fillRect(w * 0.08, h * b.y + fy, barW, h * 0.045);
    });

    // Central `{ }` glyph
    ctx.save();
    ctx.globalAlpha = 0.06 + Math.sin(t * 0.5) * 0.02;
    ctx.font = `bold ${Math.round(w * 0.28)}px monospace`;
    ctx.fillStyle = 'rgba(245,158,11,1)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('{ }', w * 0.78, h * 0.5);
    ctx.restore();
  }, []);
  const ref = useCanvasArt(draw);
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />;
}

// Computer Use art: radar rings + cursor trail
function ComputerUseArt() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const cx = w * 0.62, cy = h * 0.45;
    // Radar rings
    for (let i = 0; i < 4; i++) {
      const phase = ((t * 0.35 + i * 0.25) % 1);
      const r = phase * w * 0.44;
      const alpha = (1 - phase) * 0.18;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(91,141,239,${alpha})`; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Static ring
    ctx.beginPath(); ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(91,141,239,0.12)'; ctx.lineWidth = 1; ctx.stroke();

    // Glow at center
    const gc = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.18);
    gc.addColorStop(0, 'rgba(91,141,239,0.18)'); gc.addColorStop(1, 'transparent');
    ctx.fillStyle = gc; ctx.fillRect(0, 0, w, h);

    // Animated cursor pointer
    const cursorT = t * 0.45;
    const cpx = cx + Math.cos(cursorT) * w * 0.16;
    const cpy = cy + Math.sin(cursorT * 0.7) * h * 0.22;
    ctx.save();
    ctx.translate(cpx, cpy);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, 18); ctx.lineTo(4, 14); ctx.lineTo(6, 19); ctx.lineTo(8, 18); ctx.lineTo(6, 13); ctx.lineTo(11, 13); ctx.closePath();
    ctx.fillStyle = 'rgba(91,141,239,0.7)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.restore();

    // Cursor glow
    const cg = ctx.createRadialGradient(cpx, cpy, 0, cpx, cpy, 20);
    cg.addColorStop(0, 'rgba(91,141,239,0.3)'); cg.addColorStop(1, 'transparent');
    ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);

    // Corner grid
    ctx.save(); ctx.globalAlpha = 0.04;
    for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.strokeStyle='rgba(91,141,239,1)'; ctx.lineWidth=1; ctx.stroke(); }
    for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    ctx.restore();
  }, []);
  const ref = useCanvasArt(draw);
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />;
}

// Swarm art: constellation network
function SwarmArt() {
  const NODES = [
    { rx: 0.22, ry: 0.22 }, { rx: 0.65, ry: 0.18 }, { rx: 0.48, ry: 0.42 },
    { rx: 0.18, ry: 0.60 }, { rx: 0.75, ry: 0.55 }, { rx: 0.38, ry: 0.75 },
    { rx: 0.72, ry: 0.80 }, { rx: 0.50, ry: 0.88 },
  ];
  const EDGES = [[0,2],[1,2],[2,3],[2,4],[3,5],[4,6],[5,7],[6,7],[0,1],[4,2]];
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const glow = ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,w*.45);
    glow.addColorStop(0,'rgba(16,185,129,0.07)'); glow.addColorStop(1,'transparent');
    ctx.fillStyle=glow; ctx.fillRect(0,0,w,h);

    const pts = NODES.map((n, i) => ({
      x: w * n.rx + Math.sin(t * 0.4 + i * 0.7) * 8,
      y: h * n.ry + Math.cos(t * 0.3 + i * 0.9) * 6,
    }));

    // Edges
    EDGES.forEach(([a,b], i) => {
      const prog = Math.min(1, Math.max(0, Math.sin(t * 0.25 + i * 0.3) * 0.5 + 0.5));
      ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y);
      ctx.strokeStyle = `rgba(16,185,129,${prog * 0.22})`; ctx.lineWidth = 1; ctx.stroke();
    });

    // Nodes
    pts.forEach((p, i) => {
      const pulse = Math.sin(t * 1.2 + i * 0.8) * 0.5 + 0.5;
      // Halo
      const ng = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 18);
      ng.addColorStop(0, `rgba(16,185,129,${pulse * 0.18})`); ng.addColorStop(1,'transparent');
      ctx.fillStyle = ng; ctx.fillRect(0,0,w,h);
      // Core
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
      ctx.fillStyle = `rgba(16,185,129,${0.6 + pulse * 0.4})`; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(16,185,129,${pulse * 0.35})`; ctx.lineWidth = 1; ctx.stroke();
    });
  }, []);
  const ref = useCanvasArt(draw);
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />;
}

// Browser Capsule art: concentric rings + puzzle
function BrowserCapsuleArt() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const cx = w * 0.55, cy = h * 0.48;
    // Gradient background
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
    g.addColorStop(0, 'rgba(66,133,244,0.12)'); g.addColorStop(0.5, 'rgba(52,168,83,0.05)'); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // Static rings
    [0.18, 0.30, 0.40, 0.50].forEach((r, i) => {
      ctx.beginPath(); ctx.arc(cx, cy, w * r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(66,133,244,${0.10 - i * 0.02})`; ctx.lineWidth = 1; ctx.stroke();
    });

    // Rotating dashed ring
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(t * 0.4);
    ctx.beginPath(); ctx.arc(0, 0, w * 0.24, 0, Math.PI * 2);
    ctx.setLineDash([6, 10]); ctx.strokeStyle = 'rgba(66,133,244,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]); ctx.restore();

    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-t * 0.25);
    ctx.beginPath(); ctx.arc(0, 0, w * 0.38, 0, Math.PI * 2);
    ctx.setLineDash([3, 14]); ctx.strokeStyle = 'rgba(52,168,83,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]); ctx.restore();

    // Orbiting dot
    const orbitX = cx + Math.cos(t * 0.6) * w * 0.24;
    const orbitY = cy + Math.sin(t * 0.6) * w * 0.24;
    const og = ctx.createRadialGradient(orbitX, orbitY, 0, orbitX, orbitY, 10);
    og.addColorStop(0, 'rgba(66,133,244,0.8)'); og.addColorStop(1,'transparent');
    ctx.fillStyle = og; ctx.fillRect(0,0,w,h);
    ctx.beginPath(); ctx.arc(orbitX, orbitY, 3.5, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(66,133,244,0.9)'; ctx.fill();
  }, []);
  const ref = useCanvasArt(draw);
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />;
}

// Local Brain art: neural constellation
function LocalBrainArt() {
  const NEURONS = [
    {rx:.50,ry:.40},{rx:.30,ry:.25},{rx:.70,ry:.28},{rx:.20,ry:.50},
    {rx:.78,ry:.52},{rx:.35,ry:.65},{rx:.65,ry:.68},{rx:.50,ry:.80},
    {rx:.15,ry:.35},{rx:.82,ry:.35},
  ];
  const SYNAPSES = [[0,1],[0,2],[0,3],[0,4],[1,8],[2,9],[1,5],[2,6],[3,5],[4,6],[5,7],[6,7],[3,8],[4,9]];
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const bg = ctx.createRadialGradient(w*.5,h*.4,0,w*.5,h*.4,w*.5);
    bg.addColorStop(0,'rgba(139,92,246,0.12)'); bg.addColorStop(1,'transparent');
    ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);

    const pts = NEURONS.map((n,i) => ({
      x: w*n.rx + Math.sin(t*0.35+i*0.6)*6,
      y: h*n.ry + Math.cos(t*0.28+i*0.8)*5,
    }));

    SYNAPSES.forEach(([a,b],i) => {
      const signal = (Math.sin(t*0.8 + i*0.4) + 1) / 2;
      // Signal pulse along edge
      const px = pts[a].x + (pts[b].x - pts[a].x) * ((t*0.5 + i*0.3) % 1);
      const py = pts[a].y + (pts[b].y - pts[a].y) * ((t*0.5 + i*0.3) % 1);

      ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y);
      ctx.strokeStyle = `rgba(139,92,246,${signal * 0.20})`; ctx.lineWidth = 1; ctx.stroke();

      // Moving signal dot
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2);
      ctx.fillStyle = `rgba(167,139,250,${signal * 0.6})`; ctx.fill();
    });

    pts.forEach((p,i) => {
      const act = Math.sin(t * 1.4 + i * 0.7) * 0.5 + 0.5;
      const isCenter = i === 0;
      const r = isCenter ? 7 : 4;
      const ng = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*3.5);
      ng.addColorStop(0,`rgba(139,92,246,${act*(isCenter?.25:.15)})`); ng.addColorStop(1,'transparent');
      ctx.fillStyle=ng; ctx.fillRect(0,0,w,h);
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${isCenter?'167,139,250':'139,92,246'},${0.6+act*.4})`; ctx.fill();
    });
  }, []);
  const ref = useCanvasArt(draw);
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />;
}

// Canvas doc art: document layout composition
function CanvasDocArt() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    const g = ctx.createRadialGradient(w*.5,h*.4,0,w*.5,h*.4,w*.48);
    g.addColorStop(0,'rgba(99,102,241,0.12)'); g.addColorStop(1,'transparent');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);

    // Document shadow card
    const dw = w*0.72, dh = h*0.76, dx = w*0.14, dy = h*0.12;
    const fy = Math.sin(t*0.4)*4;
    rr(ctx, dx+4, dy+fy+4, dw, dh, 10);
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fill();
    rr(ctx, dx, dy+fy, dw, dh, 10);
    ctx.fillStyle='rgba(20,20,24,0.95)'; ctx.fill();
    ctx.strokeStyle='rgba(99,102,241,0.15)'; ctx.lineWidth=1; ctx.stroke();

    // Document content lines
    const lines = [
      { y:.16, w:.55, h:.025, ci:0.7 },  // heading
      { y:.26, w:.80, h:.016, ci:0.35 },
      { y:.33, w:.72, h:.016, ci:0.30 },
      { y:.40, w:.85, h:.016, ci:0.30 },
      { y:.47, w:.60, h:.016, ci:0.25 },
      { y:.57, w:.78, h:.014, ci:0.22 },
      { y:.63, w:.66, h:.014, ci:0.18 },
    ];
    lines.forEach((l,i) => {
      const prog = Math.min(1, Math.max(0, Math.sin(t*0.3 + i*0.25)*0.5+0.5));
      ctx.fillStyle=`rgba(99,102,241,${l.ci * prog})`;
      ctx.fillRect(dx + dw*.09, dy+fy + dh*l.y, dw * l.w * prog, dh*l.h);
    });

    // Blinking cursor
    if (Math.sin(t*3) > 0) {
      ctx.fillStyle='rgba(99,102,241,0.8)';
      ctx.fillRect(dx + dw*.09, dy+fy + dh*.77, 2, 14);
    }

    // Floating tag "AI writing"
    const tagX = dx + dw*.62, tagY = dy + fy - 18;
    rr(ctx, tagX, tagY, 90, 22, 11);
    ctx.fillStyle='rgba(99,102,241,0.15)'; ctx.fill();
    ctx.strokeStyle='rgba(99,102,241,0.3)'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='rgba(160,163,255,0.8)'; ctx.font='bold 10px -apple-system,sans-serif';
    ctx.textBaseline='middle'; ctx.fillText('✦ AI writing', tagX+10, tagY+11);
  }, []);
  const ref = useCanvasArt(draw);
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />;
}

const ART_MAP: Record<ArtType, React.ComponentType> = {
  'chat':            ChatArt,
  'code':            CodeArt,
  'computer-use':    ComputerUseArt,
  'swarm':           SwarmArt,
  'browser-capsule': BrowserCapsuleArt,
  'local-brain':     LocalBrainArt,
  'canvas-doc':      CanvasDocArt,
};

// ─── Spotlight data ───────────────────────────────────────────────────────────

function makeSpotlight(): SpotlightItem[] {
  const d = (vt: string) => () => useNav.getState().dispatch({ type: 'OPEN_VIEW', viewType: vt as any });
  return [
    {
      id: 'cowork', title: 'Cowork', tagline: 'AI for Your Whole Team',
      description: 'Put Claude to work on tasks while you step away. Collaborate in real-time with AI as a full team member — assign tasks, review outputs, and ship faster together. Available now on Allternit Desktop.',
      gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)', accent: '#06b6d4',
      icon: <UsersThree size={26} weight="fill" color="var(--ui-text-primary)" />,
      badges: ['Live', 'macOS'], art: 'chat', videoSrc: '/videos/cowork-demo.mp4',
      ctaPrimary: { label: 'Try Cowork', action: d('chat') },
      ctaSecondary: { label: 'Download Desktop', action: () => openInBrowser('https://allternit.com/download') },
    },
    {
      id: 'chat', title: 'Allternit Chat', tagline: 'Conversational AI',
      description: 'The thinking layer for everything you do. Stream responses from any model, attach files, search the web, or hand off to an agent — all from one thread.',
      gradient: 'linear-gradient(135deg,#D97757,#B08D6E)', accent: '#D97757',
      icon: <Chat size={26} weight="fill" color="var(--ui-text-primary)" />,
      badges: ['Live', 'All modes'], art: 'chat',
      ctaPrimary: { label: 'Open Chat', action: d('chat') },
    },
    {
      id: 'code', title: 'Allternit Code', tagline: 'AI-Powered Development',
      description: 'Your AI pair programmer across terminal, VS Code, and JetBrains. Understands full repositories — not just snippets. Aider, Goose, Codex, and Claude in one surface.',
      gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', accent: 'var(--status-warning)',
      icon: <Code size={26} weight="fill" color="var(--ui-text-primary)" />,
      badges: ['Live', 'CLI + IDE'], art: 'code',
      ctaPrimary: { label: 'Open Code', action: d('code') },
    },
    {
      id: 'computer-use', title: 'Computer Use', tagline: 'AI That Sees & Acts',
      description: 'Give AI eyes and hands in the browser. Navigate, click, fill forms, extract data — fully automated, fully observable. 44-route ACU gateway, production-grade.',
      gradient: 'linear-gradient(135deg,#5B8DEF,#3b5bdb)', accent: '#5B8DEF',
      icon: <Monitor size={26} weight="fill" color="var(--ui-text-primary)" />,
      badges: ['Live', 'ACU Engine'], art: 'computer-use',
      ctaPrimary: { label: 'Open Operator', action: d('operator') },
    },
    {
      id: 'swarm', title: 'Swarm ADE', tagline: 'Agent Orchestration at Scale',
      description: 'Spin up hundreds of AI agents working in parallel. Route tasks, monitor topology, replay runs, set budgets — all in one real-time dashboard.',
      gradient: 'linear-gradient(135deg,#10b981,#059669)', accent: 'var(--status-success)',
      icon: <Robot size={26} weight="fill" color="var(--ui-text-primary)" />,
      badges: ['Live', 'Multi-agent'], art: 'swarm',
      ctaPrimary: { label: 'Open Swarm', action: d('swarm') },
    },
    {
      id: 'browser-capsule', title: 'Browser Capsule', tagline: 'AI in Every Tab',
      description: 'A browser extension that brings the full Allternit experience to any webpage. Select, ask, summarize, automate — without ever leaving the page.',
      gradient: 'linear-gradient(135deg,#4285F4,#34A853)', accent: '#4285F4',
      icon: <Puzzle size={26} weight="fill" color="var(--ui-text-primary)" />,
      badges: ['Chrome', 'Firefox'], art: 'browser-capsule',
      ctaPrimary: { label: 'Add to Chrome', action: () => openInBrowser('https://chrome.google.com/webstore') },
    },
    {
      id: 'local-brain', title: 'Local Brain', tagline: 'Private · Offline · Yours',
      description: 'Run AI entirely on your machine. No internet, no API keys, no cloud. Powered by Ollama + Llama 3.2. Every conversation stays on your device — permanently.',
      gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', accent: '#8b5cf6',
      icon: <Brain size={26} weight="fill" color="var(--ui-text-primary)" />,
      badges: ['Offline', '~2 GB'], art: 'local-brain',
      ctaPrimary: { label: 'Set Up Local Brain', action: d('models-manage') },
    },
    {
      id: 'canvas', title: 'Allternit Canvas', tagline: 'Documents Built with AI',
      description: 'A new kind of document editor. Prompt to draft, refine together, export anywhere. The blank page, replaced.',
      gradient: 'linear-gradient(135deg,#6366f1,#4f46e5)', accent: '#6366f1',
      icon: <Note size={26} weight="fill" color="var(--ui-text-primary)" />,
      badges: ['Beta'], art: 'canvas-doc',
      ctaPrimary: { label: 'Open Canvas', action: d('allternit-canvas') },
    },
  ];
}

// ─── Spotlight Carousel ───────────────────────────────────────────────────────

function SpotlightCarousel() {
  const ITEMS = makeSpotlight();
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const jump = useCallback((next: number) => {
    setShow(false);
    setTimeout(() => { setIdx(next); setShow(true); }, 280);
  }, []);

  useEffect(() => {
    if (paused) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setIdx(prev => { const n = (prev + 1) % ITEMS.length; jump(n); return prev; });
    }, 10000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, jump, ITEMS.length]);

  const item = ITEMS[idx];
  const ArtComponent = ART_MAP[item.art];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '45fr 55fr',
        borderRadius: 28,
        overflow: 'hidden',
        border: `1px solid ${T.border}`,
        background: T.bgCard,
        minHeight: 460,
        opacity: show ? 1 : 0,
        transform: show ? 'translateX(0)' : 'translateX(-14px)',
        transition: 'opacity .28s cubic-bezier(.4,0,.2,1), transform .28s cubic-bezier(.4,0,.2,1)',
      }}>
        {/* Info panel */}
        <div style={{
          padding: '52px 48px',
          display: 'flex', flexDirection: 'column',
          background: `radial-gradient(ellipse at 0% 0%, ${item.accent}10 0%, transparent 65%)`,
          borderRight: `1px solid ${T.border}`,
        }}>
          {/* Product icon */}
          <div style={{
            width: 58, height: 58, borderRadius: 18, flexShrink: 0,
            background: item.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 28,
            boxShadow: `0 16px 40px ${item.accent}35`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg,rgba(255,255,255,.18) 0%,transparent 60%)',
            }}/>
            {item.icon}
          </div>

          {/* Tagline chip */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: item.accent,
            marginBottom: 10,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: item.accent, display: 'inline-block' }}/>
            {item.tagline}
          </span>

          {/* Title */}
          <h2 className="pdv-serif" style={{
            fontSize: 40, fontWeight: 900, fontStyle: 'italic', color: T.textPrimary,
            margin: '0 0 14px 0', letterSpacing: '-.03em', lineHeight: 1.05,
          }}>{item.title}</h2>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 7, marginBottom: 18, flexWrap: 'wrap' }}>
            {item.badges.map(b => (
              <span key={b} style={{
                padding: '3px 9px', borderRadius: 20,
                background: `${item.accent}14`, border: `1px solid ${item.accent}28`,
                fontSize: 10.5, fontWeight: 700, color: item.accent, letterSpacing: '.04em',
              }}>{b}</span>
            ))}
          </div>

          {/* Description */}
          <p style={{
            fontSize: 14.5, color: T.textSec, lineHeight: 1.7,
            margin: '0 0 36px 0', flex: 1,
          }}>{item.description}</p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={item.ctaPrimary.action}
              style={{
                padding: '11px 22px', borderRadius: 12, border: 'none',
                background: item.gradient, color: 'var(--ui-text-primary)',
                fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: `0 6px 20px ${item.accent}28`,
                transition: 'all .2s cubic-bezier(.4,0,.2,1)',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 10px 32px ${item.accent}45`; }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow=`0 6px 20px ${item.accent}28`; }}
            >
              {item.ctaPrimary.label}
              <ArrowRight size={14} weight="bold" />
            </button>
            {item.ctaSecondary && (
              <button
                onClick={item.ctaSecondary.action}
                style={{
                  padding: '11px 20px', borderRadius: 12,
                  border: `1px solid ${T.border}`,
                  background: 'transparent', color: T.textSec,
                  fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                  transition: 'all .2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,.06)'; e.currentTarget.style.color=T.textPrimary; e.currentTarget.style.borderColor=T.borderMed; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color=T.textSec; e.currentTarget.style.borderColor=T.border; }}
              >
                {item.ctaSecondary.label}
              </button>
            )}
          </div>
        </div>

        {/* Art panel */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          background: `radial-gradient(ellipse at 70% 30%, ${item.accent}08 0%, ${T.bg} 70%)`,
        }}>
          {/* Mesh overlay */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            backgroundImage: `radial-gradient(circle, ${item.accent}18 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
            opacity: 0.35,
          }}/>
          {/* Art canvas / video */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            {item.videoSrc ? (
              <video
                key={item.videoSrc}
                src={item.videoSrc}
                autoPlay muted loop playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <ArtComponent />
            )}
          </div>
          {/* Center icon badge */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 22,
              background: item.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 20px 60px ${item.accent}50, 0 0 0 1px rgba(255,255,255,.12)`,
              animation: 'pdv-float-a 6s ease-in-out infinite',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,.2) 0%,transparent 55%)' }}/>
              {React.cloneElement(item.icon as React.ReactElement, { size: 32 })}
            </div>
            <div style={{
              padding: '5px 14px', borderRadius: 20,
              background: 'rgba(0,0,0,.6)',
              border: `1px solid ${T.border}`,
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)',
              letterSpacing: '.04em',
              backdropFilter: 'blur(12px)',
            }}>{item.title}</div>
          </div>
          {/* Edge fade */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 4,
            background: `linear-gradient(to right, ${T.bgCard}40 0%, transparent 20%, transparent 80%, ${T.bgCard}20 100%)`,
            pointerEvents: 'none',
          }}/>
        </div>
      </div>

      {/* Nav row */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, marginTop:18 }}>
        <NavArrow dir="left"  onClick={() => jump((idx-1+ITEMS.length)%ITEMS.length)} />
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {ITEMS.map((it,i) => (
            <button key={it.id} onClick={() => jump(i)} style={{
              width: i===idx ? 24 : 7, height: 7, borderRadius: 4,
              background: i===idx ? item.accent : 'rgba(255,255,255,.12)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'all .35s cubic-bezier(.4,0,.2,1)',
            }}/>
          ))}
        </div>
        <NavArrow dir="right" onClick={() => jump((idx+1)%ITEMS.length)} />
      </div>

      {/* Progress strip */}
      {!paused && (
        <div style={{ marginTop:10, height:2, background:'rgba(255,255,255,.04)', borderRadius:1, overflow:'hidden' }}>
          <div key={`${idx}-p`} style={{
            height:'100%', background:item.accent, borderRadius:1,
            animation:'pdv-progress 10s linear forwards', width:0,
          }}/>
        </div>
      )}
    </div>
  );
}

function NavArrow({ dir, onClick }: { dir:'left'|'right'; onClick:()=>void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:34, height:34, borderRadius:'50%',
        background: hov ? 'var(--ui-border-default)' : 'var(--surface-hover)',
        border: `1px solid ${hov ? T.borderMed : T.border}`,
        color: hov ? T.textPrimary : T.textSec,
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        transition:'all .18s',
      }}
    >
      {dir==='left' ? <CaretLeft size={13} weight="bold"/> : <CaretRight size={13} weight="bold"/>}
    </button>
  );
}

// ─── All Products Grid ────────────────────────────────────────────────────────

const ALL_PRODUCTS: MiniProduct[] = [
  { id:'chat',         name:'Chat',            description:'Conversational AI for everything',      icon:<Chat size={17} weight="fill"/>,         accent:'#D97757', gradient:'linear-gradient(135deg,#D97757,#B08D6E)', viewType:'chat',          status:'live',  category:'Core' },
  { id:'code',         name:'Allternit Code',  description:'AI pair programmer in your IDE',        icon:<Code size={17} weight="fill"/>,         accent:'var(--status-warning)', gradient:'linear-gradient(135deg,#f59e0b,#d97706)', viewType:'code',          status:'live',  category:'Core' },
  { id:'cowork',       name:'Cowork',          description:'Collaborative AI for teams',            icon:<UsersThree size={17} weight="fill"/>,   accent:'#06b6d4', gradient:'linear-gradient(135deg,#06b6d4,#0284c7)', viewType:'chat',          status:'live',  category:'Core' },
  { id:'computer-use', name:'Computer Use',    description:'AI that sees and controls browsers',    icon:<Monitor size={17} weight="fill"/>,      accent:'#5B8DEF', gradient:'linear-gradient(135deg,#5B8DEF,#3b5bdb)', viewType:'operator',      status:'live',  category:'AI Agents' },
  { id:'swarm',        name:'Swarm ADE',       description:'Orchestrate hundreds of AI agents',     icon:<Robot size={17} weight="fill"/>,        accent:'var(--status-success)', gradient:'linear-gradient(135deg,#10b981,#059669)', viewType:'swarm',         status:'live',  category:'AI Agents' },
  { id:'agent-hub',    name:'Agent Hub',       description:'Build, deploy, and manage agents',      icon:<Cpu size={17} weight="fill"/>,          accent:'#a78bfa', gradient:'linear-gradient(135deg,#a78bfa,#7c3aed)', viewType:'agent-hub',     status:'live',  category:'AI Agents' },
  { id:'canvas',       name:'Canvas',          description:'Documents built with AI',               icon:<Note size={17} weight="fill"/>,         accent:'#6366f1', gradient:'linear-gradient(135deg,#6366f1,#4f46e5)', viewType:'allternit-canvas', status:'beta', category:'Create' },
  { id:'design',       name:'Allternit Design', description:'Visual design and creative tools',     icon:<Palette size={17} weight="fill"/>,      accent:'#ec4899', gradient:'linear-gradient(135deg,#ec4899,#be185d)', viewType:'design',        status:'beta',  category:'Create' },
  { id:'workflow',     name:'Workflows',       description:'Visual automation and task pipelines',  icon:<GitBranch size={17} weight="fill"/>,    accent:'#14b8a6', gradient:'linear-gradient(135deg,#14b8a6,#0d9488)', viewType:'cowork-runs',   status:'beta',  category:'Create' },
  { id:'local-brain',  name:'Local Brain',     description:'Private offline AI on your machine',   icon:<Brain size={17} weight="fill"/>,        accent:'#8b5cf6', gradient:'linear-gradient(135deg,#8b5cf6,#6d28d9)', viewType:'models-manage', status:'live',  category:'Infrastructure' },
  { id:'cloud-deploy', name:'Cloud Deploy',    description:'Deploy Allternit nodes to any cloud',  icon:<RocketLaunch size={17} weight="fill"/>, accent:'var(--status-success)', gradient:'linear-gradient(135deg,#22c55e,#16a34a)', viewType:'deploy',        status:'live',  category:'Infrastructure' },
  { id:'browser',      name:'Browser Capsule', description:'AI assistant in every browser tab',    icon:<Puzzle size={17} weight="fill"/>,       accent:'#4285F4', gradient:'linear-gradient(135deg,#4285F4,#34A853)', viewType:'browser-ext',   status:'live',  category:'Surfaces' },
  { id:'desktop',      name:'Desktop App',     description:'Native app for macOS, Windows, Linux', icon:<Laptop size={17} weight="fill"/>,       accent:'var(--accent-primary)', gradient:'linear-gradient(135deg,#D4B08C,#B08D6E)', viewType:'desktop-dl',    status:'live',  category:'Surfaces' },
  { id:'labs',         name:'A://Labs',        description:'AI courses — 7 live in Canvas LMS',   icon:<GraduationCap size={17} weight="fill"/>, accent:'var(--status-warning)', gradient:'linear-gradient(135deg,#f59e0b,#b45309)', viewType:'labs',          status:'live',  category:'Learn' },
  { id:'marketplace',  name:'Marketplace',     description:'Discover plugins and extensions',      icon:<ShoppingBag size={17} weight="fill"/>,  accent:'var(--status-success)', gradient:'linear-gradient(135deg,#10b981,#059669)', viewType:'marketplace',   status:'beta',  category:'Ecosystem' },
  { id:'dev-portal',   name:'Dev Portal',      description:'APIs, SDKs, and documentation',        icon:<ArrowSquareOut size={17}/>,             accent:'#6366f1', gradient:'linear-gradient(135deg,#6366f1,#4338ca)', viewType:'dev-portal',    status:'live',  category:'Ecosystem' },
];

const CATEGORIES = ['Core','AI Agents','Create','Infrastructure','Surfaces','Learn','Ecosystem'] as const;

const STATUS_STYLE: Record<ProductStatus, { label:string; color:string; bg:string; border:string }> = {
  'live': { label:'Live',        color:'var(--status-success)', bg:'rgba(34,197,94,.1)',   border:'rgba(34,197,94,.2)' },
  'beta': { label:'Beta',        color:'var(--status-warning)', bg:'rgba(245,158,11,.1)',  border:'rgba(245,158,11,.2)' },
  'soon': { label:'Coming Soon', color:'var(--ui-text-muted)',    bg:'var(--surface-hover)', border:'var(--ui-border-default)' },
};

function ProductMiniCard({ p }: { p: MiniProduct }) {
  const [hov, setHov] = useState(false);
  const ss = STATUS_STYLE[p.status];
  const BROWSER_OPEN: Record<string, string> = {
    'browser-ext': 'https://chrome.google.com/webstore',
    'desktop-dl':  'https://allternit.com/download',
    'dev-portal':  'https://docs.allternit.com',
  };
  const onClick = p.viewType
    ? BROWSER_OPEN[p.viewType]
      ? () => openInBrowser(BROWSER_OPEN[p.viewType!])
      : () => useNav.getState().dispatch({ type:'OPEN_VIEW', viewType: p.viewType as any })
    : undefined;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 16,
        background: hov ? T.bgElevated : T.bgCard,
        border: `1px solid ${hov ? p.accent+'30' : T.border}`,
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all .2s cubic-bezier(.4,0,.2,1)',
        transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? `0 12px 32px ${p.accent}14` : 'none',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: hov ? p.gradient : 'transparent',
        transition: 'all .2s',
        borderRadius: '16px 16px 0 0',
      }}/>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: hov ? `${p.accent}22` : `${p.accent}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: p.accent, transition: 'all .2s', flexShrink: 0,
        }}>{p.icon}</div>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em',
          color: ss.color, background: ss.bg, border: `1px solid ${ss.border}`,
          padding: '2px 8px', borderRadius: 20,
        }}>{ss.label}</span>
      </div>
      <div>
        <div style={{ fontSize:13.5, fontWeight:600, color: hov ? T.textPrimary : 'var(--ui-text-primary)', marginBottom:4, transition:'color .2s' }}>
          {p.name}
        </div>
        <div style={{ fontSize:12, color:T.textSec, lineHeight:1.55 }}>{p.description}</div>
      </div>
      {onClick && (
        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, color: hov ? p.accent : T.textTer, marginTop:'auto', transition:'color .2s', fontWeight:500 }}>
          Open <ArrowRight size={11} weight="bold"/>
        </div>
      )}
    </div>
  );
}

// ─── Infrastructure Section ───────────────────────────────────────────────────

function InfraSection() {
  const opts = [
    { icon:<RocketLaunch size={19} color="var(--status-success)"/>, ibg:'rgba(34,197,94,.1)', accent:'var(--status-success)', badge:'New', title:'Cloud Deploy', desc:'Deploy Allternit nodes to Hetzner, AWS, or DigitalOcean in minutes.', cta:'Get Started', onClick:()=>useNav.getState().dispatch({type:'OPEN_VIEW',viewType:'deploy' as any}) },
    { icon:<Cpu size={19} color="var(--accent-primary)"/>, ibg:'rgba(212,176,140,.1)', accent:'var(--accent-primary)', badge:undefined, title:'Connect VPS', desc:'Bring your own server. Connect any VPS with SSH in seconds.', cta:'Connect', onClick:()=>window.dispatchEvent(new CustomEvent('allternit:open-settings',{detail:{section:'infrastructure',tab:'connections'}})) },
    { icon:<Stack size={19} color="#7b68ee"/>, ibg:'rgba(123,104,238,.1)', accent:'#7b68ee', badge:undefined, title:'Environments', desc:'Railway-style setup. Devcontainers, Nix, sandboxes.', cta:'Browse', onClick:()=>window.dispatchEvent(new CustomEvent('allternit:open-settings',{detail:{section:'infrastructure',tab:'environments'}})) },
  ];
  return (
    <div style={{ borderRadius:24, border:`1px solid ${T.border}`, background:T.bgCard, padding:'40px 44px', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-70, right:-70, width:240, height:240, background:'radial-gradient(circle,rgba(212,176,140,.07) 0%,transparent 70%)', filter:'blur(40px)', pointerEvents:'none' }}/>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:26, position:'relative' }}>
        <div style={{ width:46, height:46, borderRadius:13, background:'rgba(212,176,140,.1)', border:`1px solid ${T.brandBorder}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <HardDrives size={22} color={T.brand}/>
        </div>
        <div>
          <h3 style={{ fontSize:20, fontWeight:600, color:T.textPrimary, margin:'0 0 2px 0' }}>Deploy Your Infrastructure</h3>
          <p style={{ fontSize:13, color:T.textSec, margin:0 }}>BYOC, VPS, or Cloud — your agents, your servers.</p>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22, position:'relative' }}>
        {opts.map(o => (
          <button key={o.title} onClick={o.onClick} style={{ padding:'20px', borderRadius:14, border:`1px solid ${T.border}`, background:'rgba(255,255,255,.02)', cursor:'pointer', textAlign:'left', transition:'all .2s' }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=`${o.accent}35`;e.currentTarget.style.background=`${o.accent}08`;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background='rgba(255,255,255,.02)';}}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:o.ibg, display:'flex', alignItems:'center', justifyContent:'center' }}>{o.icon}</div>
              {o.badge && <span style={{ fontSize:10, color:o.accent, fontWeight:700 }}>{o.badge}</span>}
            </div>
            <h4 style={{ fontSize:14.5, fontWeight:600, color:T.textPrimary, margin:'0 0 5px 0' }}>{o.title}</h4>
            <p style={{ fontSize:12, color:T.textSec, margin:'0 0 12px 0', lineHeight:1.5 }}>{o.desc}</p>
            <div style={{ display:'flex', alignItems:'center', gap:5, color:o.accent, fontSize:12, fontWeight:500 }}>{o.cta} <ArrowRight size={11}/></div>
          </button>
        ))}
      </div>
      <div style={{ display:'flex', gap:18, padding:'14px 0 0', borderTop:`1px solid ${T.border}`, flexWrap:'wrap', alignItems:'center' }}>
        {[{i:<Shield size={12} color={T.textTer}/>,l:'End-to-end encrypted'},{i:<Key size={12} color={T.textTer}/>,l:'SSH key management'},{i:<Globe size={12} color={T.textTer}/>,l:'5 cloud providers'}].map(f=>(
          <div key={f.l} style={{display:'flex',alignItems:'center',gap:6}}>{f.i}<span style={{fontSize:11.5,color:T.textTer}}>{f.l}</span></div>
        ))}
        <div style={{flex:1}}/>
        <button onClick={()=>window.dispatchEvent(new CustomEvent('allternit:open-settings',{detail:{section:'infrastructure'}}))}
          style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${T.brandBorder}`,background:T.brandDim,color:T.brand,fontSize:12,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:5,transition:'all .2s'}}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(212,176,140,.18)';}} onMouseLeave={e=>{e.currentTarget.style.background=T.brandDim;}}>
          Manage Infrastructure <ArrowRight size={11}/>
        </button>
      </div>
    </div>
  );
}

// ─── Browser Extension Detail ─────────────────────────────────────────────────

function ExtensionDetail({ onClose }: { onClose:()=>void }) {
  const [tab, setTab] = useState<'chrome'|'firefox'|'build'>('chrome');
  const [copied, setCopied] = useState<string|null>(null);
  const copy = (s:string) => { navigator.clipboard.writeText(s); setCopied(s); setTimeout(()=>setCopied(null),2000); };

  const features = [
    {i:<Cursor size={20} color="#4285F4"/>,t:'Browser Automation',d:'Click, type, scroll, interact with any page.',sc:'Ctrl+Shift+A'},
    {i:<Chat size={20} color="#34A853"/>,t:'Ask AI Anywhere',d:'Select text and ask, explain, or rewrite.',sc:'Ctrl+Shift+Q'},
    {i:<Camera size={20} color="#EA4335"/>,t:'Screenshot Analysis',d:'Capture and analyze visual content.',sc:'Ctrl+Shift+S'},
    {i:<FileText size={20} color="#FBBC04"/>,t:'Page Summarization',d:'Instant summaries of any page.',sc:'Ctrl+Shift+Z'},
    {i:<TextT size={20} color="#4285F4"/>,t:'Smart Form Filling',d:'AI-assisted form completion.',sc:'Ctrl+Shift+F'},
    {i:<Lightning size={20} color="#34A853"/>,t:'Quick Access',d:'Access agents from any tab, instantly.',sc:'Ctrl+Shift+G'},
  ];
  const cmds = [
    {l:'Clone repository',c:'git clone https://github.com/allternit/chrome-extension.git'},
    {l:'Install dependencies',c:'cd chrome-extension && npm install'},
    {l:'Build extension',c:'npm run build:prod'},
    {l:'Load in Chrome',c:'chrome://extensions → Developer mode → Load unpacked → dist/'},
  ];

  return (
    <div style={{ marginTop:24, borderRadius:24, border:`1px solid rgba(66,133,244,.18)`, background:T.bgCard, padding:'40px', position:'relative', overflow:'hidden' }}>
      <div style={{position:'absolute',top:-60,right:-40,width:240,height:240,background:'radial-gradient(circle,rgba(66,133,244,.08) 0%,transparent 70%)',filter:'blur(50px)',pointerEvents:'none'}}/>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28,position:'relative'}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{width:46,height:46,borderRadius:13,background:'linear-gradient(135deg,#4285F4,#34A853)',display:'flex',alignItems:'center',justifyContent:'center'}}><Puzzle size={24} color="var(--ui-text-primary)"/></div>
          <div>
            <h3 style={{fontSize:20,fontWeight:600,color:T.textPrimary,margin:'0 0 2px 0'}}>Allternit Browser Capsule</h3>
            <p style={{fontSize:12.5,color:T.textSec,margin:0}}>Version 1.0.0 · Free · Open Source</p>
          </div>
        </div>
        <button onClick={onClose} style={{width:32,height:32,borderRadius:8,background:'rgba(255,255,255,.04)',border:`1px solid ${T.border}`,color:T.textSec,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}
          onMouseEnter={e=>{e.currentTarget.style.color=T.textPrimary;e.currentTarget.style.background='rgba(255,255,255,.08)';}} onMouseLeave={e=>{e.currentTarget.style.color=T.textSec;e.currentTarget.style.background='rgba(255,255,255,.04)';}}>
          <X size={15}/>
        </button>
      </div>

      <div style={{display:'flex',gap:5,marginBottom:28,padding:4,background:'rgba(255,255,255,.03)',borderRadius:10,width:'fit-content'}}>
        {([['chrome','Chrome'],[' firefox','Firefox'],['build','Build']] as const).map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id as any)} style={{padding:'8px 16px',borderRadius:8,border:'none',background:tab===id?'var(--status-info-bg)':'transparent',color:tab===id?'#4285F4':T.textSec,fontSize:13,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:6,transition:'all .2s'}}>
            {id==='chrome'&&<ChromeIcon size={14}/>}{id===' firefox'&&<FirefoxIcon size={14}/>}{id==='build'&&<Wrench size={14}/>}
            {label}
          </button>
        ))}
      </div>

      <div style={{marginBottom:32}}>
        {(tab==='chrome'||tab==='firefox') && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              {(tab==='chrome'
                ? [{href:'https://chrome.google.com/webstore',icon:<ChromeIcon size={26}/>,label:'Chrome Web Store',sub:'Official · Auto-updates',accent:'#4285F4'},{href:'https://github.com/allternit/chrome-extension/releases',icon:<span style={{color:'var(--accent-primary)'}}><ArrowSquareOut size={26}/></span>,label:'Download .crx',sub:'Manual · Latest build',accent:'var(--accent-primary)'}]
                : [{href:'https://addons.mozilla.org',icon:<FirefoxIcon size={26}/>,label:'Firefox Add-ons',sub:'Official · Auto-updates',accent:'#FF7139'},{href:'https://github.com/allternit/firefox-extension/releases',icon:<span style={{color:'var(--accent-primary)'}}><ArrowSquareOut size={26}/></span>,label:'Download .xpi',sub:'Manual · Latest build',accent:'var(--accent-primary)'}]
              ).map(l=>(
                <button key={l.href} onClick={() => openInBrowser(l.href)} style={{padding:'16px 18px',borderRadius:12,background:`${l.accent}0e`,border:`1px solid ${l.accent}25`,textDecoration:'none',display:'flex',alignItems:'center',gap:12,transition:'all .2s',cursor:'pointer'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}>
                  <div style={{color:l.accent}}>{l.icon}</div>
                  <div><div style={{fontSize:13.5,fontWeight:600,color:T.textPrimary,marginBottom:2}}>{l.label}</div><div style={{fontSize:11.5,color:T.textSec}}>{l.sub}</div></div>
                  <ArrowSquareOut size={14} color={l.accent} style={{marginLeft:'auto'}}/>
                </button>
              ))}
            </div>
            <div style={{padding:'11px 14px',background:'rgba(34,197,94,.07)',borderRadius:9,border:'1px solid rgba(34,197,94,.15)',display:'flex',alignItems:'center',gap:9}}>
              <CheckCircle size={14} color="var(--status-success)"/>
              <span style={{fontSize:12,color:'var(--status-success)'}}>{tab==='chrome'?'Compatible with Chrome, Edge, Brave, Opera, and all Chromium-based browsers':'Compatible with Firefox, Waterfox, LibreWolf, and Firefox-based browsers'}</span>
            </div>
          </div>
        )}
        {tab==='build'&&(
          <div>
            <p style={{fontSize:12.5,color:T.textSec,marginBottom:16}}>Build from source for the latest features and development.</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {cmds.map((c,i)=>(
                <div key={i} style={{padding:'13px 16px',background:'rgba(0,0,0,.25)',borderRadius:10,border:`1px solid ${T.border}`,display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:'var(--status-info-bg)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--status-info)',fontWeight:700,flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1}}><div style={{fontSize:10.5,color:T.textTer,marginBottom:3}}>{c.l}</div><code style={{fontSize:12.5,color:'var(--accent-primary)',fontFamily:'monospace'}}>{c.c}</code></div>
                  <button onClick={()=>copy(c.c)} style={{padding:6,borderRadius:7,background:copied===c.c?'rgba(34,197,94,.14)':'rgba(255,255,255,.04)',border:'none',cursor:'pointer',color:copied===c.c?'var(--status-success)':T.textSec,transition:'all .2s'}}>
                    {copied===c.c?<CheckCircle size={13}/>:<Copy size={13}/>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <h4 style={{fontSize:15,fontWeight:600,color:T.textPrimary,margin:'0 0 14px 0'}}>Features</h4>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:24}}>
        {features.map((f,i)=>(
          <div key={i} style={{padding:'16px',background:'rgba(255,255,255,.02)',borderRadius:12,border:`1px solid ${T.border}`,transition:'all .2s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--status-info-bg)';e.currentTarget.style.background='rgba(255,255,255,.04)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background='rgba(255,255,255,.02)';}}>
            <div style={{marginBottom:9}}>{f.i}</div>
            <h5 style={{fontSize:12.5,fontWeight:600,color:T.textPrimary,margin:'0 0 5px 0'}}>{f.t}</h5>
            <p style={{fontSize:11.5,color:T.textSec,margin:'0 0 10px 0',lineHeight:1.5}}>{f.d}</p>
            <div style={{display:'inline-flex',alignItems:'center',gap:3,padding:'2px 7px',background:'var(--surface-hover)',borderRadius:5,fontSize:10.5,color:T.textTer,fontFamily:'monospace'}}>
              <Command size={9}/> {f.sc}
            </div>
          </div>
        ))}
      </div>

      <div style={{padding:'14px 16px',background:'rgba(255,255,255,.02)',borderRadius:12,border:`1px solid ${T.border}`}}>
        <p style={{fontSize:12,fontWeight:600,color:T.textPrimary,margin:'0 0 12px 0'}}>Supported Browsers</p>
        <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
          {[{i:<ChromeIcon size={16}/>,n:'Chrome',v:'88+'},{i:<FirefoxIcon size={16}/>,n:'Firefox',v:'109+'},{i:<EdgeIcon size={16}/>,n:'Edge',v:'88+'},{i:<span style={{color:'#FBBC04'}}><ArrowSquareOut size={16}/></span>,n:'Brave',v:'1.20+'},{i:<span style={{color:'#FF1B2D'}}><ArrowSquareOut size={16}/></span>,n:'Opera',v:'74+'}].map((b,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:7}}>{b.i}<div><div style={{fontSize:12,color:T.textPrimary}}>{b.n}</div><div style={{fontSize:10,color:T.textTer}}>{b.v}</div></div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Desktop download platforms ───────────────────────────────────────────────

function DesktopBanner() {
  const platforms = [
    { icon:<AppleIcon size={16}/>, label:'macOS', sub:'Apple Silicon & Intel' },
    { icon:<WindowsIcon size={16}/>, label:'Windows', sub:'Windows 10/11' },
    { icon:<LinuxIcon size={16}/>, label:'Linux', sub:'.deb · .rpm · AppImage' },
  ];
  return (
    <div style={{borderRadius:24,border:`1px solid ${T.border}`,background:T.bgCard,padding:'36px 44px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-60,left:-60,width:200,height:200,background:`radial-gradient(circle,${T.brandDim} 0%,transparent 70%)`,filter:'blur(40px)',pointerEvents:'none'}}/>
      <div style={{display:'flex',alignItems:'center',gap:18,position:'relative'}}>
        <div style={{width:50,height:50,borderRadius:14,background:'linear-gradient(135deg,#D4B08C,#B08D6E)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 10px 30px rgba(212,176,140,.28)'}}>
          <Laptop size={24} color="var(--ui-text-primary)"/>
        </div>
        <div>
          <h3 style={{fontSize:18,fontWeight:600,color:T.textPrimary,margin:'0 0 4px 0'}}>Allternit Desktop</h3>
          <p style={{fontSize:13,color:T.textSec,margin:0}}>The full platform as a native application.</p>
        </div>
      </div>
      <div style={{display:'flex',gap:10,position:'relative'}}>
        {platforms.map(pl=>(
          <button key={pl.label} onClick={() => openInBrowser('https://allternit.com/download')} style={{padding:'9px 16px',borderRadius:10,border:`1px solid ${T.border}`,background:'rgba(255,255,255,.04)',color:T.textSec,fontSize:12,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',gap:7,transition:'all .2s'}}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.08)';e.currentTarget.style.color=T.textPrimary;e.currentTarget.style.borderColor=T.borderMed;}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.04)';e.currentTarget.style.color=T.textSec;e.currentTarget.style.borderColor=T.border;}}>
            {pl.icon} {pl.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Video Showcase Cards ─────────────────────────────────────────────────────

interface VideoCard {
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  videoSrc?: string;
  artType: ArtType;
  cta: string;
  onCta: () => void;
}

function VideoShowcaseSection() {
  const d = (vt: string) => () => useNav.getState().dispatch({ type: 'OPEN_VIEW', viewType: vt as any });
  const headRef = useScrollReveal();

  const cards: VideoCard[] = [
    {
      badge: 'Live',
      badgeColor: 'var(--status-success)',
      title: 'Cowork',
      description: 'Put AI to work on tasks while you step away. Delegate entire workflows and collaborate in real-time with your team.',
      videoSrc: '/videos/cowork-demo.mp4',
      artType: 'chat',
      cta: 'Try Cowork',
      onCta: d('chat'),
    },
    {
      badge: 'Beta',
      badgeColor: 'var(--status-warning)',
      title: 'Allternit Canvas',
      description: 'A new kind of document. Prompt to draft, AI refines inline. The blank page — replaced forever.',
      videoSrc: '/videos/canvas-demo.mp4',
      artType: 'canvas-doc',
      cta: 'Open Canvas',
      onCta: d('allternit-canvas'),
    },
    {
      badge: 'Live',
      badgeColor: '#5B8DEF',
      title: 'Computer Use',
      description: 'AI that sees your screen and takes real actions. Navigate, click, fill forms, extract data — fully automated.',
      artType: 'computer-use',
      cta: 'Open Operator',
      onCta: d('operator'),
    },
  ];

  return (
    <div style={{ marginBottom: 80 }}>
      <div ref={headRef} style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 32 }}>
        <h2 className="pdv-display" style={{ fontSize: 22, fontWeight: 800, color: T.textPrimary, margin: 0, letterSpacing: '-.01em' }}>Product Highlights</h2>
        <span style={{ fontSize: 11, color: T.textTer, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>New releases</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {cards.map(card => {
          const Art = ART_MAP[card.artType];
          return (
            <div key={card.title} style={{ borderRadius: 20, border: `1px solid ${T.border}`, background: T.bgCard, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color .22s, box-shadow .22s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.borderMed; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 48px rgba(0,0,0,.4)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.border; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
            >
              {/* Video / Art top panel */}
              <div style={{ position: 'relative', height: 220, background: 'var(--surface-panel)', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ position: 'absolute', inset: 0 }}>
                  {card.videoSrc ? (
                    <video
                      key={card.videoSrc}
                      src={card.videoSrc}
                      autoPlay muted loop playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <Art />
                  )}
                </div>
                {/* Bottom fade into card */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: `linear-gradient(transparent, ${T.bgCard})`, pointerEvents: 'none' }}/>
              </div>
              {/* Info panel */}
              <div style={{ padding: '22px 26px 26px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <span className="pdv-display" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: card.badgeColor }}>
                  {card.badge}
                </span>
                <h3 className="pdv-serif" style={{ fontSize: 22, fontWeight: 900, fontStyle: 'italic', color: T.textPrimary, margin: 0, letterSpacing: '-.02em', lineHeight: 1.15 }}>{card.title}</h3>
                <p style={{ fontSize: 13, color: T.textSec, margin: 0, lineHeight: 1.65, flex: 1 }}>{card.description}</p>
                <button
                  onClick={card.onCta}
                  style={{ marginTop: 6, padding: '8px 16px', borderRadius: 10, border: `1px solid ${T.borderMed}`, background: 'var(--surface-hover)', color: T.textPrimary, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content', transition: 'all .18s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--ui-border-default)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = T.borderStr; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = T.borderMed; }}
                >
                  {card.cta} <ArrowRight size={12} weight="bold" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Social Proof / "What Builders Are Shipping" ──────────────────────────────

const TESTIMONIALS = [
  {
    category: 'Engineering',
    catColor: '#5B8DEF',
    subject: '60% faster PR reviews with Allternit Code',
    handle: '@salimadeniji',
    name: 'Salima Adeniji',
    content: 'Switched our team to Allternit Code last sprint. PR cycle time dropped from 4 days to 36 hours. The repo-level context is the difference — it actually understands the codebase, not just the file.',
  },
  {
    category: 'AI Research',
    catColor: '#a78bfa',
    subject: 'Swarm ADE running 200+ parallel agents',
    handle: '@rk_machinelearning',
    name: 'Rohan Kapoor',
    content: 'Spun up 200 parallel research agents in Swarm ADE to process a full corpus of ML papers. Tasks that took weeks are now overnight jobs. The orchestration layer is genuinely brilliant.',
  },
  {
    category: 'Product',
    catColor: '#D97757',
    subject: 'Entire product spec drafted in one Canvas session',
    handle: '@lenavogt_pm',
    name: 'Lena Vogt',
    content: 'Used Allternit Canvas to draft our Q3 roadmap. AI refined the doc inline as I added context. Shared with eng 2 hours later. No more back and forth on Notion.',
  },
  {
    category: 'Automation',
    catColor: 'var(--status-success)',
    subject: 'Browser Capsule automating our QA pipeline',
    handle: '@jacksontechlead',
    name: 'Jackson Wu',
    content: 'Hooked Browser Capsule into our QA flow. It navigates, fills test data, captures screenshots and posts a Slack report — zero manual steps. Our QA team now focuses on edge cases only.',
  },
  {
    category: 'Privacy',
    catColor: '#8b5cf6',
    subject: 'Local Brain — HIPAA-compliant AI, finally',
    handle: '@drmayaortiz',
    name: 'Dr. Maya Ortiz',
    content: 'Running Local Brain on-prem for clinical note drafting. No data leaves the machine. Compliance team signed off in a day. This is the only way healthcare can actually use AI.',
  },
  {
    category: 'Infrastructure',
    catColor: 'var(--status-success)',
    subject: 'Deployed 12 nodes to Hetzner in under 10 minutes',
    handle: '@tobias_devops',
    name: 'Tobias Richter',
    content: 'Cloud Deploy is wild. Spun up 12 Allternit nodes across three Hetzner regions with SSH key management, env injection, and health checks — from the UI. No Terraform, no YAML.',
  },
];

function TestimonialCard({ t, featured = false }: { t: typeof TESTIMONIALS[0]; featured?: boolean }) {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        borderRadius: 20, border: `1px solid ${T.border}`,
        background: featured ? T.bgElevated : T.bgCard,
        padding: featured ? '36px 36px 32px' : '26px 28px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        position: 'relative', overflow: 'hidden',
        transition: 'border-color .25s, box-shadow .25s',
        height: '100%', boxSizing: 'border-box',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.borderMed; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 40px rgba(0,0,0,.3)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.border; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {/* Decorative giant quote mark */}
      <div className="pdv-quote-mark">"</div>

      {/* Category + X icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <span className="pdv-display" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: t.catColor }}>
          {t.category}
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill={T.textTer}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </div>

      {/* Subject — Fraunces for impact */}
      <p className="pdv-serif" style={{ fontSize: featured ? 22 : 17, fontWeight: 700, color: T.textPrimary, margin: 0, lineHeight: 1.3, letterSpacing: '-.02em', fontStyle: 'italic', position: 'relative' }}>
        {t.subject}
      </p>

      {/* Content */}
      <p style={{ fontSize: featured ? 14 : 13, color: T.textSec, margin: 0, lineHeight: 1.72, flex: 1, position: 'relative' }}>
        {t.content}
      </p>

      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4, borderTop: `1px solid ${T.border}`, position: 'relative' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${t.catColor}18`, border: `1px solid ${t.catColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: t.catColor, flexShrink: 0 }}>
          {t.name[0]}
        </div>
        <div>
          <div className="pdv-display" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ui-text-secondary)' }}>{t.name}</div>
          <div style={{ fontSize: 10.5, color: T.textTer }}>{t.handle}</div>
        </div>
      </div>
    </div>
  );
}

function SocialProofSection() {
  const headRef = useScrollReveal();
  return (
    <div style={{ marginBottom: 80 }}>
      {/* Editorial header */}
      <div ref={headRef} style={{ marginBottom: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${T.border}, transparent)` }}/>
          <span className="pdv-display" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: T.textTer }}>Builder stories</span>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, ${T.border}, transparent)` }}/>
        </div>
        <h2 className="pdv-serif" style={{ fontSize: 48, fontWeight: 900, fontStyle: 'italic', color: T.textPrimary, margin: '0 0 10px 0', letterSpacing: '-.03em', lineHeight: 1.05 }}>
          See what builders<br/>are shipping
        </h2>
        <p className="pdv-display" style={{ fontSize: 14, color: T.textSec, margin: 0, letterSpacing: '.01em' }}>Real teams. Real results. Unfiltered.</p>
      </div>

      {/* Featured + stacked layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Featured left */}
        <TestimonialCard t={TESTIMONIALS[0]} featured />
        {/* Right: two stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TestimonialCard t={TESTIMONIALS[1]} />
          <TestimonialCard t={TESTIMONIALS[2]} />
        </div>
      </div>

      {/* Bottom row: 3 equal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <TestimonialCard t={TESTIMONIALS[3]} />
        <TestimonialCard t={TESTIMONIALS[4]} />
        <TestimonialCard t={TESTIMONIALS[5]} />
      </div>
    </div>
  );
}

// ─── Website Links ────────────────────────────────────────────────────────────

function WebsiteLinksSection() {
  const ref = useScrollReveal();

  const secondaryLinks = [
    { label: 'Docs', href: 'https://docs.allternit.com' },
    { label: 'GitHub', href: 'https://github.com/allternit' },
    { label: 'Discord', href: 'https://discord.gg/allternit' },
    { label: 'X / Twitter', href: 'https://x.com/allternit' },
    { label: 'Changelog', href: 'https://allternit.com/changelog' },
    { label: 'API Reference', href: 'https://docs.allternit.com/api' },
  ];

  return (
    <div ref={ref} style={{ marginBottom: 80, borderRadius: 24, border: `1px solid ${T.border}`, background: T.bgCard, padding: '48px 52px', position: 'relative', overflow: 'hidden' }}>
      {/* Background mesh */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, background: `radial-gradient(circle, ${T.brandDim} 0%, transparent 65%)`, filter: 'blur(60px)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: -60, left: -40, width: 220, height: 220, background: 'radial-gradient(circle, rgba(91,141,239,.06) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }}/>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 48 }}>
        {/* Left: Featured CTA */}
        <div style={{ flexShrink: 0 }}>
          <span className="pdv-display" style={{ display: 'block', fontSize: 9.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: T.textTer, marginBottom: 10 }}>
            Official website
          </span>
          <button
            onClick={() => openInBrowser('https://allternit.com')}
            className="pdv-link-ul"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <span className="pdv-serif" style={{ fontSize: 38, fontWeight: 900, fontStyle: 'italic', color: T.brand, letterSpacing: '-.03em', lineHeight: 1 }}>
              allternit.com
            </span>
            <ArrowSquareOut size={18} color={T.brand} style={{ opacity: .7, marginTop: 4 }}/>
          </button>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 64, background: T.border, flexShrink: 0 }}/>

        {/* Right: Link strip */}
        <div style={{ flex: 1 }}>
          <span className="pdv-display" style={{ display: 'block', fontSize: 9.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: T.textTer, marginBottom: 14 }}>
            Resources & community
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 0' }}>
            {secondaryLinks.map((lk, i) => (
              <React.Fragment key={lk.label}>
                <button
                  onClick={() => openInBrowser(lk.href)}
                  className="pdv-link-ul"
                  style={{ background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: T.textSec, padding: '0 16px', transition: 'color .18s', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.color = T.textPrimary; }}
                  onMouseLeave={e => { e.currentTarget.style.color = T.textSec; }}
                >
                  {lk.label}
                </button>
                {i < secondaryLinks.length - 1 && (
                  <div style={{ width: 1, height: 16, background: T.border, alignSelf: 'center' }}/>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export const ProductsDiscoveryView: React.FC = () => {
  const [showExt, setShowExt] = useState(false);

  return (
    <div className="pdv-root" style={{ height:'100vh', overflowY:'auto', background:T.bg, padding:'60px 80px', color:T.textPrimary }}>
      <style>{PDV_CSS}</style>

      {/* Close */}
      <button
        onClick={() => useNav.getState().dispatch({ type: 'OPEN_VIEW', viewType: 'chat' })}
        style={{ position:'fixed', top:18, right:18, width:38, height:38, borderRadius:10, background:'var(--surface-hover)', border:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.textSec, transition:'all .2s', zIndex:100 }}
        onMouseEnter={e=>{e.currentTarget.style.background='var(--ui-border-default)';e.currentTarget.style.color=T.textPrimary;}}
        onMouseLeave={e=>{e.currentTarget.style.background='var(--surface-hover)';e.currentTarget.style.color=T.textSec;}}
      ><X size={16}/></button>

      <div style={{ maxWidth:1160, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:72, position:'relative', paddingTop:12 }}>
          {/* Ambient glow orbs */}
          <div style={{ position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)', width:600, height:400, background:'radial-gradient(ellipse at 50% 40%, rgba(212,176,140,.10) 0%, rgba(217,119,87,.06) 40%, transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', top:40, left:'15%', width:180, height:180, background:'radial-gradient(circle, rgba(217,119,87,.06) 0%, transparent 70%)', filter:'blur(30px)', pointerEvents:'none' }}/>
          <div style={{ position:'absolute', top:20, right:'12%', width:140, height:140, background:'radial-gradient(circle, rgba(212,176,140,.08) 0%, transparent 70%)', filter:'blur(24px)', pointerEvents:'none' }}/>

          <div style={{ position:'relative' }}>
            {/* Eyebrow */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:28 }}>
              <div style={{ width:24, height:1, background:T.brand, opacity:.5 }}/>
              <span className="pdv-display" style={{ fontSize:10, fontWeight:700, letterSpacing:'.2em', textTransform:'uppercase', color:T.brand }}>Allternit Platform</span>
              <div style={{ width:24, height:1, background:T.brand, opacity:.5 }}/>
            </div>

            {/* Main headline — Fraunces for the gradient line */}
            <h1 style={{ margin:'0 0 20px 0', lineHeight:1.03 }}>
              <span className="pdv-display" style={{ display:'block', fontSize:56, fontWeight:800, color:T.textPrimary, letterSpacing:'-.04em', lineHeight:1.07 }}>
                Everything you need
              </span>
              <span className="pdv-serif" style={{ display:'block', fontSize:62, fontWeight:900, letterSpacing:'-.03em', lineHeight:1.0, fontStyle:'italic', background:'linear-gradient(100deg,#D97757 0%,#D4B08C 45%,#f59e0b 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                to build with AI
              </span>
            </h1>

            <p className="pdv-display" style={{ fontSize:16, color:T.textSec, margin:'0 auto', maxWidth:420, lineHeight:1.7, fontWeight:400, letterSpacing:'.01em' }}>
              One platform. Every surface. Powered by any model.
            </p>

            {/* Decorative rule */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginTop:36 }}>
              <div style={{ width:48, height:1, background:`linear-gradient(to right, transparent, ${T.border})` }}/>
              <Sparkle size={11} color={T.brand} weight="fill" style={{ opacity:.6 }}/>
              <div style={{ width:48, height:1, background:`linear-gradient(to left, transparent, ${T.border})` }}/>
            </div>
          </div>
        </div>

        {/* Spotlight Carousel */}
        <div style={{ marginBottom:64 }}>
          <SpotlightCarousel />
        </div>

        {/* Video Showcase — real product demos */}
        <VideoShowcaseSection />

        {/* Social Proof */}
        <SocialProofSection />

        {/* Website Links */}
        <WebsiteLinksSection />

        {/* All Products */}
        <div style={{ marginBottom:56 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:32 }}>
            <h2 className="pdv-display" style={{ fontSize:22, fontWeight:800, color:T.textPrimary, margin:0, letterSpacing:'-.01em' }}>All Products</h2>
            <span style={{ fontSize:12, color:T.textTer }}>{ALL_PRODUCTS.length} products</span>
          </div>
          {CATEGORIES.map(cat => {
            const ps = ALL_PRODUCTS.filter(p => p.category === cat);
            if (!ps.length) return null;
            return (
              <div key={cat} style={{ marginBottom:32 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:T.textTer }}>{cat}</span>
                  <div style={{ flex:1, height:1, background:T.border }}/>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                  {ps.map(p => <ProductMiniCard key={p.id} p={p}/>)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop */}
        <div style={{ marginBottom:20 }}>
          <DesktopBanner />
        </div>

        {/* Browser Capsule */}
        <div style={{ marginBottom:20 }}>
          <div style={{ borderRadius:24, border:`1px solid rgba(66,133,244,.16)`, background:T.bgCard, padding:'32px 44px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-40, right:60, width:120, height:120, background:'radial-gradient(circle,rgba(66,133,244,.12) 0%,transparent 70%)', filter:'blur(24px)', animation:'pdv-float-a 8s ease-in-out infinite', pointerEvents:'none' }}/>
            <div style={{ display:'flex', alignItems:'center', gap:18, position:'relative' }}>
              <div style={{ width:50, height:50, borderRadius:14, background:'linear-gradient(135deg,#4285F4,#34A853)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 10px 28px rgba(66,133,244,.28)' }}><Puzzle size={24} color="var(--ui-text-primary)"/></div>
              <div>
                <h3 style={{ fontSize:18, fontWeight:600, color:T.textPrimary, margin:'0 0 4px 0' }}>Allternit Browser Capsule</h3>
                <p style={{ fontSize:13, color:T.textSec, margin:0 }}>AI in every tab. Click, automate, and analyze any webpage.</p>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, position:'relative' }}>
              <button onClick={() => openInBrowser('https://chrome.google.com/webstore')} style={{ padding:'9px 16px', borderRadius:10, border:'1px solid #4285F4', background:'rgba(66,133,244,.1)', color:'var(--status-info)', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'all .2s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--status-info-bg)';e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(66,133,244,.1)';e.currentTarget.style.transform='translateY(0)';}}>
                <ChromeIcon size={14}/> Add to Chrome
              </button>
              <button onClick={() => setShowExt(v=>!v)} style={{ padding:'9px 16px', borderRadius:10, border:`1px solid ${T.border}`, background:'rgba(255,255,255,.04)', color:T.textSec, fontSize:13, fontWeight:500, cursor:'pointer', transition:'all .2s' }}
                onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,.08)';e.currentTarget.style.color=T.textPrimary;}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.04)';e.currentTarget.style.color=T.textSec;}}>
                {showExt ? 'Hide details' : 'More browsers'}
              </button>
            </div>
          </div>
          {showExt && <ExtensionDetail onClose={() => setShowExt(false)}/>}
        </div>

        {/* Infrastructure */}
        <div style={{ marginBottom:20 }}>
          <InfraSection />
        </div>

        {/* Footer CTA */}
        <div style={{ textAlign:'center', padding:'56px 32px', borderRadius:24, border:`1px solid ${T.border}`, background:T.bgCard, position:'relative', overflow:'hidden', marginBottom:72 }}>
          <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:320, height:2, background:`linear-gradient(90deg,transparent,${T.brand},transparent)` }}/>
          <div style={{ position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)', width:260, height:160, background:`radial-gradient(ellipse,rgba(212,176,140,.1) 0%,transparent 70%)`, filter:'blur(30px)', pointerEvents:'none' }}/>
          <div style={{ position:'relative' }}>
            <div style={{ width:44, height:44, borderRadius:14, background:T.brandDim, border:`1px solid ${T.brandBorder}`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <Sparkle size={20} color={T.brand} weight="fill"/>
            </div>
            <h2 style={{ fontSize:28, fontWeight:700, color:T.textPrimary, margin:'0 0 8px 0', letterSpacing:'-.02em' }}>Want early access?</h2>
            <p style={{ fontSize:15, color:T.textSec, margin:'0 0 28px 0', lineHeight:1.6 }}>
              Join the beta program for exclusive access to new features and products.
            </p>
            <button
              style={{ padding:'13px 30px', borderRadius:12, border:'none', background:`linear-gradient(135deg,${T.brand},#B08D6E)`, color:'var(--ui-text-inverse)', fontSize:14, fontWeight:700, cursor:'pointer', transition:'all .25s cubic-bezier(.4,0,.2,1)', letterSpacing:'.01em' }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 12px 32px rgba(212,176,140,.3)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}
            >
              Join the Beta Program
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductsDiscoveryView;
