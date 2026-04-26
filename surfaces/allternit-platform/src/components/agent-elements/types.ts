import type { CSSProperties, ComponentType, ReactNode } from "react";
import type { ChatStatus, UIMessage } from "ai";
import type { InputBarProps } from "./input-bar";
import type { QuestionAnswer } from "./question/question-prompt";

export type ModelOption = {
  id: string;
  name: string;
  version?: string;
  provider?: string;
};

export type CustomToolRendererProps = {
  name: string;
  input?: Record<string, unknown>;
  output?: unknown;
  status: "pending" | "streaming" | "success" | "error";
};

export type AgentChatClassNames = {
  root?: string;
  inputBar?: string;
  userMessage?: string;
};

export type AgentChatSlots = {
  InputBar?: ComponentType<InputBarProps>;
  UserMessage?: ComponentType<{
    message: UIMessage;
    className?: string;
    enableImagePreview?: boolean;
  }>;
  ToolRenderer?: ComponentType<{
    part: unknown;
    nestedTools?: unknown[];
    chatStatus?: string;
    toolRenderers?: Record<string, ComponentType<CustomToolRendererProps>>;
  }>;
};

export type AgentChatProps = {
  messages: UIMessage[];
  onSend: (message: { role: "user"; content: string }) => void;
  status: ChatStatus;
  onStop: () => void;
  error?: Error | null;
  classNames?: AgentChatClassNames;
  slots?: AgentChatSlots;
  toolRenderers?: Record<string, ComponentType<CustomToolRendererProps>>;
  attachments?: {
    onAttach?: () => void;
    images?: InputBarProps["attachedImages"];
    files?: InputBarProps["attachedFiles"];
    onRemoveImage?: InputBarProps["onRemoveImage"];
    onRemoveFile?: InputBarProps["onRemoveFile"];
    onPaste?: InputBarProps["onPaste"];
    isDragOver?: boolean;
  };
  showCopyToolbar?: boolean;
  initialScrollBehavior?: "bottom" | "top";
  enableImagePreview?: boolean;
  suggestions?:
    | Array<{ label: string; value?: string }>
    | {
        items: Array<{ label: string; value?: string }>;
        className?: string;
        itemClassName?: string;
      };
  emptyStatePosition?: "default" | "center";
  emptySuggestionsPlacement?: "input" | "empty" | "both";
  emptySuggestionsPosition?: "top" | "bottom";
  questionTool?: {
    submitLabel?: string;
    skipLabel?: string;
    allowSkip?: boolean;
    onAnswer?: (payload: {
      toolCallId?: string;
      question?: unknown;
      answer: QuestionAnswer;
    }) => void;
  };
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};
