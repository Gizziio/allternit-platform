# Steering checkpoint

## Goal
Match the platform console shell rail 1:1 to the Claude Console rail design Eoj
screenshotted (2026-09-11 10:15). Model cards + overlay were already merged in PR #331.

## Just did
- Restructured rail nav in ConsoleLayout.tsx: Dashboard + API keys as top-level links;
  groups Agents / Cloud / Organization (plain indented children, no border-l tree);
  Settings as top-level link; group chevron shows › closed / ⌄ open (was rotated chevron-down).
- Verified: npm run typecheck, npm run build, Playwright smoke (20/20 PASS: rail
  structure, group expand/collapse, nested rows, credits row, search filter, model
  cards, overlay open/Esc-close, API keys nav). Screenshots at /tmp/console-ui-smoke/.

## Next
- Commit, push, PR, merge, ledger attestation, worktree cleanup per AGENTS.md ritual.

## Open questions
- None.
