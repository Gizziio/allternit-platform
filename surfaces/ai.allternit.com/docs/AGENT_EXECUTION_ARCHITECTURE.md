# Agent Execution Architecture — Platform

How the Allternit Platform integrates with `@allternit/sdk/ai-runtime` for agent execution.

---

## 1. Overview

The platform's agent execution layer is split across two packages:

- **`@allternit/sdk/ai-runtime`** — Core runtime (harness, agent, tools, capabilities)
- **`allternit-platform`** — Next.js surface layer (DB, MCP, sessions, HTTP API)

The platform acts as a **host** for the SDK runtime, providing:
- Per-request `AllternitAgent` construction
- MCP tool discovery from database records
- Filesystem sandboxing via `AGENT_WORKSPACE_BASE`
- Computer-use gateway via `ACU_GATEWAY_URL`
- Session-scoped tool registry persistence
- HITL event handling (auto-approve / auto-respond)
- gizzi fallback (removed — SDK path is now required)

---

## 2. Key Files

| File | Role |
|------|------|
| `src/lib/agents/sdk-agent-executor.ts` | Bridge: creates SDK agent, wires MCP/tools, handles events |
| `src/lib/agents/agent-profile.ts` | Maps `Agent` DB record → `AgentProfile` with capabilities |
| `src/app/api/agents/v1/_lib.ts` | API layer: `invokeAgentTextCompletion`, `streamAgentTextCompletion` |
| `src/app/api/agents/v1/route.ts` | Next.js route handlers for sync + streaming endpoints |

---

## 3. Execution Flow

### 3.1 Synchronous Completion

```
POST /api/agents/v1/invoke
│
├─> route.ts: validate request
│
├─> _lib.ts: invokeAgentTextCompletion(agentId, prompt, userId, options)
│   │
│   ├─> load agent + profile from DB
│   ├─> getSessionToolRegistry(sessionId, agentId, userId)
│   │   ├─> buildAgentToolRegistry() — create fresh registry
│   │   └─> rehydrate from persisted toolSnapshot in conversation metadata
│   │
│   ├─> invokeSdkCompletion(agent, profile, { sessionId, messages, registry })
│   │   │
│   │   ├─> buildHarnessConfig(provider, model) from env keys
│   │   ├─> createSdkAgent(harness, agent, profile, registry)
│   │   │   ├─> fetchMcpTools(agent.mcpServerIds) — DB → MCPClient → listTools()
│   │   │   ├─> buildFilesystemTools(agent.id) — read_file / write_file
│   │   │   └─> set capabilities (computer_use, filesystem, etc.)
│   │   │
│   │   ├─> agent.run(request)
│   │   ├─> collect events: text, tool_call, completed, reply_requested
│   │   └─> return { content, sessionId, toolCalls, hitlEvents }
│   │
│   └─> persistConversationMessage({ ..., metadata: { tool_calls, hitl_events } })
│
└─> route.ts: return JSON response
```

### 3.2 Streaming Completion

```
POST /api/agents/v1/stream
│
├─> route.ts: validate request
│
├─> _lib.ts: streamAgentTextCompletion(agentId, prompt, userId, options)
│   │
│   ├─> (same setup as sync: load agent, get session registry)
│   │
│   ├─> streamSdkCompletion(agent, profile, { sessionId, messages, registry })
│   │   │
│   │   ├─> createSdkAgent(...) — same as sync
│   │   ├─> agent.run(request)
│   │   ├─> transform events → SSE stream (text, tool_call, completed, error)
│   │   └─> result: Promise<SdkCompletionResult> resolves on completed/error
│   │
│   ├─> stream via ReadableStream<Uint8Array> → Next.js Response
│   │
│   └─> (after stream closes) persist tool_calls + hitl_events in metadata
│
└─> route.ts: return streaming Response
```

---

## 4. SDK Agent Construction

### 4.1 Harness Configuration

```typescript
function buildHarnessConfig(provider: string, model: string): HarnessConfig {
  const mode = detectMode(provider); // 'byok' for anthropic/openai/google, 'local' for ollama
  return {
    mode,
    byok: {
      anthropic: provider === 'anthropic' ? { apiKey: process.env.ANTHROPIC_API_KEY! } : undefined,
      openai: provider === 'openai' ? { apiKey: process.env.OPENAI_API_KEY! } : undefined,
      google: provider === 'google' ? { apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! } : undefined,
    },
    local: provider === 'local' ? { baseURL: process.env.OLLAMA_BASE_URL! } : undefined,
  };
}
```

### 4.2 Cloud Mode

When `HarnessConfig.mode` is `'cloud'`, the harness streams SSE from the Allternit Cloud API:

```typescript
const harness = new AllternitHarness({
  mode: 'cloud',
  cloud: {
    baseURL: 'https://api.allternit.com',
    accessToken: 'your-oauth-token',
  },
});
```

The cloud endpoint is `POST /api/agents/v1/chat/completions` with `stream: true`. The response is parsed as OpenAI-compatible SSE, yielding `text`, `tool_call_complete`, and `done` chunks.

### 4.2 Agent Initialization

```typescript
async function createSdkAgent(
  harness: AllternitHarness,
  agent: Agent,
  profile: AgentProfile,
  registry?: ToolRegistry
): Promise<AllternitAgent> {
  const sdkAgent = new AllternitAgent(harness, {
    capabilities: deriveCapabilities(agent),
    computerUseBaseUrl: process.env.ACU_GATEWAY_URL || 'http://127.0.0.1:8760',
    persistencePath: process.env.SDK_RUNS_DB_PATH,
  });

  // 1. MCP tools from DB
  if (agent.mcpServerIds?.length) {
    const mcpTools = await fetchMcpTools(agent.mcpServerIds);
    for (const tool of mcpTools) sdkAgent.registerDeferredTool(tool);
  }

  // 2. Filesystem tools (sandboxed)
  if (profile.capabilities.filesystem) {
    const fsTools = buildFilesystemTools(agent.id);
    for (const tool of fsTools) sdkAgent.registerTool(tool);
  }

  // 3. Rehydrate from session registry if provided
  if (registry) {
    for (const tool of registry.getActiveTools()) sdkAgent.registerTool(tool);
    for (const [id, tool] of registry.getDeferredTools()) sdkAgent.registerDeferredTool(tool);
  }

  return sdkAgent;
}
```

---

## 4.5 Agent Instance Caching

`AllternitAgent` instances are cached in the executor module to enable:
- Faster subsequent requests for the same agent configuration
- **Interactive HITL resume** (requires the same agent instance in memory)

**Cache key:** `agentId::provider::model::capabilities::mcpServerIds::mode`

**Cache TTL:** 5 minutes

```typescript
const agentCache = new Map<string, Promise<AllternitAgent>>();

function getAgentCacheKey(agent, profile, harnessConfig): string {
  return [
    agent.id,
    agent.provider,
    profile.modelConfig.model,
    agent.capabilities.sort().join(","),
    (profile.toolPolicy.mcpServerIds ?? []).sort().join(","),
    harnessConfig.mode,
  ].join("::");
}
```

On cache hit, the session registry is re-seeded on top of the existing global registry. The per-run `fork()` in `AgentRun.run()` ensures each execution gets an isolated tool registry copy.

---

## 5. MCP Tool Integration

MCP tools are discovered dynamically from database records.

### 5.1 Discovery Flow

```
Agent.mcpServerIds
│
├─> DB: McpConnector records
│   └─> { id, name, url, type, oauthClientId, oauthClientSecret }
│
├─> MCPClient.connect() — @ai-sdk/mcp with OAuth
│   └─> OAuth token persisted in SQLite (McpOAuthSession table)
│
├─> client.listTools() — fetch real schemas from MCP server
│
└─> Cache: 60s TTL per server ID
```

### 5.2 Deferred Tool Registration

Each MCP tool is registered as a `DeferredToolDefinition`:

```typescript
{
  id: `mcp:${serverId}:${toolName}`,
  name: toolName,
  description: toolDescription,
  input_schema: toolInputSchema, // from MCP server
  activate: () => ({
    name: toolName,
    description: toolDescription,
    input_schema: toolInputSchema,
    execute: async (args) => mcpClient.callTool(toolName, args)
  })
}
```

The LLM uses `tool_search` to find MCP tools and `tool_activate` to activate them before calling.

---

## 6. Session Tool Registry

The platform persists the tool registry state per conversation session.

### 6.1 Registry Lifecycle

```
New Session
│
├─> buildAgentToolRegistry() — fresh registry with native tools
│
├─> (conversation progresses)
│   ├─> tool_search → discover deferred tools
│   ├─> tool_activate → move to active
│   └─> tool calls execute
│
├─> persistToolRegistrySnapshot(sessionId)
│   └─> store `toolSnapshot` JSON in conversation metadata
│
└─> Next request
    └─> getSessionToolRegistry(sessionId)
        ├─> build fresh registry
        └─> rehydrate from persisted toolSnapshot
```

### 6.2 Snapshot Format

```typescript
interface ToolRegistrySnapshot {
  activeToolNames: string[];      // Currently active tools
  discoveredToolIds: string[];    // Known but inactive tools
  sessionPolicies: Record<string, ToolPolicy>;  // Per-tool policies
}
```

---

## 7. HITL (Human-in-the-Loop)

### 7.1 HITL Policies

| Policy | Behavior |
|-----------|----------|
| `auto` | Auto-approve permissions, auto-deny questions |
| `reject_destructive` | Auto-approve non-destructive, deny destructive tools, auto-deny questions |
| `pause` | **Store pending run and return `pendingHitl`** — client must call resume endpoint |

### 7.2 Event Storage

HITL events are stored in two places:
1. `SdkCompletionResult.hitlEvents` — returned from executor
2. Conversation metadata — persisted for audit trail

```typescript
interface HitlEvent {
  id: string;
  type: 'permission_request' | 'question';
  toolName?: string;
  args?: Record<string, unknown>;
  response?: string;
  timestamp: string;
}
```

### 7.3 Interactive HITL Flow

When `hitlPolicy` is `"pause"`:

1. AgentRun emits `reply_requested` and pauses
2. Executor stores `{ agent, run, hitlRequest }` in `pendingRuns` Map keyed by `runId`
3. `SdkCompletionResult` includes `pendingHitl: { runId, type, payload }`
4. Client calls `POST /api/agents/v1/resume` with `{ runId, outcome }`
5. `resumeSdkRun()` retrieves the pending run, sets up event listeners, and calls `agent.submitReply(runId, outcome)`
6. Run continues; final result returned from resume endpoint

**Requirements:** The `AllternitAgent` instance must still be cached in the same process. Agent caching is enabled with a 5-minute TTL.

### 7.4 Resume Endpoint

```typescript
POST /api/agents/v1/resume
Body: {
  runId: string;
  outcome: {
    type: "permission";
    approved: boolean;
    reason?: string;
  } | {
    type: "question";
    answers: string[];
  };
}
```

---

## 8. Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | `buildHarnessConfig` | Anthropic BYOK |
| `OPENAI_API_KEY` | `buildHarnessConfig` | OpenAI BYOK |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `buildHarnessConfig` | Google BYOK |
| `OLLAMA_BASE_URL` | `buildHarnessConfig` | Local Ollama endpoint |
| `ACU_GATEWAY_URL` | `createSdkAgent` | Computer-use gateway |
| `SDK_RUNS_DB_PATH` | `AgentStorage` | SDK run persistence DB |
| `AGENT_WORKSPACE_BASE` | `buildFilesystemTools` | Filesystem sandbox root |

---

## 9. Data Flow Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                        HTTP Request                                    │
│                   POST /api/agents/v1/{invoke,stream}                 │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│                     Next.js Route Handler                              │
│                   src/app/api/agents/v1/route.ts                       │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    API Library (_lib.ts)                               │
│              invokeAgentTextCompletion / streamAgentTextCompletion     │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│                   SDK Agent Executor                                    │
│                 src/lib/agents/sdk-agent-executor.ts                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ buildHarness│  │fetchMcpTools│  │buildFilesys-│  │ createSdkAgent│ │
│  │   Config    │  │             │  │ temTools     │  │               │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘ │
│         │                │                │                  │         │
│         ▼                ▼                ▼                  ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │              @allternit/sdk/ai-runtime                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │  │
│  │  │AllternitAgent│  │  ToolRegistry │  │  AgentRun               │ │  │
│  │  │             │  │             │  │  (LLM loop + tools)      │ │  │
│  │  └──────┬──────┘  └──────┬──────┘  └───────────┬──────────────┘ │  │
│  │         │                │                       │               │  │
│  │         └────────────────┴───────────────────────┘               │  │
│  │                          │                                       │  │
│  │                          ▼                                       │  │
│  │                 ┌─────────────────┐                              │  │
│  │                 │ AllternitHarness │                              │  │
│  │                 │  (BYOK/Local/...)│                              │  │
│  │                 └────────┬────────┘                              │  │
│  │                          │                                       │  │
│  └──────────────────────────┼───────────────────────────────────────┘  │
│                             │                                          │
│                             ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    LLM Provider                                  │  │
│  │         Anthropic / OpenAI / Google / Ollama                     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    Response + Persistence                              │
│  - Stream text/tool_call/completed/error events                        │
│  - Persist tool_calls + hitl_events in conversation metadata           │
│  - Persist toolSnapshot for session registry state                     │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 10. Testing

### 10.1 SDK Tests

Run in `sdk/allternit-sdk/`:
```bash
# Harness streaming tests
npx vitest run harness-streaming.test.ts

# All tests
npx vitest run
```

### 10.2 Platform Tests

The platform does not yet have dedicated SDK executor tests. The integration is tested via:
- Manual API calls to `/api/agents/v1/invoke`
- Existing agent e2e tests (may need updates for SDK path)

---

## 11. Known Limitations

| Issue | Status | Notes |
|-------|--------|-------|
| Cloud mode | ✅ Implemented | `streamFromCloud` streams SSE from Allternit Cloud API |
| Interactive HITL | ✅ Implemented | `hitlPolicy: "pause"` stores pending runs; `POST /api/agents/v1/resume` submits replies |
| Agent caching | ✅ Implemented | `AllternitAgent` cached by config hash with 5-min TTL |
| Node memory | ✅ Fixed | `NODE_OPTIONS=--max-old-space-size=4096` added to `build`, `dev`, `dev:clean` |
| gizzi fallback | ✅ Removed | SDK path is now required |
