# Checkpoint — fabric-pwa-bot-mode-ui (Phase 1C reviewed)

## Goal
Ship approved spec `fabric-pwa-bot-mode-ui` (rq-20260910-007): shared bot-chat
components + Fabric Transport PWA bots surface + web adoption + ACI watch-to-pull.

## Just did
- Phases 1A–1C implemented and reviewed (commits 63e9cb96e, 875d8ed1f, fb54110a2).
- Merged origin/main into this worktree. Resolved BotChatSessionView to keep
  BotTranscript/BotComposer plus main's PolicyGovernance and session-status chrome.

## Next
- Push `ao/fabric-pwa-bot-mode-ui` and open the PR.
- Do not merge until the PR is up; land/ledger is a separate step.

## Open questions
- Live 390×844 smoke still needs Clerk keys on this worktree.
- Approval answers are local fold only (server has no option sets / grantKey).
