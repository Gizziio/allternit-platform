'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Monitor, Keyboard, Spinner } from '@phosphor-icons/react';
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

export function FabricDesktopDrive({ runtimeId, getToken, hostName }: FabricDesktopDriveProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const frameUrl = useRef<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline' | 'locked'>('connecting');
  const [message, setMessage] = useState('Opening the live display…');
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const [inputMode, setInputMode] = useState<InputMode>('touch');
  const [viewMode, setViewMode] = useState<ViewMode>('fit');
  const [kbdOpen, setKbdOpen] = useState(false);
  const imgSize = useRef({ w: 0, h: 0 });
  const cursor = useRef({ x: 0, y: 0 });

  const sendInput = useCallback(
    async (ev: Record<string, unknown>) => {
      const token = await getToken();
      if (!token) return;
      await proxy(runtimeId, token, 'POST', '/v1/remote-control/desktop/input', ev).catch(() => {});
    },
    [getToken, runtimeId],
  );

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const tick = async () => {
      const token = await getToken().catch(() => null);
      if (!token || cancelled) return;
      try {
        const res = await proxy(runtimeId, token, 'GET', '/v1/remote-control/desktop/frame');
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 503 && !startingRef.current) {
            startingRef.current = true;
            setStarting(true);
            setMessage('Starting desktop capture on this machine…');
            await proxy(runtimeId, token, 'POST', '/v1/remote-control/desktop/start').catch(() => {});
            timer = window.setTimeout(tick, 1200);
            return;
          }
          setStatus('offline');
          setMessage(
            res.status === 503
              ? 'This machine is paired, but capture did not start. On the node: install phone-remote (or the VPS virtual desktop) and keep ao fabric serve running.'
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
        const img = imgRef.current;
        if (img) img.src = url;
        startingRef.current = false;
        setStarting(false);
        const hello = await proxy(runtimeId, token, 'GET', '/v1/remote-control/desktop/hello');
        let locked = false;
        if (hello.ok) {
          try {
            const info = await hello.json();
            locked = Boolean(info.locked);
          } catch { /* ignore */ }
        }
        setStatus(locked ? 'locked' : 'live');
        setMessage(locked ? 'Screen is locked — unlock the Mac, then this view continues' : (hostName ? hostName : 'Live'));
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

  function toImage(clientX: number, clientY: number) {
    const img = imgRef.current;
    if (!img || !imgSize.current.w) return null;
    const rect = img.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * imgSize.current.w;
    const y = ((clientY - rect.top) / rect.height) * imgSize.current.h;
    return { x: Math.round(x), y: Math.round(y) };
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
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-full gap-2">
      <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden border border-solid border-[var(--border-subtle)] bg-[#0b0b0a]">
        <div className="absolute top-0 inset-x-0 z-10 flex items-center gap-2 px-3 py-2 text-[11px] text-white/70">
          <span className={cn('size-2 rounded-full', status === 'live' ? 'bg-[#22c55e]' : status === 'connecting' ? 'bg-[#febc2e]' : 'bg-[#ef4444]')} />
          <span className="truncate">{message}</span>
          {status === 'connecting' ? <Spinner size={12} className="animate-spin ml-auto" /> : null}
        </div>
        {status === 'live' ? (
          <img
            ref={imgRef}
            alt="Live desktop"
            onLoad={onImgLoad}
            className={cn(
              'absolute inset-0 w-full h-full select-none',
              viewMode === 'fit' ? 'object-contain' : 'object-none object-center',
            )}
            draggable={false}
            onTouchStart={(e) => {
              e.preventDefault();
              const t = e.touches[0];
              if (!t) return;
              if (inputMode === 'touch') {
                const p = toImage(t.clientX, t.clientY);
                if (p) void sendInput({ type: 'click', x: p.x, y: p.y, button: 'left' });
              }
            }}
            onTouchMove={(e) => {
              if (inputMode !== 'trackpad' || e.touches.length !== 1) return;
              e.preventDefault();
              const t = e.touches[0];
              const p = toImage(t.clientX, t.clientY);
              if (p) {
                cursor.current = p;
                void sendInput({ type: 'move', x: p.x, y: p.y });
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Monitor size={36} className="text-white/35" />
            <div className="text-[13px] font-semibold text-white/80">{message}</div>
          </div>
        )}
      </div>
      <div className="shrink-0 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setInputMode('touch')} className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-none cursor-pointer', inputMode === 'touch' ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)]' : 'bg-[var(--surface-hover)] text-[var(--shell-item-muted)]')}>Touch</button>
        <button type="button" onClick={() => setInputMode('trackpad')} className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-none cursor-pointer', inputMode === 'trackpad' ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)]' : 'bg-[var(--surface-hover)] text-[var(--shell-item-muted)]')}>Trackpad</button>
        <button type="button" onClick={() => setViewMode('fit')} className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-none cursor-pointer', viewMode === 'fit' ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)]' : 'bg-[var(--surface-hover)] text-[var(--shell-item-muted)]')}>Fit</button>
        <button type="button" onClick={() => setViewMode('actual')} className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-none cursor-pointer', viewMode === 'actual' ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)]' : 'bg-[var(--surface-hover)] text-[var(--shell-item-muted)]')}>Actual</button>
        <button type="button" onClick={() => setKbdOpen((v) => !v)} className={cn('ml-auto px-2.5 py-1.5 rounded-lg text-[11px] font-bold border-none cursor-pointer inline-flex items-center gap-1', kbdOpen ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)]' : 'bg-[var(--surface-hover)] text-[var(--shell-item-muted)]')}>
          <Keyboard size={13} /> Keyboard
        </button>
      </div>
      {kbdOpen ? (
        <textarea
          className="shrink-0 w-full min-h-[44px] rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] text-[16px] px-3 py-2 text-[var(--shell-item-fg)]"
          placeholder="Type here — it goes to the remote machine"
          autoCapitalize="off"
          autoCorrect="off"
          onInput={(e) => {
            const el = e.currentTarget;
            if (el.value) {
              void sendInput({ type: 'text', text: el.value });
              el.value = '';
            }
          }}
          onKeyDown={(e) => {
            const named: Record<string, string> = { Backspace: 'delete', Enter: 'return', Escape: 'esc', Tab: 'tab', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
            const key = named[e.key];
            if (key) {
              e.preventDefault();
              void sendInput({ type: 'key', key });
            }
          }}
        />
      ) : null}
    </div>
  );
}
