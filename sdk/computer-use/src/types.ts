/**
 * Allternit Computer Use Engine - TypeScript SDK Types
 * 
 * TypeScript interfaces and types matching the canonical engine contracts.
 * Derived from:
 * - engine_contract.py (Core engine types)
 * - models.py (HTTP API request/response models)
 */

// =============================================================================
// Type Aliases matching engine_contract.py
// =============================================================================

export type EngineMode = 'intent' | 'direct' | 'assist';
export type TargetScope = 'auto' | 'browser' | 'desktop' | 'hybrid';
export type EngineLayer = 'semantic' | 'deterministic' | 'perceptual';

export type ExecutionStatus =
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'
  | 'needs_approval'
  | 'needs_input';

export type ReceiptKind =
  | 'route'
  | 'policy'
  | 'action'
  | 'fallback'
  | 'approval'
  | 'artifact'
  | 'summary';

export type ReceiptStatus = 'info' | 'success' | 'failure';

export type EngineEventType =
  | 'run.started'
  | 'policy.resolved'
  | 'route.selected'
  | 'observe.started'
  | 'observe.completed'
  | 'plan.created'
  | 'action.started'
  | 'action.completed'
  | 'fallback.triggered'
  | 'layer.upgraded'
  | 'approval.required'
  | 'approval.received'
  | 'artifact.created'
  | 'run.paused'
  | 'run.resumed'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled'
  | 'search.overflow'
  | 'view.refocused'
  | 'guard.failed'
  | 'context.compacted'
  | 'tab.created'
  | 'tab.closed'
  | 'tab.switched'
  | 'tab.updated';

export type TabStrategy = 'active_only' | 'new_tab' | 'multi_tab';

export type DeterminismLevel = 'required' | 'preferred' | 'allowed';
export type PerceptionLevel = 'off' | 'fallback' | 'allowed' | 'required';
export type ApprovalLevel = 'never' | 'on-risk' | 'always';
export type UserPresenceLevel = 'headless' | 'headed' | 'present';
export type TabScopeLevel = 'active' | 'session' | 'all';

export type ApprovalDecision = 'approve' | 'deny' | 'cancel';

// =============================================================================
// Core Engine Models
// =============================================================================

/**
 * Engine attachment for including files/screenshots with requests.
 */
export interface EngineAttachment {
  type: string;
  attachment_id?: string;
  path?: string;
  url?: string;
  mime?: string;
  content?: string;
  size_bytes?: number;
  metadata?: Record<string, unknown>;
}

export type EngineActionKind =
  | 'click'
  | 'type'
  | 'scroll'
  | 'navigate'
  | 'key'
  | 'hover'
  | 'drag'
  | 'wait'
  | 'screenshot'
  | 'assert'
  | 'select'
  | 'focus'
  | 'clear'
  | 'upload'
  | 'download';

/**
 * Single executable action for direct mode.
 */
export interface EngineAction {
  kind: EngineActionKind | string;
  action_id?: string;
  target?: Record<string, unknown>;
  input?: Record<string, unknown>;
  expect?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Execution options for controlling engine behavior.
 */
export interface EngineExecutionOptions {
  determinism?: DeterminismLevel;
  perception?: PerceptionLevel;
  approvals?: ApprovalLevel;
  user_presence?: UserPresenceLevel;
  tab_scope?: TabScopeLevel;
  timeout_ms?: number;
  max_steps?: number;
  max_fallbacks?: number;
  allowed_layers?: EngineLayer[];
  preferred_layer?: EngineLayer;
  adapter_preference?: string;
}

/**
 * Execution context for the current environment.
 */
export interface EngineExecutionContext {
  tab_id?: number;
  window_id?: string;
  working_directory?: string;
  urls?: string[];
  attachments?: EngineAttachment[];
}

/**
 * Canonical engine execution request.
 */
export interface EngineExecutionRequest {
  mode: EngineMode;
  run_id?: string;
  session_id?: string;
  target_scope?: TargetScope;
  task?: string;
  actions?: EngineAction[];
  options?: EngineExecutionOptions;
  context?: EngineExecutionContext;
  metadata?: Record<string, unknown>;
}

/**
 * Selected route information from the engine.
 */
export interface EngineSelectedRoute {
  target_scope: TargetScope;
  starting_layer: EngineLayer;
  final_layer: EngineLayer;
  adapters?: string[];
}

/**
 * Artifact produced during execution.
 */
export interface EngineArtifact {
  type: string;
  artifact_id?: string;
  path?: string;
  url?: string;
  mime?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Single entry in the execution receipt log.
 */
export interface EngineReceiptEntry {
  kind: ReceiptKind;
  message: string;
  status: ReceiptStatus;
  receipt_id?: string;
  timestamp?: string;
  action_id?: string;
  adapter_id?: string;
  details?: Record<string, unknown>;
}

/**
 * Execution counters for tracking progress.
 */
export interface EngineCounters {
  steps?: number;
  actions?: number;
  fallbacks?: number;
  approvals?: number;
}

/**
 * Engine error details.
 */
export interface EngineError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Canonical engine execution result.
 */
export interface EngineExecutionResult {
  run_id: string;
  session_id: string;
  status: ExecutionStatus;
  mode: EngineMode;
  target_scope: TargetScope;
  selected_route: EngineSelectedRoute;
  summary: string;
  output?: unknown;
  artifacts?: EngineArtifact[];
  receipts?: EngineReceiptEntry[];
  counters?: EngineCounters;
  error?: EngineError;
}

/**
 * Engine event for real-time streaming.
 */
export interface EngineEvent {
  run_id: string;
  session_id: string;
  event_type: EngineEventType;
  mode: EngineMode;
  target_scope: TargetScope;
  message: string;
  data?: unknown;
  event_id?: string;
  timestamp?: string;
  layer?: EngineLayer;
  adapter_id?: string;
}

// =============================================================================
// HTTP API Request/Response Models
// =============================================================================

/**
 * Request for POST /v1/execute
 */
export interface ExecuteRequest {
  mode: EngineMode;
  run_id?: string;
  session_id?: string;
  target_scope?: TargetScope;
  task?: string;
  actions?: EngineAction[];
  options?: EngineExecutionOptions;
  context?: EngineExecutionContext;
  metadata?: Record<string, unknown>;
}

/**
 * Response from POST /v1/execute
 */
export interface ExecuteResponse extends EngineExecutionResult {}

/**
 * Request for POST /v1/sessions
 */
export interface SessionCreateRequest {
  session_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response from POST /v1/sessions
 */
export interface SessionCreateResponse {
  session_id: string;
  created: boolean;
  message: string;
}

/**
 * Response from GET /v1/sessions/{session_id}
 */
export interface SessionResponse {
  session_id: string;
  run_count: number;
  status_counts?: Record<string, number>;
  latest_run_id?: string;
  runs?: Record<string, unknown>[];
  created_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Response from DELETE /v1/sessions/{session_id}
 */
export interface SessionCloseResponse {
  session_id: string;
  closed: boolean;
  runs_affected: number;
  message: string;
}

/**
 * Request for POST /v1/approve/{run_id}
 */
export interface ApprovalRequest {
  decision: ApprovalDecision;
  approver_id?: string;
  comment?: string;
}

/**
 * Response from POST /v1/approve/{run_id}
 */
export interface ApprovalResponse {
  run_id: string;
  decision: string;
  status: ExecutionStatus;
  result?: Record<string, unknown>;
  message: string;
}

/**
 * Request for control operations (pause, resume, cancel)
 */
export interface ControlRequest {
  actor_id?: string;
  comment?: string;
}

/**
 * Response from control operations
 */
export interface ControlResponse {
  run_id: string;
  status?: string;
  control?: Record<string, unknown>;
  message: string;
}

/**
 * Response from GET /v1/runs/{run_id}
 */
export interface RunStatusResponse {
  run_id: string;
  session_id?: string;
  status: string;
  mode?: EngineMode;
  target_scope?: TargetScope;
  summary: string;
  created_at?: string;
  updated_at?: string;
  completed: boolean;
  request?: Record<string, unknown>;
  result?: Record<string, unknown>;
  receipts?: Record<string, unknown>[];
  artifacts?: Record<string, unknown>[];
  events?: Record<string, unknown>;
  control?: Record<string, unknown>;
  trace?: Record<string, unknown>;
}

/**
 * Run list item for listing runs.
 */
export interface RunListItem {
  run_id: string;
  session_id?: string;
  status?: string;
  mode?: EngineMode;
  target_scope?: TargetScope;
  summary?: string;
  created_at?: string;
  updated_at?: string;
  completed?: boolean;
  control_state?: string;
  event_count?: number;
  receipt_count?: number;
  artifact_count?: number;
}

/**
 * Response from GET /v1/runs
 */
export interface RunsListResponse {
  runs: RunListItem[];
  count: number;
}

/**
 * Response from GET /v1/runs/{run_id}/events
 */
export interface RunEventsResponse {
  run_id: string;
  events: Record<string, unknown>[];
  completed: boolean;
  status?: string;
  next_index: number;
}

/**
 * Response from GET /v1/sessions
 */
export interface SessionsListResponse {
  sessions: Record<string, unknown>[];
  count: number;
}

/**
 * Response from GET /v1/runs/{run_id}/approval
 */
export interface PendingApprovalResponse {
  run_id: string;
  has_pending_approval: boolean;
  approval_id?: string;
  action_preview?: Record<string, unknown>;
  reason?: string;
  requested_at?: string;
  expires_at?: string;
}

// =============================================================================
// Service Layer Types (browser, vision, desktop, parallel, telemetry)
// =============================================================================

export type BrowserTaskMode = 'browser-use' | 'playwright' | 'computer-use';
export type BrowserTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BrowserTaskRequest {
  goal: string;
  url?: string;
  mode?: BrowserTaskMode;
}

export interface BrowserTaskResponse {
  task_id: string;
  status: BrowserTaskStatus;
  mode: BrowserTaskMode;
  created_at: string;
}

export interface BrowserTaskDetailResponse extends BrowserTaskResponse {
  goal: string;
  url?: string;
  result?: string;
  error?: string;
  completed_at?: string;
}

export interface BrowserTaskExecuteRequest {
  llm_config?: {
    base_url?: string;
    api_key?: string;
    model?: string;
    [key: string]: unknown;
  };
}

export interface BrowserTaskExecuteResponse {
  task_id: string;
  status: BrowserTaskStatus;
  result?: string;
  error?: string;
  completed_at?: string;
}

export interface BrowserSearchRequest {
  query: string;
  search_engine?: string;
  llm_config?: Record<string, unknown>;
}

export interface BrowserRetrieveRequest {
  url: string;
  llm_config?: Record<string, unknown>;
}

export interface BrowserHealthResponse {
  available: boolean;
  service: string;
  modes: BrowserTaskMode[];
  chromium: boolean;
  cdp_protocol: boolean;
}

export interface VisionViewport {
  w: number;
  h: number;
}

export interface VisionProposeRequest {
  session_id: string;
  task: string;
  screenshot: string;
  viewport: VisionViewport;
  constraints?: Record<string, unknown>;
}

export interface ActionProposal {
  type: string;
  x?: number;
  y?: number;
  text?: string;
  confidence: number;
  target?: string;
  thought?: string;
}

export interface VisionProposeResponse {
  proposals: ActionProposal[];
  model: string;
  latency_ms: number;
}

export interface VisionScreenshotResponse {
  screenshot: string;
}

export interface DesktopExecuteRequest {
  session_id: string;
  instruction: string;
  app?: string;
}

export interface DesktopExecuteResponse {
  success: boolean;
  actions_taken: number;
  summary: string;
  error?: string;
}

export interface ParallelVariantConfig {
  variantId: string;
  model: string;
  agentType?: string;
  params?: Record<string, unknown>;
  priority?: number;
}

export interface ParallelVerificationProfile {
  tests?: boolean;
  linting?: boolean;
  typechecking?: boolean;
  customChecks?: unknown[];
}

export interface ParallelRunRequest {
  jobId: string;
  goal: string;
  beadsIssueId?: string;
  variants: ParallelVariantConfig[];
  verificationProfile?: ParallelVerificationProfile;
  snapshotId?: string;
  createdAt?: string;
  llm_config?: Record<string, unknown>;
}

export interface ParallelRunStatus {
  status: string;
  progress: number;
  activeVariants: number;
  completedVariants: number;
  totalVariants: number;
  updatedAt: string;
}

export interface ParallelVariantResult {
  variantId: string;
  status: string;
  output?: string;
  previewUrl?: string;
  diff?: string;
  verificationResults: Record<string, unknown>[];
  error?: string;
}

export interface ParallelRunResults {
  status: string;
  variants: ParallelVariantResult[];
  createdAt: string;
  completedAt?: string;
}

export interface TelemetryProviderInfo {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

export interface TelemetrySnapshot {
  session_id: string;
  [key: string]: unknown;
}

/**
 * Error response.
 */
export interface ErrorResponse {
  error: string;
  detail?: string;
  code?: string;
}

// =============================================================================
// SDK-Specific Types
// =============================================================================

/**
 * Client configuration options.
 */
export interface ClientConfig {
  endpoint: string;
  timeout?: number;
  apiKey?: string;
  headers?: Record<string, string>;
}

/**
 * Options for execute shortcuts.
 */
export interface ExecuteShortcutOptions extends EngineExecutionOptions {
  target_scope?: TargetScope;
  session_id?: string;
  run_id?: string;
  context?: Partial<EngineExecutionContext>;
  metadata?: Record<string, unknown>;
}

/**
 * Event handler callback type.
 */
export type EventHandler = (event: EngineEvent) => void | Promise<void>;

/**
 * Approval handler callback type.
 */
export type ApprovalHandlerCallback = (
  request: ApprovalRequestInfo
) => boolean | Promise<boolean>;

/**
 * Information about an approval request.
 */
export interface ApprovalRequestInfo {
  run_id: string;
  event: EngineEvent;
  message: string;
  action_summary?: string;
}

/**
 * Predicate function for conditional auto-approval.
 */
export type ApprovalPredicate = (
  request: ApprovalRequestInfo
) => boolean | Promise<boolean>;

/**
 * Event stream subscription options.
 */
export interface SubscribeOptions {
  /** Start from a specific event index (default: 0) */
  afterIndex?: number;
  /** Auto-unsubscribe after run completes (default: true) */
  autoClose?: boolean;
}
