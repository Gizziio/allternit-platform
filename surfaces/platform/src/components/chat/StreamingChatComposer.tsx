/**
 * Streaming Chat Composer
 * 
 * Rich streaming chat experience using all AI Elements from Elements Lab.
 * Handles all message states: idle, streaming, thinking, tool-use, complete.
 */

import React, { memo, useState, useCallback, useMemo } from "react";
import { UnifiedMessageRenderer } from "@/components/ai-elements/UnifiedMessageRenderer";
import { parseStructuredContent } from "@/lib/ai/rust-stream-adapter-extended";
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import type { ChatMessage } from "@/lib/ai/rust-stream-adapter";
import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";
import { useMessageTree } from "@/providers/message-tree-provider";

import { ForkButton } from "./ForkButton";
import { BranchIndicator } from "./BranchIndicator";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";

// ============================================================================
// Types
// ============================================================================

interface StreamingChatComposerProps {
  message: ChatMessage;
  isLoading?: boolean;
  isLast?: boolean;
  onRegenerate?: () => void;
  onFeedback?: (type: 'up' | 'down') => void;
  onSelectArtifact?: (artifact: import('@/components/ai-elements/artifact-panel').SelectedArtifact) => void;
  selectedArtifactTitle?: string;
  // Resumable stream support
  conversationId?: string;
  onResumeStream?: (messageId: string, checkpoint: { content: string; timestamp: number }) => void;
}

// ============================================================================
// Message Actions
// ============================================================================

const MessageActions = memo(function MessageActions({
  onCopy,
  onRegenerate,
  onFeedback,
  copied,
}: {
  onCopy: () => void;
  onRegenerate?: () => void;
  onFeedback?: (type: 'up' | 'down') => void;
  copied: boolean;
}) {
  return (
    <div className="message-actions flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity" role="toolbar" aria-label="Message actions">
      <button
        onClick={onCopy}
        className="cursor-pointer transition-colors"
        style={{ color: 'var(--ui-text-muted)' }}
        aria-label={copied ? 'Copied!' : 'Copy message'}
        onMouseEnter={(event) => {
          event.currentTarget.style.color = 'var(--ui-text-primary)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.color = 'var(--ui-text-muted)';
        }}
      >
        {copied
          ? <Check size={15} className="text-green-400" aria-hidden="true" />
          : <Copy size={15} aria-hidden="true" />}
      </button>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="cursor-pointer transition-colors"
          style={{ color: 'var(--ui-text-muted)' }}
          aria-label="Regenerate response"
          onMouseEnter={(event) => {
            event.currentTarget.style.color = 'var(--ui-text-primary)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = 'var(--ui-text-muted)';
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      )}
      {onFeedback && (
        <>
          <button
            onClick={() => onFeedback('up')}
            className="cursor-pointer transition-colors"
            style={{ color: 'var(--ui-text-muted)' }}
            aria-label="Helpful"
            onMouseEnter={(event) => {
              event.currentTarget.style.color = 'var(--ui-text-primary)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = 'var(--ui-text-muted)';
            }}
          >
            <ThumbsUp size={15} aria-hidden="true" />
          </button>
          <button
            onClick={() => onFeedback('down')}
            className="cursor-pointer transition-colors"
            style={{ color: 'var(--ui-text-muted)' }}
            aria-label="Not helpful"
            onMouseEnter={(event) => {
              event.currentTarget.style.color = 'var(--ui-text-primary)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = 'var(--ui-text-muted)';
            }}
          >
            <ThumbsDown size={15} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
});

// ============================================================================
// Constants & Utils
// ============================================================================

const SHOW_DEBUG = 
  process.env.NODE_ENV !== "production" && 
  process.env.NEXT_PUBLIC_CHAT_DEBUG_OVERLAY === "1";



// ============================================================================
// User Message Card
// ============================================================================

const UserMessageCard = memo(function UserMessageCard({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongText = text.length > 400;
  const displayText = isExpanded ? text : text.slice(0, 400);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-end',
      padding: '8px 0',
      width: '100%',
    }}>
      <div style={{
        maxWidth: '85%',
        padding: '16px 20px',
        borderRadius: '16px',
        background: 'var(--chat-composer-soft)',
        border: '1px solid var(--ui-border-default)',
        color: 'var(--ui-text-primary)',
        fontSize: '16px',
        lineHeight: '1.75',
        wordBreak: 'break-word',
        position: 'relative'
      }}>
        <div style={{ whiteSpace: 'pre-wrap' }}>
          {displayText}
          {!isExpanded && isLongText && '...'}
        </div>
        
        {isLongText && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              marginTop: '12px',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--accent-primary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// Streaming Chat Composer
// ============================================================================

export const StreamingChatComposer = memo(function StreamingChatComposer({
  message,
  isLoading,
  isLast,
  onRegenerate,
  onFeedback,
  onSelectArtifact,
  selectedArtifactTitle,
  conversationId,
  onResumeStream,
}: StreamingChatComposerProps) {
  const [copied, setCopied] = useState(false);
  const { getMessageSiblingInfo, navigateToSibling, forkMessage } = useMessageTree();
  
  const isAssistant = message.role === 'assistant';
  
  // Get sibling info for branching
  const siblingInfo = useMemo(() => {
    if (!isAssistant) return null;
    return getMessageSiblingInfo(message.id);
  }, [isAssistant, message.id, getMessageSiblingInfo]);
  
  const hasSiblings = siblingInfo && siblingInfo.siblings.length > 1;
  const siblingIndex = siblingInfo?.siblingIndex ?? 0;
  const totalSiblings = siblingInfo?.siblings.length ?? 1;
  // Extract parts from message content
  const messageParts = useMemo(() => {
    // If we have an array of parts, use them directly (Ground Truth)
    if (Array.isArray(message.content)) {
      return message.content as ExtendedUIPart[];
    }
    
    // Fallback: If it's a string, use the smart parser (Legacy / Completion only)
    if (typeof message.content === "string") {
      return parseStructuredContent(message.content);
    }
    
    return [] as ExtendedUIPart[];
  }, [message.content]);

  // Extract plain text for copying
  const fullText = useMemo(() => {
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .map((part: any) => {
          if (part.type === "text") return part.text;
          if (part.type === "reasoning") return `[Thinking: ${part.text}]`;
          if (part.type === "code") return part.code;
          return "";
        })
        .join("\n\n");
    }
    return "";
  }, [message.content]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [fullText]);


  // User message
  if (!isAssistant) {
    return <UserMessageCard text={fullText} />;
  }

  // Assistant message with rich streaming elements
  return (
    <div className="assistant-message-group group" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      padding: '20px 0',
      width: '100%',
    }}>

      {/* Message content */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Main content using UnifiedMessageRenderer for rich AI Elements */}
        <div style={{
          fontSize: '16px',
          lineHeight: '1.75',
          color: 'var(--ui-text-primary)',
          fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
          position: 'relative'
        }}>
          {messageParts.length > 0 ? (
            <UnifiedMessageRenderer
              parts={messageParts}
              isStreaming={isLoading && isLast}
              onSelectArtifact={onSelectArtifact}
              selectedArtifactTitle={selectedArtifactTitle}
            />
          ) : isLoading ? (
            /* Initial thinking state — MatrixLogo spinner + label, matching Claude.ai */
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 20, height: 20, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ transform: 'scale(0.417)', transformOrigin: 'center', width: 48, height: 48 }}>
                  <MatrixLogo state="thinking" size={48} />
                </div>
              </div>
              <span style={{ fontSize: '14px', color: 'var(--ui-text-secondary)' }}>Thinking...</span>
            </div>
          ) : null}

          {/* Developer Debug Overlay (Hard-gated) */}
          {SHOW_DEBUG && (
            <div className="absolute top-0 right-0 -mt-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[10px] font-mono px-2 py-1 rounded" style={{ color: 'var(--ui-text-muted)', background: 'var(--surface-overlay)' }}>
              <span className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-green-500 motion-safe:animate-pulse' : 'bg-gray-500'}`} />
                {isLoading ? 'streaming' : 'idle'}
              </span>
              <span>|</span>
              <span>{Array.isArray(message.content) ? 'parts[]' : 'string'}</span>
              <span>|</span>
              <span>parts: {messageParts.length}</span>
              <span>|</span>
              <span>renderer: Unified</span>
            </div>
          )}
        </div>



        {/* Branching UI — only shown when siblings exist (no persistent border) */}
        {hasSiblings && !isLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: '12px',
          }}>
            <BranchIndicator
              currentIndex={siblingIndex}
              siblingCount={totalSiblings}
              onNavigate={(direction) => navigateToSibling(message.id, direction)}
            />
            {isLast && (
              <ForkButton
                onFork={() => { void forkMessage(message.id); }}
                disabled={isLoading}
              />
            )}
          </div>
        )}



        {/* Action buttons */}
        {!isLoading && fullText && (
          <MessageActions
            onCopy={handleCopy}
            onRegenerate={onRegenerate}
            onFeedback={onFeedback}
            copied={copied}
          />
        )}
      </div>
    </div>
  );
});

export default StreamingChatComposer;
