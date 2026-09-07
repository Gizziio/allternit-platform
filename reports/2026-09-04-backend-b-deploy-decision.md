# Backend B (allternit-api) public deploy — decision memo

Date: 2026-09-04 · Status: **DECISION NEEDED (owner)** · Blocks: P2 "Backend B public deploy", PLAT-P0 "web↔backend routing"

## What Backend B is

`cmd/allternit-api` (Rust, axum, port 8013) — the second production backend. It hosts the platform routes the CLI's cowork/task/rails-mail features use: agents, tasks, schedules, rails mail bridge (`/api/rails/*`), OfficeCLI gateway, admin routes. Today it only ever runs on a user's loopback (or a dev machine); every gizzi-code call site defaulted to `http://127.0.0.1:8013` until the 2026-09-04 centralization, which moved the fallback into one constant (`src/shared/constants/allternitGateway.ts` in gizzi-code) without changing its value.

Note: `cmd/allternit-cloud-api` (port 8080, lives at **api.allternit.com**) is a *different* service — cloud billing, hosted runtimes, scoped `alt_` tokens. Do not conflate them.

## Why it must go public

- `gizzi cowork`, task/schedule commands, rails-mail, and the web app's authenticated features only work when the user runs the backend locally. The web app (ai.allternit.com) has no backend to talk to in production — this is the PLAT-P0 "web↔backend routing" gap.
- The iOS app and desktop app expect a reachable API for the same routes.

## Options

**A. Same Contabo box + Cloudflare-proxied subdomain (recommended).**
Run allternit-api on the existing Contabo host next to cloud-api ( systemd unit, distinct port, loopback bind ), front it with `gateway.allternit.com` via Cloudflare DNS (proxied). TLS and DDoS posture come free; CORS allowlist on allternit-api gets `https://ai.allternit.com` + `https://platform.allternit.com`. gizzi-code flip = one line in `allternitGateway.ts`. Requires on the box: `officecli` binary (brew/apt install, `officecli config autoUpdate false`, set `OFFICECLI_BIN`), `ALLTERNIT_OFFICECLI_LIVE_FS=false` (it must be false when the gateway is remote — README is explicit).

**B. Separate host.** More isolation, more ops surface. Not warranted at current scale.

**C. Fold the routes into cloud-api (api.allternit.com).** Rejected: ~100 route modules, different auth model (Clerk JWT vs alt_ tokens vs session), weeks of work, high regression risk days before release.

## Decision needed from owner

1. Approve option A and the hostname (`gateway.allternit.com` vs `apps.allternit.com` vs other).
2. DNS: create the proxied record (zone allternit.com, same zone id as existing records).
3. Confirm the Contabo box has capacity (cloud-api + Postgres + reconcilers already run there; allternit-api is axum+SQLite/Postgres, modest).

## Post-decision checklist (code/agent work, ~half a day)

- [ ] systemd unit for allternit-api on the box, env: `ALLTERNIT_OFFICECLI_LIVE_FS=false`, `OFFICECLI_BIN`, DB URL, Clerk issuer = clerk.allternit.com
- [ ] CORS allowlist update in allternit-api config + deploy
- [ ] Flip `ALLTERNIT_GATEWAY_BASE` fallback in gizzi-code (one line) — after the DNS record resolves
- [ ] Update install.gizziio.com docs / `gizzi doctor` reachability check to test the public URL
- [ ] Smoke: `curl https://gateway.allternit.com/api/v1/health` → ready; one authenticated cowork call e2e
- [ ] Sequencing warning: same as the cloud-api backdoor deploy — coordinate with the iOS build that ships the old token before cutting over anything the iOS app calls

## Related

- PLAT-P0 "web↔backend routing story" is this decision; once made, the web surface CORS/auth work follows from it.
- The cloud-api backdoor closure deploy (scripts/deploy-cloud-api.sh) is independent and can land first.
