# BA-1 Live CommRails rail — map

**Do not start BA-3+.** BA-0b crate rename is already in this worktree (uncommitted). Preserve it. Do not `git mv` anything back to `rails/`.

## Goal

The Desktop CommRails left rail shows **real** bots, sessions, needs-you, and executor mail — not the seed "Deep Researcher / Code Reviewer / Writing Partner" cards.

## Current (after BA-0b)

- Store: `surfaces/ai.allternit.com/src/lib/bots/commrails-store.ts` — Zustand + persist, **hard-coded `SEED_BOT_SESSIONS`**, `getSections()` returns only Bots + Groups.
- Types: `commrails-types.ts` — `CommRailSectionType = 'bots' | 'groups' | 'sessions' | 'swarms' | 'automation'`. Status must come from server `BotOperationalState`.
- Roster: `use-unified-roster.ts` — live native + stacked bots.
- Operational state: `bot-operational-state.store.ts` — server projection; statuses include `idle|working|waiting_input|waiting_approval|blocked|offline|…`.
- Mail: `commrails-mail.store.ts` — real `/api/rails` (alias `/api/commrails`) mail; `BotInboxView` + `ShellRail` already read it.
- Shell: `src/shell/ShellRail.tsx` imports mail store; bots rail wiring lives around there and `ViewRegistry.tsx` (`useUnifiedRoster`).
- ao visibility (P5) is a **Rust TUI feed** (`infrastructure/executor/ao-engine/src/ao/visibility/`, `client/visibility_feed.rs`): `agent.list` every 2s, waiting-on-you list, native sessions, CommRails peers. There is **no** first-class web HTTP DTO yet.

## What to implement

### 1. Kill seed data

Remove `SEED_BOT_SESSIONS` and default `activeBotSessions` to `[]`. Persist key `allternit-comrails` may still hold old seed — on hydrate, drop items whose ids start with `bot-session-deep-researcher|bot-session-code-reviewer|bot-session-writing-partner`.

Keep persist section ids `comrails-bots` / `comrails-groups` (BA-0b left those on purpose).

### 2. Bots section — live roster + operational state

`getSections()` (or a React hook `useCommRailSections` if the store cannot call other hooks) builds the Bots section from:

- `useUnifiedRoster()` for identity (id, displayName, accent, handle)
- `useBotOperationalStateStore` for `status` — **never infer** from busy flags
- Map ao pane states if a session row is joined: `working→working`, `blocked→waiting_input`, `idle→idle`

Do not add a second ao chrome island. This is the rail.

### 3. Sessions section — ao visibility, empty if down

Add a `sessions` `CommRailSection`. Client:

- Try `GET http://127.0.0.1:8013/api/commrails/visibility` **and** the `/api/rails/visibility` alias.
- If 404/network error: section still renders with title "Sessions" and a single quiet empty item: "ao is not running" (Register 1, no alarm).
- If the route does not exist yet, **add a thin read-only handler** on the existing `rails_router()` in `cmd/allternit-api/src/rails/mod.rs` (keep internal module name) that:
  - Returns `{ panes: [{id,label,state: "working"|"blocked"|"idle"}], machines: [], fabricDevices: [], needsYou: [{id,label,reason}] }`
  - Best-effort: if you can read `.allternit/peers/registry.json` from the api process cwd / `ALLTERNIT_COMMRAILS_ROOT` / `ALLTERNIT_RAILS_ROOT`, fill peers as panes with `idle`.
  - Do **not** link the herdr/ao-engine crate into allternit-api this phase if that is a large dep tangle. Empty arrays + honest empty copy is acceptable when ao is down.
- Join key when both bot.brain.nativeSessionId and a pane id exist: same row, do not duplicate.

### 4. Needs-you

A rail section or a badge on Bots rows (not a new top-level nav):

- Operational status `waiting_approval` / `waiting_input` → "Needs you"
- Mail threads whose id starts with `wih:executor-` and are unread
- `needsYou` from the visibility DTO when present

Approve/deny: reuse existing Gate / mail decide hooks (`railsApi` decide, or the bot approval path already in Bot chat). Do not invent permission keys.

### 5. Mail

When loading inbox/threads, keep `wih:executor-*` threads in the same inbox. Do not filter them out. `BotInboxView` should list them.

### 6. Tests

Vitest next to the store:

- No seed names after init/hydrate
- Bots section items come from roster fixture, status from operational-state fixture
- Visibility fetch failure → empty sessions section, no throw
- Executor thread prefix `wih:executor-` is included in a mail-thread fixture

## Out of scope

- BA-3 brain bind field
- PWA (BA-4)
- Policy UI (BA-5)
- Computer-orgo (BA-6)
- UHP (BA-7)
- `client.bots` SDK (BA-8)
- git commit / push / PR
- New product name / Runtime

## Files (expected)

- `surfaces/ai.allternit.com/src/lib/bots/commrails-store.ts` (and possibly a new `use-commrail-sections.ts`)
- `surfaces/ai.allternit.com/src/lib/bots/commrails-types.ts` if sections need a sessions item shape
- `surfaces/ai.allternit.com/src/lib/bots/commrails-store.test.ts` (new)
- `surfaces/ai.allternit.com/src/shell/ShellRail.tsx` only if the rail does not already render `getSections()`
- `cmd/allternit-api/src/rails/mod.rs` (+ maybe a small `visibility.rs`) for the read-only DTO
- `cmd/gizzi-code/...` — do not touch unless rails-bridge is required (it is not)
