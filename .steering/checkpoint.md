# Steering checkpoint — session/b569de1d (kimi-code)

## Goal
Restructure the chat composer "+" sheet (ComposerPlusSheet) per owner direction:
remove unwired/dead controls and unused view rows, keep the endorsed rows, add
Plugins and Skills.

## Just did
- Removed: Style grid button + submenu + ResponseStyle plumbing; Tool access
  segmented control + ToolAccessLevel plumbing (both only injected prompt-text
  prefixes, never reached backend settings — owner directive); the composer
  Style chip; duplicate Connectors list row; Form Surfaces / Cowork Tasks /
  Bot Activity list rows (Form Surfaces and Cowork Tasks views had NO other
  entry point — now orphaned by design; Bot Activity remains reachable via
  /agent-activity routes, shell panel, and global event).
- Kept: Files, GitHub (+URL panel), Web, Project submenu, grid Connectors,
  Web search + Research toggles, Capture to brain, Permissions (value badge
  removed with toolAccess).
- Added: Plugins row → `allternit:open-view {viewType:'apps-extensions'}`;
  Skills row → `allternit:open-settings {section:'skills'}`.
- Verified: tsc typecheck project clean on touched files; vitest src/views/chat
  45 passed / 1 skipped. Puzzle→PuzzlePiece icon fix for installed phosphor
  version.

## Next
Commit, push, PR, merge, ledger attestation, cleanup. Desktop preview rebuild
deferred (note honestly in ledger) — source lands on main.
