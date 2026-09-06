"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X, Sparkle, ArrowRight, CaretLeft, CaretRight,
  HardDrives, RocketLaunch, Cpu, Stack, Shield, Key, Globe,
  CheckCircle, Check, Copy, ArrowSquareOut, Wrench, Command,
  Cursor, Chat, Camera, FileText, TextT, Lightning,
  PuzzlePiece as Puzzle,
  Laptop, ShoppingBag, GraduationCap,
  Brain, Robot, Palette, Note, GitBranch, UsersThree,
  Monitor, Code, Factory, FilmSlate, Buildings, Broadcast,
  Flask, House, Cube, Briefcase, WebhooksLogo,
} from '@phosphor-icons/react';
import { openInBrowser } from '@/lib/openInBrowser';
import { cn } from '@/lib/utils';

function openView(viewType: string): void {
  window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType } }));
}

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
  href?: string;
  status: ProductStatus;
  category: string;
}

/** Canonical public product URLs. In-app views stay in-app; these are the official sites. */
const OFFICIAL = {
  site: 'https://allternit.com',
  platform: 'https://allternit.com/platform',
  chat: 'https://allternit.com/chat',
  bots: 'https://allternit.com/bots',
  gizziCode: 'https://allternit.com/gizzi-code',
  series: 'https://series.allternit.com',
  facility: 'https://3dfacility.allternit.com',
  fabric: 'https://fabrictransport.allternit.com',
  install: 'https://install.allternit.com',
  labs: 'https://labs.allternit.com',
  docs: 'https://docs.allternit.com',
  docsApi: 'https://docs.allternit.com/api',
  releaseNotes: 'https://docs.allternit.com/release-notes',
  github: 'https://github.com/Gizziio',
  x: 'https://x.com/allternit',
  compute: 'https://compute.allternit.com',
  husks: 'https://robotics.allternit.com',
  spaces: 'https://spaces.allternit.com',
  manufacturing: 'https://manufacturing.allternit.com',
  office: 'https://office.allternit.com',
  try: 'https://try.allternit.com',
  services: 'https://services.allternit.com',
  ai: 'https://ai.allternit.com',
  signUp: 'https://ai.allternit.com/sign-up',
} as const;

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
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
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
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
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
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
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
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
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
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
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
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
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
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
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
  const d = (vt: string) => () => openView(vt);
  const site = (url: string) => () => openInBrowser(url);
  return [
    {
      id: 'series', title: 'ALLTERNIT — The Series', tagline: 'Intelligence is becoming infrastructure',
      description: 'Prestige drama about intelligence becoming infrastructure. Season One is The Assistants. The public object is the cinematic page — not a stream.',
      gradient: 'linear-gradient(135deg,#1a1a1a,#D97757)', accent: '#D97757',
      icon: <FilmSlate size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'Season One'], art: 'canvas-doc',
      ctaPrimary: { label: 'Watch the page', action: site(OFFICIAL.series) },
      ctaSecondary: { label: 'Walk the Facility', action: site(OFFICIAL.facility) },
    },
    {
      id: 'facility', title: 'Allternit Facility', tagline: 'Walk the campus',
      description: 'A living 3D campus for Allternit — office, lab, data center, library, yard. Create a bot avatar here, then walk it into the facility.',
      gradient: 'linear-gradient(135deg,#D97757,#8B5E3C)', accent: '#D97757',
      icon: <Buildings size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', '3D campus'], art: 'computer-use',
      ctaPrimary: { label: 'Enter the Facility', action: site(OFFICIAL.facility) },
      ctaSecondary: { label: 'Create a bot', action: site(`${OFFICIAL.facility}/#create`) },
    },
    {
      id: 'bots', title: 'A:// Bots', tagline: 'Message bots like teammates',
      description: 'Give a bot a job, tools, and memory. They run in parallel, keep context, fire on webhooks, and come back when your approval is needed — including 24/7 hosted runtimes and a desktop of their own.',
      gradient: 'linear-gradient(135deg,#a78bfa,#7c3aed)', accent: '#a78bfa',
      icon: <Robot size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'Hub', 'Group chat', 'Webhooks'], art: 'swarm',
      ctaPrimary: { label: 'Open Bot Hub', action: d('agent-hub') },
      ctaSecondary: { label: 'Bots site', action: site(OFFICIAL.bots) },
    },
    {
      id: 'fabric-transport', title: 'Fabric Transport', tagline: 'Your desktop, from anywhere',
      description: 'Pair a phone or browser to this machine. Scan a QR, install the Fabric Session PWA, and drive the desktop over the fabric — peers, capabilities, and sessions on fabrictransport.allternit.com.',
      gradient: 'linear-gradient(135deg,#0ea5e9,#0369a1)', accent: '#0ea5e9',
      icon: <Broadcast size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'PWA'], art: 'browser-capsule',
      ctaPrimary: { label: 'Open Fabric Transport', action: d('fabric-session') },
      ctaSecondary: { label: 'fabrictransport.allternit.com', action: site(OFFICIAL.fabric) },
    },
    {
      id: 'model-lab', title: 'Model Lab', tagline: 'Train, deploy, chat',
      description: 'Catalog, train, and run open-weights models locally or in the cloud. Engine, catalog, train, studio, cloud, and playground — one lab for the models you actually use.',
      gradient: 'linear-gradient(135deg,#8b5cf6,#4c1d95)', accent: '#8b5cf6',
      icon: <Flask size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'Local + cloud'], art: 'local-brain',
      ctaPrimary: { label: 'Open Model Lab', action: d('model-lab') },
    },
    {
      id: 'cowork', title: 'Cowork', tagline: 'AI for Your Whole Team',
      description: 'Put Allternit to work on tasks while you step away. Collaborate in real-time with AI as a full team member — assign tasks, review outputs, and ship faster together. Available now on Allternit Desktop.',
      gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)', accent: '#06b6d4',
      icon: <UsersThree size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'macOS'], art: 'chat', videoSrc: '/videos/cowork-demo.mp4',
      ctaPrimary: { label: 'Try Cowork', action: d('chat') },
      ctaSecondary: { label: 'Download Desktop', action: site(OFFICIAL.install) },
    },
    {
      id: 'chat', title: 'Allternit Chat', tagline: 'Conversational AI',
      description: 'The thinking layer for everything you do. Stream responses from any model, attach files, search the web, or hand off to an agent — all from one thread.',
      gradient: 'linear-gradient(135deg,#D97757,#B08D6E)', accent: '#D97757',
      icon: <Chat size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'All modes'], art: 'chat',
      ctaPrimary: { label: 'Open Chat', action: d('chat') },
    },
    {
      id: 'code', title: 'Allternit Code', tagline: 'AI-Powered Development',
      description: 'Your AI pair programmer across terminal, VS Code, and JetBrains. Understands full repositories — not just snippets. Aider, Goose, Codex, and Claude in one surface.',
      gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', accent: 'var(--status-warning)',
      icon: <Code size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'CLI + IDE'], art: 'code',
      ctaPrimary: { label: 'Open Code', action: d('code') },
    },
    {
      id: 'computer-use', title: 'Computer Use', tagline: 'AI That Sees & Acts',
      description: 'Give AI eyes and hands in the browser. Navigate, click, fill forms, extract data — fully automated, fully observable. 44-route ACU gateway, production-grade.',
      gradient: 'linear-gradient(135deg,#5B8DEF,#3b5bdb)', accent: '#5B8DEF',
      icon: <Monitor size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'ACU Engine'], art: 'computer-use',
      ctaPrimary: { label: 'Open Operator', action: d('operator') },
    },
    {
      id: 'swarm', title: 'Swarm ADE', tagline: 'Agent Orchestration at Scale',
      description: 'Spin up hundreds of AI agents working in parallel. Route tasks, monitor topology, replay runs, set budgets — all in one real-time dashboard.',
      gradient: 'linear-gradient(135deg,#10b981,#059669)', accent: 'var(--status-success)',
      icon: <Robot size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'Multi-agent'], art: 'swarm',
      ctaPrimary: { label: 'Open Swarm', action: d('swarm') },
    },
    {
      id: 'browser-capsule', title: 'Browser Capsule', tagline: 'AI in Every Tab',
      description: 'A browser extension that brings the full Allternit experience to any webpage. Select, ask, summarize, automate — without ever leaving the page.',
      gradient: 'linear-gradient(135deg,#4285F4,#34A853)', accent: '#4285F4',
      icon: <Puzzle size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Chrome', 'Firefox'], art: 'browser-capsule',
      ctaPrimary: { label: 'Open Extensions', action: d('browser-extensions') },
      ctaSecondary: { label: 'Platform site', action: site(OFFICIAL.platform) },
    },
    {
      id: 'local-brain', title: 'Local Brain', tagline: 'Private · Offline · Yours',
      description: 'Run AI entirely on your machine. No internet, no API keys, no cloud. Powered by Ollama + Llama 3.2. Every conversation stays on your device — permanently.',
      gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', accent: '#8b5cf6',
      icon: <Brain size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Offline', '~2 GB'], art: 'local-brain',
      ctaPrimary: { label: 'Set Up Local Brain', action: d('models-manage') },
    },
    {
      id: 'canvas', title: 'Allternit Canvas', tagline: 'Documents Built with AI',
      description: 'A new kind of document editor. Prompt to draft, refine together, export anywhere. The blank page, replaced.',
      gradient: 'linear-gradient(135deg,#6366f1,#4f46e5)', accent: '#6366f1',
      icon: <Note size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Beta'], art: 'canvas-doc',
      ctaPrimary: { label: 'Open Canvas', action: d('allternit-canvas') },
    },
    {
      id: 'manufacturing', title: 'Allternit Manufacturing', tagline: 'Digital Microfactory',
      description: 'Design, prototype, and produce AI hardware, robotics parts, and B2B components. From a single printer to a software-driven factory network.',
      gradient: 'linear-gradient(135deg,#d97706,#b45309)', accent: '#d97706',
      icon: <Factory size={26} weight="fill" className="text-[var(--ui-text-primary)]" />,
      badges: ['Live', 'Hardware'], art: 'computer-use',
      ctaPrimary: { label: 'manufacturing.allternit.com', action: site(OFFICIAL.manufacturing) },
      ctaSecondary: { label: 'Open in app', action: d('manufacturing') },
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
      <div className={cn(
        "grid grid-cols-[45fr_55fr] rounded-[28px] overflow-hidden border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] min-h-[460px] transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        show ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-[14px]"
      )}>
        {/* Info panel */}
        <div 
          className="p-[52px_48px] flex flex-col border-r border-solid border-[var(--ui-border-muted)]"
          style={{
            background: `radial-gradient(ellipse at 0% 0%, ${item.accent}10 0%, transparent 65%)`,
          }}
        >
          {/* Product icon */}
          <div 
            className="size-[58px] rounded-[18px] shrink-0 flex items-center justify-center mb-7 relative overflow-hidden"
            style={{ 
              background: item.gradient,
              boxShadow: `0 16px 40px ${item.accent}35`
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/18 to-transparent" />
            {item.icon}
          </div>

          {/* Tagline chip */}
          <span 
            className="inline-flex items-center gap-1.5 text-[12.5px] font-bold tracking-[0.1em] uppercase mb-2.5"
            style={{ color: item.accent }}
          >
            <span className="size-[5px] rounded-full inline-block" style={{ background: item.accent }} />
            {item.tagline}
          </span>

          {/* Title */}
          <h2 className="pdv-serif text-[40px] font-900 italic text-[var(--ui-text-primary)] m-[0_0_14px_0] tracking-[-0.03em] leading-[1.05]">
            {item.title}
          </h2>

          {/* Badges */}
          <div className="flex gap-1.5 mb-[18px] flex-wrap">
            {item.badges.map(b => (
              <span key={b} 
                className="p-[3px_9px] rounded-[20px] border border-solid text-[12.5px] font-bold tracking-[0.04em]"
                style={{
                  background: `${item.accent}14`,
                  borderColor: `${item.accent}28`,
                  color: item.accent
                }}
              >
                {b}
              </span>
            ))}
          </div>

          {/* Description */}
          <p className="text-[14.5px] text-[var(--ui-text-secondary)] leading-[1.7] m-[0_0_36px_0] flex-1">
            {item.description}
          </p>

          {/* CTAs */}
          <div className="flex gap-2.5 flex-wrap">
            <button type="button"
              onClick={item.ctaPrimary.action}
              className="p-[11px_22px] rounded-xl border-none text-[var(--ui-text-primary)] text-[13.5px] font-semibold cursor-pointer flex items-center gap-1.5 relative overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5"
              style={{ 
                background: item.gradient,
                boxShadow: `0 6px 20px ${item.accent}28`
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 32px ${item.accent}45`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 6px 20px ${item.accent}28`; }}
            >
              {item.ctaPrimary.label}
              <ArrowRight size={14} weight="bold" />
            </button>
            {item.ctaSecondary && (
              <button type="button"
                onClick={item.ctaSecondary.action}
                className="p-[11px_20px] rounded-xl border border-solid border-[var(--ui-border-muted)] bg-transparent text-[var(--ui-text-secondary)] text-[13.5px] font-medium cursor-pointer transition-all duration-200 hover:bg-white/5 hover:text-[var(--ui-text-primary)] hover:border-[var(--ui-border-default)]"
              >
                {item.ctaSecondary.label}
              </button>
            )}
          </div>
        </div>

        {/* Art panel */}
        <div 
          className="relative overflow-hidden"
          style={{
            background: `radial-gradient(ellipse at 70% 30%, ${item.accent}08 0%, var(--surface-canvas) 70%)`,
          }}
        >
          {/* Mesh overlay */}
          <div 
            className="absolute inset-0 z-[1] opacity-35 bg-[length:32px_32px]"
            style={{
              backgroundImage: `radial-gradient(circle, ${item.accent}18 1px, transparent 1px)`,
            }}
          />
          {/* Art canvas / video */}
          <div className="absolute inset-0 z-[2]">
            {item.videoSrc ? (
              <video
                key={item.videoSrc}
                src={item.videoSrc}
                autoPlay muted loop playsInline
                className="size-full object-cover block"
              />
            ) : (
              <ArtComponent />
            )}
          </div>
          {/* Center icon badge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[3] flex flex-col items-center gap-3.5 pointer-events-none">
            <div 
              className="size-[72px] rounded-[22px] flex items-center justify-center relative overflow-hidden animate-[pdv-float-a_6s_ease-in-out_infinite] shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
              style={{ 
                background: item.gradient,
                boxShadow: `0 20px 60px ${item.accent}50`
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
              {React.cloneElement(item.icon as React.ReactElement, { size: 32 })}
            </div>
            <div className="p-[5px_14px] rounded-[20px] bg-black/60 border border-solid border-[var(--ui-border-muted)] text-[12px] font-semibold text-white/50 tracking-[0.04em] backdrop-blur-xl">
              {item.title}
            </div>
          </div>
          {/* Edge fade */}
          <div className="absolute inset-0 z-[4] bg-gradient-to-r from-[var(--surface-panel)]/25 via-transparent to-[var(--surface-panel)]/15 pointer-events-none" />
        </div>
      </div>

      {/* Nav row */}
      <div className="flex items-center justify-center gap-3.5 mt-[18px]">
        <NavArrow dir="left"  onClick={() => jump((idx-1+ITEMS.length)%ITEMS.length)} />
        <div className="flex gap-1.5 items-center">
          {ITEMS.map((it,i) => (
            <button type="button" key={it.id} onClick={() => jump(i)} 
              className={cn(
                "h-[7px] rounded-full border-none cursor-pointer p-0 transition-all duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                i === idx ? "w-6" : "w-[7px] bg-white/12"
              )}
              style={{ background: i === idx ? item.accent : undefined }}
            />
          ))}
        </div>
        <NavArrow dir="right" onClick={() => jump((idx+1)%ITEMS.length)} />
      </div>

      {/* Progress strip */}
      {!paused && (
        <div className="mt-2.5 h-[2px] bg-white/5 rounded-full overflow-hidden">
          <div key={`${idx}-p`} 
            className="h-full rounded-full animate-[pdv-progress_10s_linear_forwards] w-0"
            style={{ background: item.accent }}
          />
        </div>
      )}
    </div>
  );
}

function NavArrow({ dir, onClick }: { dir:'left'|'right'; onClick:()=>void }) {
  return (
    <button type="button"
      onClick={onClick}
      className="size-[34px] rounded-full bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] cursor-pointer flex items-center justify-center transition-all duration-[180ms] hover:bg-[var(--ui-border-default)] hover:border-[var(--ui-border-default)] hover:text-[var(--ui-text-primary)]"
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
  { id:'platform',     name:'A:// Platform',   description:'The control plane for agentic work',    icon:<Stack size={17} weight="fill"/>,        accent:'#D97757', gradient:'linear-gradient(135deg,#D97757,#B08D6E)', href:OFFICIAL.platform,   status:'live',  category:'Core' },
  { id:'gizzi-code',   name:'Gizzi Code',      description:'Agent-native coding with repo context', icon:<Code size={17} weight="fill"/>,         accent:'#f59e0b', gradient:'linear-gradient(135deg,#f59e0b,#d97706)', href:OFFICIAL.gizziCode,  status:'live',  category:'Core' },
  { id:'computer-use', name:'Computer Use',    description:'AI that sees and controls browsers',    icon:<Monitor size={17} weight="fill"/>,      accent:'#5B8DEF', gradient:'linear-gradient(135deg,#5B8DEF,#3b5bdb)', viewType:'operator',      status:'live',  category:'AI Agents' },
  { id:'swarm',        name:'Swarm ADE',       description:'Orchestrate hundreds of AI agents',     icon:<Robot size={17} weight="fill"/>,        accent:'var(--status-success)', gradient:'linear-gradient(135deg,#10b981,#059669)', viewType:'swarm',         status:'live',  category:'AI Agents' },
  { id:'agent-hub',    name:'Bot Hub',         description:'Build, deploy, and manage bots',        icon:<Cpu size={17} weight="fill"/>,          accent:'#a78bfa', gradient:'linear-gradient(135deg,#a78bfa,#7c3aed)', viewType:'agent-hub',     status:'live',  category:'Bots' },
  { id:'bots-site',    name:'A:// Bots',       description:'Message bots like teammates',           icon:<Robot size={17} weight="fill"/>,        accent:'#a78bfa', gradient:'linear-gradient(135deg,#a78bfa,#7c3aed)', href:OFFICIAL.bots,        status:'live',  category:'Bots' },
  { id:'group-chat',   name:'Group Chat',      description:'Several bots in one thread',            icon:<UsersThree size={17} weight="fill"/>,   accent:'#c084fc', gradient:'linear-gradient(135deg,#c084fc,#7c3aed)', viewType:'groups-list',    status:'live',  category:'Bots' },
  { id:'bot-webhooks', name:'Bot Webhooks',    description:'Fire bots from events and URLs',        icon:<WebhooksLogo size={17} weight="fill"/>, accent:'#818cf8', gradient:'linear-gradient(135deg,#818cf8,#4f46e5)', viewType:'agent-hub',     status:'live',  category:'Bots' },
  { id:'bot-create',   name:'Create a Bot',    description:'Husk, Unitree, Asimov, or human avatar',icon:<Cube size={17} weight="fill"/>,         accent:'#D97757', gradient:'linear-gradient(135deg,#D97757,#8B5E3C)', href:`${OFFICIAL.facility}/#create`, status:'live', category:'Bots' },
  { id:'canvas',       name:'Canvas',          description:'Documents built with AI',               icon:<Note size={17} weight="fill"/>,         accent:'#6366f1', gradient:'linear-gradient(135deg,#6366f1,#4f46e5)', viewType:'allternit-canvas', status:'beta', category:'Create' },
  { id:'design',       name:'Allternit Design', description:'Visual design and creative tools',     icon:<Palette size={17} weight="fill"/>,      accent:'#ec4899', gradient:'linear-gradient(135deg,#ec4899,#be185d)', viewType:'design',        status:'beta',  category:'Create' },
  { id:'workflow',     name:'Workflows',       description:'Visual automation and task pipelines',  icon:<GitBranch size={17} weight="fill"/>,    accent:'#14b8a6', gradient:'linear-gradient(135deg,#14b8a6,#0d9488)', viewType:'cowork-runs',   status:'beta',  category:'Create' },
  { id:'office',       name:'Allternit Office', description:'Docs, Sheets, Slides, PDF, and Sign', icon:<Briefcase size={17} weight="fill"/>,    accent:'#0ea5e9', gradient:'linear-gradient(135deg,#0ea5e9,#0369a1)', href:OFFICIAL.office,      status:'live',  category:'Create' },
  { id:'local-brain',  name:'Local Brain',     description:'Private offline AI on your machine',   icon:<Brain size={17} weight="fill"/>,        accent:'#8b5cf6', gradient:'linear-gradient(135deg,#8b5cf6,#6d28d9)', viewType:'models-manage', status:'live',  category:'Infrastructure' },
  { id:'model-lab',    name:'Model Lab',       description:'Train, deploy, and chat with open weights', icon:<Flask size={17} weight="fill"/>,   accent:'#8b5cf6', gradient:'linear-gradient(135deg,#8b5cf6,#4c1d95)', viewType:'model-lab',     status:'live',  category:'Infrastructure' },
  { id:'fabric',       name:'Fabric Transport', description:'Remote desktop over the fabric',      icon:<Broadcast size={17} weight="fill"/>,    accent:'#0ea5e9', gradient:'linear-gradient(135deg,#0ea5e9,#0369a1)', viewType:'fabric-session', status:'live', category:'Infrastructure' },
  { id:'cloud-deploy', name:'Cloud Deploy',    description:'Deploy Allternit nodes to any cloud',  icon:<RocketLaunch size={17} weight="fill"/>, accent:'var(--status-success)', gradient:'linear-gradient(135deg,#22c55e,#16a34a)', viewType:'deploy',        status:'live',  category:'Infrastructure' },
  { id:'browser',      name:'Browser Capsule', description:'AI assistant in every browser tab',    icon:<Puzzle size={17} weight="fill"/>,       accent:'#4285F4', gradient:'linear-gradient(135deg,#4285F4,#34A853)', viewType:'browser-extensions', status:'live', category:'Surfaces' },
  { id:'desktop',      name:'Desktop App',     description:'Native app for macOS, Windows, Linux', icon:<Laptop size={17} weight="fill"/>,       accent:'var(--accent-primary)', gradient:'linear-gradient(135deg,#D4B08C,#B08D6E)', href:OFFICIAL.install,     status:'live',  category:'Surfaces' },
  { id:'labs',         name:'A://Labs',        description:'Courses and credentials',              icon:<GraduationCap size={17} weight="fill"/>, accent:'var(--status-warning)', gradient:'linear-gradient(135deg,#f59e0b,#b45309)', href:OFFICIAL.labs, status:'live',  category:'Learn' },
  { id:'marketplace',  name:'Marketplace',     description:'Discover plugins and extensions',      icon:<ShoppingBag size={17} weight="fill"/>,  accent:'var(--status-success)', gradient:'linear-gradient(135deg,#10b981,#059669)', viewType:'marketplace',   status:'beta',  category:'Ecosystem' },
  { id:'dev-portal',   name:'Docs',            description:'APIs, SDKs, and documentation',        icon:<ArrowSquareOut size={17}/>,             accent:'#6366f1', gradient:'linear-gradient(135deg,#6366f1,#4338ca)', href:OFFICIAL.docs,         status:'live',  category:'Ecosystem' },
  { id:'series',       name:'ALLTERNIT — The Series', description:'Season One: The Assistants',    icon:<FilmSlate size={17} weight="fill"/>,    accent:'#D97757', gradient:'linear-gradient(135deg,#1a1a1a,#D97757)', href:OFFICIAL.series,      status:'live',  category:'Worlds' },
  { id:'facility',     name:'Allternit Facility', description:'Walk the Allternit campus in 3D',  icon:<Buildings size={17} weight="fill"/>,    accent:'#D97757', gradient:'linear-gradient(135deg,#D97757,#8B5E3C)', href:OFFICIAL.facility,    status:'live',  category:'Worlds' },
  { id:'try',          name:'Try Allternit',   description:'Playable experiments and arcade',      icon:<Cube size={17} weight="fill"/>,         accent:'#f59e0b', gradient:'linear-gradient(135deg,#f59e0b,#b45309)', href:OFFICIAL.try,          status:'live',  category:'Worlds' },
  { id:'compute',      name:'Compute',         description:'Datacenters and local compute',        icon:<HardDrives size={17} weight="fill"/>,   accent:'#22c55e', gradient:'linear-gradient(135deg,#22c55e,#16a34a)', href:OFFICIAL.compute,      status:'live',  category:'Divisions' },
  { id:'husks',        name:'Husks',           description:'Open hardware bodies for physical AI', icon:<Robot size={17} weight="fill"/>,        accent:'#D97757', gradient:'linear-gradient(135deg,#D97757,#b45309)', href:OFFICIAL.husks,        status:'live',  category:'Divisions' },
  { id:'spaces',       name:'Spaces',          description:'Sovereign workspaces, delivered',      icon:<House size={17} weight="fill"/>,        accent:'#06b6d4', gradient:'linear-gradient(135deg,#06b6d4,#0284c7)', href:OFFICIAL.spaces,       status:'live',  category:'Divisions' },
  { id:'manufacturing',name:'Manufacturing',   description:'Built in-house, sold as a service',    icon:<Factory size={17} weight="fill"/>,      accent:'#d97706', gradient:'linear-gradient(135deg,#d97706,#b45309)', href:OFFICIAL.manufacturing, status:'live', category:'Divisions' },
];

const CATEGORIES = ['Core','Bots','AI Agents','Create','Infrastructure','Surfaces','Worlds','Divisions','Learn','Ecosystem'] as const;

const STATUS_STYLE: Record<ProductStatus, { label:string; color:string; bg:string; border:string }> = {
  'live': { label:'Live',        color:'var(--status-success)', bg:'rgba(34,197,94,.1)',   border:'rgba(34,197,94,.2)' },
  'beta': { label:'Beta',        color:'var(--status-warning)', bg:'rgba(245,158,11,.1)',  border:'rgba(245,158,11,.2)' },
  'soon': { label:'Coming Soon', color:'var(--ui-text-muted)',    bg:'var(--surface-hover)', border:'var(--ui-border-default)' },
};

function ProductMiniCard({ p }: { p: MiniProduct }) {
  const ss = STATUS_STYLE[p.status];
  const onClick = p.href
    ? () => openInBrowser(p.href!)
    : p.viewType
      ? () => openView(p.viewType!)
      : undefined;

  return (
    <div role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) onClick(); }}
      className={cn(
        "group rounded-2xl border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-5 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] relative overflow-hidden flex flex-col gap-3 shadow-none hover:bg-[var(--surface-floating)] hover:-translate-y-[3px]",
        onClick ? "cursor-pointer" : "cursor-default"
      )}
      style={{
        '--item-accent-14' : `${p.accent}14`
      } as React.CSSProperties}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-[16px_16px_0_0]"
        style={{ background: p.gradient }}
      />
      <div className="flex items-start justify-between">
        <div 
          className="size-9 rounded-[10px] flex items-center justify-center transition-all duration-200"
          style={{ 
            color: p.accent,
            background: `${p.accent}14`,
          }}
        >
          {p.icon}
        </div>
        <span 
          className="text-[12.5px] font-bold tracking-[0.04em] p-[2px_8px] rounded-[20px] border border-solid"
          style={{ 
            color: ss.color, 
            background: ss.bg, 
            borderColor: ss.border 
          }}
        >
          {ss.label}
        </span>
      </div>
      <div>
        <div className="text-[13.5px] font-semibold mb-1 transition-colors duration-200 group-hover:text-[var(--ui-text-primary)] text-[var(--ui-text-primary)]">
          {p.name}
        </div>
        <div className="text-[12px] text-[var(--ui-text-secondary)] leading-[1.55]">{p.description}</div>
      </div>
      {onClick && (
        <div 
          className="flex items-center gap-1 text-[12.5px] mt-auto transition-colors duration-200 font-medium text-[var(--ui-text-muted)]"
          style={{ color: p.accent }}
        >
          Open <ArrowRight size={11} weight="bold"/>
        </div>
      )}
    </div>
  );
}

// ─── Infrastructure Section ───────────────────────────────────────────────────

function InfraSection() {
  const opts = [
    { icon:<RocketLaunch size={19} color="var(--status-success)"/>, ibg:'rgba(34,197,94,.1)', accent:'var(--status-success)', badge:'New', title:'Cloud Deploy', desc:'Deploy Allternit nodes to Hetzner, AWS, or DigitalOcean in minutes.', cta:'Get Started', onClick:()=>openView('deploy') },
    { icon:<Cpu size={19} color="var(--accent-primary)"/>, ibg:'rgba(212,176,140,.1)', accent:'var(--accent-primary)', badge:undefined, title:'Connect VPS', desc:'Bring your own server. Connect any VPS with SSH in seconds.', cta:'Connect', onClick:()=>window.dispatchEvent(new CustomEvent('allternit:open-settings',{detail:{section:'infrastructure',tab:'connections'}})) },
    { icon:<Stack size={19} color="#7b68ee"/>, ibg:'rgba(123,104,238,.1)', accent:'#7b68ee', badge:undefined, title:'Environments', desc:'Railway-style setup. Devcontainers, Nix, sandboxes.', cta:'Browse', onClick:()=>window.dispatchEvent(new CustomEvent('allternit:open-settings',{detail:{section:'infrastructure',tab:'environments'}})) },
  ];
  return (
    <div className="rounded-3xl border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-[40px_44px] relative overflow-hidden">
      <div className="absolute -top-[70px] -right-[70px] size-[240px] bg-[radial-gradient(circle,rgba(212,176,140,0.07)_0%,transparent_70%)] blur-[40px] pointer-events-none" />
      <div className="flex items-center gap-3.5 mb-6.5 relative">
        <div className="size-[46px] rounded-[13px] bg-[rgba(212,176,140,0.1)] border border-solid border-[var(--ui-border-strong)] flex items-center justify-center">
          <HardDrives size={22} className="text-[var(--accent-primary)]"/>
        </div>
        <div>
          <h3 className="text-[20px] font-semibold text-[var(--ui-text-primary)] m-0 mb-0.5">Deploy Your Infrastructure</h3>
          <p className="text-[13px] text-[var(--ui-text-secondary)] m-0">BYOC, VPS, or Cloud — your agents, your servers.</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3.5 mb-5.5 relative">
        {opts.map(o => (
          <button type="button" key={o.title} onClick={o.onClick} className="group p-5 rounded-[14px] border border-solid border-[var(--ui-border-muted)] bg-white/2 cursor-pointer text-left transition-all duration-200 hover:bg-white/5"
            style={{
              borderColor: `${o.accent}35`,
            }}>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="size-[34px] rounded-[9px] flex items-center justify-center" style={{ background: o.ibg }}>{o.icon}</div>
              {o.badge && <span className="text-[12px] font-bold" style={{ color: o.accent }}>{o.badge}</span>}
            </div>
            <h4 className="text-[14.5px] font-semibold text-[var(--ui-text-primary)] m-0 mb-1.5">{o.title}</h4>
            <p className="text-[12px] text-[var(--ui-text-secondary)] m-0 mb-3 leading-[1.5]">{o.desc}</p>
            <div className="flex items-center gap-1 text-[12px] font-medium" style={{ color: o.accent }}>{o.cta} <ArrowRight size={11}/></div>
          </button>
        ))}
      </div>
      <div className="flex gap-4.5 pt-3.5 border-t border-solid border-[var(--ui-border-muted)] flex-wrap items-center">
        {[{i:<Shield size={12} className="text-[var(--ui-text-muted)]"/>,l:'End-to-end encrypted'},{i:<Key size={12} className="text-[var(--ui-text-muted)]"/>,l:'SSH key management'},{i:<Globe size={12} className="text-[var(--ui-text-muted)]"/>,l:'5 cloud providers'}].map(f=>(
          <div key={f.l} className="flex items-center gap-1.5">{f.i}<span className="text-[12.5px] text-[var(--ui-text-muted)]">{f.l}</span></div>
        ))}
        <div className="flex-1" />
        <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('allternit:open-settings',{detail:{section:'infrastructure'}}))}
          className="p-[7px_14px] rounded-lg border border-solid border-[var(--ui-border-strong)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-panel))] text-[var(--accent-primary)] text-[12px] font-medium cursor-pointer flex items-center gap-1.5 transition-all duration-200 hover:bg-[rgba(212,176,140,0.18)]">
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
    {l:'Clone repository',c:'git clone https://github.com/Gizziio/allternit-platform.git'},
    {l:'Install dependencies',c:'cd surfaces/allternit-extensions/allternit-extension && npm install'},
    {l:'Build extension',c:'npm run build'},
    {l:'Load in Chrome',c:'chrome://extensions → Developer mode → Load unpacked → dist/'},
  ];

  return (
    <div className="mt-6 rounded-3xl border border-solid border-blue-500/20 bg-[var(--surface-panel)] p-10 relative overflow-hidden">
      <div className="absolute -top-[60px] -right-[40px] size-[240px] bg-[radial-gradient(circle,rgba(66,133,244,0.08)_0%,transparent_70%)] blur-[50px] pointer-events-none" />
      <div className="flex items-center justify-between mb-7 relative">
        <div className="flex items-center gap-3.5">
          <div className="size-[46px] rounded-[13px] bg-gradient-to-br from-[#4285F4] to-[#34A853] flex items-center justify-center">
            <Puzzle size={24} className="text-[var(--ui-text-primary)]" />
          </div>
          <div>
            <h3 className="text-[20px] font-semibold text-[var(--ui-text-primary)] m-0 mb-0.5">Allternit Browser Capsule</h3>
            <p className="text-[12.5px] text-[var(--ui-text-secondary)] m-0">Version 1.0.0 · Free · Open Source</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="size-8 rounded-lg bg-white/4 border border-solid border-[var(--ui-border-muted)] text-[var(--ui-text-secondary)] cursor-pointer flex items-center justify-center transition-all duration-200 hover:text-[var(--ui-text-primary)] hover:bg-white/10">
          <X size={15}/>
        </button>
      </div>

      <div className="flex gap-1 mb-7 p-1 bg-white/5 rounded-[10px] w-fit">
        {([['chrome','Chrome'],['firefox','Firefox'],['build','Build']] as const).map(([id,label])=>(
          <button type="button" 
            key={id} 
            onClick={() => setTab(id)} 
            className={cn(
              "px-4 py-2 rounded-lg border-none text-[13px] font-medium cursor-pointer flex items-center gap-1.5 transition-all duration-200",
              tab === id ? "bg-[var(--status-info-bg)] text-[#4285F4]" : "bg-transparent text-[var(--ui-text-secondary)] hover:bg-white/5"
            )}
          >
            {id === 'chrome' && <ChromeIcon size={14} />}
            {id === 'firefox' && <FirefoxIcon size={14} />}
            {id === 'build' && <Wrench size={14} />}
            {label}
          </button>
        ))}
      </div>

      <div className="mb-8">
        {(tab==='chrome'||tab==='firefox') && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-3.5">
              {(tab==='chrome'
                ? [{href:OFFICIAL.github,icon:<ChromeIcon size={26}/>,label:'Source on GitHub',sub:'Gizziio / allternit-platform',accent:'#4285F4'},{href:OFFICIAL.platform,icon:<ArrowSquareOut size={26} className="text-[var(--accent-primary)]"/>,label:'A:// Platform',sub:'Install from inside the app',accent:'var(--accent-primary)'}]
                : [{href:OFFICIAL.github,icon:<FirefoxIcon size={26}/>,label:'Source on GitHub',sub:'Gizziio / allternit-platform',accent:'#FF7139'},{href:OFFICIAL.platform,icon:<ArrowSquareOut size={26} className="text-[var(--accent-primary)]"/>,label:'A:// Platform',sub:'Install from inside the app',accent:'var(--accent-primary)'}]
              ).map(l=>(
                <button type="button" key={l.href} onClick={() => openInBrowser(l.href)} className="p-[16px_18px] rounded-xl border border-solid border-white/5 flex items-center gap-3 transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
                  style={{ background: `${l.accent}0e`, borderColor: `${l.accent}25` }}>
                  <div style={{ color: l.accent }}>{l.icon}</div>
                  <div className="text-left">
                    <div className="text-[13.5px] font-semibold text-[var(--ui-text-primary)] mb-0.5">{l.label}</div>
                    <div className="text-[12.5px] text-[var(--ui-text-secondary)]">{l.sub}</div>
                  </div>
                  <ArrowSquareOut size={14} className="ml-auto" style={{ color: l.accent }} />
                </button>
              ))}
            </div>
            <div className="p-[11px_14px] bg-green-500/10 rounded-[9px] border border-solid border-green-500/20 flex items-center gap-2.5">
              <CheckCircle size={14} className="text-[var(--status-success)]" />
              <span className="text-[12px] text-[var(--status-success)]">
                {tab === 'chrome' ? 'Compatible with Chrome, Edge, Brave, Opera, and all Chromium-based browsers' : 'Compatible with Firefox, Waterfox, LibreWolf, and Firefox-based browsers'}
              </span>
            </div>
          </div>
        )}
        {tab==='build'&&(
          <div>
            <p className="text-[12.5px] text-[var(--ui-text-secondary)] mb-4">Build from source for the latest features and development.</p>
            <div className="flex flex-col gap-2">
              {cmds.map((c,i)=>(
                <div key={`${c.l}-${i}`} className="p-[13px_16px] bg-black/25 rounded-[10px] border border-solid border-[var(--ui-border-muted)] flex items-center gap-3">
                  <div className="size-5.5 rounded-full bg-[var(--status-info-bg)] flex items-center justify-center text-[12px] text-[var(--status-info)] font-bold shrink-0">{i+1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-[var(--ui-text-muted)] mb-0.5">{c.l}</div>
                    <code className="text-[12.5px] text-[var(--accent-primary)] font-mono truncate block">{c.c}</code>
                  </div>
                  <button type="button" onClick={() => copy(c.c)} className={cn(
                    "p-1.5 rounded-lg border-none cursor-pointer transition-all duration-200",
                    copied === c.c ? "bg-green-500/15 text-[var(--status-success)]" : "bg-white/4 text-[var(--ui-text-secondary)] hover:bg-white/10"
                  )}>
                    {copied === c.c ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <h4 className="text-[15px] font-semibold text-[var(--ui-text-primary)] m-0 mb-3.5">Features</h4>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {features.map((f,i)=>(
          <div key={`${f.t}-${i}`} className="p-4 bg-white/2 rounded-xl border border-solid border-[var(--ui-border-muted)] transition-all duration-200 hover:border-blue-500/20 hover:bg-white/4">
            <div className="mb-2">{f.i}</div>
            <h5 className="text-[12.5px] font-semibold text-[var(--ui-text-primary)] m-0 mb-1">{f.t}</h5>
            <p className="text-[12.5px] text-[var(--ui-text-secondary)] m-0 mb-2.5 leading-relaxed">{f.d}</p>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--surface-hover)] rounded-[5px] text-[12.5px] text-[var(--ui-text-muted)] font-mono">
              <Command size={9}/> {f.sc}
            </div>
          </div>
        ))}
      </div>

      <div className="p-[14px_16px] bg-white/2 rounded-xl border border-solid border-[var(--ui-border-muted)]">
        <p className="text-[12px] font-semibold text-[var(--ui-text-primary)] m-0 mb-3">Supported Browsers</p>
        <div className="flex gap-4.5 flex-wrap">
          {[{i:<ChromeIcon size={16}/>,n:'Chrome',v:'88+'},{i:<FirefoxIcon size={16}/>,n:'Firefox',v:'109+'},{i:<EdgeIcon size={16}/>,n:'Edge',v:'88+'},{i:<ArrowSquareOut size={16} className="text-[#FBBC04]"/>,n:'Brave',v:'1.20+'},{i:<ArrowSquareOut size={16} className="text-[#FF1B2D]"/>,n:'Opera',v:'74+'}].map((b,i)=>(
            <div key={`${b.n}-${i}`} className="flex items-center gap-1.5">
              {b.i}
              <div>
                <div className="text-[12px] text-[var(--ui-text-primary)]">{b.n}</div>
                <div className="text-[12px] text-[var(--ui-text-muted)]">{b.v}</div>
              </div>
            </div>
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
    <div className="rounded-3xl border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-[36px_44px] flex items-center justify-between relative overflow-hidden">
      <div className="absolute -top-[60px] -left-[60px] size-[200px] bg-[radial-gradient(circle,color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-panel))_0%,transparent_70%)] blur-[40px] pointer-events-none" />
      <div className="flex items-center gap-4.5 relative">
        <div className="size-[50px] rounded-[14px] bg-gradient-to-br from-[#D4B08C] to-[#B08D6E] flex items-center justify-center shadow-[0_10px_30px_rgba(212,176,140,0.28)]">
          <Laptop size={24} className="text-[var(--ui-text-primary)]" />
        </div>
        <div>
          <h3 className="text-[18px] font-semibold text-[var(--ui-text-primary)] m-0 mb-1">Allternit Desktop</h3>
          <p className="text-[13px] text-[var(--ui-text-secondary)] m-0">The full platform as a native application.</p>
        </div>
      </div>
      <div className="flex gap-2.5 relative">
        {platforms.map(pl=>(
          <button type="button" key={pl.label} onClick={() => openInBrowser(OFFICIAL.install)} className="p-[9px_16px] rounded-[10px] border border-solid border-[var(--ui-border-muted)] bg-white/4 text-[var(--ui-text-secondary)] text-[12px] font-medium cursor-pointer flex items-center gap-1.5 transition-all duration-200 hover:bg-white/8 hover:text-[var(--ui-text-primary)] hover:border-[var(--ui-border-default)]">
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
  const d = (vt: string) => () => openView(vt);
  const headRef = useScrollReveal();

  const cards: VideoCard[] = [
    {
      badge: 'Live',
      badgeColor: '#D97757',
      title: 'ALLTERNIT — The Series',
      description: 'Season One: The Assistants. Intelligence is becoming infrastructure. The cinematic page is the public object.',
      artType: 'canvas-doc',
      cta: 'series.allternit.com',
      onCta: () => openInBrowser(OFFICIAL.series),
    },
    {
      badge: 'Live',
      badgeColor: '#D97757',
      title: 'Allternit Facility',
      description: 'Walk the campus in 3D. Create a bot avatar — Husk, Unitree, Asimov, or human — then take it into the facility.',
      artType: 'computer-use',
      cta: '3dfacility.allternit.com',
      onCta: () => openInBrowser(OFFICIAL.facility),
    },
    {
      badge: 'Live',
      badgeColor: '#a78bfa',
      title: 'A:// Bots',
      description: 'Teammates with jobs, tools, memory, group chat, webhooks, and a desktop. They keep working when you step away.',
      artType: 'swarm',
      cta: 'Open Bot Hub',
      onCta: d('agent-hub'),
    },
    {
      badge: 'Live',
      badgeColor: '#0ea5e9',
      title: 'Fabric Transport',
      description: 'Pair a phone to this machine. Fabric Session PWA on fabrictransport.allternit.com drives the desktop over the fabric.',
      artType: 'browser-capsule',
      cta: 'Open Fabric Transport',
      onCta: d('fabric-session'),
    },
    {
      badge: 'Live',
      badgeColor: '#8b5cf6',
      title: 'Model Lab',
      description: 'Train, deploy, and chat with open-weights models — locally or in the cloud. Engine, catalog, train, studio, playground.',
      artType: 'local-brain',
      cta: 'Open Model Lab',
      onCta: d('model-lab'),
    },
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
  ];

  return (
    <div className="mb-20">
      <div ref={headRef} className="flex items-baseline gap-3 mb-8">
        <h2 className="pdv-display text-[22px] font-extrabold text-[var(--ui-text-primary)] m-0 tracking-tight">Product Highlights</h2>
        <span className="text-[12px] text-[var(--ui-text-muted)] tracking-wider uppercase font-semibold">New releases</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => {
          const Art = ART_MAP[card.artType];
          return (
            <div key={card.title} className="group rounded-[20px] border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] overflow-hidden flex flex-col transition-all duration-200 hover:border-[var(--ui-border-default)] hover:shadow-[0_12px_48px_rgba(0,0,0,0.4)]">
              {/* Video / Art top panel */}
              <div className="relative h-[220px] bg-[var(--surface-panel)] overflow-hidden shrink-0">
                <div className="absolute inset-0">
                  {card.videoSrc ? (
                    <video
                      key={card.videoSrc}
                      src={card.videoSrc}
                      autoPlay muted loop playsInline
                      className="size-full object-cover block"
                    />
                  ) : (
                    <Art />
                  )}
                </div>
                {/* Bottom fade into card */}
                <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-[var(--surface-panel)] to-transparent pointer-events-none" />
              </div>
              {/* Info panel */}
              <div className="p-[22px_26px_26px] flex flex-col gap-2.5 flex-1">
                <span className="pdv-display text-[12px] font-bold tracking-[0.14em] uppercase" style={{ color: card.badgeColor }}>
                  {card.badge}
                </span>
                <h3 className="pdv-serif text-[22px] font-900 italic text-[var(--ui-text-primary)] m-0 tracking-[-0.02em] leading-[1.15]">{card.title}</h3>
                <p className="text-[13px] text-[var(--ui-text-secondary)] m-0 leading-[1.65] flex-1">{card.description}</p>
                <button type="button"
                  onClick={card.onCta}
                  className="mt-1.5 p-[8px_16px] rounded-[10px] border border-solid border-[var(--ui-border-default)] bg-[var(--surface-hover)] text-[var(--ui-text-primary)] text-[12.5px] font-semibold cursor-pointer flex items-center gap-1.5 w-fit transition-all duration-150 hover:bg-[var(--ui-border-default)] hover:-translate-y-0.5 hover:border-[var(--ui-border-strong)]"
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
      className={cn(
        "group rounded-[20px] border border-solid border-[var(--ui-border-muted)] flex flex-col gap-3.5 relative overflow-hidden transition-all duration-[250ms] hover:border-[var(--ui-border-default)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.3)]",
        featured ? "bg-[var(--surface-floating)] p-[36px_36px_32px]" : "bg-[var(--surface-panel)] p-[26px_28px_24px]"
      )}
    >
      {/* Decorative giant quote mark */}
      <div className="pdv-quote-mark">"</div>

      {/* Category + X icon */}
      <div className="flex items-center justify-between relative">
        <span className="pdv-display text-[12px] font-bold tracking-[0.14em] uppercase" style={{ color: t.catColor }}>
          {t.category}
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--ui-text-muted)"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </div>

      {/* Subject — Fraunces for impact */}
      <p className={cn(
        "pdv-serif text-[var(--ui-text-primary)] m-0 leading-[1.3] tracking-[-0.02em] italic relative font-bold",
        featured ? "text-[22px]" : "text-[17px]"
      )}>
        {t.subject}
      </p>

      {/* Content */}
      <p className={cn(
        "text-[var(--ui-text-secondary)] m-0 leading-[1.72] flex-1 relative",
        featured ? "text-[14px]" : "text-[13px]"
      )}>
        {t.content}
      </p>

      {/* Author */}
      <div className="flex items-center gap-2.5 pt-2 border-t border-solid border-[var(--ui-border-muted)] relative">
        <div className="size-[30px] rounded-full border border-solid flex items-center justify-center text-[12px] font-bold shrink-0"
             style={{ 
               background: `${t.catColor}18`, 
               borderColor: `${t.catColor}25`,
               color: t.catColor 
             }}>
          {t.name[0]}
        </div>
        <div>
          <div className="pdv-display text-[12.5px] font-semibold text-[var(--ui-text-secondary)]">{t.name}</div>
          <div className="text-[12.5px] text-[var(--ui-text-muted)]">{t.handle}</div>
        </div>
      </div>
    </div>
  );
}

function SocialProofSection() {
  const headRef = useScrollReveal();
  return (
    <div className="mb-20">
      {/* Editorial header */}
      <div ref={headRef} className="mb-11">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-gradient-to-r from-[var(--ui-border-muted)] to-transparent" />
          <span className="pdv-display text-[12.5px] font-bold tracking-[0.18em] uppercase text-[var(--ui-text-muted)]">Builder stories</span>
          <div className="flex-1 h-px bg-gradient-to-l from-[var(--ui-border-muted)] to-transparent" />
        </div>
        <h2 className="pdv-serif text-[48px] font-900 italic text-[var(--ui-text-primary)] m-[0_0_10px_0] tracking-[-0.03em] leading-[1.05]">
          See what builders<br/>are shipping
        </h2>
        <p className="pdv-display text-[14px] text-[var(--ui-text-secondary)] m-0 tracking-[0.01em]">Real teams. Real results. Unfiltered.</p>
      </div>

      {/* Featured + stacked layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3.5">
        {/* Featured left */}
        <TestimonialCard t={TESTIMONIALS[0]} featured />
        {/* Right: two stacked */}
        <div className="flex flex-col gap-3.5">
          <TestimonialCard t={TESTIMONIALS[1]} />
          <TestimonialCard t={TESTIMONIALS[2]} />
        </div>
      </div>

      {/* Bottom row: 3 equal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
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

  const productLinks = [
    { label: 'Series', href: OFFICIAL.series },
    { label: 'Facility', href: OFFICIAL.facility },
    { label: 'Bots', href: OFFICIAL.bots },
    { label: 'Fabric Transport', href: OFFICIAL.fabric },
    { label: 'Office', href: OFFICIAL.office },
    { label: 'Labs', href: OFFICIAL.labs },
    { label: 'Compute', href: OFFICIAL.compute },
    { label: 'Husks', href: OFFICIAL.husks },
    { label: 'Spaces', href: OFFICIAL.spaces },
    { label: 'Manufacturing', href: OFFICIAL.manufacturing },
  ];

  const secondaryLinks = [
    { label: 'Docs', href: OFFICIAL.docs },
    { label: 'GitHub', href: OFFICIAL.github },
    { label: 'X', href: OFFICIAL.x },
    { label: 'Release notes', href: OFFICIAL.releaseNotes },
    { label: 'API', href: OFFICIAL.docsApi },
    { label: 'Install', href: OFFICIAL.install },
  ];

  return (
    <div ref={ref} className="mb-20 rounded-3xl border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] p-[48px_52px] relative overflow-hidden">
      {/* Background mesh */}
      <div className="absolute -top-[80px] -right-[80px] size-[320px] bg-[radial-gradient(circle,color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-panel))_0%,transparent_65%)] blur-[60px] pointer-events-none" />
      <div className="absolute -bottom-[60px] -left-[40px] size-[220px] bg-[radial-gradient(circle,rgba(91,141,239,0.06)_0%,transparent_70%)] blur-[40px] pointer-events-none" />

      <div className="relative flex flex-col md:flex-row items-center gap-12">
        {/* Left: Featured CTA */}
        <div className="shrink-0">
          <span className="pdv-display block text-[12.5px] font-bold tracking-[0.16em] uppercase text-[var(--ui-text-muted)] mb-2.5">
            Official website
          </span>
          <button type="button"
            onClick={() => openInBrowser(OFFICIAL.site)}
            className="pdv-link-ul bg-transparent border-none p-0 cursor-pointer flex items-center gap-2.5"
          >
            <span className="pdv-serif text-[38px] font-900 italic text-[var(--accent-primary)] tracking-[-0.03em] leading-none">
              allternit.com
            </span>
            <ArrowSquareOut size={18} className="text-[var(--accent-primary)] opacity-70 mt-1" />
          </button>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-16 bg-[var(--ui-border-muted)] shrink-0" />

        {/* Right: Link strips */}
        <div className="flex-1 flex flex-col gap-6">
          <div>
            <span className="pdv-display block text-[12.5px] font-bold tracking-[0.16em] uppercase text-[var(--ui-text-muted)] mb-3.5">
              Official products
            </span>
            <div className="flex flex-wrap gap-x-1 gap-y-2">
              {productLinks.map((lk) => (
                <button type="button"
                  key={lk.label}
                  onClick={() => openInBrowser(lk.href)}
                  className="pdv-link-ul bg-transparent border-none text-[14px] font-medium text-[var(--ui-text-secondary)] px-3 transition-colors duration-[180ms] cursor-pointer hover:text-[var(--ui-text-primary)]"
                >
                  {lk.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="pdv-display block text-[12.5px] font-bold tracking-[0.16em] uppercase text-[var(--ui-text-muted)] mb-3.5">
              Resources
            </span>
            <div className="flex flex-wrap gap-2.5 md:gap-0">
              {secondaryLinks.map((lk, i) => (
                <React.Fragment key={lk.label}>
                  <button type="button"
                    onClick={() => openInBrowser(lk.href)}
                    className="pdv-link-ul bg-transparent border-none text-[14px] font-medium text-[var(--ui-text-secondary)] px-4 transition-colors duration-[180ms] cursor-pointer hover:text-[var(--ui-text-primary)]"
                  >
                    {lk.label}
                  </button>
                  {i < secondaryLinks.length - 1 && (
                    <div className="hidden md:block w-px h-4 bg-[var(--ui-border-muted)] self-center" />
                  )}
                </React.Fragment>
              ))}
            </div>
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
    <div className="pdv-root h-full overflow-y-auto bg-[var(--surface-canvas)] p-[60px_80px] text-[var(--ui-text-primary)]">
      <style>{PDV_CSS}</style>

      {/* Close */}
      <button type="button"
        onClick={() => openView('chat')}
        className="fixed top-[18px] right-[18px] size-[38px] rounded-[10px] bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] flex items-center justify-center cursor-pointer text-[var(--ui-text-secondary)] transition-all duration-200 z-[100] hover:bg-[var(--ui-border-default)] hover:text-[var(--ui-text-primary)]"
      ><X size={16}/></button>

      <div className="max-w-[1160px] mx-auto">

        {/* Header */}
        <div className="text-center mb-[72px] relative pt-3">
          {/* Ambient glow orbs */}
          <div className="absolute -top-[100px] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse_at_50%_40%,rgba(212,176,140,0.10)_0%,rgba(217,119,87,0.06)_40%,transparent_70%)] blur-[50px] pointer-events-none" />
          <div className="absolute top-10 left-[15%] size-[180px] bg-[radial-gradient(circle,rgba(217,119,87,0.06)_0%,transparent_70%)] blur-[30px] pointer-events-none" />
          <div className="absolute top-5 right-[12%] size-[140px] bg-[radial-gradient(circle,rgba(212,176,140,0.08)_0%,transparent_70%)] blur-[24px] pointer-events-none" />

          <div className="relative">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 mb-7">
              <div className="w-6 h-px bg-[var(--accent-primary)] opacity-50" />
              <span className="pdv-display text-[12px] font-bold tracking-[0.2em] uppercase text-[var(--accent-primary)]">Allternit Platform</span>
              <div className="w-6 h-px bg-[var(--accent-primary)] opacity-50" />
            </div>

            {/* Main headline — Fraunces for the gradient line */}
            <h1 className="m-[0_0_20px_0] leading-[1.03]">
              <span className="pdv-display block text-[56px] font-bold text-[var(--ui-text-primary)] tracking-[-0.04em] leading-[1.07]">
                Everything you need
              </span>
              <span className="pdv-serif block text-[62px] font-900 tracking-[-0.03em] leading-none italic bg-gradient-to-r from-[#D97757] via-[#D4B08C] to-[#f59e0b] bg-clip-text text-transparent">
                to build with AI
              </span>
            </h1>

            <p className="pdv-display text-[16px] text-[var(--ui-text-secondary)] mx-auto max-w-[420px] leading-[1.7] font-normal tracking-[0.01em]">
              One platform. Every surface. Powered by any model.
            </p>

            {/* Decorative rule */}
            <div className="flex items-center justify-center gap-3 mt-9">
              <div className="w-12 h-px bg-gradient-to-r from-transparent to-[var(--ui-border-muted)]" />
              <Sparkle size={11} className="text-[var(--accent-primary)] opacity-60" weight="fill" />
              <div className="w-12 h-px bg-gradient-to-l from-transparent to-[var(--ui-border-muted)]" />
            </div>
          </div>
        </div>

        {/* Spotlight Carousel */}
        <div className="mb-16">
          <SpotlightCarousel />
        </div>

        {/* Video Showcase — real product demos */}
        <VideoShowcaseSection />

        {/* Social Proof */}
        <SocialProofSection />

        {/* Website Links */}
        <WebsiteLinksSection />

        {/* All Products */}
        <div className="mb-[56px]">
          <div className="flex items-baseline gap-2.5 mb-8">
            <h2 className="pdv-display text-[22px] font-bold text-[var(--ui-text-primary)] m-0 tracking-[-0.01em]">All Products</h2>
            <span className="text-[12px] text-[var(--ui-text-muted)]">{ALL_PRODUCTS.length} products</span>
          </div>
          {CATEGORIES.map(cat => {
            const ps = ALL_PRODUCTS.filter(p => p.category === cat);
            if (!ps.length) return null;
            return (
              <div key={cat} className="mb-8">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="text-[12px] font-bold tracking-[0.1em] uppercase text-[var(--ui-text-muted)]">{cat}</span>
                  <div className="flex-1 h-px bg-[var(--ui-border-muted)]" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {ps.map(p => <ProductMiniCard key={p.id} p={p}/>)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop */}
        <div className="mb-5">
          <DesktopBanner />
        </div>

        {/* Browser Capsule */}
        <div className="mb-5">
          <div className="rounded-3xl border border-solid border-blue-500/15 bg-[var(--surface-panel)] p-[32px_44px] flex items-center justify-between relative overflow-hidden">
            <div className="absolute -top-10 right-[60px] size-[120px] bg-[radial-gradient(circle,rgba(66,133,244,0.12)_0%,transparent_70%)] blur-[24px] animate-[pdv-float-a_8s_ease-in-out_infinite] pointer-events-none" />
            <div className="flex items-center gap-4.5 relative">
              <div className="size-[50px] rounded-[14px] bg-gradient-to-br from-[#4285F4] to-[#34A853] flex items-center justify-center shadow-[0_10px_28px_rgba(66,133,244,0.28)]"><Puzzle size={24} className="text-[var(--ui-text-primary)]" /></div>
              <div>
                <h3 className="text-[18px] font-semibold text-[var(--ui-text-primary)] m-0 mb-1">Allternit Browser Capsule</h3>
                <p className="text-[13px] text-[var(--ui-text-secondary)] m-0">AI in every tab. Click, automate, and analyze any webpage.</p>
              </div>
            </div>
            <div className="flex gap-2.5 relative">
              <button type="button" onClick={() => openView('browser-extensions')} className="p-[9px_16px] rounded-[10px] border border-solid border-[#4285F4] bg-blue-500/10 text-[var(--status-info)] text-[13px] font-medium cursor-pointer flex items-center gap-1.5 transition-all duration-200 hover:bg-[var(--status-info-bg)] hover:-translate-y-0.5">
                <ChromeIcon size={14}/> Open Extensions
              </button>
              <button type="button" onClick={() => setShowExt(v=>!v)} className="p-[9px_16px] rounded-[10px] border border-solid border-[var(--ui-border-muted)] bg-white/4 text-[var(--ui-text-secondary)] text-[13px] font-medium cursor-pointer transition-all duration-200 hover:bg-white/8 hover:text-[var(--ui-text-primary)]">
                {showExt ? 'Hide details' : 'More browsers'}
              </button>
            </div>
          </div>
          {showExt && <ExtensionDetail onClose={() => setShowExt(false)}/>}
        </div>

        {/* Infrastructure */}
        <div className="mb-5">
          <InfraSection />
        </div>

        {/* Footer CTA */}
        <div className="text-center p-[56px_32px] rounded-3xl border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] relative overflow-hidden mb-[72px]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] h-0.5 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-transparent" />
          <div className="absolute -top-[60px] left-1/2 -translate-x-1/2 w-[260px] h-[160px] bg-[radial-gradient(ellipse,rgba(212,176,140,0.1)_0%,transparent_70%)] blur-[30px] pointer-events-none" />
          <div className="relative">
            <div className="size-11 rounded-[14px] bg-[color-mix(in_srgb,var(--accent-primary)_12%,var(--surface-panel))] border border-solid border-[color-mix(in_srgb,var(--accent-primary)_22%,transparent)] flex items-center justify-center mx-auto mb-5">
              <Sparkle size={20} className="text-[var(--accent-primary)]" weight="fill" />
            </div>
            <h2 className="text-[28px] font-bold text-[var(--ui-text-primary)] m-[0_0_8px_0] tracking-[-0.02em]">Want early access?</h2>
            <p className="text-[15px] text-[var(--ui-text-secondary)] m-[0_0_28px_0] leading-[1.6]">
              Join the beta program for exclusive access to new features and products.
            </p>
            <button type="button"
              onClick={() => openInBrowser(OFFICIAL.signUp)}
              className="p-[13px_30px] rounded-xl border-none bg-gradient-to-br from-[var(--accent-primary)] to-[#B08D6E] text-[var(--ui-text-inverse)] text-[14px] font-bold cursor-pointer transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] tracking-[0.01em] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(212,176,140,0.3)]"
            >
              Create an account
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProductsDiscoveryView;
