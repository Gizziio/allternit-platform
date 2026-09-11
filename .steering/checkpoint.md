# Checkpoint — fabric-pwa-bot-mode-ui (Phase 1C)

## Goal
Execute `docs/FABRIC_PWA_BOT_MODE_PHASE_1C_TASK.md` exactly. Preserve 1A/1B.
No git. No deploy. Do not start past 1C.

## Just did
- Fold adapter + tests; PWA view switch, Bots roster, BotsChatPage;
  BotChatSessionView transcript/composer swap; ACI watch-to-pull;
  GIZZI PWA section; smoke script.
- Verification: vitest 53/53, tsc 0 errors, release-preflight 35/0.
- PWA smoke SKIP (this worktree Vite has no Clerk; :3013 is a sibling
  worktree). NOTES `status: done`.

## Next
- Orchestrator: review + merge. Nothing past 1C.

## Open questions
- Live 390×844 smoke needs Clerk keys on this worktree. Not a code gap.
