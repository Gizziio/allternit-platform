'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { ChatComposer } from '@/views/chat/ChatComposer';
import { HudTranscript } from './HudTranscript';

const HUD_SESSION_NAME = 'HUD Session';
const RESIZE_THRESHOLD = 2;

function isElectronShell(): boolean {
  return typeof window !== 'undefined' && !!window.allternit?.shell;
}

export function HudApp(): React.ReactNode {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const createSession = useChatSessionStore((state) => state.createSession);
  const setActiveSession = useChatSessionStore((state) => state.setActiveSession);
  const sendMessageStream = useChatSessionStore((state) => state.sendMessageStream);
  const streamingState = useChatSessionStore((state) =>
    sessionId ? state.streamingBySession[sessionId] : null,
  );
  const session = useChatSessionStore((state) =>
    sessionId ? state.sessions.find((s) => s.id === sessionId) ?? null : null,
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number | null>(null);

  // Create or load the dedicated HUD chat session.
  // This effect intentionally does NOT depend on `sessions` so that the
  // optimistic-session update does not cancel the backend creation promise.
  useEffect(() => {
    if (sessionId) return;

    let cancelled = false;
    const existing = useChatSessionStore
      .getState()
      .sessions.find((s) => s.metadata?.isHudSession === true);
    if (existing) {
      setSessionId(existing.id);
      setActiveSession(existing.id);
      return;
    }

    void (async () => {
      try {
        const id = await createSession({
          name: HUD_SESSION_NAME,
          metadata: { isHudSession: true },
        });
        if (!cancelled) {
          setSessionId(id);
          setActiveSession(id);
        }
      } catch (error) {
        console.error('[HudApp] Failed to create HUD session:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, createSession, setActiveSession]);

  // Make the page body transparent so the desktop shows through, and force
  // dark theme so the real ChatComposer renders with the HUD's frosted navy
  // look instead of the platform's default light theme.
  useEffect(() => {
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevRootBg = document.getElementById('root')?.style.backgroundColor;
    const prevTheme = document.documentElement.getAttribute('data-theme');

    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    document.documentElement.setAttribute('data-theme', 'dark');
    const root = document.getElementById('root');
    if (root) root.style.backgroundColor = 'transparent';

    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
      if (prevTheme) document.documentElement.setAttribute('data-theme', prevTheme);
      else document.documentElement.removeAttribute('data-theme');
      if (root) root.style.backgroundColor = prevRootBg ?? '';
    };
  }, []);

  // ResizeObserver: report root container height changes to the Electron shell
  useEffect(() => {
    if (!rootRef.current || !isElectronShell()) return;

    const resizeHud = window.allternit?.shell?.resizeHud;
    if (typeof resizeHud !== 'function') return;

    let lastReported = lastHeightRef.current ?? rootRef.current.getBoundingClientRect().height;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = Math.round(entry.contentRect.height);
        if (Math.abs(height - lastReported) > RESIZE_THRESHOLD) {
          lastReported = height;
          lastHeightRef.current = height;
          void resizeHud({ height });
        }
      }
    });

    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  const isStreaming = useMemo(
    () => streamingState?.isStreaming ?? false,
    [streamingState],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || !sessionId || isStreaming) return;
      try {
        await sendMessageStream(sessionId, { text: text.trim() });
      } catch (error) {
        console.error('[HudApp] Failed to send message:', error);
      }
    },
    [sessionId, isStreaming, sendMessageStream],
  );

  const handleStop = useCallback(() => {
    const controller = streamingState?.abortController;
    if (controller) {
      controller.abort();
    }
  }, [streamingState]);

  const handleClose = useCallback(() => {
    window.allternit?.shell?.closeHud?.();
  }, []);

  // Dragging: move the Electron window by pointer delta
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isElectronShell()) return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    const interactive = target.closest('button, input, textarea, a, [role="button"]');
    if (interactive) return;

    const row = composerRef.current;
    if (!row) return;

    setIsDragging(true);
    row.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const moveHud = window.allternit?.shell?.moveHud;
      if (typeof moveHud !== 'function') return;
      void moveHud({ dx: e.movementX, dy: e.movementY });
    },
    [isDragging],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const row = composerRef.current;
    if (row) {
      try {
        row.releasePointerCapture(e.pointerId);
      } catch {
        // capture may already be released
      }
    }
    setIsDragging(false);
  }, [isDragging]);

  const isElectron = isElectronShell();

  return (
    <div
      ref={rootRef}
      className="w-full flex justify-center bg-transparent px-4 py-2"
      style={{ background: 'transparent' }}
    >
      <div className="relative w-full max-w-[720px]">
        {/* Close button */}
        {isElectron && (
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close HUD"
            className="absolute -top-2 -right-2 z-20 flex items-center justify-center size-6 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white border border-white/10 backdrop-blur-md transition-colors"
          >
            <X size={12} />
          </button>
        )}

        {/* Composer bar */}
        <div
          ref={composerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`
            w-full rounded-2xl shadow-2xl overflow-hidden
            ${isDragging ? 'cursor-grabbing' : isElectron ? 'cursor-grab' : 'cursor-default'}
          `}
        >
          <ChatComposer
            onSend={handleSend}
            isLoading={isStreaming}
            onStop={handleStop}
            placeholder="Push it further"
            compact
            showTopActions={false}
            showModeToggle={false}
          />
        </div>

        {/* Transcript panel */}
        <HudTranscript session={session} streamingState={streamingState} />
      </div>
    </div>
  );
}

export default HudApp;
