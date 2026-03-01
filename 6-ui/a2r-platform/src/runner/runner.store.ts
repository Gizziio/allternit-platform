/**
 * Runner Store - Updated to use API Client
 * 
 * This store manages the agent runner UI state and execution.
 * It now uses the api-client for all backend communication.
 */

import { create } from "zustand";
import type { RunnerRun, RunnerTraceEntry } from "./runner.types";
import { api } from "../integration/api-client";

export const useRunnerStore = create<{
  open: boolean;
  mode: "compact" | "expanded";
  draft: string;
  modelId: string;
  activeRun?: RunnerRun;
  trace: RunnerTraceEntry[];

  openCompact: () => void;
  close: () => void;
  toggle: () => void;

  setDraft: (t: string) => void;
  setModelId: (id: string) => void;
  submit: () => Promise<void>;
  clearTrace: () => void;
  appendTrace: (entry: Omit<RunnerTraceEntry, "id" | "timestamp"> & { id?: string; timestamp?: number }) => void;
}>((set, get) => ({
  open: false,
  mode: "compact",
  draft: "",
  modelId: "gpt-4o",
  trace: [],

  openCompact: () => set({ open: true, mode: "compact" }),
  close: () => set({ open: false, mode: "compact", draft: "" }),
  toggle: () => set((s) => ({ mode: s.mode === "compact" ? "expanded" : "compact" })),

  setDraft: (t) => set({ draft: t }),
  clearTrace: () => set({ trace: [] }),
  appendTrace: (entry) =>
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
    })),

  setModelId: (id: string) => set({ modelId: id }),

  submit: async () => {
    const { draft, modelId } = get();
    if (!draft.trim()) return;

    const run: RunnerRun = { 
      id: crypto.randomUUID(), 
      prompt: draft.trim(), 
      state: "thinking", 
      startedAt: Date.now(), 
      output: "" 
    };
    set({ activeRun: run, mode: "expanded", trace: [], draft: "" });
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
              set((s) => ({
                activeRun: s.activeRun
                  ? { ...s.activeRun, state: "complete" }
                  : s.activeRun,
              }));
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
      } catch (error: any) {
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
      } catch (error: any) {
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
