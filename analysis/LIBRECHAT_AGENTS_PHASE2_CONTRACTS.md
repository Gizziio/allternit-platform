# LibreChat Agents Phase 2 Contracts

Date: 2026-04-30

This note captures the next contract layer after the initial remote-agent compatibility work:

- deferred MCP tool loading
- typed artifact stream support

## Deferred MCP tools

Goal:
- avoid injecting large MCP tool inventories into every request
- let an agent discover tools lazily

Suggested contract:

```ts
interface DeferredToolDescriptor {
  id: string;
  label: string;
  serverId?: string;
  description?: string;
}
```

Expected runtime behavior:

1. Agent profile contains `toolPolicy.deferredToolIds`
2. Initial tool list excludes deferred tools
3. Runtime injects a synthetic discovery tool such as `tool_search`
4. `tool_search` returns `DeferredToolDescriptor[]`
5. Selected deferred tools are hydrated into the active session

Open implementation items:

- connect to platform MCP registry
- apply per-agent allowlists
- apply trust-tier/policy enforcement
- cache discovery results per session

## Artifact stream support

Goal:
- support agent output that is more structured than plain markdown text

Suggested contract:

```ts
interface AgentArtifact {
  id: string;
  mimeType:
    | "text/html"
    | "application/vnd.react"
    | "application/vnd.mermaid"
    | "image/svg+xml";
  title?: string;
  content: string;
}

interface ArtifactChunk {
  type: "artifact";
  artifact: AgentArtifact;
}
```

Expected runtime behavior:

1. Agent profile enables `artifactPolicy.enabled`
2. Runtime can emit normal text chunks and artifact chunks in the same response
3. Platform renders artifacts in the correct surface instead of treating them as plain text

Open implementation items:

- add artifact emission to runtime adapters
- add artifact rendering to chat/agent surfaces
- decide whether OpenAI-compatible endpoints expose artifacts through extensions or side-channel metadata

## Why this is phase 2

The initial remote-agent compatibility slice is already useful with:

- agent-as-model discovery
- chat completions
- responses API
- basic streaming

Deferred tools and artifacts should build on that contract instead of being mixed into the first execution slice.
