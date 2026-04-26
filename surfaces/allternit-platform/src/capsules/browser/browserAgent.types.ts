/**
 * Allternit Browser Agent Event Stream Types
 * 
 * Unified event model for agentic browser automation.
 * Aligns with:
 * - ActionContract.json (11 action types)
 * - Receipts.json (evidence schema)
 * - PolicyTiers.md (Tier 0-4 risk levels)
 * - ShellUIAgenticBrowser.md (renderer separation, budgets, suspend/resume)
 */

// ============================================================================
// Action Types (from ActionContract.json)
// ============================================================================

export type BrowserActionType =
  | 'Navigate'
  | 'Click'
  | 'Type'
  | 'Select'
  | 'Scroll'
  | 'Wait'
  | 'Assert'
  | 'Extract'
  | 'Screenshot'
  | 'Download'
  | 'ConfirmGate';

// ============================================================================
// Risk Tiers (from PolicyTiers.md)
// ============================================================================

export type RiskTier = 0 | 1 | 2 | 3 | 4;

export const RISK_TIER_LABELS: Record<RiskTier, string> = {
  0: 'Read-only',
  1: 'Low-impact navigation',
  2: 'Form fill (no commit)',
  3: 'Commit actions',
  4: 'Irreversible changes',
};

export const RISK_TIER_REQUIRES_CONFIRMATION: Record<RiskTier, boolean> = {
  0: false,
  1: false,
  2: false,
  3: true,  // Requires human confirmation
  4: true,  // Requires secondary confirmation
};

// ============================================================================
// Selector Strategies (from ActionContract.json)
// ============================================================================

export type SelectorStrategy = 'css' | 'xpath' | 'text' | 'aria' | 'role' | 'semantic';

export interface Selector {
  strategy: SelectorStrategy;
  value: string;
  fallbacks?: Selector[];
  stabilityHint?: {
    score: number;  // 0-1
    notes?: string;
  };
}

// ============================================================================
// Page State (from Receipts.json)
// ============================================================================

export interface PageState {
  url: string;
  title: string;
  domHash: string;  // SHA256 of redacted DOM snapshot
  viewport?: {
    width: number;
    height: number;
    devicePixelRatio?: number;
  };
}

// ============================================================================
// Artifacts (from Receipts.json)
// ============================================================================

export type ArtifactKind =
  | 'screenshot'
  | 'dom_snippet'
  | 'table_json'
  | 'form_json'
  | 'download'
  | 'selection_text'
  | 'note';

export interface Artifact {
  kind: ArtifactKind;
  sha256: string;
  mime?: string;
  path?: string;  // Relative path in evidence store
  meta?: Record<string, unknown>;
}

// ============================================================================
// Trace Events (from Receipts.json)
// ============================================================================

export type TraceEventType =
  | 'policy_check'
  | 'selector_resolve'
  | 'action_start'
  | 'action_end'
  | 'assertion'
  | 'retry'
  | 'screenshot'
  | 'extract'
  | 'download'
  | 'human_confirm_prompt'
  | 'human_confirm_result'
  | 'error';

export interface TraceEvent {
  t: string;  // ISO 8601 timestamp
  type: TraceEventType;
  data?: Record<string, unknown>;
}

// ============================================================================
// Policy Decision (from Receipts.json)
// ============================================================================

export type PolicyDecisionType = 'allow' | 'deny' | 'require_confirm';

export interface PolicyDecision {
  decision: PolicyDecisionType;
  reason?: string;
  ruleId?: string;
}

// ============================================================================
// Action Contract (from ActionContract.json)
// ============================================================================

export interface Assertion {
  kind:
    | 'UrlMatches'
    | 'TitleContains'
    | 'ElementExists'
    | 'TextPresent'
    | 'ValueEquals'
    | 'NetworkIdle'
    | 'Visible'
    | 'NotVisible'
    | 'AttributeEquals'
    | 'CustomPredicate';
  selector?: Selector;
  expected?: unknown;
  pattern?: string;  // Regex pattern for UrlMatches/TextPresent
  timeoutMs?: number;
  notes?: string;
}

export interface ActionBudget {
  stepBudget?: number;  // Max actions (1-1000)
  timeBudgetMs?: number;  // Max time (1000-3600000ms)
}

export interface EvidenceCapture {
  capture: Array<
    | 'screenshot_full'
    | 'screenshot_target'
    | 'dom_snippet'
    | 'dom_hash'
    | 'url_title'
    | 'selection'
    | 'network_idle_marker'
    | 'table_extract'
    | 'form_extract'
  >;
  redaction?: {
    maskSelectors?: Selector[];
    maskRegexes?: string[];
  };
}

export interface BrowserAction {
  id: string;
  type: BrowserActionType;
  riskTier: RiskTier;
  timeoutMs: number;
  retries: number;
  target: Selector;
  preconditions?: Assertion[];
  postconditions?: Assertion[];
  evidence: EvidenceCapture;
  policyTags?: string[];
  inputs?: Record<string, unknown>;
  budget?: ActionBudget;
}

// ============================================================================
// Browser Agent Event Stream
// ============================================================================

export type BrowserAgentEvent =
  // Session events
  | { type: 'session_created'; payload: SessionCreatedEvent }
  | { type: 'session_resumed'; payload: SessionResumedEvent }
  | { type: 'session_suspended'; payload: SessionSuspendedEvent }
  | { type: 'session_ended'; payload: SessionEndedEvent }
  
  // Action events
  | { type: 'action_proposed'; payload: ActionProposedEvent }
  | { type: 'action_started'; payload: ActionStartedEvent }
  | { type: 'action_completed'; payload: ActionCompletedEvent }
  | { type: 'action_failed'; payload: ActionFailedEvent }
  
  // Policy events
  | { type: 'policy_check'; payload: PolicyCheckEvent }
  | { type: 'confirmation_required'; payload: ConfirmationRequiredEvent }
  | { type: 'confirmation_result'; payload: ConfirmationResultEvent }
  
  // Evidence events
  | { type: 'receipt_generated'; payload: ReceiptGeneratedEvent }
  | { type: 'artifact_captured'; payload: ArtifactCapturedEvent }
  
  // Budget events
  | { type: 'budget_warning'; payload: BudgetWarningEvent }
  | { type: 'budget_exceeded'; payload: BudgetExceededEvent }
  
  // Renderer events
  | { type: 'renderer_switch'; payload: RendererSwitchEvent }
  | { type: 'overlay_highlight'; payload: OverlayHighlightEvent };

// ============================================================================
// Event Payloads
// ============================================================================

export interface SessionCreatedEvent {
  sessionId: string;
  workspaceId: string;
  renderer: 'HUMAN' | 'AGENT';
  createdAt: string;  // ISO 8601
  allowlistHosts: string[];
}

export interface SessionResumedEvent {
  sessionId: string;
  checkpoint: SessionCheckpoint;
}

export interface SessionSuspendedEvent {
  sessionId: string;
  reason: 'user_pause' | 'budget_exceeded' | 'error' | 'system';
  checkpoint: SessionCheckpoint;
}

export interface SessionEndedEvent {
  sessionId: string;
  reason: 'completed' | 'cancelled' | 'error' | 'timeout';
  summary: {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    durationMs: number;
  };
}

export interface SessionCheckpoint {
  currentUrl: string;
  stepIndex: number;
  lastDomHash: string;
  lastReceiptHash: string;
  sessionIdentifiers?: Record<string, string>;
}

export interface ActionProposedEvent {
  sessionId: string;
  action: BrowserAction;
  planIndex: number;
  totalPlanSteps: number;
}

export interface ActionStartedEvent {
  sessionId: string;
  actionId: string;
  startedAt: string;
  beforeState: PageState;
}

export interface ActionCompletedEvent {
  sessionId: string;
  actionId: string;
  endedAt: string;
  afterState: PageState;
  resolvedTarget?: {
    selectorUsed: Selector;
    elementFingerprint?: string;
  };
}

export interface ActionFailedEvent {
  sessionId: string;
  actionId: string;
  endedAt: string;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  retryCount: number;
}

export interface PolicyCheckEvent {
  sessionId: string;
  actionId: string;
  riskTier: RiskTier;
  decision: PolicyDecision;
  checkedAt: string;
}

export interface ConfirmationRequiredEvent {
  sessionId: string;
  actionId: string;
  riskTier: RiskTier;
  actionSummary: string;
  targetHost: string;
  targetPath: string;
  evidenceCaptured: ArtifactKind[];
  irreversibleChange?: string;
  requiresSecondaryConfirmation: boolean;  // Tier 4
}

export interface ConfirmationResultEvent {
  sessionId: string;
  actionId: string;
  result: 'approved' | 'denied' | 'modified';
  confirmedAt: string;
  confirmationMethod: 'primary' | 'secondary';
  confirmationPhrase?: string;  // For Tier 4
}

export interface ReceiptGeneratedEvent {
  sessionId: string;
  actionId: string;
  receiptId: string;
  status: 'success' | 'fail' | 'blocked' | 'needs_confirm' | 'skipped';
  artifacts: Artifact[];
  trace: TraceEvent[];
}

export interface ArtifactCapturedEvent {
  sessionId: string;
  actionId: string;
  artifact: Artifact;
  capturedAt: string;
}

export interface BudgetWarningEvent {
  sessionId: string;
  budgetType: 'step' | 'time';
  remaining: number;
  total: number;
  percentageUsed: number;
}

export interface BudgetExceededEvent {
  sessionId: string;
  budgetType: 'step' | 'time';
  limit: number;
  actual: number;
}

export interface RendererSwitchEvent {
  sessionId: string;
  fromRenderer: 'HUMAN' | 'AGENT';
  toRenderer: 'HUMAN' | 'AGENT';
  switchedAt: string;
  reason: 'user_toggle' | 'auto_handoff' | 'policy_requirement';
}

export interface OverlayHighlightEvent {
  sessionId: string;
  actionId: string;
  selector: Selector;
  actionType: BrowserActionType;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  visible: boolean;
}

// ============================================================================
// Browser Agent Status (for UI Status Pill)
// ============================================================================

export type BrowserAgentStatus =
  | 'Idle'
  | 'Running'
  | 'WaitingApproval'
  | 'Blocked'
  | 'Done';

export const STATUS_TO_RENDERER: Record<BrowserAgentStatus, string> = {
  Idle: 'bg-gray-500',
  Running: 'bg-blue-500 animate-pulse',
  WaitingApproval: 'bg-yellow-500 animate-pulse',
  Blocked: 'bg-red-500',
  Done: 'bg-green-500',
};

// ============================================================================
// Browser Agent Mode
// ============================================================================

export type BrowserAgentMode = 'Human' | 'Assist' | 'Agent';

export const MODE_TO_RISK_LIMIT: Record<BrowserAgentMode, RiskTier> = {
  Human: 0,  // Read-only
  Assist: 2,  // Form fill without commit
  Agent: 4,  // Full automation with confirmations
};

// ============================================================================
// Endpoint Types
// ============================================================================

export type BrowserEndpoint =
  | { type: 'shell_browser'; sessionId: string }
  | { type: 'extension'; endpointId: string; tabId: number }
  | { type: 'platform_webview'; tabId?: number; label?: string };

// ============================================================================
// Receipt (from Receipts.json - full schema)
// ============================================================================

export interface BrowserReceipt {
  version: string;  // Semantic version (e.g., "v1.0.0")
  runId: string;
  actionId: string;
  status: 'success' | 'fail' | 'blocked' | 'needs_confirm' | 'skipped';
  startedAt: string;
  endedAt: string;
  riskTier: RiskTier;
  policyDecision?: PolicyDecision;
  before: PageState;
  after: PageState;
  resolvedTarget?: {
    selectorUsed: Selector;
    elementFingerprint?: string;
  };
  artifacts: Artifact[];
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  trace: TraceEvent[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an action requires confirmation based on risk tier
 */
export function requiresConfirmation(riskTier: RiskTier): boolean {
  return RISK_TIER_REQUIRES_CONFIRMATION[riskTier];
}

/**
 * Get the label for a risk tier
 */
export function getRiskTierLabel(riskTier: RiskTier): string {
  return RISK_TIER_LABELS[riskTier];
}

/**
 * Get the CSS class for a status pill
 */
export function getStatusPillClass(status: BrowserAgentStatus): string {
  return STATUS_TO_RENDERER[status] || 'bg-gray-500';
}

/**
 * Create a trace event with current timestamp
 */
export function createTraceEvent(
  type: TraceEventType,
  data?: Record<string, unknown>
): TraceEvent {
  return {
    t: new Date().toISOString(),
    type,
    data,
  };
}

/**
 * Validate that a BrowserAction conforms to policy constraints
 */
export function validateActionPolicy(
  action: BrowserAction,
  allowedHosts: string[],
  mode: BrowserAgentMode
): { valid: boolean; reason?: string } {
  const maxTier = MODE_TO_RISK_LIMIT[mode];
  
  if (action.riskTier > maxTier) {
    return {
      valid: false,
      reason: `Action risk tier (${action.riskTier}) exceeds mode limit (${maxTier})`,
    };
  }
  
  // Host validation would happen here
  // For now, just check that allowlist exists
  if (allowedHosts.length === 0) {
    return {
      valid: false,
      reason: 'No hosts allowlisted',
    };
  }
  
  return { valid: true };
}
