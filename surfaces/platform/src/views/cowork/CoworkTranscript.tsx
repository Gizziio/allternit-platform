/**
 * CoworkTranscript - Interleaves chat messages with inline work blocks
 * Renders the unified stream: message → work block → message → work block
 */

import React, { memo } from 'react';
import { StreamingChatComposer } from '@/components/chat/StreamingChatComposer';
import { CoworkWorkBlock } from './CoworkWorkBlock';
import { MessagePartList } from './CoworkStreamBlock';
import { useCoworkStore } from './CoworkStore';
import { useNativeAgentStore } from '@/lib/agents';
import type { ChatMessage } from '@/lib/ai/rust-stream-adapter';
import type { AnyCoworkEvent } from './cowork.types';

interface CoworkTranscriptProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onRegenerate: () => void;
  /** When provided, limits parts lookup to this gizzi-code session */
  sessionId?: string;
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
  const workEvents = events.filter(e => INLINE_WORK_TYPES.includes(e.type));
  
  const items: Array<{ type: 'message' | 'work'; data: any; id: string; timestamp: number }> = [
    ...messages.map(m => ({
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
  messages,
  isLoading,
  onRegenerate,
  sessionId,
}: CoworkTranscriptProps) {
  const { session } = useCoworkStore();
  const nativeParts = useNativeAgentStore((s) => s.parts);

  const events = session?.events || [];
  const timeline = mergeTimeline(messages, events);

  // Scope to the provided sessionId; fall back to searching all sessions for
  // backwards compat when no sessionId is given (legacy cowork mode).
  const nativePartsByMessage: Record<string, Record<string, unknown>[]> =
    sessionId
      ? (nativeParts[sessionId] ?? {})
      : Object.values(nativeParts).reduce<Record<string, Record<string, unknown>[]>>(
          (acc, msgMap) => Object.assign(acc, msgMap),
          {},
        );

  return (
    <div className="space-y-4">
      {timeline.map((item, idx) => {
        const isLast = idx === timeline.length - 1;

        if (item.type === 'message') {
          const msg = item.data as ChatMessage;
          const msgParts = nativePartsByMessage[msg.id];

          // If we have native streaming parts for this message, render them
          // instead of the plain text fallback
          if (msgParts?.length && msg.role === 'assistant') {
            return (
              <div key={item.id} className="max-w-2xl mx-auto">
                <MessagePartList parts={msgParts} />
              </div>
            );
          }

          return (
            <StreamingChatComposer
              key={item.id}
              message={msg}
              isLoading={isLoading && isLast}
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
              isStreaming={isLoading && isLast}
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
