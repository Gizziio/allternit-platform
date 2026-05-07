/**
 * Tool Row — Clean timeline-style tool/file/terminal display
 *
 * Design principles (matches ThoughtTrace):
 * - No heavy card borders or coloured backgrounds — just a 2px left accent line
 * - MatrixLogo (small) animates in the running state; static icon for others
 * - Tool name + status text on one row, clean typography
 * - Smooth accordion expansion showing input → output
 * - Consistent with the rest of the message stream
 */

"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle,
  CircleDashed,
  Warning,
  Terminal,
  FileText,
  Globe,
  CaretRight,
} from '@phosphor-icons/react';
import { memo, useState } from "react";

export type PillState = "pending" | "running" | "completed" | "error";
export type PillType = "tool" | "file" | "terminal" | "web-search";

interface GlassPillProps {
  type?: PillType;
  state?: PillState;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children?: React.ReactNode;
}

// ─── Accent colour per state ──────────────────────────────────────────────────
const stateAccent: Record<PillState, string> = {
  pending:   "var(--ui-border-default)",
  running:   "rgba(212,176,140,0.45)",   // warm amber — matches MatrixLogo thinking
  completed: "rgba(74,222,128,0.35)",    // green
  error:     "rgba(248,113,113,0.45)",   // red
};

const stateLabel: Record<PillState, string> = {
  pending:   "Pending",
  running:   "Running",
  completed: "Done",
  error:     "Failed",
};

const stateLabelColor: Record<PillState, string> = {
  pending:   "rgba(255,255,255,0.28)",
  running:   "rgba(212,176,140,0.7)",
  completed: "rgba(74,222,128,0.6)",
  error:     "rgba(248,113,113,0.7)",
};

// ─── Type icons ───────────────────────────────────────────────────────────────
const typeIcon: Record<PillType, React.ReactNode> = {
  tool:          <Terminal style={{ width: 11, height: 11 }} />,
  file:          <FileText style={{ width: 11, height: 11 }} />,
  terminal:      <Terminal style={{ width: 11, height: 11 }} />,
  "web-search":  <Globe    style={{ width: 11, height: 11 }} />,
};

// ─── State indicator ──────────────────────────────────────────────────────────
function StateIndicator({ state }: { state: PillState }) {
  if (state === "running") {
    // Amber ring spinner — MatrixLogo blocks are too large for this size
    return (
      <div
        className="animate-spin"
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          border: "1.5px solid var(--ui-border-muted)",
          borderTopColor: "rgba(212,176,140,0.85)",
          flexShrink: 0,
        }}
      />
    );
  }
  if (state === "completed") {
    return (
      <CheckCircle
        style={{ width: 13, height: 13, color: "rgba(74,222,128,0.7)", flexShrink: 0 }}
      />
    );
  }
  if (state === "error") {
    return (
      <Warning
        style={{ width: 13, height: 13, color: "rgba(248,113,113,0.7)", flexShrink: 0 }}
      />
    );
  }
  // pending
  return (
    <CircleDashed
      style={{ width: 13, height: 13, color: "rgba(255,255,255,0.22)", flexShrink: 0 }}
    />
  );
}

// ─── GlassPill ───────────────────────────────────────────────────────────────
export const GlassPill = memo(
  ({
    type = "tool",
    state = "pending",
    title,
    description,
    icon,
    className,
    onClick,
    collapsible = false,
    defaultCollapsed = false,
    children,
  }: GlassPillProps) => {
    const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsCollapsed((v) => !v);
    };

    return (
      <div
        className={cn("my-1.5", className)}
        style={{ userSelect: "none" }}
      >
        {/* ── Row ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            paddingLeft: "10px",
            borderLeft: `2px solid ${stateAccent[state]}`,
            transition: "border-color 0.3s ease",
            cursor: collapsible || onClick ? "pointer" : "default",
          }}
          onClick={collapsible ? handleToggle : onClick}
        >
          {/* State indicator (MatrixLogo when running, icon otherwise) */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <StateIndicator state={state} />
          </div>

          {/* Type icon */}
          <span
            style={{
              flexShrink: 0,
              color: "rgba(255,255,255,0.28)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {icon ?? typeIcon[type]}
          </span>

          {/* Title */}
          {title && (
            <span
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: state === "running"
                  ? "rgba(236,236,236,0.88)"
                  : state === "completed"
                  ? "rgba(236,236,236,0.62)"
                  : "rgba(236,236,236,0.5)",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                transition: "color 0.3s ease",
              }}
            >
              {title}
            </span>
          )}

          {/* Status label */}
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: stateLabelColor[state],
              letterSpacing: "0.04em",
              flexShrink: 0,
              transition: "color 0.3s ease",
            }}
          >
            {description ?? stateLabel[state]}
          </span>

          {/* Expand chevron */}
          {collapsible && children && (
            <CaretRight
              style={{
                width: 12,
                height: 12,
                color: "rgba(255,255,255,0.25)",
                flexShrink: 0,
                transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                transition: "transform 0.18s ease",
              }}
            />
          )}
        </div>

        {/* ── Expanded content ── */}
        {collapsible && !isCollapsed && children && (
          <div
            style={{
              marginTop: "6px",
              marginLeft: "12px",
              paddingLeft: "10px",
              borderLeft: "1px solid var(--ui-border-muted)",
            }}
          >
            {children}
          </div>
        )}

        {/* Inline (non-collapsible) children */}
        {!collapsible && children && (
          <div style={{ marginTop: "4px", marginLeft: "12px" }}>
            {children}
          </div>
        )}
      </div>
    );
  }
);

GlassPill.displayName = "GlassPill";

// ─── FilePill ─────────────────────────────────────────────────────────────────
interface FilePillProps {
  filename: string;
  path?: string;
  state?: PillState;
  onClick?: () => void;
}

export const FilePill = memo(({ filename, path, state = "completed", onClick }: FilePillProps) => {
  return (
    <GlassPill
      type="file"
      state={state}
      title={filename}
      description={path}
      onClick={onClick}
    />
  );
});

FilePill.displayName = "FilePill";

// ─── TerminalPill ─────────────────────────────────────────────────────────────
interface TerminalPillProps {
  command: string;
  output?: string;
  state?: PillState;
  collapsible?: boolean;
}

export const TerminalPill = memo(({ command, output, state = "running", collapsible = true }: TerminalPillProps) => {
  return (
    <GlassPill
      type="terminal"
      state={state}
      title={command}
      collapsible={collapsible && !!output}
      defaultCollapsed={state === "completed"}
    >
      {output && (
        <pre
          style={{
            fontSize: "11px",
            fontFamily: "var(--font-mono)",
            color: "rgba(236,236,236,0.55)",
            lineHeight: "1.6",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            margin: 0,
            maxHeight: "180px",
            overflowY: "auto",
          }}
        >
          {output.length > 1200 ? output.slice(0, 1200) + "\n…" : output}
        </pre>
      )}
    </GlassPill>
  );
});

TerminalPill.displayName = "TerminalPill";

// ─── WebSearchPill ────────────────────────────────────────────────────────────
interface WebSearchPillProps {
  query: string;
  results?: number;
  state?: PillState;
  sources?: Array<{ title: string; url: string }>;
}

export const WebSearchPill = memo(({ query, results, state = "running", sources }: WebSearchPillProps) => {
  const resolvedResults = results ?? sources?.length;
  const resultLabel = resolvedResults === 1 ? "result" : "results";

  return (
    <GlassPill
      type="web-search"
      state={state}
      title={`Searched: ${query}`}
      description={
        state === "completed"
          ? resolvedResults
            ? `${resolvedResults} ${resultLabel}`
            : "Done"
          : "Searching…"
      }
      collapsible={!!sources && sources.length > 0}
      defaultCollapsed={state === "completed" && !!sources?.length}
    >
      {sources && sources.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {sources.slice(0, 3).map((source, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "12px", color: "rgba(236,236,236,0.7)", wordBreak: "break-word" }}>
                {source.title}
              </span>
              <span style={{ fontSize: "11px", color: "rgba(236,236,236,0.35)", wordBreak: "break-all" }}>
                {source.url}
              </span>
            </div>
          ))}
          {sources.length > 3 && (
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)" }}>
              +{sources.length - 3} more
            </span>
          )}
        </div>
      )}
    </GlassPill>
  );
});

WebSearchPill.displayName = "WebSearchPill";
