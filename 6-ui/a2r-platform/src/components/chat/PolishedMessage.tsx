"use client";

import React, { memo, useState, useCallback, useEffect, useRef } from "react";
import {
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Check,
  ChevronRight,
  RotateCcw
} from "lucide-react";
import { Markdown } from "@/components/ai-elements/markdown";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import type { ChatMessage } from "@/lib/ai/rust-stream-adapter";

// ============================================================================
// Types
// ============================================================================

interface PolishedMessageProps {
  message: ChatMessage;
  isLoading?: boolean;
  isLast?: boolean;
  onCopy?: (content: string) => void;
  onRegenerate?: () => void;
  onFeedback?: (type: 'up' | 'down') => void;
}


// ============================================================================
// Collapsible Thinking Summary
// ============================================================================

interface ThinkingSummaryProps {
  reasoning: string;
  isStreaming?: boolean;
}

const ThinkingSummary = memo(function ThinkingSummary({ reasoning, isStreaming }: ThinkingSummaryProps) {
  const [expanded, setExpanded] = useState(false);

  // Generate a short summary from reasoning text
  const summary = React.useMemo(() => {
    if (!reasoning) return "Thinking...";
    // Take first sentence or first 80 chars
    const firstSentence = reasoning.split(/[.!?\n]/)[0]?.trim();
    if (firstSentence && firstSentence.length <= 80) return firstSentence;
    return reasoning.slice(0, 80).trim() + "...";
  }, [reasoning]);

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          color: '#9B9B9B',
          fontSize: '14px',
          fontFamily: 'inherit',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#C0C0C0'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#9B9B9B'}
      >
        <span style={{ fontStyle: 'italic' }}>
          {isStreaming ? "Thinking..." : summary}
        </span>
        <ChevronRight
          size={14}
          style={{
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s ease',
            opacity: 0.6
          }}
        />
      </button>

      {expanded && (
        <div style={{
          marginTop: '8px',
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#9B9B9B',
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          {reasoning}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Interrupted Response Banner
// ============================================================================

const InterruptedBanner = memo(function InterruptedBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      marginTop: '12px',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          color: '#9B9B9B',
        }}>
          !
        </div>
        <span style={{ fontSize: '14px', color: '#9B9B9B' }}>
          A2R's response was interrupted
        </span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 16px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#ECECEC',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        >
          Retry
        </button>
      )}
    </div>
  );
});

// ============================================================================
// Message Actions (flat icon bar below AI messages)
// ============================================================================

interface MessageActionsProps {
  onCopy: () => void;
  onRegenerate?: () => void;
  onFeedback?: (type: 'up' | 'down') => void;
  copied: boolean;
}

const MessageActions = memo(function MessageActions({
  onCopy,
  onRegenerate,
  onFeedback,
  copied
}: MessageActionsProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      marginTop: '8px',
      opacity: 0,
      transition: 'opacity 0.15s ease',
    }}
    className="message-actions"
    >
      <ActionButton onClick={onCopy} tooltip={copied ? "Copied!" : "Copy"}>
        {copied ? <Check size={16} strokeWidth={2} /> : <Copy size={16} strokeWidth={1.5} />}
      </ActionButton>

      <ActionButton onClick={() => onFeedback?.('up')} tooltip="Good response">
        <ThumbsUp size={16} strokeWidth={1.5} />
      </ActionButton>

      <ActionButton onClick={() => onFeedback?.('down')} tooltip="Bad response">
        <ThumbsDown size={16} strokeWidth={1.5} />
      </ActionButton>

      {onRegenerate && (
        <ActionButton onClick={onRegenerate} tooltip="Retry">
          <RotateCcw size={16} strokeWidth={1.5} />
        </ActionButton>
      )}
    </div>
  );
});

// ============================================================================
// Action Button
// ============================================================================

const ActionButton = memo(function ActionButton({
  children,
  onClick,
  tooltip,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
          setShowTooltip(true);
          e.currentTarget.style.color = '#B0B0B0';
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
          setShowTooltip(false);
          e.currentTarget.style.color = '#7A7A7A';
          e.currentTarget.style.background = 'transparent';
        }}
        style={{
          padding: '6px',
          borderRadius: '6px',
          background: 'transparent',
          border: 'none',
          color: '#7A7A7A',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {children}
      </button>

      {showTooltip && tooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 4px)',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '4px 8px',
          fontSize: '11px',
          fontWeight: 500,
          color: '#ECECEC',
          background: '#3A3A3A',
          borderRadius: '6px',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 50,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Typing Animation Hook
// ============================================================================

function useTypingAnimation(text: string, isActive: boolean, speed: number = 12) {
  const [displayedText, setDisplayedText] = useState(text);
  const [isTyping, setIsTyping] = useState(false);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (isActive && !hasAnimatedRef.current && text.length > 0) {
      hasAnimatedRef.current = true;
      setIsTyping(true);
      setDisplayedText("");

      let currentIndex = 0;
      const totalChars = text.length;
      const chunkSize = Math.max(1, Math.floor(totalChars / (totalChars / speed)));

      const typeNextChunk = () => {
        if (currentIndex >= totalChars) {
          setIsTyping(false);
          setDisplayedText(text);
          return;
        }

        const nextIndex = Math.min(currentIndex + chunkSize, totalChars);
        currentIndex = nextIndex;
        setDisplayedText(text.slice(0, currentIndex));

        const nextChar = text[currentIndex];
        const delay = nextChar === '.' || nextChar === '!' || nextChar === '?' ? 60 : 12;

        requestAnimationFrame(() => {
          setTimeout(typeNextChunk, delay);
        });
      };

      setTimeout(typeNextChunk, 80);
    } else if (!isActive) {
      setDisplayedText(text);
    }
  }, [isActive, text, speed]);

  useEffect(() => {
    if (!isTyping && text !== displayedText) {
      setDisplayedText(text);
    }
  }, [text, isTyping, displayedText]);

  return { displayedText, isTyping };
}

// ============================================================================
// Main Message Component
// ============================================================================

export const PolishedMessage = memo(function PolishedMessage({
  message,
  isLoading,
  isLast,
  onCopy,
  onRegenerate,
  onFeedback
}: PolishedMessageProps) {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === "assistant";

  const textContent = React.useMemo(() => {
    if (typeof message.content === "string") return message.content;
    if (Array.isArray(message.content)) {
      return message.content
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text)
        .join("");
    }
    return "";
  }, [message.content]);

  const { displayedText, isTyping } = useTypingAnimation(
    textContent,
    isAssistant && !!isLast && (isLoading || textContent.length > 0),
    15
  );

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.(textContent);
  }, [textContent, onCopy]);

  // ── User Message ──────────────────────────────────────────────────────
  if (!isAssistant) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '8px 0',
      }}>
        <div style={{
          maxWidth: '85%',
          padding: '14px 20px',
          borderRadius: '20px',
          background: '#3A3530',
          color: '#ECECEC',
          fontSize: '15px',
          lineHeight: '1.6',
          wordBreak: 'break-word',
        }}>
          {textContent}
        </div>
      </div>
    );
  }

  // ── Assistant Message ─────────────────────────────────────────────────
  return (
    <div
      className="assistant-message-group"
      style={{
        padding: '16px 0',
        position: 'relative',
      }}
    >
      {/* Thinking / Reasoning Summary */}
      {Array.isArray(message.content) && message.content.map((part: any, idx: number) => {
        if (part.type === "reasoning") {
          return (
            <ThinkingSummary
              key={idx}
              reasoning={part.reasoning}
              isStreaming={isLoading && isLast}
            />
          );
        }
        return null;
      })}

      {/* Message Text Content */}
      <div style={{
        fontSize: '15px',
        lineHeight: '1.7',
        color: '#E0E0E0',
      }}>
        {typeof message.content === "string" ? (
          <>
            {displayedText ? (
              <Markdown>{displayedText}</Markdown>
            ) : (
              isLoading && isLast && <span style={{ color: '#7A7A7A' }}>...</span>
            )}
          </>
        ) : Array.isArray(message.content) ? (
          <>
            {message.content.map((part: any, idx: number) => {
              if (part.type === "text") {
                return (
                  <div key={idx}>
                    <Markdown>{displayedText || part.text}</Markdown>
                  </div>
                );
              }
              // reasoning is handled above
              return null;
            })}
          </>
        ) : null}
      </div>

      {/* Action Buttons */}
      {!isLoading && !isTyping && textContent && (
        <MessageActions
          onCopy={handleCopy}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
          copied={copied}
        />
      )}

      {/* MatrixLogo shown below assistant messages - smaller and more subtle */}
      {isLast && isLoading && (
        <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MatrixLogo state="thinking" size={12} />
          <span style={{ fontSize: '11px', color: 'rgba(212,176,140,0.5)', fontWeight: 500 }}>Thinking…</span>
        </div>
      )}

      <style>{`
        .assistant-message-group:hover .message-actions {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
});

// ============================================================================
// Typing Indicator (for initial streaming state)
// ============================================================================

export const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: '#D4956A', opacity: 0.6, animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0ms' }}
        />
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: '#D4956A', opacity: 0.6, animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '200ms' }}
        />
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: '#D4956A', opacity: 0.6, animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '400ms' }}
        />
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
      `}</style>
    </div>
  );
});

export default PolishedMessage;
