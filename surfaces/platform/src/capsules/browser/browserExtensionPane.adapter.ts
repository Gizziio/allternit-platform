"use client";

import { buildPageAgentBridgeConfig } from "@/lib/page-agent/config";
import { getPageAgentConfigEndpoint } from "@/lib/page-agent/runtime-client";
import { isElectronShell } from "@/lib/platform";

import { useBrowserAgentStore } from "./browserAgent.store";
import { useBrowserChatPaneStore } from "./browserChatPane.store";
import { useBrowserStore } from "./browser.store";
import type { BrowserTab } from "./browser.types";
import type {
  ExtensionSidepanelAdapter as BrowserExtensionPaneAdapter,
} from "../../../../shared/extension-sidepanel/ExtensionSidepanelShell.types";

/**
 * Send a task to the Chrome Extension via native messaging bridge
 * Uses the message format expected by remoteTaskHandler in the extension:
 * - { type: 'execute_task', payload: { task: string } }
 * - { type: 'stop_task', payload: {} }
 */
async function sendToExtension(type: string, payload: unknown): Promise<boolean> {
  if (!isElectronShell()) return false;
  
  const extension = (window as unknown as { a2rExtension?: {
    sendMessage: (msg: { type: string; payload?: unknown }) => Promise<boolean>;
    getStatus: () => Promise<{ connected: boolean }>;
  } }).a2rExtension;
  
  if (!extension) return false;
  
  try {
    const status = await extension.getStatus();
    if (!status.connected) return false;
    
    // Map our internal types to extension's expected types
    const mappedType = type === 'page_agent:start' ? 'execute_task' : 
                       type === 'page_agent:stop' ? 'stop_task' : type;
    
    return await extension.sendMessage({ type: mappedType, payload });
  } catch {
    return false;
  }
}

function isWebTab(
  tab: BrowserTab | null | undefined,
): tab is BrowserTab & { contentType: "web"; url: string; title: string } {
  return Boolean(tab && tab.contentType === "web");
}

function formatHost(url?: string): string {
  if (!url) return "No page selected";

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function useBrowserExtensionPaneAdapter(): BrowserExtensionPaneAdapter {
  const currentTask = useBrowserAgentStore((state) => state.goal) ?? "";
  const status = useBrowserAgentStore((state) => state.pageAgentStatus) ?? "idle";
  const activity = useBrowserAgentStore((state) => state.pageAgentActivity) ?? null;
  const history = useBrowserAgentStore((state) => state.pageAgentHistory) ?? [];
  const sessions = useBrowserAgentStore((state) => state.pageAgentSessions) ?? [];
  const runPageAgentGoal = useBrowserAgentStore((state) => state.runPageAgentGoal);
  const stop = useBrowserAgentStore((state) => state.stopPageAgent);
  const deleteSession = useBrowserAgentStore((state) => state.deletePageAgentSession);
  const clearSessions = useBrowserAgentStore((state) => state.clearPageAgentSessions);

  const permissionMode = useBrowserChatPaneStore((state) => state.permissionMode);
  const language = useBrowserChatPaneStore((state) => state.language);
  const extensionApiKey = useBrowserChatPaneStore((state) => state.extensionApiKey);
  const extensionBaseUrl = useBrowserChatPaneStore((state) => state.extensionBaseUrl);
  const extensionModel = useBrowserChatPaneStore((state) => state.extensionModel);
  const extensionMaxSteps = useBrowserChatPaneStore((state) => state.extensionMaxSteps);
  const extensionSystemInstruction = useBrowserChatPaneStore((state) => state.extensionSystemInstruction);
  const extensionExperimentalLlmsTxt = useBrowserChatPaneStore(
    (state) => state.extensionExperimentalLlmsTxt,
  );
  const setPermissionMode = useBrowserChatPaneStore((state) => state.setPermissionMode);
  const setLanguage = useBrowserChatPaneStore((state) => state.setLanguage);
  const setExtensionSettings = useBrowserChatPaneStore((state) => state.setExtensionSettings);

  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const activeTab = useBrowserStore((state) =>
    state.tabs.find((tab) => tab.id === activeTabId) ?? null,
  );

  const hostLabel = isWebTab(activeTab) ? formatHost(activeTab.url) : "Native browser host";
  const pageLabel = isWebTab(activeTab)
    ? `${activeTab.title || hostLabel} · ${hostLabel}`
    : "No active web page";

  return {
    status,
    history,
    activity,
    currentTask,
    sessions,
    pageLabel,
    hostLabel,
    config: {
      permissionMode,
      language,
      runtimeLabel: "A2R extension bridge in native browser mode",
      apiKey: extensionApiKey,
      baseURL: extensionBaseUrl,
      model: extensionModel,
      maxSteps: extensionMaxSteps,
      systemInstruction: extensionSystemInstruction,
      experimentalLlmsTxt: extensionExperimentalLlmsTxt,
    },
    execute: async (task) => {
      // Try to send to Chrome Extension first (if connected)
      const config = buildPageAgentBridgeConfig({
        language,
        extensionApiKey,
        extensionBaseUrl,
        extensionModel,
        extensionMaxSteps,
        extensionSystemInstruction,
        extensionExperimentalLlmsTxt,
      });
      
      const sentToExtension = await sendToExtension('page_agent:start', { task, config });
      
      if (!sentToExtension) {
        // Fall back to local execution via API
        console.log('[BrowserExtensionPane] Extension not connected, using local execution');
        runPageAgentGoal(task, config);
      } else {
        console.log('[BrowserExtensionPane] Task sent to Chrome Extension');
      }
    },
    stop: async () => {
      const sentToExtension = await sendToExtension('page_agent:stop', {});
      if (!sentToExtension) {
        stop();
      }
    },
    deleteSession,
    clearSessions,
    configure: async (nextConfig) => {
      const nextLanguage = nextConfig.language ?? language;
      const nextApiKey = nextConfig.apiKey ?? extensionApiKey;
      const nextBaseURL = nextConfig.baseURL ?? extensionBaseUrl;
      const nextModel = nextConfig.model ?? extensionModel;
      const nextMaxSteps =
        nextConfig.maxSteps !== undefined ? nextConfig.maxSteps : extensionMaxSteps;
      const nextSystemInstruction =
        nextConfig.systemInstruction !== undefined
          ? nextConfig.systemInstruction
          : extensionSystemInstruction;
      const nextExperimentalLlmsTxt =
        nextConfig.experimentalLlmsTxt !== undefined
          ? nextConfig.experimentalLlmsTxt
          : extensionExperimentalLlmsTxt;

      const response = await fetch(getPageAgentConfigEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: buildPageAgentBridgeConfig({
            language: nextLanguage,
            extensionApiKey: nextApiKey,
            extensionBaseUrl: nextBaseURL,
            extensionModel: nextModel,
            extensionMaxSteps: nextMaxSteps,
            extensionSystemInstruction: nextSystemInstruction ?? "",
            extensionExperimentalLlmsTxt: nextExperimentalLlmsTxt,
          }),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "Failed to configure page-agent bridge.");
      }

      if (nextConfig.permissionMode) {
        setPermissionMode(nextConfig.permissionMode);
      }

      if (nextConfig.language) {
        setLanguage(nextConfig.language);
      }

      setExtensionSettings({
        extensionApiKey: nextApiKey,
        extensionBaseUrl: nextBaseURL,
        extensionModel: nextModel,
        extensionMaxSteps: nextMaxSteps,
        extensionSystemInstruction: nextSystemInstruction ?? "",
        extensionExperimentalLlmsTxt: nextExperimentalLlmsTxt,
      });
    },
  };
}
