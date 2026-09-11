# Steering checkpoint — session/742d251e (kimi-code)

## Goal
Fix the Allternit Desktop rail "+" (New Session) menu to match the Anthropic/ChatGPT
creation-menu pattern: one canonical `+` entry point (expanded + collapsed rail),
compact icon + single-line rows, and an overlay consistent with the shell's other
menus (tokens, shadow, z-index, entrance animation, keyboard support).

## Just did
- Gap analysis of `ui/shell/FloatingWidgets.tsx:193-221` create menu vs sibling
  menus (`ProjectRailSection.tsx`, `SettingsDrilldown.tsx`) and vs Anthropic's
  pattern (research: claude.ai sidebar + = compact New chat/New project rows;
  Claude desktop = Chat/Cowork/Code session-type entries; composer + = icon rows).
- Created session worktree `allternit-session-742d251e` on `session/742d251e`
  from `origin/main` (1e52b9ea7).
- Implemented: shared `ShellMenu` primitive + rewired create menu (Plus button,
  icon + single-line items, collapsed-rail support). Typecheck clean on touched
  files; FloatingWidgets vitest 6/6. Committed, pushed, PR #335.
- Merged origin/main (checkpoint.md conflict with session/dmp1-0911's stale
  checkpoint resolved in favor of this session — dmp1's work is merged + attested).

## Next
- Merge PR #335; sync main; ledger attestation; desktop preview rebuild; cleanup.

## Open questions
- Whether to add a "New Project" row (Anthropic lists projects): deferred — the
  shell has no existing create-project handler to wire; noted for a future pass.
