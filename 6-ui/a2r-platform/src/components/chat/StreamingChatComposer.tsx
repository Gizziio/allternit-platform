/**
 * Streaming Chat Composer
 * 
 * Rich streaming chat experience using all AI Elements from Elements Lab.
 * Handles all message states: idle, streaming, thinking, tool-use, complete.
 */

import React, { memo, useState, useCallback, useMemo } from "react";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { UnifiedMessageRenderer } from "@/components/ai-elements/UnifiedMessageRenderer";
import { parseStructuredContent } from "@/lib/ai/rust-stream-adapter-extended";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Copy, RefreshCw, ThumbsUp, ThumbsDown, Check, Clock3, Link2, Package, Sparkles, Wrench } from "lucide-react";
import type { ChatMessage } from "@/lib/ai/rust-stream-adapter";
import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";

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
    <div className="message-actions flex items-center gap-1 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={onCopy}
        className="p-1.5 rounded hover:bg-white/5 transition-colors"
        title="Copy"
      >
        {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500" />}
      </button>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="p-1.5 rounded hover:bg-white/5 transition-colors"
          title="Regenerate"
        >
          <RefreshCw size={14} className="text-gray-500" />
        </button>
      )}
      {onFeedback && (
        <>
          <button
            onClick={() => onFeedback('up')}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            title="Helpful"
          >
            <ThumbsUp size={14} className="text-gray-500" />
          </button>
          <button
            onClick={() => onFeedback('down')}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            title="Not helpful"
          >
            <ThumbsDown size={14} className="text-gray-500" />
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

function formatModelLabel(modelId?: string): string | null {
  if (!modelId) return null;

  const raw = modelId.includes("/") ? modelId.split("/").at(-1) ?? modelId : modelId;
  return raw
    .split(/[-_:]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDuration(durationMs?: number): string | null {
  if (!durationMs || durationMs <= 0) return null;
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 0 : 1)}s`;
}

const MetaPill = memo(function MetaPill({
  icon,
  label,
  tone = "default",
  pulse = false,
}: {
  icon?: React.ReactNode;
  label: string;
  tone?: "default" | "active" | "error" | "muted";
  pulse?: boolean;
}) {
  const toneStyles: Record<string, React.CSSProperties> = {
    default: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "rgba(236,236,236,0.82)",
    },
    active: {
      background: "rgba(212,176,140,0.12)",
      border: "1px solid rgba(212,176,140,0.24)",
      color: "#E6C4A3",
    },
    error: {
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.24)",
      color: "#F5B4B4",
    },
    muted: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.05)",
      color: "rgba(236,236,236,0.58)",
    },
  };

  return (
    // a2r-meta-pill class in index.css adds smooth transition on colour/bg change
    <span
      className="a2r-meta-pill"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 9px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        ...toneStyles[tone],
      }}
    >
      {/* Pulsing dot for streaming state */}
      {pulse && (
        <span
          className="animate-pulse"
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: '#D4956A',
            flexShrink: 0,
          }}
        />
      )}
      {icon}
      {label}
    </span>
  );
});

const AssistantRunSummary = memo(function AssistantRunSummary({
  modelLabel,
  durationLabel,
  toolCount,
  sourceCount,
  artifactCount,
  status,
}: {
  modelLabel: string | null;
  durationLabel: string | null;
  toolCount: number;
  sourceCount: number;
  artifactCount: number;
  status: "streaming" | "complete" | "error" | "stopped";
}) {
  const hasSummary = modelLabel || durationLabel || toolCount || sourceCount || artifactCount || status !== "complete";
  if (!hasSummary) return null;

  const statusLabel = {
    streaming: "Streaming",
    complete: "Complete",
    error: "Issue detected",
    stopped: "Stopped",
  }[status];

  const statusTone = status === "error"
    ? "error"
    : status === "streaming"
      ? "active"
      : "muted";

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginBottom: "14px",
    }}>
      <MetaPill label={statusLabel} tone={statusTone} pulse={status === "streaming"} />
      {modelLabel && (
        <MetaPill
          icon={<Sparkles size={12} />}
          label={modelLabel}
        />
      )}
      {toolCount > 0 && (
        <MetaPill
          icon={<Wrench size={12} />}
          label={`${toolCount} tool${toolCount === 1 ? "" : "s"}`}
        />
      )}
      {sourceCount > 0 && (
        <MetaPill
          icon={<Link2 size={12} />}
          label={`${sourceCount} source${sourceCount === 1 ? "" : "s"}`}
        />
      )}
      {artifactCount > 0 && (
        <MetaPill
          icon={<Package size={12} />}
          label={`${artifactCount} artifact${artifactCount === 1 ? "" : "s"}`}
        />
      )}
      {durationLabel && (
        <MetaPill
          icon={<Clock3 size={12} />}
          label={durationLabel}
          tone="muted"
        />
      )}
    </div>
  );
});

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
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: '#ECECEC',
        fontSize: '15px',
        lineHeight: '1.6',
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
              color: '#D4B08C',
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
}: StreamingChatComposerProps) {
  const [copied, setCopied] = useState(false);
  
  const isAssistant = message.role === 'assistant';
  const messageStatus = (isLoading && isLast)
    ? "streaming"
    : (message.metadata?.status ?? "complete");
  
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

  const activitySummary = useMemo(() => {
    return {
      toolCount: messageParts.filter((part) => part.type === "dynamic-tool").length,
      sourceCount: messageParts.filter((part) => part.type === "source-document").length,
      artifactCount: messageParts.filter((part) => part.type === "artifact").length,
      // Is the thought trace currently streaming? (logo lives inside trace in that case)
      hasActiveTrace: messageParts.some((part) => part.type === "reasoning"),
    };
  }, [messageParts]);

  const modelLabel = useMemo(() => {
    return formatModelLabel(message.metadata?.runtimeModelId ?? message.metadata?.modelId);
  }, [message.metadata?.modelId, message.metadata?.runtimeModelId]);

  const durationLabel = useMemo(() => {
    return formatDuration(message.metadata?.durationMs);
  }, [message.metadata?.durationMs]);

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
      {/* Slim header: label only, no logo at top */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'rgba(212,149,106,0.55)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          A2R
        </span>
      </div>

      {/* Message content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <AssistantRunSummary
          modelLabel={modelLabel}
          durationLabel={durationLabel}
          toolCount={activitySummary.toolCount}
          sourceCount={activitySummary.sourceCount}
          artifactCount={activitySummary.artifactCount}
          status={messageStatus}
        />

        {/* Main content using UnifiedMessageRenderer for rich AI Elements */}
        <div style={{
          fontSize: '15px',
          lineHeight: '1.7',
          color: '#E0E0E0',
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
            <Shimmer className="h-4 w-3/4" />
          ) : null}

          {/* Developer Debug Overlay (Hard-gated) */}
          {SHOW_DEBUG && (
            <div className="absolute top-0 right-0 -mt-6 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-[10px] font-mono text-white/50 bg-black/50 px-2 py-1 rounded">
              <span className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
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

        {/* MatrixLogo at the bottom:
              - When a thought trace is active, the logo lives INSIDE the trace (moving along each step).
              - When there's no trace yet (e.g. initial shimmer or pure text stream), show it here as a fallback. */}
        {(isLoading && isLast && !activitySummary.hasActiveTrace) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            opacity: 0.72,
          }}>
            <MatrixLogo
              state="thinking"
              size={12}
            />
            <span style={{
              fontSize: '11px',
              color: 'rgba(236,236,236,0.35)',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}>
              Thinking…
            </span>
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
