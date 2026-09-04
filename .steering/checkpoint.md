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
