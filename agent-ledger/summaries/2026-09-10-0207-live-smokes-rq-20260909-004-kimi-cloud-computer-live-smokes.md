# Live smokes for rq-20260909-004 (cloud-computer-orgo-parity) — six defects found, six fixed

Date: 2026-09-10. Session: rq-20260909-004 owed live smokes (continuing session
`ace7bb66`, worktree `allternit-session-embedfix`).
Agent: kimi (main) — orchestrator Eoj drove; smokes run against a locally
built `allternit-api` on :18013 (the Desktop apps supervise :8013), tart-host
sidecar on :8020, base Tart VM `allternit-desktop`.

## Why this session existed

Phases 1–5 of the spec landed 2026-09-09/10 (PRs #201/#204/#206/#216/#222,
queue `landed`) but the owed live smokes were deferred. Owner: "the honest
deferrals lets work on all of them and finish." Each smoke ran against the
real running API on the real Tart substrate. Evidence:
`~/.agent-orchestrator/evidence/cloud-computer-orgo-smokes/` (smoke1/2/3
markdown + earlier json/html captures).

## Six smoke-found defects, six PRs (all merged)

| PR | Defect | How the smoke caught it |
|----|--------|-------------------------|
| #225 | axum 0.8 catch-all `{*path}` panicked router build at boot (embed noVNC assets) | Smoke API couldn't boot at all from main |
| #228 | Read-only VNC proxy dropped ALL client bytes — noVNC could never complete the RFB handshake; embed viewer blank for its only audience | Pre-fix live test: greeting flowed, then silence; post-fix: client version forwarded, real server SecurityTypes came back through the filter |
| #231 | Tart driver's desktop endpoint blindly pointed at `<vnc_host>:5900` — on this Mac that's the HOST's own screensharingd, so a guest computer's embed viewer silently streamed the HOST screen (verified live: Apple's security types 30/33/36/35 answered the proxy) | Now fail-closed: endpoint requires an explicit per-VM `vnc_port` from tart-host; ws closes honestly with "no desktop endpoint found" (verified live, code 1005) |
| #233 | `optional()` covers row-absence, not NULL: fresh template's first build 500'd `Invalid column type Null` — no template could ever build via the API | Smoke 1: import → gate → 500 |
| #234 | Golden holder spawn passed no provider hint → SubstrateRouter routed the Linux holder to the absent Incus substrate ("Feature not supported: Incus substrate", invisible because async pipelines only recorded the 503 status) | Added server-side spawn-error logging; holder now pinned to Tart when `state.incus_driver` is None |
| #235 | Build's apt steps assumed root exec; Tart exec is the VM user → `apt-get update exited 100, permission denied` | Fixed with `id -u` detection + `sudo -n` prefix |

## What each smoke proved (live, end-to-end over HTTP/WS)

- **Smoke 2** (real-time plane + embed): status endpoint, embed-token mint
  (purpose=embed, read_only forced, 900s), viewer page with correct CSP
  (`default-src 'none'; script-src 'self'; frame-ancestors *`), RFB greeting
  + security negotiation through the read-only filter, fail-closed endpoint
  after #231.
- **Smoke 3** (ACI handoff): full-control vnc token mint is 403
  `confirmation_required` → pending grant does not redeem →
  `POST /api/aci/handoff/:id/approve` (human decision) → mint 200 with
  verified JWT claims (`purpose=vnc, read_only=false`) → grant is single-use
  (reuse 403) → deny path 403s with "denied by the approver" → unified
  status endpoint reports `consumed`/`denied` from the hash grant. Note: ACI
  routes live at `/api/aci/...`, NOT `/api/v1/aci/...` (501 fallback
  otherwise).
- **Smoke 1** (templates as code): import 200 with spec_yaml stored; invalid
  cpu_cores 422 with the validated-set message; build is ACI-gated like the
  control surface; after #233/#234/#235 the pipeline runs end-to-end on Tart
  — holder spawns, apt + postCreate hook succeed — and fails honestly at the
  declared substrate boundary: `failed to create golden snapshot: Feature
  not supported: snapshot` (Tart advertises `snapshot:false`), with
  `build_status=failed` + persisted `build_error` and holder cleanup.
  Fallback provision from a never-golden template spawns from the base image
  (201) — packages intentionally not installed there.

## Recurring lesson (third time this repo has paid for it)

Every one of these was invisible to `cargo test`: the router-build panic
(tests never build the public router), the handshake drop (no real server in
tests), the wrong-screen endpoint (assumed `5900`), the NULL gate (tests
seeded non-null), the Incus routing (no Tart-only integration run), the
root-assumption (Incus-only CI). A boot-a-router smoke + one Tart-only
integration lane would have caught #225/#231/#233/#234/#235 before merge.

## Honest deferrals (registered, not silently dropped)

1. **Golden snapshots require an Incus host.** Tart build pipeline is honest
   up to that boundary; snapshot capability is substrate, not code.
2. **Tart guest-VNC data plane**: tart-host exposes no guest-VNC forward;
   #231 fails closed until tart-host allocates a per-VM forward port and
   reports it as `vnc_port` (driver side already consumes the field).
   Guest provisioning would also need X + x11vnc. Until then Tart computers
   have no VNC endpoint (PTY/events unaffected — exec-based).
3. Tart snapshot/image-archive support could replace the Incus requirement
   for golden builds if the driver grew snapshot capability.
4. `/api/aci/*` vs `/api/v1/*` path shape is a footgun for client wiring;
   documented here rather than changed (route moves break existing clients).

## Infra restored

Smoke API (:18013) and tart-host (:8020) stopped; test Tart VMs deleted;
session worktrees (`allternit-session-embedfix`) and merged session branches
deleted; both Desktop apps replaced with a fresh build from merged main
(`Allternit-Desktop-1.1.1-b1750-arm64.dmg`, unsigned) and relaunched.

### Incident: shared dev DB migrated past the stale bundled binary

The smoke API ran with the default app-data DB path, so it applied current
main's migrations (V133+) to the same `~/Library/Application Support/
@allternit/desktop` database the installed Desktop app boots against. The
installed app's bundled allternit-api predated V133 and panicked at boot:
`migration V133__llm_provider_routing_policies is missing from the
filesystem`. Remediated per the repo ritual (AGENTS.md step 8 — the session
touched code the desktop bundles): `cargo build --release -p allternit-api`
from main, `build:electron:dmg` (release-preflight 26/0), installed over
both app copies, verified boot in the app log (`Database ready`, `Server
listening on 0.0.0.0:8013`, `BackendManager Ready`) — migration panic gone.
Pre-existing, unrelated: the bundled voice sidecar fails with a pyexpat
binary `built for macOS 26.0 which is newer than running OS` (Voice Mode
unavailable; needs a voice-sidecar rebuild on this OS — not touched here).
