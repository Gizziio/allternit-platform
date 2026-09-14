/**
 * GIZZI Continuity Types
 * 
 * Defines contracts for session discovery, parsing, and handoff
 */

export type ToolType = 
  | "gizzi" 
  | "claude_code" 
  | "codex" 
  | "copilot" 
  | "cursor" 
  | "gemini_cli"
  | "droid"
  | "gizzi_shell"
  | "qwen"
  | "kimi"
  | "minimax"
  | "glm"
  | "unknown"

export interface SessionSource {
  id: string
  tool: ToolType
  workspace_path: string
  created_at: number
  modified_at: number
  message_count: number
  title?: string
}

export interface UnifiedSession {
  id: string
  source: SessionSource
  context: SessionContext
}

export interface SessionContext {
  session_id: string
  source_tool: ToolType
  workspace_path: string
  model?: string
  time_start: number
  time_end?: number
  objective: string
  progress_summary: string[]
  decisions: string[]
  open_todos: TodoItem[]
  dag_tasks: DAGTask[]
  blockers: string[]
  files_changed: FileChange[]
  commands_executed: CommandsByCategory
  errors_seen: ErrorItem[]
  next_actions: NextAction[]
  gizzi_conventions?: GIZZIConventions
  references?: References
  evidence?: Evidence
  limits?: LimitsSnapshot
}

export interface TodoItem {
  task: string
  priority: "high" | "medium" | "low"
  blocking: boolean
}

/**
 * DAG Task - Structured workflow task with dependencies
 */
export interface DAGTask {
  id: string
  name: string
  description: string
  status: "pending" | "in_progress" | "completed" | "blocked" | "failed"
  dependencies: string[]
  priority: "critical" | "high" | "medium" | "low"
  blocking: boolean
  estimated_tokens?: number
  actual_tokens?: number
  started_at?: number
  completed_at?: number
  assigned_to?: ToolType
}

/**
 * GIZZI Conventions - Project-specific standards and patterns
 */
export interface GIZZIConventions {
  /** File naming conventions */
  file_naming?: {
    pattern: string
    examples: string[]
  }
  /** Code style rules */
  code_style?: {
    formatter?: string
    linter?: string
    rules_url?: string
  }
  /** Directory structure patterns */
  directory_structure?: {
    root_dirs: string[]
    patterns: string[]
  }
  /** Testing conventions */
  testing?: {
    framework: string
    pattern: string
    coverage_threshold?: number
  }
  /** Documentation standards */
  documentation?: {
    readme_required: boolean
    api_docs?: string
    changelog?: string
  }
  /** Git workflow */
  git_workflow?: {
    branching_strategy: string
    commit_convention: string
    pr_template?: string
  }
  /** Architecture patterns */
  architecture?: {
    pattern: string
    patterns_used: string[]
    forbidden_patterns: string[]
  }
  /** Review checklist */
  review_checklist?: string[]
}

export interface FileChange {
  path: string
  summary: string
  action: "created" | "modified" | "deleted" | "renamed"
  diff_ref?: string
}

export interface CommandsByCategory {
  build: string[]
  test: string[]
  lint: string[]
  git: string[]
  other: string[]
}

export interface ErrorItem {
  message: string
  tool: string
  recoverable: boolean
}

export interface NextAction {
  action: "edit" | "command" | "read" | "test" | "commit" | "review"
  description: string
  target?: string
  estimated_tokens?: number
}

export interface References {
  issue_ids?: string[]
  pr_ids?: string[]
  ticket_ids?: string[]
  links?: string[]
}

export interface Evidence {
  receipt_offset?: number
  state_hash?: string
  diff_refs?: string[]
  compact_ref?: string
}

export interface LimitsSnapshot {
  context_ratio: number
  quota_ratio: number
  tokens_input: number
  tokens_output: number
  tokens_total: number
  context_window: number
  cost_estimate?: number
  throttle_count: number
}

export interface HandoffBaton {
  version: "1.0.0"
  session_context: SessionContext
  generated_at: number
  target_tool?: ToolType
  compact_reason: "manual" | "threshold" | "quota" | "error"
}

export interface ParserAdapter {
  tool: ToolType
  canParse(path: string): Promise<boolean>
  parse(path: string): Promise<SessionSource>
}

export interface InjectorAdapter {
  tool: ToolType
  canLaunch(): Promise<boolean>
  launch(contextPath: string, options?: LaunchOptions): Promise<void>
}

export interface LaunchOptions {
  workspace?: string
  stdin?: boolean
  promptFlag?: boolean
  envVars?: Record<string, string>
}

export interface IndexEntry {
  session_id: string
  tool: ToolType
  workspace_path: string
  modified_at: number
  ttl_expires_at: number
}

export interface UnifiedIndex {
  entries: IndexEntry[]
  last_scan_at: number
  scan_ttl_ms: number
}
