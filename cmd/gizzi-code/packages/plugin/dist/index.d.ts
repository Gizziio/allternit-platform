import type { A2RClient } from "@a2r/sdk"

// ── PluginInput ────────────────────────────────────────────────────────────────

export interface PluginInput {
  client: A2RClient
  project: string
  worktree: string
  directory: string
  serverUrl: string
  $: typeof Bun.$
}

// ── Plugin ─────────────────────────────────────────────────────────────────────

/** A plugin module export — a function that receives input and returns hooks */
export type Plugin = (input: PluginInput) => Promise<Hooks>

// ── Hooks ──────────────────────────────────────────────────────────────────────

export interface Hooks {
  /** Called to set up authentication for a provider */
  auth?: AuthHook

  /** Called before each chat request to inject/modify headers */
  "chat.headers"?: (
    input: { sessionID: string; providerID: string; modelID: string },
    output: { headers: Record<string, string> },
  ) => void | Promise<void>

  /** Called before a tool executes — can block execution */
  "tool.execute.before"?: (
    input: { tool: string; input: Record<string, unknown>; sessionID: string },
    output: { blocked?: boolean; blockedReason?: string; __blocked?: boolean; __blockedReason?: string },
  ) => void | Promise<void>

  /** Called after a tool executes — can modify output */
  "tool.execute.after"?: (
    input: { tool: string; input: Record<string, unknown>; output: string; sessionID: string },
    output: { output?: string },
  ) => void | Promise<void>

  /** Called with full config on startup */
  config?: (config: Record<string, unknown>) => void | Promise<void>

  /** Called for every bus event emitted */
  event?: (input: { event: { type: string; properties?: unknown } }) => void | Promise<void>

  /** Additional tool definitions contributed by the plugin */
  tool?: Record<string, import("./tool.js").ToolDefinition>
}

// ── Auth hook ─────────────────────────────────────────────────────────────────

export interface AuthHook {
  provider: string
  loader: (input: { providerID: string }) => Promise<AuthOuathResult | undefined>
  methods?: AuthMethod[]
}

export interface AuthMethod {
  id: string
  name: string
  type: "oauth" | "api_key"
}

/** OAuth result returned from an auth plugin loader */
export interface AuthOuathResult {
  token: string
  expiresAt?: number
  refreshToken?: string
  providerID?: string
}
