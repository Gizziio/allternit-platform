/**
 * Cowork Mode Types
 * Event-driven protocol for agentic computer use (viewport + timeline)
 */

// ============================================================================
// Core Event Types
// ============================================================================

export type CoworkEventType = 
  | 'cowork.session.start'
  | 'cowork.session.end'
  | 'cowork.observation'
  | 'cowork.action'
  | 'cowork.command'
  | 'cowork.file'
  | 'cowork.tool_call'
  | 'cowork.tool_result'
  | 'cowork.approval_request'
  | 'cowork.approval_result'
  | 'cowork.checkpoint'
  | 'cowork.restore'
  | 'cowork.narration'
  | 'cowork.takeover'
  | 'status_change';

export interface CoworkEvent {
  id: string;
  type: CoworkEventType;
  timestamp: number;
  sessionId: string;
}

// ============================================================================
// Session Events
// ============================================================================

export interface SessionStartEvent extends CoworkEvent {
  type: 'cowork.session.start';
  viewportType: 'browser' | 'desktop' | 'remote';
  targetUrl?: string;
  context: {
    task: string;
    constraints?: string[];
  };
}

export interface SessionEndEvent extends CoworkEvent {
  type: 'cowork.session.end';
  reason: 'completed' | 'error' | 'user_terminated' | 'timeout';
  summary?: string;
}

// ============================================================================
// Observation Events (Screenshots, DOM state, etc.)
// ============================================================================

export interface ObservationEvent extends CoworkEvent {
  type: 'cowork.observation';
  frameId: string;
  imageRef: string; // URL or base64
  metadata: {
    width: number;
    height: number;
    url?: string;
    title?: string;
  };
  ocr?: {
    text: string;
    regions: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
    }>;
  };
  labels?: Array<{
    id: string;
    x: number;
    y: number;
    text: string;
    type: 'button' | 'input' | 'link' | 'text';
  }>;
}

// ============================================================================
// Action Events (Click, Type, Scroll, etc.)
// ============================================================================

export type ActionType = 
  | 'click'
  | 'double_click'
  | 'type'
  | 'keypress'
  | 'scroll'
  | 'hover'
  | 'drag'
  | 'screenshot'
  | 'navigate'
  | 'wait';

export interface ActionEvent extends CoworkEvent {
  type: 'cowork.action';
  actionId: string;
  actionType: ActionType;
  target?: {
    type: 'coordinates' | 'selector' | 'label_id';
    value: string; // "x,y" or "#id" or "label_123"
  };
  args?: Record<string, any>; // { text: "hello", delay: 100 }
  humanReadable: string; // "Click button 'Submit' at (450, 320)"
  frameId: string; // Reference to observation this action was based on
}

// ============================================================================
// Command Events (Terminal/Shell commands)
// ============================================================================

export interface CommandEvent extends CoworkEvent {
  type: 'cowork.command';
  commandId: string;
  commands: string[]; // Multiple commands can be batched
  cwd?: string;
  env?: Record<string, string>;
  result?: {
    stdout: string;
    stderr: string;
    exitCode: number;
  };
}

// ============================================================================
// File Events (Read/Edit/Create/Delete files)
// ============================================================================

export type FileOperation = 'read' | 'edit' | 'create' | 'delete';

export interface FileEvent extends CoworkEvent {
  type: 'cowork.file';
  operation: FileOperation;
  files: Array<{
    path: string;
    name: string;
    content?: string;
    changes?: number; // Number of lines changed
    diff?: string; // Unified diff for edits
  }>;
}

// ============================================================================
// Tool Events (Tool calls and results)
// ============================================================================

export interface ToolCallEvent extends CoworkEvent {
  type: 'cowork.tool_call';
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
}

export interface ToolResultEvent extends CoworkEvent {
  type: 'cowork.tool_result';
  toolCallId: string;
  result: any;
  error?: string;
}

// ============================================================================
// Approval Events (Safety Gates)
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ApprovalRequestEvent extends CoworkEvent {
  type: 'cowork.approval_request';
  actionId: string;
  riskLevel: RiskLevel;
  summary: string;
  details: {
    actionType: ActionType;
    target?: string;
    args?: Record<string, any>;
    consequence: string; // "This will submit a payment of $50"
  };
  timeout?: number; // Seconds before auto-reject
}

export interface ApprovalResultEvent extends CoworkEvent {
  type: 'cowork.approval_result';
  actionId: string;
  approved: boolean;
  userNote?: string;
  responder: 'user' | 'auto' | 'timeout';
}

// ============================================================================
// Checkpoint Events (Save/Restore)
// ============================================================================

export interface CheckpointEvent extends CoworkEvent {
  type: 'cowork.checkpoint';
  checkpointId: string;
  label: string;
  state: {
    frameId: string;
    url?: string;
    cookies?: Record<string, string>;
    localStorage?: Record<string, string>;
  };
}

export interface RestoreEvent extends CoworkEvent {
  type: 'cowork.restore';
  checkpointId: string;
}

// ============================================================================
// Narration Events (Assistant Chat within Cowork)
// ============================================================================

export interface NarrationEvent extends CoworkEvent {
  type: 'cowork.narration';
  text: string;
  style: 'thinking' | 'action' | 'result' | 'question';
}

// ============================================================================
// Takeover Events (User Manual Control)
// ============================================================================

export interface TakeoverEvent extends CoworkEvent {
  type: 'cowork.takeover';
  userId: string;
  reason?: string;
  duration?: number; // seconds, if known
}

// ============================================================================
// Union Type
// ============================================================================

export interface StatusChangeEvent extends CoworkEvent {
  type: 'status_change';
  status: 'running' | 'paused' | 'error' | 'completed';
}

export type AnyCoworkEvent =
  | SessionStartEvent
  | SessionEndEvent
  | ObservationEvent
  | ActionEvent
  | CommandEvent
  | FileEvent
  | ToolCallEvent
  | ToolResultEvent
  | ApprovalRequestEvent
  | ApprovalResultEvent
  | CheckpointEvent
  | RestoreEvent
  | NarrationEvent
  | TakeoverEvent
  | StatusChangeEvent;

// ============================================================================
// Session State
// ============================================================================

export type CoworkSessionStatus = 
  | 'idle'
  | 'running'
  | 'paused'
  | 'waiting_approval'
  | 'takeover'
  | 'completed'
  | 'error';

export interface CoworkSession {
  id: string;
  status: CoworkSessionStatus;
  viewportType: 'browser' | 'desktop' | 'remote';
  events: AnyCoworkEvent[];
  currentObservation?: ObservationEvent;
  pendingApprovals: ApprovalRequestEvent[];
  checkpoints: CheckpointEvent[];
  takeover?: {
    active: boolean;
    userId?: string;
    startedAt?: number;
  };
  metrics: {
    actionsExecuted: number;
    approvalsRequested: number;
    timeRunning: number; // seconds
  };
}

// ============================================================================
// Controls
// ============================================================================

export type CoworkControlAction =
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'step' } // Execute one action then pause
  | { type: 'stop' }
  | { type: 'approve'; actionId: string; note?: string }
  | { type: 'reject'; actionId: string; note?: string }
  | { type: 'takeover' }
  | { type: 'release_takeover' }
  | { type: 'restore'; checkpointId: string };
