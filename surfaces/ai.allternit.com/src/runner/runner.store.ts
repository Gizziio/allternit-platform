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
const STORAGE_KEY = 'allternit-agent-runner-session';

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

type OperatorPlanEvent =
  | { type: "planning_started"; requestId: string }
  | { type: "plan_ready"; requestId: string; plan: OperatorRunnerPlan }
  | { type: "execution_started"; requestId: string; backend: string }
  | { type: "step_started"; requestId: string; stepId: string; title: string }
  | { type: "step_finished"; requestId: string; stepId: string; status: "ok" | "failed" }
  | { type: "verification_result"; requestId: string; status: "ok" | "partial" | "failed"; detail: string }
  | { type: "receipt_ready"; requestId: string; receiptId: string }
  | { type: "run_failed"; requestId: string; error: string }
  | { type: "run_finished"; requestId: string; status: "success" | "partial" | "failed" };

interface OperatorRunnerPlan {
  planId: string;
  backendCandidate: "connector" | "browser_automation" | "electron_native" | "desktop_fallback";
  risk: "low" | "medium" | "high";
  steps: Array<{
    id: string;
    title: string;
    detail: string;
    tool?: string;
  }>;
}

function normalizeRunnerPlan(goal: string, plan: OperatorRunnerPlan): RunnerPlan {
  return {
    id: plan.planId,
    goal,
    risk: plan.risk,
    backend: plan.backendCandidate,
    steps: plan.steps.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.detail,
      status: "pending",
      backend: step.tool ?? plan.backendCandidate,
    })),
  };
}

function isOperatorPlanEvent(value: unknown): value is OperatorPlanEvent {
  return !!value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string";
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
    const operatorContext = {
      target_type: capturedContext.target_type || 'browser',
      target_app: capturedContext.target_app,
      target_domain: capturedContext.target_domain,
      target_context: capturedContext.target_context || {},
      page_title: capturedContext.page_title,
      url: capturedContext.url,
      window_title: capturedContext.window_title,
    };

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
        set({
          activeRun: {
            id: runId,
            prompt: draft.trim(),
            state: "thinking",
            startedAt: Date.now(),
            output: "",
          },
        });

        const eventSource = api.connectOperatorEventStream(runId);
        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as unknown;
            if (!isOperatorPlanEvent(payload)) return;

            switch (payload.type) {
              case "planning_started":
                get().appendTrace({
                  kind: "info",
                  title: "Planning started",
                  detail: "Operator backend is building a reviewable plan.",
                  status: "running",
                });
                return;
              case "plan_ready": {
                const normalizedPlan = normalizeRunnerPlan(draft.trim(), payload.plan);
                set({
                  activePlan: normalizedPlan,
                  isPlanning: true,
                  isLoading: false,
                });
                get().appendTrace({
                  kind: "success",
                  title: "Plan ready",
                  detail: `Received ${normalizedPlan.steps.length} backend-authored step${normalizedPlan.steps.length === 1 ? "" : "s"}.`,
                  status: "success",
                });
                return;
              }
              case "run_failed":
                eventSource.close();
                set({ isLoading: false, isPlanning: false, activePlan: undefined });
                set((s) => ({
                  activeRun: s.activeRun
                    ? { ...s.activeRun, state: "error", output: payload.error }
                    : s.activeRun,
                }));
                get().appendTrace({
                  kind: "error",
                  title: "Planning failed",
                  detail: payload.error,
                  status: "error",
                });
                return;
              case "run_finished":
                eventSource.close();
                if (!get().activePlan) {
                  const detail = "Operator backend accepted the planning request but did not return a reviewable plan.";
                  set({ isLoading: false, isPlanning: false });
                  set((s) => ({
                    activeRun: s.activeRun
                      ? { ...s.activeRun, state: "error", output: detail }
                      : s.activeRun,
                  }));
                  get().appendTrace({
                    kind: "error",
                    title: "Plan unavailable",
                    detail,
                    status: "error",
                  });
                }
                return;
            }
          } catch {
            // Ignore malformed event payloads from the stream.
          }
        };

        await api.operatorExecute({
          requestId: runId,
          intent: draft,
          mode: 'plan_only',
          context: operatorContext,
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
      const eventSource = api.connectOperatorEventStream(requestId);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as unknown;
          if (!isOperatorPlanEvent(payload)) return;

          switch (payload.type) {
            case "execution_started":
              get().appendTrace({
                kind: "info",
                title: "Execution started",
                detail: `Backend: ${payload.backend.replace(/_/g, " ")}`,
                status: "running",
              });
              set((s) => ({
                activeRun: s.activeRun
                  ? { ...s.activeRun, state: "tooling" }
                  : s.activeRun,
              }));
              return;
            case "step_started":
              set((s) => ({
                activePlan: s.activePlan
                  ? {
                      ...s.activePlan,
                      steps: s.activePlan.steps.map((step) =>
                        step.id === payload.stepId
                          ? { ...step, status: "running" }
                          : step
                      ),
                    }
                  : s.activePlan,
              }));
              get().appendTrace({
                kind: "tool",
                title: payload.title,
                detail: `Step ${payload.stepId} started.`,
                status: "running",
              });
              return;
            case "step_finished":
              set((s) => ({
                activePlan: s.activePlan
                  ? {
                      ...s.activePlan,
                      steps: s.activePlan.steps.map((step) =>
                        step.id === payload.stepId
                          ? { ...step, status: payload.status === "ok" ? "completed" : "error" }
                          : step
                      ),
                    }
                  : s.activePlan,
              }));
              get().appendTrace({
                kind: payload.status === "ok" ? "success" : "error",
                title: `Step ${payload.stepId} ${payload.status === "ok" ? "completed" : "failed"}`,
                status: payload.status === "ok" ? "success" : "error",
              });
              return;
            case "verification_result":
              get().appendTrace({
                kind: payload.status === "failed" ? "error" : "info",
                title: "Verification result",
                detail: payload.detail,
                status: payload.status === "failed" ? "error" : "success",
              });
              return;
            case "receipt_ready":
              get().appendTrace({
                kind: "success",
                title: "Receipt ready",
                detail: `Receipt ${payload.receiptId} is available for this execution.`,
                status: "success",
              });
              return;
            case "run_failed":
              eventSource.close();
              set({ isLoading: false });
              set((s) => ({
                activeRun: s.activeRun
                  ? { ...s.activeRun, state: "error", output: payload.error }
                  : s.activeRun,
              }));
              get().appendTrace({
                kind: "error",
                title: "Execution failed",
                detail: payload.error,
                status: "error",
              });
              return;
            case "run_finished":
              eventSource.close();
              set({ isLoading: false });
              set((s) => ({
                activeRun: s.activeRun
                  ? {
                      ...s.activeRun,
                      state: payload.status === "failed" ? "error" : "complete",
                      output:
                        payload.status === "success"
                          ? "Operator execution completed."
                          : payload.status === "partial"
                            ? "Operator execution completed with partial verification."
                            : "Operator execution failed.",
                    }
                  : s.activeRun,
              }));
              get().appendTrace({
                kind: payload.status === "failed" ? "error" : "success",
                title: payload.status === "failed" ? "Execution failed" : "Task completed",
                detail:
                  payload.status === "success"
                    ? "Operator execution completed successfully."
                    : payload.status === "partial"
                      ? "Operator execution completed with partial verification."
                      : "Operator execution failed.",
                status: payload.status === "failed" ? "error" : "success",
              });
              return;
          }
        } catch {
          // Ignore malformed event payloads from the stream.
        }
      };

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
})) as any;
