# openbot-subagent-tree — parent → child spawn cards (rq-20260910-001)

- **Date:** 2026-09-11
- **Agent:** grok
- **PR:** https://github.com/Gizziio/allternit-platform/pull/299 · merge commit `3192884a9c67845ace4263c460eb9484d908398e`

## What landed

Herald-style tree in the bot session watch strip. Spawn tools (`Task`, `Agent`, `delegate_task`, `spawn_subagent`, `message_agent`) open expandable child cards; later tools nest as steps with ✓/✗/spinner and duration. Header: `N running · N done · N actions · elapsed`. Stream adapter keeps `subagent_type` + description on the tool call.

The stream was already there (`onToolCall` → transcript). This PR is the nesting UI.

## Verification

- vitest: `bot-subagent-tree` + `chat-stream-adapter` → 11 passed
- GitHub Actions on #299: vitest, typecheck/build, gitleaks, typography, SW cache bump — success
