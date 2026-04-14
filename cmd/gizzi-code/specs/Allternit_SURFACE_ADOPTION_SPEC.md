# A2R Surface Adoption Spec

**Version:** 1.0
**Date:** 2026-03-15
**Status:** Planning
**Depends on:** `A2R_SDK_SPEC.md`, `A2R_API_ROUTING_SPEC.md`

---

## Overview

Gizzi Code is the brain. `@a2r/sdk` is the nervous system. This spec defines how
each product surface connects to Gizzi Code via the SDK — replacing the current
patchwork of raw HTTP, worker RPC, and disconnected subprocess launching.

---

## Surface Map

### TUI (Local)

**Current state:** Uses `@a2r/sdk/v2` (stub — broken). Worker RPC works but is
not exposed through the SDK.

**Target:**
```typescript
// src/cli/ui/tui/context/sdk.tsx
import { createA2RClient } from "@a2r/sdk"

// When running locally (same Bun Worker process as server):
const sdk = createA2RClient({ mode: "local" })

// When attaching to remote:
const sdk = createA2RClient({ url: props.url })
```

**Migration steps:**
1. Fix v2 stub → real SDK (Phase 0, unblocks everything)
2. Update `sdk.tsx` to use new `createA2RClient` API
3. Update `sync.tsx` to use typed SDK resource methods
4. Remove `@a2r/sdk/v2` import path everywhere

**What changes:** Import path, method call signatures, event subscription.
Worker thread and Hono server stay untouched.

---

### A2R Desktop (Electron)

**Current state:** Spawns Gizzi Code as a subprocess. No API connection after launch.
Desktop is disconnected — it starts the server but can't talk to it.

**Target:**
```typescript
// In A2R Desktop (Electron main process or renderer)
import { createA2RClient } from "@a2r/sdk"

// Desktop knows the server URL (it spawned the process, it knows the port)
const sdk = createA2RClient({
  url: `http://localhost:${gizziPort}`,
  headers: { "x-a2r-instance": instanceID }
})

// Subscribe to session updates (real-time sync)
sdk.events.on("session.updated", (e) => {
  desktopState.updateSession(e.sessionID, e.session)
})

// Create and run sessions from Desktop UI
const session = await sdk.sessions.create({ agentID: selectedAgent })
for await (const event of sdk.sessions.run(session.id, { prompt: userInput })) {
  desktopState.appendEvent(event)
}
```

**What's needed:**
- `@a2r/sdk` published to package registry (or workspace dep)
- A2R Desktop adds `@a2r/sdk` to its dependencies
- Desktop IPC: main process holds SDK client, renderer queries via IPC
- Event bridge: SDK events → Desktop state → UI re-render

**Gap:** Desktop currently has no live connection to Gizzi Code after launch.
This is the biggest gap in the "brain to all surfaces" vision. SDK is what closes it.

---

### Thin-Client (Electron)

**Current state:** Uses raw HTTP `fetch()` to `localhost:4096`. Manually mirrors
SDK session operations in `src/renderer/src/lib/session-api.ts` without types.
Every server API change requires updating this file manually — no type safety.

**Target:**
```typescript
// Replace session-api.ts with SDK
import { createA2RClient } from "@a2r/sdk"

const sdk = createA2RClient({ url: connectionManager.serverUrl })

// session-api.ts becomes:
export const sessions = sdk.sessions
export const events = sdk.events
```

**Migration steps:**
1. Add `@a2r/sdk` to thin-client dependencies
2. Replace `session-api.ts` with SDK wrapper
3. Update all components that use `session-api.ts` to use SDK types
4. Remove manual type mirroring — types come from SDK now

**Benefit:** Type errors when server API changes. No more manual mirroring.

---

### Browser Extension / Chrome Extension

**Current state:** No SDK usage, no connection to Gizzi Code.

**Target:**
```typescript
import { createA2RClient } from "@a2r/sdk"

// Extension connects to user's local Gizzi Code instance or remote
const sdk = createA2RClient({
  url: await getGizziServerUrl(),  // From extension settings
  token: await getAuthToken()
})

// Can observe sessions, inject context, trigger runs
sdk.events.on("session.updated", updateExtensionBadge)
await sdk.sessions.run(sessionID, { prompt: capturedPageContent })
```

**Note:** Browser extensions have CORS constraints. The Gizzi Code server needs
`Access-Control-Allow-Origin` headers for the extension's origin.

---

### Plugin System

**Current state:** Plugins receive `createA2RClient` from the plugin integration.
The client they receive currently comes from the v2 stub path.

**Target:**
```typescript
// src/runtime/integrations/plugin/index.ts
import { createA2RClient } from "@a2r/sdk"

// Plugin host creates a scoped SDK client for the plugin
const pluginSDK = createA2RClient({ mode: "local" })

// Plugin receives full SDK access (scoped by plugin permissions)
plugin.init({ sdk: pluginSDK })
```

**Migration:** Same as TUI — fix v2 stub, update import path. Plugin API stays identical.

---

### External Agents (ACP)

**Current state:** ACP server exists in `src/runtime/integrations/acp/`. External
agents connect via JSON-RPC over stdio. The bridge from ACP → Gizzi Code exists
but uses the v2 stub internally.

**Target:**
```typescript
// An external agent (another AI system) connecting to Gizzi Code via ACP
import { createA2RClient } from "@a2r/sdk"

const sdk = createA2RClient({ url: gizziServerUrl })

// External agent sends a message to a Gizzi session
await sdk.agents.communicate(agentID, {
  type: "message",
  content: "Complete the task and report back",
  sessionID: targetSessionID
})
```

**What's needed:** `sdk.agents.communicate()` route must be built (it's in the SDK
spec but the route doesn't exist yet).

---

## Dependency / Publish Strategy

The SDK needs to be available to all surfaces. Options:

### Option A: Workspace dependency (current, internal only)
```json
// thin-client/package.json
{
  "dependencies": {
    "@a2r/sdk": "workspace:*"
  }
}
```
Works within the monorepo. Surfaces outside the monorepo can't use it.

### Option B: Private npm registry (recommended)
- Publish to GitHub Packages or a private npm registry
- All surfaces (monorepo + external) can install `@a2r/sdk`
- Version pinning works across repos
- Changelog and semver enforced

### Option C: GitHub Packages (pragmatic start)
```json
// .npmrc
@a2r:registry=https://npm.pkg.github.com
```
Free for public or private repos. Easy to set up. Surfaces add the `.npmrc` and
can install `@a2r/sdk`.

**Recommendation:** Start with workspace dependency while building the SDK. Move
to GitHub Packages when the surface adoption begins.

---

## Shared Type Strategy

All surface types come from `@a2r/sdk` — no separate type definitions per surface.

```typescript
// Every surface imports types from the SDK
import type { Session, Message, Agent, A2REvent } from "@a2r/sdk"

// NOT from their own type files
// NOT from raw API response shapes
```

When the server adds a new field to `Session`:
1. Server schema updates
2. OpenAPI spec regenerates
3. `sdk:build` runs → `types.gen.ts` updates
4. SDK publishes new version
5. All surfaces get a type error on the next update if they assumed the old shape
6. Fix surface code before shipping

This is the contract enforcement mechanism. It only works if all surfaces use the SDK.

---

## What Happens Without This

Without surface adoption, surfaces drift:
- Thin-client's `session-api.ts` manually mirrors 20+ endpoints with no type check
- Desktop has no live connection — it's a launcher, not a surface
- Extensions can't interact with sessions
- Every server API change requires hunting down manual copies in 3+ codebases

With surface adoption:
- One type change propagates everywhere automatically
- Desktop shows real-time session state
- Extensions can inject context into sessions
- External agents can control sessions via ACP + SDK

---

## Success Criteria

The nervous system is working when:
- [ ] TUI uses `@a2r/sdk` (not v2 stub)
- [ ] Thin-client uses `@a2r/sdk` (not raw HTTP)
- [ ] A2R Desktop has a live SDK connection to Gizzi Code
- [ ] `session.updated` event propagates to all connected surfaces simultaneously
- [ ] Adding a new API field requires changing exactly one file: the Hono route
- [ ] SDK publishes to package registry with semver
