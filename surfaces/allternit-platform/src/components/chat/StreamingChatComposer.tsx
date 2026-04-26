/**
 * Streaming Chat Composer
 * 
 * Rich streaming chat experience using all AI Elements from Elements Lab.
 * Handles all message states: idle, streaming, thinking, tool-use, complete.
 */

import React, { memo, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { UnifiedMessageRenderer } from "@/components/ai-elements/UnifiedMessageRenderer";
import { parseStructuredContent } from "@/lib/ai/rust-stream-adapter-extended";
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import type { ChatMessage } from "@/lib/ai/rust-stream-adapter";
import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";
import { useMessageTree } from "@/providers/message-tree-provider";
import { useViewMode } from "@/hooks/useViewMode";
import { conversationsApi } from "@/api/conversations";

import { ForkButton } from "./ForkButton";
import { BranchIndicator } from "./BranchIndicator";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { TextShimmer } from "@/components/agent-elements/text-shimmer";
import { SpiralLoader } from "@/components/agent-elements/spiral-loader";
import { AgentAvatar } from "@/components/Avatar";
import { useAgentStore } from "@/lib/agents";
import { useAgentStreamingStatus } from "@/hooks/useAgentStreamingStatus";

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

const ICON_BTN: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '4px',
  margin: 0,
  outline: 'none',
  cursor: 'pointer',
  color: 'var(--ui-text-muted)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  transition: 'color 0.15s, opacity 0.15s',
  lineHeight: 0,
};

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
  const hover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.color = 'var(--ui-text-primary)';
  };
  const leave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.color = 'var(--ui-text-muted)';
  };

  return (
    <div
      className="message-actions"
      style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: '8px', opacity: 0, transition: 'opacity 0.15s' }}
      role="toolbar"
      aria-label="Message actions"
      // show on parent group hover via CSS class — opacity toggled by group-hover in parent
    >
      <button onClick={onCopy} style={ICON_BTN} aria-label={copied ? 'Copied!' : 'Copy'}
        onMouseEnter={hover} onMouseLeave={leave}>
        {copied
          ? <Check size={14} style={{ color: 'var(--accent-chat)' }} aria-hidden="true" />
          : <Copy size={14} aria-hidden="true" />}
      </button>
      {onRegenerate && (
        <button onClick={onRegenerate} style={ICON_BTN} aria-label="Retry"
          onMouseEnter={hover} onMouseLeave={leave}>
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      )}
      {onFeedback && (
        <>
          <button onClick={() => onFeedback('up')} style={ICON_BTN} aria-label="Good response"
            onMouseEnter={hover} onMouseLeave={leave}>
            <ThumbsUp size={14} aria-hidden="true" />
          </button>
          <button onClick={() => onFeedback('down')} style={ICON_BTN} aria-label="Bad response"
            onMouseEnter={hover} onMouseLeave={leave}>
            <ThumbsDown size={14} aria-hidden="true" />
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

function ThinkingIndicator({ agentName }: { agentName?: string }) {
  return (
    <div
      className="allternit-thinking-indicator"
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}
      aria-label="Thinking"
    >
      <SpiralLoader size={16} />
      <TextShimmer as="span" className="text-sm text-[var(--ui-text-secondary)]">
        {agentName ? `${agentName} is working…` : 'A:// thinking'}
      </TextShimmer>
    </div>
  );
}



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

function useTypewriterContent(rawContent: string, isStreaming: boolean): string {
  // Capture at mount time: was this message being streamed when it first appeared?
  // Historical (already-complete) messages should show full content immediately.
  const mountedWhileStreamingRef = useRef(isStreaming);

  const [displayed, setDisplayed] = useState<string>(() =>
    mountedWhileStreamingRef.current ? '' : rawContent
  );

  const queueRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedRef = useRef(mountedWhileStreamingRef.current ? '' : rawContent);
  // Track how many rawContent chars we've already enqueued
  const prevSeenLenRef = useRef(0);

  useEffect(() => {
    if (!mountedWhileStreamingRef.current) {
      // Historical message — show in full, no typewriter
      if (displayedRef.current !== rawContent) {
        displayedRef.current = rawContent;
        setDisplayed(rawContent);
      }
      return;
    }

    // Enqueue any new characters since last effect run
    const newChars = rawContent.slice(prevSeenLenRef.current);
    if (newChars) {
      queueRef.current += newChars;
      prevSeenLenRef.current = rawContent.length;
    }

    // Stream ended and queue is empty → ensure we're showing everything
    if (!isStreaming && !queueRef.current.length) {
      if (displayedRef.current !== rawContent) {
        displayedRef.current = rawContent;
        setDisplayed(rawContent);
      }
      return;
    }

    if (timerRef.current || !queueRef.current.length) return;

    // 2 chars per 16ms ≈ 125 chars/sec — matches real Claude token speed
    const drain = () => {
      if (!queueRef.current.length) {
        timerRef.current = null;
        // Drain finished — snap to full content to clear any rounding gap
        if (displayedRef.current !== rawContent) {
          displayedRef.current = rawContent;
          setDisplayed(rawContent);
        }
        return;
      }
      const batch = queueRef.current.slice(0, 2);
      queueRef.current = queueRef.current.slice(2);
      displayedRef.current += batch;
      setDisplayed(displayedRef.current);
      timerRef.current = setTimeout(drain, 16);
    };
    timerRef.current = setTimeout(drain, 0);
  }, [rawContent, isStreaming]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return displayed;
}

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
  const { viewMode } = useViewMode();

  const isAssistant = message.role === 'assistant';

  // Get sibling info for branching
  const siblingInfo = useMemo(() => {
    if (!isAssistant) return null;
    return getMessageSiblingInfo(message.id);
  }, [isAssistant, message.id, getMessageSiblingInfo]);

  const hasSiblings = siblingInfo && siblingInfo.siblings.length > 1;
  const siblingIndex = siblingInfo?.siblingIndex ?? 0;
  const totalSiblings = siblingInfo?.siblings.length ?? 1;

  // During streaming, split reasoning (complete) from live text content
  const isActivelyStreaming = !!(isLoading && isLast && isAssistant);

  // Raw text portion only — for typewriter input
  const rawTextString = useMemo(() => {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      const textPart = [...(message.content as ExtendedUIPart[])].reverse().find((p: any) => p.type === 'text');
      return (textPart as any)?.text ?? '';
    }
    return '';
  }, [message.content]);

  // Typewriter-revealed text — drains at ~250 chars/sec during streaming
  const displayedText = useTypewriterContent(rawTextString, isActivelyStreaming);

  // Extract parts from message content
  const messageParts = useMemo(() => {
    if (!isActivelyStreaming && Array.isArray(message.content)) {
      // Completed message with parts array — use directly
      return message.content as ExtendedUIPart[];
    }

    if (Array.isArray(message.content)) {
      // Streaming with parts (reasoning + live text) — use typewriter text for last text part
      const parts = (message.content as ExtendedUIPart[]).filter((p: any) => p.type !== 'text');
      if (displayedText) {
        parts.push({ type: 'text', text: displayedText } as ExtendedUIPart);
      }
      return parts.length > 0 ? parts : (displayedText ? parseStructuredContent(displayedText) : []);
    }

    // Plain string content — use typewriter-revealed string
    if (displayedText) {
      return parseStructuredContent(displayedText);
    }

    return [] as ExtendedUIPart[];
  }, [message.content, displayedText, isActivelyStreaming]);

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
  const agentId = message.metadata?.agentId;
  const agentName = message.metadata?.agentName;
  const agents = useAgentStore((state) => state.agents);
  const agent = useMemo(() =>
    agentId ? agents.find((a) => a.id === agentId) || null : null,
  [agentId, agents]);
  const avatarConfig = agent?.config?.avatar as Record<string, unknown> | undefined;

  const handleAgentHeaderClick = useCallback(() => {
    if (!agent) return;
    // Feature 6: Quick re-mention — dispatch event to fill composer
    window.dispatchEvent(new CustomEvent('allternit:mention-agent', {
      detail: { agentId: agent.id, agentName: agent.name },
    }));
  }, [agent]);

  // Feature 1: Granular agent execution status while streaming
  const agentStatus = useAgentStreamingStatus(
    !!(isLoading && isLast && isAssistant),
    agentName,
    1800
  );

  return (
    <div
      className="assistant-message-group"
      style={{ display: 'flex', flexDirection: 'column', gap: '0', padding: '20px 0', width: '100%' }}
      onMouseEnter={(e) => {
        const actions = e.currentTarget.querySelector<HTMLElement>('.message-actions');
        if (actions) actions.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        const actions = e.currentTarget.querySelector<HTMLElement>('.message-actions');
        if (actions) actions.style.opacity = '0';
      }}
    >
      {/* Phase 2+3: Agent identity header for mixed LLM/agent threads */}
      {agentId && agentName && (
        <button
          type="button"
          onClick={handleAgentHeaderClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
          title={`Click to @mention ${agentName}`}
        >
          {avatarConfig ? (
            <AgentAvatar
              config={avatarConfig as any}
              size={20}
              emotion={isLoading && isLast ? 'focused' : 'steady'}
              isAnimating={false}
              showGlow={false}
            />
          ) : (
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: 'var(--accent-chat, #D4B08C)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}>
              {agentName.charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ui-text-primary, #ECECEC)',
          }}>
            {agentName}
          </span>
        </button>
      )}

      {/* Message content */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Feature 1: Granular agent execution status */}
        {agentStatus && (
          <div
            className="flex items-center gap-2 py-1.5 pb-2.5 mb-1"
            aria-label="Agent status"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-chat,#D4B08C)] animate-pulse" />
            <TextShimmer
              as="span"
              className="text-[13px] font-medium text-[var(--ui-text-secondary)]"
            >
              {agentStatus}
            </TextShimmer>
          </div>
        )}

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
              viewMode={viewMode}
            />
          ) : isLoading ? (
            <ThinkingIndicator agentName={agentName} />
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
                onFork={async () => {
                  // Persist branch to backend if we have a conversationId
                  if (conversationId) {
                    await conversationsApi.fork(conversationId, {
                      fromMessageId: message.id,
                    });
                  }
                  // Also update local client-side tree state
                  forkMessage(message.id);
                }}
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
