# Session summary — fabricfix-0911 (Kimi Code)

**PR:** #340 (merged 2026-09-11, merge SHA `b5b752a88`)
**Topic:** Fabric session requests failed on the paired desktop node — kernel fabric mirror 404'd against gizzi, Desktop Fabric Transport showed "This node Unreachable", kernel log showed `Fabric provider unhealthy provider=fabric_node 0 active fabric node(s) in pool`.

## What was done

1. **Kernel fallbacks** (`cmd/allternit-api/src/fabric_routes.rs`): when the gizzi upstream 404s/502/503 (gizzi has no `/v1/fabric/*` or `/v1/session-worker/invoke`), the kernel now synthesizes the local desktop peer (`id: local-desktop`, `status: "online"` with loopback endpoint at `gizzi_base()`), issues local leases (`lease-desktop-local`, 300s TTL), and answers `session-worker/invoke` for `harness.session*` by mapping to the real gizzi remote-control/session APIs (`GET /v1/remote-control/sessions`, `POST /v1/session`), wrapped as `{ result }` — the exact shape `FabricSessionClient` unwraps. `directory` and `workers/self` are synthesized too.
2. **Desktop relay** (`surfaces/allternit-desktop/src/main/auth-manager.ts`): the packaged app intercepts `/api/v1/fabric/{leases,peers,directory,workers/self}` and `/api/v1/session-worker/invoke` and serves them from the bundled gizzi via `invokeNodeHarness` / `fabricRelayPayload`.

## Live-app incident found during takeover (not part of the PR, but recorded honestly)

- The previously deployed "fixed" kernel binary had been built from a tree **without** `V140__cloud_agents.sql`/`V141` — refinery embeds migrations at compile time, and the app DB already had V140 applied, so the kernel panic-looped on boot (`migration V140__cloud_agents is missing from the filesystem`). 8013 never listened; the Desktop app showed kernel-down. Fix: ship the build from a tree that has all migration files (main does).
- The `fabric_nodes` seed (`local-desktop`, active, 8 vCPU / 16384 MiB) had been written to `~/Library/Application Support/allternit/allternit.db`, but the app-spawned kernel runs with `ALLTERNIT_DATA_DIR=~/Library/Application Support/@allternit/desktop/allternit` — the seed was invisible. Re-seeded into the app's real DB.
- The hot-patched `app.asar` had been overwritten by a repack from stale sources; repacked from the current `dist/` and installed into both the release app and `/Applications/Allternit Desktop.app`.

## Verification evidence (live, 2026-09-11, release app path)

- `GET :8013/health` → `{"status":"healthy","live":true,"ready":{"db":true,"jwks":true,"gizzi":true}}` (was: port not listening)
- `GET :4096/v1/remote-control/sessions` → 82 sessions
- `GET /api/v1/fabric/peers/local` → 200, `id: local-desktop`, `status: "online"` (auth-context probe on identical binary+DB)
- `POST /api/v1/fabric/leases` → `{id: lease-desktop-local, status: active, ttlSeconds: 300}`
- `POST /api/v1/session-worker/invoke {capability:"harness.session"}` → `{result: [ …sessions… ]}` (not HTML/404)
- Kernel log on app DB: boot-time one-shot `0 active fabric node(s)` warning, then `synced fabric node local-desktop`, then `Fabric provider healthy provider=fabric_node` at the first health tick
- asar change durable across quit/reopen (`invokeNodeHarness` present after relaunch)
- `node scripts/release-preflight.mjs` → 35/0
- Caveat: the four 200-level probes were run on a throwaway loopback-bypass instance (no Clerk token reachable from shell); the live kernel's Clerk auth was not the failing part — unauthenticated fabric calls correctly 401.

## Deferred / follow-ups

- Other worktrees missing V140/V141 migrations (e.g. `allternit-session-desktop-package`, `allternit-desktop-preview`) can still produce panic-looping kernels if built from them — rebase or delete them.
- No automated regression test for the fabric fallback; the fallback is intentionally a compatibility shim until gizzi grows native `/v1/fabric/*` routes.
