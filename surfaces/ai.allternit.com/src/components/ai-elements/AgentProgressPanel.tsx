/**
 * AgentProgressPanel — Right-side 3-section panel during agentic streaming.
 *
 * Sections (matches Claude Code's right panel exactly):
 *   1. Progress   — High-level named tasks with live status (not raw tool names)
 *   2. Working Folder — Inferred directory from file operations
 *   3. Context    — Files that have been read into context
 *
 * Auto-shows when the streaming message has tool calls.
 * Each task item has a hover "+" to ask about it (artifact interaction).
 */

"use client";

import React, { memo, useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Warning,
  FolderOpen,
  FileText,
  Plus,
  X,
} from '@phosphor-icons/react';
import { InlineSpinner } from "@/components/ai-elements/inline-spinner";
import type { ChatMessage } from "@/lib/ai/rust-stream-adapter";
import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressTask {
  id: string;
  label: string;
  state: "pending" | "running" | "complete" | "error";
  toolName: string;
}

interface AgentProgressPanelProps {
  message:     ChatMessage | null;
  isStreaming:  boolean;
  onClose?:    () => void;
  /** Called when user clicks + on a task item to ask a question about it */
  onAskAbout?: (task: ProgressTask) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert raw tool name → human-readable task label */
function toolLabel(toolName: string): string {
  const n = toolName.toLowerCase();
  if (/bash|shell|exec|cmd/.test(n))             return "Running command";
  if (/web_?search|websearch|search/.test(n))    return "Searching the web";
  if (/web_?fetch|webfetch|fetch|browse/.test(n))return "Fetching page";
  if (/read_?file|readfile|read/.test(n))        return "Reading file";
  if (/list_?files|listfiles|glob|ls/.test(n))   return "Listing files";
  if (/write_?file|writefile|write/.test(n))     return "Writing file";
  if (/edit|apply_?patch|applypatch/.test(n))    return "Editing file";
  if (/create|mkdir/.test(n))                    return "Creating file";
  if (/agent|spawn|delegate/.test(n))            return "Spawning sub-agent";
  // Title-case the raw name as fallback
  return toolName
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Append argument context to make the label more specific */
function enrichLabel(label: string, input: unknown): string {
  if (!input || typeof input !== "object") return label;
  const inp = input as Record<string, unknown>;
  // For file operations, append the filename
  const filePath = inp.path ?? inp.file_path ?? inp.filename ?? inp.file;
  if (typeof filePath === "string") {
    const basename = filePath.split("/").pop() ?? filePath;
    if (basename.length < 60) return `${label}: ${basename}`;
  }
  // For commands, append the command
  const cmd = inp.command ?? inp.cmd;
  if (typeof cmd === "string") {
    const short = cmd.length > 40 ? cmd.slice(0, 37) + "…" : cmd;
    return `${label}: ${short}`;
  }
  // For searches, append the query
  const query = inp.query ?? inp.q;
  if (typeof query === "string") {
    const short = query.length > 40 ? query.slice(0, 37) + "…" : query;
    return `${label}: ${short}`;
  }
  return label;
}

/** Infer the working directory from file path arguments */
function inferWorkingFolder(parts: ExtendedUIPart[]): string | null {
  for (const part of [...parts].reverse()) {
    if (part.type !== "dynamic-tool") continue;
    const p = part as any;
    const input = p.input ?? {};
    for (const val of Object.values(input)) {
      if (typeof val !== "string") continue;
      // Absolute path: extract the parent dir
      const abs = val.match(/^((?:\/[^/\n]+)+)\//);
      if (abs) return abs[1];
      // Relative: extract dir prefix
      const rel = val.match(/^([\w.-]+(?:\/[\w.-]+)+)\//);
      if (rel) return rel[1];
    }
  }
  return null;
}

/** Extract unique files that have been read into context */
function extractContextFiles(parts: ExtendedUIPart[]): string[] {
  const files: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (part.type !== "dynamic-tool") continue;
    const p = part as any;
    const n = (p.toolName ?? "").toLowerCase();
    if (!/read|glob|ls|list|cat|view|open/.test(n)) continue;
    if (p.state !== "output-available") continue;
    const input = p.input ?? {};
    for (const val of Object.values(input)) {
      if (typeof val !== "string") continue;
      const basename = val.split("/").pop() ?? val;
      if (basename && !seen.has(basename) && basename.includes(".")) {
        seen.add(basename);
        files.push(basename);
      }
    }
  }
  return files.slice(0, 12); // cap for display
}

/** Build task list from dynamic-tool parts */
function buildTasks(parts: ExtendedUIPart[]): ProgressTask[] {
  const tasks: ProgressTask[] = [];
  let idx = 0;
  for (const part of parts) {
    if (part.type !== "dynamic-tool") continue;
    const p = part as any;
    const state: ProgressTask["state"] =
      p.state === "input-streaming" || p.state === "input-available"
        ? "running"
        : p.state === "output-error"
        ? "error"
        : "complete";
    const base = toolLabel(p.toolName ?? "tool");
    const label = enrichLabel(base, p.input ?? {});
    tasks.push({
      id: p.toolCallId ?? `task-${idx}`,
      label,
      state,
      toolName: p.toolName ?? "",
    });
    idx++;
  }
  return tasks;
}

function extractParts(message: ChatMessage | null): ExtendedUIPart[] {
  if (!message || !Array.isArray(message.content)) return [];
  return message.content as ExtendedUIPart[];
}

// ─── Task row ─────────────────────────────────────────────────────────────────

const TaskRow = memo(function TaskRow({
  task,
  onAskAbout,
}: {
  task: ProgressTask;
  onAskAbout?: (t: ProgressTask) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2 py-1.5 border-b border-[var(--surface-hover)] relative"
    >
      {/* State icon */}
      <div className="shrink-0 size-4 flex justify-center items-center">
        {task.state === "running" ? (
          <InlineSpinner size={12} color="rgba(212,176,140,0.9)" />
        ) : task.state === "error" ? (
          <Warning className="size-3.5 text-[rgba(248,113,113,0.75)]" />
        ) : (
          <CheckCircle className="size-3.5 text-[rgba(74,222,128,0.55)]" />
        )}
      </div>

      {/* Label */}
      <span className={`flex-1 truncate font-mono text-[12px] tracking-tight transition-colors duration-200 ${
        task.state === "running"
          ? "font-medium text-[rgba(212,176,140,0.88)]"
          : task.state === "error"
          ? "text-[rgba(248,113,113,0.7)]"
          : "text-white/40"
      }`}>
        {task.label}
      </span>

      {/* + button on hover — ask about this task */}
      <AnimatePresence>
        {hovered && onAskAbout && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.1 }}
            onClick={() => onAskAbout(task)}
            className="size-5 rounded-md border border-[var(--ui-border-default)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] flex items-center justify-center cursor-pointer shrink-0 text-[rgba(212,176,140,0.8)]"
          >
            <Plus className="size-3" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-[12px] font-bold tracking-widest uppercase text-white/20 mb-2 mt-0.5">
      {label}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const AgentProgressPanel = memo(function AgentProgressPanel({
  message,
  isStreaming,
  onClose,
  onAskAbout,
}: AgentProgressPanelProps) {
  const parts = useMemo(() => extractParts(message), [message]);
  const tasks = useMemo(() => buildTasks(parts), [parts]);
  const workingFolder = useMemo(() => inferWorkingFolder(parts), [parts]);
  const contextFiles = useMemo(() => extractContextFiles(parts), [parts]);

  const runningCount  = tasks.filter(t => t.state === "running").length;
  const completeCount = tasks.filter(t => t.state === "complete").length;
  const errorCount    = tasks.filter(t => t.state === "error").length;

  if (tasks.length === 0 && !isStreaming) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, width: 0 }}
      animate={{ opacity: 1, x: 0, width: 260 }}
      exit={{ opacity: 0, x: 20, width: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="h-full w-[260px] min-w-[260px] shrink-0 border-l border-[var(--ui-border-muted)] bg-[rgba(6,6,8,0.6)] backdrop-blur-2xl flex flex-col overflow-hidden"
    >
      {/* ── Panel header ── */}
      <div className="flex items-center gap-2 p-3 px-4 border-b border-[var(--surface-hover)] shrink-0">
        {runningCount > 0 ? (
          <InlineSpinner size={12} color="rgba(212,176,140,0.75)" />
        ) : (
          <CheckCircle className="size-3.5 text-[rgba(74,222,128,0.5)]" />
        )}
        <span className="flex-1 text-[12px] font-bold tracking-widest uppercase text-[rgba(212,176,140,0.6)]">
          {runningCount > 0 ? "Running" : "Complete"}
        </span>
        <div className="flex gap-1.5 items-center">
          {completeCount > 0 && (
            <span className="text-[12px] text-[rgba(74,222,128,0.5)] font-semibold">
              {completeCount}✓
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-[12px] text-[rgba(248,113,113,0.65)] font-semibold">
              {errorCount}✗
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="bg-transparent border-none p-0.5 text-white/20 cursor-pointer flex items-center"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-3 px-4">

        {/* ── Section 1: Progress (task list) ── */}
        <SectionHeader label="Progress" />
        {tasks.length === 0 && isStreaming ? (
          <div className="flex items-center gap-2 py-2 text-white/20 text-[12px]">
            <InlineSpinner size={12} color="rgba(212,176,140,0.5)" />
            Preparing…
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} onAskAbout={onAskAbout} />
            ))}
          </AnimatePresence>
        )}

        {/* ── Section 2: Working Folder ── */}
        {workingFolder && (
          <div className="mt-5">
            <SectionHeader label="Working Folder" />
            <div className="flex items-center gap-2">
              <FolderOpen className="size-3.5 text-white/20 shrink-0" />
              <span className="text-[12px] text-white/40 font-mono truncate">
                {workingFolder}
              </span>
            </div>
          </div>
        )}

        {/* ── Section 3: Context files ── */}
        {contextFiles.length > 0 && (
          <div className="mt-5">
            <SectionHeader label="Context" />
            <div className="flex flex-col gap-1">
              {contextFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FileText className="size-3 text-[rgba(74,222,128,0.35)] shrink-0" />
                  <span className="text-[12px] text-white/30 font-mono truncate">
                    {file}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
});
