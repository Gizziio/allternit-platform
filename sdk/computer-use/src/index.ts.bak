/**
 * A2R Computer Use Engine - TypeScript SDK
 * 
 * @package @allternit/computer-use
 * @version 0.1.0
 * 
 * Thin TypeScript/JavaScript SDK over the canonical A2R Computer Use Engine HTTP API.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { A2RComputerUseClient, EngineMode } from '@allternit/computer-use';
 * 
 * const client = new A2RComputerUseClient({
 *   endpoint: 'http://localhost:8080',
 *   timeout: 60000,
 * });
 * 
 * // Execute a task
 * const result = await client.executeIntent('Fill out the contact form');
 * console.log(result.summary);
 * ```
 * 
 * ## Features
 * 
 * - **Type-safe**: Full TypeScript types matching the canonical engine contracts
 * - **Promise-based**: Modern async/await API
 * - **Event streaming**: Real-time SSE support for execution events
 * - **Approval handling**: Built-in helpers for assist mode approvals
 * - **Thin wrapper**: No business logic, just HTTP transport
 */

// =============================================================================
// Replies Client (chat / streaming API — Anthropic/OpenAI-aligned)
// =============================================================================

export { A2RClient, A2RAPIError, ReplyStream } from './replies-client';
export type {
  A2RClientConfig,
  CreateReplyRequest,
  CreateConversationRequest,
  Conversation,
  ReplyList,
} from './replies-client';

// =============================================================================
// Computer Use Client (engine / actions API)
// =============================================================================

export { A2RComputerUseClient } from './client';

// =============================================================================
// Types
// =============================================================================

export type {
  // Core type aliases
  EngineMode,
  TargetScope,
  EngineLayer,
  ExecutionStatus,
  ReceiptKind,
  ReceiptStatus,
  EngineEventType,
  TabStrategy,
  DeterminismLevel,
  PerceptionLevel,
  ApprovalLevel,
  UserPresenceLevel,
  TabScopeLevel,
  ApprovalDecision,

  // Core engine models
  EngineAttachment,
  EngineAction,
  EngineExecutionOptions,
  EngineExecutionContext,
  EngineExecutionRequest,
  EngineSelectedRoute,
  EngineArtifact,
  EngineReceiptEntry,
  EngineCounters,
  EngineError,
  EngineExecutionResult,
  EngineEvent,

  // HTTP API models
  ExecuteRequest,
  ExecuteResponse,
  SessionCreateRequest,
  SessionCreateResponse,
  SessionResponse,
  SessionCloseResponse,
  ApprovalRequest,
  ApprovalResponse,
  PendingApprovalResponse,
  ControlRequest,
  ControlResponse,
  RunStatusResponse,
  RunListItem,
  RunsListResponse,
  RunEventsResponse,
  SessionsListResponse,
  ErrorResponse,

  // SDK-specific types
  ClientConfig,
  ExecuteShortcutOptions,
  EventHandler,
  ApprovalHandlerCallback,
  ApprovalRequestInfo,
  ApprovalPredicate,
  SubscribeOptions,
} from './types';

// =============================================================================
// Event Streaming
// =============================================================================

export { EventStream, createEventStream } from './events';

// =============================================================================
// Approval Helpers
// =============================================================================

export {
  ApprovalHandler,
  ApprovalPredicates,
  createApprovalPrompt,
  autoApprove,
} from './approvals';

// =============================================================================
// Utilities
// =============================================================================

export {
  // URL & Headers
  normalizeEndpoint,
  buildRequestHeaders,

  // Error Handling
  A2RComputerUseError,
  handleApiError,

  // Async Helpers
  delay,
  withRetry,

  // Object Helpers
  isPlainObject,
  deepMerge,

  // ID Helpers
  generateUUID,
  isValidRunId,
  isValidSessionId,

  // Formatting
  formatDuration,

  // JSON Helpers
  safeJSONParse,
  safeJSONStringify,
} from './utils';
