# Provider Routing v1 — Implementation Plan

Session `11f1b5c8` / branch `session/11f1b5c8`.
Design source: Allternit Brain `Products/ProviderRouting.md` (commit bbb1ec5).
Decisions locked there: passthrough-first; v1 Allternit-operated (no BYO sub); overrides follow the currently-active resolved model.

## Architecture

Policy is stored and resolved in **allternit-api** (tenant-scoped, DB-backed),
passed through the Gizzi session-message payload, and injected onto the wire by
the gizzi-code provider layer for OpenAI-compatible/OpenRouter-style providers
(top-level `provider` body key).

```
client ──▶ allternit-api /v1/chat/completions
              resolve_model (B5 router) ──▶ resolved model id
              load tenant provider_routing policy (new)
              resolve policy for CURRENT model (spelling-tolerant)
              payload["provider"] = resolved object  (+ retry rebuild)
           ──▶ gizzi /v1/session/:id/message (accepts "provider")
              ──▶ provider adapter (openai-compatible) ──▶ wire body.provider
```

## Todos

- [x] Migration `V133__llm_provider_routing_policies.sql` — DONE (was V132 in early plan text; latest migration was V132 so this landed as V133).
- [x] `cmd/allternit-api/src/llm_gateway/provider_routing.rs` — DONE (9 unit tests pass, incl. real-migration roundtrip via DbHandle::new_memory).
- [x] Admin CRUD routes in `gateway_admin_router()` — DONE: GET/PUT `/api/v1/gateway/provider-routing` (admin_routes.rs, uses Scope/config_tenant; PUT validates via provider_routing::validate, stores via save_policy).
- [x] Injection in `proxy.rs` — DONE: policy loaded after resolve_model (tenant row, falls back to NULL/global; org-less keys pass "" and inherit global); `payload["provider"]` for primary; retry rebuild re-resolves per `next_model`.
- [x] gizzi-code: DONE — PromptInput gains optional `provider` (zod record); createUserMessage folds it into per-turn message metadata as `provider_routing` (same vehicle as service_tier); llm.ts injects it via ProviderTransform.providerOptions for `model.api.npm === "@ai-sdk/openai-compatible"` only. VERIFIED in @ai-sdk/openai-compatible@2.0.28 dist: raw `providerOptions[providerOptionsName]` unknown keys ARE spread into the request body; providerOptionsName = SDK `name` option = providerID (bundled adapter passes name: providerID).
- [x] Tests: cargo 9/9 provider_routing; full crate 658 pass / 4 fail — the 4 are `agent_cloud_routes` OS-integration tests hardcoded to `/Users/joe/Desktop/AllternitOS/target/debug/allternitos_control_plane --fake-provider`; that AllternitOS binary is stale (only knows `--vast-provider`) → PRE-EXISTING environmental, untouched by this session. gizzi: `bun test test/session/` 109 pass 0 fail; new `test/session/provider-routing.test.ts` 3/3; typecheck clean for touched files (2 pre-existing errors in test/commands/slash-menu.test.ts).
- [-] Live smoke: REMOVED per owner decision 2026-09-08 — no mock-based smoke
  testing; this ships to production where real traffic is the test.
  (While attempting it, the policy admin API was verified live up to the
  upstream model call: stack came up, key created, policy stored + round-trips
  via GET — `PUT/GET /api/v1/gateway/provider-routing` confirmed working
  against a running server.)
- [ ] Repo ritual: checkpoint updates, commit/push, PR, merge, sync main, agent-ledger attestation, cleanup.

## Verification evidence so far

- `cargo test -p allternit-api provider_routing`: 9 passed.
- `cargo test -p allternit-api`: 658 passed, 4 failed (pre-existing stale-binary env issue, see above).
- `bun test test/session/provider-routing.test.ts`: 3 pass.
- `bun test test/session/`: 109 pass, 0 fail.
- gizzi typecheck: only 2 pre-existing errors in test/commands/slash-menu.test.ts (untouched).
