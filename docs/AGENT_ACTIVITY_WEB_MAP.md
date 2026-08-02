# Agent Activity — Web Phase 1 Map

Source: product owner directive ("all surfaces will need to build out mail monitor/rails mail into a real tool instead of dev"), refined through two design mockups (`docs/agent-activity-design/mockup-v2.html`, `mockup-v3.html`, audit in `AUDIT_NOTES.md`) and one piece of explicit feedback on v3: **"I don't like how the drill-down is in the modal."** This map exists to fix that specifically — full-thread detail must be a real page, not content trapped inside the quick-access slide-over panel.

## What already exists (don't rebuild from scratch)

- **Backend**: `cmd/allternit-api/src/rails/mod.rs` / `allternit_agent_system_rails` — real, live, already used internally by `agent-orchestrator`. Full API surface: `ensureThread`, `send`, `inbox`, `ack`, `requestReview`, `decide` (strictly boolean — no N-way decisions), `reserve`, `share`, `archive`, `guard` (`surfaces/ai.allternit.com/src/lib/agents/rails.service.ts:543-601`, `mail` namespace).
- **Frontend data layer, partially real**: `views/mail-monitor/monitor.helpers.ts`'s `useMonitorData(threadId)` already pulls real `mailMessages`/`ledgerEvents`/`logs`/telemetry filtered by thread id from `useUnifiedStore` — **this is the actual, working mechanism for surfacing reservation/guard-adjacent state**: `relevantEvents` filters `ledgerEvents` by `payload.thread_id`/`payload.mail_thread_id` (lines 28-36). Reuse this hook, don't reinvent it.
- **Frontend UI, currently hidden**: `views/mail-monitor/ConversationMonitorPanel.tsx` + `shell/ConversationMonitorOverlay.tsx` — a real, working message-rendering component, reachable today only via a global Ctrl/Cmd+Shift+M shortcut with zero discoverable entry point (`shell/ShellApp.tsx:324-328`).
- **A dead giveaway of original intent**: `monitor.helpers.ts`'s `buildMonitorLink(threadId, shareId)` (line ~78) already generates `${BASE_URL}/mail/monitor/${threadId}` and `${BASE_URL}/mail/share/${shareId}` — **but neither path is registered anywhere in `surfaces/ai.allternit.com/src/routes.tsx`.** Someone already intended a real per-thread page and never finished wiring it. This phase finishes that.
- **The exact routing pattern to copy**: `routes.tsx` already has a list-page + detail-page pair for a structurally identical feature — `/automation/goals` → `GoalsListPage` (a thin wrapper: `export default function GoalsListPage() { return <AutomationTasksView initialTab="goal"> }`) and `/automation/goals/:id` → `GoalDetailPage` (`useParams<{ id: string }>()` → `<GoalDetailView goalId={id ?? ''} />`). Follow this exact shape.

## The fix for "drill-down is in the modal"

Two separate surfaces, not one:
1. **Quick-access panel** (bell icon in the shell chrome, slide-over list — the `mockup-v3.html` design: flat list, status dots, unread state, keyboard nav `j`/`k`/`1`/`2`/`a`, Review/Archived tabs). This stays lightweight and stays a panel — it's for a fast glance, matching how GitHub's Agents panel and Claude Code's own quick-list work.
2. **Full thread view — a real routed page**, `/agent-activity/:threadId`, opened by clicking "Open full thread" in the panel (`useNavigate`, not an in-panel state change) **or** landing directly via a shared link / the ⌘⇧M shortcut / a notification. This is where the actual message history, the review-decision UI, reservation/guard context, and archive/share actions live — full width, full height, not squeezed into a 380px overlay.

`/agent-activity` (no id) is the third route — a full-page version of the same list the panel shows, for when someone wants to browse everything rather than a quick glance (same `GoalsListPage`/`AutomationTasksView` relationship: the panel and the full list page can share one underlying list component, parameterized).

## Scope decision

Build all three: `/agent-activity` (list page), `/agent-activity/:threadId` (detail page), and the quick-access panel (bell icon + slide-over). Wire real data (`railsApi.mail.*`, `useMonitorData`) — no mock data. Keep the existing ⌘⇧M shortcut but repoint it at the new real UI instead of the old hidden overlay (the old `ConversationMonitorOverlay`/`ConversationMonitorPanel` become the seed for the new detail view, not thrown away). Design must follow `mockup-v3.html` exactly — tokens, keyboard interaction, accessibility fixes, typed review cards (code-diff vs. plain decision), visible-but-read-only reservation/guard state.

Not in scope for this phase: iOS, gizzi-code CLI (later phases, tracked separately once this web reference implementation is approved and real). Triage-rules-style automation, custom filters beyond Review/Archived (noted as future scope in `AUDIT_NOTES.md`).
