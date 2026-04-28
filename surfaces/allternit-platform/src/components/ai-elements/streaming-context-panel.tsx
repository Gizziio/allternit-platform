"use client";

/**
 * StreamingContextPanel
 *
 * Right-side activity panel that auto-appears during streaming when the AI
 * is using tools. Shows a live timeline of steps, file operations, and
 * results — mirroring the Claude.ai right-panel UX.
 *
 * Auto-opens when tools appear, auto-collapses to a narrow tab when done.
 * User can pin it open or dismiss it.
 */

import React, { useMemo, useState, useEffect } from "react";
import {
  X,
  CheckCircle,
  Warning,
  CircleDashed,
  Terminal,
  FileText,
  Globe,
  MagnifyingGlass,
  PencilSimple,
  FolderOpen,
  CaretLeft,
  CaretRight,
  Clock,
} from "@phosphor-icons/react";
import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreamingContextPanelProps {
  parts: ExtendedUIPart[];
  isStreaming: boolean;
  onClose?: () => void;
}

interface ToolStep {
  toolCallId: string;
  toolName: string;
  state: "pending" | "running" | "done" | "error";
  title: string;
  meta: string | null;
  filePath?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToolIcon(toolName: string): React.ReactNode {
  const name = toolName.toLowerCase().replace(/[_\-\s]/g, "");
  if (name.includes("bash") || name.includes("runcode") || name.includes("computer")) {
    return <Terminal style={{ width: 12, height: 12 }} />;
  }
  if (name.includes("grep") || name.includes("search") || name.includes("glob") || name.includes("find")) {
    return <MagnifyingGlass style={{ width: 12, height: 12 }} />;
  }
  if (name.includes("web") || name.includes("fetch") || name.includes("url") || name.includes("browse")) {
    return <Globe style={{ width: 12, height: 12 }} />;
  }
  if (name.includes("write") || name.includes("edit") || name.includes("str") || name.includes("create")) {
    return <PencilSimple style={{ width: 12, height: 12 }} />;
  }
  return <FileText style={{ width: 12, height: 12 }} />;
}

function humanizeStep(toolName: string, input: Record<string, unknown>): { title: string; meta: string | null; filePath?: string } {
  const name = toolName.toLowerCase().replace(/[_\-\s]/g, "");
  const path = String(input.path ?? input.filename ?? input.file ?? input.name ?? "");
  const fname = path ? path.split("/").pop() ?? "" : "";
  const content = String(input.content ?? input.text ?? input.new_content ?? input.new_string ?? "");
  const charSuffix = content.length > 0 ? `~${content.length} chars` : null;
  const query = String(input.query ?? input.q ?? input.search ?? "");

  if (name.includes("websearch") || name.includes("googlesearch") || name === "search") {
    return { title: `Search: ${query.slice(0, 40) || "web"}`, meta: null };
  }
  if (name.includes("bash") || name.includes("runcode")) {
    const cmd = String(input.command ?? input.cmd ?? "").slice(0, 40);
    return { title: `Run: ${cmd || "command"}`, meta: null };
  }
  if (name.includes("fetchurl") || name.includes("browseurl") || (name.includes("fetch") && input.url)) {
    const url = String(input.url ?? "");
    const domain = url ? new URL(url).hostname : "page";
    return { title: `Fetch: ${domain}`, meta: null };
  }
  if (name.includes("writefile") || name === "write" || name.includes("createfile")) {
    return { title: fname ? `Write ${fname}` : "Write file", meta: charSuffix, filePath: path };
  }
  if (name.includes("strreplace") || name.includes("editfile") || name === "edit") {
    return { title: fname ? `Edit ${fname}` : "Edit file", meta: charSuffix, filePath: path };
  }
  if (name.includes("readfile") || name === "read") {
    return { title: fname ? `Read ${fname}` : "Read file", meta: null, filePath: path };
  }
  if (name.includes("glob") || name.includes("findfiles")) {
    return { title: "Find files", meta: null };
  }
  if (name.includes("grep") || name.includes("searchcode")) {
    return { title: "Search code", meta: null };
  }
  if (name.includes("todowrite") || name.includes("todoupdate")) {
    return { title: "Update todos", meta: charSuffix };
  }
  return { title: toolName, meta: null };
}

function extractSteps(parts: ExtendedUIPart[]): ToolStep[] {
  return parts
    .filter((p) => p.type === "dynamic-tool")
    .map((p: any) => {
      const inp = p.input && typeof p.input === "object" ? p.input as Record<string, unknown> : {};
      const { title, meta, filePath } = humanizeStep(p.toolName ?? "", inp);

      let state: ToolStep["state"] = "pending";
      if (p.state === "input-streaming" || p.state === "input-available") state = "running";
      else if (p.state === "output-available") state = "done";
      else if (p.state === "output-error") state = "error";

      // Enrich meta from result
      let enrichedMeta = meta;
      if (p.state === "output-available" && p.output) {
        const out = p.output;
        if (Array.isArray(out)) {
          enrichedMeta = `${out.length} result${out.length !== 1 ? "s" : ""}`;
        } else if (typeof out === "string" && out.length > 0) {
          enrichedMeta = `${out.length} chars`;
        }
      }

      return {
        toolCallId: p.toolCallId ?? p.toolName ?? String(Math.random()),
        toolName: p.toolName ?? "",
        state,
        title,
        meta: enrichedMeta,
        filePath,
      };
    });
}

function extractFiles(steps: ToolStep[]): Array<{ path: string; ops: string[] }> {
  const map = new Map<string, string[]>();
  for (const step of steps) {
    if (!step.filePath) continue;
    const existing = map.get(step.filePath) ?? [];
    const op = step.title.split(" ")[0]; // "Read", "Write", "Edit"
    if (!existing.includes(op)) existing.push(op);
    map.set(step.filePath, existing);
  }
  return Array.from(map.entries()).map(([path, ops]) => ({ path, ops }));
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ state }: { state: ToolStep["state"] }) {
  if (state === "running") {
    return (
      <div
        className="animate-spin"
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          border: "1.5px solid rgba(212,176,140,0.15)",
          borderTopColor: "rgba(212,176,140,0.8)",
          flexShrink: 0,
        }}
      />
    );
  }
  if (state === "done") {
    return <CheckCircle style={{ width: 11, height: 11, color: "rgba(74,222,128,0.6)", flexShrink: 0 }} />;
  }
  if (state === "error") {
    return <Warning style={{ width: 11, height: 11, color: "rgba(248,113,113,0.7)", flexShrink: 0 }} />;
  }
  return <CircleDashed style={{ width: 11, height: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StreamingContextPanel({ parts, isStreaming, onClose }: StreamingContextPanelProps) {
  const [pinned, setPinned] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const steps = useMemo(() => extractSteps(parts), [parts]);
  const files = useMemo(() => extractFiles(steps), [steps]);

  const doneCount = steps.filter((s) => s.state === "done").length;
  const totalCount = steps.length;
  const hasError = steps.some((s) => s.state === "error");

  // Auto-collapse when streaming ends (unless pinned)
  useEffect(() => {
    if (!isStreaming && !pinned && totalCount > 0) {
      const t = setTimeout(() => setCollapsed(true), 2000);
      return () => clearTimeout(t);
    }
  }, [isStreaming, pinned, totalCount]);

  // Auto-expand when streaming restarts
  useEffect(() => {
    if (isStreaming) setCollapsed(false);
  }, [isStreaming]);

  if (totalCount === 0) return null;

  // ── Collapsed tab ──
  if (collapsed) {
    return (
      <div
        style={{
          width: 32,
          flexShrink: 0,
          borderLeft: "1px solid var(--ui-border-muted)",
          background: "var(--surface-hover)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 12,
          gap: 8,
          cursor: "pointer",
        }}
        onClick={() => setCollapsed(false)}
        title="Show activity"
      >
        <CaretLeft style={{ width: 12, height: 12, color: "rgba(255,255,255,0.25)" }} />
        <CheckCircle style={{ width: 13, height: 13, color: "rgba(74,222,128,0.5)" }} />
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            letterSpacing: "0.04em",
            fontWeight: 600,
          }}
        >
          {doneCount}/{totalCount}
        </span>
      </div>
    );
  }

  // ── Expanded panel ──
  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        borderLeft: "1px solid var(--ui-border-muted)",
        background: "rgba(255,255,255,0.015)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid var(--surface-hover)",
          flexShrink: 0,
        }}
      >
        {isStreaming ? (
          <div
            className="animate-spin"
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              border: "1.5px solid rgba(212,176,140,0.15)",
              borderTopColor: "rgba(212,176,140,0.8)",
              flexShrink: 0,
            }}
          />
        ) : hasError ? (
          <Warning style={{ width: 11, height: 11, color: "rgba(248,113,113,0.7)", flexShrink: 0 }} />
        ) : (
          <CheckCircle style={{ width: 11, height: 11, color: "rgba(74,222,128,0.6)", flexShrink: 0 }} />
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(236,236,236,0.55)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            flex: 1,
          }}
        >
          {isStreaming ? "Working…" : hasError ? "Stopped" : "Done"}
        </span>
        {totalCount > 0 && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>
            {doneCount}/{totalCount}
          </span>
        )}
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(255,255,255,0.2)", display: "flex" }}
          title="Collapse"
        >
          <CaretRight style={{ width: 11, height: 11 }} />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "rgba(255,255,255,0.2)", display: "flex" }}
            title="Close"
          >
            <X style={{ width: 11, height: 11 }} />
          </button>
        )}
      </div>

      {/* Steps list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {/* Tool steps */}
        <div style={{ padding: "0 12px 4px", marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Steps
          </span>
        </div>
        {steps.map((step, i) => (
          <div
            key={step.toolCallId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              borderLeft: `2px solid ${
                step.state === "running"
                  ? "rgba(212,176,140,0.4)"
                  : step.state === "done"
                  ? "rgba(74,222,128,0.3)"
                  : step.state === "error"
                  ? "rgba(248,113,113,0.4)"
                  : "var(--ui-border-muted)"
              }`,
              marginLeft: 12,
              marginBottom: 2,
              transition: "border-color 0.2s ease",
            }}
          >
            <StepIndicator state={step.state} />
            <span style={{ color: "rgba(255,255,255,0.22)", flexShrink: 0, display: "flex", alignItems: "center" }}>
              {getToolIcon(step.toolName)}
            </span>
            <span
              style={{
                fontSize: 12,
                color: step.state === "running"
                  ? "rgba(236,236,236,0.85)"
                  : step.state === "done"
                  ? "rgba(236,236,236,0.5)"
                  : "rgba(236,236,236,0.35)",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                transition: "color 0.2s ease",
              }}
            >
              {step.title}
            </span>
            {step.meta && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {step.meta}
              </span>
            )}
          </div>
        ))}

        {/* Files section */}
        {files.length > 0 && (
          <>
            <div style={{ padding: "12px 12px 4px", marginBottom: 2, marginTop: 4, borderTop: "1px solid var(--surface-hover)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Files touched
              </span>
            </div>
            {files.map(({ path, ops }) => {
              const fname = path.split("/").pop() ?? path;
              const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
              return (
                <div
                  key={path}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 7,
                    padding: "5px 12px",
                  }}
                >
                  <FolderOpen style={{ width: 11, height: 11, color: "rgba(212,176,140,0.4)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(236,236,236,0.55)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fname}
                    </div>
                    {dir && (
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.2)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {dir}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                    {ops.map((op) => (
                      <span
                        key={op}
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                          color: op === "Write" || op === "Edit" ? "rgba(212,176,140,0.65)" : "rgba(255,255,255,0.25)",
                          background: op === "Write" || op === "Edit" ? "rgba(212,176,140,0.08)" : "var(--surface-hover)",
                          padding: "1px 5px",
                          borderRadius: 3,
                        }}
                      >
                        {op.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer — pin toggle */}
      <div
        style={{
          borderTop: "1px solid var(--surface-hover)",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => setPinned((v) => !v)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: pinned ? "rgba(212,176,140,0.7)" : "rgba(255,255,255,0.22)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: 0,
          }}
          title={pinned ? "Unpin panel" : "Keep panel open after streaming"}
        >
          <Clock style={{ width: 10, height: 10 }} />
          {pinned ? "Pinned" : "Pin"}
        </button>
      </div>
    </div>
  );
}
