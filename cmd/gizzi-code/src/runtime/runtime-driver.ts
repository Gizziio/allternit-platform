import type { LanguageModelV2StreamPart } from "@ai-sdk/provider"

export interface Attachment {
  filename: string
  mimeType: string
  content: string | Uint8Array
}

export interface AgentTask {
  taskId: string
  prompt: string
  cwd?: string
  env?: Record<string, string>
  systemPrompt?: string
  attachments?: Attachment[]
}

export interface TaskHandle {
  taskId: string
  runtimeId: string
  cliName: string
}

export type AgentEvent =
  | { type: "status"; status: "queued" | "running" | "completed" | "failed" | "cancelled" }
  | { type: "text_delta"; delta: string }
  | { type: "tool_call"; id: string; name: string; arguments: unknown }
  | { type: "tool_result"; id: string; content: string; isError?: boolean }
  | { type: "error"; error: unknown }
  | {
      type: "finish"
      finishReason: string
      usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
    }

export interface ExecutionLog {
  taskId: string
  runtimeId: string
  cliName: string
  status: AgentEvent & { type: "status" } extends { status: infer S } ? S : never
  startedAt?: number
  finishedAt?: number
  events: AgentEvent[]
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number }
  exitCode?: number
  errorMessage?: string
}

export interface RuntimeDriver {
  assign(task: AgentTask): Promise<TaskHandle>
  stream(handle: TaskHandle): AsyncIterable<AgentEvent>
  abort(handle: TaskHandle): Promise<void>
  inspect(handle: TaskHandle): Promise<ExecutionLog>
}
