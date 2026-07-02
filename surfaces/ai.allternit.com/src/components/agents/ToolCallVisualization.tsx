import React, { useCallback, useState } from "react";
import { ArrowCounterClockwise, ArrowsIn, ArrowsOut, CaretDown, CaretUp, Check, CheckCircle, CircleNotch, Clock, Copy, FileText, GearSix, MagnifyingGlass, Terminal, Warning, Wrench, X, XCircle, Record } from "@phosphor-icons/react";
import type { ToolCall } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { MODE_COLORS } from "@/design/allternit.tokens";

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

export function useToolCallAccent(mode: keyof typeof MODE_COLORS): string {
  return MODE_COLORS[mode]?.accent ?? "#D4956A";
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
  const [expandedAll, setExpandedAll] = useState(false);

  const toggleAll = useCallback(() => {
    setExpandedAll(!expandedAll);
  }, [expandedAll]);

  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-3">
      {/* Header with expand/collapse all */}
      {toolCalls.length > 1 && (
        <button type="button"
          onClick={toggleAll}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border-none bg-transparent text-[#7a6b5d] text-[12px] cursor-pointer self-end hover:bg-white/5 transition-colors"
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
      className="rounded-xl border border-solid transition-all duration-200 overflow-hidden"
      style={{
        borderColor: `${accentColor}4d`,
        background: `${accentColor}14`,
      }}
    >
      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 p-[10px_12px] bg-transparent border-none cursor-pointer text-left"
      >
        {/* Status Icon */}
        <div
          className="size-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
          style={{
            background: isLoading
              ? `${accentColor}4d`
              : hasResult
                ? isSuccess
                  ? "rgba(121,196,124,0.2)"
                  : "rgba(239,68,68,0.2)"
                : `${accentColor}33`,
          }}
        >
          {isLoading ? (
            <CircleNotch size={14} className="animate-spin" style={{ color: accentColor }} />
          ) : hasResult ? (
            isSuccess ? (
              <CheckCircle size={14} className="text-[#79C47C]" />
            ) : (
              <XCircle size={14} className="text-[#ef4444]" />
            )
          ) : (
            <span style={{ color: accentColor }}>{meta.icon}</span>
          )}
        </div>

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[#f6eee7] truncate">
              {meta.label}
            </span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--ui-border-muted)] text-[#7a6b5d] uppercase tracking-wider font-bold">
              {meta.category}
            </span>
          </div>
          <div className="text-[12px] text-[#a8998c] mt-0.5">
            {isLoading ? (
              <span className="flex items-center gap-1">
                <CircleNotch size={10} className="animate-spin" />
                Executing…
              </span>
            ) : hasResult ? (
              <span className="flex items-center gap-1.5">
                {isSuccess ? (
                  <>
                    <Check size={10} className="text-[#79C47C]" />
                    Completed
                    {executionTime && (
                      <span className="text-[#7a6b5d]">· {formatExecutionTime(executionTime)}</span>
                    )}
                  </>
                ) : (
                  <>
                    <X size={10} className="text-[#ef4444]" />
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
        <div className="flex items-center gap-1">
          {hasResult && !isLoading && (
            <button type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className={cn(
                "p-1 px-2 rounded-md border-none text-[12px] cursor-pointer flex items-center gap-1 transition-colors",
                copied ? "bg-[#79C47C]/20 text-[#79C47C]" : "bg-transparent text-[#7a6b5d] hover:bg-white/5"
              )}
              title="Copy result"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          )}
          
          {error && onRetry && (
            <button type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="p-1 px-2 rounded-md border-none bg-[var(--status-error-bg)] text-[#ef4444] cursor-pointer text-[12px] flex items-center gap-1 hover:opacity-80 transition-opacity"
              title="Retry"
            >
              <ArrowCounterClockwise size={12} />
            </button>
          )}

          <div className="text-[12px] ml-1 transition-transform duration-200" style={{ color: accentColor }}>
            {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-solid border-[var(--ui-border-muted)] animate-slideDown">
          {/* Arguments Section */}
          <div className="mt-3">
            <SectionHeader accentColor={accentColor} title="Arguments" count={Object.keys(toolCall.arguments).length} />
            <CodeBlock content={JSON.stringify(toolCall.arguments, null, 2)} maxHeight={120} />
          </div>

          {/* Result Section */}
          {hasResult && (
            <div className="mt-3">
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
    <div className="flex items-center gap-2 mb-1.5">
      <div className="text-[11px] font-extrabold text-[var(--accent-color)] uppercase tracking-wider"
        style={{ '--accent-color': accentColor } as React.CSSProperties}
      >
        {title}
      </div>
      {count !== undefined && (
        <span className="text-[11px] px-1 rounded bg-[var(--ui-border-muted)] text-[#7a6b5d]">
          {count}
        </span>
      )}
      {isError && (
        <Warning size={12} className="text-[#ef4444]" />
      )}
    </div>
  );
}

function CodeBlock({ content, maxHeight = 150 }: { content: string; maxHeight?: number }) {
  return (
    <pre
      className="m-0 p-2.5 rounded-lg bg-[var(--surface-panel)] text-[12px] font-mono text-[#d1c3b4] overflow-auto leading-relaxed"
      style={{ maxHeight }}
    >
      {content}
    </pre>
  );
}

function ErrorBlock({ error }: { error: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-[var(--status-error-bg)] border border-solid border-[#ef4444]/20">
      <div className="flex items-start gap-2">
        <XCircle size={16} className="text-[#ef4444] shrink-0 mt-0.5" />
        <pre className="m-0 text-[12px] font-mono text-[#ef4444] whitespace-pre-wrap break-words leading-relaxed">
          {error}
        </pre>
      </div>
    </div>
  );
}

function ResultViewer({ result }: { result: unknown }) {
  if (result === null || result === undefined) {
    return <CodeBlock content="null" />;
  }

  if (typeof result === "string") {
    if (result.includes("\n") || result.length > 100) {
      return <CodeBlock content={result} maxHeight={200} />;
    }
    return (
      <div className="p-2.5 rounded-lg bg-[#79C47C]/10 border border-solid border-[#79C47C]/20 text-[12px] text-[#d1c3b4] leading-relaxed">
        {result}
      </div>
    );
  }

  if (typeof result === "boolean") {
    return (
      <div className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg",
        result ? "bg-[#79C47C]/10" : "bg-red-500/10"
      )}>
        {result ? (
          <CheckCircle size={16} className="text-[#79C47C]" />
        ) : (
          <XCircle size={16} className="text-[#ef4444]" />
        )}
        <span className={cn("font-bold text-[13px]", result ? "text-[#79C47C]" : "text-[#ef4444]")}>
          {result ? "True" : "False"}
        </span>
      </div>
    );
  }

  if (Array.isArray(result)) {
    if (result.length === 0) {
      return (
        <div className="p-4 text-center text-[#7a6b5d] text-[12px] italic">
          No results found
        </div>
      );
    }

    if (result[0] && typeof result[0] === "object" && "file" in result[0] && "line" in result[0]) {
      return (
        <div className="flex flex-col gap-2">
          {result.slice(0, 5).map((item: any, index) => (
            <div key={`${item.file}-${item.line}-${index}`} className="p-2.5 rounded-lg bg-[var(--surface-hover)] border border-solid border-transparent">
              <div className="text-[12px] text-[#a8998c] mb-1 font-mono">
                {item.file}:{item.line}
              </div>
              <pre className="m-0 text-[12px] font-mono text-[#d1c3b4] overflow-auto leading-relaxed">
                {item.content}
              </pre>
            </div>
          ))}
          {result.length > 5 && (
            <div className="text-center text-[#7a6b5d] text-[12px]">
              … and {result.length - 5} more results
            </div>
          )}
        </div>
      );
    }

    if (result[0] && typeof result[0] === "object" && "name" in result[0] && "type" in result[0]) {
      return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1">
          {result.map((item: any, index) => (
            <div key={`file-res-${item.name}-${index}`} className="flex items-center gap-2 p-1.5 px-2 rounded-md bg-[var(--surface-hover)] text-[12px] text-[#d1c3b4] transition-colors hover:bg-[var(--surface-active)]">
              {item.type === "directory" ? (
                <GearSix size={12} className="text-[#a8998c]" />
              ) : (
                <FileText size={12} className="text-[#d1c3b4]" />
              )}
              <span className="truncate">{item.name}</span>
            </div>
          ))}
        </div>
      );
    }

    return <CodeBlock content={JSON.stringify(result, null, 2)} maxHeight={200} />;
  }

  return <CodeBlock content={JSON.stringify(result, null, 2)} maxHeight={200} />;
}

// Helper hook to get surface accent color
export function getToolCallAccent(surface: "chat" | "cowork" | "code" | "browser" | "design"): string {
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
