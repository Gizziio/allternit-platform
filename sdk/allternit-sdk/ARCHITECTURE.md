# @allternit/sdk Architecture — AI Runtime

Canonical architecture reference for the `@allternit/sdk/ai-runtime` subpath.

---

## 1. Overview

The AI Runtime provides stateful agent execution with a native tool registry, multi-provider LLM harness, and capability system. It is designed to run inside Node.js, Bun, or edge environments.

**Entry points:**
- `@allternit/sdk/ai-runtime` — Full runtime (harness + agents + tools + capabilities)
- `@allternit/sdk/ai-runtime/harness` — LLM harness only (stateless streaming)

---

## 2. Directory Structure

```
src/ai-runtime/
├── agents/
│   ├── controller.ts          # AllternitAgent — global registry owner, run factory
│   ├── run.ts                 # AgentRun — per-run state machine + LLM loop
│   ├── types.ts               # AgentProfile, AgentOptions, ReplyRequest, etc.
│   ├── client.ts              # RemoteAgentsClient — HTTP client for cloud agents
│   ├── index.ts               # Barrel exports
│   └── persistence/
│       └── index.ts           # AgentStorage — Bun/Node SQLite + in-memory fallback
├── tools/
│   ├── registry.ts            # ToolRegistry — deferred/active tool lifecycle
│   ├── search.ts              # NativeToolBelt — tool_search / tool_activate
│   └── types.ts               # ToolDefinition, DeferredToolDefinition, ToolPolicy
├── capabilities/
│   ├── brain.ts               # BrainCapability — RAG query tool
│   ├── computer-use.ts        # ComputerUseCapability — mouse/keyboard/screenshot
│   ├── filesystem.ts          # FilesystemCapability — read_file / write_file
│   └── human-in-the-loop.ts   # HITLCapability — ask_user_question
├── environment/
│   ├── host.ts                # HostEnvironment — direct shell execution
│   ├── lima.ts                # LimaEnvironment — VM-sandboxed execution
│   └── types.ts               # IEnvironment, ExecuteResult
└── harness/
    ├── index.ts               # AllternitHarness — unified LLM streaming
    ├── types.ts               # HarnessConfig, StreamRequest, HarnessStreamChunk
    ├── prompts.ts             # System prompt injection helpers
    └── run-state.ts           # RunState — per-run registry + tool belt
```

---

## 3. Core Classes

### 3.1 AllternitHarness

**File:** `harness/index.ts`

Unified LLM streaming interface. Routes requests to provider-specific implementations based on `HarnessConfig.mode`.

| Mode | Provider | Implementation |
|------|----------|----------------|
| `byok` | `anthropic` | `streamFromAnthropic` — SSE via Messages API |
| `byok` | `openai` | `streamFromOpenAI` — SSE via Chat Completions API |
| `byok` | `google` | `streamFromGoogle` — SSE via Gemini `streamGenerateContent` |
| `local` | any | `streamFromLocal` — OpenAI-compatible endpoint (Ollama, etc.) |
| `subprocess` | any | `streamFromSubprocess` — NDJSON from spawned process |
| `cloud` | any | `streamFromCloud` — SSE via Allternit Cloud API (`/api/agents/v1/chat/completions`)

**Key methods:**
- `stream(request: StreamRequest): AsyncGenerator<HarnessStreamChunk>`
- `complete(request: StreamRequest): Promise<string>`

**Stream chunk types:**
```typescript
type HarnessStreamChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_call_complete'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; error: Error };
```

### 3.2 AllternitAgent

**File:** `agents/controller.ts`

Global orchestrator. Owns the `ToolRegistry`, initializes capabilities, and creates `AgentRun` instances.

**Constructor:**
```typescript
new AllternitAgent(harness: AllternitHarness, options?: AgentOptions)
```

**AgentOptions:**
| Option | Type | Description |
|--------|------|-------------|
| `environment` | `'local' \| 'lima' \| 'cloud'` | Execution sandbox |
| `capabilities` | `string[]` | Capability IDs to enable |
| `persistencePath` | `string` | SQLite DB path (`:memory:` for ephemeral) |
| `computerUseBaseUrl` | `string` | ACU gateway URL for computer-use |

**Key methods:**
- `run(request: StreamRequest): AgentRun` — Creates and starts a new run
- `resume(runId: string, request: StreamRequest): Promise<AgentRun>` — Restores from storage
- `submitReply(runId: string, outcome: ReplyOutcome): Promise<void>` — Resumes a paused HITL run
- `getActiveRun(runId: string): AgentRun | undefined` — Returns an active run by ID
- `registerTool(tool: ToolDefinition)` — Add active tool to global registry
- `registerDeferredTool(tool: DeferredToolDefinition)` — Add deferred tool
- `executeTool(name: string, args: any): Promise<string>` — Capability dispatch

### 3.3 AgentRun

**File:** `agents/run.ts`

Per-run state machine. Extends `EventEmitter`.

**Lifecycle:**
1. `queued` → `running` — `execute()` called
2. Stream text from harness
3. On `tool_call_complete`, call `handleToolCalls()`
4. Internal tools → `runState.handleToolCall()`
5. Capabilities → `agent.executeTool()`
6. Destructive tools → emit `reply_requested`, wait for `submit()`
7. Tool results appended to messages
8. Re-stream with updated context
9. `completed` or `failed`

**Events:**
| Event | Payload | When |
|-------|---------|------|
| `text` | `string` | Text delta from LLM |
| `tool_call` | `ToolCallChunk` | Tool call started |
| `tool_call_complete` | `ToolCallCompleteChunk` | Tool call JSON complete |
| `reply_requested` | `ReplyRequest` | Permission/question gate triggered |
| `completed` | `RuntimeMessage[]` | Run finished successfully |
| `error` | `Error` | Run failed |
| `status_change` | `AgentRunStatus` | Status transitioned |

**HITL Resume:**
When a run emits `reply_requested` and the executor uses `hitlPolicy: "pause"`, the run stays in `requires_reply` status. The `AllternitAgent.submitReply(runId, outcome)` method can be called later (in the same process) to resume execution. This requires the agent instance to be cached.

### 3.4 ToolRegistry

**File:** `tools/registry.ts`

Stateful registry for active and deferred tools.

**Key methods:**
| Method | Description |
|--------|-------------|
| `registerTool(tool)` | Add active tool immediately |
| `registerDeferredTool(tool)` | Add inactive tool with optional `activate()` |
| `activateTool(toolId)` | Move deferred → active via `activate()` callback |
| `search(query)` | Filter deferred tools by name/description/tags |
| `snapshot()` | Export `{ activeToolNames, discoveredToolIds, sessionPolicies }` |
| `rehydrate(snapshot)` | Restore state from snapshot |
| `fork()` | Deep copy for isolating per-run state |
| `getActiveTools()` | Return array of active `ToolDefinition` |

### 3.5 RunState

**File:** `harness/run-state.ts`

Per-run container owning a forked `ToolRegistry` and `NativeToolBelt`.

**Key methods:**
- `getActiveToolSchemas(): any[]` — Returns schemas for LLM provider injection
- `handleToolCall(name, args, context): Promise<any>` — Executes if tool has `execute` hook, returns `null` otherwise (routes to capability)

### 3.6 AgentStorage

**File:** `agents/persistence/index.ts`

Run persistence with runtime auto-detection.

**Backends (auto-selected):**
1. `BunSqliteBackend` — `bun:sqlite` (Bun runtime)
2. `NodeSqliteBackend` — `node:sqlite` (Node 22.5+)
3. `MemoryBackend` — In-memory Map (fallback)

**Interface:**
```typescript
interface IAgentStorageBackend {
  saveRun(record: RunRecord): void;
  getRun(id: string): RunRecord | null;
  listRuns(): RunRecord[];
}
```

---

## 4. Tool Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tool Lifecycle                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     registerDeferredTool()     ┌─────────────┐│
│  │   Source    │ ──────────────────────────────> │  Deferred   ││
│  │  (MCP/API)  │                                  │  Registry   ││
│  └─────────────┘                                  └──────┬──────┘│
│                                                          │       │
│                             tool_search(query)           │       │
│                             ────────────────────────────>│       │
│                                                          │       │
│                             tool_activate(toolId)        │       │
│                             ────────────────────────────>│       │
│                                                          ▼       │
│                                                   ┌─────────────┐│
│                                                   │   Active    ││
│                                                   │  Registry   ││
│                                                   └──────┬──────┘│
│                                                          │       │
│                              LLM tool call               │       │
│                              ───────────────────────────>│       │
│                                                          ▼       │
│                                                   ┌─────────────┐│
│                                                   │  execute()  ││
│                                                   │  pre/post   ││
│                                                   │   hooks     ││
│                                                   └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Execution Flow

```
┌──────────────┐     run()      ┌──────────────┐     execute()     ┌──────────────┐
│  Platform    │ ─────────────> │  AgentRun    │ ────────────────> │   Harness    │
│   Request    │                │   (queued)   │                   │   stream()   │
└──────────────┘                └──────┬───────┘                   └──────┬───────┘
                                       │                                  │
                                       │ text chunk                       │
                                       │ <────────────────────────────────│
                                       │                                  │
                                       │ tool_call_complete               │
                                       │ <────────────────────────────────│
                                       │                                  │
                                       ▼                                  │
                              ┌─────────────────┐                        │
                              │ handleToolCalls │                        │
                              └────────┬────────┘                        │
                                       │                                  │
                    ┌──────────────────┼──────────────────┐              │
                    │                  │                  │              │
                    ▼                  ▼                  ▼              │
           ┌─────────────┐   ┌─────────────┐   ┌─────────────┐         │
           │  Internal   │   │ Capability  │   │  Permission │         │
           │   Tool      │   │  Dispatch   │   │    Gate     │         │
           │ (search/etc)│   │(bash/fs/etc)│   │  (HITL)     │         │
           └──────┬──────┘   └──────┬──────┘   └──────┬──────┘         │
                  │                 │                 │                │
                  │                 │                 │ submit()       │
                  │                 │                 │ <──────────────│
                  │                 │                 │                │
                  └─────────────────┴─────────────────┘                │
                                    │                                  │
                                    │ tool_result                      │
                                    │ ────────────────────────────────>│
                                    │                                  │
                                    │ re-stream                        │
                                    │ <────────────────────────────────│
                                    │                                  │
                                    ▼                                  │
                              ┌──────────────┐                        │
                              │  completed   │                        │
                              │   / failed   │                        │
                              └──────────────┘                        │
```

---

## 6. Capabilities

Capabilities are bundles of tools and metadata registered on the global `ToolRegistry` during `AllternitAgent` construction.

| Capability | Tools Registered | Config |
|-----------|------------------|--------|
| `filesystem` | `read_file`, `write_file` | Uses `IEnvironment` |
| `computer-use` | `computer` (deferred) | `computerUseBaseUrl` |
| `brain` | `query_brain` | — |
| HITL (always) | `ask_user_question` | — |

---

## 7. Configuration Reference

### HarnessConfig

```typescript
interface HarnessConfig {
  mode: 'byok' | 'cloud' | 'local' | 'subprocess';
  byok?: {
    anthropic?: { apiKey: string };
    openai?: { apiKey: string };
    google?: { apiKey: string };
  };
  cloud?: { baseURL: string; accessToken: string };
  local?: { baseURL: string };
  subprocess?: { command: string; args?: string[]; env?: Record<string, string>; cwd?: string };
}
```

### AgentOptions

```typescript
interface AgentOptions {
  environment?: 'local' | 'lima' | 'cloud';
  capabilities?: string[];
  persistencePath?: string;
  computerUseBaseUrl?: string;
}
```

---

## 8. Extension Points

### Custom Tool

```typescript
import { ToolDefinition } from '@allternit/sdk/ai-runtime';

const myTool: ToolDefinition = {
  name: 'my_tool',
  description: 'Does something useful',
  input_schema: {
    type: 'object',
    properties: { param: { type: 'string' } },
    required: ['param']
  },
  preExecute: async (args, ctx) => ({ proceed: true }),
  execute: async (args, ctx) => 'result',
  postExecute: async (args, result, ctx) => { /* audit log */ }
};

agent.registerTool(myTool);
```

### Custom Capability

```typescript
class MyCapability {
  getTools(): ToolDefinition[] {
    return [/* ... */];
  }
}

// Register manually on the agent's global registry
const registry = (agent as any).globalToolRegistry;
for (const tool of new MyCapability().getTools()) {
  registry.registerTool(tool);
}
```

### Custom Storage Backend

```typescript
import { AgentStorage, IAgentStorageBackend } from '@allternit/sdk/ai-runtime';

class MyBackend implements IAgentStorageBackend {
  saveRun(record) { /* ... */ }
  getRun(id) { /* ... */ }
  listRuns() { /* ... */ }
}

const storage = new AgentStorage({ backend: new MyBackend() });
```
