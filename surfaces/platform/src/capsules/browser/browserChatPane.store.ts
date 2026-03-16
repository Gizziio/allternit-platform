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

  setPermissionMode: (mode: "ask" | "act") => void;
  setWorkflowTeachingActive: (active: boolean) => void;
  setMicrophoneEnabled: (enabled: boolean) => void;
  setWorkflowRecording: (recording: boolean) => void;
  setScheduledTaskBanner: (banner: ScheduledTaskBanner | null) => void;
  dismissScheduledTaskBanner: () => void;
  setSlashMenuOpen: (open: boolean) => void;
  setSlashQuery: (query: string) => void;
  setLanguage: (language: string) => void;
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
    }),
    {
      name: "a2r.browser.chatPane",
      partialize: (state) => ({
        permissionMode: state.permissionMode,
        language: state.language,
      }),
    },
  ),
);
