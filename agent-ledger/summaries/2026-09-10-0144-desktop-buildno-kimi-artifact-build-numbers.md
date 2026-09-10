# Agent Work Attestation — desktop/desktop-buildno

**Date:** 2026-09-10 01:44
**Session ID:** desktop-buildno
**Branch:** session/desktop-buildno
**Agent:** kimi
**Commit:** (merge commit bc71fdb94, PR #232)
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Owner-commissioned fix for "the binary version never changes — it's been 1.1.1
across plenty of builds": the desktop version field only moves on release
commits, so every local rebuild of the same commit produced identically-named
artifacts and a colliding latest-mac.yml.

- `surfaces/allternit-desktop/scripts/build-local.cjs` (new): local
  electron-builder launcher. Off-CI it sets
  `ALLTERNIT_BUILD_SUFFIX=-b<git rev-list --count HEAD>` (explicit env
  overrides; `""` = clean names even locally) and forwards all args.
- `build:electron`, `build:electron:dmg`, `pack`, `dist` invoke the wrapper.
- All four artifactName templates (dmg, AppImage, nsis exe, catch-all) expand
  `${env.ALLTERNIT_BUILD_SUFFIX}` → `Allternit-Desktop-1.1.1-b4177-arm64.dmg`.
- CI/release naming unchanged: wrapper skips under CI/GITHUB_ACTIONS;
  `release-desktop.yml` pins `ALLTERNIT_BUILD_SUFFIX: ""` for jobs that call
  electron-builder directly (Linux/Windows).
- BUILD.md documents the behavior and override.

## How it works

electron-builder expands `${env.NAME}` macros in artifactName at packaging
time; the wrapper controls the env. Release versions stay exactly as tagged
(commandment 1 unaffected); only local artifact filenames gain the build
number. No sidecar or workflow-build changes (commandment 3 n/a).

## Verification

- Commandment 2 (release-path change): `node scripts/release-preflight.mjs`
  → **26 passed, 0 failed** (run in the session worktree with the same
  resources/bin sidecar set as the known-good shared checkout).
- `node --check` on the wrapper; package.json parses; artifactName templates
  read back correctly via node.
- Post-merge live check: pending at write time — the next desktop-preview
  rebuild exercises the wrapper end-to-end; artifact name expected
  `-b<rev-count>` suffixed. (Recorded in DEFERRALS until confirmed.)

## Known gaps / remaining work

- Live packaging smoke of the suffixed name is deferred to the next local
  rebuild (electron-builder is not installed in ephemeral session worktrees;
  the desktop-preview worktree is the real local-build environment).
- buildVersion / CFBundleVersion is NOT stamped (electron-builder buildVersion
  has no env-macro support); artifact filenames + latest-mac.yml are the
  distinguishability surface. Revisit if in-app About must show build numbers.

## Files changed

- `surfaces/allternit-desktop/scripts/build-local.cjs` (new)
- `surfaces/allternit-desktop/package.json` (4 scripts + 4 artifactName templates)
- `surfaces/allternit-desktop/BUILD.md`
- `.github/workflows/release-desktop.yml` (env pin)

## Post-merge live check (confirmed)

Rebuild in `allternit-desktop-preview` from merged main (`aaf126903`): the
wrapper produced `release/Allternit-Desktop-1.1.1-b1741-arm64.dmg` (git height
1741), all six sidecars verified staged, `latest-mac.yml` references the
suffixed name. Prior unsuffixed 1.1.1 DMG retired after verification.
