/**
 * UI Contract Legacy - Contract Identifiers
 * 
 * This module defines the contract ID for the legacy UI binding.
 * Versions live in constants, not folder names.
 * 
 * @module @a2rchitech/gateway-contracts
 */

/**
 * UI Contract ID - Legacy binding for existing UI v0
 * Format: <contract-name>@<date>
 */
export const UI_CONTRACT_ID = 'ui-contract-legacy@2026-02';

/**
 * Contract version info
 */
export const CONTRACT_VERSION = {
  major: 0,
  minor: 1,
  patch: 0,
  label: 'legacy',
  frozen: true,
};

/**
 * Canonical event types supported by this contract
 */
export const CANONICAL_EVENTS = [
  // Server lifecycle
  'server.connected',
  'server.heartbeat',
  
  // Session lifecycle
  'session.created',
  'session.updated',
  'session.deleted',
  'session.status_changed',
  
  // Message lifecycle
  'message.created',
  'message.updated',
  'message.removed',
  
  // Part lifecycle (streaming)
  'part.created',
  'part.updated',
  'part.delta',
  'part.removed',
  
  // Tool state
  'tool.state_changed',
  
  // Permission system
  'permission.requested',
  'permission.resolved',
  
  // Question system
  'question.requested',
  'question.resolved',
  'question.rejected',
  
  // Other systems
  'todo.updated',
  'lsp.updated',
  'vcs.updated',
  'file_watch.updated',
  'pty.output',
  'pty.exited',
  'worktree.ready',
  'worktree.failed',
  
  // System
  'health.check',
  'error',
] as const;

/**
 * UI v0 event type mapping (canonical → UI type names)
 */
export const UI_EVENT_TYPE_MAP: Record<string, string> = {
  'server.connected': 'SERVER_CONNECTED',
  'server.heartbeat': 'SERVER_HEARTBEAT',
  'session.created': 'SESSION_CREATED',
  'session.updated': 'SESSION_UPDATED',
  'session.deleted': 'SESSION_DELETED',
  'session.status_changed': 'SESSION_STATUS_CHANGED',
  'message.created': 'MESSAGE_CREATED',
  'message.updated': 'MESSAGE_UPDATED',
  'message.removed': 'MESSAGE_REMOVED',
  'part.created': 'PART_CREATED',
  'part.updated': 'PART_UPDATED',
  'part.delta': 'PART_DELTA',
  'part.removed': 'PART_REMOVED',
  'tool.state_changed': 'TOOL_STATE_CHANGED',
  'permission.requested': 'PERMISSION_REQUESTED',
  'permission.resolved': 'PERMISSION_RESOLVED',
  'question.requested': 'QUESTION_REQUESTED',
  'question.resolved': 'QUESTION_RESOLVED',
  'question.rejected': 'QUESTION_REJECTED',
  'todo.updated': 'TODO_UPDATED',
  'lsp.updated': 'LSP_UPDATED',
  'vcs.updated': 'VCS_UPDATED',
  'file_watch.updated': 'FILE_WATCH_UPDATED',
  'pty.output': 'PTY_OUTPUT',
  'pty.exited': 'PTY_EXITED',
  'worktree.ready': 'WORKTREE_READY',
  'worktree.failed': 'WORKTREE_FAILED',
  'health.check': 'HEALTH_CHECK',
  'error': 'ERROR',
};

/**
 * SSE wire format envelope builder
 */
export function buildSSEEnvelope(
  directory: string,
  eventType: string,
  properties: Record<string, unknown>
): string {
  return JSON.stringify({
    directory,
    payload: {
      type: UI_EVENT_TYPE_MAP[eventType] || eventType,
      properties,
    },
  });
}
