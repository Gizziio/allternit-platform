# Steering checkpoint — session/prov-followups

## Goal
Close the four deferred follow-ups from the provider-routing v1 attestation
(`agent-ledger/summaries/2026-09-08-0841-11f1b5c8-kimi-provider-routing.md`):
1) BYO-subscription keys, 2) Ops gateway `model_route` MCP extension, 3) Agent
Hub UI route pins, 4) ACI → Hermes `config.yaml` export bridge. Owner: all
four, one branch, one PR. Plan: `spec/provider-routing/followups-plan.md`.
Worktree `allternit-session-prov-followups`, branch `session/prov-followups`.

## Just did — ALL FOUR ITEMS CODE-COMPLETE
- Item 4: `to_hermes_yaml` + `GET /gateway/provider-routing/export/hermes`
  (text/yaml, 404 when no policy); desktop `hermes-routing-bridge.ts`
  (splice/replace top-level `provider_routing:` block, backup to
  .allternit-bak) + guarded IPC `hermesRouting:export` + preload API +
  globals.d.ts typing. 5/5 vitest.
- Item 2: `POST /gateway/provider-routing/resolve` `{model, provider?}` →
  `{provider, matched_override, source: tenant|global|none}` (reuses
  load_policy_with_source + find_override_entry). Ops MCP `model_route` gained
  `model`/`gateway_url`/`gateway_token`/`policy`/`confirm` (+`gatewayRequest`
  helper, 10s timeout); dry-run default for policy PUT; stdio-smoked. Brain
  Ops/index.js change commits to the Brain repo, not this one.
- Item 1: V134 `user_route_credentials` (token_crypto-sealed api_key) +
  `route_credentials.rs` (masked list, validate-then-seal upsert w/ /models
  probe, delete, hot-path get_credential/has_credential) — 5/5 tests. User-
  scoped `GET/PUT/DELETE /gateway/route-credentials` (NOT org-admin). proxy.rs
  attaches `payload["provider_credentials"] = {apiKey, baseURL?}` when the
  resolved provider matches a user credential; per-failover re-resolve removes
  it when the next provider has none; `record_usage_event` meters BYO-served
  requests at zero cost. gizzi: `provider_credentials` zod record → per-turn
  metadata `provider_routing_credentials` → llm.ts merges {apiKey, baseURL}
  into SDK options for @ai-sdk/openai-compatible only. 6/6 bun tests.
- Item 3: bridge `/api/v1/ai/chat` accepts `providerRouting` object → forwards
  `provider` on the gizzi payload. Surface: `provider-routing.ts` helpers +
  tests (10/10), streamChat passthrough (absent when unset), session-metadata
  override wins over bot pin (`agent.config.providerRouting` — agent rows have
  no metadata column; config is the persisted JSON bag), ProviderRoutingCard in
  BotConfigTab (model/sort/only editors, policy-driven datalist, no-policy
  hint, wire preview, Export-to-Hermes button gated on
  window.allternit.hermesRouting), BotHubSessionsTab per-session pin
  (pushpin affordance; null = inherit).

## Verification so far
- cargo test -p allternit-api --lib: RUNNING (background). Baseline: 658 pass /
  4 pre-existing stale-binary agent_cloud_routes failures (environmental).
- gizzi `bun run typecheck`: clean (SDK dist rebuilt by preflight).
- desktop `npm run typecheck`: clean; hermes bridge vitest 5/5.
- surface tsc: only pre-existing univerjs environmental errors (none touched).
- surface vitest (lib/agents + lib/bots): 105/105.
- provider_routing module tests 13/13; route_credentials 5/5.
- MCP stdio smoke: tier lookup unchanged; dry-run + no-token degrade OK.

## Next
- Live smoke: boot allternit-api with ALLTERNIT_LOCAL_DEV_BYPASS=1 on :8013
  (binary building in background); curl policy PUT/GET, resolve,
  route-credentials CRUD, export/hermes.
- Then: commits per item → push → one PR → merge → ledger attestation in
  shared checkout → cleanup. Brain repo: commit Ops/index.js + update
  Products/ProviderRouting.md deferred-follow-ups line (via brain_update_draft).

## Open questions
- None blocking. Wire-level e2e (real provider traffic) remains the owner's
  production-is-the-test stance from v1.
