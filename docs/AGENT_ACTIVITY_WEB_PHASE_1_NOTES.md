---
status: complete
files_changed:
  added:
    - surfaces/ai.allternit.com/src/views/agent-activity/AgentActivityListView.tsx
    - surfaces/ai.allternit.com/src/views/agent-activity/AgentActivityDetailView.tsx
    - surfaces/ai.allternit.com/src/views/agent-activity/AgentActivityPanel.tsx
    - surfaces/ai.allternit.com/src/pages/AgentActivityListPage.tsx
    - surfaces/ai.allternit.com/src/pages/AgentActivityDetailPage.tsx
  modified:
    - surfaces/ai.allternit.com/src/views/mail-monitor/monitor.helpers.ts
    - surfaces/ai.allternit.com/src/routes.tsx
    - surfaces/ai.allternit.com/src/shell/FloatingWidgets.tsx
    - surfaces/ai.allternit.com/src/shell/ShellApp.tsx
  deleted:
    - surfaces/ai.allternit.com/src/shell/ConversationMonitorOverlay.tsx
    - surfaces/ai.allternit.com/src/views/mail-monitor/ConversationMonitorPanel.tsx
deviations:
  - "archive() really takes (threadId, path, reason) — it reads as 'release a reserved path,' not 'hide this thread from my inbox.' We still call the real endpoint on Archive/Unarchive, but the Review/Archived tab filter is driven by a localStorage marker (agent-activity:archived-thread-ids) since the server has no thread-level archived flag to read back."
  - "Guard/reservation/review detection is a heuristic substring match on LedgerEvent.event_type (/guard/i, /reserve/i, /review/i, /decide/i) — payload is typed `unknown` and no documented event_type vocabulary was found in the frontend types or in a quick pass over the rails crate. This is read-only surfacing, not a guaranteed status field."
  - "Status is simplified to three real states (review / active / archived) instead of the mockup's five (review/working/done/idle/blocked) — there's no reliable signal in the real data model for 'working' vs 'done' vs 'idle' at the thread level."
  - "No sheet/drawer primitive exists in this codebase for shell-chrome overlays (checked: ConsoleDrawer is hardcoded to a single bottom 'console' drawer scoped to the Code view; Dialog is a centered Radix modal). AgentActivityPanel hand-rolls a slide-over the same way the retired ConversationMonitorOverlay/SearchOverlay already did, just positioned top-right per mockup-v3.html instead of centered."
  - "Bell icon lives in FloatingWidgets.tsx's RailControls (top-left title bar, next to Search) rather than ShellHeader.tsx's badge-count 'Automation Hub' button, which was the closer visual precedent. Reason: ShellHeader.tsx is not mounted anywhere in the live app — it's only ever rendered from ShellHeader.stories.tsx. Wiring into it would not have produced a real, discoverable entry point."
  - "Retired ConversationMonitorOverlay.tsx and ConversationMonitorPanel.tsx outright (confirmed zero remaining references after rewiring ShellApp) rather than leaving them alongside the new components."
  - "Typecheck/lint/build could not be run: this checkout has no node_modules anywhere (surface package or monorepo root), and a full pnpm install across this workspace's many packages wasn't attempted given size/time constraints. Verified instead via `bun build --external '*'` per touched file (parses/transpiles cleanly, catches syntax errors) plus manual cross-referencing of imports/types against neighboring files. This is a lower bar than a real typecheck — see Remaining."
remaining:
  - "Run a real `pnpm install` + `pnpm typecheck` + lint once dependencies can be installed, and fix whatever the type checker finds beyond what manual review caught."
  - "Smoke-test in a running dev server: open /agent-activity, /agent-activity/:threadId, the bell panel, and ⌘⇧M, against a live Rails Mail backend with real threads."
  - "ShellApp, AgentActivityPanel, and the list/detail pages each call useMonitorThreads()/useMonitorData() independently with no shared cache — three live surfaces open at once triples the inbox/ledger fetch traffic. Fine for phase 1; a shared query cache (react-query, already a dependency) would be the natural fix if this becomes a real cost."
  - "Noticed but did not chase down: the frontend calls `POST /api/rails/mail/inbox` with a JSON body, but rails/src/service.rs registers `GET /v1/mail/inbox`. There may be a gateway translation layer I didn't trace; worth confirming before relying on inbox data in production."
  - "/mail/share/:shareId is still not a registered frontend route — buildMonitorLink still points share links there. Only the monitor path was named in this task's scope (item 8), so I left the share path as-is; it was already broken before this phase."
---

## The panel/page split (confirming it's a real route, not a modal)

The product-owner feedback this phase exists to fix was specific: *"I don't like how the drill-down is in the modal."* Concretely, that means:

- `AgentActivityListView` is one component with a `variant: 'panel' | 'page'` prop (mirrors `AutomationTasksView`'s `initialTab` pattern) — it renders rows only, no accordion/expand state. Clicking a row always calls `useNavigate('/agent-activity/' + threadId)` (via an `onNavigateThread` prop the panel supplies to also close itself first). There is no in-panel "expand to see more" state anywhere in this component — a one-line preview is genuinely all the row shows.
- `/agent-activity` and `/agent-activity/:threadId` are real entries in `routes.tsx`, lazy-loaded exactly like every other route (`GoalsListPage`/`GoalDetailPage` pattern), each a thin wrapper page around a real view component. `AgentActivityDetailPage` uses `useParams<{ threadId: string }>()` and renders `AgentActivityDetailView`, which owns full message history (no height cap), the typed review-decision card, reservation/guard cards, and archive/share/reply actions — none of that content exists anywhere inside the panel.
- `AgentActivityPanel` (the bell-icon slide-over) is a *separate* component from the detail page. It renders `AgentActivityListView variant="panel"` plus a keyboard layer (`j`/`k`/`Enter`/`1`/`2`/`a`/`Esc`) scoped to `open`. Pressing `Enter` (or clicking a row) closes the panel and navigates to the real page — it never renders thread content itself.
- The old `Ctrl/Cmd+Shift+M` shortcut (`ShellApp.tsx`) now toggles `AgentActivityPanel` instead of the retired `ConversationMonitorOverlay`. I judged "open the quick panel" (not jump straight to `/agent-activity`) closer to the original shortcut's intent — it's the discoverable-quick-glance entry point the map doc describes, and `Enter`/click gets you to the full page in one more keystroke.

Net effect: there is exactly one place full thread content renders (the routed detail page), and two places you can launch it from (panel row click, or the shortcut → panel → Enter).

## What reservation/guard data actually looked like, once queried for real

The map doc's claim — `useMonitorData`'s `relevantEvents` (`ledgerEvents` filtered by `payload.thread_id`/`mail_thread_id`) is the real mechanism — held up. What it does *not* give you, which the mockup assumed:

- **No structured reservation object.** The mockup's `reservation: { paths: [...], ttl: "9m left" }` doesn't exist. `LedgerEvent.payload` is typed `unknown`, and I found no documented `event_type` vocabulary in the frontend types or in a quick pass over the `rails` crate. So reservation/guard context in `AgentActivityDetailView` is rendered generically: any relevant event whose `event_type` matches `/guard/i` or `/reserve/i` gets a read-only card showing the raw `event_type`, relative time, and whatever plain key/value pairs are on its payload (minus `thread_id`/`mail_thread_id`). It's honest about being "here's the raw event," not a polished "3 paths reserved, 9m left" summary.
- **No allow/deny signal on guard events.** The mockup's blocked-status treatment ("⛔ Denied: write to X — path reserved by Y") assumes the payload always says *why* and *whether* it was denied. I can't tell allow from deny from an `unknown` payload without a known schema, so I don't claim a thread is "blocked" — I just surface "guard activity" as a tag/card and let the human read the raw payload.
- **`useMonitorData`'s existing `.slice(-4).reverse()` window is real and I kept it** — both the detail view and the heuristic review/guard/reservation derivation only see a thread's last 4 relevant ledger events. That's an existing constraint I extended rather than one I introduced.
- **Threads themselves have almost no shape.** `MailThread` is `{ thread_id, topic, created_at }`, and `topic` is literally set to `thread_id` in `fetchMailThreads` (there's no dedicated "thread" backend record — threads are derived client-side from inbox messages). So every row's "topic" you'll see in the UI today is a WIH-style id string, not a human title, until something upstream starts giving threads real topics.

## Assumptions made where the spec was ambiguous

- **"Unread" is grounded in the real `MailMessage.acknowledged` field**, not a fabricated flag. Opening the detail page calls the store's existing `ackMessage` action for every unacknowledged message in that thread (a real `POST /mail/ack` per message) — "I opened the thread" is the natural real-world signal for "I've read this."
- **"Archived" is real-call-plus-local-marker** (see deviations above) rather than either (a) inventing a backend field that doesn't exist, or (b) silently making Archive a no-op. I judged calling the existing endpoint *and* tracking the UI-visible state locally to be more honest than either extreme.
- **Review "resolved" state** is derived, not stored: if a `/decide/i`-matching event postdates the most recent `/review/i`-matching event in the visible window, the review card disappears. There's no persisted "this ask is closed" flag to read back, so a review can theoretically "reappear" if an older review event scrolls back into the last-4 window after a newer one ages out — an edge case I judged acceptable for phase 1 given the existing 4-event window this inherits from `useMonitorData`.
- **Keyboard shortcuts operate on an implicit focus, not a rendered "focused row" style.** Rather than threading a controlled `focusedIndex` prop through `AgentActivityListView` (which the file plan doesn't ask for), `AgentActivityPanel` calls `.focus()` on the matching row's real `<button data-thread-id>` DOM node, so the existing `:focus-visible` ring (already on every row) *is* the focus indicator — accessible for free, no new prop surface on the list component.
- **`AgentActivityListView`'s tab state is controlled-or-uncontrolled** (`activeTab`/`onTabChange` optional props): the page variant uses it uncontrolled; the panel controls it so its own keyboard-nav filtered list and what's actually rendered can never drift out of sync.
