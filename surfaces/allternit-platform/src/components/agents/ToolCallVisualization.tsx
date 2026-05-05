/**
 * Tool Call Visualization Component
 * 
 * Renders tool calls and their results inline in chat messages.
 * Shows when the agent uses tools with expandable details,
 * progress indicators, and rich formatting.
 */

import React, { useState, useCallback } from "react";
import {
  Wrench,
  Check,
  X,
  CaretDown,
  CaretUp,
  CircleNotch,
  Clock,
  Copy,
  ArrowCounterClockwise,
  Terminal,
  FileText,
  Globe,
  Database,
  MagnifyingGlass,
  GearSix,
  Warning,
  CheckCircle,
  XCircle,
  ArrowsOut,
  ArrowsIn,
} from '@phosphor-icons/react';
import type { ToolCall } from "@/lib/agents";

interface ToolCallVisualizationProps {
  toolCalls: ToolCall[];
  results?: Record<string, unknown>;
  errors?: Record<string, string>;
  isLoading?: boolean;
  accentColor?: string;
  onRetry?: (toolCallId: string) => void;
  executionTimes?: Record<string, number>; // ms
}

interface SingleToolCallProps {
  toolCall: ToolCall;
  result?: unknown;
  error?: string;
  isLoading?: boolean;
  accentColor: string;
  onRetry?: () => void;
  executionTime?: number;
}

interface ToolMeta {
  icon: React.ReactNode;
  label: string;
  category: string;
  description?: string;
}

// Tool metadata for better display
const TOOL_METADATA: Record<string, ToolMeta> = {
  read_file: {
    icon: <FileText size={14} />,
    label: "Read File",
    category: "File System",
    description: "Reads file contents",
  },
  write_file: {
    icon: <FileText size={14} />,
    label: "Write File",
    category: "File System",
    description: "Writes or modifies files",
  },
  execute_command: {
    icon: <Terminal size={14} />,
    label: "Run Command",
    category: "System",
    description: "Executes shell commands",
  },
  search_code: {
    icon: <MagnifyingGlass size={14} />,
    label: "Search Code",
    category: "Code",
    description: "Searches codebase",
  },
  list_directory: {
    icon: <GearSix size={14} />,
    label: "List Directory",
    category: "File System",
    description: "Lists directory contents",
  },
  ask_user: {
    icon: <GearSix size={14} />,
    label: "Ask User",
    category: "Interactive",
    description: "Requests user input",
  },
  schedule_job: {
    icon: <Clock size={14} />,
    label: "Schedule Job",
    category: "Automation",
    description: "Creates scheduled tasks",
  },
};

function getToolMeta(toolName: string): ToolMeta {
  return TOOL_METADATA[toolName] || {
    icon: <Wrench size={14} />,
    label: toolName,
    category: "Tool",
    description: "Executes a tool",
  };
}

export function ToolCallVisualization({
  toolCalls,
  results = {},
  errors = {},
  isLoading = false,
  accentColor = "#D4956A",
  onRetry,
  executionTimes = {},
}: ToolCallVisualizationProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const [expandedAll, setExpandedAll] = useState(false);

  const toggleAll = useCallback(() => {
    setExpandedAll(!expandedAll);
  }, [expandedAll]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {/* Header with expand/collapse all */}
      {toolCalls.length > 1 && (
        <button
          onClick={toggleAll}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 8px",
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: "#7a6b5d",
            fontSize: 11,
            cursor: "pointer",
            alignSelf: "flex-end",
          }}
        >
          {expandedAll ? <ArrowsIn size={12} /> : <ArrowsOut size={12} />}
          {expandedAll ? "Collapse All" : "Expand All"}
        </button>
      )}

      {toolCalls.map((toolCall) => (
        <SingleToolCallView
          key={toolCall.id}
          toolCall={toolCall}
          result={results[toolCall.id]}
          error={errors[toolCall.id]}
          isLoading={isLoading}
          accentColor={accentColor}
          onRetry={() => onRetry?.(toolCall.id)}
          executionTime={executionTimes[toolCall.id]}
          forceExpanded={expandedAll}
        />
      ))}
    </div>
  );
}

function SingleToolCallView({ 
  toolCall, 
  result, 
  error, 
  isLoading, 
  accentColor, 
  onRetry,
  executionTime,
  forceExpanded
}: SingleToolCallProps & { forceExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isExpanded = forceExpanded !== undefined ? forceExpanded : expanded;
  
  const hasResult = result !== undefined || error !== undefined;
  const isSuccess = !error;
  const meta = getToolMeta(toolCall.name);

  const handleCopy = useCallback(() => {
    const text = error || JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result, error]);

  const formatExecutionTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${accentColor}30`,
        background: `${accentColor}08`,
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Status Icon */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: isLoading
              ? `${accentColor}30`
              : hasResult
                ? isSuccess
                  ? "rgba(121,196,124,0.2)"
                  : "rgba(239,68,68,0.2)"
                : `${accentColor}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.2s ease",
          }}
        >
          {isLoading ? (
            <CircleNotch size={14} style={{ color: accentColor, animation: "spin 1s linear infinite" }} />
          ) : hasResult ? (
            isSuccess ? (
              <CheckCircle size={14} style={{ color: "#79C47C" }} />
            ) : (
              <XCircle size={14} style={{ color: "#ef4444" }} />
            )
          ) : (
            <span style={{ color: accentColor }}>{meta.icon}</span>
          )}
        </div>

        {/* Tool Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#f6eee7",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {meta.label}
            </span>
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 4,
                background: "var(--ui-border-muted)",
                color: "#7a6b5d",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {meta.category}
            </span>
          </div>
          <div style={{ fontSize: 10, color: "#a8998c", marginTop: 2 }}>
            {isLoading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <CircleNotch size={10} style={{ animation: "spin 1s linear infinite" }} />
                Executing...
              </span>
            ) : hasResult ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isSuccess ? (
                  <>
                    <Check size={10} style={{ color: "#79C47C" }} />
                    Completed
                    {executionTime && (
                      <span style={{ color: "#7a6b5d" }}>• {formatExecutionTime(executionTime)}</span>
                    )}
                  </>
                ) : (
                  <>
                    <X size={10} style={{ color: "#ef4444" }} />
                    Failed
                  </>
                )}
              </span>
            ) : (
              "Ready to execute"
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {hasResult && !isLoading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "none",
                background: copied ? "rgba(121,196,124,0.2)" : "transparent",
                color: copied ? "#79C47C" : "#7a6b5d",
                cursor: "pointer",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Copy result"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          )}
          
          {error && onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: "none",
                background: "var(--status-error-bg)",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Retry"
            >
              <ArrowCounterClockwise size={12} />
            </button>
          )}

          <div style={{ color: accentColor, fontSize: 12, marginLeft: 4 }}>
            {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          style={{
            padding: "0 12px 12px",
            borderTop: "1px solid var(--ui-border-muted)",
            animation: "slideDown 0.2s ease",
          }}
        >
          {/* Arguments Section */}
          <div style={{ marginTop: 12 }}>
            <SectionHeader accentColor={accentColor} title="Arguments" count={Object.keys(toolCall.arguments).length} />
            <CodeBlock content={JSON.stringify(toolCall.arguments, null, 2)} maxHeight={120} />
          </div>

          {/* Result Section */}
          {hasResult && (
            <div style={{ marginTop: 12 }}>
              <SectionHeader 
                accentColor={isSuccess ? "#79C47C" : "#ef4444"} 
                title={isSuccess ? "Result" : "Error"}
                isError={!isSuccess}
              />
              {isSuccess ? (
                <ResultViewer result={result} />
              ) : (
                <ErrorBlock error={error} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ 
  accentColor, 
  title, 
  count,
  isError 
}: { 
  accentColor: string; 
  title: string; 
  count?: number;
  isError?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: accentColor,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </div>
      {count !== undefined && (
        <span
          style={{
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 4,
            background: "var(--ui-border-muted)",
            color: "#7a6b5d",
          }}
        >
          {count}
        </span>
      )}
      {isError && (
        <Warning size={12} style={{ color: "#ef4444" }} />
      )}
    </div>
  );
}

function CodeBlock({ content, maxHeight = 150 }: { content: string; maxHeight?: number }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 10,
        borderRadius: 8,
        background: "var(--surface-panel)",
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        color: "#d1c3b4",
        overflow: "auto",
        maxHeight,
        lineHeight: 1.4,
      }}
    >
      {content}
    </pre>
  );
}

function ErrorBlock({ error }: { error: string }) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 8,
        background: "var(--status-error-bg)",
        border: "1px solid rgba(239,68,68,0.2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <XCircle size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
        <pre
          style={{
            margin: 0,
            fontSize: 11,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            color: "#ef4444",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            lineHeight: 1.4,
          }}
        >
          {error}
        </pre>
      </div>
    </div>
  );
}

function ResultViewer({ result }: { result: unknown }) {
  // Handle different result types
  if (result === null || result === undefined) {
    return <CodeBlock content="null" />;
  }

  if (typeof result === "string") {
    // Check if it's a file path or content
    if (result.includes("\n") || result.length > 100) {
      return <CodeBlock content={result} maxHeight={200} />;
    }
    return (
      <div
        style={{
          padding: 10,
          borderRadius: 8,
          background: "rgba(121,196,124,0.08)",
          border: "1px solid rgba(121,196,124,0.2)",
          fontSize: 12,
          color: "#d1c3b4",
        }}
      >
        {result}
      </div>
    );
  }

  if (typeof result === "boolean") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: 10,
          borderRadius: 8,
          background: result ? "rgba(121,196,124,0.1)" : "var(--status-error-bg)",
        }}
      >
        {result ? (
          <CheckCircle size={16} style={{ color: "#79C47C" }} />
        ) : (
          <XCircle size={16} style={{ color: "#ef4444" }} />
        )}
        <span style={{ color: result ? "#79C47C" : "#ef4444", fontWeight: 600 }}>
          {result ? "True" : "False"}
        </span>
      </div>
    );
  }

  // Array with search results or file entries
  if (Array.isArray(result)) {
    if (result.length === 0) {
      return (
        <div
          style={{
            padding: 16,
            textAlign: "center",
            color: "#7a6b5d",
            fontSize: 12,
          }}
        >
          No results found
        </div>
      );
    }

    // Search results
    if (result[0] && typeof result[0] === "object" && "file" in result[0] && "line" in result[0]) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {result.slice(0, 5).map((item: any, index) => (
            <div
              key={index}
              style={{
                padding: 10,
                borderRadius: 8,
                background: "var(--surface-hover)",
                border: "1px solid var(--surface-hover)",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "#a8998c",
                  marginBottom: 4,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {item.file}:{item.line}
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "#d1c3b4",
                  overflow: "auto",
                }}
              >
                {item.content}
              </pre>
            </div>
          ))}
          {result.length > 5 && (
            <div style={{ textAlign: "center", color: "#7a6b5d", fontSize: 11 }}>
              ... and {result.length - 5} more results
            </div>
          )}
        </div>
      );
    }

    // File entries
    if (result[0] && typeof result[0] === "object" && "name" in result[0] && "type" in result[0]) {
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 4,
          }}
        >
          {result.map((item: any, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                borderRadius: 6,
                background: "var(--surface-hover)",
                fontSize: 11,
                color: item.type === "directory" ? "#a8998c" : "#d1c3b4",
              }}
            >
              {item.type === "directory" ? (
                <GearSix size={12} style={{ color: "#a8998c" }} />
              ) : (
                <FileText size={12} style={{ color: "#d1c3b4" }} />
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.name}
              </span>
            </div>
          ))}
        </div>
      );
    }

    return <CodeBlock content={JSON.stringify(result, null, 2)} maxHeight={200} />;
  }

  // Default JSON display
  return <CodeBlock content={JSON.stringify(result, null, 2)} maxHeight={200} />;
}

// Helper hook to get surface accent color
export function useToolCallAccent(surface: "chat" | "cowork" | "code" | "browser" | "design"): string {
  const colors = {
    chat: "#D4956A",
    cowork: "#A78BFA",
    code: "#79C47C",
    browser: "#69A8C8",
    design: "#D4B08C",
  };
  return colors[surface];
}

export default ToolCallVisualization;
