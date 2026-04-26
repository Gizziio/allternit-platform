# @allternit/sdk — Platform SDK Specification

**Version:** 1.0.0-draft
**Date:** 2026-03-15
**Status:** SPEC — not yet built

---

## Overview

`@allternit/sdk` is the nervous system of the Allternit platform. It is the single typed interface through which all product surfaces (TUI, gizzi attach, Allternit Desktop, thin-client, browser extensions, shell UIs, ACP adapters) communicate with the gizzi-code brain.

It is NOT:
- A renamed OpenCode SDK
- A raw HTTP wrapper
- An auto-generated client (no hey-api/openapi-ts codegen here)

It IS:
- A hand-authored, transport-agnostic TypeScript SDK
- The canonical type contract between gizzi-code and every surface
- Versioned, publishable, and semver-stable

---

## Transport Layer

The SDK auto-selects its transport based on context. All transports expose the same resource API.

```typescript
export type Transport =
  | RpcTransport    // In-process: TUI worker thread (Bun.Worker RPC)
  | HttpTransport   // Remote: HTTP + SSE to gizzi-code server
  | MockTransport   // Testing
```

### `createAllternitClient(options)`

```typescript
import { createAllternitClient } from "@allternit/sdk"

const sdk = createAllternitClient({
  // For HTTP transport (remote surfaces)
  baseUrl?: string                          // e.g. "http://localhost:4096"

  // For in-process transport (TUI worker)
  // Pass a custom fetch that routes to the local Hono server
  fetch?: typeof globalThis.fetch

  // Per-request directory scoping
  directory?: string

  // Auth (Basic, Bearer, or none)
  auth?: { username: string; password: string } | { token: string }
})
```

**Transport resolution order:**
1. If `fetch` is provided → uses it (in-process TUI pattern)
2. If `baseUrl` provided → HTTP transport
3. `GIZZI_BASE_URL` env var → HTTP transport
4. Auto-discover via mDNS → HTTP transport

---

## Resource Modules

All modules hang off the `sdk` object: `sdk.sessions`, `sdk.agents`, etc.

---

### `sdk.sessions`

Manages AI coding sessions.

```typescript
sdk.sessions.list(options?: {
  projectPath?: string
  limit?: number
  cursor?: string
}): Promise<{ sessions: Session[]; cursor?: string }>

sdk.sessions.get(id: string): Promise<Session>

sdk.sessions.create(input: {
  projectPath: string
  model?: { providerID: string; modelID: string }
  title?: string
}): Promise<Session>

sdk.sessions.delete(id: string): Promise<void>

sdk.sessions.run(id: string, input: {
  prompt: string
  attachments?: Attachment[]
}): Promise<Run>

sdk.sessions.abort(sessionId: string): Promise<void>

// Revert to a prior checkpoint
sdk.sessions.revert(id: string, options: {
  checkpointId: string
}): Promise<Session>

// Share a session (generate public link)
sdk.sessions.share(id: string): Promise<{ url: string; token: string }>

// Compact a session's context
sdk.sessions.compact(id: string): Promise<{ summary: string }>

// Get all messages in a session
sdk.sessions.messages(id: string, options?: {
  limit?: number
  cursor?: string
}): Promise<{ messages: Message[]; cursor?: string }>

// Export session to portable format
sdk.sessions.export(id: string): Promise<Blob>

// Import from JSON/file
sdk.sessions.import(data: string | Blob): Promise<Session>
```

**Session Continuity** (Allternit-native):

```typescript
// Get a handoff baton — cross-tool session transfer payload
sdk.sessions.handoff(id: string, options?: {
  targetTool?: ToolType        // "claude_code" | "codex" | "cursor" | "gizzi_shell" | ...
  reason?: "manual" | "threshold" | "quota" | "error"
}): Promise<HandoffBaton>

// Discover sessions from other tools (claude, codex, cursor, etc.)
sdk.sessions.discover(options?: {
  workspacePath?: string
  tools?: ToolType[]
}): Promise<UnifiedSession[]>

// Extract structured context from any session
sdk.sessions.extractContext(sessionId: string): Promise<SessionContext>

// Check if session is safe to hand off
sdk.sessions.checkGates(sessionId: string): Promise<{
  canHandoff: boolean
  blockers: string[]
  context: SessionContext
}>
```

**Types:**

```typescript
interface Session {
  id: string
  title?: string
  projectPath: string
  model?: { providerID: string; modelID: string }
  createdAt: string
  updatedAt: string
  messageCount: number
  tokenUsage: TokenUsage
  parentSessionId?: string
}

interface Run {
  id: string
  sessionId: string
  status: "running" | "completed" | "aborted" | "error"
  startedAt: string
  finishedAt?: string
}

interface Message {
  id: string
  sessionId: string
  role: "user" | "assistant" | "tool"
  content: ContentBlock[]
  createdAt: string
}

type ToolType =
  | "gizzi" | "claude_code" | "codex" | "copilot" | "cursor"
  | "gemini_cli" | "droid" | "gizzi_shell" | "qwen" | "kimi"
  | "minimax" | "glm" | "unknown"
```

---

### `sdk.agents`

Agent lifecycle and inter-agent communication.

```typescript
sdk.agents.list(): Promise<Agent[]>
sdk.agents.get(id: string): Promise<Agent>

// Register an agent into the communication runtime
sdk.agents.register(input: {
  id: string
  name: string
  capabilities?: string[]
}): Promise<Agent>

sdk.agents.unregister(id: string): Promise<void>

// Send a message to another agent (Allternit inter-agent protocol)
sdk.agents.send(input: {
  toAgentId: string
  message: string
  channel?: string
  replyTo?: string
}): Promise<{ messageId: string }>

// Broadcast to all agents on a channel
sdk.agents.broadcast(input: {
  channel: string
  message: string
}): Promise<void>

// Create/join a communication channel
sdk.agents.createChannel(name: string): Promise<{ channelId: string }>
sdk.agents.joinChannel(channelId: string): Promise<void>

// @mention routing — route a message to the mentioned agent
sdk.agents.mention(input: {
  text: string          // e.g. "@researcher investigate X"
  sourceSessionId: string
}): Promise<{
  routed: boolean
  targetAgentId?: string
  targetSessionId?: string
}>

// Check rate limit for an agent
sdk.agents.checkRateLimit(agentId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: string
}>
```

**Types:**

```typescript
interface Agent {
  id: string
  name: string
  capabilities: string[]
  registeredAt: string
  sessionId?: string
}
```

---

### `sdk.providers`

LLM provider management and discovery.

```typescript
// List all providers (configured + models.dev catalog + auto-discovered)
sdk.providers.list(options?: {
  source?: "configured" | "catalog" | "discovered" | "all"
}): Promise<Provider[]>

sdk.providers.get(id: string): Promise<Provider>
sdk.providers.add(input: ProviderConfig): Promise<Provider>
sdk.providers.remove(id: string): Promise<void>
sdk.providers.test(id: string): Promise<{ ok: boolean; latencyMs?: number; error?: string }>

// Auto-discovery: finds Claude CLI, Ollama, LM Studio, kimi, qwen, gemini, etc.
sdk.providers.discover(): Promise<DiscoveredProvider[]>

// List models for a provider (or all providers)
sdk.providers.models(providerId?: string): Promise<Model[]>

// Refresh models.dev cache
sdk.providers.refreshModels(): Promise<void>
```

**Types:**

```typescript
type ProviderSource = "api_key" | "subprocess" | "local_server" | "platform"

interface Provider {
  id: string
  name: string
  source: ProviderSource
  models: Record<string, ModelInfo>
  authType: "api_key" | "none" | "bearer" | "subprocess"
  isConfigured: boolean
}

interface DiscoveredProvider {
  id: string
  source: "subprocess" | "local" | "platform" | "plugin"
  models: Array<{ id: string; context?: number; output?: number }>
  executable?: string   // path to CLI binary
  endpoint?: string     // URL for local server
}

interface Model {
  id: string
  providerId: string
  name?: string
  context?: number
  output?: number
  inputCostPer1k?: number
  outputCostPer1k?: number
}
```

---

### `sdk.events`

Typed subscription to the GlobalBus event stream. This is the real-time nervous system — every surface subscribes here.

```typescript
// Subscribe to the live event stream (SSE under the hood)
sdk.events.subscribe(options?: {
  signal?: AbortSignal
  filter?: EventFilter
}): {
  stream: AsyncGenerator<AllternitEvent>
}

// Filter helpers
sdk.events.filter<T extends AllternitEventType>(
  stream: AsyncGenerator<AllternitEvent>,
  type: T
): AsyncGenerator<ExtractEvent<AllternitEvent, T>>
```

**Complete Event Type Map:**

```typescript
// ── Agent Communication ──────────────────────────────────────────────────────
"agent.communicate.message.sent"         // { fromId, toId, message, channel }
"agent.communicate.message.received"     // { fromId, toId, message, channel }
"agent.communicate.message.broadcast"    // { fromId, channel, message }
"agent.communicate.channel.created"      // { channelId, name }
"agent.communicate.channel.joined"       // { channelId, agentId }
"agent.communicate.loop.guard.triggered" // { agentId, reason }
"agent.registered"                       // { agentId, name }
"agent.unregistered"                     // { agentId }

// ── Mention Routing ──────────────────────────────────────────────────────────
"agent.mention.detected"                 // { text, sourceSessionId, mentionedAgent }
"agent.mention.routed"                   // { targetAgentId, targetSessionId }
"agent.mention.ignored"                  // { text, reason }

// ── Session / Run ────────────────────────────────────────────────────────────
"run.started"                            // { sessionId, runId }
"run.updated"                            // { sessionId, runId, delta }
"run.finished"                           // { sessionId, runId, usage }
"run.aborted"                            // { sessionId, runId }
"session.compacted"                      // { sessionId, summary }
"todo.updated"                           // { sessionId, todos }

// ── Permissions ──────────────────────────────────────────────────────────────
"permission.asked"                       // { sessionId, tool, args }
"permission.replied"                     // { sessionId, tool, granted }
"permission.updated"                     // { sessionId, rules }

// ── Tool Guard / Policy ──────────────────────────────────────────────────────
"tool.guard.warn"                        // { sessionId, reason }
"tool.guard.compact"                     // { sessionId }
"tool.guard.handoff"                     // { sessionId, targetTool }
"tool.guard.fail.closed"                 // { sessionId, reason }

// ── Questions ────────────────────────────────────────────────────────────────
"question.asked"                         // { id, sessionId, question, options }
"question.replied"                       // { id, answer }
"question.rejected"                      // { id, reason }

// ── Projects ─────────────────────────────────────────────────────────────────
"project.created"                        // { projectId, path }
"project.updated"                        // { projectId, changes }
"project.deleted"                        // { projectId }
"vcs.branch.updated"                     // { projectId, branch, commit }

// ── Worktrees ────────────────────────────────────────────────────────────────
"worktree.ready"                         // { worktreeId, path }
"worktree.failed"                        // { worktreeId, error }

// ── PTY (Terminal) ───────────────────────────────────────────────────────────
"pty.created"                            // { id, pid, cwd }
"pty.updated"                            // { id }
"pty.exited"                             // { id, exitCode }
"pty.deleted"                            // { id }

// ── MCP ──────────────────────────────────────────────────────────────────────
"mcp.tools.changed"                      // { serverName, tools }
"mcp.browser.open.failed"                // { serverName, url, error }

// ── LSP ──────────────────────────────────────────────────────────────────────
"lsp.diagnostics"                        // { file, diagnostics }
"lsp.updated"                            // {}

// ── Git Bundle ───────────────────────────────────────────────────────────────
"git.bundle.created"                     // { bundlePath, commits }
"git.bundle.validated"                   // { bundlePath, valid }
"git.bundle.extracted"                   // { bundlePath, targetPath }

// ── IDE ──────────────────────────────────────────────────────────────────────
"ide.installed"                          // { editorId, extensionVersion }

// ── User / Settings ──────────────────────────────────────────────────────────
"user.updated"                           // { user }
"settings.updated"                       // { scope: "global"|"project", settings }

// ── Cron ─────────────────────────────────────────────────────────────────────
"cron.job.created"                       // { jobId, name, schedule }
"cron.job.updated"                       // { jobId }
"cron.job.deleted"                       // { jobId }
"cron.run.started"                       // { jobId, runId }
"cron.run.completed"                     // { jobId, runId, durationMs }
"cron.run.failed"                        // { jobId, runId, error }
"cron.daemon.started"                    // {}
"cron.daemon.stopped"                    // {}

// ── Agent Auth ───────────────────────────────────────────────────────────────
"agent.auth.key.created"                 // { agentId, keyId }

// ── Server ───────────────────────────────────────────────────────────────────
"server.connected"                       // {}
"server.instance.disposed"               // {}
"instance.sync"                          // { directory }
```

---

### `sdk.cron`

Natural language automated scheduling with 5 executor types.

```typescript
sdk.cron.list(filter?: ListJobsFilter): Promise<CronJob[]>
sdk.cron.get(id: string): Promise<CronJob>
sdk.cron.create(input: CreateJobInput): Promise<CronJob>
sdk.cron.update(id: string, input: UpdateJobInput): Promise<CronJob>
sdk.cron.delete(id: string): Promise<void>
sdk.cron.pause(id: string): Promise<void>
sdk.cron.resume(id: string): Promise<void>
sdk.cron.trigger(id: string): Promise<CronRun>    // manual trigger

sdk.cron.runs(jobId: string, filter?: ListRunsFilter): Promise<CronRun[]>
sdk.cron.run(runId: string): Promise<CronRun>

// Parse natural language → schedule expression
sdk.cron.parse(text: string): Promise<ParsedSchedule>
// e.g. "every morning at 9am" → { type: "cron", expression: "0 9 * * *" }

sdk.cron.status(): Promise<DaemonStatus>
```

**Job types:** `"shell"` | `"http"` | `"agent"` | `"cowork"` | `"function"`

---

### `sdk.verification`

Semi-formal verification: certificates, patch equivalence, fault localization.

```typescript
sdk.verification.verify(input: {
  mode?: "empirical" | "semi-formal" | "both" | "adaptive"
  description?: string
  plan: Plan
  receipts: ExecutionReceipt[]
  context?: {
    patches?: Array<{ path: string; content: string }>
    testFiles?: string[]
    description?: string
  }
}): Promise<VerificationCertificate>

// Quick verify — runs tests + lints + checks
sdk.verification.quick(options?: {
  testCommand?: string
  lintCommand?: string
}): Promise<VerificationCertificate>

// Get stored certificates for a session
sdk.verification.list(options?: {
  sessionId?: string
  since?: string
}): Promise<VerificationCertificate[]>

// Format a certificate as human-readable text
sdk.verification.format(cert: VerificationCertificate): string
```

**Types:**

```typescript
interface VerificationCertificate {
  id: string
  sessionId: string
  issuedAt: string
  mode: VerificationMode
  strategy: VerificationStrategy
  passed: boolean
  confidence: number           // 0.0 – 1.0
  empirical?: {
    testsRun: number
    testsPassed: number
    lintPassed: boolean
    typesPassed: boolean
  }
  semiFormal?: {
    patchEquivalence: "equivalent" | "diverged" | "unknown"
    faultLocalization: FaultLocation[]
    invariantsChecked: string[]
    counterexamples: string[]
  }
  summary: string
  patchRefs: string[]
}

type VerificationMode = "empirical" | "semi-formal" | "both" | "adaptive"
type VerificationStrategy = "fast" | "thorough" | "ci"

interface FaultLocation {
  file: string
  line?: number
  description: string
  severity: "error" | "warning" | "info"
}
```

---

### `sdk.knowledge`

Ars Contexta — knowledge graph, NLP entity extraction, LLM insights.

```typescript
// Generate insights from content using LLM
sdk.knowledge.insights(input: {
  content: string[]
  context?: string
}): Promise<Insight[]>

// Extract entities and relations using NLP
sdk.knowledge.extract(input: {
  text: string
}): Promise<ExtractionResult>

// Combined enrichment — LLM + NLP in one call
sdk.knowledge.enrich(input: {
  content: string[]
  text: string
  context?: string
}): Promise<EnrichmentResult>
```

**Types:**

```typescript
type InsightType = "pattern" | "contradiction" | "gap" | "opportunity" | "claim" | "entity_relation"
type InsightSource = "llm" | "nlp" | "pattern" | "claim"

interface Insight {
  id: string
  type: InsightType
  description: string
  confidence: number       // 0.0 – 1.0
  relatedNotes: string[]
  source: InsightSource
  timestamp: string
}

type EntityType = "person" | "organization" | "location" | "concept" | "product" | "event" | "date" | "technology" | "domain"

interface Entity {
  id: string
  text: string
  type: EntityType
  startPos: number
  endPos: number
  confidence: number
  normalizedForm?: string
}

interface Relation {
  source: string
  target: string
  relationType: string
  confidence: number
  evidence?: string
}

interface ExtractionResult {
  entities: Entity[]
  relations: Relation[]
  keyPhrases: string[]
  summary: string
  sentiment?: { score: number; label: "negative" | "neutral" | "positive" }
}
```

---

### `sdk.config`

Project and global configuration management.

```typescript
// Get current config (merged: global → project → workspace)
sdk.config.get(): Promise<Config>

// Project-level CLAUDE.md parsing
sdk.config.getMarkdown(projectPath: string): Promise<MarkdownConfig>

// Update config at a specific scope
sdk.config.update(input: Partial<Config>, scope?: "global" | "project"): Promise<Config>

// Watch config for changes (streams settings.updated events)
sdk.config.watch(): AsyncGenerator<Config>
```

---

### `sdk.permissions`

Tool permission gate — ask, reply, manage rules.

```typescript
sdk.permissions.list(sessionId: string): Promise<PermissionRule[]>
sdk.permissions.ask(input: PermissionRequest): Promise<PermissionOutcome>
sdk.permissions.reply(requestId: string, granted: boolean): Promise<void>
sdk.permissions.update(sessionId: string, rules: PermissionRule[]): Promise<void>
```

---

### `sdk.mcp`

MCP (Model Context Protocol) server management.

```typescript
sdk.mcp.list(): Promise<McpServer[]>
sdk.mcp.add(config: McpServerConfig): Promise<McpServer>
sdk.mcp.remove(name: string): Promise<void>
sdk.mcp.restart(name: string): Promise<void>
sdk.mcp.tools(serverName: string): Promise<McpTool[]>

// OAuth flows
sdk.mcp.startOAuth(serverName: string): Promise<{ authUrl: string; state: string }>
sdk.mcp.completeOAuth(input: { state: string; code: string }): Promise<void>
```

---

### `sdk.files`

File operations within a project context.

```typescript
sdk.files.list(input: { path: string; depth?: number }): Promise<FileEntry[]>
sdk.files.read(path: string): Promise<{ content: string; encoding: string }>
sdk.files.search(input: {
  query: string
  glob?: string
  type?: "content" | "filename"
}): Promise<SearchResult[]>
sdk.files.repoMap(projectPath: string): Promise<RepoMapEntry[]>
```

---

### `sdk.pty`

Pseudo-terminal (shell execution) management.

```typescript
sdk.pty.create(input: {
  cwd: string
  shell?: string
  env?: Record<string, string>
}): Promise<PtySession>

sdk.pty.write(id: string, data: string): Promise<void>
sdk.pty.resize(id: string, cols: number, rows: number): Promise<void>
sdk.pty.kill(id: string, signal?: string): Promise<void>
sdk.pty.list(): Promise<PtyInfo[]>

// WebSocket stream for terminal I/O
sdk.pty.stream(id: string): WebSocket
```

---

### `sdk.acp`

Agent Client Protocol — JSON-RPC over stdio for external agent connections.

```typescript
// Start an ACP server (listen for external agent connections)
sdk.acp.listen(options?: {
  model?: { providerID: string; modelID: string }
  modeId?: string
}): Promise<ACPServer>

// Connect to an external ACP server
sdk.acp.connect(input: {
  command: string
  args?: string[]
}): Promise<ACPClient>

interface ACPServer {
  sessionId: string
  stop(): Promise<void>
}

interface ACPClient {
  run(prompt: string): Promise<string>
  close(): Promise<void>
}
```

---

### `sdk.git`

Git bundle creation and cross-surface patch transfer.

```typescript
sdk.git.bundle.create(input: {
  projectPath: string
  since?: string     // since commit SHA or "HEAD~n"
  include?: string[] // paths to include
}): Promise<{ bundlePath: string; commits: string[] }>

sdk.git.bundle.validate(bundlePath: string): Promise<{ valid: boolean; error?: string }>

sdk.git.bundle.extract(input: {
  bundlePath: string
  targetPath: string
}): Promise<{ applied: number }>

// DAG tracker — track task dependency graph against git history
sdk.git.dag.status(projectPath: string): Promise<DAGStatus>
```

---

### `sdk.kernel`

Ledger and state management for audit trails.

```typescript
sdk.kernel.query(filter?: {
  sessionId?: string
  since?: string
  type?: string
}): Promise<LedgerEntry[]>

sdk.kernel.getSessionState(sessionId: string): Promise<KernelSessionState>

sdk.kernel.sync(sessionId: string): Promise<void>

interface LedgerEntry {
  id: string
  sessionId: string
  type: string
  payload: Record<string, unknown>
  timestamp: string
  hash: string
}
```

---

### `sdk.user`

User identity and profile.

```typescript
sdk.user.get(): Promise<User | null>
sdk.user.update(input: Partial<UserProfile>): Promise<User>
sdk.user.logout(): Promise<void>

// Terminal clerk auth (browser-based login flow)
sdk.user.loginWithClerk(options?: { redirectUrl?: string }): Promise<{ url: string }>
```

---

### `sdk.skills`

Skill discovery and invocation.

```typescript
sdk.skills.list(): Promise<Skill[]>
sdk.skills.get(name: string): Promise<Skill>
sdk.skills.invoke(name: string, args?: string): Promise<{ content: string }>
sdk.skills.reload(): Promise<void>
```

---

### `sdk.hooks`

Pre/post tool execution lifecycle hooks.

```typescript
sdk.hooks.list(): Promise<HookConfig[]>
sdk.hooks.register(config: HookConfig): Promise<void>
sdk.hooks.remove(id: string): Promise<void>

// Dispatch a hook event (for testing/manual trigger)
sdk.hooks.dispatch(event: HookEvent): Promise<void>
```

---

### `sdk.lsp`

Language Server Protocol integration.

```typescript
sdk.lsp.status(): Promise<LspStatus>
sdk.lsp.diagnostics(file: string): Promise<Diagnostic[]>
sdk.lsp.hover(input: { file: string; line: number; col: number }): Promise<HoverResult | null>
sdk.lsp.completions(input: { file: string; line: number; col: number }): Promise<CompletionItem[]>
```

---

## Error Taxonomy

All SDK errors extend `AllternitError`:

```typescript
class AllternitError extends Error {
  code: AllternitErrorCode
  context?: Record<string, unknown>
}

type AllternitErrorCode =
  // Transport
  | "ERR_NOT_CONNECTED"          // No server reachable
  | "ERR_AUTH_FAILED"            // Invalid credentials
  | "ERR_TIMEOUT"                // Request timed out

  // Session
  | "ERR_SESSION_NOT_FOUND"      // Session ID unknown
  | "ERR_SESSION_LOCKED"         // Session already running
  | "ERR_HANDOFF_GATES_FAILED"   // Session not safe to hand off

  // Provider
  | "ERR_PROVIDER_NOT_FOUND"     // Provider not configured
  | "ERR_PROVIDER_AUTH"          // Provider auth failure
  | "ERR_MODEL_NOT_FOUND"        // Model unknown to provider
  | "ERR_RATE_LIMITED"           // Provider rate limit hit

  // Verification
  | "ERR_VERIFICATION_FAILED"    // Verification did not pass
  | "ERR_NO_PATCHES"             // No patches to verify

  // Cron
  | "ERR_CRON_PARSE"             // Could not parse schedule expression
  | "ERR_JOB_NOT_FOUND"          // Cron job unknown

  // Permission
  | "ERR_PERMISSION_DENIED"      // Tool blocked by permission guard
  | "ERR_PERMISSION_TIMEOUT"     // User did not respond to permission ask

  // ACP
  | "ERR_ACP_CONNECT"            // Could not start/connect ACP subprocess
  | "ERR_ACP_TIMEOUT"            // ACP call timed out

  // Generic
  | "ERR_UNKNOWN"
```

---

## Usage Examples

### TUI worker (in-process)

```typescript
// worker.ts
import { createAllternitClient } from "@allternit/sdk"
import { Server } from "@/runtime/server/server"

const sdk = createAllternitClient({
  baseUrl: "http://gizzi.internal",
  fetch: async (input, init) => {
    const req = new Request(input, init)
    return Server.App().fetch(req)
  },
})

// Subscribe to events
for await (const event of sdk.events.subscribe({ signal }).stream) {
  Rpc.emit("event", event)
}
```

### Remote surface (Allternit Desktop, thin-client)

```typescript
import { createAllternitClient } from "@allternit/sdk"

const sdk = createAllternitClient({
  baseUrl: "http://localhost:4096",
  auth: { username: "gizzi", password: process.env.GIZZI_SERVER_PASSWORD },
})

const sessions = await sdk.sessions.list({ projectPath: "/my/project" })
```

### Browser extension

```typescript
import { createAllternitClient } from "@allternit/sdk"

// Discover via mDNS or user-provided URL
const sdk = createAllternitClient({ baseUrl: "http://gizzi.local:4096" })

// Real-time event subscription
const { stream } = sdk.events.subscribe()
for await (const event of stream) {
  if (event.type === "run.updated") {
    updateUI(event)
  }
}
```

---

## Package Shape

```
@allternit/sdk/
  index.ts            ← createAllternitClient, all types
  transport/
    http.ts           ← HttpTransport (fetch + SSE)
    rpc.ts            ← RpcTransport (Bun worker IPC)
    mock.ts           ← MockTransport (tests)
  resources/
    sessions.ts
    agents.ts
    providers.ts
    events.ts
    cron.ts
    verification.ts
    knowledge.ts
    config.ts
    permissions.ts
    mcp.ts
    files.ts
    pty.ts
    acp.ts
    git.ts
    kernel.ts
    user.ts
    skills.ts
    hooks.ts
    lsp.ts
  types/
    index.ts          ← re-exports all public types
    events.ts         ← full event union type
    errors.ts         ← AllternitError, AllternitErrorCode
  version.ts          ← SDK_VERSION constant
```

---

## Versioning Contract

- **MAJOR** — breaking type changes to any resource API
- **MINOR** — new resource module or new method on existing module
- **PATCH** — bug fix, transport fix, error message improvement
- The SDK semver tracks gizzi-code releases independently
- `@allternit/sdk` is published to npm as part of the Allternit platform release

---

## What the Current `@allternit/sdk` Has vs What Needs Building

| Module | Current State | Gap |
|--------|--------------|-----|
| Transport (HTTP + fetch injection) | ✅ OpencodeClient in `packages/sdk/dist` | needs rewrite: typed resources, not raw OpencodeClient |
| Transport (RPC) | ✅ `Rpc` util in `src/shared/util/rpc.ts` | needs SDK wrapper |
| `sdk.sessions` | ✅ Routes in `routes/session.ts` | SDK resource layer missing |
| `sdk.agents` | ✅ Communication runtime + mention router | SDK resource layer missing |
| `sdk.providers` | ✅ Provider.ts + Discovery | SDK resource layer missing |
| `sdk.events` | ✅ GlobalBus + `/event` SSE route | SDK wrapper exists (worker.ts) but needs typed union |
| `sdk.cron` | ✅ Full cron system, route at `routes/cron.ts` | SDK resource layer missing |
| `sdk.verification` | ✅ Verification system, route at `routes/verification.ts` | SDK resource layer missing |
| `sdk.knowledge` | ✅ Ars Contexta routes | SDK resource layer missing |
| `sdk.config` | ✅ Config + settings system | SDK resource layer missing |
| `sdk.permissions` | ✅ Permission guard routes | SDK resource layer missing |
| `sdk.mcp` | ✅ MCP routes + OAuth | SDK resource layer missing |
| `sdk.files` | ✅ File routes | SDK resource layer missing |
| `sdk.pty` | ✅ PTY integration + routes | SDK resource layer missing |
| `sdk.acp` | ✅ ACP types + agent/session | SDK resource layer missing |
| `sdk.git` | ✅ git-bundle + dag-tracker | SDK resource layer missing |
| `sdk.kernel` | ✅ kernel-client + kernel-sync | SDK resource layer missing |
| `sdk.user` | ✅ User routes + clerk auth | SDK resource layer missing |
| `sdk.skills` | ✅ Skills discovery | SDK resource layer missing |
| `sdk.hooks` | ✅ Hook dispatcher | SDK resource layer missing |
| `sdk.lsp` | ✅ LSP client + routes | SDK resource layer missing |
| `sdk.sidecar` | ✅ `src/runtime/sidecar/index.ts` — Qwen 3.5 4B at :11435 | SDK resource layer missing |
| `sdk.workspace` | ✅ `src/runtime/memory/memory.ts` — L1-L5 AgentWorkspace | SDK resource layer missing |
| `sdk.snapshot` | ✅ `src/runtime/session/snapshot/index.ts` | SDK resource layer missing |
| `sdk.toolRegistry` | ✅ `src/runtime/tools/builtins/registry.ts` — `ToolRegistry.all()` | SDK resource layer missing |
| `sdk.rateLimiter` | ✅ `src/runtime/integrations/rate-limiter/` | SDK resource layer missing |
| Error taxonomy | ❌ Not defined | Build from scratch |
| Event union type | ❌ Partial (`type Event = any`) | Build from BusEvent registry |
| `@allternit/sdk/v2` stubs | ✅ **DONE** — all 7 import sites fixed | `packages/sdk/dist/v2/` can now be safely deleted |
| ACP types using sdk/v2 | ✅ **DONE** — `GIZZIClient` → `AllternitClientLike` | Complete |

---

## Additional Modules Found in Deep Inventory

### `sdk.sidecar`
Embedded local model for background tasks (title generation, compaction summaries).
- Location: `src/runtime/sidecar/index.ts`
- Model: Qwen 3.5 4B Q4_K_M
- Port: 11435 (Ollama-compatible)
- API: `Sidecar.isRunning()`, `Sidecar.start()`, `Sidecar.stop()`, `Sidecar.health()`, `Sidecar.providerConfig()`

### `sdk.workspace`
5-layer AI workspace (L1-COGNITIVE → L5-BUSINESS).
- Location: `src/runtime/memory/memory.ts` + `src/runtime/workspace/workspace-loader.ts`
- Layers: L1 (brain/memory/batons), L2 (SOUL.md/VOICE.md/CONVENTIONS.md), L3 (governance), L4 (skills), L5 (business/CRM)
- API: `AgentWorkspace.getPaths()`, `loadAllAgents(directory?)`, `KernelSync.start(workspace)`

### `sdk.snapshot`
Session checkpoint and crash recovery.
- Location: `src/runtime/session/snapshot/index.ts`
- Purpose: Capture session state, allow restore after crash or handoff

### `sdk.toolRegistry`
Dynamic tool registration and discovery.
- Location: `src/runtime/tools/builtins/registry.ts`
- API: `ToolRegistry.all()`, `ToolRegistry.register(tool)`, `ToolRegistry.get(id)`

---

## Immediate Next Steps (Build Order)

1. **`packages/sdk/dist/v2/` deletion** — all import sites already fixed. Safe to delete.
2. **Build `@allternit/sdk` package skeleton** — transport layer first (`HttpTransport`, `RpcTransport`)
3. **Build `sdk.events`** — typed event union + subscribe method. This unblocks the TUI.
4. **Build `sdk.sessions`** — highest-use resource
5. **Build `sdk.agents`** — communication runtime + mention router
6. **Build remaining resources** in dependency order
7. **Wire surfaces** — thin-client, Desktop, extensions all switch to SDK

---

*Generated from exhaustive codebase inventory of gizzi-code at `/cmd/gizzi-code/src/`.*
*Inventory agent confirmed: 21 route files, 28+ tools, 130+ runtime TypeScript files, ~200k+ LOC.*
*All `@allternit/sdk/v2` import sites fixed as of 2026-03-15.*
