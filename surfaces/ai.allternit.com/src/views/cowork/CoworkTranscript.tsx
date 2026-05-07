/**
 * CoworkTranscript - Interleaves chat messages with inline work blocks
 * Renders the unified stream: message → work block → message → work block
 */

import React, { memo, useEffect, useState } from 'react';
import { StreamingChatComposer } from '@/components/chat/StreamingChatComposer';
import { CoworkWorkBlock } from './CoworkWorkBlock';
import { MessagePartList } from './CoworkStreamBlock';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { coworkTransitionController } from '@/lib/agents/session-transition-controller';
import type { ChatMessage } from '@/lib/ai/rust-stream-adapter';
import type { AnyCoworkEvent } from './cowork.types';

interface CoworkTranscriptProps {
  /** Legacy: explicit messages array (CoworkRoot) */
  messages?: ChatMessage[];
  isLoading?: boolean;
  onRegenerate: () => void;
  /** When provided, limits parts lookup to this gizzi-code session */
  sessionId?: string;
  /** New: pull messages from the chat session store by ID */
  conversationId?: string;
  /** Phase 2: agent sub-session IDs to merge into this transcript */
  linkedSessionIds?: string[];
}

// Work event types that should render as inline blocks
const INLINE_WORK_TYPES = [
  'cowork.action',
  'cowork.command', 
  'cowork.file',
  'cowork.observation',
  'cowork.checkpoint',
  'cowork.tool_call',
  'cowork.tool_result',
];

/**
 * Merge messages and work events into a unified timeline
 * sorted by timestamp
 */
function mergeTimeline(
  messages: ChatMessage[],
  events: AnyCoworkEvent[]
): Array<{ type: 'message' | 'work'; data: any; id: string }> {
  const workEvents = (events || []).filter(e => INLINE_WORK_TYPES.includes(e.type));
  
  const items: Array<{ type: 'message' | 'work'; data: any; id: string; timestamp: number }> = [
    ...(messages || []).map(m => ({
      type: 'message' as const,
      data: m,
      id: m.id,
      timestamp: m.createdAt?.getTime() || Date.now(),
    })),
    ...workEvents.map(e => ({
      type: 'work' as const,
      data: e,
      id: e.id,
      timestamp: e.timestamp,
    })),
  ];
  
  // Sort by timestamp
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export const CoworkTranscript = memo(function CoworkTranscript({
  messages: messagesProp,
  isLoading: isLoadingProp,
  onRegenerate,
  sessionId,
  conversationId,
  linkedSessionIds,
}: CoworkTranscriptProps) {
  // When conversationId is provided, pull messages from the chat session store
  const storeSession = useChatSessionStore((state) =>
    conversationId ? state.sessions.find((s) => s.id === conversationId) ?? null : null
  );
  const storeStreaming = useChatSessionStore((state) =>
    conversationId ? state.streamingBySession[conversationId] : null
  );

  // Phase 2: Pull messages from linked agent sub-sessions
  const linkedSessions = useChatSessionStore((state) =>
    (linkedSessionIds || [])
      .map((id) => state.sessions.find((s) => s.id === id))
      .filter(Boolean)
  );
  const linkedStreaming = useChatSessionStore((state) => {
    if (!linkedSessionIds || linkedSessionIds.length === 0) return null;
    for (const id of linkedSessionIds) {
      const s = state.streamingBySession[id];
      if (s?.isStreaming) return s;
    }
    return null;
  });

  // Convert store messages to ChatMessage shape
  const storeDerivedMessages: ChatMessage[] = (storeSession?.messages ?? []).map((m) => {
    // If the message has reasoning/thinking content, build a parts array
    if (m.role === 'assistant' && m.thinking) {
      const parts: Array<{type: string; text?: string; reasoningId?: string}> = [
        { type: 'reasoning', text: m.thinking, reasoningId: `${m.id}-thinking` },
        { type: 'text', text: typeof m.content === 'string' ? m.content : '' },
      ];
      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: parts as any,
        createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
      };
    }
    return {
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : '',
      createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
    };
  });

  // Merge linked session messages
  const linkedMessages: ChatMessage[] = linkedSessions.flatMap((session) =>
    (session?.messages ?? []).map((m) => {
      const agentMeta = session?.metadata?.agentId
        ? { agentId: session.metadata.agentId, agentName: session.metadata.agentName }
        : undefined;
      if (m.role === 'assistant' && m.thinking) {
        const parts: Array<{type: string; text?: string; reasoningId?: string}> = [
          { type: 'reasoning', text: m.thinking, reasoningId: `${m.id}-thinking` },
          { type: 'text', text: typeof m.content === 'string' ? m.content : '' },
        ];
        return {
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: parts as any,
          createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
          metadata: agentMeta,
        };
      }
      return {
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
        createdAt: m.timestamp ? new Date(m.timestamp) : new Date(),
        metadata: agentMeta,
      };
    })
  );

  const allMessages = [...storeDerivedMessages, ...linkedMessages];
  // Deduplicate by ID (in case main session and linked sessions overlap)
  const dedupedMessages = allMessages.filter((m, idx, arr) =>
    arr.findIndex((other) => other.id === m.id) === idx
  );

  const messages = conversationId ? dedupedMessages : (messagesProp ?? []);
  const isLoading = conversationId
    ? ((storeStreaming?.isStreaming ?? false) || (linkedStreaming?.isStreaming ?? false))
    : (isLoadingProp ?? false);

  // Legacy cowork events are no longer stored in CoworkStore.
  // Events come from the active session in CoworkSessionStore or are empty.
  const events: AnyCoworkEvent[] = [];
  const timeline = mergeTimeline(messages, events);

  // Native streaming parts come from mode-session-store, not CoworkStore.
  const nativePartsByMessage: Record<string, Record<string, unknown>[]> = {};

  // Subscribe to transition controller for session-switch loading states
  const [transitionState, setTransitionState] = useState(coworkTransitionController.getState());
  useEffect(() => {
    const unsub = coworkTransitionController.subscribe(setTransitionState);
    return unsub;
  }, []);

  // Merge transition loading into isLoading
  const isTransitioning =
    (transitionState.transitionState === 'switching' || transitionState.transitionState === 'loading') &&
    transitionState.intendedSessionId === conversationId;
  const effectiveIsLoading = isLoading || isTransitioning;

  return (
    <div className="space-y-4 relative">
      {isTransitioning && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Switching session…
          </div>
        </div>
      )}
      {timeline.map((item, idx) => {
        const isLast = idx === timeline.length - 1;

        if (item.type === 'message') {
          const msg = item.data as ChatMessage;
          return (
            <StreamingChatComposer
              key={item.id}
              message={msg}
              isLoading={effectiveIsLoading && isLast}
              isLast={isLast}
              onRegenerate={onRegenerate}
            />
          );
        }

        // Legacy cowork event work block
        return (
          <div key={item.id} className="max-w-2xl mx-auto">
            <CoworkWorkBlock
              event={item.data}
              isStreaming={effectiveIsLoading && isLast}
            />
          </div>
        );
      })}

      {timeline.length === 0 && (
        <div className="text-center py-12 text-white/20">
          <p>Session started. Waiting for first observation...</p>
        </div>
      )}
    </div>
  );
});

export default CoworkTranscript;
