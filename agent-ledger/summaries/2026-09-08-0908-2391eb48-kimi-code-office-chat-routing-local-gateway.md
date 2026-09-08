# Attestation — Office add-in pane chat routes to local gateway, mints ak- virtual key

- **Session:** office-chat-routing (attested by 2391eb48, kimi-code)
- **Date:** 2026-09-08
- **Branch:** `session/office-chat-routing`, merged to main via **PR #134** → 72cc79442
- **Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Fixed hosted Office add-in chat being unreachable for desktop users. Desktop bootstrap tokens (`allternit_runtime_...`) are minted by the desktop app and only valid on the local desktop gateway (`http://127.0.0.1:8013`) — never on `api.allternit.com`. The pane chat followed the build-time `VITE_ALLTERNIT_GATEWAY_URL` (production: `https://api.allternit.com`), so desktop users always sent a token the hosted API rejects.

Second layer: the gateway's `/v1/chat/completions` only authenticates `ak-...` virtual keys (`llm_key_middleware`, `cmd/allternit-api/src/llm_gateway/auth.rs:162`) — runtime tokens AND Clerk session tokens both get 401 there.

## How it works (file:line)

- `src/lib/platform-gateway.ts:38` — `isDesktopRuntimeToken()` detects desktop bootstrap tokens.
- `src/lib/platform-gateway.ts:57–63` — `resolveChatBackend()`: when the bootstrap token is a desktop runtime token, force the local gateway origin (`VITE_ALLTERNIT_LOCAL_GATEWAY_URL`, default `http://127.0.0.1:8013`); the API key becomes `await ensureLlmVirtualKey(baseUrl, token) ?? token`.
- `src/lib/platform-gateway.ts:67` — `ensureLlmVirtualKey()` mints + caches an `ak-...` virtual key via `POST {gateway}/api/v1/gateway/keys` (that endpoint accepts runtime tokens via the standard gateway auth middleware). Falls back to the old behavior (raw token, configured gateway) if minting fails. Non-desktop tokens keep the configured gateway, now also with a minted `ak-` key so web/Clerk chat can auth too.
- `src/agent/useOfficeAgent.ts:94–97` — `resolveRuntimeConfig()` is now async and uses `resolveChatBackend()`; explicit advanced-panel config still wins (useOfficeAgent.ts:289,397 call sites).

## Verification evidence (from PR #134 body — live curl against the running desktop gateway)

- `POST http://127.0.0.1:8013/v1/chat/completions` with runtime token → 401 `Invalid API key format` (reproduces the bug)
- `POST http://127.0.0.1:8013/api/v1/gateway/keys` with same runtime token → 200, mints `ak-...` key
- `POST /v1/chat/completions` with the minted key → passes auth; upstream 502 only because the local Gizzi runtime on :4096 is wedged on this machine (pre-existing; see Incidents)
- `npm run typecheck` ✅, `npm test` ✅ 143/143, `npm run build` ✅
- Probe virtual key deleted after testing.

## Incidents

- **Wedged local Gizzi upstream**: the local Gizzi runtime at `127.0.0.1:4096` (98% CPU, accepts TCP, never answers HTTP) blocked chat completions end-to-end on this machine regardless of routing. The agent deliberately did not touch it per session constraints; flagged for human follow-up — restart the `gizzi-code serve` daemon if chat still fails after merge.

## Honest deferrals

- End-to-end chat completion in a real Office host not re-verified at attestation time (blocked by the wedged :4096 runtime above + pending pane redeploy); the routing/auth layers are verified by the live curl sequence.
- Human action outstanding: restart the wedged `gizzi-code serve` daemon.
