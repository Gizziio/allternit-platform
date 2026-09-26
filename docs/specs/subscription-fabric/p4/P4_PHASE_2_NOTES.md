# P4 Phase 2 — Implementation Notes

Scope: `docs/specs/subscription-fabric/p4/P4_PHASE_2_TASK.md`. Builds on Phase 1
(router + quota pools, `ef33e5ee7`). All changes under
`services/subscription-gateway/`, `cmd/cli/`, and this spec folder.

## What was built

### 1. Subs model catalog (D13 model-selector feed)

- `services/subscription-gateway/src/catalog/subs_models.ts` —
  `subsModelCatalog(snapshot, options?)`, a pure derivation from the Phase 1
  snapshot assembler (`buildSnapshot` — no second assembly path). For each
  registered adapter manifest × enabled account × chat-family capability × model
  class it emits one picker entry:
  `{ id: "subs/<provider>:<model_class>", name: "<label> (subscription) · <TitleCase>",
     provider, tier, description: "Subscription lane — no metered cost",
     supports_effort: false, health: "ready" | "degraded",
     fabric: { adapter_id, account_id, capability, options: { model_class }, pool_key } }`.
- `services/subscription-gateway/src/http/routes_catalog.ts` — `GET /v1/catalog`,
  mounted in `server.ts` next to `/v1/capabilities` and sharing its auth pattern
  (any valid bearer token, no scope). Returns `[]` when no registry is wired.
- Health gating: an entry appears only when the account's effective session
  health (snapshot override wins over the stored account row, same as the
  router) is `ready` or `degraded`; the badge is that value. Every other health
  (`auth_required`, `challenge_presented`, `user_intervention_required`,
  `provider_down`, `ui_drift`, `unknown`, …) hides the entry — the picker must
  not offer routes that need a human.

### 2. Observability

- `services/subscription-gateway/src/store/migrations/0003_route_rejections.sql`
  — new `route_rejections` table (`id`, `task_id`, `decision_id`, `adapter_id`,
  `account_id NULL`, `reason`, `created_at`) with a `(created_at, id)` index.
- `src/store/queries.ts` — `recordRouteRejections(db, taskId, decision, now?)`
  and `listRouteRejections(db, limit)` (newest first, `ORDER BY id DESC`).
- Wired at both route-decision persistence call sites: `POST /v1/tasks`
  (`routes_tasks.ts`, after `insertTask` when a `route_decision` is present) and
  `dispatch.ts requeueAfterFailure` (after each `updateTaskRoutingDecision`).
- `services/subscription-gateway/src/observability/stats.ts` —
  - `adapterStats(db, { since? })`: per `(adapter_id, adapter_version)` —
    attempts, completed (`success`/`partial`), failed (`failed`/`ambiguous`
    minus needs-user), needs_user (error class in
    `auth_required` / `challenge_presented` / `user_intervention_required`,
    mirroring the worker's mapping), `success_rate = completed/attempts`,
    median + p95 latency from `ended_at - started_at` (nearest-rank percentile,
    no interpolation; ended attempts only), `failures_by_class` parsed from the
    attempt error JSON, and `ui_drift` (consecutive failures + breaker state)
    from `adapter_breakers`. `?since=` filters on `started_at`.
  - `recentRejections(db, limit = 50)`.
- `services/subscription-gateway/src/http/routes_stats.ts` —
  `GET /v1/stats/adapters` (`?since=` passthrough) and
  `GET /v1/stats/rejections?limit=` (default 50, clamped to 500), both behind
  `requireScope("tasks:read")` like the other task-read routes.

### 3. CLI (`cmd/cli`)

- `allternit subs models` — new subcommand in `cmd/cli/src/commands/subs.ts`:
  fetches `GET /v1/catalog` and prints a compact padded `ID / NAME / HEALTH`
  table; with `--json` it prints the raw entry array (the `caps list` output
  helper JSON-stringifies either way, so `models` handles its own non-JSON
  printing).
- `allternit subs status` — extended additively: each account row keeps its
  existing fields (`...account, status`) and gains
  - `pools`: the account's entitlements from `/v1/capabilities`
    (`capability`, `account_id`, `pool_key`, `pool_state`, `available`,
    `reason_unavailable?`);
  - `adapter_stats`: one-line summaries from `/v1/stats/adapters`
    (`adapter_id`, `adapter_version`, `attempts`, `success_rate`) for the
    adapters serving the account's provider.
  Both fetches fail soft to `[]` so `subs status` still works against a
  gateway that predates these routes.
- Tests: `cmd/cli/src/commands/subs.test.ts` — command-level through a real
  UDS mock server (the `client.test.ts` pattern) plus the commander
  `exitOverride` program harness from `cloud.test.ts`, with stdout capture.
  Note for future CLI tests: under `tsx --test` the node runner's child-process
  IPC rides `process.stdout` as binary v8-serialized Buffer writes, so the
  capture patch must only swallow **string** writes and pass Buffers through
  (bound) — naive whole-capture fills with IPC mojibake and/or crashes the file.

## Decisions the brief asked me to state

**Model-class source.** The manifest `plans` entries do not carry model classes
(`planDefSchema` is `{ plan_id, label, notes }` only), so per the brief's
fallback the model classes come from the gateway policy's `model_class_rank`
keys, minus obvious non-chat classes. `deep` is excluded via a module-local
`NON_CHAT_MODEL_CLASSES` list: it denotes a long-running research class, not a
chat lane, so it must not publish `subs/<provider>:deep` chat picker entries.
Remaining classes are emitted in `model_class_rank` order (entries are then
sorted by id for a deterministic response; the picker re-orders for display).
Tier map is the brief's data table: `{ fast: "fast", standard: "standard",
reasoning: "flagship", deep: "flagship" }`.

**Chat-family detection.** The brief's suffix hint (`.message` / `.chat`) does
not match the real registry: chatgpt-web declares `chat.create` and
`chat.continue` (plus `image.generate`), whose ids end in neither. Detection is
therefore data-driven by **family** — the first dot-segment of the capability
id matched against a config list `CHAT_CAPABILITY_FAMILIES = ["chat"]`. The
submission capability is the family member ending in `.create`
(`SUBMISSION_CAPABILITY_SUFFIX`), falling back to the family's first capability
(id-sorted) when no `.create` exists; `chat.continue` is continuation, not a
submission lane.

**`route_rejections` persistence.** Phase 1 stores the route decision as a JSON
blob on the task row via `updateTaskRoutingDecision` — per-task, latest-only,
and overwritten on every requeue hop, so historical rejections are not
recoverable from it. Rather than change that Phase 1 signature, the brief's
suggested alternative was taken: migration 0003 adds `route_rejections` and
every call site that persists a decision now also appends its `rejected[]`
rows (one row per rejected candidate, with the decision id for correlation).
`recentRejections` is then a trivial durable query.

**Stats are query-only.** No `adapter_stats` measurement event is emitted on a
stats read. Everything `/v1/stats/*` returns is derivable from data the gateway
already persists (`task_attempts`, `adapter_breakers`, `route_rejections`), so
an event would duplicate state; and one ledger event per stats query would
spam the append-only event log with non-facts every time an operator or the
CLI polls.

**Picker integration (Rust side, out of scope here).** The allternit-api model
picker is `available_model_catalog()` in
`cmd/allternit-api/src/provider_routes.rs` (~line 432): it returns
`{ id: "provider/model", name, provider, description?, tier, supports_effort }`
with `tier ∈ flagship | standard | fast | legacy` for `GET /api/v1/models`.
`GET /v1/catalog` deliberately matches that shape field-for-field (ids are
`subs/<provider>:<model_class>` so they can never collide with metered
`provider/model` ids) and adds two purely additive keys — `health` and the
`fabric` submission block. The Rust merge is therefore a fetch + concat: GET
the gateway catalog, append the entries to the picker response, and on
selection submit a fabric task with `capability` + `options.model_class` from
the entry's `fabric` block. No Rust changes are in this phase.

## Verification

- `pnpm -F subscription-gateway build` — clean (tsc + migrations copy).
- `CI=1 pnpm -F subscription-gateway test` — **221 passed / 25 files**
  (Phase 1 baseline 195 / 22 files; +26 tests: catalog 14, observability 4,
  HTTP catalog/stats 8 — one store migration expectation updated for 0003).
- `cd cmd/cli && pnpm typecheck` — clean.
- `cd cmd/cli && CI=1 pnpm test` — **48 passed** (baseline 44; +4: models
  table, models --json, status additive shape, status fail-soft).
- Provider-literal grep
  (`chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic`):
  `services/subscription-gateway/src` minus `src/adapters/` — no matches;
  `cmd/cli/src` — no matches (nothing added, none pre-existing).
- `git status` scope: only `services/subscription-gateway/`, `cmd/cli/`,
  `docs/specs/subscription-fabric/p4/`.

## Open questions

- Catalog entries are emitted for every chat-family capability a manifest
  offers; today each manifest offers exactly one chat submission lane. If a
  future adapter offers several chat pools, the catalog will publish one entry
  per (account, capability, model class) — confirm the picker wants that
  multiplicity or add a dedupe rule then.
- `success_rate` counts `partial` as completed; if ops wants partial treated
  separately the stats row can grow a `partial` count without breaking shape.
- `/v1/stats/rejections` limit is clamped at 500; pagination (cursor on
  `id`) is a follow-up if operators need deeper history.
- The CLI `subs status` pools/stats join is per-account via entitlements and
  per-provider via capability view; accounts whose provider has no registered
  adapter show empty `pools`/`adapter_stats` — acceptable today, worth
  surfacing as an explicit "no adapter" marker if multi-adapter providers land.
