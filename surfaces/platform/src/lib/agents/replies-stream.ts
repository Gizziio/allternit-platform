// =============================================================================
// Allternit / Gizzi — Replies API canonical contract (platform surface re-export)
//
// Types live in @allternit/replies-contract.
// Reducer lives in @allternit/replies-reducer.
//
// Import from here within the platform surface — never import from the packages
// directly in surface code, so the path alias resolution stays in one place.
// =============================================================================

export type {
  ReplyItemKind,
  TextReplyItem,
  ReasoningReplyItem,
  ToolCallReplyItem,
  ArtifactReplyItem,
  CitationRef,
  CitationReplyItem,
  McpAppReplyItem,
  CodeReplyItem,
  TerminalReplyItem,
  TerminalStatus,
  PlanReplyItem,
  PlanStep,
  PlanStepStatus,
  FileOpReplyItem,
  FileOpKind,
  ReplyItem,
  ReplyStatus,
  ToolCallState,
  Reply,
  ReplyEvent,
  ProviderReplyAdapter,
  ConversationReplyState,
} from '@/types/replies-contract';

export {
  createConversationReplyState,
  reduceReplyEvent,
} from '@/lib/replies-reducer';
