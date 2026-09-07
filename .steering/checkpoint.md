# Steering checkpoint — session/term-xterm55

## Goal
Land the desktop code-mode terminal fixes from the interactive session on 2026-09-07:
typing dead in terminal tiles, garbled characters on fast input, text too spaced out,
Terminals tab removal from the chat composer (Console is the single entry), plus the
desktop main-process fixes (ESM `__dirname` shim, configurable API health timeout).

## Just did
- Attributed the shared checkout's 67 dirty files: 20 are ours, the rest are other
  sessions' in-flight work (bots views, agent API, nav, office suite). The shared
  checkout is live — another session committed the `'bot'` tile-source change while
  we were reading; our snapshot patch excludes it.
- Created worktree `allternit-session-term-xterm55` on `session/term-xterm55` from
  origin/main (792f20d4f), applied the 20-file patch cleanly.
- Re-applied the xterm dependency swap on top of upstream's pdfjs-dist bump
  (added @xterm/* 5.5.0 scoped addons, removed old xterm/* 5.3.0 packages).
- `pnpm install` running to reconcile pnpm-lock.yaml.

## Next
1. Build the platform in the worktree + run CodeSessionSidePane tests.
2. Three logical commits: (1) xterm 5.5 upgrade + ordered input queue + WebGL renderer,
   (2) terminal workspace in console drawer + composer tab removal + resize/font controls,
   (3) desktop main-process fixes.
3. Push, PR, merge --merge. Then ledger attestation on main + worktree cleanup.

## Open questions
- None. Work was already verified live in the desktop app (CDP: typing, ordered
  writes, WebGL letterSpacing normal).
