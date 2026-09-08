# Session attestation: settings-fix (kimi) — 2026-09-07 12:07

## What was done

Fixed the Electron renderer crash that was killing the desktop app at startup / on settings touch.

Root cause: `setPersistedValue` in `surfaces/ai.allternit.com/src/hooks/useSettingsState.ts` always wrote localStorage **and** dispatched `allternit:setting-changed`. The reader side (`useSettingsValue.reread()`) re-invoked the writer synchronously on that event path, so a single set fanned out into unbounded synchronous recursion → `Maximum call stack size exceeded`. The crash was reported at `useSettingsState.ts:28` (misleading top-of-stack mapping) and crash-spam-killed the desktop renderer 3× while the owner was trying to view the shell rail / bots UI.

Fix (minimal, two guards):
1. `setPersistedValue` bails early with `Object.is(resolved, prev) return prev` **before** `setItem` + `dispatchEvent` — unchanged values are true no-ops.
2. `useSettingsValue.reread()` tracks `lastAppliedRef` so a re-read that resolves to the already-applied value does not re-dispatch.

## How it works

The write path now only emits `allternit:setting-changed` when the persisted value actually changed, and the read path is idempotent against its own last-applied value. Cross-hook sync still works for real changes (writer dispatch → other readers reread), but there is no self-referential loop.

## Verification evidence

- New regression test `surfaces/ai.allternit.com/src/hooks/useSettingsState.test.tsx` — 3 tests asserting event dispatch counts (outside React `act`, the unfixed code storms ~2063 dispatches; fixed code emits exactly 1).
- `tsc --noEmit` on `surfaces/ai.allternit.com`: clean (re-run post-merge against latest main).
- Targeted vitest post-merge: 3/3.
- Full suite at authoring time: 1393 passed / 4 failed — `fabric-session-kind` (1, known pre-existing) + `bot-allternit-bus` (3, environmental), both confirmed pre-existing via stash.

## Incidents / notes

- Branch was cut from `origin/main` @ d58ff29f2; merged `origin/main` in before landing, checkpoint.md conflict resolved `--ours`.
- Merged via PR #126 → merge SHA e10ada617 (merge commit, per repo convention).

## Honest deferrals

- Full `bun run build` remains broken by another session's in-flight univerjs install (0.25.1 vs 0.21.1 alias mismatch) — not ours to fix, pre-existing.
- The preview worktree (`/Users/joe/altw/allternit-desktop-preview`) carries a PREVIEW-ONLY hardcoded univerjs alias patch in `vite.config.ts`; it must be preserved across pulls.

## Commits

- `65c7a7717` docs(steering): checkpoint for settings recursion crash fix
- `62aaf0b31` fix(settings): bail on unchanged persisted writes to stop reread recursion
- `4a35d08d8` Merge remote-tracking branch 'origin/main' into session/settings-fix
