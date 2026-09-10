# Attestation — session/3a37a822-p5: sidecar production fixes (connector crash loop + stale voice binary)

- Date: 2026-09-10
- Session: 3a37a822 (kimi), phase 5
- Branch: `session/3a37a822-p5` → PR #244, merged as `a36a9e25cdf9e7c58e323df5344128263fbe0fed` (merge commit)
- Scope: `surfaces/allternit-desktop/`, `.github/workflows/release-desktop.yml`, `scripts/release-preflight.mjs`

## What was fixed

Two pre-existing sidecar bugs reported by the owner, both of which had to work
in production (CI included), not just locally:

1. **Connector sidecar crash loop.** Packaged app respawned the sidecar
   forever with `Cannot find package '@hono/node-server' imported from
   .../Resources/connector-sidecar/src/server/index.ts`. Root cause:
   `services/open-connector` is a standalone npm project (own lockfile,
   ~30 deps, no native modules), deliberately excluded from the pnpm
   workspace (`!services/open-connector` in pnpm-workspace.yaml), so no
   workspace install ever created its `node_modules`. Desktop package.json
   `build.extraFiles` copies `../../services/open-connector/node_modules`
   → `connector-sidecar/node_modules`; missing source = one-line
   electron-builder warning = crash loop at runtime. CI had zero
   open-connector references, so every CI-built release was broken the
   same way.

2. **Voice service shipping the pre-cleanup PyInstaller binary.** The
   bundled `allternit-voice-service` in the installed app was the old
   Python/PyInstaller tree (marker strings `_MEIPASS`/`pyi_rth` present),
   which crashes at boot on this machine's macOS 23.6 (`pyexpat
   .cpython-311-darwin.so ... built for macOS 26.0 which is newer than
   running OS`). Root cause was stale staging (copied from an old
   checkout's `resources/bin`), not the build scripts — CI builds the Rust
   crate correctly from a clean target.

## Changes (PR #244)

- `surfaces/allternit-desktop/scripts/prepare-connector-sidecar.cjs` (new):
  idempotent `npm ci` into `services/open-connector` (runs only when
  `node_modules/.package-lock.json` is missing or older than the lockfile;
  `shell: true` for the Windows npm.cmd shim), then hard-fails unless
  `@hono/node-server/package.json` resolves.
- `surfaces/allternit-desktop/package.json`: `prepare:connector-sidecar`
  script added; inserted into all four chains (`build:electron`,
  `build:electron:dmg`, `pack`, `dist`) right after `prepare:connector-catalog`.
- `.github/workflows/release-desktop.yml`: explicit
  "Install open-connector sidecar dependencies" step in all three
  packaging jobs (build-macos, build-windows, build-linux) before
  "Install desktop dependencies".
- `surfaces/allternit-desktop/scripts/verify-packaged-resources.cjs`:
  hard-fail when `services/open-connector/node_modules/@hono/node-server`
  is missing; new `isPyInstallerBootloader()` scan (first 64MB of the
  staged binary for `_MEIPASS`/`pyi_rth`/`PyInstaller`) that hard-fails
  with rebuild instructions when the staged voice binary is the stale
  Python bootloader.
- `scripts/release-preflight.mjs`: new `checkSidecarGuards` (check 7 in
  the header comment) — asserts every electron-builder job installs
  connector deps, all four package.json chains keep the prepare step, and
  both verify gates stay in place.

## Verification

- `node scripts/release-preflight.mjs` → **35 passed, 0 failed** (was 26/0
  before this change).
- Desktop vitest suite → **125/125 passed** (18 files).
- Clean worktree exercise: verify gate failed with the new connector-deps
  error before `prepare:connector-sidecar`; after `npm run
  prepare:connector-sidecar` (npm ci, 526 packages, 17s, postinstall
  regenerated the 1065-provider registry) both connector checks pass.
- PyInstaller detector sanity: returns `true` on the known-bad installed
  binary (`~/Desktop/Allternit-Desktop-fresh.app/.../allternit-voice-service`)
  and `false` on a fresh `cargo build --release -p voice-service` (3.6MB
  Rust binary).
- Installed-app repair from this build (voice swap + connector node_modules
  copy) is tracked separately — see the session closeout to the owner; the
  app still needs the owner to complete the "Get started" re-pairing left
  over from another session's wizard e2e (unrelated to this change).

## Honest notes / deferred

- The explicit CI step duplicates what the build chains now do anyway
  (they include `prepare:connector-sidecar`); it exists for earlier,
  clearer failure and to make coverage obvious. Harmless: the script is
  idempotent and skips the second `npm ci`.
- The Linux job's unpackaged smoke build ships without several sidecars
  (voice, whisper-cli, local-engine) by pre-existing design; it now at
  least installs connector deps, but it still does not publish artifacts.
- If the voice binary SDK mismatch is ever to be caught even earlier, CI
  could smoke-run `voice-service --version` after the cargo build; not
  added in this PR.
- `npm warn allow-scripts` flags `workerd@1.20260701.1` postinstall as
  not covered on this machine's npm config — pre-existing, unrelated to
  this change (the sidecar does not need workerd's install script).
