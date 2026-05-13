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
    return <Terminal className="size-3.5" />;
  }
  if (name.includes("grep") || name.includes("search") || name.includes("glob") || name.includes("find")) {
    return <MagnifyingGlass className="size-3.5" />;
  }
  if (name.includes("web") || name.includes("fetch") || name.includes("url") || name.includes("browse")) {
    return <Globe className="size-3.5" />;
  }
  if (name.includes("write") || name.includes("edit") || name.includes("str") || name.includes("create")) {
    return <PencilSimple className="size-3.5" />;
  }
  return <FileText className="size-3.5" />;
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
      <div className="size-3 rounded-full border-2 border-[rgba(212,176,140,0.15)] border-t-[rgba(212,176,140,0.8)] animate-spin shrink-0" />
    );
  }
  if (state === "done") {
    return <CheckCircle className="size-3.5 text-[rgba(74,222,128,0.6)] shrink-0" />;
  }
  if (state === "error") {
    return <Warning className="size-3.5 text-[rgba(248,113,113,0.7)] shrink-0" />;
  }
  return <CircleDashed className="size-3.5 text-[rgba(255,255,255,0.2)] shrink-0" />;
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
        className="w-8 shrink-0 border-l border-[var(--ui-border-muted)] bg-[var(--surface-hover)] flex flex-col items-center pt-3 gap-2 cursor-pointer"
        onClick={() => setCollapsed(false)}
        title="Show activity"
      >
        <CaretLeft className="size-3.5 text-[rgba(255,255,255,0.25)]" />
        <CheckCircle className="size-3.5 text-[rgba(74,222,128,0.5)]" />
        <span className="text-[12px] text-[rgba(255,255,255,0.3)] [writing-mode:vertical-rl] [text-orientation:mixed] tracking-wider font-semibold">
          {doneCount}/{totalCount}
        </span>
      </div>
    );
  }

  // ── Expanded panel ──
  return (
    <div className="w-[260px] shrink-0 border-l border-[var(--ui-border-muted)] bg-white/[0.015] flex flex-col overflow-hidden text-[12px]">
      {/* Header */}
      <div className="flex items-center gap-2 p-2.5 px-3 border-b border-[var(--surface-hover)] shrink-0">
        {isStreaming ? (
          <div className="size-3 rounded-full border-2 border-[rgba(212,176,140,0.15)] border-t-[rgba(212,176,140,0.8)] animate-spin shrink-0" />
        ) : hasError ? (
          <Warning className="size-3.5 text-[rgba(248,113,113,0.7)] shrink-0" />
        ) : (
          <CheckCircle className="size-3.5 text-[rgba(74,222,128,0.6)] shrink-0" />
        )}
        <span className="text-[12px] font-semibold text-[rgba(236,236,236,0.55)] tracking-wider uppercase flex-1">
          {isStreaming ? "Working…" : hasError ? "Stopped" : "Done"}
        </span>
        {totalCount > 0 && (
          <span className="text-[12px] text-[rgba(255,255,255,0.25)] tabular-nums">
            {doneCount}/{totalCount}
          </span>
        )}
        <button
          onClick={() => setCollapsed(true)}
          className="bg-transparent border-none p-0.5 text-white/20 cursor-pointer flex"
          title="Collapse"
        >
          <CaretRight className="size-3" />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="bg-transparent border-none p-0.5 text-white/20 cursor-pointer flex"
            title="Close"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Tool steps */}
        <div className="p-3 py-1 mb-1">
          <span className="text-[12px] font-semibold text-white/20 tracking-widest uppercase">
            Steps
          </span>
        </div>
        {steps.map((step) => (
          <div
            key={step.toolCallId}
            className={`flex items-center gap-2 p-1.5 px-3 ml-3 mb-0.5 transition-[border-color] duration-200 border-l-2 ${
              step.state === "running"
                ? "border-[rgba(212,176,140,0.4)]"
                : step.state === "done"
                ? "border-[rgba(74,222,128,0.3)]"
                : step.state === "error"
                ? "border-[rgba(248,113,113,0.4)]"
                : "border-[var(--ui-border-muted)]"
            }`}
          >
            <StepIndicator state={step.state} />
            <span className="text-white/20 shrink-0 flex items-center">
              {getToolIcon(step.toolName)}
            </span>
            <span className={`text-[12px] flex-1 truncate transition-colors duration-200 ${
              step.state === "running"
                ? "text-[rgba(236,236,236,0.85)]"
                : step.state === "done"
                ? "text-[rgba(236,236,236,0.5)]"
                : "text-[rgba(236,236,236,0.35)]"
            }`}>
              {step.title}
            </span>
            {step.meta && (
              <span className="text-[12px] text-white/20 shrink-0 tabular-nums">
                {step.meta}
              </span>
            )}
          </div>
        ))}

        {/* Files section */}
        {files.length > 0 && (
          <>
            <div className="p-3 py-1 mb-0.5 mt-1 border-t border-[var(--surface-hover)]">
              <span className="text-[12px] font-semibold text-white/20 tracking-widest uppercase">
                Files touched
              </span>
            </div>
            {files.map(({ path, ops }) => {
              const fname = path.split("/").pop() ?? path;
              const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
              return (
                <div
                  key={path}
                  className="flex items-start gap-2 p-1.5 px-3"
                >
                  <FolderOpen className="size-3 text-[rgba(212,176,140,0.4)] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[rgba(236,236,236,0.55)] truncate">
                      {fname}
                    </div>
                    {dir && (
                      <div className="text-[12px] text-white/20 truncate">
                        {dir}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {ops.map((op) => (
                      <span
                        key={op}
                        className={`text-[12px] font-semibold tracking-wider p-0.5 px-1.5 rounded-[3px] ${
                          op === "Write" || op === "Edit" 
                            ? "text-[rgba(212,176,140,0.65)] bg-[rgba(212,176,140,0.08)]" 
                            : "text-[rgba(255,255,255,0.25)] bg-[var(--surface-hover)]"
                        }`}
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
      <div className="border-t border-[var(--surface-hover)] p-1.5 px-3 flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => setPinned((v) => !v)}
          className={`bg-transparent border-none p-0 cursor-pointer flex items-center gap-1 text-[12px] font-semibold tracking-wider uppercase transition-colors ${
            pinned ? "text-[rgba(212,176,140,0.7)]" : "text-white/20"
          }`}
          title={pinned ? "Unpin panel" : "Keep panel open after streaming"}
        >
          <Clock className="size-3" />
          {pinned ? "Pinned" : "Pin"}
        </button>
      </div>
    </div>
  );
}
