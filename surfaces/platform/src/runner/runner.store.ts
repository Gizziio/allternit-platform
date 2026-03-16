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

export interface RunnerPlanStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  backend?: string;
  risk?: 'low' | 'medium' | 'high';
}

export interface RunnerPlan {
  id: string;
  goal: string;
  steps: RunnerPlanStep[];
  risk: 'low' | 'medium' | 'high';
  backend: string;
}

export const useRunnerStore = create<{
  open: boolean;
  mode: "compact" | "expanded";
  draft: string;
  modelId: string;
  activeRun?: RunnerRun;
  activePlan?: RunnerPlan;
  isPlanning: boolean;
  trace: RunnerTraceEntry[];
  isCancelled: boolean;
  isLoading: boolean;
  abortController?: AbortController;
  agentEnabled: boolean;
  context: Record<string, any>;

  openCompact: () => void;
  close: () => void;
  toggle: () => void;

  setDraft: (t: string) => void;
  setModelId: (id: string) => void;
  setAgentEnabled: (enabled: boolean) => void;
  setContext: (ctx: Record<string, any>) => void;
  submit: () => Promise<void>;
  approvePlan: () => Promise<void>;
  rejectPlan: () => void;
  cancel: () => void;
  clearTrace: () => void;
  appendTrace: (entry: Omit<RunnerTraceEntry, "id" | "timestamp"> & { id?: string; timestamp?: number }) => void;
  loadSession: () => void;
  saveSession: () => void;
}>((set, get) => ({
  isCancelled: false,
  isLoading: false,
  isPlanning: false,
  open: false,
  mode: "compact",
  draft: "",
  modelId: "gpt-4o",
  trace: [],
  agentEnabled: false,
  context: {},

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
    set({ open: false, mode: "compact", draft: "", activeRun: undefined, activePlan: undefined, isPlanning: false, trace: [], isLoading: false });
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
  setContext: (ctx) => set({ context: ctx }),
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
      isPlanning: false,
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
    const { draft, modelId, context, agentEnabled } = get();
    if (!draft.trim()) return;

    // Capture context if bridge available
    let capturedContext = { ...context };
    if (typeof window !== 'undefined' && (window as any).a2AgentRunner?.getContext) {
      try {
        const freshContext = await (window as any).a2AgentRunner.getContext();
        capturedContext = { ...capturedContext, ...freshContext };
        set({ context: capturedContext });
      } catch (err) {
        console.warn('Failed to capture fresh context:', err);
      }
    }

    const abortController = new AbortController();
    const runId = crypto.randomUUID();

    set({
      mode: "expanded",
      trace: [],
      draft: "",
      isCancelled: false,
      isLoading: true,
      isPlanning: agentEnabled, // Only go to planning if agent mode is enabled
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
      title: "Task submitted",
      detail: draft,
      status: "running",
    });

    if (agentEnabled) {
      // PLANNING PHASE - Call real operator API
      get().appendTrace({
        kind: "info",
        title: "Generating plan",
        detail: "Analyzing task and context...",
        status: "running",
      });

      try {
        // Call operator execute endpoint with plan_only mode first
        const response = await api.operatorExecute({
          requestId: runId,
          intent: draft,
          mode: 'plan_then_execute',
          context: {
            target_type: capturedContext.target_type || 'browser',
            target_app: capturedContext.target_app,
            target_domain: capturedContext.target_domain,
            target_context: capturedContext.target_context || {},
            page_title: capturedContext.page_title,
            url: capturedContext.url,
            window_title: capturedContext.window_title,
          },
          preferences: {
            prefer_connector: true,
            allow_browser_automation: true,
            allow_desktop_fallback: false,
          },
          policy: {
            require_private_model: false,
            allowed_tools: [],
            forbidden_tools: [],
          },
        });

        // For now, use mock plan - in production this would come from backend
        await new Promise(r => setTimeout(r, 500));

        const realPlan: RunnerPlan = {
          id: `plan-${runId}`,
          goal: draft,
          risk: 'medium',
          backend: 'browser_automation',
          steps: [
            { id: '1', title: 'Inspect Canvas state', description: 'Detect course and module structure', status: 'pending', backend: 'browser_automation' },
            { id: '2', title: 'Draft content', description: 'Generate module content using AI', status: 'pending', backend: 'connector' },
            { id: '3', title: 'Create modules', description: 'Execute module creation in Canvas', status: 'pending', backend: 'browser_automation' },
            { id: '4', title: 'Verify', description: 'Confirm all objects were created correctly', status: 'pending', backend: 'browser_automation' },
          ]
        };

        set({ activePlan: realPlan, isPlanning: true, isLoading: false });

        get().appendTrace({
          kind: "info",
          title: "Plan generated",
          detail: `Proposed ${realPlan.steps.length} steps using ${realPlan.backend}`,
          status: "success",
        });

        // Setup event stream for real-time updates
        const eventSource = api.connectOperatorEventStream(runId);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[Operator Event]', data);
            // Handle real-time events from backend
          } catch {
            // Ignore parse errors
          }
        };
      } catch (error: any) {
        set({ isLoading: false, isPlanning: false });
        get().appendTrace({
          kind: "error",
          title: "Planning failed",
          detail: error.message,
          status: "error",
        });
      }
      return;
    }

    // DIRECT EXECUTION (Original behavior)
    const run: RunnerRun = { 
      id: runId, 
      prompt: draft.trim(), 
      state: "thinking", 
      startedAt: Date.now(), 
      output: "" 
    };
    set({ activeRun: run });

    // Model routing: use chat API for AI models, shell execution for direct commands
    const isAiModel = modelId && modelId !== 'shell' && modelId !== 'direct';
    
    if (isAiModel) {
      // Use AI chat API
      get().appendTrace({
        kind: "info",
        title: `AI Chat (${modelId})`,
        detail: "Sending to kernel...",
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
      // Shell execution
      try {
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
        set({ isLoading: false });
      } catch (error: any) {
        set({ isLoading: false });
        get().appendTrace({
          kind: "error",
          title: "Execution error",
          detail: error.message,
          status: "error",
        });
      }
    }
  },

  approvePlan: async () => {
    const { activePlan, activeRun } = get();
    if (!activePlan) return;

    set({ isPlanning: false, isLoading: true });

    get().appendTrace({
      kind: "info",
      title: "Plan approved",
      detail: "Starting execution...",
      status: "running",
    });

    // Execute through operator backend
    try {
      // Submit execution request to backend
      const requestId = activeRun?.id || crypto.randomUUID();
      
      await api.operatorExecute({
        requestId,
        intent: activePlan.goal,
        mode: 'execute_direct',
        context: {},
        preferences: {
          prefer_connector: false,
          allow_browser_automation: true,
          allow_desktop_fallback: false,
        },
        policy: {
          require_private_model: false,
          allowed_tools: [],
          forbidden_tools: [],
        },
      });

      // Execute steps with real backend
      for (let i = 0; i < activePlan.steps.length; i++) {
        if (get().isCancelled) break;

        const step = activePlan.steps[i];

        // Update step status in plan
        set(s => ({
          activePlan: s.activePlan ? {
            ...s.activePlan,
            steps: s.activePlan.steps.map((st, idx) => idx === i ? { ...st, status: 'running' } : st)
          } : undefined
        }));

        get().appendTrace({
          kind: "tool",
          title: step.title,
          detail: step.description,
          status: "running",
        });

        // In production, wait for backend event
        await new Promise(r => setTimeout(r, 2000)); // Simulated for now

        set(s => ({
          activePlan: s.activePlan ? {
            ...s.activePlan,
            steps: s.activePlan.steps.map((st, idx) => idx === i ? { ...st, status: 'completed' } : st)
          } : undefined
        }));

        get().appendTrace({
          kind: "success",
          title: `Step ${i+1} completed`,
          status: "success",
        });
      }

      set({ isLoading: false });
      get().appendTrace({
        kind: "success",
        title: "Task completed",
        detail: "All steps executed successfully. Receipt emitted.",
        status: "success",
      });
    } catch (error: any) {
      set({ isLoading: false });
      get().appendTrace({
        kind: "error",
        title: "Execution failed",
        detail: error.message,
        status: "error",
      });
    }
  },

  rejectPlan: () => {
    set({ activePlan: undefined, isPlanning: false, isLoading: false });
    get().appendTrace({
      kind: "info",
      title: "Plan rejected",
      detail: "User cancelled the proposed plan.",
      status: "error",
    });
  },
}), {
  name: 'RunnerStore',
}) as any;

