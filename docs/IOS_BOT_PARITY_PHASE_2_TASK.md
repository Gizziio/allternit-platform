# Phase 2 Task: Integrate bot event ledger, web bridge, and iOS bot parity

**Worktree:** `~/Desktop/allternit-workspace/allternit-session-ios-bot-parity`  
**Branch:** `session/ios-bot-parity`  
**Do NOT start Phase 3.**

## Background

Phase 1 cleaned the branch. The unique work is split into three areas:
- `feat(api): add durable bot event ledger` — `cmd/allternit-api/src/bot_event_routes.rs`, migration `V92__bot_events.sql`, etc.
- `feat(bots): bridge runtime events into web state` — `cmd/gizzi-code/src/runtime/services/agent-event-bridge.ts`, web `bot-events-api.ts`, `bot-activity-api.ts`, etc.
- `feat(ios): add native bot operations parity` — iOS `BotEventsClient`, `BotDesktopClient`, `AgentEventsClient`, Live Activities, etc.

## Scope

1. Review the Phase 1 commits and the current diff vs `origin/main`.
2. Find and fix incomplete wiring, TODOs, missing imports, or broken integrations across the three feature areas.
3. Ensure end-to-end flow:
   - API routes are registered and migrations are ordered correctly.
   - Gizzi runtime bridge posts events that the web API consumes.
   - Web stores/hooks display bot events/activity correctly.
   - iOS clients call the new API endpoints and render bot status/events.
4. Add or fix tests where the implementation has changed.
5. Run cheap syntax checks on changed TS/TSX/Rust/Swift files (no full builds/typechecks/dev servers).
6. Commit your changes in coherent commits and push to `origin/session/ios-bot-parity`.

## Constraints

- Stay in the provided worktree.
- Do not run builds, typechecks, or dev servers.
- Do not start unrelated feature work.
- Match existing repo conventions.
- Preserve all Phase 1 work.

## Deliverable

When finished, write `docs/IOS_BOT_PARITY_PHASE_2_NOTES.md` with this exact YAML frontmatter:

```yaml
---
status: done|blocked
files_changed:
  - path/to/file1
  - path/to/file2
deviations:
  - "what changed and why"
remaining:
  - "anything left for Phase 3"
---
```

Then add prose notes summarizing integration fixes, tests added, and current state.
