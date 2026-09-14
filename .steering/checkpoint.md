# Steering checkpoint — session/coworkp1-0914

## Goal
Consumer-packaged Cowork Phase 1 "Managed Runtime" (owner-approved,
2026-09-14): open the desktop app → the whole engine is alive with zero
terminal interaction. Four items: 1.1 auto-provision worker principal
(local-only API + Keychain), 1.2 bundle + launch worker (desktop worker
manager), 1.3 engine status surface (4 engines, green/yellow/red in chrome),
1.4 onboarding folder-grants wizard step. Task DAG recorded in
MASTER_TRACKING ("Consumer-Packaged Cowork Task DAG", P1 IN PROGRESS).
Worktree: ../allternit-session-coworkp1-0914 on session/coworkp1-0914.

## Just did
- DAG committed (699ed0380).
- 1.1: `auth::verify_desktop_access_token` (constant-time, fail-closed when
  unconfigured); new local-only route
  POST /api/v1/fabric/transport/local/ensure-worker-principal (desktop
  access-token gated; ensure_gizzi_principal store helper; token minted
  fresh, returned once); BackendManager now generates a per-boot
  ALLTERNIT_DESKTOP_ACCESS_TOKEN for the api spawn + getLocalAuthHeaders().
- 1.2: `gizzi-code fabric-worker` CLI command (relative dynamic import of
  worker-daemon-entry — Bun-build safe; long-lived in main.ts); desktop
  `fabric-worker-manager.ts` (spawn/readiness via worker.daemon_start JSON
  line/backoff+jitter respawn/SIGTERM graceful stop with SIGKILL
  escalation); token in new Keychain-backed `secure-store.ts`
  (safeStorage packaged / AES-GCM dev); wired into unified-main Step 2.5
  (provision → store → spawn) + before-quit SIGTERM.
- 1.3: serviceState gains fabricWorker + office; startup splash rows;
  IPC engines:get-status + engines:status push; preload engines API;
  SPA EngineStatusIndicator pill (4 dots, worst-of aggregate, hidden in
  browser/cloud).
- 1.4: startup window "Grant workspace folders" step (add/remove via
  native directory picker, skip allowed) → PUT /cowork-preferences
  (trusted_folders) with desktop local auth; boot waits for save; new
  startup preload bridges + ipcMain handlers.
- Docs: FABRIC_TRANSPORT §15a, GIZZI_WORKER_SPEC §7, A_PROTOCOL §16 P1.

## Verification so far (updated)
- cargo test 40/40 (incl. 2 new managed-runtime store tests); clippy clean
  (one nit fixed in managed_runtime_tests); cargo build -p allternit-api clean.
- Desktop main/preload tsc clean; gizzi typecheck clean; SPA typecheck clean.
- release-preflight 36/0.
- LIVE EVIDENCE (tmp/coworkp1-evidence/, fresh scratch DB + desktop token):
  ensure route 403 without/with wrong token; 200 with token (principal
  a://workspace/default/principal/gizzi, token len 41); re-ensure rotates
  and old token dies (claim refused 401); folder grants GET empty → PUT →
  persisted; worker daemon_start + SIGTERM graceful stop, both via the
  daemon entry AND via the new `gizzi-code fabric-worker` CLI subcommand.
- Full GUI wizard click-through NOT exercised (needs interactive Clerk
  sign-in); documented honestly in MASTER_TRACKING.
- Desktop bundle (unsigned, -local) building for grep + fresh-profile
  launch verification.
- cargo build -p allternit-api clean; desktop main+preload tsc clean;
  gizzi typecheck clean (0 errors).
- Pending: cargo test/clippy, SPA typecheck, release-preflight, live
  fresh-profile launch evidence, MASTER_TRACKING P1 status.

## Next
1. Wait cargo/SPA checks; fix anything red.
2. release-preflight.mjs.
3. Live evidence: api on 18013 with scratch data dir; ensure route
   (403 without token, 200 with; token returned once, rotates); then a
   packaged/desktop-shaped launch of the worker path (spawn gizzi-code
   fabric-worker with token) proving claim loop starts; wizard folder step
   via preferences GET/PUT with desktop auth.
4. Commits per item, push, PR (no merge). Worktree stays.

## Open questions
- API binds 0.0.0.0 (ALLTERNIT_API_HOST is spawn config the api may honor
  internally); the local endpoint is therefore auth-gated (desktop access
  token), not peer-gated — same posture as the existing desktop bootstrap
  path. Documented in the route.
- Worker rotation policy: one fresh token per app launch (old tokens die);
  secure-store rewrites each boot. Simple and safe; noted in FABRIC_TRANSPORT §15a.
