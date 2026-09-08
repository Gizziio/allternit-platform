# Provider Routing — Deferred Follow-ups Plan

Session: `session/prov-followups` (worktree `allternit-session-prov-followups`).
Source: ledger attestation `agent-ledger/summaries/2026-09-08-0841-11f1b5c8-kimi-provider-routing.md`
"Honest deferrals" + Brain `Products/ProviderRouting.md` "Deferred follow-ups".
Owner decisions: all four items, one branch, one PR. Design source for Hermes
shape: https://hermes-agent.nousresearch.com/docs/user-guide/features/provider-routing
(top-level `provider_routing:` section in `~/.hermes/config.yaml`, flat keys +
`models:` per-model override map — 1:1 with our `ProviderRoutingPolicy`).

## Item 4 — ACI → Hermes `config.yaml` export bridge

- `provider_routing.rs`: `to_hermes_yaml(policy) -> String` — serde_yaml
  available at workspace root (Cargo.toml:322). Omit empty/null keys; header
  comment marking generated file.
- Admin route `GET /api/v1/gateway/provider-routing/export/hermes` →
  `text/yaml` (admin scope, same scoping as GET policy; 404 when no policy).
- Desktop ACI bridge: new `surfaces/allternit-desktop/src/main/hermes-routing-bridge.ts`
  + IPC. Renderer (has `allternit_token`) fetches the export endpoint;
  main process writes `~/.hermes/config.yaml` by splicing the top-level
  `provider_routing:` block (replace if present, else append), backing up the
  prior file to `config.yaml.allternit-bak`. "Export routing to Hermes" button
  lives in the Agent Hub pin card (item 3).
- Tests: YAML emission unit tests (flat policy, per-model overrides, empty
  policy); splice/merge unit tests for the bridge (pure function `spliceHermesRouting`).

## Item 2 — Ops gateway `model_route` MCP extension

`Allternit Brain/Ops/index.js` (not in repo; no PR ritual, direct edit + test).

- New Rust endpoint (part of this PR): `POST /api/v1/gateway/provider-routing/resolve`
  `{model, provider?}` → `{model, provider_id, matched_override, provider, source}`
  (tenant|global|none). Reuses `resolve_for_model` + `candidate_ids` matching.
- `model_route` gains optional args: `model` (resolve via gateway),
  `gateway_url` (env `ALLTERNIT_GATEWAY_URL`, default `http://127.0.0.1:8013`),
  `gateway_token` (env `ALLTERNIT_GATEWAY_TOKEN`), `policy` (object; without
  `confirm:true` → dry-run prints what would be PUT; with confirm → PUT admin API).
- Tier-policy behavior unchanged when no gateway args. Gateway unreachable →
  note + tier answer still returned.

## Item 1 — BYO-subscription keys (per-user route credentials)

- `V134__user_route_credentials.sql`: id TEXT PK, user_id TEXT NOT NULL,
  tenant_id TEXT, provider_id TEXT NOT NULL, api_key TEXT NOT NULL (sealed via
  `token_crypto::seal`), base_url TEXT, label TEXT, status DEFAULT 'active',
  last_validated_at, created_at, updated_at, UNIQUE(user_id, provider_id).
- New module `cmd/allternit-api/src/llm_gateway/route_credentials.rs`:
  masked list, validate-then-seal upsert (GET {base_url}/models probe, 401/403
  rejected — reqwest), delete, `get_decrypted` hot path. Pattern follows
  cloud-api `services/inference_keys.rs` but reuses `token_crypto` (no cipher port).
- Routes (Clerk-protected, any authenticated user manages own keys — NOT org-admin):
  `GET/PUT /api/v1/gateway/route-credentials`, `DELETE .../:provider_id`.
- Proxy hook at proxy.rs:1714-1722: when the resolved route's provider matches a
  user credential, add `payload["provider_credentials"] = {api_key, base_url}`
  (separate key — never inside `provider`, which goes to the aggregator).
- gizzi-code: `PromptInput.provider_credentials` → message metadata
  `provider_routing_credentials` → llm.ts applies apiKey/baseURL override for
  `@ai-sdk/openai-compatible` models on that request only.
- Metering: BYO-attached requests meter tokens, charge nothing (BYOK precedent).

## Item 3 — Agent Hub UI pins

- Rust: `/api/v1/ai/chat` bridge (v1_routes.rs agent_chat_bridge) accepts
  optional `providerRouting` in body → forwards `"provider"` on gizzi payload
  (today only the LLM-gateway proxy path forwards it — the gap that makes this
  follow-up necessary).
- Surface: pin card in Agent Hub bot config (`BotConfigTab`) — model picker
  (from `GET /api/v1/gateway/provider-routing` models keys + freeform), sort
  select, only/order text inputs → ModelOverride object persisted on bot
  metadata via `useAgentStore.updateAgent`; `streamChat` sends it per message
  (`SendMessageOptions.providerRouting` → POST body → bridge). Per-session
  override in `BotHubSessionsTab` via `updateSession` metadata (same vehicle).
- Export-to-Hermes button in the same card (item 4).

## Verification

- `cargo test -p allternit-api` (routing modules + new tests; note pre-existing
  4 stale-binary agent_cloud_routes failures as environmental).
- gizzi: `bun test test/session/`, typecheck.
- Surface: `tsc --noEmit`, vitest for touched tests.
- Live smoke: boot local gateway, PUT/GET policy, resolve endpoint round-trip,
  route-credentials CRUD round-trip, export YAML; MCP tool via stdio harness.

## Ritual

Commits per item, push, one PR, merge, ledger attestation, cleanup (AGENTS.md §Session lifecycle).
