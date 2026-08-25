'use client';

import React, { memo, useMemo } from 'react';
import { ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import type { ChatSession, ModeSessionMessage } from '@/views/chat/ChatSessionStore';

interface HudTranscriptProps {
  session: ChatSession | null;
  streamingState: { isStreaming: boolean; error: string | null } | null;
}

/**
 * Minimal markdown-ish renderer for the HUD.
 * Only handles bold, bullets, and line breaks so the output stays compact.
 */
function renderHudText(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;

    const key = `${idx}`;
    const isBullet = /^[-*]\s+/.test(line);
    const cleanLine = isBullet ? line.replace(/^[-*]\s+/, '') : line;

    // Bold **text**
    const parts = cleanLine.split(/(\*\*.*?\*\*)/g).map((part, pidx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pidx} className="font-semibold text-white/95">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={pidx}>{part}</span>;
    });

    if (isBullet) {
      nodes.push(
        <li key={key} className="ml-4 list-disc text-white/80 text-sm leading-relaxed">
          {parts}
        </li>
      );
    } else {
      nodes.push(
        <p key={key} className="text-white/85 text-sm leading-relaxed">
          {parts}
        </p>
      );
    }
  });

  return <div className="space-y-1">{nodes}</div>;
}

function formatHudTimestamp(timestamp?: string): string {
  if (!timestamp) return 'now';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'now';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const HudTranscript = memo(function HudTranscript({
  session,
  streamingState,
}: HudTranscriptProps): React.ReactNode | null {
  const isStreaming = streamingState?.isStreaming ?? false;
  const error = streamingState?.error ?? null;

  // Show only the most recent assistant turn(s). In the HUD we want a single
  // compact response card rather than a full chat history.
  const latestAssistant = useMemo<ModeSessionMessage | null>(() => {
    if (!session?.messages?.length) return null;
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const m = session.messages[i];
      if (m.role === 'assistant') return m;
    }
    return null;
  }, [session]);

  const hasContent = Boolean(latestAssistant?.content?.trim() || latestAssistant?.thinking?.trim());

  if (!hasContent && !isStreaming && !error) return null;

  return (
    <div className="mt-2 w-full rounded-2xl border border-white/10 bg-[rgba(22,33,68,0.78)] backdrop-blur-md shadow-2xl overflow-hidden">
      <div className="px-4 py-3 space-y-3">
        {/* Reasoning / thinking */}
        {latestAssistant?.thinking ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <ChevronRight size={12} className="rotate-90" />
              <span>Thought briefly</span>
            </div>
            <p className="pl-4 text-xs text-white/50 italic leading-relaxed">
              {latestAssistant.thinking}
            </p>
          </div>
        ) : null}

        {/* Main answer */}
        {latestAssistant?.content ? (
          <div className="text-white/90">
            {renderHudText(latestAssistant.content)}
          </div>
        ) : null}

        {/* Streaming placeholder */}
        {isStreaming && !latestAssistant?.content ? (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 size={14} className="animate-spin" />
            <span>Thinking…</span>
          </div>
        ) : null}

        {/* Error */}
        {error ? (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        ) : null}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-white/5">
        <div className="flex items-center gap-2 text-[11px] text-white/40">
          <span>{formatHudTimestamp(latestAssistant?.timestamp)}</span>
          {isStreaming ? (
            <>
              <span className="text-white/30">·</span>
              <span className="flex items-center gap-1 text-white/60">
                <Loader2 size={10} className="animate-spin" />
                streaming
              </span>
            </>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Regenerate"
          className="p-1 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        >
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  );
});

export default HudTranscript;
