/**
 * CoworkTranscript - Interleaves chat messages with inline work blocks
 * Renders the unified stream: message → work block → message → work block
 */

import React, { memo } from 'react';
import { StreamingChatComposer } from '@/components/chat/StreamingChatComposer';
import { CoworkWorkBlock } from './CoworkWorkBlock';
import { useCoworkStore } from './CoworkStore';
import type { ChatMessage } from '@/lib/ai/rust-stream-adapter';
import type { AnyCoworkEvent } from './cowork.types';

interface CoworkTranscriptProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onRegenerate: () => void;
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
}: CoworkTranscriptProps) {
  const { session } = useCoworkStore();
  
  const events = session?.events || [];
  const timeline = mergeTimeline(messages, events);
  
  return (
    <div className="space-y-4">
      {timeline.map((item, idx) => {
        const isLast = idx === timeline.length - 1;
        
        if (item.type === 'message') {
          return (
            <StreamingChatComposer
              key={item.id}
              message={item.data}
              isLoading={isLoading && isLast}
              isLast={isLast}
              onRegenerate={onRegenerate}
            />
          );
        }
        
        // Work block
        return (
          <div key={item.id} className="max-w-2xl mx-auto">
            <CoworkWorkBlock 
              event={item.data} 
              isStreaming={isLoading && isLast}
            />
          </div>
        );
      })}
      
      {/* Empty state for new session */}
      {timeline.length === 0 && (
        <div className="text-center py-12 text-white/20">
          <p>Session started. Waiting for first observation...</p>
        </div>
      )}
    </div>
  );
});

export default CoworkTranscript;
