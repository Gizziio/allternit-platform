'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Monitor, Keyboard, Spinner, PlusSquare } from '@phosphor-icons/react';
import { cloudApiUrl } from '@/lib/cloud-api';
import { cn } from '@/lib/utils';

export interface FabricDesktopDriveProps {
  runtimeId: string;
  getToken: () => Promise<string | null>;
  hostName?: string;
}

type InputMode = 'touch' | 'trackpad';
type ViewMode = 'fit' | 'actual';

async function proxy(
  runtimeId: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(cloudApiUrl(`/api/v1/runtime-devices/${encodeURIComponent(runtimeId)}/proxy`), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      method,
      path,
      body: body === undefined ? '' : JSON.stringify(body),
      bodyEncoding: 'utf8',
    }),
  });
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

/** Safari moves this when the URL bar or keyboard comes in. Use it as the phone shell. */
export function useVisualViewportRect() {
  const [rect, setRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  useEffect(() => {
    const apply = () => {
      const v = window.visualViewport;
      if (v) setRect({ top: v.offsetTop, left: v.offsetLeft, width: v.width, height: v.height });
      else setRect({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
    };
    apply();
    window.visualViewport?.addEventListener('resize', apply);
    window.visualViewport?.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', apply);
    window.addEventListener('resize', apply);
    return () => {
      window.visualViewport?.removeEventListener('resize', apply);
      window.visualViewport?.removeEventListener('scroll', apply);
      window.removeEventListener('orientationchange', apply);
      window.removeEventListener('resize', apply);
    };
  }, []);
  return rect;
}

export function FabricDesktopDrive({ runtimeId, getToken, hostName }: FabricDesktopDriveProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const frameUrl = useRef<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline' | 'locked'>('connecting');
  const [message, setMessage] = useState('Opening the live display…');
  const startingRef = useRef(false);
  const [inputMode, setInputMode] = useState<InputMode>('touch');
  const [viewMode, setViewMode] = useState<ViewMode>('fit');
  const [kbdOpen, setKbdOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [standalone, setStandalone] = useState(isStandaloneDisplay);
  const [installHelp, setInstallHelp] = useState(false);
  const installPromptRef = useRef<Event & { prompt?: () => Promise<void> } | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const imgSize = useRef({ w: 0, h: 0 });
  const cursor = useRef({ x: 0, y: 0 });
  const [xf, setXf] = useState({ scale: 1, x: 0, y: 0 });
  const xfRef = useRef(xf);
  xfRef.current = xf;
  const gesture = useRef<null | {
    mode: 'pan' | 'two' | 'trackpad';
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    orig: { scale: number; x: number; y: number };
    dist: number;
    pinch: boolean;
    scrollX: number;
    scrollY: number;
    moved: boolean;
    startT: number;
  }>(null);

  const sendInput = useCallback(
    async (ev: Record<string, unknown>) => {
      const token = await getToken();
      if (!token) return;
      await proxy(runtimeId, token, 'POST', '/v1/remote-control/desktop/input', ev).catch(() => {});
    },
    [getToken, runtimeId],
  );

  const sendDraft = useCallback(async () => {
    const text = draft;
    if (!text.trim()) return;
    await sendInput({ type: 'text', text });
    setDraft('');
  }, [draft, sendInput]);

  const layout = useCallback((mode: ViewMode) => {
    const stage = stageRef.current;
    const { w, h } = imgSize.current;
    if (!stage || !w || !h) return;
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const fit = Math.min(sw / w, sh / h);
    const scale = mode === 'fit' ? fit : Math.max(1, fit);
    setXf({
      scale,
      x: (sw - w * scale) / 2,
      y: (sh - h * scale) / 2,
    });
  }, []);

  useEffect(() => {
    const onOrient = () => {
      setStandalone(isStandaloneDisplay());
      layout(viewMode);
    };
    window.addEventListener('orientationchange', onOrient);
    window.addEventListener('resize', onOrient);
    window.visualViewport?.addEventListener('resize', onOrient);
    window.screen?.orientation?.addEventListener?.('change', onOrient);
    return () => {
      window.removeEventListener('orientationchange', onOrient);
      window.removeEventListener('resize', onOrient);
      window.visualViewport?.removeEventListener('resize', onOrient);
      window.screen?.orientation?.removeEventListener?.('change', onOrient);
    };
  }, [layout, viewMode]);

  useEffect(() => {
    layout(viewMode);
  }, [layout, viewMode, status, kbdOpen]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      installPromptRef.current = e as Event & { prompt?: () => Promise<void> };
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let helloAt = 0;

    const tick = async () => {
      const token = await getToken().catch(() => null);
      if (!token || cancelled) return;
      try {
        const res = await proxy(runtimeId, token, 'GET', '/v1/remote-control/desktop/frame');
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 503 && !startingRef.current) {
            startingRef.current = true;
            setMessage('Starting desktop capture on this machine…');
            await proxy(runtimeId, token, 'POST', '/v1/remote-control/desktop/start').catch(() => {});
            timer = window.setTimeout(tick, 1200);
            return;
          }
          setStatus('offline');
          setMessage(
            res.status === 503
              ? 'This machine is paired, but capture did not start. Keep Allternit Desktop open.'
              : `Desktop relay ${res.status}`,
          );
          timer = window.setTimeout(tick, 2500);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (frameUrl.current) URL.revokeObjectURL(frameUrl.current);
        const url = URL.createObjectURL(blob);
        frameUrl.current = url;
        if (imgRef.current) imgRef.current.src = url;
        startingRef.current = false;
        if (Date.now() - helloAt > 2000) {
          helloAt = Date.now();
          const hello = await proxy(runtimeId, token, 'GET', '/v1/remote-control/desktop/hello');
          let locked = false;
          if (hello.ok) {
            try {
              const info = await hello.json();
              locked = Boolean(info.locked);
            } catch { /* ignore */ }
          }
          setStatus(locked ? 'locked' : 'live');
          setMessage(locked ? 'Screen is locked — unlock the Mac' : (hostName ? hostName : 'Live'));
        } else {
          setStatus((s) => (s === 'offline' || s === 'connecting' ? 'live' : s));
        }
      } catch {
        if (!cancelled) {
          setStatus('offline');
          setMessage('Runtime relay is offline');
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, 120);
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (frameUrl.current) URL.revokeObjectURL(frameUrl.current);
    };
  }, [getToken, runtimeId, hostName]);

  function clientToImage(clientX: number, clientY: number) {
    const stage = stageRef.current;
    const { w, h } = imgSize.current;
    if (!stage || !w) return null;
    const rect = stage.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const { scale, x, y } = xfRef.current;
    const ix = (sx - x) / scale;
    const iy = (sy - y) / scale;
    if (ix < 0 || iy < 0 || ix > w || iy > h) return null;
    return { x: Math.round(ix), y: Math.round(iy) };
  }

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w && (w !== imgSize.current.w || h !== imgSize.current.h)) {
      imgSize.current = { w, h };
      cursor.current = { x: w / 2, y: h / 2 };
      void sendInput({ type: 'view', imgW: w, imgH: h });
      layout(viewMode);
    }
  };

  function pinchDist(e: React.TouchEvent) {
    const a = e.touches[0];
    const b = e.touches[1];
    if (!a || !b) return 0;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function pinchMid(e: React.TouchEvent) {
    const a = e.touches[0];
    const b = e.touches[1];
    if (!a || !b) return { x: 0, y: 0 };
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    if (e.touches.length >= 2) {
      const mid = pinchMid(e);
      gesture.current = {
        mode: 'two',
        startX: mid.x,
        startY: mid.y,
        lastX: mid.x,
        lastY: mid.y,
        orig: { ...xfRef.current },
        dist: pinchDist(e),
        pinch: false,
        scrollX: 0,
        scrollY: 0,
        moved: false,
        startT: performance.now(),
      };
      return;
    }
    if (inputMode === 'trackpad') {
      gesture.current = {
        mode: 'trackpad',
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastY: t.clientY,
        orig: { ...xfRef.current },
        dist: 0,
        pinch: false,
        scrollX: 0,
        scrollY: 0,
        moved: false,
        startT: performance.now(),
      };
      return;
    }
    gesture.current = {
      mode: 'pan',
      startX: t.clientX,
      startY: t.clientY,
      lastX: t.clientX,
      lastY: t.clientY,
      orig: { ...xfRef.current },
      dist: 0,
      pinch: false,
      scrollX: 0,
      scrollY: 0,
      moved: false,
      startT: performance.now(),
    };
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault();
    const g = gesture.current;
    if (!g) return;
    if (e.touches.length >= 2 && g.mode === 'two') {
      const mid = pinchMid(e);
      const dist = pinchDist(e);
      const ratio = dist / (g.dist || dist);
      if (!g.pinch && (ratio > 1.12 || ratio < 0.89)) g.pinch = true;
      if (g.pinch) {
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        const px = mid.x - rect.left;
        const py = mid.y - rect.top;
        const nextScale = clamp(g.orig.scale * ratio, 0.2, 8);
        const cx = (px - g.orig.x) / g.orig.scale;
        const cy = (py - g.orig.y) / g.orig.scale;
        setXf({
          scale: nextScale,
          x: px - cx * nextScale,
          y: py - cy * nextScale,
        });
      } else {
        g.scrollX += mid.x - g.lastX;
        g.scrollY += mid.y - g.lastY;
        const step = 18;
        const dx = Math.trunc(g.scrollX / step);
        const dy = Math.trunc(g.scrollY / step);
        if (dx || dy) {
          void sendInput({ type: 'scroll', dx, dy });
          g.scrollX -= dx * step;
          g.scrollY -= dy * step;
        }
      }
      g.lastX = mid.x;
      g.lastY = mid.y;
      g.moved = true;
      return;
    }
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - g.lastX;
    const dy = t.clientY - g.lastY;
    if (Math.hypot(t.clientX - g.startX, t.clientY - g.startY) > 6) g.moved = true;
    if (g.mode === 'trackpad') {
      const { scale } = xfRef.current;
      cursor.current.x = clamp(cursor.current.x + dx / scale, 0, imgSize.current.w);
      cursor.current.y = clamp(cursor.current.y + dy / scale, 0, imgSize.current.h);
      void sendInput({ type: 'move', x: Math.round(cursor.current.x), y: Math.round(cursor.current.y) });
    } else if (g.mode === 'pan') {
      const stage = stageRef.current;
      const { w, h } = imgSize.current;
      const fit = stage && w ? Math.min(stage.clientWidth / w, stage.clientHeight / h) : 1;
      if (xfRef.current.scale > fit * 1.08) {
        setXf((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      }
    }
    g.lastX = t.clientX;
    g.lastY = t.clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const g = gesture.current;
    if (!g) return;
    if (e.touches.length > 0) return;
    if (g.mode === 'pan' && !g.moved && performance.now() - g.startT < 280) {
      const p = clientToImage(g.startX, g.startY);
      if (p) void sendInput({ type: 'click', x: p.x, y: p.y, button: 'left' });
    }
    if (g.mode === 'trackpad' && !g.moved && performance.now() - g.startT < 280) {
      void sendInput({ type: 'click', x: Math.round(cursor.current.x), y: Math.round(cursor.current.y), button: 'left' });
    }
    gesture.current = null;
  }

  const innerW = imgSize.current.w || 1920;
  const innerH = imgSize.current.h || 1080;

  return (
    <div className="relative h-full min-h-0 bg-[#0b0b0a]">
      <div
        ref={stageRef}
        className="absolute inset-0 overflow-hidden touch-none bg-[#0b0b0a]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onWheel={(e) => {
          e.preventDefault();
          const dx = Math.trunc(e.deltaX / 40);
          const dy = Math.trunc(e.deltaY / 40);
          if (dx || dy) void sendInput({ type: 'scroll', dx, dy });
        }}
      >
        {status !== 'live' ? (
          <div className="absolute top-2 left-2 z-10 pointer-events-none flex items-center gap-2 text-[11px] text-white/70">
            <span className={cn('size-2 rounded-full', status === 'connecting' ? 'bg-[#febc2e]' : 'bg-[#ef4444]')} />
            <span className="truncate">{message}</span>
            {status === 'connecting' ? <Spinner size={12} className="animate-spin" /> : null}
          </div>
        ) : null}
        {status === 'live' || status === 'locked' ? (
          <div
            style={{
              position: 'absolute',
              width: innerW,
              height: innerH,
              transform: `translate(${xf.x}px, ${xf.y}px) scale(${xf.scale})`,
              transformOrigin: '0 0',
              willChange: 'transform',
            }}
          >
            <img
              ref={imgRef}
              alt="Live desktop"
              onLoad={onImgLoad}
              className="block w-full h-full select-none pointer-events-none"
              draggable={false}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Monitor size={36} className="text-white/35" />
            <div className="text-[13px] font-semibold text-white/80">{message}</div>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20">
      <div
        className="flex flex-nowrap items-center gap-1.5 px-2 pt-2 overflow-x-auto"
        style={{
          paddingBottom: kbdOpen ? 6 : 'max(10px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, rgba(0,0,0,0.88), rgba(0,0,0,0.35))',
        }}
      >
        {([
          { id: 'touch', label: 'Touch', on: inputMode === 'touch', go: () => setInputMode('touch') },
          { id: 'trackpad', label: 'Track', on: inputMode === 'trackpad', go: () => setInputMode('trackpad') },
          { id: 'fit', label: 'Fit', on: viewMode === 'fit', go: () => { setViewMode('fit'); layout('fit'); } },
          { id: 'actual', label: '1:1', on: viewMode === 'actual', go: () => { setViewMode('actual'); layout('actual'); } },
        ] as const).map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={b.go}
            className={cn(
              'h-9 min-w-9 shrink-0 px-3 rounded-full text-[12px] font-semibold leading-none border-none cursor-pointer',
              b.on ? 'bg-white text-black' : 'bg-white/15 text-white',
            )}
          >
            {b.label}
          </button>
        ))}
        {!standalone ? (
          <button
            type="button"
            onClick={() => {
              const prompt = installPromptRef.current;
              if (prompt?.prompt) {
                void prompt.prompt();
                return;
              }
              setInstallHelp(true);
            }}
            className="h-9 min-w-9 shrink-0 px-3 rounded-full text-[12px] font-semibold leading-none border-none cursor-pointer bg-white/15 text-white inline-flex items-center justify-center gap-1"
          >
            <PlusSquare size={14} weight="bold" />
            Home
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setKbdOpen((open) => {
              const next = !open;
              if (next) setTimeout(() => composerRef.current?.focus(), 50);
              return next;
            });
          }}
          className={cn(
            'ml-auto h-9 min-w-9 shrink-0 px-3 rounded-full text-[12px] font-semibold leading-none border-none cursor-pointer inline-flex items-center justify-center gap-1',
            kbdOpen ? 'bg-white text-black' : 'bg-white/15 text-white',
          )}
        >
          <Keyboard size={14} weight="bold" />
          Keys
        </button>
        <span className={cn('shrink-0 size-2 rounded-full', status === 'live' ? 'bg-[#22c55e]' : status === 'connecting' ? 'bg-[#febc2e]' : 'bg-[#ef4444]')} />
      </div>
      {installHelp && !standalone ? (
        <div className="absolute inset-x-4 z-40 rounded-2xl bg-[#1c1c1c] p-3 text-[13px] text-white shadow-lg" style={{ bottom: 'max(56px, env(safe-area-inset-bottom))' }}>
          <div className="font-semibold mb-1">Add to Home Screen</div>
          <p className="m-0 text-white/75 leading-5">Tap Safari’s Share button, then <strong>Add to Home Screen</strong>. Safari does not let a page do that itself. After that, this button hides.</p>
          <button type="button" onClick={() => setInstallHelp(false)} className="mt-2 rounded-lg border-none bg-white text-black text-[12px] font-bold px-3 py-1.5 cursor-pointer">OK</button>
        </div>
      ) : null}
      {kbdOpen ? (
        <div className="flex flex-col gap-1 px-2 pt-1 bg-[#0b0b0a]" style={{ paddingBottom: 'max(8px, env(keyboard-inset-height, 0px), env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-1 overflow-x-auto">
          {(['esc', 'tab', 'ctrl', 'alt', 'left', 'right', 'up', 'down'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => void sendInput({ type: 'key', key })}
              className="h-8 shrink-0 rounded-full border-none bg-white/15 text-white text-[12px] font-semibold px-3 cursor-pointer"
            >
              {key}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={composerRef}
            value={draft}
            rows={1}
            className="flex-1 h-9 min-h-9 rounded-full border-none bg-white/10 text-[16px] px-3 py-1.5 text-white"
            placeholder="Type or dictate — Send to the Mac"
            autoCapitalize="off"
            autoCorrect="off"
            enterKeyHint="send"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendDraft();
                return;
              }
              if (draft) return;
              const named: Record<string, string> = { Backspace: 'delete', Escape: 'esc', Tab: 'tab', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
              const key = named[e.key];
              if (key) {
                e.preventDefault();
                void sendInput({ type: 'key', key });
              }
            }}
          />
          <button
            type="button"
            onClick={() => void sendDraft()}
            className="h-9 shrink-0 rounded-full border-none bg-white text-black text-[12px] font-semibold px-3 cursor-pointer"
          >
            Send
          </button>
        </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
