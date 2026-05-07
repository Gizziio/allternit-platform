// ============================================================================
// Chat Module Exports
// ============================================================================
// Unified exports for chat-related components and utilities
// ============================================================================

// Store
export {
  useChatStore,
  type ChatThread,
  type ChatProject,
  type ProjectFile,
} from "./ChatStore";

// Extended Message Types with A2UI Support
export {
  type RichChatMessage,
  type RichChatThread,
  type RichContentPart,
  type A2UIPart,
  type MiniappPart,
  type BrowserLinkPart,
  type ActionButtonsPart,
  type AgentThinkingPart,
  type ArtifactPart,
  isRichContent,
  extractTextFromRichContent,
  hasA2UIContent,
  getA2UIParts,
  getActionButtons,
  enrichMessage,
  // Sample data
  sampleA2UIMessage,
  sampleActionButtonsMessage,
  sampleAgentThinkingMessage,
} from "./ChatMessageTypes";

// A2UI Integration - Option A: Inline A2UI
export {
  MessageA2UI,
  A2UIActionButtons,
  useChatA2UI,
  isA2UIPart,
  type ChatA2UIPart,
  type ChatA2UIMessage,
} from "./ChatA2UI";

// Extended Message Parts Renderer
export {
  RichMessageParts,
} from "./ChatMessageParts";

// Browser Bridge - Option B: Open in Browser
export {
  OpenInBrowserButton,
  PopOutButton,
  MessageA2UIActions,
  ChatBrowserBridge,
  QuickBrowserLink,
  useChatBrowserActions,
} from "./ChatBrowserBridge";

// Views
export { ChatComposer } from "./ChatComposer";
export { ChatRail } from "./ChatRail";
