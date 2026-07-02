import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UnifiedMessageRenderer } from "@/components/ai-elements/UnifiedMessageRenderer";
import { parseStructuredContent } from "@/lib/ai/rust-stream-adapter-extended";
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import type { ChatMessage } from "@/lib/ai/rust-stream-adapter";
import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";
import { useMessageTree } from "@/providers/message-tree-provider";
import { useViewMode, ViewMode } from "@/hooks/useViewMode";
import { conversationsApi } from "@/api/conversations";

import { ForkButton } from "./ForkButton";
import { BranchIndicator } from "./BranchIndicator";
import { TextShimmer } from "@/components/agent-elements/text-shimmer";
import { AgentAvatar } from "@/components/Avatar";
import { useAgentStore } from "@/lib/agents";
import { useAgentStreamingStatus } from "@/hooks/useAgentStreamingStatus";
import { cn } from "@/lib/utils";
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
  /** Override the global view-mode setting. Use 'verbose' in Cowork to show full tool I/O + ThoughtTrace. */
  viewMode?: import('@/hooks/useViewMode').ViewMode;
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
    <div
      className="message-actions mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100"
      role="toolbar"
      aria-label="Message actions"
    >
      <ActionButton onClick={onCopy} aria-label={copied ? 'Copied!' : 'Copy'}>
        {copied
          ? <Check size={14} className="text-[var(--accent-chat)]" />
          : <Copy size={14} />}
      </ActionButton>
      {onRegenerate && (
        <ActionButton onClick={onRegenerate} aria-label="Retry">
          <RotateCcw size={14} />
        </ActionButton>
      )}
      {onFeedback && (
        <>
          <ActionButton onClick={() => onFeedback('up')} aria-label="Good response">
            <ThumbsUp size={14} />
          </ActionButton>
          <ActionButton onClick={() => onFeedback('down')} aria-label="Bad response">
            <ThumbsDown size={14} />
          </ActionButton>
        </>
      )}
    </div>
  );
});

function ActionButton({ children, onClick, "aria-label": ariaLabel }: { children: React.ReactNode; onClick: () => void; "aria-label": string }) {
  return (
    <button type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="p-1 rounded bg-transparent border-none text-[var(--ui-text-muted)] cursor-pointer flex items-center justify-center transition-colors hover:text-[var(--ui-text-primary)] hover:bg-[var(--bg-hover)]"
    >
      {children}
    </button>
  );
}

// ============================================================================
// Constants & Utils
// ============================================================================

const SHOW_DEBUG =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_CHAT_DEBUG_OVERLAY === "1";

function ThinkingIndicator({ agentName }: { agentName?: string }) {
  return (
    <div
      className="allternit-thinking-indicator flex items-center gap-2 py-1.5"
      aria-label="Thinking"
    >
      <span className="inline-block size-3.5 rounded-full border-2 border-solid border-[var(--ui-border-muted)] border-t-[var(--accent-primary)] animate-spin shrink-0" />
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
    <div className="flex justify-end py-2 w-full">
      <div className="max-w-[85%] p-4 px-5 rounded-2xl bg-[var(--chat-composer-soft)] border border-solid border-[var(--ui-border-default)] text-[var(--ui-text-primary)] text-base leading-[1.75] break-words relative">
        <div className="whitespace-pre-wrap">
          {displayText}
          {!isExpanded && isLongText && '…'}
        </div>
        
        {isLongText && (
          <button type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 p-1 px-2 text-[12px] font-semibold text-[var(--accent-primary)] bg-transparent border-none cursor-pointer flex items-center gap-1 hover:bg-white/5 rounded-md transition-colors"
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
  const mountedWhileStreamingRef = useRef(isStreaming);
  const [displayed, setDisplayed] = useState<string>(() =>
    mountedWhileStreamingRef.current ? '' : rawContent
  );
  const queueRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedRef = useRef(mountedWhileStreamingRef.current ? '' : rawContent);
  const prevSeenLenRef = useRef(0);

  useEffect(() => {
    if (!mountedWhileStreamingRef.current) {
      if (displayedRef.current !== rawContent) {
        displayedRef.current = rawContent;
        setDisplayed(rawContent);
      }
      return;
    }

    const newChars = rawContent.slice(prevSeenLenRef.current);
    if (newChars) {
      queueRef.current += newChars;
      prevSeenLenRef.current = rawContent.length;
    }

    if (!isStreaming && !queueRef.current.length) {
      if (displayedRef.current !== rawContent) {
        displayedRef.current = rawContent;
        setDisplayed(rawContent);
      }
      return;
    }

    if (timerRef.current || !queueRef.current.length) return;

    const drain = () => {
      if (!queueRef.current.length) {
        timerRef.current = null;
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

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [rawContent, isStreaming]);

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
  viewMode: viewModeProp,
}: StreamingChatComposerProps) {
  const [copied, setCopied] = useState(false);
  const { getMessageSiblingInfo, navigateToSibling, forkMessage } = useMessageTree();
  const { viewMode: viewModeHook } = useViewMode();
  const viewMode = viewModeProp ?? viewModeHook;

  const isAssistant = message.role === 'assistant';

  const siblingInfo = useMemo(() => {
    if (!isAssistant) return null;
    return getMessageSiblingInfo(message.id);
  }, [isAssistant, message.id, getMessageSiblingInfo]);

  const hasSiblings = siblingInfo && siblingInfo.siblings.length > 1;
  const siblingIndex = siblingInfo?.siblingIndex ?? 0;
  const totalSiblings = siblingInfo?.siblings.length ?? 1;

  const isActivelyStreaming = !!(isLoading && isLast && isAssistant);

  const rawTextString = useMemo(() => {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      const textPart = [...(message.content as ExtendedUIPart[])].reverse().find((p: any) => p.type === 'text');
      return (textPart as any)?.text ?? '';
    }
    return '';
  }, [message.content]);

  const displayedText = useTypewriterContent(rawTextString, isActivelyStreaming);

  const messageParts = useMemo(() => {
    if (!isActivelyStreaming && Array.isArray(message.content)) {
      return message.content as ExtendedUIPart[];
    }

    if (Array.isArray(message.content)) {
      const parts = (message.content as ExtendedUIPart[]).filter((p: any) => p.type !== 'text');
      if (displayedText) {
        parts.push({ type: 'text', text: displayedText } as ExtendedUIPart);
      }
      return parts.length > 0 ? parts : (displayedText ? parseStructuredContent(displayedText) : []);
    }

    if (displayedText) {
      return parseStructuredContent(displayedText);
    }

    return [] as ExtendedUIPart[];
  }, [message.content, displayedText, isActivelyStreaming]);

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

  const agentId = message.metadata?.agentId;
  const agentName = message.metadata?.agentName;
  const agents = useAgentStore((state) => state.agents);
  const agent = useMemo(() =>
    agentId ? agents.find((a) => a.id === agentId) || null : null,
  [agentId, agents]);
  const avatarConfig = agent?.config?.avatar as Record<string, unknown> | undefined;

  const handleAgentHeaderClick = useCallback(() => {
    if (!agent) return;
    window.dispatchEvent(new CustomEvent('allternit:mention-agent', {
      detail: { agentId: agent.id, agentName: agent.name },
    }));
  }, [agent]);

  const agentStatus = useAgentStreamingStatus(
    !!(isLoading && isLast && isAssistant),
    1500
  );

  if (!isAssistant) {
    return <UserMessageCard text={fullText} />;
  }

  return (
    <div className="assistant-message-group group/message flex flex-col gap-0 py-5 w-full">
      {/* Phase 2+3: Agent identity header for mixed LLM/agent threads */}
      {agentId && agentName && (
        <button
          type="button"
          onClick={handleAgentHeaderClick}
          className="inline-flex items-center gap-2 mb-3 bg-transparent border-none cursor-pointer p-0 text-left transition-opacity hover:opacity-80"
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
            <div className="size-5 rounded-md bg-[var(--accent-chat,#D4B08C)] flex items-center justify-center text-[12px] font-bold text-white shrink-0">
              {agentName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[13px] font-semibold text-[var(--ui-text-primary,#ECECEC)]">
            {agentName}
          </span>
        </button>
      )}

      {/* Message content */}
      <div className="flex-1 min-w-0">

        {/* Feature 1: Granular agent execution status */}
        {agentStatus && (
          <div
            className="flex items-center gap-2 py-1.5 pb-2.5 mb-1"
            aria-label="Agent status"
          >
            <div className="size-1.5 rounded-full bg-[var(--accent-chat,#D4B08C)] animate-pulse" />
            <TextShimmer
              as="span"
              className="text-[13px] font-medium text-[var(--ui-text-secondary)]"
            >
              {agentStatus}
            </TextShimmer>
          </div>
        )}

        {/* Main content using UnifiedMessageRenderer for rich AI Elements */}
        <div className="text-base leading-[1.75] text-[var(--ui-text-primary)] font-sans relative">
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
            <div className="absolute top-0 right-0 -mt-6 opacity-0 group-hover/message:opacity-100 transition-opacity flex items-center gap-2 text-xs font-mono px-2 py-1 rounded text-[var(--ui-text-muted)] bg-[var(--surface-overlay)]">
              <span className="flex items-center gap-1">
                <div className={cn("size-1.5 rounded-full", isLoading ? "bg-green-500 animate-pulse" : "bg-zinc-500")} />
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
          <div className="flex items-center gap-3 mt-3">
            <BranchIndicator
              currentIndex={siblingIndex}
              siblingCount={totalSiblings}
              onNavigate={(direction) => navigateToSibling(message.id, direction)}
            />
            {isLast && (
              <ForkButton
                onFork={async () => {
                  if (conversationId) {
                    await conversationsApi.fork(conversationId, {
                      fromMessageId: message.id,
                    });
                  }
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
