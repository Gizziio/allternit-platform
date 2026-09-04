# Steering checkpoint — P3 telemetry governance (2026-09-04, session gizzi-p3-telemetry-20260904)

## Goal
Telemetry/observability governance for cmd/gizzi-code: payload audit, kill switch + consent (env + settings flag + first-run notice), disable dead upstream Datadog sink, docs/telemetry.md. Worktree: `allternit-gizzi-p3-telemetry-20260904`, branch `session/gizzi-p3-telemetry-20260904`. Rebased on main (trivial, no conflicts). No push; commit on branch.

## Just did
- Audit complete: sinks = 1P event logging → api.allternit.com/api/event_logging/batch (Allternit-owned, keep), BigQuery metrics → api.allternit.com/api/gizzi/metrics (keep), GrowthBook remote eval → api.allternit.com (keep), Datadog → http-intake.logs.us5.datadoghq.com with upstream hardcoded client token (DISABLED by default in both copies), customer OTLP (opt-in env only), RuntimeTelemetry (fork-local, log file only). Legacy src/services/analytics is inert pub/sub.
- New: src/shared/utils/telemetryRedact.ts (path/email/URL/JWT/token redaction + sink choke-point sanitizer), src/shared/utils/telemetrySettings.ts (telemetry.json persistent flag + notice marker), GIZZI_TELEMETRY=off in privacyLevel.ts (canonical kill switch, checked pre-sink), settings flag wired into isTelemetryDisabled() and RuntimeTelemetry telemetryDisabled().
- First-run one-line notice in src/cli/main.ts (interactive + enabled + not shown); `gizzi config telemetry on|off|status` subcommand.
- Redacted error-string call sites (oauth client, auth keychain); BashTool command_type now basename only.
- docs/telemetry.md + README link; test/telemetry-governance.test.ts (18 tests, all pass); appended to test/smoke.txt.

## Next
- Run full typecheck + ci-smoke-test.sh; fix any fallout; commit `feat(gizzi-code): telemetry governance — kill switch, redaction, dead-sink removal, docs`.

## Open questions
- Retention period for api.allternit.com event store is TBD — docs/telemetry.md marks it TBD per brief; owner to fill in.
- GrowthBook fetch still sends email/org UUIDs to api.allternit.com when telemetry is on (functional feature flags) — documented; strip-email-when-disabled deferred (would change targeting).

---

# Steering checkpoint — P3 @ts-nocheck ratchet (2026-09-04, session gizzi-p3-tsnocheck-20260904)

## Goal
Three production-readiness hardening slices in cmd/gizzi-code, on branch `session/gizzi-p3-webauth-20260904` (rebased onto main @ fb1b64f84). No push, no merge. (1) `gizzi web` auth parity with `gizzi serve`: alt_ gateway token acceptance, shared exposure guard, WS upgrade auth. (2) CORS drift: no `Access-Control-Allow-Origin: *` by default; `GIZZI_DEV_CORS` gated dev mode with startup warning; loopback-first bind defaults. (3) Empty-catch audit across src/ — handle/comment/debug-log each.

## Just did
- RESOLVED the execa blocker: root cause was `src/shared/utils/auth.ts` doing `import execa from 'execa'` (default import). Root `node_modules/execa` symlinks execa@8.0.1 (ESM, no default export), so any test importing src/runtime/session failed at link time on a fresh pnpm install. Fixed to `import { execa } from 'execa'`. (The stale main checkout only "passed" because of its older install layout.)
- Merged test/server/cors-dev-flag.test.ts into test/server/clerk-auth-middleware.test.ts: bun test runs all files in ONE process with a shared module registry, so per-file frozen env vars (GIZZI_REQUIRE_CLERK_AUTH vs GIZZI_DEV_CORS) leaked across files. Single file now covers all 17 tests; removed the cors-dev-flag line from test/smoke.txt (was added by this session, never committed).
- Converted `Flag.GIZZI_DEV_CORS` to a dynamic getter (Object.defineProperty pattern, same as GIZZI_CONFIG_DIR/GIZZI_CLIENT in flag.ts) so tests can toggle it per-test; server.ts origin() + listen() warning read it live.
- `serverAuthConfigured()` in src/cli/server-exposure.ts now reads process.env live instead of frozen Flag consts (guard runs at command startup, after flag init; tests toggle env mid-process). Dropped the now-unused Flag import.
- Deleted temp build entry cmd/gizzi-code/zz-entry.ts. New test file: 17 pass / 0 fail.
- Full-suite (1173 tests) first rerun exposed cross-file env leakage again: bun test shares one process, and an earlier test file froze the flag module before this file's env vars applied. Fixed by making the auth decision points read env LIVE: `ClerkAuth.required()`, the basic-auth password/username read in clerk-auth.ts middleware, and `serverAuthConfigured()` in server-exposure.ts (dropped unused Flag import there). `Flag.GIZZI_DEV_CORS` converted to a dynamic getter (same Object.defineProperty pattern as GIZZI_CONFIG_DIR/GIZZI_CLIENT). Also fixed the type side: `src/types/missing-modules.d.ts` ambient `declare module 'execa'` shim lacked a named `execa` export and typed args as `string[]`; added `export function execa(file, args?: any, options?: any)` (the real execa@8 has a named export; the default import was the runtime bug). Removed now-dead `loopback`/`exposed` locals in serve.ts.
- typecheck: PASS (exit 0). Standalone new-test run: 17 pass / 0 fail.

## Next
- DONE: full ci-smoke-test.sh PASS (949 pass / 0 fail / 1173 tests / 91 files), typecheck exit 0.
- Committed on branch session/gizzi-p3-webauth-20260904 as 59f770458 (43 files, +606/-97). No push, no merge.
- Remaining for the orchestrator: merge/push decision, then worktree cleanup + agent-ledger attestation per repo AGENTS.md.

## Open questions
- Ratchet job currently planned as continue-on-error: true per task brief ("goes hard after count reaches a target") — target TBD by owner.

## Update 2 (2026-09-03) — all open questions resolved
- Probed production: every path 401s (auth precedes routing) — gap invisible to anonymous probes; auth is on the critical path.
- Enumerated the 4 unverified client paths: `/api/chat`, `/api/v1/sessions/:id/events`, `/api/v1/agents/:id/events`, `/api/v1/operator/events/*` exist on NEITHER backend — orphaned calls (A4).
- Decisions recorded in the ADR: Step 6 = [2] destination + [1]-mechanism interim via [4]; A1 two-hop auth (Clerk JWT in, short-lived Ed25519 data-plane JWT out, tailnet ACL enforcement, replaces dev-token pattern); A2 chat is control-plane (model router), `/api/agent-chat` stays data-plane for local lane; A3 per-sub containers v1 + auto-stop; sizing = unprivileged Incus containers.
- P0 item 4 added: feature-flag widgets calling proxied namespaces until P1 handlers land.

## Update 3 (2026-09-04) — P0 fixes coded, 5 commits pushed
- 4f77728c3 vendor cloud-contracts (CI deploy blocker B7) — cargo metadata clean, builds pass
- 647912dcf CORS allowlist for allternit-api (mirror-any removed; 9 new tests) — also fixed pre-existing passkey_state test-compile break; 267 pre-existing --lib failures remain (refinery DB + stale control_plane tests, separate cleanup)
- f6338888e dev-token gate ALLTERNIT_ALLOW_DEV_TOKEN default OFF, all 5 acceptance sites + warn log + 7 tests; iOS literal moved to build config — NEEDS real Xcode build before merge
- f0b12c756 orphaned client calls (A4) — dead removed, live flagged, agents/:id/events verified real
- 0b7b70f1d fail-closed flags for jobs/agent-sessions/office/beta/rails namespaces (P0 item 4)
- Follow-up flagged: agent-chat, /api/v1/runtime, /api/v1/tools, /api/v1/permissions, /api/v1/questions, /api/model-lab/* are also Rust-only.
- Deploy-prep TODO for user: VPS api.env.template still has ALLTERNIT_LOCAL_DEV_BYPASS=true (keeps permissive CORS + localhost auth bypass on mail) — flip false with the proxy deploy.

## Update 4 (2026-09-04) — P1 tranche 1 coded, uncommitted (parent agent reviews/commits)
- migrations_pg/012_data_plane_nodes.sql: runtime_devices + kind ('local'|'paired'|'provisioned', default 'paired')/endpoint_url/tailnet_ip/relay_connected_at/capacity JSONB, partial online index, user_node_preferences table. Additive only.
- services/node_resolution.rs: default node = healthy (online + last_seen within ALLTERNIT_NODE_STALE_AFTER_SECS, default 120s + unexpired credential) device with freshest last_seen; all kinds uniform; none → ApiError::PreconditionRequired (new 428 variant). NodeStore trait for mocks + PgNodeStore.
- routes/runtime_relay.rs: extracted relay_request_to_runtime (was proxy_to_runtime body) — capability/allow-list/wake/stream logic lives once; agent-sessions handlers reuse it. Allow-list unchanged (/api prefix already covers the namespace; tests prove it).
- routes/agent_sessions.rs: full /api/v1/agent-sessions namespace (list/create/get/patch/delete, messages, sync SSE, abort/revert/unrevert/compact) mounted in the public runtime router (self-auth via resolve_user_scoped, like pairing/relay — the protected router's middleware only accepts allternit_* tokens). AgentSessionsGateway trait on ApiState (DataPlaneGateway production impl) so handler tests mock at the service boundary.
- SSE: relay streams head + chunks via Body::from_stream verbatim; content-type text/event-stream passes filtered_response_headers; RELAY_TIMEOUT bounds only the head wait.
- Verify: cargo build -p allternit-cloud-api OK; cargo test -p allternit-cloud-api --lib → 191 passed, 1 failed (known docker-less contabo provision test, pre-existing). 17 new tests (7 node_resolution incl. live-PG + migration idempotency, 6 agent_sessions handlers, 4 runtime_relay allow-list/headers).
- Docs: CLOUD_API_VPS_DEPLOY.md gained one ops bullet (apply 012 when deploying this).
- Next: tranche 2 = client flip (web EventSource auth — cookie vs fetch-stream decision) + /api/agent-chat; gizzi_instances backfill into kind='local' rows; relay_connected_at stamping on attach/detach.

## Update 5 (2026-09-04) — P1 tranche 2: data-plane JWT (A1) + office/beta namespaces, uncommitted
- auth/dataplane_jwt.rs (decision A1, cloud-api side): Ed25519 data-plane JWT. Seed env ALLTERNIT_DP_JWT_SEED (base64 32B; generate via generate_dev_seed() = `openssl rand -base64 32`); unset/invalid → fail-closed 503 dp_jwt_not_configured. Claims iss/sub=user/aud=node/iat/nbf/exp/scope/jti; TTL env ALLTERNIT_DP_JWT_TTL_SECS default 600 clamped 300–900 (A1 5–15 min window); manual JWT assemble/verify (same jsonwebtoken-v10 workaround as auth::clerk). verify(token, public_key) generic — cloud key for cloud→node, registry node key for node→cloud later (P2, cmd/allternit-api). 12 unit tests (roundtrip, wrong key, expiry, nbf, tamper, alg, TTL clamp, fail-closed, JWKS shape).
- GET /api/v1/auth/dp-jwks (public runtime router): minimal JWK set {kid=b64url(SHA256(pk)), alg EdDSA, kty OKP/crv Ed25519, x}; kid is rotation-derived. Nodes fetch at startup.
- routes/data_plane.rs: the tranche-1 AgentSessionsGateway seam generalized — trait DataPlaneGateway + production PgDataPlaneGateway + the shared 4-step core (Clerk resolve_user_scoped "compute" → resolve_default_node → relay via runtime_relay::relay_request_to_runtime, verbatim). ApiState field renamed agent_sessions_gateway → data_plane_gateway (lib/main/tests-common/e2e updated); agent_sessions handlers delegate to the shared core. routes/test_support.rs holds the mock gateway + schema-per-test ApiState builder now shared by all namespace handler tests.
- routes/office.rs (§3.3): GET /api/v1/office/bindings(+/:binding_id), POST /api/v1/office/bootstrap, POST /api/v1/office/runtime/state. Node-affine BY DESIGN (bindings are in-memory per :8013 process) — always the resolved default node, no ?node= override.
- routes/beta.rs (§3.4, priority order): research (POST+GET /api/v1/beta/research, GET+POST+DELETE /:id — :8013 serves update as POST, not PATCH), sessions CRUD, GET /events/list, GET /memory/search, POST /run (client-called but NOT in current :8013 route table — relayed anyway; node's 404 comes back verbatim until the data-plane handler lands).
- Capability/allow-list: office+beta map to runtime:execute via the existing table default; pinned by new runtime_relay tests (12 allow-list paths + 11 capability assertions).
- Skipped, deliberate: /beta/sessions/:id/events/ws (WebSocket-only — needs socket-ticket WS relay); /beta/sessions/:id/events SSE stream (not in §3 list; relay-compatible later); resources/files/context/tool-context/interrupt (not in §3); rails namespace (client dialect mismatch, needs its own decision); jobs (web jobsApi dead, deleted); office engine markdown endpoints (/api/office/markdown*) not in the task's office list.
- Verify: cargo build -p allternit-cloud-api OK; cargo test -p allternit-cloud-api --lib → 212 passed, 1 failed (known pre-existing docker-less contabo provision test). 21 net new tests vs tranche 1 (12 JWT + 3 office + 4 beta + 2 relay). No SSE test added — none of the new endpoints streams.
- Ops TODO for deploy: set ALLTERNIT_DP_JWT_SEED on cloud-api (no built-in dev default, by design).
- Next: attach the minted JWT to relay requests (replace the dev-token hop) once node-side verify lands (P2); office/beta env flags default ON after nginx prefix blocks retire; tranche 3 = rails decision + jobs-if-needed.

## Update 6 (2026-09-04) — P1 completion + merge prep
- Tranche 3 complete: WS relay for beta events (socket tickets), rails client dialect fix (48 methods mapped; thread_id->thread bug fixed), web flipped to control-plane handlers (CloudApiEventSource fetch-streaming SSE; flags still false-default).
- Node-side: DP JWT verification + POST /beta/sessions/:id/run written and registered; awaiting final cargo verification before commit.
- Remaining coverage gaps documented: 21 rails data-plane routes, canvas get/update/delete control-plane routes.
- Post-merge deploy TODOs: apply migrations_pg/012 on mail; set ALLTERNIT_DP_JWT_SEED; flip ALLTERNIT_LOCAL_DEV_BYPASS=false with nginx proxy; enable web flags per-namespace in .env.production.
---

# Steering checkpoint — P1/P2 backlog execution CLOSEOUT (2026-09-04, session p1followup)

## Goal
Execute the full P1/P2 list from reports/2026-09-03-production-readiness-gap-analysis.md. DONE — all six tracks merged to main as c9e6ddcb2.

## Just did (final)
- Track 6 (desktop/gizzi) reviewed, verified (desktop tsc 0/0, vitest 101/101, gizzi tsc 7 pre-existing-only), committed acc913bdb.
- Merged main into session branch (5d2be5ac1): resolved 9 conflicts from the parallel cloud-api track — kept md5-fallback token lookup + main's alt_ keys; both dev-token overrides kept, both now hard-refused in production; sqlx::migrate! is the single migration path (db::migrations unwired, documented); kept main's ci-smoke test gate.
- Verified merged tree: cargo check clean, cloud-api 188 pass (+1 known docker-env fail), wizard 53/53, gizzi smoke 1156/0 fail.
- Merged to main c9e6ddcb2, pushed. Ledger summary: agent-ledger/summaries/2026-09-04-0826-p1followup-kimi-code-p1p2-backlog-execution.md.
- Incident: concurrent session ran `git reset` in the main checkout mid-merge (~08:09) — recovered by merging in the session worktree instead. Do not run conflicted merges in the shared checkout while other sessions are active.

## Next
- Worktree + branch cleanup (this session is finished).
- OWNER: TS_AUTHKEY gh secret (CI deploy), secrets rotation (reports/2026-09-04-secrets-rotation-hygiene-handoff.md), Apple signing cert, launch-scope decision, session/routing dedupe when it lands.

## Open questions
- None from this session.
