/**
 * browserChatPane.store.ts — UI state for the browser chat pane sidecar.
 *
 * Manages permission mode, workflow teaching, scheduled task banner,
 * slash command menu state, and language preference.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useBrowserAgentStore } from "./browserAgent.store";

export interface ScheduledTaskBanner {
  title: string;
  description: string;
}

export interface BrowserChatPaneState {
  permissionMode: "ask" | "act";
  workflowTeachingActive: boolean;
  microphoneEnabled: boolean;
  /** True while the STT engine is actively capturing — lets the toggle button show "Recording…" */
  workflowRecording: boolean;
  scheduledTaskBanner: ScheduledTaskBanner | null;
  slashMenuOpen: boolean;
  slashQuery: string;
  language: string;
  extensionApiKey: string;
  extensionBaseUrl: string;
  extensionModel: string;
  extensionMaxSteps: number | null;
  extensionSystemInstruction: string;
  extensionExperimentalLlmsTxt: boolean;
  browserBridgeToken: string;

  setPermissionMode: (mode: "ask" | "act") => void;
  setWorkflowTeachingActive: (active: boolean) => void;
  setMicrophoneEnabled: (enabled: boolean) => void;
  setWorkflowRecording: (recording: boolean) => void;
  setScheduledTaskBanner: (banner: ScheduledTaskBanner | null) => void;
  dismissScheduledTaskBanner: () => void;
  setSlashMenuOpen: (open: boolean) => void;
  setSlashQuery: (query: string) => void;
  setLanguage: (language: string) => void;
  setExtensionSettings: (
    settings: Partial<Pick<
      BrowserChatPaneState,
      | "extensionApiKey"
      | "extensionBaseUrl"
      | "extensionModel"
      | "extensionMaxSteps"
      | "extensionSystemInstruction"
      | "extensionExperimentalLlmsTxt"
      | "browserBridgeToken"
    >>,
  ) => void;
}

const DEMO_API_KEY = "NA";
const DEMO_BASE_URL = "https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run";
const DEMO_MODEL = "qwen3.5-plus";

function createBrowserBridgeToken() {
  const random =
    typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID().replace(/-/g, "")
      : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

  return `a2r_${random.slice(0, 24)}`;
}

export const useBrowserChatPaneStore = create<BrowserChatPaneState>()(
  persist(
    (set) => ({
      permissionMode: "ask",
      workflowTeachingActive: false,
      microphoneEnabled: false,
      workflowRecording: false,
      scheduledTaskBanner: null,
      slashMenuOpen: false,
      slashQuery: "",
      language: "en",
      extensionApiKey: DEMO_API_KEY,
      extensionBaseUrl: DEMO_BASE_URL,
      extensionModel: DEMO_MODEL,
      extensionMaxSteps: 40,
      extensionSystemInstruction: "",
      extensionExperimentalLlmsTxt: false,
      browserBridgeToken: createBrowserBridgeToken(),

      setPermissionMode: (mode) => {
        set({ permissionMode: mode });
        // Sync with browser agent store
        const agentMode = mode === "ask" ? "Assist" : "Agent";
        useBrowserAgentStore.getState().setMode(agentMode);
      },

      setWorkflowTeachingActive: (active) =>
        set({ workflowTeachingActive: active, workflowRecording: active ? false : false }),

      setMicrophoneEnabled: (enabled) => set({ microphoneEnabled: enabled }),

      setWorkflowRecording: (recording) => set({ workflowRecording: recording }),

      setScheduledTaskBanner: (banner) =>
        set({ scheduledTaskBanner: banner }),

      dismissScheduledTaskBanner: () => set({ scheduledTaskBanner: null }),

      setSlashMenuOpen: (open) => set({ slashMenuOpen: open }),

      setSlashQuery: (query) => set({ slashQuery: query }),

      setLanguage: (language) => set({ language }),

      setExtensionSettings: (settings) => set(settings),
    }),
    {
      name: "a2r.browser.chatPane",
      partialize: (state) => ({
        permissionMode: state.permissionMode,
        language: state.language,
        extensionApiKey: state.extensionApiKey,
        extensionBaseUrl: state.extensionBaseUrl,
        extensionModel: state.extensionModel,
        extensionMaxSteps: state.extensionMaxSteps,
        extensionSystemInstruction: state.extensionSystemInstruction,
        extensionExperimentalLlmsTxt: state.extensionExperimentalLlmsTxt,
        browserBridgeToken: state.browserBridgeToken,
      }),
    },
  ),
);
