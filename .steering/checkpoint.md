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

## Next
1. Shared shell menu primitive (Escape/arrows/outside-click/focus return,
   sibling-consistent tokens + submenuSlideIn animation).
2. `+` (Plus) button in expanded AND collapsed rail; menu items become
   icon + single-line: New Chat / New Agent Session / Continue CLI Session.
3. Typecheck, commit, push, PR, merge, ledger attestation, desktop preview rebuild.

## Open questions
- Whether to add a "New Project" row (Anthropic lists projects): only if the shell
  already exposes a create-project handler; otherwise out of scope for this pass.
