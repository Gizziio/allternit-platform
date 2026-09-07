# Steering checkpoint — session/term-font

## Goal
Change the xterm terminal font to the desktop standard: SF Mono (macOS
Terminal.app's regular face), keeping brand/system fallbacks. Owner asked to
merge only our changes without overwriting other sessions' work.

## Just did
- Worktree `allternit-session-term-font` on `session/term-font` from origin/main
  (53f4a8a4c).
- Replaced `fontFamily: 'var(--font-mono)'` with an explicit
  `"SF Mono", "Allternit Mono", SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  stack in the three xterm constructors (UnifiedTerminal TerminalSurface,
  NodeTerminal, TerminalCanvas). The CSS var never parsed in canvas font
  measurement anyway.

## Next
1. pnpm install + platform build + CodeSessionSidePane vitest.
2. Commit, push, PR, merge --merge. Ledger attestation. Cleanup.
3. Mirror the same 3-line edit into the shared checkout's working tree (our
   dirty files only) and rebuild `dist` so the owner's desktop app picks it up.

## Open questions
- None.
