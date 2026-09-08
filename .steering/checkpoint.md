# Steering checkpoint — session/11f1b5c8

## Goal
Provider Routing v1 (Allternit Brain `Products/ProviderRouting.md`): tenant-scoped
provider routing policy in allternit-api (sort/only/ignore/order/require_parameters/
data_collection + per-model overrides), resolved against the active model and
injected as a top-level `provider` object on outbound OpenAI-compatible wire
requests, via the Gizzi session-message payload. Plan: `spec/provider-routing/plan.md`.
Worktree `allternit-session-11f1b5c8`, branch `session/11f1b5c8`.

## Just did
- Rust CODE COMPLETE: V133 migration; `llm_gateway/provider_routing.rs`
  (policy structs, validation, tenant+global load, per-model resolution with
  spelling-tolerant matching — 9 unit tests pass incl. real-migration roundtrip);
  admin GET/PUT `/api/v1/gateway/provider-routing`; proxy.rs injects
  `payload["provider"]` for the primary model and re-resolves per failover
  attempt in the retry rebuild. `cargo check` clean (65 pre-existing warnings).
- gizzi-code CODE COMPLETE: PromptInput accepts `provider` (zod record),
  createUserMessage folds it into per-turn message metadata
  (`provider_routing`), llm.ts injects it into providerOptions body for
  `@ai-sdk/openai-compatible` SDKs only. Verified in @ai-sdk/openai-compatible
  2.0.28 dist: raw providerOptions[providerOptionsName] unknown keys ARE spread
  into the request body (parseProviderOptions strips, but body spread uses raw).
  3 new schema tests pass; typecheck clean for touched files (2 pre-existing
  errors in test/commands/slash-menu.test.ts, untouched by this session).
- Merge of origin/main resolved (checkpoint conflict — kept this session's;
  prompt.ts auto-merged clean).

## Verification
- `cargo test -p allternit-api provider_routing`: 9/9 pass.
- Full `cargo test -p allternit-api`: 658 pass, 4 fail — all in
  agent_cloud_routes (hardcoded stale AllternitOS control-plane binary, see
  ledger); pre-existing, untouched by this session.
- `bun test test/session/`: 109 pass, 0 fail (incl. 3 new schema tests).
- Admin API store + round-trip verified live against a dev-bypass server.
  Owner directed no mock smoke test — shipping to production.

## Next
- Repo ritual: push merge commit, PR #132 merge, sync main, agent-ledger
  attestation, worktree cleanup.

## Open questions
- In-session gizzi fallback switches keep the per-message pin (Rust recomputes
  on its own retry loop per attempt). Accepted v1 semantics; noted for ledger.
