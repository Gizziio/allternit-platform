# Agent Work Attestation — desktop/desktop-buildversion

**Date:** 2026-09-10 02:28
**Session ID:** desktop-buildversion
**Branch:** session/desktop-buildversion
**Agent:** kimi
**Commit:** (merge commit 2f0b9f22a, PR #236)
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Owner-commissioned follow-up to PR #232: put the build number inside the
binary and on screen, not just in artifact filenames.

- `scripts/build-local.cjs`: alongside the artifact suffix it now passes
  `-c.buildVersion=<version>.<git-height>` (CFBundleVersion on macOS,
  FileVersion on Windows) and writes `resources/build-info.json`
  (version / buildVersion / buildSuffix / builtAt).
- `package.json`: `extraResources` packs `build-info.json` next to the
  sidecars. On CI/release builds (wrapper skips) the file is absent and the
  entry degrades to the same warn-level "file source doesn't exist" note as
  the existing `build/LICENSE.txt` entry (commandment 5 verified — warn, not
  fail).
- `unified-main.ts`: `app:get-info` returns `buildInfo` (null when absent).
- `preload/index.ts`: `getInfo` return type extended.
- `SettingsView.tsx` About panel: replaced the stale hardcoded `v0.9.1-beta`
  with the real identity — `Allternit Desktop 1.1.1-b4177 · build 1.1.1.4177`
  in the desktop shell via `window.allternit.app.getInfo()`, `Allternit (web)`
  elsewhere.

## How it works

electron-builder stamps buildVersion into the macOS Info.plist and Windows
PE metadata at packaging time; the same data reaches the renderer through a
JSON resource the main process reads from `process.resourcesPath`. CI builds
skip the wrapper → no buildVersion arg, no build-info.json → About shows the
plain version. Four-component CFBundleVersion (1.1.1.4177) is within Apple's
allowed format.

## Verification

- Commandment 2 (release-path change): `node scripts/release-preflight.mjs`
  → **26 passed, 0 failed**.
- Desktop `tsc` (main + preload): zero errors in touched files; the one
  session-worktree error (missing `@types/ws` in auth-manager.ts) is a
  plain-`npm install` artifact — the pnpm-installed worktree typechecks the
  same baseline at exit 0.
- `node --check` on the wrapper; package.json parses.
- Post-merge live check: pending at write time — next desktop-preview rebuild
  should show `CFBundleVersion 1.1.1.<height>` in the app plist and
  `build-info.json` in Contents/Resources. (Recorded in Post-merge section
  below when confirmed.)

## Known gaps / remaining work

- About panel visual confirmation is manual (renderer string is data-driven
  from the verified getInfo path; screenshot verification left to the owner).
- Linux release job calls electron-builder directly (no wrapper), so Linux
  release artifacts keep default buildVersion = version — consistent with
  the clean-names policy.

## Files changed

- `surfaces/allternit-desktop/scripts/build-local.cjs`
- `surfaces/allternit-desktop/package.json` (extraResources entry)
- `surfaces/allternit-desktop/src/main/unified-main.ts` (app:get-info buildInfo)
- `surfaces/allternit-desktop/src/preload/index.ts` (getInfo type)
- `surfaces/ai.allternit.com/src/views/settings/SettingsView.tsx` (About panel)
- `surfaces/allternit-desktop/BUILD.md`

## Post-merge live check (confirmed)

Rebuild in the long-lived preview worktree on merge `5f8bd7218` (2026-09-10):

- DMG: `release/Allternit-Desktop-1.1.1-b1765-arm64.dmg` (+ blockmap)
- `Info.plist`: `CFBundleVersion = 1.1.1.1765` (four-component stamp),
  `CFBundleShortVersionString = 1.1.1` unchanged
- `Contents/Resources/build-info.json`:
  `{ "version": "1.1.1", "buildVersion": "1.1.1.1765", "buildSuffix": "-b1765", "builtAt": "2026-09-10T07:32:55.657Z" }`
- Superseded `Allternit-Desktop-1.1.1-b1741-arm64.dmg` (+ blockmap) removed.
- About panel string ("Allternit Desktop 1.1.1-b1765 · build 1.1.1.1765")
  is data-driven from the verified getInfo path; visual confirmation manual.
