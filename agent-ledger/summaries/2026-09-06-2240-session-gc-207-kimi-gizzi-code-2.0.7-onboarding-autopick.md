# Session summary: gizzi-code 2.0.7 release (onboarding auto-pick brain)

- **Session ID / Branch:** `session/gc-207` (worktree `allternit-session-gc-207`)
- **Agent:** kimi
- **Date:** 2026-09-06 22:40 local
- **Commits:** `7351779c2` (2.0.7 version bump, main), `19a7ba5e8` (pnpm-lock sync fix, main); tag `gizzi-code/v2.0.7` (annotated, re-created at `19a7ba5e8` after the lockfile fix)

## What was done

Shipped the onboarding auto-pick-brain change (merged earlier as `198c83e46`) as gizzi-code 2.0.7, replicating the 2.0.6 release flow (commit `c2e0d543c`).

- Version bump 2.0.6 → 2.0.7 in all five versioned spots: `cmd/gizzi-code/package.json`, `cmd/gizzi-code/cli-package/package.json`, `cmd/gizzi-code/cli-package/install/gizzi.rb`, `cmd/gizzi-code/packaging/debian/DEBIAN/control`, `cmd/gizzi-code/packaging/rpm/gizzi-code.spec` (+ spec %changelog entry).
- CHANGELOG: `## 2.0.7 — 2026-09-06` section with the onboarding change plus a Fixed section covering the `feature()` macro misuse in `gizzi auto` and the native-sessions `HARNESS_BY_ID` TS2552.

## Incidents and fixes

- First tag push's publish CI (run 34079394705) failed in Quality gates: `ERR_PNPM_OUTDATED_LOCKFILE` — commit `441ed7495` (native-sessions feature, merged via `c364d5c04`) added `@allternit/native-sessions: workspace:*` to `cmd/gizzi-code/package.json` without updating `pnpm-lock.yaml`. Fixed with a lockfile-only `pnpm install` (commit `19a7ba5e8`, also prunes a stale importers entry for the removed api-client dir), deleted and re-created the tag at the fix commit, publish CI (run 34079510660) then went green.

## Verification

- npm: `@allternit/gizzi-code@2.0.7` is `latest`; all five platform packages (`darwin-arm64/x64`, `linux-arm64/x64`, `win32-x64`) at 2.0.7.
- GitHub Release `gizzi-code/v2.0.7` has all 4 tarballs + windows zip + checksums.txt.
- Homebrew tap `Gizziio/homebrew-tap` commit `47c28e3` ("gizzi-code 2.0.7") — formula version + all four platform sha256s computed from the release assets.
- Owner machine: `brew upgrade gizzi-code` succeeded (gizziio/tap 2.0.6 → 2.0.7, sha256-verified by homebrew); `gizzi --version` → `2.0.7`.

## Outstanding work

- None. Owner's brain settings (`kimi-cli/kimi-for-coding`) untouched; `aliyun-qwen` key still broken (pre-existing, owner to re-key).
