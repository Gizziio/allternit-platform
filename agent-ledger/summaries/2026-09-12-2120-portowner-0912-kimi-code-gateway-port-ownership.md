# Session attestation — portowner-0912 (gateway port ownership)

- **Agent:** kimi-code (interactive session with Eoj)
- **Date:** 2026-09-12 21:20 local
- **PR:** #445 (merged 2026-09-12, merge commit `032f81cfa9563d0b40f15d557d9353114805d164`)
- **Branch:** `session/portowner-0912`

## What was done

Structural fix for the recurring "relay offline" failure class on Fabric
Transport: multiple agent sessions running dev builds of `allternit-api` from
their own worktrees kept squatting port 8013 — the installed Allternit
Desktop app's production gateway — because the binary **defaulted** to 8013
when `ALLTERNIT_API_PORT` was unset. Fixed by hand twice (kill squatter,
relaunch app); this change removes the failure mode.

**Contract after the change: 8013 is owned, not defaulted.**

1. `cmd/allternit-api/src/config.rs` — `api_port()` unset default 8013 → 18013
   (dev). Explicit `ALLTERNIT_API_PORT` always wins. Ownership contract
   documented on the method.
2. `cmd/allternit-api/src/main.rs` — startup log records port + source
   (`env ALLTERNIT_API_PORT=…` vs `default (dev 18013)`).
3. `surfaces/allternit-desktop/src/main/config.ts` — `PORTS.API_DEV = 18013`.
4. `surfaces/allternit-desktop/src/main/backend-manager.ts` — dev desktops
   (`!app.isPackaged`) bind the dev port (explicit env export still wins);
   packaged app behavior unchanged (pins 8013, reclaims on launch);
   `terminateListenerOnPort` (SIGTERM squatter) now runs only in the packaged
   app — previously a dev Electron would kill the installed app's gateway.
5. `cmd/allternit-api/deploy-contabo.sh` — writes systemd drop-in
   `50-port.conf` (`Environment=ALLTERNIT_API_PORT=8013`) before restart, so
   the Contabo data-plane unit owns the port on its next deploy. The unit file
   itself lives on the server, not in-repo; the drop-in self-heals it.
6. `cmd/launcher/src/main.rs` — spawns its embedded api with
   `ALLTERNIT_API_PORT=3010` matching its own `API_PORT` constant. Previously
   the api came up on the 8013 default while the launcher health-checked 3010
   (latent bug — the embedded launcher flow could never have worked as built).
7. `AGENTS.md` — session-ritual note: never export `ALLTERNIT_API_PORT=8013`
   unless deliberately replacing the installed app's gateway.

## How it works

The production port is claimed explicitly by each production launcher
(packaged Desktop already passed the env; Contabo and launcher now do too).
Everything else — `cargo run`, copied binaries, dev Electron spawns — falls
into the 18013 dev default and can coexist with the installed app. Dev and
packaged desktops can now run side by side on one machine.

## Verification evidence

- `cargo check -p allternit-api` — clean (71 pre-existing warnings).
- `cargo test -p allternit-api` — **1039 passed, 8 failed, 4 ignored**. All 8
  failures proven **pre-existing**, unrelated to this change:
  - `rails::tests::gate_data_plane_round_trip` — fails identically with the
    change reverted (stash test); panics on a `/plan` response field, nothing
    to do with ports.
  - 4× `agent_cloud_routes::tests::provision_*_through_real_os_control_plane`
    — fail identically with the change reverted.
  - 3 (`brain_routes` git round trip, `pages_api` frontmatter,
    `agent_routes` v143 backfill) — pass in isolation; full-suite flakes under
    parallelism.
- `cargo check -p allternit-platform-launcher` — clean.
- Desktop `npm run typecheck` (main + preload tsconfigs) — clean.
- `backend-manager.test.ts` — 4/4.
- `node scripts/release-preflight.mjs` — **35 passed, 0 failed** (AGENTS.md
  cites 26/0; the script has since grown to 35 checks).

## Incidents / honest deferrals

- **Desktop binary rebuild (ritual step 8) deferred pending Eoj go-ahead.**
  The change does not alter packaged-app runtime behavior (same 8013 pin, same
  reclaim), but swapping `/Applications/Allternit Desktop.app` restarts the
  app and would drop the live Fabric Transport relay session Eoj is using.
  DMG build from merged main is queued; install timing is Eoj's call.
- Shared checkout was on `ao/platform-console-agents` with uncommitted work
  from another session, so the ledger commit lands via a detached
  `origin/main` in the session worktree instead of the shared checkout.
- Dev Vite UI proxy wiring to 18013 intentionally out of scope: dev desktops
  can still talk to a running installed app on 8013, which is the common case.
- Contabo's currently-running unit is untouched until the next deploy runs the
  updated script.
