# Steering Checkpoint

## Goal
Record the owner's Step 6 routing decision (option b — control-plane/data-plane split), research DevPod as prior art for per-sub provisioning, and update the work list (audit addendum + decision doc + interim nginx proxy snippet).

## Just did
- Created session worktree `allternit-session-routing`, branch `session/routing` @ a683a29f3.
- Verified cloud-api route table has zero routes under /api/jobs, /api/v1/agent-sessions, /api/v1/office/, /api/v1/beta/, /api/rails/ (checked lib.rs + routes/) — interim nginx prefix proxy cannot shadow cloud-api.
- Found potential collision families needing enumeration: web client also calls /api/chat, /api/v1/sessions/:id/events, /api/v1/agents/:id/events, /api/v1/operator/events (api-client.ts:690,778,942,1108) — unverified which backend owns them.
- Wrote docs/Architecture/2026-09-03-control-plane-data-plane-decision.md (decisions D1–D5, DevPod/OpenCode/E2B prior art, work list P0–P3, open questions).
- Wrote infrastructure/vps-desktop-cloud/nginx-api-allternit-interim-proxy.conf (5 prefix blocks, verification curls, CORS hardening TODO).
- Appended Addendum 2 to reports/2026-09-03-production-readiness-gap-analysis.md recording the Step 6 decision.

## Next
- Commit on session/routing (this gate), push, open PR for owner review.
- Owner-gated items awaiting user: deploy of the nginx snippet on mail; 8013 CORS allowlist; enumeration of the 4 unverified paths.

## Open questions
- Auth model for data-plane calls (which token does the control plane mint for 8013?) — overlaps audit B1 backdoor work.
- Is /api/chat control-plane (model router) or data-plane compute?
- Per-sub vs per-org container granularity for the provisioned lane.

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
- migrations_pg/011_data_plane_nodes.sql: runtime_devices + kind ('local'|'paired'|'provisioned', default 'paired')/endpoint_url/tailnet_ip/relay_connected_at/capacity JSONB, partial online index, user_node_preferences table. Additive only.
- services/node_resolution.rs: default node = healthy (online + last_seen within ALLTERNIT_NODE_STALE_AFTER_SECS, default 120s + unexpired credential) device with freshest last_seen; all kinds uniform; none → ApiError::PreconditionRequired (new 428 variant). NodeStore trait for mocks + PgNodeStore.
- routes/runtime_relay.rs: extracted relay_request_to_runtime (was proxy_to_runtime body) — capability/allow-list/wake/stream logic lives once; agent-sessions handlers reuse it. Allow-list unchanged (/api prefix already covers the namespace; tests prove it).
- routes/agent_sessions.rs: full /api/v1/agent-sessions namespace (list/create/get/patch/delete, messages, sync SSE, abort/revert/unrevert/compact) mounted in the public runtime router (self-auth via resolve_user_scoped, like pairing/relay — the protected router's middleware only accepts allternit_* tokens). AgentSessionsGateway trait on ApiState (DataPlaneGateway production impl) so handler tests mock at the service boundary.
- SSE: relay streams head + chunks via Body::from_stream verbatim; content-type text/event-stream passes filtered_response_headers; RELAY_TIMEOUT bounds only the head wait.
- Verify: cargo build -p allternit-cloud-api OK; cargo test -p allternit-cloud-api --lib → 191 passed, 1 failed (known docker-less contabo provision test, pre-existing). 17 new tests (7 node_resolution incl. live-PG + migration idempotency, 6 agent_sessions handlers, 4 runtime_relay allow-list/headers).
- Docs: CLOUD_API_VPS_DEPLOY.md gained one ops bullet (apply 011 when deploying this).
- Next: tranche 2 = client flip (web EventSource auth — cookie vs fetch-stream decision) + /api/agent-chat; gizzi_instances backfill into kind='local' rows; relay_connected_at stamping on attach/detach.
