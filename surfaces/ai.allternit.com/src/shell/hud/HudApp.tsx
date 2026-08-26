'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Mic, VolumeX, ScanEye, ArrowUp, X } from 'lucide-react';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { HudTranscript } from './HudTranscript';

const HUD_SESSION_NAME = 'HUD Session';
const RESIZE_THRESHOLD = 2;

function isElectronShell(): boolean {
  return typeof window !== 'undefined' && !!window.allternit?.shell;
}

export function HudApp(): React.ReactNode {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const sessions = useChatSessionStore((state) => state.sessions);
  const createSession = useChatSessionStore((state) => state.createSession);
  const setActiveSession = useChatSessionStore((state) => state.setActiveSession);
  const sendMessageStream = useChatSessionStore((state) => state.sendMessageStream);
  const streamingState = useChatSessionStore((state) =>
    sessionId ? state.streamingBySession[sessionId] : null,
  );
  const session = useChatSessionStore((state) =>
    sessionId ? state.sessions.find((s) => s.id === sessionId) ?? null : null,
  );
  const appendAssistantMessage = useChatSessionStore((state) => state.appendAssistantMessage);
  const updateMessage = useChatSessionStore((state) => state.updateMessage);

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number | null>(null);

  // Create or load the dedicated HUD chat session
  useEffect(() => {
    if (sessionId) return;

    let cancelled = false;
    const existing = sessions.find((s) => s.metadata?.isHudSession === true);
    if (existing) {
      if (!cancelled) {
        setSessionId(existing.id);
        setActiveSession(existing.id);
      }
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
  }, [sessionId, sessions, createSession, setActiveSession]);

  // Auto-focus the input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // DEMO: inject a fake assistant response when ?hud-demo=1 is present
  useEffect(() => {
    if (!sessionId || !window.location.search.includes('hud-demo=1')) return;
    if (!session) return;

    const msgId = 'hud-demo-msg-1';
    const timer = setTimeout(() => {
      appendAssistantMessage(sessionId, {
        id: msgId,
        content: '',
      });

      // Simulate streaming with a brief "thinking" phase then the final answer.
      const thinkingTimer = setTimeout(() => {
        updateMessage(sessionId, msgId, {
          thinking: 'The user is asking about the app underneath the HUD. I can see Chrome with an X post.',
        });
      }, 200);

      const contentTimer = setTimeout(() => {
        updateMessage(sessionId, msgId, {
          content:
            'Underneath the HUD is Google Chrome, open to an X post by Brooklyn! (@imbabybrooklyn).\n\n**Summary**\n\n- Hermes becomes an overlay on top of the app you\'re working in, rather than a separate window you must switch to.\n- It can also remain available as a small "buddy agent."\n- You can ask it spontaneous questions and drag it wherever you want.',
        });
      }, 600);

      return () => {
        clearTimeout(thinkingTimer);
        clearTimeout(contentTimer);
      };
    }, 300);

    return () => clearTimeout(timer);
  }, [sessionId, session, appendAssistantMessage, updateMessage]);

  // Make the page body transparent so the desktop shows through
  useEffect(() => {
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevRootBg = document.getElementById('root')?.style.backgroundColor;

    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    const root = document.getElementById('root');
    if (root) root.style.backgroundColor = 'transparent';

    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
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

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || !sessionId || isStreaming) return;
    setInputValue('');
    try {
      await sendMessageStream(sessionId, { text });
    } catch (error) {
      console.error('[HudApp] Failed to send message:', error);
    }
  }, [inputValue, sessionId, isStreaming, sendMessageStream]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

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
            flex items-center gap-2 w-full px-3 py-2
            bg-[rgba(22,33,68,0.78)] backdrop-blur-md
            border border-white/10 rounded-2xl shadow-2xl
            ${isDragging ? 'cursor-grabbing' : isElectron ? 'cursor-grab' : 'cursor-default'}
          `}
        >
          <button
            type="button"
            aria-label="Add attachment"
            className="flex-shrink-0 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Plus size={18} />
          </button>

          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Push it further"
            disabled={isStreaming}
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/40 disabled:opacity-60"
          />

          <button
            type="button"
            aria-label="Voice input"
            className="flex-shrink-0 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Mic size={18} />
          </button>

          <button
            type="button"
            aria-label="Mute"
            className="flex-shrink-0 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <VolumeX size={18} />
          </button>

          <button
            type="button"
            aria-label="Screenshot"
            className="flex-shrink-0 p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ScanEye size={18} />
          </button>

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!inputValue.trim() || isStreaming}
            aria-label="Send"
            className="flex-shrink-0 flex items-center justify-center size-9 rounded-full bg-white/15 hover:bg-white/25 text-white disabled:opacity-40 disabled:hover:bg-white/15 transition-colors"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Transcript panel */}
        <HudTranscript session={session} streamingState={streamingState} />
      </div>
    </div>
  );
}

export default HudApp;
