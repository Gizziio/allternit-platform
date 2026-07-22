# LibreChat Agents -> Allternit Integration Review

Date: 2026-04-30

Source reviewed:
- https://www.librechat.ai/docs/features/agents
- https://www.librechat.ai/docs/features/agents_api
- https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/agents

## Executive take

Allternit does not need LibreChat's agent system wholesale. Most of the underlying primitives already exist:

- Platform agent records and builder flows already exist in `surfaces/allternit-platform/src/lib/agents/` and `src/views/agent-view/`.
- Agent session routing already exists in `surfaces/allternit-platform/src/app/api/v1/agent-sessions/[[...path]]/route.ts`.
- MCP infrastructure already exists in the gateway and platform.
- The SDK already has a harness abstraction in `sdk/allternit-sdk/src/ai-runtime/harness/`.

What LibreChat adds that is worth copying is the product packaging:

1. Agent profiles as first-class "models"
2. Per-agent capability toggles
3. Per-agent tool selection, especially MCP tool subsets
4. Remote API compatibility:
   - `POST /chat/completions`
   - `POST /responses`
   - `GET /models`
5. Deferred tool loading for large MCP inventories

The right move is not "embed LibreChat." The right move is "add a LibreChat-compatible remote agent profile layer on top of existing Allternit agents and harness/runtime infrastructure."

## What LibreChat Agents actually are

From the docs, LibreChat agents are a combination of:

- Agent identity:
  - name
  - description
  - avatar
  - instructions
  - model selection
- Agent execution policy:
  - temperature
  - max context tokens
  - max output tokens
  - max agent steps
- Capability switches:
  - code interpreter
  - file search
  - file context
  - MCP tools
  - deferred tools
  - artifacts
  - actions from OpenAPI
  - agent chain
  - web search
- Remote serving layer:
  - agents are exposed as "models"
  - OpenAI-compatible chat completions endpoint
  - Open Responses endpoint

That maps cleanly onto Allternit's architecture.

## Current Allternit fit

### Platform

Existing fit:

- `surfaces/allternit-platform/src/lib/agents/agent.types.ts`
  - already has core agent identity, provider, model, tools, capabilities, temperature, maxIterations
- `surfaces/allternit-platform/src/lib/agents/agent.service.ts`
  - already transforms agent CRUD requests between UI and backend
- `surfaces/allternit-platform/src/views/agent-view/components/CreateAgentForm.tsx`
  - existing builder surface
- `surfaces/allternit-platform/src/views/agent-view/components/AgentToolConfigurator.tsx`
  - natural place for MCP and tool scoping UX
- `surfaces/allternit-platform/src/stores/thread-agent-sessions.store.ts`
  - already supports per-thread agent sub-sessions / mentions
- `surfaces/allternit-platform/src/app/api/v1/agent-sessions/[[...path]]/route.ts`
  - already acts as a runtime translation layer for sessions and streamed messages

Missing compared with LibreChat:

- No normalized "agent profile" contract that treats agents as remote-callable model targets
- No `GET /models` view over accessible agents
- No OpenAI-compatible `/chat/completions` agent endpoint
- No Open Responses `/responses` endpoint
- No explicit per-agent capability matrix matching the LibreChat feature set
- No deferred MCP tool loading contract
- No agent-level artifact response contract

### SDK

Existing fit:

- `sdk/allternit-sdk/src/ai-runtime/harness/types.ts`
  - already models provider, model, messages, tools, and streaming chunks
- `sdk/allternit-sdk/src/ai-runtime/harness/index.ts`
  - already abstracts cloud, byok, local, and subprocess modes
- `sdk/allternit-sdk/package.json`
  - already exports `./harness`, `./ai-runtime`, and provider packages

Missing compared with LibreChat:

- No first-class `AgentProfile` / `RemoteAgent` abstraction
- No SDK client aimed at "invoke an agent by agent id"
- No OpenAI-compatible wrapper that resolves `model=<agentId>`
- No Responses API helper for agent execution
- No capability-aware tool discovery / deferred loading primitives

## Recommended architecture

### 1. Introduce an Agent Profile layer

Add a normalized profile object above the existing `Agent` type. Do not replace `Agent`; extend it.

Suggested shape:

```ts
type AgentCapability =
  | "execute_code"
  | "file_search"
  | "context"
  | "mcp_tools"
  | "deferred_tools"
  | "artifacts"
  | "actions"
  | "chain"
  | "web_search";

interface AgentProfile {
  agentId: string;
  version: string;
  avatarUrl?: string;
  instructions?: string;
  modelConfig: {
    provider: string;
    model: string;
    temperature?: number;
    maxContextTokens?: number;
    maxOutputTokens?: number;
    maxSteps?: number;
  };
  capabilities: Partial<Record<AgentCapability, boolean>>;
  toolPolicy: {
    builtInToolIds: string[];
    mcpServerIds: string[];
    allowedMcpToolIds: string[];
    deferredToolIds: string[];
  };
  files?: {
    contextFileIds: string[];
    searchFileIds: string[];
    codeInterpreterFileIds: string[];
  };
  artifactPolicy?: {
    enabled: boolean;
    customPromptMode?: boolean;
  };
}
```

Where to put it:

- Platform source of truth:
  - `surfaces/allternit-platform/src/lib/agents/agent.types.ts`
- SDK mirror type:
  - `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` or a new `src/ai-runtime/agents/types.ts`

### 2. Expose agents as remote-callable models

Copy LibreChat's useful API idea directly:

- `GET /api/agents/v1/models`
- `POST /api/agents/v1/chat/completions`
- `POST /api/agents/v1/responses`

But back it with Allternit's own runtime.

Routing behavior:

- `model` in these APIs should be an Allternit `agentId`
- resolve `agentId` -> `AgentProfile`
- build request:
  - prepend system instructions
  - attach allowed tools
  - attach artifact mode / file policies
  - enforce max steps
- dispatch through:
  - existing platform runtime session API for hosted execution, or
  - `AllternitHarness` for direct SDK-hosted execution

Best ownership:

- Platform API facade:
  - new route family under `surfaces/allternit-platform/src/app/api/agents/v1/...`
- Backend/gateway policy and MCP execution:
  - existing gateway / runtime components

### 3. Add deferred MCP tool loading

This is one of the best LibreChat ideas to adopt because Allternit already has significant MCP ambition.

Implementation direction:

- Keep current explicit tool selection
- Add a boolean flag per MCP tool: `deferred`
- Only inject non-deferred tools into the initial LLM tool list
- Inject one synthetic discovery tool:
  - `tool_search`
- `tool_search` returns available deferred tools filtered by:
  - agent permissions
  - server status
  - trust tier
  - policy gates
- Once a deferred tool is selected, hydrate it into the active session tool registry

Best ownership:

- Tool config UI:
  - `surfaces/allternit-platform/src/views/agent-view/components/AgentToolConfigurator.tsx`
- Runtime policy:
  - platform tool registry + gateway MCP registry
- SDK:
  - add type support for deferred tool descriptors and discovery responses

### 4. Add artifact mode as a first-class agent capability

LibreChat's artifact capability maps well to Allternit's existing visual surfaces.

Allternit should support agent responses that intentionally emit:

- React
- HTML
- Mermaid
- SVG

Recommended approach:

- do not copy LibreChat markdown syntax literally unless compatibility is required
- define an internal structured artifact envelope in stream events

Suggested stream event:

```ts
type ArtifactChunk = {
  type: "artifact";
  artifact: {
    id: string;
    mimeType:
      | "text/html"
      | "application/vnd.react"
      | "application/vnd.mermaid"
      | "image/svg+xml";
    title?: string;
    content: string;
  };
};
```

This fits Allternit's stronger UI model better than markdown parsing.

### 5. Separate built-in tools from OpenAPI actions

LibreChat treats OpenAPI-derived actions as agent tools. Allternit should do the same, but under stricter policy.

Recommended model:

- built-in tools
- MCP tools
- action tools (OpenAPI-imported)

Action tools need:

- domain allowlist
- auth binding
- schema validation
- explicit side-effect classification
- trust-tier-based gating

This belongs more naturally in Allternit than in LibreChat because your platform already has stronger governance concepts.

## Platform implementation plan

### Phase 1: Data model and API shape

Goal: make agents remotely invokable as profiles.

Changes:

- Extend `Agent` persistence shape with:
  - agent instructions alias
  - max context tokens
  - max output tokens
  - capability flags object
  - tool policy object
  - artifact policy object
- Add new route family:
  - `GET /api/agents/v1/models`
  - `POST /api/agents/v1/chat/completions`
  - `POST /api/agents/v1/responses`
- Add request resolver:
  - `agentId -> AgentProfile -> runtime request`

Files likely involved:

- `surfaces/allternit-platform/src/lib/agents/agent.types.ts`
- `surfaces/allternit-platform/src/lib/agents/agent.service.ts`
- `surfaces/allternit-platform/src/app/api/v1/agent-sessions/[[...path]]/route.ts`
- new `surfaces/allternit-platform/src/app/api/agents/v1/...`

### Phase 2: Builder UX parity

Goal: make agent configuration match the useful parts of LibreChat's builder.

Changes:

- Add capability toggles:
  - execute code
  - file search
  - file context
  - MCP tools
  - deferred tools
  - artifacts
  - actions
  - chain
  - web search
- Add model policy inputs:
  - max context tokens
  - max output tokens
  - max steps
- Add MCP server + per-tool selection UI
- Add "defer loading" toggle for MCP tools

Files likely involved:

- `surfaces/allternit-platform/src/views/agent-view/components/CreateAgentForm.tsx`
- `surfaces/allternit-platform/src/views/agent-view/components/EditAgentForm.tsx`
- `surfaces/allternit-platform/src/views/agent-view/components/AgentToolConfigurator.tsx`

### Phase 3: Runtime semantics

Goal: execute profile-defined agents consistently.

Changes:

- enforce `maxSteps` at runtime
- inject instructions and file context
- resolve built-in tools and MCP tools through one tool registry
- add artifact events to stream protocol
- add `tool_search` for deferred tools

Files likely involved:

- platform runtime bridge
- gateway MCP routing
- SDK harness stream types

### Phase 4: SDK surface

Goal: let developers invoke Allternit agents the same way LibreChat exposes agents programmatically.

Recommended SDK additions:

```ts
client.agents.listModels()
client.agents.responses.create({ model: agentId, input })
client.agents.chat.completions.create({ model: agentId, messages })
client.agents.get(agentId)
```

Also add:

- `AgentProfile`
- `AgentCapability`
- `ArtifactChunk`
- `DeferredToolDescriptor`

Best location:

- `sdk/allternit-sdk/src/ai-runtime/agents/`
- export from package root

## What not to copy from LibreChat

- Do not copy the YAML-first admin model. Allternit should keep API-backed, multi-tenant config as source of truth.
- Do not copy their artifact markdown format as your primary representation.
- Do not make MCP servers the only tool abstraction; Allternit already has broader tool/plugin directions.
- Do not treat "agent chain" as the main orchestration primitive. Allternit already has stronger swarm/orchestrator concepts.

## Main risks

### 1. Type fragmentation

Right now agent concepts exist in multiple layers:

- platform UI types
- runtime/session payloads
- SDK harness types

If LibreChat-style profiles are added separately in each layer, the result will drift fast. Define one canonical `AgentProfile` contract early.

### 2. Tool explosion in context

If all MCP tools are injected into every agent call, quality will degrade. Deferred tools are not optional for serious MCP use.

### 3. Two competing invocation paths

Today Allternit already has:

- session-oriented runtime APIs
- harness-oriented SDK execution

The remote agents API needs one execution contract underneath, not parallel logic branches that diverge in tool behavior.

### 4. Artifact protocol mismatch

If artifacts are emitted as plain text without a typed event or parser contract, platform rendering will become fragile.

## Recommended first milestone

Ship the smallest useful subset first:

1. Add `AgentProfile` to platform and SDK types
2. Expose `GET /api/agents/v1/models`
3. Expose `POST /api/agents/v1/chat/completions`
4. Resolve `model=<agentId>` to existing agent config
5. Support:
   - instructions
   - model/provider
   - temperature
   - max steps
   - built-in tools
   - MCP tool allowlist
6. Defer:
   - artifacts
   - actions
   - file search
   - file context
   - chain
   - deferred tool loading

That gives you immediate compatibility value and a stable contract to build on.

## Bottom line

LibreChat's core insight is correct: agents should be configurable profiles that can also be invoked remotely as if they were models.

Allternit already has most of the hard pieces. The missing layer is a clean contract that unifies:

- platform builder state
- runtime execution policy
- MCP tool scoping
- SDK invocation
- OpenAI-compatible remote API exposure

If implemented this way, Allternit gets the best part of LibreChat's agent product without inheriting its weaker assumptions.
