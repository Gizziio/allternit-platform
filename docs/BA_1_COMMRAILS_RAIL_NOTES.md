---
status: done
files_changed:
  - cmd/allternit-api/src/rails/mod.rs
  - surfaces/ai.allternit.com/src/lib/bots/commrails-store.ts
  - surfaces/ai.allternit.com/src/lib/bots/commrails-store.test.ts
  - surfaces/ai.allternit.com/src/lib/bots/commrails-visibility.ts
  - surfaces/ai.allternit.com/src/lib/bots/use-commrail-sections.ts
  - surfaces/ai.allternit.com/src/shell/ShellRail.tsx
  - docs/BA_1_COMMRAILS_RAIL_MAP.md
  - docs/BA_1_COMMRAILS_RAIL_TASK.md
  - docs/BA_1_COMMRAILS_RAIL_NOTES.md
deviations:
  - "agy (Claude Sonnet 4.6) started BA-1 then hit Antigravity individual quota. Kimi 5-hour and Codex until 2026-09-16 were already exhausted. Orchestrator finished BA-1 in this worktree."
  - "Visibility DTO is filled from the local CommRails peer registry (working/idle). machines/fabricDevices/needsYou arrays are empty this phase — ao-engine is not linked into allternit-api."
  - "Bots list in ShellRail still uses the live agent store (already not seed). Seed cards are removed from commrails-store persist. Sessions + Needs you panels are new RecentsPanel sections."
remaining:
  - "BA-0b crate rename is still uncommitted on this branch alongside BA-1."
  - "Live pane state from ao-engine (blocked vs idle) still needs the P5 HTTP bridge; peers only."
brain_updates:
  - "BA-1 implemented on ao/ba-0b-commrails (with BA-0b). GET /api/commrails/visibility alias /api/rails/visibility."
test_evidence:
  - "npx vitest run src/lib/bots/commrails-store.test.ts → 6 passed (seed drop, executor prefix, pane map, fetch fail empty, parse payload)"
---

# BA-1 notes — live CommRails rail

Seed "Deep Researcher / Code Reviewer / Writing Partner" sessions are gone. Persist merge drops those ids if they were already in localStorage.

`GET /api/commrails/visibility` (and `/api/rails/visibility`) returns `{ panes, machines, fabricDevices, needsYou }`. Panes come from `PeerRegistry::list()`. Fetch failure → Sessions panel copy "ao is not running", no throw.

Needs-you rows: operational `waiting_approval|waiting_input|blocked`, unread `wih:executor-*` mail threads, plus DTO needsYou. Bot rows show a "Needs you" hint from `useBotStatus`.
