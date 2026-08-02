# Agent Activity — Web Phase 1 Task

Read `docs/AGENT_ACTIVITY_WEB_MAP.md` first, and open `docs/agent-activity-design/mockup-v3.html` in a browser (or read its source) for the full visual/interaction design — status colors, keyboard shortcuts (`j`/`k`/`Enter`/`1`/`2`/`a`/`Esc`), the typed review-card logic (code-diff vs. plain decision), reservation/guard visibility treatment, accessibility details (`prefers-reduced-motion`, `sr-only` status labels, focus rings). That mockup is the design spec — translate its visual/interaction intent into this app's real component conventions (see below), don't rebuild it as a standalone styled page.

**Framing constraint from the product owner, non-negotiable**: the full thread view must be a real routed page, not content living inside the quick-access panel/modal. This was explicit, corrective feedback on the previous design pass.

## Real conventions to match (read these files first)

- **Component style**: Tailwind + shadcn-style `Card`/`CardHeader`/`CardContent` (`@/components/ui/card`) — see `views/mail-monitor/ConversationMonitorPanel.tsx` for the exact idiom already used for this feature's message rendering. Extend it; don't introduce a different styling approach.
- **Route + page pattern**: `pages/GoalsListPage.tsx` (thin wrapper around a shared view component) and `pages/GoalDetailPage.tsx` (`useParams` → detail view) in `surfaces/ai.allternit.com/src/routes.tsx` — copy this shape exactly for `/agent-activity` and `/agent-activity/:threadId`.
- **Data hook**: `views/mail-monitor/monitor.helpers.ts`'s `useMonitorData(threadId)` already pulls real messages + `relevantEvents` (ledger events filtered by thread id — this is how reservation/guard state actually surfaces) + telemetry. Extend this hook (add a thread-list variant, e.g. `useMonitorThreads()` pulling from `useUnifiedStore`'s `mailThreads`/`fetchMailThreads`) rather than writing a parallel data layer.
- **Real API calls**: `railsApi.mail.*` from `lib/agents/rails.service.ts` (`inbox`, `send`, `decide`, `archive`, `share`, `ack`) — no mock data anywhere in this build.

## Files to add / change

1. **`views/agent-activity/AgentActivityListView.tsx`** — the shared list component (used by both the full page and, in a compact mode, the quick panel — parameter it with a `variant: 'panel' | 'page'` or similar, matching how `AutomationTasksView` takes `initialTab`). Flat list per `mockup-v3.html`: status dot + `sr-only` label, topic, one-line preview, relative time, unread indicator, Review/Archived tab filter, reservation-lock tag when applicable. Row click (`page` variant) navigates via `useNavigate('/agent-activity/' + threadId)`; row click (`panel` variant) does the same navigation (closing the panel) — **do not** implement an in-panel expand/accordion for full content; a one-line preview in the row is enough context for the panel, full content only lives on the detail page.
2. **`pages/AgentActivityListPage.tsx`** — thin wrapper, `<AgentActivityListView variant="page" />`, mirroring `GoalsListPage.tsx`.
3. **`views/agent-activity/AgentActivityDetailView.tsx`** — the real full-thread page content. Extends `ConversationMonitorPanel.tsx`'s message-rendering (reuse it directly if the shape fits, or fork it if the new visual treatment from `mockup-v3.html` — typed review cards, reservation/guard cards — doesn't fit the existing component's props cleanly). Includes: full message history (no height cap — this is a real page, not a 320px scroll box), the review-decision UI when `requestReview` is pending (typed by kind: a `diffRef` present → show it + treat as code-diff per the mockup's stat-line idea if that data is available, else plain decision UI with the question text + Approve/Deny calling `railsApi.mail.decide`), reservation/guard context surfaced from `relevantEvents` (read-only, per the mockup's reasoning: these aren't human-actionable), and per-thread actions (Archive → `railsApi.mail.archive`, Share → `railsApi.mail.share`) plus a reply box (`railsApi.mail.send`).
4. **`pages/AgentActivityDetailPage.tsx`** — `useParams<{ threadId: string }>()` → `<AgentActivityDetailView threadId={threadId ?? ''} />`, mirroring `GoalDetailPage.tsx` exactly.
5. **`views/agent-activity/AgentActivityPanel.tsx`** — the quick-access slide-over (bell icon target). Renders `<AgentActivityListView variant="panel" />` inside a slide-over/sheet (check this codebase for an existing sheet/drawer primitive — e.g. how `ConnectorsListView` or a settings panel is presented — reuse whatever primitive is already standard here rather than hand-rolling a new overlay component). Include the keyboard shortcuts from `mockup-v3.html` (`j`/`k`/`Enter`/`1`/`2`/`a`/`Esc`) scoped to when the panel is open.
6. **Routes** (`routes.tsx`): add `/agent-activity` → `AgentActivityListPage`, `/agent-activity/:threadId` → `AgentActivityDetailPage`, following the exact `lazy(() => import(...))` pattern already used for every other route in this file.
7. **Entry point**: add a bell-icon trigger for `AgentActivityPanel` somewhere in the shell chrome (`shell/ShellApp.tsx` or wherever the existing icon row lives — check how other global-utility icons, e.g. search, are already placed) with an unread-count badge sourced from the thread list's unread state. Keep the ⌘⇧M keyboard shortcut (`ShellApp.tsx:324-328`) but repoint it to open `AgentActivityPanel` (or navigate straight to `/agent-activity` — your call, whichever feels more like "I hit the shortcut, I see my threads immediately" without an extra click) instead of the old `ConversationMonitorOverlay`.
8. **`monitor.helpers.ts`**: fix `buildMonitorLink` if its generated path (`/mail/monitor/:threadId`) doesn't match whatever real path you actually register (`/agent-activity/:threadId`) — this function's whole existence was evidence someone intended exactly this page; make it point at the real one.

## What NOT to do

- Don't delete `ConversationMonitorOverlay.tsx`/`ConversationMonitorPanel.tsx` outright if anything else still references them — check for other call sites first; if none, retiring them in favor of the new components is fine and worth doing (avoid leaving two parallel, half-overlapping systems).
- Don't invent new backend endpoints — every action in this phase maps to an existing `railsApi.mail.*` call.
- Don't build iOS or gizzi-code CLI work here — web only, this phase.
- Don't touch anything under `docs/SURFACE_AUDIT_PROGRESS.md`'s tracked items or `surfaces/allternit-mobile/`/`cmd/gizzi-code/` — unrelated, separate work.

## Constraints

- Match this app's real conventions throughout (Tailwind/shadcn, existing hooks, existing route pattern) — the mockup is a design reference for visuals/interaction, not a literal implementation to port.
- No backend changes.
- If something in `mockup-v3.html`'s design doesn't translate cleanly to a real page (e.g. reservation/guard data isn't actually queryable the way the mockup assumed, or `decide()`'s response shape differs from what the mockup implied), say so honestly in the notes and describe what you built instead — don't fake data or silently drop the requirement.
- Run whatever typecheck/lint this surface normally uses on the files you touch if feasible in this environment; if the environment can't run a full build, say so explicitly rather than claiming untested code works.

## Deliverable

`docs/AGENT_ACTIVITY_WEB_PHASE_1_NOTES.md`, YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`), then prose covering: how you wired the quick-panel vs. full-page split (confirming drill-down is a real route, not a modal), what reservation/guard data actually looked like once you queried it for real, and any assumption made where the spec was ambiguous. That file existing = done.
