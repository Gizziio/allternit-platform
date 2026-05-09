'use client';

import React, { useRef, useEffect } from 'react';
import { User, Bot, Loader2 } from 'lucide-react';
import type { ChatMessage } from '../hooks/useNotebookApi';
import { CitationMarker } from './CitationMarker';
import { UnifiedMessageRenderer } from '@/components/ai-elements/UnifiedMessageRenderer';
import { parseStructuredContent } from '@/lib/ai/rust-stream-adapter-extended';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onCitationClick?: (sourceId: string) => void;
}

/**
 * Renders assistant content with two layers:
 * 1. parseStructuredContent splits the raw string into typed parts (code blocks, tool calls, etc.)
 * 2. For plain text parts, [N] citation markers are replaced with CitationMarker components
 * 3. All other parts are rendered by UnifiedMessageRenderer as a single-part list
 */
function AssistantContent({
  content,
  citations,
  onCitationClick,
}: {
  content: string;
  citations?: ChatMessage['citations'];
  onCitationClick?: (sourceId: string) => void;
}) {
  const parts = parseStructuredContent(content);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <span key={i}>
              {renderTextWithCitations(part.text, citations, onCitationClick)}
            </span>
          );
        }
        return (
          <UnifiedMessageRenderer key={i} parts={[part]} />
        );
      })}
    </>
  );
}

function renderTextWithCitations(
  text: string,
  citations: ChatMessage['citations'],
  onCitationClick?: (sourceId: string) => void
): React.ReactNode {
  if (!citations || citations.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const citationIndex = parseInt(match[1], 10);
    const citation = citations.find((c) => c.index === citationIndex);
    if (!citation) continue;

    nodes.push(text.slice(lastIndex, match.index));
    nodes.push(
      <CitationMarker
        key={`cite-${match.index}`}
        citation={citation}
        onClick={onCitationClick}
      />
    );
    lastIndex = match.index + match[0].length;
  }

  nodes.push(text.slice(lastIndex));
  return nodes;
}

export function ChatWorkspace({ messages, isLoading, onCitationClick }: ChatWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div ref={scrollRef} className="research-chat-area">
      {messages.length === 0 && (
        <div className="research-empty-state">
          <div className="w-12 h-12 rounded-xl bg-purple-400/10 flex items-center justify-center">
            <Bot size={24} className="text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary,#e5e5e5)] mb-1">
              Start researching
            </p>
            <p className="text-xs max-w-xs">
              Add sources to your notebook, then ask questions. I&apos;ll ground every answer in
              your documents.
            </p>
          </div>
        </div>
      )}

      {messages.map((msg, idx) => (
        <div key={idx} className="flex gap-2.5 items-start">
          {/* Avatar */}
          <div className={msg.role === 'user' ? 'research-message-user' : 'research-message-assistant'}>
            {msg.role === 'user' ? (
              <User size={14} color="#fff" />
            ) : (
              <Bot size={14} color="#a78bfa" />
            )}
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            <div className="text-sm leading-relaxed text-[var(--text-primary,#e5e5e5)]">
              {msg.role === 'assistant' ? (
                <AssistantContent
                  content={msg.content}
                  citations={msg.citations}
                  onCitationClick={onCitationClick}
                />
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>

            {/* Citation footer */}
            {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-[var(--border-subtle,#27272a)]">
                {msg.citations.map((cite) => (
                  <span
                    key={cite.index}
                    onClick={() => onCitationClick?.(cite.source_id)}
                    className="text-[10px] text-purple-400 bg-purple-400/8 px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    [{cite.index}] {cite.excerpt.slice(0, 30)}...
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex items-center gap-2.5 pl-[38px]">
          <Loader2 size={16} className="animate-spin text-purple-400" />
          <span className="text-[13px] text-[var(--text-muted,#a1a1aa)]">
            Researching your sources...
          </span>
        </div>
      )}
    </div>
  );
}
