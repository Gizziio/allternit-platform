# Attestation — Provider Routing follow-ups (BYO keys, resolve/export, Hub pins, Hermes bridge)

- **Session:** prov-followups (kimi)
- **Date:** 2026-09-08
- **Branch:** `session/prov-followups` @ 40403f25a, merged to main via **PR #150** → 93b37924d (merge commit)
- **Motivation:** Close the four follow-ups deferred by the v1 attestation (`2026-09-08-0841-11f1b5c8-kimi-provider-routing.md`). Owner directive: all four, one branch, one PR.

## What was done

**1. BYO-subscription keys (per-user route credentials)**

- **V134 migration** — `user_route_credentials` (token_crypto-sealed `api_key`, provider slug unique per user).
- `cmd/allternit-api/src/llm_gateway/route_credentials.rs` — masked list, validate-then-seal upsert with `/models` probe, delete, hot-path `get_credential`/`has_credential` (5/5 tests).
- User-scoped `GET`/`PUT`/`DELETE /api/v1/gateway/route-credentials` (deliberately NOT org-admin-gated — the credential belongs to the user).
- `proxy.rs` — attaches `payload["provider_credentials"] = {apiKey, baseURL?}` when the resolved provider matches a stored user credential; per-failover re-resolution strips it when the next provider has none; `record_usage_event` meters BYO-served requests at zero cost so customer-billed keys never consume aggregator credits.
- gizzi-code: `provider_credentials` zod record on the prompt payload → per-turn metadata → `llm.ts` merges {apiKey, baseURL} into SDK options for `@ai-sdk/openai-compatible` only. The credential rides as a separate key — never inside `provider`, which goes to the aggregator.

**2. Gateway resolve query + Hermes YAML export (backend of the MCP extension)**

- `POST /api/v1/gateway/provider-routing/resolve` `{model, provider?}` → `{provider, matched_override, source: tenant|global|none}` (reuses v1 `load_policy_with_source` + `find_override_entry`).
- `GET /api/v1/gateway/provider-routing/export/hermes` — renders a top-level `provider_routing:` YAML block (404 when no policy).
- `to_hermes_yaml` renderer + `serde_yaml` (Cargo.lock updated accordingly).
- Ops MCP `model_route` extension lives **outside this repo** in the Allternit Brain (`Ops/index.js`, commit efc437c): new `model`/`gateway_url`/`gateway_token`/`policy`/`confirm` args + `gatewayRequest` helper (10s timeout); dry-run default for policy PUTs. `Infra/model-routing.md` in the Brain documents the tier-lookup half of this tool.

**3. Agent Hub UI route pins**

- `surfaces/ai.allternit.com/src/lib/agents/provider-routing.ts` helpers + tests (10/10).
- `ProviderRoutingCard` in `BotConfigTab` — model/sort/only editors, policy-driven datalist, no-policy hint, wire preview, Export-to-Hermes button gated on `window.allternit.hermesRouting`.
- Bot pin persisted at `agent.config.providerRouting` (agent rows have no metadata column; config is the persisted JSON bag — verified against the Rust handler).
- Per-session override at session `metadata.providerRouting`, null = inherit; wire object strips the display-only model key; `streamChat` send path forwards the pin; `BotHubSessionsTab` pushpin affordance.
- Gateway `/api/v1/ai/chat` bridge accepts `providerRouting` and forwards it on the gizzi payload.

**4. ACI → Hermes `config.yaml` export bridge**

- `surfaces/allternit-desktop/src/main/hermes-routing-bridge.ts` — fetches the gateway's Hermes YAML rendering and splices a top-level `provider_routing:` block into `config.yaml` (backup to `config.yaml.allternit-bak`, replace-or-append). Guarded IPC `hermesRouting:export` + preload API + `globals.d.ts` typing (5/5 vitest).

- **Plan doc:** `spec/provider-routing/followups-plan.md` (on main via this PR).

## Verification evidence

- `cargo test -p allternit-api --lib`: 690 passed / 4 failed — the 4 failures are the same pre-existing stale-binary `agent_cloud_routes` failures documented in the v1 attestation (environmental; a post-merge `cargo check -p allternit-api` is clean). `provider_routing` module 13/13; `route_credentials` 5/5.
- gizzi: `bun run typecheck` clean; `bun test test/session/provider-routing.test.ts` 6/6.
- desktop: `npm run typecheck` clean; hermes bridge vitest 5/5.
- web (ai.allternit.com): tsc shows only pre-existing univerjs environmental errors (none in touched files); vitest 105/105 including new pin-helper tests.
- Live smoke on local gateway (ALLTERNIT_LOCAL_DEV_BYPASS=1, port 18013): policy PUT/GET round-trip; pinned resolve returned `{"matched_override":"anthropic/claude-fable-5.1","provider":{"ignore":["together"],"only":["anthropic"],"sort":"price"},"source":"Tenant"}`; unpinned resolve returned the flat policy; export/hermes returned valid YAML; route-credentials PUT (response masked the key as `sk-…4f9c`, unvalidated without base_url) / 400 on bad slug / GET / DELETE / 404 on repeat.
- MCP `model_route` stdio smoke: tier answer unchanged, dry-run + no-token degrade paths work.

## Incidents

- A `pkill` intended for another process killed the long-running gateway on port 8013 mid-session. It was restarted from `target/debug/allternit-api` via nohup (log `/tmp/allternit-8013-restart.log`) and answers 401 on `/api/v1/health` unauthenticated, same as before the kill. No persistent state was lost.
- First `gh pr merge 150` failed on a conflict in `.steering/checkpoint.md` (another session had appended their checkpoint to the same per-session file; their PRs #147/#148/#149 merged first). Resolved by keeping this session's checkpoint (the other session's checkpoint is stale, its PRs merged) — merge commit 40403f25a; post-merge `cargo check` clean.
- The Brain pre-commit hook flagged pre-existing audit issues in the vault (unrelated dirty files from other work); only `Ops/index.js` was committed and pushed there.

## Honest deferrals

- **Wire-level BYO end-to-end** (a real request served by a customer's own provider key against live upstream billing) — not exercised; per owner's production-is-the-test stance from v1. Unit tests + live admin-API round-trip cover the path up to the wire.
- **MCP live resolve call** — needs a Clerk token; tested stdio against the dead-port/no-token degrade path only. The endpoint itself was exercised directly via curl in the live smoke.
