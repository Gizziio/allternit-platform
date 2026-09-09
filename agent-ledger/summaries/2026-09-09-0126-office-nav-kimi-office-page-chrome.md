# Session office-nav — Office page chrome (Back/Home) — 2026-09-09

Agent: kimi-code (subagent, agent-22) · Branch: `session/office-nav` · PR #191 → merge `999c706b0`

## What was done

Owner-reported gap in the desktop app (serves the platform SPA at 127.0.0.1:8013): opening an
office document (`/docs`, e.g. "Untitled.docx") replaced the whole UI with the editor and there
was no UI affordance to get back to the app home — "cant go back to main screen there is no ui
way to go" / "we are supposed to have the floating widgets icons in the top left".

Root cause (diagnosed up front, not re-investigated): the office routes are top-level routes in
`surfaces/ai.allternit.com/src/routes.tsx` rendering standalone pages outside the shell. The
shell chrome — `RailControls` in `src/shell/FloatingWidgets.tsx` (`fixed top-0 left-0 z-[150]`,
traffic-light clearance 72px) — only mounts inside `ShellApp`, so office pages had zero chrome.

Fix: new `src/shell/OfficePageChrome.tsx`, a slim 44px docked chrome bar with:

- **Back** (`CaretLeft`) — `window.history.back()` when `window.history.state.idx > 0`,
  otherwise disabled (re-renders on `popstate` to track the idx counter).
- **Home** (`House`) — `navigate('/')`.
- RailControls visual language replicated from `TitleBarButton` (that symbol is not exported;
  `FloatingWidgets.tsx` deliberately untouched), same `isElectronShell()` traffic-light
  clearance (72 Electron / 4 web), `[WebkitAppRegion:no-drag]` on buttons, drag region across
  the rest of the bar for the frameless Electron window.

Mounted in the five standalone office page components: `DocsPage`, `SheetsPage`, `SlidesPage`,
`PdfPage`, `OfficeLauncherPage` (pages switched to flex-column layout; editors size to their
container, no editor layout changes).

### Deviation from the delegated design (deliberate, verified)

The delegation proposed a `fixed top-0 left-0 z-[150]` floating row. Verification against the
built SPA proved that cannot satisfy the no-overlap requirement: the vendored editors always
render their File ribbon tab at x=84–130 on macOS (`ribbon-tabs-mac` padding; the File tab is
present in every environment because `installDesktopBridge` always sets
`__allternitBrowserBridge`), so a floating pill at `marginLeft: 72` would cover it. Docked the
bar in normal flow instead — no overlap by construction on all four editors. Flagged in the PR
body.

## Files changed

- `surfaces/ai.allternit.com/src/shell/OfficePageChrome.tsx` (new)
- `surfaces/ai.allternit.com/src/shell/OfficePageChrome.test.tsx` (new, 5 tests)
- `surfaces/ai.allternit.com/src/pages/{Docs,Sheets,Slides,Pdf,OfficeLauncher}Page.tsx` (mount + flex layout)

Explicitly untouched per concurrency constraints: `src/views/office/` (agent-20,
session/suite-assistant-fix), `src/views/docs|sheets|slides/`, `src/shell/FloatingWidgets.tsx`.

## Verification

- `pnpm run typecheck` (surfaces/ai.allternit.com): pass (fresh worktree, pnpm install first).
- `vitest run src/shell`: 4 files / 20 tests pass (incl. 5 new OfficePageChrome tests).
- `pnpm run build`: pass.
- Playwright (playwright-core from /tmp/pwtest, chromium-1234) against the fresh `dist/`
  served locally with SPA fallback on :8323: `/office` and `/docs` both render
  `[data-testid=office-page-chrome]` with Back(disabled at root)+Home; clicking Home on `/docs`
  navigated to `/`. Screenshots: `/tmp/office-chrome-launcher.png`, `/tmp/office-chrome-docs.png`,
  `/tmp/office-chrome-home.png` (scratch; confirm docked bar clears the docs ribbon File tab).
- Pre-existing noise on bare static serve: Clerk script-load failure (no Clerk keys) — unrelated.
- The desktop gateway at 127.0.0.1:8013 serves the previously packaged export; the change is
  visible there only after the next desktop repackage (same situation the suite-assistant-fix
  session documented).

## Incidents / notes

- PR #191 initially conflicted twice as other sessions merged to main (#188 suite-assistant-fix,
  #190 50d4cec6); resolved by merging origin/main in — both times the only conflict was the
  shared `.steering/checkpoint.md` (resolved keeping this session's checkpoint).
- First Playwright run hit a phantom `:8322` bind (killed) and a python http.server heredoc that
  didn't survive the shell call; final check used a script file + background task on :8323.

## Deferrals

- No main-nav "Office" entry: owner explicitly rejected that direction mid-task.
- Floating (non-docked) placement: infeasible without overlapping editor chrome (see above);
  revisit only if the vendored ribbons grow real titlebar clearance on standalone routes.
- Desktop repackage to surface the fix at 127.0.0.1:8013: not done here (packaging is a
  separate session's lane).
