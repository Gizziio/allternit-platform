# A2R API + Routing Overhaul Spec

**Version:** 1.0
**Date:** 2026-03-15
**Status:** Planning — not yet built
**Related:** `A2R_SDK_SPEC.md`

---

## Problem Statement

The Hono server currently has 21+ route groups that grew organically as features
were added. The SDK was generated from those routes after the fact. This created:

- Routes named by implementation detail, not by consumer intent
- No clear versioning on routes — breaking changes have no version boundary
- SDK surface and route surface are misaligned (SDK has more stubs than real routes)
- No consistent error response shape across routes
- Event emission is ad-hoc — some state changes emit events, some don't

The overhaul makes the **SDK surface the contract**. Routes exist to serve what
the SDK exposes, not the other way around.

---

## Design Principles

1. **SDK-first routing.** Every route group maps 1:1 to an SDK resource.
   If the SDK has `sdk.sessions`, there is a `/v1/session` route group.
2. **Versioned.** All routes under `/v1/`. Future breaking changes go to `/v2/`.
   Routes never change their response shape without a version bump.
3. **Consistent response envelope.** Every route returns the same shape:
   ```json
   { "data": <payload> }          // success
   { "error": { "code": "SESSION_NOT_FOUND", "message": "..." } }  // error
   ```
4. **Every state change emits an event.** Session created → `session.created` event.
   Message completed → `message.completed` event. No exceptions.
5. **OpenAPI spec is generated from the routes, not handwritten.**
   Hono + Zod validators → OpenAPI spec → `types.gen.ts` → SDK types.

---

## Current Route Inventory (Organic)

```
/session          — session CRUD + actions
/tui              — TUI-specific state
/provider         — provider listing + auth
/config           — configuration
/project          — project operations (unclear scope)
/agent            — agent CRUD
/global           — global state (unclear)
/mcp              — MCP server management
/permission       — permission checking
/instance         — instance lifecycle
/app              — app-level: agents, skills, log
/event            — SSE event subscription
/file             — file search
/auth             — auth operations
/cron             — cron job scheduling
/verification     — verification system
/skill            — skills
/ars-contexta     — knowledge graph + insights
/web-proxy        — proxies to web UI
/experimental     — experimental features
/user             — user info
```

Problems: `/global`, `/project`, `/tui`, `/app` have unclear boundaries.
`/event` works but isn't documented. `/experimental` is a catch-all.

---

## Target Route Structure

```
/v1/
├── session/          — Session CRUD + actions
├── agent/            — Agent CRUD + ACP
├── provider/         — Provider listing + auth flows
├── memory/           — L1/L2 memory access
├── cron/             — Cron scheduling
├── skill/            — Skills
├── verification/     — Verification + certificates
├── mcp/              — MCP server management
├── file/             — File search + read
├── config/           — Configuration
├── instance/         — Instance lifecycle + sync
├── event/            — SSE subscription (SSE, not JSON)
└── user/             — User info (Clerk)
```

`/ars-contexta` stays as-is — it's an external service proxy, not a first-party resource.
`/web-proxy` stays as-is — utility, not part of the platform contract.
`/experimental` is dissolved — features either graduate to a proper route or are removed.

---

## Route Specs Per Resource

### `/v1/session`

```
GET    /v1/session              — list all sessions
POST   /v1/session              — create session
GET    /v1/session/:id          — get session
DELETE /v1/session/:id          — delete session
PATCH  /v1/session/:id          — update session (title, model)

GET    /v1/session/:id/messages — list messages
POST   /v1/session/:id/prompt   — send message (triggers run)
POST   /v1/session/:id/command  — send slash command
POST   /v1/session/:id/abort    — abort running loop
POST   /v1/session/:id/fork     — fork from message ID
POST   /v1/session/:id/share    — create share link
POST   /v1/session/:id/clear    — delete all messages
POST   /v1/session/:id/resume   — resume with continuity
POST   /v1/session/:id/snapshot — create snapshot
POST   /v1/session/:id/revert   — revert to snapshot
POST   /v1/session/:id/handoff  — create handoff token
```

Events emitted:
- `session.created`, `session.updated`, `session.deleted`, `session.cleared`
- `message.created`, `message.part.delta`, `message.part.snapshot`, `message.completed`
- `tool.started`, `tool.completed`
- `permission.required`, `question.required`

### `/v1/agent`

```
GET    /v1/agent                — list agents
POST   /v1/agent                — create agent
GET    /v1/agent/:id            — get agent
PATCH  /v1/agent/:id            — update agent
DELETE /v1/agent/:id            — delete agent
POST   /v1/agent/:id/communicate — send ACP message to agent
```

Events emitted: `agent.created`, `agent.updated`, `agent.deleted`

### `/v1/provider`

```
GET    /v1/provider             — list providers with models
POST   /v1/provider/auth/set    — set credentials
DELETE /v1/provider/:id/auth    — remove credentials
GET    /v1/provider/auth/:id/oauth/authorize — start OAuth flow
POST   /v1/provider/auth/:id/oauth/verify    — complete OAuth flow
```

Events emitted: `provider.connected`, `provider.disconnected`, `provider.auth.required`

### `/v1/memory` (A2R-native, new route)

```
GET    /v1/memory/l2            — list L2 memory files
GET    /v1/memory/l2/:type      — get L2 file (soul/conventions/voice)
PUT    /v1/memory/l2/:type      — update L2 file
GET    /v1/memory/l1/:sessionID — get working memory for session
PUT    /v1/memory/l1/:sessionID — update working memory
```

### `/v1/cron`

```
GET    /v1/cron                 — list cron jobs
POST   /v1/cron                 — create cron job
GET    /v1/cron/:id             — get job
DELETE /v1/cron/:id             — delete job
POST   /v1/cron/:id/run         — trigger run immediately
GET    /v1/cron/:id/status      — run status
GET    /v1/cron/:id/history     — run history
```

Events emitted: `cron.started`, `cron.completed`, `cron.failed`

### `/v1/skill`

```
GET    /v1/skill                — list skills
GET    /v1/skill/:id            — get skill
POST   /v1/skill/:id/execute    — execute skill
```

### `/v1/verification`

```
POST   /v1/verification/:sessionID        — run verification
GET    /v1/verification/:sessionID        — get latest result
GET    /v1/verification/:sessionID/certificate — get certificate
GET    /v1/verification/:sessionID/history    — history
GET    /v1/verification/policy            — list policies
PUT    /v1/verification/policy/:id        — set policy
```

Events emitted: `verification.started`, `verification.completed`

### `/v1/mcp`

```
GET    /v1/mcp                  — list MCP servers with status
POST   /v1/mcp                  — add MCP server
DELETE /v1/mcp/:name            — remove MCP server
GET    /v1/mcp/status           — all server status
GET    /v1/mcp/:name/resources  — list resources for server
```

Events emitted: `mcp.connected`, `mcp.disconnected`, `mcp.error`

### `/v1/file`

```
GET    /v1/file/search          — search files (?q=query)
GET    /v1/file/read            — read file (?path=...)
GET    /v1/file/glob            — glob pattern (?pattern=...)
```

### `/v1/config`

```
GET    /v1/config               — get config
PATCH  /v1/config               — update config
GET    /v1/config/providers     — provider-specific config
```

### `/v1/instance`

```
GET    /v1/instance/sync        — full state snapshot (TUI hydration)
POST   /v1/instance/dispose     — shut down instance
GET    /v1/instance/health      — health check
```

Events emitted: `instance.sync`, `server.instance.disposed`

### `/v1/event` (SSE — not JSON)

```
GET    /v1/event                — SSE stream of all A2REvents
```

Returns `text/event-stream`. Each event is `data: <JSON>\n\n`.
Reconnect is handled by the SDK's transport layer.

### `/v1/user`

```
GET    /v1/user                 — current user info (from Clerk or local)
```

---

## Response Envelope

Every route returns:

```typescript
// Success
{ "data": T }

// Error
{
  "error": {
    "code": string,         // A2R error code (see SDK error taxonomy)
    "message": string,      // Human-readable
    "details"?: unknown     // Optional structured details
  }
}
```

HTTP status codes:
- `200` — success
- `201` — created
- `400` — bad request (validation failure, wrong params)
- `401` — auth required
- `403` — permission denied
- `404` — resource not found
- `409` — conflict (session busy, etc.)
- `500` — internal error

---

## Event Emission Contract

Every route that mutates state MUST emit the corresponding event on the GlobalBus
before returning the response. This is enforced via middleware.

```typescript
// Middleware pattern
app.post("/v1/session", async (c) => {
  const session = await Session.create(...)
  GlobalBus.emit({ type: "session.created", sessionID: session.id, session })
  return c.json({ data: session }, 201)
})
```

The SSE `/v1/event` route subscribes to GlobalBus and forwards all events.
Every surface that subscribes to `/v1/event` gets every state change in real-time.

---

## OpenAPI Spec Generation

The Hono routes + Zod validators automatically produce an OpenAPI spec via the
existing `/doc` route. This spec is the source of truth for:

1. `types.gen.ts` in the SDK (run `sdk:build` after server changes)
2. API documentation
3. Type validation in tests

**Workflow:**
```
Edit Hono route + Zod schema
    ↓
Server generates updated /doc (OpenAPI JSON)
    ↓
bun run sdk:build
    ↓
types.gen.ts updated
    ↓
TypeScript surfaces see type errors if they use removed/changed fields
    ↓
Fix surface code before shipping
```

---

## Migration Plan

### Phase 1 — Add `/v1` prefix, keep old routes (no breaking change)
- Add Hono route group `/v1/`
- Duplicate existing route logic under `/v1/`
- SDK points to `/v1/` routes
- Old routes still work (backward compat for raw-HTTP surfaces)

### Phase 2 — Consolidate scattered routes
- Merge `/app/agents` → `/v1/agent`
- Merge `/app/skills` → `/v1/skill`
- Merge `/global` + `/tui` into `/v1/instance/sync`
- Clarify and migrate `/project` scope

### Phase 3 — New routes for missing A2R resources
- Add `/v1/memory` (L1/L2)
- Add `/v1/verification` (expose existing verification system)
- Ensure all routes emit correct GlobalBus events

### Phase 4 — Deprecate old routes
- Return `Deprecation` header on old routes
- Remove old routes in next major server version

---

## What This Enables

Once this is done:
- Every SDK resource has a real route backing it
- OpenAPI spec is complete and accurate
- `types.gen.ts` reflects the full A2R platform API
- Every surface gets the same typed access
- Adding a new resource = new route + SDK resource + auto-typed for all surfaces
- No more route drift between what exists and what's documented
