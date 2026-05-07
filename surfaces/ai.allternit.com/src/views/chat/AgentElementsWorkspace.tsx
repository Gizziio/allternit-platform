"use client";

import { useMemo } from "react";
import type { ChatStatus, UIMessage } from "ai";
import {
  Sparkles,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { ModeSessionMessage } from "@/lib/agents/mode-session-store";
import { useModelSelection } from "@/providers/model-selection-provider";
import { useRuntimeExecutionMode } from "@/hooks/useRuntimeExecutionMode";
import { AgentChat } from "@/components/agent-elements/agent-chat";
import { ModelPicker } from "@/components/agent-elements/input/model-picker";
import { ModeSelector } from "@/components/agent-elements/input/mode-selector";

const MODEL_OPTIONS = [
  { id: "kimi/kimi-for-coding", name: "Kimi K2.5", version: "Coding" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "claude/claude-sonnet-4-6", name: "Claude Sonnet", version: "4.6" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek", version: "R1" },
];

const SUGGESTIONS = [
  { id: "plan-release", label: "Plan the next release", value: "Plan the next release with milestones, risks, and owners." },
  { id: "inspect-repo", label: "Inspect the repo", value: "Inspect this workspace and summarize the highest-priority issues." },
  { id: "write-patch", label: "Write the patch", value: "Implement the requested change and explain the tradeoffs." },
  { id: "search-web", label: "Search the web", value: "Search for the latest official docs and compare the available options." },
];

const MODE_OPTIONS = [
  {
    id: "safe",
    label: "Safe",
    icon: ShieldCheck,
    description: "Guarded execution with tighter controls.",
  },
  {
    id: "plan",
    label: "Plan",
    icon: Sparkles,
    description: "Think first, then execute deliberately.",
  },
  {
    id: "auto",
    label: "Auto",
    icon: Wrench,
    description: "Move faster with fewer confirmations.",
  },
];

type AgentElementsWorkspaceProps = {
  messages: ModeSessionMessage[];
  isLoading: boolean;
  onSend: (text: string) => void | Promise<void>;
  onStop: () => void;
};

function buildAssistantParts(message: ModeSessionMessage): UIMessage["parts"] {
  const parts: UIMessage["parts"] = [];
  const toolParts = Array.isArray(message.metadata?.agentElementsParts)
    ? message.metadata?.agentElementsParts
    : [];

  if (message.thinking?.trim()) {
    parts.push({
      type: "tool-Thinking",
      toolCallId: `thinking-${message.id}`,
      input: { thought: message.thinking },
      output: message.thinking,
      state: "output-available",
    } as UIMessage["parts"][number]);
  }

  for (const toolPart of toolParts) {
    parts.push(toolPart as UIMessage["parts"][number]);
  }

  if (message.metadata?.isError && message.content.trim()) {
    parts.push({
      type: "error",
      title: "Request failed",
      message: message.content.replace(/^⚠️\s*/, ""),
    } as unknown as UIMessage["parts"][number]);
  } else if (message.content.trim()) {
    parts.push({
      type: "text",
      text: message.content,
    } as UIMessage["parts"][number]);
  }

  return parts;
}

function toUiMessage(message: ModeSessionMessage): UIMessage {
  if (message.role === "assistant") {
    return {
      id: message.id,
      role: "assistant",
      parts: buildAssistantParts(message),
      createdAt: new Date(message.timestamp),
    } as UIMessage;
  }

  return {
    id: message.id,
    role: message.role === "tool" ? "assistant" : message.role,
    parts: [
      {
        type: "text",
        text: message.content,
      },
    ],
    createdAt: new Date(message.timestamp),
  } as UIMessage;
}

export function AgentElementsWorkspace({
  messages,
  isLoading,
  onSend,
  onStop,
}: AgentElementsWorkspaceProps) {
  const { selection, selectModel } = useModelSelection();
  const { executionMode, setMode, isSaving } = useRuntimeExecutionMode();

  const uiMessages = useMemo(() => messages.map(toUiMessage), [messages]);
  const status: ChatStatus = isLoading ? "streaming" : "ready";

  return (
    <section className="flex h-full min-h-0 flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--ui-border-muted)] bg-[color-mix(in_srgb,var(--surface-canvas)_88%,transparent)] px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-[var(--ui-text-muted)]">
              Agent Elements
            </p>
            <h1 className="text-balance text-2xl font-medium text-[var(--ui-text-primary)]">
              Allternit chat, rebuilt on imported agent primitives
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-2 py-1 shadow-sm">
            <ModeSelector
              modes={MODE_OPTIONS}
              value={executionMode?.mode}
              onChange={(modeId) => {
                void setMode(modeId as "plan" | "safe" | "auto");
              }}
              className={isSaving ? "opacity-60" : undefined}
            />
            <div className="h-4 w-px bg-[var(--ui-border-muted)]" />
            <ModelPicker
              models={MODEL_OPTIONS}
              value={selection?.modelId}
              onChange={(modelId) => {
                const model = MODEL_OPTIONS.find((item) => item.id === modelId);
                const providerId = modelId.includes("/")
                  ? modelId.split("/")[0]
                  : modelId;
                selectModel({
                  providerId,
                  profileId: providerId,
                  modelId,
                  modelName: model?.name ?? modelId,
                });
              }}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 px-4 py-4 md:px-6">
        <div className="mx-auto flex h-full w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-[28px] border border-[var(--ui-border-muted)] bg-[var(--surface-floating)] shadow-lg">
          <AgentChat
            messages={uiMessages}
            onSend={(message) => {
              void onSend(message.content);
            }}
            status={status}
            onStop={onStop}
            suggestions={SUGGESTIONS}
            emptyStatePosition="center"
            emptySuggestionsPlacement="both"
            emptySuggestionsPosition="bottom"
            classNames={{
              root: "h-full min-h-0",
              inputBar: "border-t border-[var(--ui-border-muted)] bg-transparent px-4 pb-4 pt-3 md:px-6 md:pb-6",
              userMessage: "text-pretty",
            }}
          />
        </div>
      </div>
    </section>
  );
}
