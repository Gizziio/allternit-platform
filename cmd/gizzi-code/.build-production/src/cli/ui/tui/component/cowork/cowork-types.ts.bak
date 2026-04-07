/**
 * Cowork Mode Types - Event protocol for collaborative workspace
 */

export type EventType =
  | "message"
  | "command"
  | "file_edit"
  | "file_create"
  | "file_delete"
  | "tool_call"
  | "tool_result"
  | "action"
  | "approval_request"
  | "approval_response"
  | "checkpoint"
  | "narration"
  | "error"
  | "status"

export type EventStatus = "pending" | "running" | "completed" | "failed" | "approved" | "denied"

export interface CoworkEvent {
  id: string
  sequence: number
  type: EventType
  status: EventStatus
  timestamp: number
  actor: "user" | "agent" | "system"
  payload: EventPayload
}

export type EventPayload =
  | MessagePayload
  | CommandPayload
  | FileEditPayload
  | ToolCallPayload
  | ActionPayload
  | ApprovalPayload
  | CheckpointPayload
  | NarrationPayload
  | ErrorPayload
  | StatusPayload

export interface MessagePayload {
  content: string
  mentions?: string[]
}

export interface CommandPayload {
  command: string
  working_dir?: string
  env?: Record<string, string>
  output?: string
  exit_code?: number
}

export interface FileEditPayload {
  path: string
  operation: "edit" | "create" | "delete"
  diff?: string
  additions?: number
  deletions?: number
  content?: string
}

export interface ToolCallPayload {
  tool: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
}

export interface ActionPayload {
  action: "click" | "type" | "navigate" | "scroll" | "wait"
  target?: string
  value?: string
  url?: string
  coordinates?: { x: number; y: number }
}

export interface ApprovalPayload {
  title: string
  description?: string
  action_type: string
  priority: "low" | "medium" | "high"
  requester: string
  response?: "approved" | "denied"
  reason?: string
}

export interface CheckpointPayload {
  name: string
  description?: string
  step_cursor: string
  files_snapshot?: string[]
}

export interface NarrationPayload {
  content: string
  style?: "thinking" | "explaining" | "confirming" | "questioning"
}

export interface ErrorPayload {
  message: string
  stack?: string
  recoverable?: boolean
}

export interface StatusPayload {
  message: string
  progress?: number
  total_steps?: number
  completed_steps?: number
}

export interface CoworkSession {
  id: string
  name: string
  status: "active" | "paused" | "completed" | "failed"
  mode: "local" | "remote" | "cloud"
  created_at: number
  updated_at: number
  events: CoworkEvent[]
  context: {
    working_dir: string
    agent: string
    runtime: string
  }
  progress: {
    total: number
    completed: number
    current_step?: string
  }
  files_touched: FileChange[]
}

export interface FileChange {
  path: string
  operation: "added" | "modified" | "deleted"
  additions: number
  deletions: number
  timestamp: number
}
