# Phase 1 Task: Swarm Sandbox Tier (infra) + Adjacent Features Brainstorm

Read `SWARM_MIROFISH_MAP.md` first (same directory) for full context. This task is **Phase 1
only** — infra + a brainstorm doc. Do **not** start building the MiroFish product/simulation
layer (Phase 2) or the report/chat layer (Phase 3) in this pass.

## Scope

### 1. Swarm sandbox tier module

Create `surfaces/ai.allternit.com/src/lib/sandbox/swarm/` with:

- `types.ts` — Core types:
  - `SwarmUnit`: one ephemeral execution context (id, status, createdAt, metadata bag for
    caller-defined payload — the product layer will later stuff persona/memory data in here, but
    this module must stay agnostic to what that payload means).
  - `SwarmProvider` interface: `createBatch(specs: SwarmUnitSpec[]): Promise<SwarmUnit[]>`,
    `runBatch(units, fn)` or equivalent, `destroyBatch(unitIds: string[]): Promise<void>`,
    `status(unitId): Promise<SwarmUnit>`. Design this from what E2B's SDK actually exposes for
    batch/concurrent sandbox creation — don't invent an API shape E2B can't back.
  - Batch request/result types.
- `e2b-provider.ts` — `E2BSwarmProvider implements SwarmProvider`. Look up the current E2B npm
  SDK package name/version yourself (check npmjs.com or the E2B docs — do not guess a package
  name from memory, verify it resolves) and add it as a real dependency. Implement batch create
  and batch destroy using concurrent (`Promise.all`/bounded-concurrency) calls to the SDK, not a
  serial loop — that defeats the point of this tier. Read from `E2B_API_KEY` env var.
- `scheduler.ts` — Sits in front of a `SwarmProvider`. Responsibilities: bounded concurrency (the
  E2B SDK/API will have rate or concurrency limits — do not fire unbounded parallel requests; add
  a concurrency cap, configurable, sane default), batching many logical "create N units" calls
  into the underlying provider's batch API, and cleanup guarantees (destroyed units are actually
  destroyed even if some units in a batch failed to create — no leaked sandboxes on partial
  failure).
- `index.ts` — public exports.
- `README.md` — usage docs, same style/depth as the existing
  `surfaces/ai.allternit.com/src/lib/sandbox/README.md`.
- `scheduler.test.ts` (vitest, following the existing `smart-sandbox.test.ts` file for style) —
  test the scheduler against a **mock** `SwarmProvider` (do not hit real E2B in tests): batch
  create, batch destroy, partial-failure cleanup, concurrency cap is respected.

Log with `createModuleLogger('SwarmSandbox')` per `@/lib/logger` (see
`src/lib/ai/mcp/sandbox-client.ts` for the pattern). Use the `@/*` path alias for intra-repo
imports. This module must be fully standalone — it must not import anything from the deleted
`smart-sandbox.ts`/`docker-sandbox.ts`/etc. (they don't exist) and must not require a product-
layer concept like "persona" or "simulation round" anywhere in its types.

### 2. Dependency + env wiring

- Add the real E2B SDK package to `surfaces/ai.allternit.com/package.json` (verify the exact
  package name before adding — do not guess).
- Add `E2B_API_KEY=` to `surfaces/ai.allternit.com/.env.example`, in the same section style as the
  existing entries (see the `AUTH: Clerk` / `OPTIONAL: Service URLs` sections for the comment
  formatting convention), with a one-line comment on where to get a key.

### 3. Adjacent features brainstorm (doc only, no code)

Write `surfaces/ai.allternit.com/docs/SWARM_ADJACENT_FEATURES.md`: a list of product features this
swarm capability would unlock beyond the MiroFish prediction feature itself. Cover at least:
training-data/preference-pair generation from simulated agent populations, and vertical/domain-
specific agent personas as a standalone offering — plus whatever else you think is genuinely
adjacent (not a stretch). For each: one or two sentences on what it is, and one line on the main
tradeoff/cost of building it. This is a brainstorm for Eoj to pick from, not a spec — keep each
entry short.

## Constraints

- No builds, no typecheck, no dev server, no `pnpm install` runs that touch the lockfile in a way
  you haven't verified — if you add the E2B dependency to `package.json`, also update
  `pnpm-lock.yaml` via whatever the repo's normal flow is, but do not run the full app build to
  "test" it.
- No git operations (no commit, no branch changes) — you're already on a dedicated branch, leave
  committing to the reviewer.
- Do **not** touch `src/lib/agents/agent-workspace.service.ts`, `src/lib/agents/files-api.ts`,
  `src/lib/agents/useAgentBootstrap.ts`, `cmd/allternit-mux/`, anything under `rails/`, or
  `cmd/allternit-api/` — unrelated in-progress work lives there. If you think you need to, stop
  and report it in NOTES instead.
- Match repo idiom: `pnpm`, `vitest`, `@/*` alias, `createModuleLogger` logging pattern, existing
  README depth/style as your template for the new sandbox/swarm README.
- Do not start Phase 2 (MiroFish simulation engine) or Phase 3 (report/chat) — infra + brainstorm
  doc only.

## Deliverable sentinel

When finished, write `surfaces/ai.allternit.com/docs/SWARM_MIROFISH_PHASE_1_NOTES.md` starting
with YAML frontmatter:

```yaml
---
status: done|blocked
files_changed: [list every file you created or modified, repo-relative paths]
deviations: [anything you did differently from this spec, and why]
remaining: [anything left for Phase 2/3 or follow-up]
---
```

Followed by prose notes: what E2B SDK package/version you used, how the scheduler handles
partial-batch-failure cleanup, and the concurrency cap default you chose and why. That file
existing = this phase is done.
