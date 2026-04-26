/**
 * Allternit Computer Use Engine - TypeScript SDK
 * 
 * @package @allternit/computer-use
 * @version 0.1.0
 * 
 * Thin TypeScript/JavaScript SDK over the canonical Allternit Computer Use Engine HTTP API.
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { AllternitComputerUseClient, EngineMode } from '@allternit/computer-use';
 * 
 * const client = new AllternitComputerUseClient({
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

export { AllternitClient, AllternitAPIError, ReplyStream } from './replies-client';
export type {
  AllternitClientConfig,
  CreateReplyRequest,
  CreateConversationRequest,
  Conversation,
  ReplyList,
} from './replies-client';

// =============================================================================
// Computer Use Client (engine / actions API)
// =============================================================================

export { AllternitComputerUseClient } from './client';

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

  // Service-layer types
  EngineActionKind,
  BrowserTaskMode,
  BrowserTaskStatus,
  BrowserTaskRequest,
  BrowserTaskResponse,
  BrowserTaskDetailResponse,
  BrowserTaskExecuteRequest,
  BrowserTaskExecuteResponse,
  BrowserSearchRequest,
  BrowserRetrieveRequest,
  BrowserHealthResponse,
  VisionViewport,
  VisionProposeRequest,
  VisionProposeResponse,
  VisionScreenshotResponse,
  ActionProposal,
  DesktopExecuteRequest,
  DesktopExecuteResponse,
  ParallelVariantConfig,
  ParallelVerificationProfile,
  ParallelRunRequest,
  ParallelRunStatus,
  ParallelRunResults,
  ParallelVariantResult,
  TelemetryProviderInfo,
  TelemetrySnapshot,
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
  AllternitComputerUseError,
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

// =============================================================================
// MCP Tool Specifications
// =============================================================================

export type { McpToolSpec, McpToolName } from './mcp-tool-spec';
export { MCP_TOOL_SPECS } from './mcp-tool-spec';
