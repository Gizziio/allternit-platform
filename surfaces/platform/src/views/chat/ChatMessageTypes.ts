// ============================================================================
// Extended Chat Message Types with A2UI Support
// ============================================================================
// Extends the base ChatMessage to include A2UI payloads and other rich content
// ============================================================================

import type { A2UIPayload } from "@/capsules/a2ui/a2ui.types";
import type { UIPart } from "@/lib/ai/ui-parts.types";

// ============================================================================
// Base Types (from existing ChatStore)
// ============================================================================

export interface ChatMessageBase {
  id: string;
  role: "user" | "assistant";
  createdAt?: number;
}

// ============================================================================
// Rich Content Parts (extends UIPart)
// ============================================================================

/** A2UI part for embedding interactive UI in messages */
export interface A2UIPart {
  type: "a2ui";
  payload: A2UIPayload;
  title?: string;
  description?: string;
  source?: string; // Agent ID
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

/** Miniapp reference part */
export interface MiniappPart {
  type: "miniapp";
  capsuleId: string;
  entryPoint?: string;
  title?: string;
  description?: string;
}

/** Browser link part - opens in browser tab */
export interface BrowserLinkPart {
  type: "browser-link";
  url: string;
  title?: string;
  openIn?: "new-tab" | "current" | "popup";
}

/** Action buttons part - quick actions */
export interface ActionButtonsPart {
  type: "action-buttons";
  buttons: Array<{
    label: string;
    action: string;
    payload?: unknown;
    variant?: "primary" | "secondary" | "destructive" | "ghost";
    icon?: string;
  }>;
}

/** Agent thinking/progress part */
export interface AgentThinkingPart {
  type: "agent-thinking";
  status: "idle" | "reasoning" | "searching" | "coding" | "waiting";
  steps?: Array<{
    id: string;
    label: string;
    status: "pending" | "active" | "completed" | "error";
    detail?: string;
  }>;
  message?: string;
}

/** Artifact reference part - links to cowork canvas */
export interface ArtifactPart {
  type: "artifact";
  artifactId: string;
  artifactType: "code" | "document" | "diagram" | "a2ui";
  title: string;
  preview?: string;
}

// ============================================================================
// Extended Message Types
// ============================================================================

/** Rich content array with all part types */
export type RichContentPart =
  | UIPart // Base types from rust-stream-adapter (text, tool, file, etc.)
  | A2UIPart
  | MiniappPart
  | BrowserLinkPart
  | ActionButtonsPart
  | AgentThinkingPart
  | ArtifactPart;

/** Extended chat message with rich content support */
export interface RichChatMessage extends ChatMessageBase {
  // Content can be:
  // 1. Simple text (backward compatible)
  // 2. Array of rich parts (new format)
  content: string | RichContentPart[];

  // Metadata
  metadata?: {
    model?: string;
    tokens?: number;
    latency?: number;
    agentId?: string;
    threadId?: string;
  };

  // For assistant messages: indicates if this message generated A2UI
  hasA2UI?: boolean;

  // For A2UI messages: the rendered state
  a2uiState?: {
    dataModel: Record<string, unknown>;
    lastAction?: string;
    actionCount: number;
  };
}

/** Thread with rich messages */
export interface RichChatThread {
  id: string;
  title: string;
  messages: RichChatMessage[];
  projectId?: string;
  createdAt: number;
  updatedAt: number;

  // Thread-level state
  a2uiState?: {
    activeTabId?: string;
    sharedDataModel?: Record<string, unknown>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Check if content is rich parts array */
export function isRichContent(
  content: string | RichContentPart[]
): content is RichContentPart[] {
  return Array.isArray(content);
}

/** Extract text from rich content */
export function extractTextFromRichContent(
  content: string | RichContentPart[]
): string {
  if (typeof content === "string") {
    return content;
  }

  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/** Check if message has A2UI content */
export function hasA2UIContent(
  content: string | RichContentPart[]
): boolean {
  if (typeof content === "string") {
    return false;
  }
  return content.some((part) => part.type === "a2ui");
}

/** Get A2UI parts from message */
export function getA2UIParts(
  content: string | RichContentPart[]
): A2UIPart[] {
  if (typeof content === "string") {
    return [];
  }
  return content.filter((part): part is A2UIPart => part.type === "a2ui");
}

/** Get action buttons from message */
export function getActionButtons(
  content: string | RichContentPart[]
): ActionButtonsPart | undefined {
  if (typeof content === "string") {
    return undefined;
  }
  return content.find(
    (part): part is ActionButtonsPart => part.type === "action-buttons"
  );
}

/** Convert old ChatMessage to RichChatMessage */
export function enrichMessage(
  message: { id: string; role: "user" | "assistant"; text: string },
  options?: {
    a2uiPayload?: A2UIPayload;
    a2uiTitle?: string;
  }
): RichChatMessage {
  const parts: RichContentPart[] = [
    { type: "text", text: message.text } as UIPart,
  ];

  if (options?.a2uiPayload) {
    parts.push({
      type: "a2ui",
      payload: options.a2uiPayload,
      title: options.a2uiTitle,
    });
  }

  return {
    id: message.id,
    role: message.role,
    content: parts,
    createdAt: Date.now(),
  };
}

// ============================================================================
// Sample Payloads for Testing
// ============================================================================

export const sampleA2UIMessage: RichChatMessage = {
  id: "msg-a2ui-001",
  role: "assistant",
  content: [
    {
      type: "text",
      text: "I've created a task form for you. Fill it out and I'll create the task.",
    } as UIPart,
    {
      type: "a2ui",
      title: "New Task Form",
      payload: {
        version: "1.0.0",
        surfaces: [
          {
            id: "task-form",
            root: {
              type: "Container",
              props: {
                direction: "column",
                gap: 16,
                padding: 24,
                children: [
                  {
                    type: "TextField",
                    props: {
                      label: "Task Name",
                      placeholder: "Enter task name...",
                      valuePath: "task.name",
                      required: true,
                    },
                  },
                  {
                    type: "Select",
                    props: {
                      label: "Priority",
                      valuePath: "task.priority",
                      options: [
                        { label: "Low", value: "low" },
                        { label: "Medium", value: "medium" },
                        { label: "High", value: "high" },
                      ],
                    },
                  },
                  {
                    type: "TextField",
                    props: {
                      label: "Description",
                      placeholder: "Optional description...",
                      valuePath: "task.description",
                      multiline: true,
                      rows: 3,
                    },
                  },
                  {
                    type: "Button",
                    props: {
                      label: "Create Task",
                      variant: "primary",
                      action: "create-task",
                    },
                  },
                ],
              },
            },
          },
        ],
        dataModel: {
          task: {
            name: "",
            priority: "medium",
            description: "",
          },
        },
        actions: [{ id: "create-task", type: "api" }],
      },
    },
  ],
  createdAt: Date.now(),
  hasA2UI: true,
};

export const sampleActionButtonsMessage: RichChatMessage = {
  id: "msg-actions-001",
  role: "assistant",
  content: [
    {
      type: "text",
      text: "I found several options for you. What would you like to do?",
    } as UIPart,
    {
      type: "action-buttons",
      buttons: [
        { label: "View Details", action: "view-details", variant: "primary" },
        { label: "Edit", action: "edit", variant: "secondary" },
        { label: "Delete", action: "delete", variant: "destructive" },
      ],
    },
  ],
  createdAt: Date.now(),
};

export const sampleAgentThinkingMessage: RichChatMessage = {
  id: "msg-thinking-001",
  role: "assistant",
  content: [
    {
      type: "agent-thinking",
      status: "reasoning",
      steps: [
        { id: "1", label: "Analyzing request", status: "completed" },
        { id: "2", label: "Searching knowledge base", status: "active" },
        { id: "3", label: "Generating response", status: "pending" },
      ],
      message: "This might take a moment...",
    },
  ],
  createdAt: Date.now(),
};
