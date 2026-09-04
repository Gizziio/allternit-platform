"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  MagnifyingGlass,
  ClockCounterClockwise,
  Toolbox,
  Terminal,
  Lightning,
  X,
  Info,
  CheckCircle,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { createModuleLogger } from "@/lib/logger";
import { isBetaApiEnabled } from "@/lib/env";

const logger = createModuleLogger("AllternitPlaygroundView");

// The playground targets /api/v1/beta/sessions/*, served only by the Rust
// allternit-api (:8013) — disabled by default on the deployed web surface.
const BETA_PLAYGROUND_DISABLED_TOAST =
  "Playground is disabled in this deployment (the beta sessions API is not publicly reachable).";

type PlaygroundTab = "prompt" | "memory" | "tools" | "events";

interface MemoryResult {
  section: string;
  line: number;
  excerpt: string;
  score: number;
}

interface SessionEvent {
  id: string;
  type: string;
  created_at: string;
  data: Record<string, unknown>;
}

interface Toast {
  id: string;
  message: string;
  type: "error" | "success" | "info";
}

const api = {
  async searchSessionMemory(sessionId: string, query: string): Promise<{ results: MemoryResult[] }> {
    const res = await fetch(`/api/v1/beta/sessions/${encodeURIComponent(sessionId)}/memory/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error("Failed to search session memory");
    return res.json();
  },
  async listSessionEvents(sessionId: string): Promise<{ events: SessionEvent[] }> {
    const res = await fetch(`/api/v1/beta/sessions/${encodeURIComponent(sessionId)}/events/list`);
    if (!res.ok) throw new Error("Failed to fetch session events");
    return res.json();
  },
  async runPrompt(sessionId: string, body: { messages: unknown[]; tools?: string[] }) {
    const res = await fetch(`/api/v1/beta/sessions/${encodeURIComponent(sessionId)}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to run prompt");
    return res.json();
  },
};

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border-none cursor-pointer",
        active
          ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
          : "text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ui-text-primary)]"
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-5 right-5 z-[160] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className={cn(
              "p-3 px-4 rounded-xl text-[13px] font-semibold shadow-xl flex items-center gap-2.5 pointer-events-auto min-w-[280px] max-w-[400px]",
              toast.type === "error" ? "bg-[var(--status-error)]" : toast.type === "success" ? "bg-[var(--status-success)]" : "bg-[var(--status-info)]",
              "text-[var(--ui-text-inverse)]"
            )}
          >
            {toast.type === "success" && <CheckCircle size={18} weight="fill" />}
            {toast.type === "info" && <Info size={18} weight="fill" />}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => onRemove(toast.id)}
              className="bg-transparent border-none text-[var(--ui-text-inverse)] cursor-pointer opacity-70 hover:opacity-100 transition-opacity p-0.5"
            >
              <X size={14} weight="bold" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function AllternitPlaygroundView() {
  const [tab, setTab] = useState<PlaygroundTab>("prompt");
  const [sessionId, setSessionId] = useState("");
  const [query, setQuery] = useState("");
  const [memoryResults, setMemoryResults] = useState<MemoryResult[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful Allternit agent.");
  const [userPrompt, setUserPrompt] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleSearchMemory = useCallback(async () => {
    if (!sessionId.trim() || !query.trim()) return;
    if (!isBetaApiEnabled()) {
      addToast(BETA_PLAYGROUND_DISABLED_TOAST, "error");
      setMemoryResults([]);
      return;
    }
    try {
      const data = await api.searchSessionMemory(sessionId, query);
      setMemoryResults(data.results || []);
    } catch (err) {
      logger.error({ err }, "Session memory search failed");
      addToast("Failed to search session memory", "error");
      setMemoryResults([]);
    }
  }, [sessionId, query, addToast]);

  const handleLoadEvents = useCallback(async () => {
    if (!sessionId.trim()) return;
    if (!isBetaApiEnabled()) {
      // Deliberate empty state — the auto-load effect on the events tab hits
      // this too, so never fire /api/v1/beta/sessions/:id/events/list.
      setEvents([]);
      return;
    }
    try {
      const data = await api.listSessionEvents(sessionId);
      setEvents(data.events || []);
    } catch (err) {
      logger.error({ err }, "Failed to load session events");
      addToast("Failed to load session events", "error");
      setEvents([]);
    }
  }, [sessionId, addToast]);

  const handleRun = useCallback(async () => {
    if (!sessionId.trim() || !userPrompt.trim()) {
      addToast("Session ID and user prompt are required", "error");
      return;
    }
    if (!isBetaApiEnabled()) {
      addToast(BETA_PLAYGROUND_DISABLED_TOAST, "error");
      return;
    }
    setIsRunning(true);
    setRunOutput(null);
    try {
      const body = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: selectedTools.length > 0 ? selectedTools : undefined,
      };
      const data = await api.runPrompt(sessionId, body);
      setRunOutput(JSON.stringify(data, null, 2));
      addToast("Run completed", "success");
    } catch (err) {
      logger.error({ err }, "Playground run failed");
      addToast("Run failed", "error");
    } finally {
      setIsRunning(false);
    }
  }, [sessionId, userPrompt, systemPrompt, selectedTools, addToast]);

  useEffect(() => {
    if (tab === "events" && sessionId.trim()) {
      handleLoadEvents();
    }
  }, [tab, sessionId, handleLoadEvents]);

  const toolOptions = ["web_search", "bash", "text_editor", "computer_use", "mcp_registry"];

  return (
    <div className="flex flex-col h-full w-full bg-[var(--surface-canvas)] overflow-hidden">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-solid border-[var(--ui-border-muted)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
            <Lightning size={18} weight="fill" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[var(--ui-text-primary)]">Allternit Playground</h1>
            <p className="text-[12px] text-[var(--ui-text-secondary)]">Debug agents, search session memory, and replay events</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Session ID"
            className="px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] min-w-[220px] focus:outline-none focus:border-[var(--accent-primary)]/50"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-solid border-[var(--ui-border-muted)] shrink-0">
        <TabButton active={tab === "prompt"} onClick={() => setTab("prompt")} icon={Terminal} label="Prompt" />
        <TabButton active={tab === "memory"} onClick={() => setTab("memory")} icon={MagnifyingGlass} label="Memory" />
        <TabButton active={tab === "tools"} onClick={() => setTab("tools")} icon={Toolbox} label="Tools" />
        <TabButton active={tab === "events"} onClick={() => setTab("events")} icon={ClockCounterClockwise} label="Events" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {tab === "prompt" && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4 max-w-4xl"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">System instruction</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full min-h-[100px] p-3 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]/50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">User message</label>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Enter a message to send to the agent…"
                  className="w-full min-h-[120px] p-3 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]/50"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={isRunning}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border-none text-[13px] font-bold cursor-pointer transition-all",
                    isRunning
                      ? "bg-[var(--ui-border-muted)] text-[var(--ui-text-muted)]"
                      : "bg-[var(--accent-primary)] text-[var(--surface-canvas)] hover:opacity-90"
                  )}
                >
                  <Play size={14} weight="fill" />
                  {isRunning ? "Running…" : "Run"}
                </button>
                <button
                  type="button"
                  onClick={() => setRunOutput(null)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-solid border-[var(--ui-border-muted)] bg-transparent text-[13px] font-semibold text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <ArrowCounterClockwise size={14} />
                  Clear output
                </button>
              </div>
              {runOutput && (
                <pre className="p-4 rounded-lg bg-black/30 border border-solid border-[var(--ui-border-muted)] text-[12px] font-mono text-[var(--ui-text-primary)] overflow-auto max-h-[400px]">
                  {runOutput}
                </pre>
              )}
            </motion.div>
          )}

          {tab === "memory" && (
            <motion.div
              key="memory"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4 max-w-4xl"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchMemory()}
                  placeholder="Search session memory…"
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--accent-primary)]/50"
                />
                <button
                  type="button"
                  onClick={handleSearchMemory}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--surface-canvas)] text-[13px] font-bold hover:opacity-90 cursor-pointer"
                >
                  <MagnifyingGlass size={14} weight="bold" />
                  Search
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {memoryResults.length === 0 && query && (
                  <p className="text-[13px] text-[var(--ui-text-muted)]">No matches found.</p>
                )}
                {memoryResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-bold text-[var(--ui-text-primary)]">{result.section}</span>
                      <span className="text-[11px] text-[var(--ui-text-muted)]">Line {result.line}</span>
                    </div>
                    <p className="text-[12px] text-[var(--ui-text-secondary)] leading-relaxed">{result.excerpt}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "tools" && (
            <motion.div
              key="tools"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4 max-w-4xl"
            >
              <p className="text-[13px] text-[var(--ui-text-secondary)]">Select tools to attach to playground runs.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {toolOptions.map((tool) => (
                  <label
                    key={tool}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border border-solid cursor-pointer transition-all",
                      selectedTools.includes(tool)
                        ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40"
                        : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] hover:border-[var(--accent-primary)]/30"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTools.includes(tool)}
                      onChange={(e) => {
                        setSelectedTools((prev) =>
                          e.target.checked ? [...prev, tool] : prev.filter((t) => t !== tool)
                        );
                      }}
                      className="accent-[var(--accent-primary)]"
                    />
                    <span className="text-[13px] font-semibold text-[var(--ui-text-primary)]">{tool}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "events" && (
            <motion.div
              key="events"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-2 max-w-4xl"
            >
              {events.length === 0 && (
                <p className="text-[13px] text-[var(--ui-text-muted)]">No events loaded. Enter a session ID to load events.</p>
              )}
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-3 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-bold text-[var(--accent-primary)]">{event.type}</span>
                    <span className="text-[11px] text-[var(--ui-text-muted)]">{event.created_at}</span>
                  </div>
                  <pre className="text-[11px] font-mono text-[var(--ui-text-secondary)] overflow-auto">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
