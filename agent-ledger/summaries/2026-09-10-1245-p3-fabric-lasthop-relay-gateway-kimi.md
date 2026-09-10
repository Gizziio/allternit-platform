# P3 fabric last-hop fix — relay → serve-port gateway (rq-20260908-028)

- Date: 2026-09-10 (session 47865698, kimi-interactive)
- PR: #258, merged `a4bfbc527` (branch `ao/fabric-gateway-port`)
- Worktree: `allternit-ao-fabric-gateway-port` (cleaned up after merge)

## What was wrong

Every PWA-proxied request to a paired ao node died at the last hop with
`401 {"error":{"code":"unauthorized","message":"A valid local bearer token is required."}}`.
That string is not in any cloud-api/ao source — it is open-connector's local-auth
middleware (`services/open-connector/src/server/api/auth.ts:59`).

Root cause: `ao fabric serve --port 8015` bound the loopback shim to 8015 (8014 is
held by Desktop's open-connector sidecar), but `relay::run` built its own
`local_gateway` from `local_gateway_url()` — default 8014, env unset. Tunneled
`/v1/*` requests were forwarded to the sidecar, which 401s any foreign bearer.

The two 401 shapes seen during diagnosis map to two hops:
- flat `{"error":"UNAUTHORIZED"}` — cloud-api `resolve_user_scoped`
  (`cmd/allternit-cloud-api/src/auth/middleware.rs:496`), caller credential rejected;
- nested lowercase "local bearer token" — open-connector sidecar on the node,
  reached only because of the port skew.

## Fix

- `ao::fabric::resolve_local_gateway(port, env_override)`: `ALLTERNIT_AO_GATEWAY_URL`
  still wins (trailing slash trimmed, empty treated as unset); otherwise the gateway
  is the shim's own serve port.
- `relay::run` takes `local_gateway: String` instead of resolving its own.
- `ao fabric serve` prints `relay forwarding to <url>` at startup.

## Verification

- 2 new unit tests (`ao::fabric::tests::gateway_*`); `cargo test -p herdr ao::` 76/76.
- CI: gitleaks / check-sw-cache-bump / validate-typography green; Vercel rate-limit +
  Cloudflare Pages failures pre-existing/ignorable (Rust-only diff).
- **Live end-to-end**: rebuilt node from the branch, `ao fabric serve --port 8015`
  (log: `relay forwarding to http://127.0.0.1:8015`), relay connected. The exact
  failing PWA call — `POST /api/v1/runtime-devices/rt_0955…/proxy`, inner
  `GET /v1/remote-control/sessions`, Clerk bearer from the platform tab — now returns
  **200** with the shim session list.
  Evidence: `~/.agent-orchestrator/evidence/ao-fabric-verify/proxy-fixed.json`,
  `serve-fixed.log`.

## Deferred / notes

- `ao fabric status` still probes the default gateway port, not the actual serve
  port — cosmetic; serve now prints the real gateway at startup.
- The running local node (PID 85267) now runs the fixed debug binary from the
  merged code line; restart it from a release build at next convenience.
