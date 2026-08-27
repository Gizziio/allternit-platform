---
status: done
files_changed:
  - cmd/allternit-api/migrations/V93__bot_events.sql
  - cmd/allternit-api/src/agent_routes.rs
  - cmd/allternit-api/src/bot_event_routes.rs
  - cmd/gizzi-code/src/runtime/services/agent-event-bridge.ts
  - surfaces/ai.allternit.com/src/lib/bots/bot-operational-state.store.ts
  - surfaces/ai.allternit.com/src/views/agent-hub/main/BotHubCard.tsx
  - surfaces/ai.allternit.com/src/views/bots/BotRosterItem.tsx
  - surfaces/allternit-mobile/ios/Core/API/Models/BotEvent.swift
  - surfaces/allternit-mobile/ios/Core/BotStatusStore.swift
  - surfaces/allternit-mobile/docs/platform-parity-roadmap.md
  - docs/IOS_BOT_PARITY_MAP.md
  - docs/IOS_BOT_PARITY_PHASE_2_NOTES.md
  - .steering/checkpoint.md
deviations:
  - "The bot ledger migration moved from V92 to V93 because origin/main already contains V92__agent_email.sql; duplicate refinery versions would prevent startup migration ordering."
  - "Runtime events are mirrored by the authenticated API ingest path instead of adding a second Gizzi HTTP request, keeping ownership checks and canonical event mapping server-side."
  - "Focused Vitest tests could not start because the worktree's existing Vitest symlink targets a missing package; dependencies were not installed under the no-build/no-expansion constraint."
remaining:
  - "Full Rust/Swift builds, typechecks, simulator/device validation, and a live runtime-to-web-to-iOS smoke test remain Phase 3 validation work."
---

# Phase 2 integration notes

The API now has a valid migration order and a single authenticated integration
point for runtime events. Agent run start/completion/failure plus Gizzi
permission, question, resolution, and blocking signals are mapped into the
canonical bot ledger consumed by the web activity and operational-state APIs.
The existing Rails event append remains intact for the iOS SSE feed. Runtime
retries use deterministic bot-ledger idempotency keys, and bot appends now
validate object payloads and serialize per-bot sequence allocation with an
immediate SQLite transaction.

The web status projection is no longer dormant: bot hub and roster cards use
the canonical status hook, which fetches immediately and refreshes every five
seconds. Cards render server status and attention state rather than relying on
the registry's coarse local status.

iOS continues to bootstrap from the server projection and stay live through
the agent SSE stream. Bootstrap now requests the newest event tail based on the
projection head instead of the oldest page, and reconnect replays are deduped
before they can duplicate feed rows or increment approval counts twice. Desktop
route/client models and Live Activity integration were traced against the API
contracts and required no additional Phase 2 changes.

Focused Rust tests were added for non-object payload rejection, dual-ledger
runtime ingestion, and retry idempotency. Cheap validation passed for all files
changed in Phase 2: Rust parsing through rustfmt emit, Swift parsing through
`swiftc -parse`, Bun parsing for TS/TSX, unique migration-version validation,
and `git diff --check`. No build, typecheck, or dev server was run. The existing
Vitest installation is incomplete in this worktree, so the focused web tests
could not be executed without installing dependencies.
