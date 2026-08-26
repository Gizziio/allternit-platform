# Steering checkpoint — Desktop-as-a-Service MVP

## Goal
Build the Allternit Desktop-as-a-Service Linux MVP using Incus, with hard feature-size limits (1,000–1,500 LOC per feature) and proof-of-work checkpoints.

## Completed
- Phase 0–3: Local Incus desktop substrate, cloud-init guest image, driver, and platform integration.
- Phase 4: ACU gateway drives a browser inside a cloud-provisioned Incus desktop end-to-end.
- Phase 5: Human can view/control the bot desktop through the web UI via VNC.
- Phase 6: Bot desktop lifecycle control (start/stop/deprovision) added to the API.
  - Added `POST /api/v1/bots/:id/desktop/start`, `stop`, and `deprovision`.
  - Fixed Incus instance name length limit by truncating the bot id suffix.
  - Added unit tests with a mock `ExecutionDriver`.
  - Recorded proof: `docs/desktop-cloud-mvp/phase6-lifecycle-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase6-lifecycle-NOTES.md`.
  - Tests pass: `cargo test -p allternit-api bot_desktop` (5 passed),
    `cargo test -p allternit-computer-cloud` (12 passed).

## Running services
- ACU gateway: `http://127.0.0.1:8760` (PID 19435).
- Allternit API: `http://127.0.0.1:8013` (PID 74706).
- Headscale mesh control plane: `https://mail.news.allternit.com:8444` (VPS, systemd).

## Constraint reminder
- Each feature/module stays under 1,500 LOC.
- No Orgo dependency.
- Proof artifacts are screen recordings for the end-to-end checkpoints.

## Completed (cont.)
- Phase 7: signed WebSocket tokens for the VNC proxy.
  - Replaced `?user_id=...` with a short-lived HMAC-SHA256 signed `?token=...`.
  - Token claims bind to bot id, sandbox id, and authenticated user id.
  - Unit tests cover valid/expired/tampered/wrong-secret/malformed tokens.
  - Screen recording: `docs/desktop-cloud-mvp/phase7-ws-token-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase7-ws-token-NOTES.md`.
  - Tests pass: `cargo test -p allternit-api bot_desktop` (11 passed).

- Phase 8: per-user rate limiting on bot desktop REST endpoints.
  - Added a separate 30 RPM / user sliding window.
  - Returns HTTP 429 + `Retry-After` when exhausted.
  - Unit tests cover allowance, blocking, and per-user isolation.
  - Screen recording: `docs/desktop-cloud-mvp/phase8-rate-limit-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase8-rate-limit-NOTES.md`.
  - Tests pass: `cargo test -p allternit-api bot_desktop` (13 passed).

- Phase 9: screenshot endpoint for bot desktops.
  - Added `GET /api/v1/bots/:bot_id/desktop/screenshot?sandbox_id=...`.
  - Runs `scrot` inside the guest and returns `image/png`.
  - Fixed `IncusSubstrate::exec` output extraction bug (nested `metadata`).
  - Screen recording: `docs/desktop-cloud-mvp/phase9-screenshot-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase9-screenshot-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-computer-cloud` (13 passed)
    - `cargo test -p allternit-api bot_desktop` (14 passed)

- Phase 10: mouse + keyboard input endpoints for bot desktops.
  - Added `POST /api/v1/bots/:bot_id/desktop/mouse?sandbox_id=...`.
  - Added `POST /api/v1/bots/:bot_id/desktop/keyboard?sandbox_id=...`.
  - Implemented via `xdotool` inside the guest.
  - Split input endpoints into `cmd/allternit-api/src/bot_desktop_input.rs`
    to keep `bot_desktop_routes.rs` under 1,500 LOC.
  - Added `xdotool` to the guest cloud-init package list.
  - Screen recording: `docs/desktop-cloud-mvp/phase10-input-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase10-input-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop_input` (4 passed)
    - `cargo test -p allternit-api bot_desktop` (18 passed)

- Phase 11: shell endpoint for bot desktops.
  - Added `POST /api/v1/bots/:bot_id/desktop/shell?sandbox_id=...`.
  - Returns `{ exit_code, stdout, stderr, duration_ms }`.
  - Screen recording: `docs/desktop-cloud-mvp/phase11-shell-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase11-shell-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop_input` (5 passed)
    - `cargo test -p allternit-api bot_desktop` (18 passed)

- Phase 12: file upload/download endpoints for bot desktops.
  - Added `GET /api/v1/bots/:bot_id/desktop/files/download?path=...`.
  - Added `POST /api/v1/bots/:bot_id/desktop/files/upload?path=...`.
  - Extended `ExecutionDriver` with `pull_file` / `push_file` defaults.
  - Implemented file transfer in `IncusSubstrate` / `IncusDriver`.
  - Screen recording: `docs/desktop-cloud-mvp/phase12-files-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase12-files-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop_input` (7 passed)
    - `cargo test -p allternit-api bot_desktop` (18 passed)
    - `cargo test -p allternit-computer-cloud` (13 passed)

- Phase 13: standardize the guest agent runtime (`allternit-mux`) for Linux.
  - Added `allternit-mux` JSON daemon + `cmd/allternit-api/src/bot_desktop_mux.rs` (434 LOC).
  - Added `POST /api/v1/bots/:bot_id/desktop/mux/run` endpoint.
  - Guest service configured in `cloud-init.yaml` with `ConditionPathExists` guard.
  - Screen recording: `docs/desktop-cloud-mvp/phase13-mux-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase13-mux-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (23 passed)
    - `cargo test -p allternit-computer-cloud` (13 passed)

- Phase 14: connect guest desktops to Tailscale/Headscale mesh.
  - Added `MeshConfig` abstraction in `cmd/allternit-computer-cloud/src/mesh.rs` (235 LOC)
    supporting Tailscale (hosted) and Headscale (self-hosted) providers.
  - Wired mesh config into `IncusDriver` via `with_mesh()`.
  - Added `cmd/allternit-api/src/bot_desktop_mesh.rs` (370 LOC) with
    `POST /join`, `GET /status`, and `POST /leave` endpoints.
  - Deployed Headscale v0.29.3 on the VPS behind nginx TLS reverse proxy on port 8444.
  - Joined an Incus desktop to the Headscale tailnet and obtained Tailscale IP `100.64.0.1`.
  - Screen recording: `docs/desktop-cloud-mvp/phase14-mesh-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase14-mesh-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (25 passed)
    - `cargo test -p allternit-computer-cloud` (18 passed)

- Phase 15: build CI image pipeline for Ubuntu desktop.
  - Added `cmd/allternit-computer-cloud/guest/build-image.sh` to build the
    `allternit-desktop` Incus image with XFCE, Chrome, Tailscale, and `allternit-mux`.
  - Added `cmd/allternit-computer-cloud/guest/validate-image.sh` to verify a
    freshly built image.
  - Added `.github/workflows/desktop-image.yml` GitHub Actions workflow.
  - Built and published `allternit-desktop-ci` on the VPS and aliased it as
    `allternit-desktop`; provisioned a bot desktop from it and captured a
    1280x720 screenshot.
  - Screen recording: `docs/desktop-cloud-mvp/phase15-ci-image-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase15-ci-image-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (25 passed)
    - `cargo test -p allternit-computer-cloud` (18 passed)

- Phase 16: persistent disk snapshots and S3 backups.
  - Added snapshot primitives to the driver interface and implemented them for
    Incus (`create`, `list`, `restore`, `delete`).
  - Added REST endpoints in `cmd/allternit-api/src/bot_desktop_snapshots.rs`.
  - Added `cmd/allternit-computer-cloud/guest/backup-to-s3.sh` to export an
    Incus instance and upload it to MinIO; made it self-configuring with
    `mc alias set` and added a post-upload `mc stat` verification.
  - Verified an ~834 MiB backup persists in the `allternit-desktop-backups`
    bucket on the VPS MinIO instance.
  - Screen recording: `docs/desktop-cloud-mvp/phase16-snapshots-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase16-snapshots-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (26 passed)
    - `cargo test -p allternit-computer-cloud` (18 passed)

## Running services
- ACU gateway: `http://127.0.0.1:8760`.
- Allternit API: `http://127.0.0.1:8013` (PID from current workspace, started
  with `INCUS_URL=https://mail:8443` so Incus desktops are reachable).
- Headscale mesh control plane: `https://mail.news.allternit.com:8444` (VPS).
- MinIO on VPS: `http://127.0.0.1:9000`, bucket `allternit-desktop-backups`.

- Phase 17: production auth + audit logging.
  - Added `V93__desktop_audit_log.sql` migration and
    `cmd/allternit-api/src/bot_desktop_audit.rs`.
  - Desktop-router requests are now recorded with bot id, user id, method,
    path, action, and success/failure.
  - Added `GET /api/v1/bots/:bot_id/desktop/audit-logs` for operators.
  - Verified non-localhost requests without a Clerk/enterprise token are
    rejected with HTTP 401 while the same endpoints accept localhost dev
    bypass.
  - Screen recording: `docs/desktop-cloud-mvp/phase17-auth-audit-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase17-auth-audit-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (28 passed)
    - `cargo test -p allternit-computer-cloud` (18 passed)

- Phase 18: Windows Incus image and guest agent.
  - Added `V94__desktop_os.sql` migration and `os` field to desktop sandbox
    records.
  - Added `cmd/allternit-api/src/bot_desktop_windows.rs` with PowerShell
    command builders for screenshot, mouse, keyboard, shell, and file ops.
  - Updated provisioning to accept `?os=windows` and select the
    `allternit-desktop-windows` Incus image alias.
  - Added `build-windows-image.sh` and `setup-windows-agent.ps1`.
  - Screen recording: `docs/desktop-cloud-mvp/phase18-windows-proof.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase18-windows-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (30 passed)
    - `cargo test -p allternit-computer-cloud` (18 passed)
  - **Blocked**: the current Incus host is a VM without nested KVM
    (`/dev/kvm` missing), so a real Windows VM cannot be started here.
    Code is ready for a KVM-capable host.

- Phase 19: macOS Tart wrapper and base image.
  - Added `cmd/allternit-computer-cloud/src/bin/tart-host.rs` (~390 LOC), an
    HTTP wrapper around the Tart CLI: create, start, stop, delete, exec,
    file pull/push, screenshot, and health endpoints.
  - Added `cmd/allternit-computer-cloud/src/tart.rs` (~350 LOC), a
    `TartDriver` implementing the shared `ExecutionDriver` trait.
  - Wired `TartDriver` into `cmd/allternit-api/src/main.rs` when
    `TART_HOST_URL` / `TART_BIN` are set.
  - Cloned `ghcr.io/cirruslabs/ubuntu:latest` as `tart-ubuntu-test` and
    provisioned a desktop through the unified API using the Tart substrate.
  - Fixed `tart exec` invocation (no `--` separator) and added an SSH fallback
    via `sshpass` for guests without the Tart Guest Agent.
  - Fixed `DELETE` to stop a VM before deleting it because Tart rejects deleting
    a running VM.
  - Screen recording: `docs/desktop-cloud-mvp/phase19-tart-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase19-tart-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (30 passed)
    - `cargo test -p allternit-computer-cloud` (18 passed)

## Running services
- Allternit API: `http://127.0.0.1:8013` with both `INCUS_URL=https://mail:8443`
  and `TART_HOST_URL=http://127.0.0.1:8020` (SubstrateRouter active).
- Tart host wrapper: `http://127.0.0.1:8020` (local Apple Silicon Mac).

- Phase 20: substrate router (Incus + Tart).
  - Added `cmd/allternit-computer-cloud/src/router.rs` (421 LOC) implementing
    `SubstrateRouter`, an `ExecutionDriver` that routes Linux/Windows to Incus
    and macOS to Tart by inspecting `ALLTERNIT_DESKTOP_OS` and the stored
    `provider` tag.
  - Updated `cmd/allternit-api/src/main.rs` to build both drivers and wrap them
    in the router.
  - Updated `cmd/allternit-api/src/bot_desktop_routes.rs` to inject
    `ALLTERNIT_DESKTOP_OS` at provisioning time and to reconstruct handles with
    the correct provider tag for lifecycle ops.
  - Verified `POST .../provision?os=macos` returns `"provider":"tart"` and
    `POST .../provision?os=linux` routes to Incus (errors later because the VPS
    image is missing, which proves routing).
  - Screen recording: `docs/desktop-cloud-mvp/phase20-substrate-router-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase20-substrate-router-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (30 passed)
    - `cargo test -p allternit-computer-cloud` (21 passed)

- Phase 21: cluster multiple Incus hosts.
  - Added `cmd/allternit-computer-cloud/src/incus_pool.rs` (182 LOC) with
    `IncusHost` and `IncusHostPool`: round-robin scheduling for new spawns and
    host-aware routing for lifecycle ops.
  - Refactored `cmd/allternit-computer-cloud/src/driver.rs` to hold a pool
    instead of a single substrate; every handle now stores `host_url` so
    start/stop/exec/snapshots/files reach the Incus daemon that owns the VM.
  - `cmd/allternit-api/src/main.rs` reads `INCUS_URLS` (comma-separated) before
    falling back to `INCUS_URL`.
  - Verified single-host pool still routes Linux provisioning to Incus.
  - Screen recording: `docs/desktop-cloud-mvp/phase21-incus-pool-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase21-incus-pool-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-computer-cloud incus_pool` (3 passed)
    - `cargo test -p allternit-api bot_desktop` (30 passed)
    - `cargo test -p allternit-computer-cloud` (24 passed)

- Phase 22: template registry and presets.
  - Added `cmd/allternit-api/migrations/V95__desktop_templates.sql` and seeded
    public presets for Linux, Windows, and macOS.
  - Added `cmd/allternit-api/src/bot_desktop_templates.rs` (~407 LOC) with
    list/create/get/delete endpoints and `resolve_template` helper.
  - Extended `POST /api/v1/bots/:bot_id/desktop/provision` to accept
    `?template_id=`; templates override OS, image, resources, network, and env.
  - Verified `template_id=preset-macos` provisions through Tart.
  - Screen recording: `docs/desktop-cloud-mvp/phase22-templates-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase22-templates-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop_templates` (3 passed)
    - `cargo test -p allternit-api bot_desktop` (30 passed)

- Phase 23: per-user/org quotas and usage tracking.
  - Added `cmd/allternit-api/migrations/V96__desktop_quotas_usage.sql` with
    `desktop_quotas` and `desktop_usage` tables.
  - Added `cmd/allternit-api/src/bot_desktop_quotas.rs` (377 LOC) with
    `check_quota`, `record_start`, and `record_end`.
  - Wired quota checks into `bot_desktop_routes.rs`: provision returns HTTP 429
    when limits are exceeded; usage rows are opened on spawn and closed on
    deprovision.
  - Verified a concurrent limit of 1 blocks the second provision and records
    usage after deprovision.
  - Screen recording: `docs/desktop-cloud-mvp/phase23-quotas-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase23-quotas-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop_quotas` (3 passed)
    - `cargo test -p allternit-api bot_desktop` (36 passed)

- Phase 24: autoscaling and capacity monitoring.
  - Added `cmd/allternit-api/src/bot_desktop_capacity.rs` (~240 LOC) with a
    background capacity sampler, `CapacitySnapshot`/`CapacityMonitor`, and an
    autoscale scale-up signal based on `DESKTOP_AUTOSCALE_CPU_THRESHOLD`.
  - Added `GET /api/v1/desktop-capacity` returning current snapshots and the
    `scale_up_recommended` flag.
  - Wired the monitor into `cmd/allternit-api/src/main.rs`.
  - Screen recording: `docs/desktop-cloud-mvp/phase24-capacity-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase24-capacity-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop_capacity` (2 passed)
    - `cargo test -p allternit-api bot_desktop` (38 passed)

- Phase 25: billing / metering for desktop usage.
  - Added `cmd/allternit-api/migrations/V97__desktop_pricing.sql` with the
    `desktop_pricing` table and per-provider/OS seed prices.
  - Added `cmd/allternit-api/src/bot_desktop_billing.rs` (210 LOC) with
    `GET /api/v1/desktop-usage` and `GET /api/v1/desktop-usage/summary`.
  - Costs are computed on read by joining `desktop_usage` with `desktop_pricing`.
  - Verified summary returns `{"currency":"USD","rows":1,"total_cost":6.0,"total_minutes":120}`.
  - Screen recording: `docs/desktop-cloud-mvp/phase25-billing-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase25-billing-NOTES.md`.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (38 passed)

## Running services
- Allternit API: `http://127.0.0.1:8013` with both `INCUS_URL=https://mail:8443`
  and `TART_HOST_URL=http://127.0.0.1:8020` (SubstrateRouter active).
- Tart host wrapper: `http://127.0.0.1:8020` (local Apple Silicon Mac).

- Phase 26: web UI for desktop provisioning and management.
  - Added `surfaces/ai.allternit.com/public/desktop-cloud-admin.html`
    (~270 LOC) and `desktop-cloud-admin.js` (~70 LOC): a standalone admin
    page that lists bots, templates, capacity, and usage summary, and
    provisions a desktop via `POST /api/v1/bots/:bot_id/desktop/provision`.
  - Verified the page loads bots/templates/capacity/usage and provisions a
    macOS Tart desktop for `router-test-2`.
  - Added `docs/desktop-cloud-mvp/desktop-cloud-admin.test.mjs` (Node test
    runner) covering the API client with mocked fetch.
  - Screen recording: `docs/desktop-cloud-mvp/phase26-webui-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase26-webui-NOTES.md`.
  - Tests pass:
    - `node --test docs/desktop-cloud-mvp/desktop-cloud-admin.test.mjs` (6 passed)

- Phase 27: integrate Desktop Cloud admin surface into the authenticated
  Allternit React shell.
  - Added `cmd/allternit-api/src/bot_desktop_admin.rs` (87 LOC) with
    `GET /api/v1/desktop-sandboxes` to list all bot desktops for the
    authenticated user; merged into the v1 router in `main.rs`.
  - Kept `cmd/allternit-api/src/bot_desktop_routes.rs` under 1,500 LOC by
    extracting the global admin endpoint into `bot_desktop_admin.rs`.
  - Added `surfaces/ai.allternit.com/src/lib/desktop-cloud-api.ts` (~160 LOC)
    with typed wrappers using the canonical API singleton.
  - Added `surfaces/ai.allternit.com/src/lib/desktop-cloud-api.test.ts`
    (11 Vitest tests).
  - Added `surfaces/ai.allternit.com/src/views/desktop-cloud/DesktopCloudAdminView.tsx`
    (~580 LOC) with templates, capacity, usage, global sandboxes, and
    provision/start/stop/deprovision actions.
  - Wired the view into `nav.types.ts`, `nav.policy.ts`, `ViewRegistry.tsx`,
    and `ShellRail.tsx` as "Desktop Cloud".
  - Screen recording: `docs/desktop-cloud-mvp/phase27-platform-integration-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phase27-platform-integration-NOTES.md`.
  - Tests pass:
    - `pnpm exec vitest run src/lib/desktop-cloud-api.test.ts` (11 passed)
    - `cargo test -p allternit-api bot_desktop` (38 passed)

- Phase A: fix platform shell startup loop caused by unstable
  `useSyncExternalStore` snapshot.
  - Cached `StackedAgentService.getState()` snapshot so React sees a stable
    reference when the underlying state has not changed.
  - The shell now loads without "Maximum update depth exceeded" and the
    "Desktop Cloud" rail item opens `DesktopCloudAdminView` with live data.
  - Screen recording: `docs/desktop-cloud-mvp/phaseA-shell-fix-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phaseA-shell-fix-NOTES.md`.
  - A pre-existing `ChatComposer.tsx` initialization error remains in the
    default chat view; it is unrelated to Desktop Cloud and does not block
    the admin surface.

- Phase B.1: fix `better-sqlite3` native build on Node 26.
  - Added root `pnpm.overrides` forcing `better-sqlite3@13.0.3` across the
    workspace.
  - `pnpm install` now completes without `--ignore-scripts` on Node v26.5.0.
  - Verified the native binding loads and returns SQLite version `3.53.4`.
  - Screen recording: `docs/desktop-cloud-mvp/phaseB1-sqlite-install-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phaseB1-sqlite-fix-NOTES.md`.

- Phase B.2: build and start the gizzi-code runtime for agent-chat bootstrap.
  - Built `@allternit/gizzi-sdk` (`cmd/gizzi-code/packages/sdk`).
  - Built the gizzi-code binary (`cmd/gizzi-code/dist/gizzi-code-darwin-arm64`).
  - Started `./dist/gizzi-code serve --port 4096`.
  - Verified `/health` and `/v1/session/list` respond.
  - The `createAllternitClient` missing-export error is resolved.
  - Screen recording: `docs/desktop-cloud-mvp/phaseB2-gizzi-runtime-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phaseB2-gizzi-runtime-NOTES.md`.

- Phase C: Playwright end-to-end test for Desktop Cloud provisioning.
  - Added `surfaces/ai.allternit.com/tests/desktop-cloud.spec.ts` with a test
    that provisions, starts, stops, and deprovisions a macOS Tart desktop for
    `desktop-cloud-e2e-bot` from inside the authenticated platform shell.
  - Fixed `agentSchema` to accept backend `type: "assistant"` and
    `trust_tier: "medium"` so API-created test bots are visible in the bot
    select.
  - Fixed `DesktopCloudAdminView` bot list to merge the canonical API agents
    with the agent store's validated list.
  - Fixed `TartDriver::spawn` to block until the VM reports `running`, and
    updated `provision_desktop` to store/return `"running"` after a successful
    spawn.
  - Made `deprovision_desktop` delete the DB record immediately and destroy the
    VM in the background so the UI stays responsive.
  - Added `data-testid="sandboxes-table"` so the test scopes row lookups to the
    sandboxes table (avoiding usage-table matches).
  - Screen recording: `docs/desktop-cloud-mvp/phaseC-playwright-demo.webm`.
  - Notes: `docs/desktop-cloud-mvp/phaseC-playwright-NOTES.md`.
  - Tests pass:
    - `pnpm exec playwright test tests/desktop-cloud.spec.ts --project chromium` (1 passed)
    - `pnpm exec vitest run src/lib/desktop-cloud-api.test.ts` (11 passed)
    - `cargo test -p allternit-api` (464 passed)
    - `cargo test -p allternit-computer-cloud` (24 passed)

- Phase D: hardened VPS deployment and remote e2e proof.
  - Built and installed the `allternit-api` release binary on the VPS
    (`mail.news.allternit.com`) as a systemd service (`allternit-api`).
  - Exposed the API securely via OpenResty reverse-proxying
    `https://mail.news.allternit.com` to `http://127.0.0.1:8013`.
  - Installed Incus client certs under `/etc/allternit-api/incus/` so the API
    authenticates to the local Incus daemon.
  - Created `desktop-cloud-e2e-bot` on the VPS and ran the Playwright e2e test
    from the local platform shell pointed at the remote gateway.
  - Hardened `tests/desktop-cloud.spec.ts` to dismiss the onboarding portal,
    clean up leftover sandboxes, and select bot/template by `aria-label`.
  - Added `aria-label` attributes to the Bot/Template selects in
    `DesktopCloudAdminView.tsx`.
  - Verified the full provision → running → stop → deprovision flow against the
    VPS Incus backend in ~28 seconds.
  - Screen recordings:
    - `docs/desktop-cloud-mvp/phaseD-vps-deploy-demo.webm` (browser e2e)
    - `docs/desktop-cloud-mvp/phaseD-terminal-recap.webm` (terminal pass recap)
  - Notes: `docs/desktop-cloud-mvp/phaseD-vps-deploy-NOTES.md`.
  - Tests pass:
    - `VITE_ALLTERNIT_GATEWAY_URL=https://mail.news.allternit.com DESKTOP_CLOUD_TEMPLATE_LABEL="Ubuntu 24.04 Desktop (linux)" pnpm exec playwright test tests/desktop-cloud.spec.ts --project chromium` (1 passed)
    - `pnpm exec vitest run src/lib/desktop-cloud-api.test.ts` (11 passed)
    - `cargo test -p allternit-api bot_desktop` (38 passed)
    - `cargo test -p allternit-computer-cloud` (24 passed)

## Running services
- Allternit API (VPS): `https://mail.news.allternit.com` via OpenResty →
  `http://127.0.0.1:8013`, systemd unit `allternit-api`.
- Incus daemon on VPS: `https://mail:8443`.
- Local platform dev server used for Playwright: `http://localhost:5177`.
- Local Tart host wrapper: `http://127.0.0.1:8020`.

- Phase E: production hardening of the VPS Linux Desktop Cloud deployment.
  - Added self-hosted onboarding token auth (`X-Allternit-Self-Hosted-Token`)
    for bootstrap endpoints, plus `GET /api/v1/desktop-health`.
  - Hardened Incus TLS: CA cert verification enabled, certs deployed via
    `deploy.sh` to `/etc/allternit-api/incus/`.
  - Enabled JSON production logging with request IDs on the VPS.
  - Added GitHub Actions workflow `.github/workflows/deploy-desktop-cloud-vps.yml`
    to build, deploy, seed, and run the remote Playwright e2e test.
  - Added systemd backup timer/service and verified an ~834 MiB backup persists
    in the local MinIO bucket; fixed a missing executable bit on
    `backup-to-s3.sh` that caused the first scheduled run to fail.
  - Added `health-check.sh`, `seed-e2e.sh`, and `RUNBOOK.md`.
  - Fixed `DesktopCloudAdminView` bot-selection race: one-shot default-selection
    refs, name-based deduplication preferring the canonical API list, and live
    DOM value reads at provision time so the e2e bot is always provisioned.
  - Added Incus VNC proxy port recovery at API startup so restarts do not retry
    already-bound host ports.
  - Remote Playwright e2e against `https://mail.news.allternit.com` passed in
    37.1s using Google Chrome.
  - Tests pass:
    - `cargo test -p allternit-api bot_desktop` (38 passed)
    - `cargo test -p allternit-computer-cloud` (24 passed)
  - Screen recording: `docs/desktop-cloud-mvp/phaseE-production-hardening-demo.mp4`.
  - Notes: `docs/desktop-cloud-mvp/phaseE-production-hardening-NOTES.md`.

## Summary
Desktop-as-a-Service MVP phases (0–27) and Phases A–E are complete. The unified
control plane can provision Linux, Windows, and macOS desktops behind a single
substrate router, with templates, quotas, capacity monitoring, billing,
snapshots, mesh join, audit logging, and a platform-integrated admin surface
that is now covered by an automated end-to-end provisioning test running
remotely against the production-hardened VPS deployment.

- Phase F: heterogeneous fleet expansion (macOS remote + Windows readiness).
  - Added `capabilities: Vec<String>` to `DriverHealth`; Incus reports
    `["linux"]` (+ `"windows"` when `/dev/kvm` exists), Tart reports `["macos"]`,
    and `GET /api/v1/desktop-health` exposes the aggregated list.
  - Refactored `TartDriver` to support `TART_HOST_URLS`, authenticated requests
    via `TART_HOST_TOKEN`, and round-robin across multiple Tart hosts.
  - Added bearer-token auth to `tart-host` (all routes except `/health`).
  - Added `x-allternit-internal-token` support to the API auth middleware so
    service-to-service health probes work.
  - Created `infrastructure/tart-host/{deploy.sh,com.allternit.tart-host.plist}`
    to build, install, and run the Tart wrapper under launchd on the Mac.
  - Deployed the Tart host on the local Mac (`100.88.98.69:8020`) and pointed
    the VPS API at it via `TART_HOST_URLS` + `TART_HOST_TOKEN`.
  - Verified full provision → stop → status → deprovision lifecycle through the
    VPS control plane for a Tart VM; response showed `"provider":"tart"`,
    `"host":"100.88.98.69"`.
  - Windows capability is code-ready but hardware-blocked: the VPS lacks
    `/dev/kvm`; a KVM-capable Incus host is needed to advertise `"windows"`.
  - Tests pass:
    - `cargo test -p allternit-api` (464 passed)
    - `cargo test -p allternit-computer-cloud` (24 passed)
  - Notes: `docs/desktop-cloud-mvp/phaseF-fleet-expansion-NOTES.md`.

## Open questions / next gaps
1. Bot runtime integration: an agent should be able to request, use, and release
   a desktop automatically during a chat/session.
2. Windows fleet: procure/deploy a KVM-capable Incus host and build/package the
   Windows desktop image.
3. Packaged macOS image: import or build a real `macos-base` Tart image.
4. Fleet autoscaling / capacity-driven queueing beyond the current snapshot flag.
5. Real billing/payments integration beyond usage-row cost computation.
6. UI completeness: ensure screenshot/mouse/keyboard/shell/file endpoints are
   exposed cleanly in `DesktopCloudAdminView`.

---

# Steering checkpoint — Remote Control / Dispatch consolidation

## Goal
Finish the Remote Control feature: merge the `session/remote-control-finish` implementation into `session/desktop-cloud-mvp`, deploy the platform + dashboard + push worker, and verify a real end-to-end session handoff across desktop and mobile/PWA.

## Current verified state
- Working directory: `/Users/joe/Desktop/Allternit/allternit-platform/` (shared checkout on `session/desktop-cloud-mvp`). Note: this is the shared main checkout, not a session worktree, because the remote-control changes were already applied here.
- `DispatchView.tsx` is rebranded to "Remote Control" and contains a "Remote sessions" tab that calls `openRemoteControlWindow()`.
- `surfaces/ai.allternit.com/src/remote-control/` dashboard + PWA assets exist.
- Desktop shell exposes `shell.openRemoteControl` and opens `https://remotecontrol.allternit.com` in a dedicated `BrowserWindow`.
- Rust API has `remote_control_routes.rs` mounted; gizzi-code has `/v1/remote-control` routes + push integration; cloud API has capability mapping updates.
- `services/remote-control-push/` worker + deployment workflow exist.
- `surfaces/ai.allternit.com/dist/` has the main platform build but is missing a separate `remote-control.html` build output.

## Blockers
- Clerk production auth is still broken on desktop and web. The user explicitly asked to pause deep Clerk debugging and finish the remote-control build-out first, but this will block the final e2e sign-in verification.

## Next steps
1. Build the Remote Control dashboard entry (`vite.remote-control.config.ts`) and stage it for Pages deployment.
2. Deploy `allternit-platform` and `allternit-remote-control` Cloudflare Pages projects.
3. Deploy the `allternit-remote-control-push` Cloudflare Worker.
4. Rebuild and redeploy the Rust API (`cmd/allternit-api`) and cloud API (`cmd/allternit-cloud-api`) to Fly.io.
5. Rebuild the desktop shell so `shell.openRemoteControl` is live.
6. Run a real end-to-end verification: sign in, pair runtime, open Remote Control, list sessions, open dashboard on another browser/phone, install PWA, test push.
7. Package and code-sign the desktop DMG.

---

# Steering checkpoint — Unified Compute phases 3-4 (lifecycle + credits)

## Goal
Implement the "phases-3-4-lifecycle-credits" work package from the unified compute plan: bot session lifecycle integration and a unified credit ledger for Desktop Cloud usage.

## Just did
- Read the approved plan and all relevant existing code: `computer_routes.rs`, `bot_desktop_quotas.rs`, `bot_desktop_billing.rs`, `fallback_credit_routes.rs`, `admin_spend_limit_routes.rs`, `pricing.rs`, `usage_events` schema, `vm-operator.ts`, `useStartBotSession.ts`, `mode-session-store.ts`, `ComputeBillingPanel.tsx`.
- Confirmed branch `session/desktop-cloud-mvp` is clean and toolchain versions are available.

## Next
1. Backend: extend `computer_routes.rs` with session_id/persistence, credit/spend check, and session-end handling.
2. Backend: emit `usage_events` rows from `bot_desktop_quotas.rs` on desktop end, add `computer_minute` pricing, and include usage_events in org spend calculations.
3. Frontend: extend `AgentVMOperatorConfig` with `computerKind`/`templateId`; update `vm-operator.ts` to call `/api/v1/computers`; update `bot-runtime-env.ts`; add session teardown hook; update tests.
4. Frontend: add Desktop Cloud usage summary to `ComputeBillingPanel.tsx`.
5. Run `cargo test -p allternit-api` and `pnpm --filter ai.allternit.com typecheck`.

## Open questions
- The plan references `ComputeBillingPanel` "Usage & Credits tab", but the current panel has no tabs (Phase 2 `ComputeSettings.tsx` is not in this branch). I will add a minimal usage/credits section to the existing panel instead of creating the full tabbed settings view.
- Session teardown will be implemented client-side in `deleteSession` for ephemeral computers; a server-side lifecycle hook can be added later.

---

# Steering checkpoint — Unified Compute Phase 2 (settings UI)

## Goal
Consolidate the four compute-related settings sections into a single "Compute & Cloud Desktops" settings panel.

## Just did
- Created `surfaces/ai.allternit.com/src/views/settings/ComputeSettings.tsx` (~85 LOC) with tabs:
  Overview, My Computers, Add Computer, Templates, and Usage & Credits.
- Reused existing panels inside the tabs:
  `ComputeBillingPanel`, `VPSConnectionsPanel`, `CloudInstancesPanel`,
  `DesktopCloudAdminView`, and `EnterpriseByocPanel`.
- Updated `surfaces/ai.allternit.com/src/views/settings/settings.config.ts`:
  - Added `compute` under Infrastructure.
  - Removed legacy `vps`, `cloud-instances`, and `cloud-credentials` nav items.
  - Added `SETTINGS_LEGACY_REDIRECTS` and `normalizeSettingsSection()` so old
    deep-links route to the new `compute` section.
- Updated `surfaces/ai.allternit.com/src/views/settings/SettingsView.tsx`:
  - Imports and renders `<ComputeSettings />` for the `compute` section.
  - Uses `normalizeSettingsSection()` for `initialSection` and navigation events.
  - Removed direct render cases for the legacy compute sections.
- Ran targeted Vitest tests:
  - `SettingsView.test.tsx`, `ComputeBillingPanel.test.tsx`,
    `EnterpriseByocPanel.test.tsx`, `CloudInstancesPanel.test.tsx`.
  - Result: 4 test files, 6 tests passed.

## Next
- Phase 3–4 work package can now extend the "Usage & Credits" tab with the
  unified `usage_events` ledger and wire bot session lifecycle creation into
  the "My Computers" / "Add Computer" tabs.

## Open questions / notes
- `pnpm --filter @allternit/ai typecheck` still fails on pre-existing errors in
  `src/lib/agents/agent.service.ts`, `src/lib/agents/mode-session-store.ts`,
  and `src/views/agent-view/components/AgentGalleryCard.tsx`. No new type
  errors were introduced by the Phase 2 files.
- No screen/video proof was requested for this checkpoint; add a recording if
  the orchestrator wants visual verification of the new settings section.

---

# Steering checkpoint — frontend-ui bot group chat polish

## Goal
Fix the bot group-chat UI so it matches the rest of the platform and clearly shows multiple bots.

## Just did
- `surfaces/ai.allternit.com/src/shell/ShellRail.tsx`: `GroupChatRailItem` now renders real `BotAvatar` components for each member (pulled from `useAgentStore` via `metadata.botIds`), with a `botProfiles` initials fallback for legacy sessions. Layout uses negative overlap spacing and keeps the group name on top.
- `surfaces/ai.allternit.com/src/views/bots/GroupChatSessionView.tsx`: Rewrote the session view to match the single-bot `ChatModeAgentSession` UX — same dark chat container, mode wash, message bubble styling, composer, and a right-hand `CanvasPanel` listing group members. Bot message clusters still show the bot name + avatar.
- `surfaces/ai.allternit.com/src/views/agent-sessions/AgentSessionLayout.tsx`: Added `min-w-0` and `truncate` to the header title area so the group avatar stack doesn't clip the session name.
- `surfaces/ai.allternit.com/src/views/agent-sessions/ChatModeAgentSession.tsx`: Removed a stray debug `console.log`.

## Verification
- `pnpm run typecheck` in `surfaces/ai.allternit.com` passes.
- `pnpm run build` in `surfaces/ai.allternit.com` completes successfully (pre-existing warnings only).

## Next
- Coordinate with the verification-area agent (or parent) to confirm packaged bots appear in Bot Hub and that single-bot + group-chat flows render correctly in the browser at http://localhost:3014.

## Open questions
- None from frontend-ui; ready for integration verification.
