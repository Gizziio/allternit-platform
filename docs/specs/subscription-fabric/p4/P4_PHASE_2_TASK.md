# P4 Phase 2 — Observability + Subs Model Catalog (subscription-gateway + CLI)

Same worktree, same branch (`session/subsfab-p4`). Phase 1 is committed and reviewed:
real router (`src/router/resolve.ts`), pools (`src/pools.ts`), breakers (`src/breakers.ts`),
snapshot/dispatch wiring, `/v1/capabilities` entitlements, 195/195 tests. Read
`docs/specs/subscription-fabric/p4/P4_PHASE_1_NOTES.md` first for what exists and the
decisions it records — your Phase 2 work builds on it.

Repo rules are unchanged from the Phase 1 brief (pnpm only, never `playwright install`,
no push/PR/merge, conventional commits, no changes outside the allowed scope, provider-name
literals stay out of gateway core + CLI source).

## Deliverable 1 — `src/catalog/subs_models.ts` (D13 model-selector catalog)

Connected accounts publish `subs/<provider>:<model_class>` picker entries, derived
entirely from manifest/account data (both schemas are provider-literal-free by design —
`providerIdSchema` is an opaque brand, so string-format it, never match on it).

- For each registered adapter manifest × enabled account: for each chat-family capability
  the manifest offers (match capability ids by suffix convention — chat capabilities end
  `.message` or `.chat` — read the registry/tests to confirm what chatgpt-web declares;
  keep the match data-driven, a config list in the module, not a name check), and for each
  model class the plan supports (from the account's plan + manifest `plans` entries — if
  the plan structure doesn't carry model classes, take the model classes from the
  policy's `model_class_rank` keys minus obvious non-chat ones, and SAY which you chose
  in NOTES):
  - Entry shape (compatible with the allternit-api picker catalog shape used by
    `available_model_catalog()` in `cmd/allternit-api/src/provider_routes.rs` — read it):
    ```ts
    {
      id: "subs/<provider>:<model_class>",
      name: "<account.label> (subscription) · <ModelClassTitleCase>",
      provider: <providerId as string>,          // for grouping in the picker
      tier: <from model_class>,                   // data-driven map, see below
      description: "Subscription lane — no metered cost",
      supports_effort: false,
      health: "ready" | "degraded",
      fabric: {                                   // gateway extension, additive
        adapter_id, account_id, capability,       // where to submit
        options: { model_class },                 // selecting this submits a fabric task with these options
        pool_key,
      }
    }
    ```
  - Tier map (gateway-local data table, e.g. `{ fast: "fast", standard: "standard",
    reasoning: "flagship", deep: "flagship" }`).
- Health gating (the catalog test enforces this): an entry appears ONLY when the
  account's effective session health is `ready` or `degraded` (badge = that value).
  Any other health (`needs_user` family, `ui_drift`, `provider_down`, etc.) hides the
  entry entirely — the picker must not offer routes that need a human.
- Health and pool state come from the same sources Phase 1 used (`buildSnapshot` in
  `src/router/snapshot.ts` is the assembler — reuse it or factor what you need; don't
  rebuild a second assembly path).
- HTTP: `GET /v1/catalog` (new `src/http/routes_catalog.ts`, mounted in `server.ts`
  next to the other routes; follow their auth/scoping pattern). Response: the entry
  array. No task context needed — health/pool gating only.
- The actual merge into the allternit-api model picker (`GET /api/v1/models`) is Rust
  work — OUT OF SCOPE here. Note the integration point in NOTES (one paragraph): the
  gateway catalog endpoint + the shape parity above is what makes that merge a fetch.

## Deliverable 2 — observability

- `src/observability/stats.ts` (new folder ok):
  - `adapterStats(db, opts?: { since?: string })` — per `adapter_id` (+version where
    recorded): attempts, completed, failed, needs_user, success rate, median + p95
    attempt latency (attempts have started_at/ended_at — check the attempts schema in
    `src/store/`), counts by failure class, and consecutive-ui-failure count from the
    breaker table. Pure queries over SQLite — no new tables unless an index helps
    (attempts timestamps).
  - `recentRejections(db, limit)` — latest route-decision rejections. Phase 1 persisted
    the decision via `updateTaskRoutingDecision` — check exactly what it stores; if
    `rejected[]` isn't durably stored, add a small `route_rejections` table written at
    the same call sites (migration 0003) rather than changing the Phase 1 signature.
- HTTP: `GET /v1/stats/adapters` and `GET /v1/stats/rejections?limit=` — new
  `src/http/routes_stats.ts`, same auth/scoping pattern as the other routes.
- Emit an `adapter_stats` measurement event into the event log when stats are queried?
  NO — keep stats query-only (computed on read). Say in NOTES why (event-log spam,
  derivability).

## Deliverable 3 — CLI (`cmd/cli`)

- `allternit subs models` — new subcommand in `cmd/cli/src/commands/subs.ts` (or a
  sibling command file mounted the same way `caps list` is): fetch `GET /v1/catalog`,
  print a compact table (id, name, health) and honor `--json` like `caps list` does.
- `allternit subs status` — extend the existing status command: after the per-account
  status it already prints, add per-pool state (from `/v1/capabilities` entitlements:
  pool_key → pool_state) and the one-line adapter stats summary (attempts/success%)
  from `/v1/stats/adapters`. Keep the existing output shape additive.
- CLI tests: extend `cmd/cli/src/subs/client.test.ts` pattern — there are existing
  command tests (`cloud.test.ts` etc.) to copy the harness from. Run
  `CI=1 pnpm -F allternit-cli test` (check the package name in `cmd/cli/package.json`
  and use the right filter).

## Tests (minimum)

- Catalog: entries appear for ready|degraded accounts with the right badge; hidden for
  every non-ready/degraded health; each entry's `fabric` block carries the correct
  capability + `options.model_class` mapping; id format `subs/<provider>:<model_class>`;
  no provider-name literals in the module (grep gate below).
- Stats: seeded attempts produce correct rates/latency percentiles (use a fake clock or
  fixed timestamps — deterministic); failure-class counts; `recentRejections` ordering.
- HTTP: both new routes return 200 with expected shape through the existing route-test
  harness (`test/http-*.test.ts` pattern); auth/scoping behavior matches sibling routes.
- CLI: `subs models` and extended `subs status` against the mock client.
- Full suites green: `pnpm -F subscription-gateway build`, `CI=1 pnpm -F
  subscription-gateway test`, plus the CLI suite. Existing tests must not regress.

## Hard gates before NOTES

- Provider-literal grep over `services/subscription-gateway/src` (minus `src/adapters/`)
  and `cmd/cli/src` — same regex as Phase 1 (`chatgpt|claude|kimi|gemini|grok|deepseek|
  openai|anthropic`) — must print nothing new. (CLI may already have pre-existing
  literals — check HEAD first; do not ADD any, and don't "fix" pre-existing ones.)
- `git status` shows changes only under `services/subscription-gateway/`, `cmd/cli/`,
  and `docs/specs/subscription-fabric/p4/`.

## When done

Write `docs/specs/subscription-fabric/p4/P4_PHASE_2_NOTES.md`: what was built, where,
test counts (before/after per suite), the model-class-source decision, the
route_rejections persistence choice, the picker-integration note, open questions.
Then commit (feat commit for gateway, feat commit for CLI, docs commit for NOTES+brief)
and stop.
