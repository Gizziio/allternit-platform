# Session attestation — relfix-20260908 (kimi-code)

**Date:** 2026-09-08 · **Branch:** `session/relfix-20260908` → PR #156, merge `5c016d306`

## What

Fixed the desktop release pipeline breakage that failed desktop-v1.1.1
(run 34246845013: macOS/Windows/Linux all failed at "Install gizzi-code
dependencies").

Root cause: the workflow ran `bun install` in `cmd/gizzi-code`, and the
committed `cmd/gizzi-code/bun.lock` records workspace member paths from a
foreign checkout layout (`../../../../infrastructure/...`,
`../../sdk/allternit-sdk`, `packages/gizzi-util` relative to gizzi-code). On a
fresh clone bun cannot resolve the `@allternit/*` workspace deps:
"Workspace dependency not found — Searched in './*'". Desktop 1.1.0 predates
gizzi-code's workspace-backed deps (added with the computerUse subtree backing,
0a123b88d), so the step never ran against them until the v1.1.1 release.

Fix (all three build jobs in `.github/workflows/release-desktop.yml`):
- root `pnpm install --frozen-lockfile` (proven pattern from
  publish-gizzi-code-npm.yml) instead of `bun install` in cmd/gizzi-code
- added `pnpm --filter "@allternit/gizzi-code^..." run build` +
  `pnpm --filter "@allternit/gizzi-sdk" run build` so tsc-built workspace
  packages have their gitignored dist/ output before bundling

## Verification

In a fresh worktree, running exactly the CI commands:
`pnpm install --frozen-lockfile` clean; both filter builds clean;
`bun run script/build-production.js --target=darwin-arm64` produced a 180MB
binary containing the `native-session` routes (the strings missing from the
1.1.0 bundle). YAML validated.

## Release

After merge, re-pointed tag `desktop-v1.1.1` (force, was 08662465c) at merge
commit 5c016d306 → run 34279647474. Monitor cron reports outcome; the user
still needs to install the published DMG over /Applications.

## Cleanup

Worktree removed, branch deleted local + remote. Ledger entry appended.
