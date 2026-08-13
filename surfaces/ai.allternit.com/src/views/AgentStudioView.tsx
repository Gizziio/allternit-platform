"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Robot,
  Plus,
  Trash,
  Play,
  Code,
  Wrench,
  FloppyDisk,
  CheckCircle,
  X,
  Info,
  Lightning,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { createModuleLogger } from "@/lib/logger";

const logger = createModuleLogger("AgentStudioView");

type StudioTab = "agent" | "tools" | "run";

interface AgentConfig {
  name: string;
  description: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  tools: string[];
}

interface Toast {
  id: string;
  message: string;
  type: "error" | "success" | "info";
}

const DEFAULT_CONFIG: AgentConfig = {
  name: "My Agent",
  description: "",
  system_prompt: "You are a helpful Allternit agent.",
  model: "claude-sonnet-4-20250514",
  temperature: 0.7,
  max_tokens: 4096,
  tools: [],
};

const AVAILABLE_TOOLS = [
  { id: "web_search", name: "Web Search", description: "Search the web for current information." },
  { id: "bash", name: "Bash", description: "Run shell commands in a sandbox." },
  { id: "text_editor", name: "Text Editor", description: "Read and edit files." },
  { id: "computer_use", name: "Computer Use", description: "Control a desktop environment." },
  { id: "mcp_registry", name: "MCP Registry", description: "Use registered MCP tools." },
];

const MODELS = [
  "allternit-large",
  "allternit-reasoning",
  "allternit-fast",
  "allternit-vision",
  "allternit-mini",
];

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

export function AgentStudioView() {
  const [tab, setTab] = useState<StudioTab>("agent");
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [testMessage, setTestMessage] = useState("");
  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast["type"]) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateConfig = useCallback(<K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleTool = useCallback((toolId: string) => {
    setConfig((prev) => ({
      ...prev,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter((t) => t !== toolId)
        : [...prev.tools, toolId],
    }));
  }, []);

  const handleSave = useCallback(() => {
    // Phase 1: simulate save. In Phase 2 this will POST to /api/v1/agents.
    addToast(`Saved agent "${config.name}"`, "success");
  }, [config.name, addToast]);

  const handleRun = useCallback(async () => {
    if (!testMessage.trim()) {
      addToast("Enter a test message", "error");
      return;
    }
    setIsRunning(true);
    setRunOutput(null);
    try {
      const res = await fetch("/api/v1/agents/prototype", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          messages: [{ role: "user", content: testMessage }],
        }),
      });
      if (!res.ok) throw new Error("Prototype run failed");
      const data = await res.json();
      setRunOutput(JSON.stringify(data, null, 2));
      addToast("Prototype run completed", "success");
    } catch (err) {
      logger.error({ err }, "Agent studio run failed");
      // Phase 1 fallback: show the request payload so the surface works offline.
      setRunOutput(
        `// Prototype endpoint not yet implemented. Request payload:\n${JSON.stringify(
          { ...config, messages: [{ role: "user", content: testMessage }] },
          null,
          2
        )}`
      );
      addToast("Prototype endpoint not available; showing payload", "info");
    } finally {
      setIsRunning(false);
    }
  }, [config, testMessage, addToast]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--surface-canvas)] overflow-hidden">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-solid border-[var(--ui-border-muted)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-lg bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
            <Robot size={18} weight="fill" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-[var(--ui-text-primary)]">Agent Studio</h1>
            <p className="text-[12px] text-[var(--ui-text-secondary)]">Prototype, configure, and test Allternit agents</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-solid border-[var(--ui-border-muted)] bg-transparent text-[13px] font-semibold text-[var(--ui-text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            <FloppyDisk size={14} />
            Save
          </button>
          <button
            type="button"
            onClick={() => setTab("run")}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg border-none bg-[var(--accent-primary)] text-[var(--surface-canvas)] text-[13px] font-bold hover:opacity-90 cursor-pointer"
          >
            <Lightning size={14} weight="fill" />
            Test
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 py-2 border-b border-solid border-[var(--ui-border-muted)] shrink-0">
        <TabButton active={tab === "agent"} onClick={() => setTab("agent")} icon={Robot} label="Agent" />
        <TabButton active={tab === "tools"} onClick={() => setTab("tools")} icon={Wrench} label="Tools" />
        <TabButton active={tab === "run"} onClick={() => setTab("run")} icon={Play} label="Run" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          {tab === "agent" && (
            <motion.div
              key="agent"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4 max-w-3xl"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => updateConfig("name", e.target.value)}
                  className="px-3 py-2 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--accent-primary)]/50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={config.description}
                  onChange={(e) => updateConfig("description", e.target.value)}
                  placeholder="What does this agent do?"
                  className="px-3 py-2 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--accent-primary)]/50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">System prompt</label>
                <textarea
                  value={config.system_prompt}
                  onChange={(e) => updateConfig("system_prompt", e.target.value)}
                  className="w-full min-h-[160px] p-3 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] resize-none focus:outline-none focus:border-[var(--accent-primary)]/50"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">Model</label>
                  <select
                    value={config.model}
                    onChange={(e) => updateConfig("model", e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--accent-primary)]/50"
                  >
                    {MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">Temperature</label>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={config.temperature}
                    onChange={(e) => updateConfig("temperature", parseFloat(e.target.value))}
                    className="px-3 py-2 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--accent-primary)]/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">Max tokens</label>
                  <input
                    type="number"
                    min={1}
                    max={128000}
                    step={1}
                    value={config.max_tokens}
                    onChange={(e) => updateConfig("max_tokens", parseInt(e.target.value, 10))}
                    className="px-3 py-2 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] text-[13px] text-[var(--ui-text-primary)] focus:outline-none focus:border-[var(--accent-primary)]/50"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {tab === "tools" && (
            <motion.div
              key="tools"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4 max-w-3xl"
            >
              <p className="text-[13px] text-[var(--ui-text-secondary)]">Choose the tools this agent can use at runtime.</p>
              <div className="grid grid-cols-1 gap-2">
                {AVAILABLE_TOOLS.map((tool) => (
                  <label
                    key={tool.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border border-solid cursor-pointer transition-all",
                      config.tools.includes(tool.id)
                        ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/40"
                        : "bg-[var(--surface-hover)] border-[var(--ui-border-muted)] hover:border-[var(--accent-primary)]/30"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={config.tools.includes(tool.id)}
                      onChange={() => toggleTool(tool.id)}
                      className="accent-[var(--accent-primary)] mt-0.5"
                    />
                    <div>
                      <div className="text-[13px] font-bold text-[var(--ui-text-primary)]">{tool.name}</div>
                      <div className="text-[12px] text-[var(--ui-text-secondary)]">{tool.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "run" && (
            <motion.div
              key="run"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-4 max-w-3xl"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ui-text-secondary)] uppercase tracking-wider">Test message</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Send a message to the prototype agent…"
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
                  {isRunning ? "Running…" : "Run prototype"}
                </button>
              </div>
              {runOutput && (
                <div className="rounded-lg border border-solid border-[var(--ui-border-muted)] bg-black/30 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-solid border-[var(--ui-border-muted)]">
                    <Code size={14} className="text-[var(--ui-text-muted)]" />
                    <span className="text-[12px] font-semibold text-[var(--ui-text-secondary)]">Output</span>
                  </div>
                  <pre className="p-4 text-[12px] font-mono text-[var(--ui-text-primary)] overflow-auto max-h-[400px]">
                    {runOutput}
                  </pre>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
