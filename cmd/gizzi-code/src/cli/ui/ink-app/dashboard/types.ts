// @ts-nocheck
/**
 * Dashboard types — the UI is source-agnostic.
 *
 * Rows may come from in-process top-level sessions today and from a
 * `gizzi serve` session registry later; both implement DashboardSource.
 */

export type DashboardSessionState =
  | 'working'
  | 'idle'
  | 'needs-input'
  | 'completed'
  | 'failed'
  | 'inactive'

export type DashboardRow = {
  /** In-process: local_agent taskId. Server source (future): ses_ id. */
  id: string
  source: 'in-process' // future: 'server'
  title: string
  state: DashboardSessionState
  /** One-line "what is it doing" (tool count, current tool, spinner verb). */
  activityLine: string
  directory: string
  model?: string
  permissionMode?: string
  pinned: boolean
  createdAt: number
  updatedAt: number
}

export type DashboardPeek = {
  lastResponseType: string
  lastResponseText: string
  lastActivityAt: number
}

/**
 * Everything the dashboard UI needs from a session provider.
 *
 * Future ServerDashboardSource mapping (endpoints already exist on
 * `gizzi serve`): list/state  → GET /session/list + GET /session/status
 *                peek          → GET /session/:id/replay
 *                reply/dispatch→ POST /session/:id/message, POST /session/
 *                stop          → POST /session/:id/abort (+ DELETE /:id)
 *                rename        → PATCH /session/:id
 * Implement DashboardSource against those and merge rows from both
 * sources; no UI changes needed.
 */
export interface DashboardSource {
  list(): DashboardRow[]
  peek(id: string): DashboardPeek | undefined
  /** Send a follow-up to an existing session. */
  reply(id: string, text: string): void
  /** Spawn a new top-level session with the given prompt. Returns row id. */
  dispatch(prompt: string, opts?: { model?: string; permissionMode?: string }): string
  /** Cancel the running turn (session survives) or kill when idle. */
  stop(id: string): void
  /** Permanently remove a session. */
  remove(id: string): void
  rename(id: string, title: string): void
  setPinned(id: string, pinned: boolean): void
}
