# Session attestation — desktopfix-0912 phase 2 (initializeApp race)

- **Agent:** kimi-code (interactive session with Eoj)
- **Date:** 2026-09-12 23:58 local
- **PR:** #457 (merged 2026-09-12, merge commit `3a53730ebf189dfa4c89f2ad523af04f1fe65d0a`)
- **Branch:** `session/desktopfix-0912`

## What was done

Root-caused and fixed the actual source of tonight's repeated "app not
rendering" failures during the b2457 install attempts: on macOS,
`app.on('activate')` fires on **every** launch (not just dock clicks). When it
landed before the startup window existed (window count 0), it invoked
`initializeApp()` a second time while the `whenReady()` run was still in
flight. Two concurrent `initializeBundledMode` passes fought over the
singleton BackendManager:

- five `allternit-api` spawn/kill/re-spawn cycles in 20s on :8013 (observed
  live at 23:35),
- the startup window destroyed mid-boot ("Object has been destroyed"),
- 'allternit-api did not start within 30s' wedges; with #453's fix in place
  the app then showed the dialog and quit cleanly instead of becoming a
  zombie.

This race also explains the earlier "first-launch static miss" observations —
concurrent spawns raced the `ALLTERNIT_PLATFORM_STATIC` env resolution.

**Fix:** all entry points (`whenReady`, `activate`) route through
`initializeAppOnce()` — one shared in-flight promise, reset via `.finally()`
after settling so a later dock-click with no windows still re-initializes
(original revival behavior preserved).

## Verification evidence

- Desktop `npm run typecheck` (main + preload) — clean (re-run after rebase
  onto current main, which included the #455 tartenv merge).
- `backend-manager.test.ts` — 4/4.
- `node scripts/release-preflight.mjs` — 35 passed, 0 failed.
- Full `build:electron:dmg` pipeline completed with
  `verify-packaged-resources` all-green (platform static rebuilt from the same
  tree — fixing the chunk-mismatch error boundary that the previous
  copy-resources shortcut caused).

## Incidents / honest deferrals

- **Accidental merge of #455** (session/tartenv-0912, another session's PR):
  during a macOS TCC Desktop-permission revocation, an argument-less
  `gh pr merge` picked the newest open PR and merged it. It was a finished,
  mergeable PR; flagged to Eoj and noted in #457's body. No revert performed.
- The first attempt at this commit was pushed from a detached HEAD and
  orphaned (push pushed the stale local branch ref instead); recovered via
  reflog (`d02084b14`) and cherry-picked onto the rebased branch.
- macOS revoked Desktop folder access for the agent host process **twice**
  tonight, both mid-session. If this recurs, investigate what is resetting the
  TCC grant (suspect: concurrent sessions/assistants triggering prompts).
- Desktop rebuild + install of the race-fixed build happened after this
  attestation in the same session.
