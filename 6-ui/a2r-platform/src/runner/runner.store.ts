/**
 * Runner Store - Updated to use API Client
 * 
 * This store manages the agent runner UI state and execution.
 * It now uses the api-client for all backend communication.
 */

import { create } from "zustand";
import type { RunnerRun, RunnerTraceEntry } from "./runner.types";
import { api } from "../integration/api-client";

// Storage key for session persistence
const STORAGE_KEY = 'a2r-agent-runner-session';

// Session TTL: 24 hours in milliseconds
const SESSION_TTL = 24 * 60 * 60 * 1000;

// Saved session interface
interface SavedSession {
  activeRun?: RunnerRun;
  trace: RunnerTraceEntry[];
  draft: string;
  agentEnabled: boolean;
  modelId: string;
  timestamp: number;
}

// Electron IPC bridge
declare global {
  interface Window {
    a2AgentRunner?: {
      setExpanded(expanded: boolean): Promise<void>;
      close(): Promise<void>;
    };
  }
}

export const useRunnerStore = create<{
  open: boolean;
  mode: "compact" | "expanded";
  draft: string;
  modelId: string;
  activeRun?: RunnerRun;
  trace: RunnerTraceEntry[];
  isCancelled: boolean;
  isLoading: boolean;
  abortController?: AbortController;
  agentEnabled: boolean;

  openCompact: () => void;
  close: () => void;
  toggle: () => void;

  setDraft: (t: string) => void;
  setModelId: (id: string) => void;
  setAgentEnabled: (enabled: boolean) => void;
  submit: () => Promise<void>;
  cancel: () => void;
  clearTrace: () => void;
  appendTrace: (entry: Omit<RunnerTraceEntry, "id" | "timestamp"> & { id?: string; timestamp?: number }) => void;
  loadSession: () => void;
  saveSession: () => void;
}>((set, get) => ({
  isCancelled: false,
  isLoading: false,
  open: false,
  mode: "compact",
  draft: "",
  modelId: "gpt-4o",
  trace: [],
  agentEnabled: false,

  openCompact: () => set({ open: true, mode: "compact" }),
  close: async () => {
    // Clear session from localStorage when explicitly closing
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    set({ open: false, mode: "compact", draft: "", activeRun: undefined, trace: [], isLoading: false });
    // Actually destroy the window via IPC
    if (typeof window !== 'undefined' && window.a2AgentRunner) {
      try {
        await window.a2AgentRunner.close();
      } catch {
        // Ignore IPC errors
      }
    }
  },
  toggle: async () => {
    const newMode = get().mode === "compact" ? "expanded" : "compact";
    set({ mode: newMode });
    // Resize window via IPC
    if (typeof window !== 'undefined' && window.a2AgentRunner) {
      try {
        await window.a2AgentRunner.setExpanded(newMode === "expanded");
      } catch {
        // Ignore IPC errors
      }
    }
  },

  setDraft: (t) => {
    set({ draft: t });
    // Debounced save will be triggered by component or can be added here
    get().saveSession();
  },
  clearTrace: () => {
    set({ trace: [] });
    get().saveSession();
  },
  appendTrace: (entry) => {
    set((s) => ({
      trace: [
        ...s.trace,
        {
          id: entry.id ?? crypto.randomUUID(),
          timestamp: entry.timestamp ?? Date.now(),
          kind: entry.kind,
          title: entry.title,
          detail: entry.detail,
          status: entry.status,
        },
      ],
    }));
    get().saveSession();
  },

  setModelId: (id: string) => {
    set({ modelId: id });
    get().saveSession();
  },
  setAgentEnabled: (enabled: boolean) => {
    set({ agentEnabled: enabled });
    get().saveSession();
  },

  cancel: () => {
    const { abortController, activeRun } = get();
    if (abortController) {
      abortController.abort();
    }
    set({ 
      isCancelled: true,
      isLoading: false,
      activeRun: activeRun ? { ...activeRun, state: "cancelled" } : undefined 
    });
    get().saveSession();
  },

  loadSession: () => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const session: SavedSession = JSON.parse(stored);
      
      // Check if session has expired (24 hours)
      if (Date.now() - session.timestamp > SESSION_TTL) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      
      // Only restore if there's actual content
      if (session.trace?.length > 0 || session.activeRun) {
        set({
          activeRun: session.activeRun,
          trace: session.trace || [],
          draft: session.draft || '',
          agentEnabled: session.agentEnabled ?? false,
          modelId: session.modelId || 'gpt-4o',
        });
      }
    } catch (error) {
      // Gracefully handle JSON parse errors
      console.warn('Failed to load agent runner session:', error);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
  },

  saveSession: () => {
    if (typeof window === 'undefined') return;
    
    const state = get();
    
    // Only save if there's actual content
    if (!state.trace?.length && !state.activeRun) {
      return;
    }
    
    const session: SavedSession = {
      activeRun: state.activeRun,
      trace: state.trace,
      draft: state.draft,
      agentEnabled: state.agentEnabled,
      modelId: state.modelId,
      timestamp: Date.now(),
    };
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      // Gracefully handle storage errors (e.g., quota exceeded)
      console.warn('Failed to save agent runner session:', error);
    }
  },

  submit: async () => {
    const { draft, modelId } = get();
    if (!draft.trim()) return;

    const abortController = new AbortController();
    const run: RunnerRun = { 
      id: crypto.randomUUID(), 
      prompt: draft.trim(), 
      state: "thinking", 
      startedAt: Date.now(), 
      output: "" 
    };
    set({ 
      activeRun: run, 
      mode: "expanded", 
      trace: [], 
      draft: "",
      isCancelled: false,
      isLoading: true,
      abortController,
    });
    
    // Resize window to expanded mode via IPC
    if (typeof window !== 'undefined' && window.a2AgentRunner) {
      try {
        await window.a2AgentRunner.setExpanded(true);
      } catch {
        // Ignore IPC errors
      }
    }
    get().appendTrace({
      kind: "info",
      title: "Run started",
      detail: run.prompt,
      status: "running",
    });

    // Model routing: use chat API for AI models, shell execution for direct commands
    const isAiModel = modelId && modelId !== 'shell' && modelId !== 'direct';
    
    if (isAiModel) {
      // Use AI chat API with model selection
      get().appendTrace({
        kind: "info",
        title: `AI Chat (${modelId})`,
        detail: "Sending to kernel for processing...",
        status: "running",
      });

      const chatId = `runner-${run.id}`;
      let fullResponse = "";

      try {
        await api.chat({
          message: draft.trim(),
          chatId,
          modelId,
          onEvent: (event: Record<string, unknown>) => {
            if (event.type === 'content_block_delta') {
              const delta = event.delta as { text?: string } | undefined;
              if (delta?.text) {
                fullResponse += delta.text;
                set((s) => ({
                  activeRun: s.activeRun
                    ? { ...s.activeRun, output: fullResponse }
                    : s.activeRun,
                }));
              }
            } else if (event.type === 'message_stop') {
              if (!get().isCancelled) {
                set((s) => ({
                  activeRun: s.activeRun
                    ? { ...s.activeRun, state: "complete" }
                    : s.activeRun,
                }));
              }
            } else if (event.type === 'error') {
              const errorMsg = event.error as string | undefined;
              set((s) => ({
                activeRun: s.activeRun
                  ? { ...s.activeRun, state: "error", output: errorMsg || "Unknown error" }
                  : s.activeRun,
              }));
            }
          },
        });

        get().appendTrace({
          kind: "info",
          title: "AI response complete",
          detail: fullResponse.slice(0, 200) + (fullResponse.length > 200 ? "..." : ""),
          status: "success",
        });
        set({ isLoading: false });
      } catch (error: any) {
        set({ isLoading: false });
        set((s) => ({
          activeRun: s.activeRun
            ? { ...s.activeRun, state: "error", output: error.message }
            : s.activeRun,
        }));
        get().appendTrace({
          kind: "error",
          title: "Chat error",
          detail: error.message,
          status: "error",
        });
      }
    } else {
      // Direct shell execution (original behavior)
      try {
        get().appendTrace({
          kind: "tool",
          title: "Tool: shell",
          detail: draft,
          status: "running",
        });

        const response = await api.executeTool("shell", { command: draft }) as { 
          success: boolean; 
          output?: string; 
          error?: string; 
        };

        set((s) => ({
          activeRun: s.activeRun
            ? { 
                ...s.activeRun, 
                state: response.success ? "complete" : "error", 
                output: response.output || response.error || "No output"
              }
            : s.activeRun,
        }));
        get().appendTrace({
          kind: response.success ? "info" : "error",
          title: response.success ? "Tool completed" : "Tool failed",
          detail: response.output || response.error || "No output",
          status: response.success ? "success" : "error",
        });
        set({ isLoading: false });
      } catch (error: any) {
        set({ isLoading: false });
        set((s) => ({
          activeRun: s.activeRun
            ? { ...s.activeRun, state: "error", output: error.message }
            : s.activeRun,
        }));
        get().appendTrace({
          kind: "error",
          title: "Execution error",
          detail: error.message,
          status: "error",
        });
      }
    }
  },
}));
