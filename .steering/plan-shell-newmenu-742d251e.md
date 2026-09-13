# Plan — Desktop rail "+" menu fix (session/742d251e)

## Problem
The rail's New Session menu (NotePencil button) diverges from every other shell
menu and from the Anthropic/ChatGPT creation-menu pattern:
`p-1.5` vs `py-2`, `--shadow-xl` vs `--shadow-lg`, `z-[152]` vs `z-[165]`,
no entrance animation, no `overflow-hidden`, two-line label+description items,
no keyboard support, no menu in the collapsed rail, and two competing "new"
affordances (pencil menu vs rail `Plus` ⌘N action).

## Target behavior (modeled on Anthropic)
- One canonical `+` button (Phosphor `Plus`), present in expanded and collapsed
  rail; opens a compact creation menu.
- Menu rows: icon + single-line label. Items: New Chat, New Agent Session,
  Continue CLI Session (all already wired in `ShellApp.tsx` — handlers reused).
- Overlay matches sibling menus: `py-2 rounded-xl border-[var(--shell-menu-border)]
  bg-[var(--shell-menu-bg)] shadow-[var(--shadow-lg)] overflow-hidden z-[165]`
  + existing `submenuSlideIn` entrance animation.
- Interaction: outside-click close, Escape close, ArrowUp/Down (+Home/End) focus
  cycling, focus returned to trigger on close, aria menu roles.

## Files
- `ui/shell/FloatingWidgets.tsx` — replace hand-rolled popover with new primitive;
  add menu to collapsed rail variant (lines 86-162); Plus icon.
- New: `ui/shell/ShellMenu.tsx` (or nearest idiomatic location) — shared menu
  primitive used by the create menu.
- Do NOT touch release path (`surfaces/allternit-desktop/`, release workflow,
  prepare-*/notarize scripts) → no release-preflight needed per AGENTS.md rule 2.

## Verification
- Typecheck the `ui/` tree (repo convention; pnpm workspace has a known conflict —
  use the same command other ui sessions use, e.g. `npx tsc --noEmit` in `ui/`
  if that's the established pattern).
- Grep the built/lint result for the new component usage; manual smoke via the
  desktop preview rebuild is step 8 of the session ritual.

## Landing
Commit `feat(shell): ...` / `fix(shell): ...`, push `session/742d251e`,
`gh pr create` + `gh pr merge --merge`, sync main, ledger attestation
(`agent-ledger/summaries/2026-09-11-HHMM-742d251e-kimi-code-shell-newmenu.md`
+ LEDGER.md line), rebuild desktop preview from merged main, clean up worktree.
