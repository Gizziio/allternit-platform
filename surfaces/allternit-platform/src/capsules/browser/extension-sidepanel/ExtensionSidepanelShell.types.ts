export type ExtensionSidepanelStatus = "idle" | "running" | "completed" | "error";

export type ExtensionSidepanelActivity =
  | { type: "thinking" }
  | { type: "executing"; tool: string; input?: unknown }
  | { type: "executed"; tool: string; input?: unknown; output?: string; duration?: number }
  | { type: "retrying"; attempt: number; maxAttempts: number }
  | { type: "error"; message: string };

export type ExtensionSidepanelHistoricalEvent =
  | {
      type: "step";
      stepIndex?: number;
      reflection?: {
        evaluation_previous_goal?: string;
        memory?: string;
        next_goal?: string;
      };
      action?: {
        name: string;
        input: unknown;
        output: string;
      };
      rawRequest?: unknown;
      rawResponse?: unknown;
    }
  | {
      type: "observation";
      content: string;
    }
  | {
      type: "retry";
      message: string;
      attempt: number;
      maxAttempts: number;
    }
  | {
      type: "error";
      message: string;
      rawResponse?: unknown;
    }
  | {
      type: "user_takeover";
      message?: string;
    };

export interface ExtensionSidepanelSessionRecord {
  id: string;
  task: string;
  history: ExtensionSidepanelHistoricalEvent[];
  status: Extract<ExtensionSidepanelStatus, "completed" | "error">;
  createdAt: number;
}

export interface ExtensionSidepanelConfig {
  permissionMode: "ask" | "act";
  language: string;
  runtimeLabel: string;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  maxSteps?: number | null;
  systemInstruction?: string | null;
  experimentalLlmsTxt?: boolean;
}

export interface ExtensionSidepanelAdapter {
  status: ExtensionSidepanelStatus;
  history: ExtensionSidepanelHistoricalEvent[];
  activity: ExtensionSidepanelActivity | null;
  currentTask: string;
  sessions: ExtensionSidepanelSessionRecord[];
  pageLabel: string;
  hostLabel: string;
  config: ExtensionSidepanelConfig;
  execute: (task: string) => void;
  stop: () => void;
  configure: (config: Partial<ExtensionSidepanelConfig>) => void | Promise<void>;
  deleteSession?: (id: string) => void | Promise<void>;
  clearSessions?: () => void | Promise<void>;
}

export interface ExtensionSidepanelCopy {
  title: string;
  subtitle: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  readyLabel: string;
  contextLabel: string;
  settingsEyebrow: string;
  settingsTitle: string;
  settingsDescription: string;
  settingsContextLabel: string;
}

export interface ExtensionSidepanelConfigViewProps {
  config: ExtensionSidepanelConfig;
  copy: ExtensionSidepanelCopy;
  pageLabel: string;
  onSave: (nextConfig: Partial<ExtensionSidepanelConfig>) => void | Promise<void>;
  onBack: () => void;
}

export interface ExtensionSidepanelHistoryListViewProps {
  sessions: ExtensionSidepanelSessionRecord[];
  onSelect: (id: string) => void;
  onBack: () => void;
  onDeleteSession?: (id: string) => void | Promise<void>;
  onClearSessions?: () => void | Promise<void>;
}

export interface ExtensionSidepanelHistoryDetailViewProps {
  session: ExtensionSidepanelSessionRecord | null;
  sessionId: string;
  onBack: () => void;
}

export interface ExtensionSidepanelComposerProps {
  isRunning: boolean;
  value: string;
  placeholder: string;
  onValueChange: (value: string) => void;
  onSubmit: (value?: string) => void;
  onStop: () => void;
}
