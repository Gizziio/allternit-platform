# openbot-remaining — bot_id seat, live watch, summaries (rq-20260910-001)

- **Date:** 2026-09-10
- **Agent:** grok
- **PR:** https://github.com/Gizziio/allternit-platform/pull/290 · merge commit `18ed1019bac5a84ce0d7b8275a69eee9ee2b4c14`

## What landed

- Computer-tool policy seat fills `bot_id` from a read-only computer lookup before eval; guest still never runs on deny.
- Watch strip claims view-only VNC (lowest priority vs pane/ACI); screenshot remains the fallback.
- Transcript tool rows fold into `N running · N done` plus last nodes.
- 48h+ messages collapse behind a one-line summary chip.
- Thread bell cycles all / mentions-only / muted.

## Verification

- `cargo test -p allternit-api --lib computer_control::tests::policy` → 4 passed
- vitest notify / session-chrome / subagent-tree / activity-rows / vnc claim → 16 passed
- GitHub Actions on #290: vitest, desktop typecheck/build, gitleaks, typography, SW cache bump — success

## Honest deferrals

Spawned-child tree with per-agent step checklists still needs a real subagent event feed.
