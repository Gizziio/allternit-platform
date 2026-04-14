# @a2r/sdk — The Nervous System Spec

**Version:** 1.0 (spec, not implementation)
**Date:** 2026-03-15
**Status:** Planning — not yet built

---

## What This Is

`@a2r/sdk` is the typed contract between Gizzi Code (the brain) and every surface
that consumes it: TUI, A2R Desktop, browser extensions, thin-client, plugins, and
external agents via ACP.

It is **not** a generated HTTP client wrapper. It is not a renamed OpenCode fork.
It is a first-class product deliverable — the API every surface codes against.

The existing generated HTTP client (`sdk.gen.js`, the 881-line OpenAPI output) is
the **transport foundation** underneath this SDK. The SDK is the layer above it.

---

## Design Principles

1. **Same API, any surface.** TUI, Desktop, and extensions call identical code.
   Transport is auto-detected — in-process for local TUI, HTTP for everything else.
2. **Typed all the way down.** Every resource, event, and error has a TypeScript type.
   No `any`. No raw status codes. Real discriminated unions.
3. **Generated types from the server, not handwritten.** OpenAPI spec → `types.gen.ts`.
   The server owns the shape. The SDK distributes it.
4. **A2R primitives, not CRUD wrappers.** `sdk.sessions.run()` manages a full
   lifecycle. `sdk.events.on("message.part.delta")` is a first-class operation.
5. **Published and versioned.** Semver. Changelog. Other surfaces pin to a version.
   Server changes that break the contract are a major version bump.

---

## Client Initialization

```typescript
import { createA2RClient } from "@a2r/sdk"

// Auto-detect: local Bun Worker process → RPC (zero overhead)
// Remote URL → HTTP
const sdk = createA2RClient()

// Explicit local (same process as Gizzi Code server)
const sdk = createA2RClient({ mode: "local" })

// Explicit remote (A2R Desktop, browser extension, external agent)
const sdk = createA2RClient({
  url: "https://my-gizzi.example.com",
  token: "...",
})

// With options
const sdk = createA2RClient({
  url: "http://localhost:4096",
  headers: { "x-a2r-directory": "/path/to/workspace" },
  timeout: 30_000,
  retry: { attempts: 3, backoff: "exponential" },
})
```

---

## Transport Layer

```
packages/sdk/src/transport/
├── rpc.ts       — In-process Bun Worker RPC (for local TUI)
├── http.ts      — HTTP client generated from OpenAPI (for remote surfaces)
└── auto.ts      — Auto-detect: are we in the same Worker process? → RPC, else HTTP
```

**RPC transport** is extracted from `src/cli/ui/tui/thread.ts`. It already works —
it just lives in the TUI, not in the SDK. Moving it into the SDK means the TUI gets
zero-overhead access and so does any other in-process consumer.

**HTTP transport** is the existing `sdk.gen.js` generated client. It calls real
Hono routes. Keep it, fix the v2 stub that was pointing nowhere.

**Auto transport** is new. Logic: if `process` has the worker RPC client injected
(the `_a2rRpcClient` or equivalent), use RPC. Otherwise use HTTP to `url`.

---

## Resource Layer — Full API Surface

### `sdk.sessions`

```typescript
sdk.sessions.list(): Promise<Session[]>
sdk.sessions.get(sessionID: string): Promise<Session>
sdk.sessions.create(opts: { agentID?: string; title?: string; model?: ModelRef }): Promise<Session>
sdk.sessions.delete(sessionID: string): Promise<void>
sdk.sessions.abort(sessionID: string): Promise<void>
sdk.sessions.fork(sessionID: string, messageID: string): Promise<Session>
sdk.sessions.share(sessionID: string): Promise<{ url: string }>
sdk.sessions.messages(sessionID: string): Promise<Message[]>
sdk.sessions.clear(sessionID: string): Promise<void>
sdk.sessions.update(sessionID: string, opts: Partial<SessionUpdate>): Promise<Session>

// Higher-level: sends a message and streams the response
sdk.sessions.run(
  sessionID: string,
  opts: { prompt: string; files?: FilePart[]; tools?: ToolOverrides }
): AsyncIterable<SessionRunEvent>

// Session continuity (A2R-native)
sdk.sessions.resume(sessionID: string, opts?: ResumeOpts): Promise<Session>
sdk.sessions.snapshot(sessionID: string): Promise<Snapshot>
sdk.sessions.revert(sessionID: string, snapshotID: string): Promise<Session>
sdk.sessions.handoff(sessionID: string, opts: HandoffOpts): Promise<HandoffToken>
```

### `sdk.agents`

```typescript
sdk.agents.list(): Promise<Agent[]>
sdk.agents.get(agentID: string): Promise<Agent>
sdk.agents.create(opts: AgentCreateOpts): Promise<Agent>
sdk.agents.update(agentID: string, opts: Partial<AgentCreateOpts>): Promise<Agent>
sdk.agents.delete(agentID: string): Promise<void>

// ACP (Agent Client Protocol) — A2R-native
sdk.agents.communicate(agentID: string, message: ACPMessage): Promise<ACPResponse>
sdk.agents.mention(agentID: string, context: MentionContext): Promise<void>
```

### `sdk.providers`

```typescript
sdk.providers.list(): Promise<ProviderListResponse>
sdk.providers.auth.oauth.authorize(providerID: string): Promise<{ url: string; state: string }>
sdk.providers.auth.oauth.verify(code: string, state: string): Promise<void>
sdk.providers.auth.set(providerID: string, credentials: ProviderCredentials): Promise<void>
sdk.providers.auth.remove(providerID: string): Promise<void>
```

### `sdk.memory` (A2R-native)

```typescript
// L1: Working memory (in-session context)
sdk.memory.l1.get(sessionID: string): Promise<WorkingMemory>
sdk.memory.l1.update(sessionID: string, content: string): Promise<void>

// L2: Persistent identity (SOUL.md, CONVENTIONS.md, VOICE.md)
sdk.memory.l2.get(type: "soul" | "conventions" | "voice"): Promise<string>
sdk.memory.l2.update(type: "soul" | "conventions" | "voice", content: string): Promise<void>
sdk.memory.l2.list(): Promise<MemoryFile[]>
```

### `sdk.cron` (A2R-native)

```typescript
sdk.cron.list(): Promise<CronJob[]>
sdk.cron.get(jobID: string): Promise<CronJob>
sdk.cron.create(opts: {
  schedule: string        // "every morning at 9" or "0 9 * * *"
  agentID: string
  prompt: string
  runtime?: "local" | "docker" | "vm"
}): Promise<CronJob>
sdk.cron.run(jobID: string): Promise<CronRun>
sdk.cron.delete(jobID: string): Promise<void>
sdk.cron.status(jobID: string): Promise<CronStatus>
sdk.cron.history(jobID: string): Promise<CronRun[]>
```

### `sdk.skills` (A2R-native)

```typescript
sdk.skills.list(): Promise<Skill[]>
sdk.skills.get(skillID: string): Promise<Skill>
sdk.skills.execute(skillID: string, params: unknown): Promise<SkillResult>
sdk.skills.register(skill: SkillDefinition): Promise<void>
```

### `sdk.verification` (A2R-native)

```typescript
sdk.verification.verify(sessionID: string, opts?: VerifyOpts): Promise<VerificationResult>
sdk.verification.certificate(sessionID: string): Promise<VerificationCertificate>
sdk.verification.history(sessionID: string): Promise<VerificationResult[]>
sdk.verification.policies.list(): Promise<VerificationPolicy[]>
sdk.verification.policies.set(policy: VerificationPolicy): Promise<void>
```

### `sdk.mcp`

```typescript
sdk.mcp.list(): Promise<McpServer[]>
sdk.mcp.add(config: McpServerConfig): Promise<McpServer>
sdk.mcp.remove(name: string): Promise<void>
sdk.mcp.status(): Promise<Record<string, McpStatus>>
sdk.mcp.resources(serverName: string): Promise<McpResource[]>
```

### `sdk.files`

```typescript
sdk.files.search(query: string, opts?: FileSearchOpts): Promise<FileResult[]>
sdk.files.read(path: string): Promise<string>
sdk.files.glob(pattern: string): Promise<string[]>
```

### `sdk.config`

```typescript
sdk.config.get(): Promise<Config>
sdk.config.update(changes: Partial<Config>): Promise<Config>
```

### `sdk.instance`

```typescript
sdk.instance.sync(): Promise<SyncState>     // Full TUI hydration snapshot
sdk.instance.dispose(): Promise<void>
sdk.instance.health(): Promise<HealthStatus>
```

---

## Event Stream

All surfaces subscribe to the same typed event stream. No polling.

```typescript
// Subscribe to all events
const unsub = sdk.events.subscribe((event: A2REvent) => {
  console.log(event.type, event)
})

// Subscribe to specific event type
sdk.events.on("message.part.delta", (e) => {
  process.stdout.write(e.delta)
})

sdk.events.on("session.updated", (e) => {
  // e.sessionID is typed
})

unsub() // Unsubscribe
```

### Full Event Type Map

```typescript
export type A2REvent =
  // Session lifecycle
  | { type: "session.created"; sessionID: string; session: Session }
  | { type: "session.updated"; sessionID: string; session: Session }
  | { type: "session.deleted"; sessionID: string }
  | { type: "session.cleared"; sessionID: string }

  // Message lifecycle
  | { type: "message.created"; sessionID: string; messageID: string; message: Message }
  | { type: "message.part.delta"; sessionID: string; messageID: string; partID: string; delta: string; type: "text" | "reasoning" }
  | { type: "message.part.snapshot"; sessionID: string; messageID: string; part: Part }
  | { type: "message.completed"; sessionID: string; messageID: string }

  // Tool execution
  | { type: "tool.started"; sessionID: string; tool: string; callID: string }
  | { type: "tool.completed"; sessionID: string; tool: string; callID: string; result: unknown }

  // Human-in-the-loop
  | { type: "permission.required"; sessionID: string; permission: PermissionRequest }
  | { type: "permission.resolved"; sessionID: string; permissionID: string; granted: boolean }
  | { type: "question.required"; sessionID: string; question: QuestionRequest }
  | { type: "question.answered"; sessionID: string; questionID: string }

  // Agent system
  | { type: "agent.created"; agentID: string; agent: Agent }
  | { type: "agent.updated"; agentID: string }
  | { type: "agent.deleted"; agentID: string }

  // Providers
  | { type: "provider.connected"; providerID: string }
  | { type: "provider.disconnected"; providerID: string }
  | { type: "provider.auth.required"; providerID: string }

  // MCP
  | { type: "mcp.connected"; name: string }
  | { type: "mcp.disconnected"; name: string }
  | { type: "mcp.error"; name: string; error: string }

  // Cron
  | { type: "cron.started"; jobID: string; runID: string }
  | { type: "cron.completed"; jobID: string; runID: string; success: boolean }
  | { type: "cron.failed"; jobID: string; runID: string; error: string }

  // Verification
  | { type: "verification.started"; sessionID: string }
  | { type: "verification.completed"; sessionID: string; result: VerificationResult }

  // Instance
  | { type: "instance.sync"; data: SyncState }
  | { type: "installation.updated"; version: string }
  | { type: "installation.update-available"; version: string }
  | { type: "server.instance.disposed"; directory: string }
```

---

## Error Taxonomy

```typescript
// Base
export class A2RError extends Error {
  code: string
  statusCode?: number
}

// Session errors
export class SessionNotFoundError extends A2RError {
  code = "SESSION_NOT_FOUND"
  sessionID: string
}
export class SessionBusyError extends A2RError {
  code = "SESSION_BUSY"
  sessionID: string
}

// Provider / model errors
export class ProviderAuthError extends A2RError {
  code = "PROVIDER_AUTH_REQUIRED"
  providerID: string
}
export class ModelNotFoundError extends A2RError {
  code = "MODEL_NOT_FOUND"
  model: string
  provider: string
}
export class QuotaExceededError extends A2RError {
  code = "QUOTA_EXCEEDED"
  provider: string
}

// Agent loop errors
export class LoopAbortedError extends A2RError {
  code = "LOOP_ABORTED"
  reason: string
}
export class OutputLengthExceededError extends A2RError {
  code = "OUTPUT_LENGTH_EXCEEDED"
}

// Permission errors
export class PermissionDeniedError extends A2RError {
  code = "PERMISSION_DENIED"
  tool: string
  pattern: string
}

// MCP errors
export class McpConnectionError extends A2RError {
  code = "MCP_CONNECTION_FAILED"
  server: string
}

// Verification errors
export class VerificationError extends A2RError {
  code = "VERIFICATION_FAILED"
  sessionID: string
}
```

---

## Package Structure (Target)

```
packages/sdk/
├── src/
│   ├── transport/
│   │   ├── rpc.ts            — Extracted from thread.ts
│   │   ├── http.ts           — Generated client wrapper
│   │   └── auto.ts           — Detection + composition
│   ├── resources/
│   │   ├── session.ts
│   │   ├── agent.ts
│   │   ├── provider.ts
│   │   ├── memory.ts
│   │   ├── cron.ts
│   │   ├── skill.ts
│   │   ├── verification.ts
│   │   ├── mcp.ts
│   │   ├── file.ts
│   │   ├── config.ts
│   │   └── instance.ts
│   ├── events/
│   │   ├── stream.ts         — SSE subscription with reconnect
│   │   └── types.ts          — A2REvent discriminated union
│   ├── errors/
│   │   └── index.ts          — Full error taxonomy
│   ├── types/
│   │   └── index.ts          — Re-export from types.gen.ts + A2R-specific types
│   └── index.ts              — createA2RClient, all exports
├── dist/                     — Generated (gitignored)
│   ├── index.js
│   ├── index.d.ts
│   └── ...
└── package.json
```

---

## What Surfaces Use

| Surface | Import | Mode |
|---|---|---|
| TUI (local) | `createA2RClient({ mode: "local" })` | RPC (in-process) |
| TUI (attach to remote) | `createA2RClient({ url })` | HTTP |
| A2R Desktop | `createA2RClient({ url: serverUrl, token })` | HTTP |
| Browser extension | `createA2RClient({ url })` | HTTP |
| Thin-client | `createA2RClient({ url })` | HTTP (replaces raw fetch) |
| Plugin | `createA2RClient()` passed in | RPC or HTTP |
| External agent (ACP) | `createA2RClient({ url })` | HTTP |
| CLI commands | `createA2RClient()` | RPC or HTTP |

---

## Build / Versioning

- Published to private npm registry (or GitHub Packages)
- Semver: breaking API changes = major bump
- `types.gen.ts` regenerated from server OpenAPI spec on every server release
- SDK version is pinned per surface — Desktop can lag behind TUI by one minor
- Changelog is required — every API addition/removal documented

---

## Build Order

1. Gizzi Code server generates OpenAPI spec (`/doc` route)
2. `bun run sdk:build` → runs `openapi-ts`, generates `types.gen.ts` + `sdk.gen.ts`
3. SDK `src/` wraps the generated layer
4. SDK is compiled and published
5. Surfaces update their pinned version

---

## Implementation Phases

### Phase 0 — Immediate (1-2 days, unblocks TUI)
Wire `@a2r/sdk/v2` to the real generated HTTP client (`sdk.gen.js`).
All 45 stub functions replaced with real calls. TUI works.

### Phase 1 — SDK Foundation (1-2 weeks)
- Extract RPC transport from `thread.ts` into `packages/sdk/src/transport/rpc.ts`
- Build auto-transport detection
- Implement resource layer wrapping the generated client
- Add typed event stream with reconnect
- Add error taxonomy
- Update TUI to use new SDK surface

### Phase 2 — A2R Primitives (1 week)
- `sdk.sessions.run()` — full lifecycle management
- `sdk.memory` — L1/L2 access
- `sdk.verification` — verify + certificate
- `sdk.cron` — full scheduling API

### Phase 3 — Surface Adoption (ongoing)
- Thin-client migrates from raw HTTP to `@a2r/sdk`
- A2R Desktop imports SDK for server connection
- Browser extension imports SDK
- Plugins receive SDK client instance

### Phase 4 — Platform (future)
- Public SDK documentation
- SDK versioning with changelogs
- ACP server exposed via SDK
- Multi-tenant support in SDK client
