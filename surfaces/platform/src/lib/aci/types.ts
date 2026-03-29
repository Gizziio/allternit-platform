/**
 * ACI Engine — Shared Types
 *
 * Normalized action types, risk tiers, and session state
 * used across all model adapters and the run loop.
 */

// ─────────────────────────────────────────────────────────────
// Risk Tiers
// ─────────────────────────────────────────────────────────────

/** T0 = read-only, T4 = destructive/irreversible */
export type RiskTier = 0 | 1 | 2 | 3 | 4;

export const RISK_LABELS: Record<RiskTier, string> = {
  0: 'T0 · Safe',
  1: 'T1 · Low',
  2: 'T2 · Medium',
  3: 'T3 · High',
  4: 'T4 · Critical',
};

// ─────────────────────────────────────────────────────────────
// ACI Action (normalized from any model)
// ─────────────────────────────────────────────────────────────

export type AciActionType =
  | 'screenshot'
  | 'observe'
  | 'navigate'
  | 'click'
  | 'double_click'
  | 'right_click'
  | 'hover'
  | 'type'
  | 'key'
  | 'hotkey'
  | 'scroll'
  | 'drag'
  | 'extract'
  | 'tab_create'
  | 'tab_close'
  | 'tab_switch'
  | 'tab_list'
  | 'done';

export interface AciAction {
  type: AciActionType;
  /** Pixel coordinate — set for click/hover/drag */
  x?: number;
  y?: number;
  /** End coordinate — set for drag */
  endX?: number;
  endY?: number;
  /** CSS selector or DOM ref */
  selector?: string;
  /** Text value for type actions */
  text?: string;
  /** URL for navigate/tab_create */
  url?: string;
  /** Keys for hotkey, e.g. ['Control', 'c'] */
  keys?: string[];
  /** Scroll direction */
  scrollDirection?: 'up' | 'down' | 'left' | 'right';
  scrollAmount?: number;
  /** Target tab id for tab_switch/tab_close */
  tabId?: string;
  /** Human-readable description of the action */
  label?: string;
  /** Risk tier — set by risk classifier before execution */
  risk?: RiskTier;
  /** Raw model output for debugging */
  raw?: unknown;
}

// ─────────────────────────────────────────────────────────────
// Run State
// ─────────────────────────────────────────────────────────────

export type RunStatus =
  | 'Idle'
  | 'Running'
  | 'WaitingApproval'
  | 'Done'
  | 'Error'
  | 'Stopped';

export interface RunState {
  sessionId: string;
  status: RunStatus;
  goal: string;
  adapterId: string;
  /** Current action being executed or awaiting approval */
  currentAction: AciAction | null;
  /** Latest screenshot as base64 PNG (without data: prefix) */
  screenshot: string | null;
  /** Human-readable step description */
  lastMessage: string | null;
  stepIndex: number;
  totalSteps: number | null;
  error: string | null;
  /** Milliseconds elapsed since run start */
  elapsedMs: number;
  /** Receipt count */
  receipts: number;
}

// ─────────────────────────────────────────────────────────────
// SSE Event
// ─────────────────────────────────────────────────────────────

export type SseEventType =
  | 'state'       // full RunState update
  | 'screenshot'  // screenshot-only update (frame without state change)
  | 'trace'       // adapter trace log line
  | 'error'       // fatal error
  | 'done';       // stream complete

export interface SseEvent {
  type: SseEventType;
  data: unknown;
  ts: number;
}

// ─────────────────────────────────────────────────────────────
// Adapter interface
// ─────────────────────────────────────────────────────────────

export interface ModelAdapter {
  /** Unique adapter ID, e.g. 'anthropic.claude-sonnet-4-6.computer_use' */
  adapterId: string;
  /**
   * Run one step of the vision→model→action loop.
   * Returns the next action(s) to execute, or null if the model signals done.
   */
  step(params: AdapterStepParams): Promise<AciAction[] | null>;
}

export interface AdapterStepParams {
  goal: string;
  screenshotB64: string;
  /** Previous actions taken this run */
  history: AciAction[];
  /** Result of the last executed action (if any) */
  lastResult?: unknown;
}

// ─────────────────────────────────────────────────────────────
// Run Session (server-side, kept in session store)
// ─────────────────────────────────────────────────────────────

export interface RunSession {
  sessionId: string;
  goal: string;
  adapter: ModelAdapter;
  state: RunState;
  /** Pending action waiting for user approval */
  pendingAction: AciAction | null;
  /** Resolves when user approves or denies */
  approvalPromise: Promise<boolean> | null;
  approvalResolve: ((approved: boolean) => void) | null;
  /** SSE subscribers */
  subscribers: Set<(event: SseEvent) => void>;
  /** Start timestamp */
  startedAt: number;
  /** Abort signal for stopping */
  abortController: AbortController;
}
