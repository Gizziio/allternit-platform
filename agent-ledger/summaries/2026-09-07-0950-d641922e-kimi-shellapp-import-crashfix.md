# Session d641922e-hotfix2 — ShellApp missing import crash fix

**Date:** 2026-09-07 (~09:50 CDT)
**Agent:** kimi (main session d641922e continuation)
**PR:** #115 → merge SHA `1645e7048` (branch `session/d641922e-hotfix2`, commit `1880f263d`)

## What was done

Fixed a hard renderer crash on desktop boot: `ReferenceError: useAgentsWithSwarms
is not defined`, thrown inside `ShellAppInner` and caught by the React error
boundary, leaving the whole shell on the error screen.

Root cause: commit `e0922fa5a` ("bots: Phase 2 visibility layer", bots-p02
session) added this line to `surfaces/ai.allternit.com/src/shell/ShellApp.tsx:137`:

```ts
useSyncBotWatermarks(active.viewType, useAgentsWithSwarms().filter(isBot));
```

without importing `useAgentsWithSwarms`. Vite build does not typecheck, so it
shipped to main undetected.

Fix (one line): add the hook to the existing `'../lib/agents'` import
(`ShellApp.tsx:32`).

## Verification

- Observed the crash live in the desktop app log:
  `[Renderer] [REACT ERROR BOUNDARY] ReferenceError: useAgentsWithSwarms is not defined`
- `tsc --noEmit` after fix: 0 errors in ShellApp.tsx. Remaining errors are the
  known baseline (office-sheets-app/univerjs, TerminalWorkspace z-index — see
  deferrals).
- Runtime re-verification after rebuild documented below in session flow.

## Incidents

- None. Merge was clean (base `f45d278ef`, no conflicts).

## Honest deferrals

- `src/components/terminal-workspace/TerminalWorkspace.tsx` references
  `zIndex.drawerOverlay` and `zIndex.drawerModalBackdrop`, which do not exist on
  the layer scale (TS2551, suggests `dragOverlay`/`modalBackdrop`). Type errors
  only — at runtime zIndex resolves to `undefined` (default stacking), no crash.
  Left for the terminal-workspace session; flagged in PR #115 description.
