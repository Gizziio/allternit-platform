# Session Summary — session/routing — API consolidation: control-plane/data-plane split

**Session:** session/routing (worktree `allternit-session-routing`)
**Branch merged:** `session/routing` → `main`
**Agent family:** kimi
**Date:** 2026-09-04

## What was done (13 commits, `4f77728c3..f3b4ed071`)

**Decisions (docs/architecture/2026-09-03-control-plane-data-plane-decision.md):**
Owner decided Execution Guide Step 6 of the 2026-09-03 production-readiness audit:
option (b) — cloud-api is the single public API; allternit-api becomes a
data-plane runtime with three deployment modes (local desktop / user-paired /
Allternit-provisioned per-sub Incus container). Resolved auth model (A1: two-hop,
Ed25519 data-plane JWT), chat path (A2: control-plane model router), isolation
(A3: per-sub v1 + auto-stop), orphan paths (A4: `/api/chat` etc. exist on neither
backend). DevPod/E2B/OpenCode/Codespaces prior art researched.

**P0 fixes:**
- Vendored `allternitos-cloud-contracts` into `platform/contracts/` (CI deploy
  blocker B7 — 5 failing runs caused by repo-escaping path dep)
- CORS allowlist replaces mirror-any-origin in allternit-api (audit C-grade;
  `ALLTERNIT_CORS_ORIGINS`, 403 gate incl. preflights, 9 tests)
- dev-api-token backdoor gated behind `ALLTERNIT_ALLOW_DEV_TOKEN`, default OFF,
  all 5 acceptance sites + warn log + 7 tests (audit B1); iOS literal moved to
  build config
- Orphaned client calls removed/flagged; fail-closed feature flags for every
  namespace served only by allternit-api (jobs removed as dead; agent-sessions,
  office, beta, rails, runtime, tools, permissions, questions, model-lab gated)

**P1 (control-plane handlers in cloud-api):**
- Route inventory: 522 client paths (269 allternit-api-only, 28 cloud-only, 12
  both, 213 orphans) — docs/architecture/2026-09-04-p1-route-inventory.md
- Tranche 1: migration 011 (runtime_devices kind/endpoint/capacity), node
  resolution (428 when unpaired), full agent-sessions namespace via existing
  runtime-devices WS relay
- Tranche 2: data-plane JWT mint/verify + JWKS endpoint (A1), office + beta
  handlers
- Tranche 3: WS relay for beta session events (socket tickets — tunnel protocol
  already existed in agent-daemon), rails client dialect fix (48 methods; real
  `thread_id`→`thread` bug fixed), web flipped to control-plane handlers
  (CloudApiEventSource fetch-streaming SSE; flags still false-default)
- Node-side (allternit-api): DP JWT verification + missing
  `POST /beta/sessions/:id/run`

## Verification
- cloud-api: 221 lib tests pass (1 known pre-existing docker-less contabo failure)
- allternit-api: builds clean; new tests hit the documented pre-existing refinery
  test-DB failure class (module diff additive-only)
- web: `tsc --noEmit` zero errors after every tranche
- iOS: swiftc -parse only — **full Xcode build still pending** (deferred by owner)

## Unfinished / deferred
- **Pre-existing test debt:** allternit-api has ~270 `--lib` failures
  (refinery test-DB `UNIQUE constraint` + stale control_plane binary tests) —
  documented, not caused by this branch, needs its own cleanup session.
- **Coverage gaps:** 21 rails data-plane routes (plan/gate/leases/context-packs)
  unimplemented; canvas get/update/delete have no control-plane route.
- Web flags all false-default — enabling per-namespace is a deploy decision.
- iOS changes ride the merge but are not built/deployed (owner deferred).

## Post-merge ops sequence (owner-gated, NOT done by this session)
1. Apply `cmd/allternit-cloud-api/migrations_pg/011_data_plane_nodes.sql` on
   `mail` (CI does not apply migrations; new handlers degrade until applied)
2. Set `ALLTERNIT_DP_JWT_SEED` (`openssl rand -base64 32`) in cloud-api env on `mail`
3. Deploy nginx interim proxy (infrastructure/vps-desktop-cloud/nginx-api-allternit-interim-proxy.conf) and flip `ALLTERNIT_LOCAL_DEV_BYPASS=false`
4. Verify backdoor closed: `curl -H "Authorization: Bearer dev-api-token" https://api.allternit.com/api/v1/auth/me` → 401
5. Enable web flags per-namespace in `.env.production`, redeploy Pages
