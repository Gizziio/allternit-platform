# Claude Code Templates → Allternit Integration Plan

This note collects the observable capabilities of `davila7/claude-code-templates` (analytics CLI, conversation tunnel, plugin dashboard) and maps them onto Allternit platform touchpoints so we can “begin on all 3” of the requested integration threads.

## 1. Remote monitor (mail tab live monitor)
- Present activity the same way `MonitorView` / `MailMonitorPanel` already do: select a thread, show the message stream, surface analytics, ledger events, and logs.  The analytics helper (`useMonitorData` + `buildSessionAnalytics`) already aggregates messages/receipts/logs for that thread, so we can reuse exactly that contract when showing the CLI’s `--analytics` metrics (totals, token usage, tool calls, model mix, cost estimates, etc.).
- Extend the mail monitor pane to optionally show the CLI-style timeline breakdown (e.g., event counts per minute, tool usage legend) within the existing `Card` stack or via a lightweight `Live Metrics` subpanel.  No new input bar is required because the mail monitor is inherently read-only.
- Keep backend integration inside `railsApi.mail`/`railsApi.ledger` so we remain compliant with UI→Gateway→API requirements, and route any sharing links through the share helper already invoked by `buildMonitorLink`.

## 2. Conversation monitor (agent rail companion)
- Treat the `--chats` stream as a read-only companion tied to the current thread/session ID.  `MailMonitorPanel` already renders the same messages; we can version a new `ConversationMonitorPanel` that subscribes to `useUnifiedStore`’s `mailMessages`, add session meta (session ID, model, status) and actions (e.g., open rail, copy share link), and display only Claude responses.  Highlight to the user that the active input is still the agent rail’s composer (`AgentInvokeBar`/`ChatComposer`).
- Ensure the conversation monitor can “follow” whichever rail/session is active by sharing the same `threadId` state that `MonitorView` manipulates; we avoid duplicate inputs by rendering the monitor as a read-only panel in a drawer, column, or floating overlay within `ShellRail` or `MonitorView`.

## 3. Plugin dashboard (plugin tab)
- Reuse `PluginRegistryView`’s structure as an initial scaffold but replace the `MOCK_PLUGINS` + `scanPlugins` helpers with a plugin state pulled from the same store backing the CLI dashboard (plugin state, filters, command copy, auto-refresh).  That state lives inside the Allternit Operator (see section below) and can be synced through `railsApi` endpoints or a new `/api/plugins` route exposed by the Gateway.
- Surface the CLI dashboard features that are already present in release v1.22.0: real-time enabled/disabled statuses, filter controls (by type, status), actionable command snippets (copy buttons), and the auto-refresh timer (e.g., every 30 seconds).  The UI should provide the same quick toggles so the CLI and web UI stay in sync.

## UI-TARS context
- The forked UI-TARS code now lives in `services/allternit-operator` and is referenced in the Dockerfile (`UI-TARS has been absorbed into Allternit Operator as Allternit Vision`).  This is the natural integration point for any UI-TARS-specific monitoring or plugin dashboard logic: build the shared plugin state/command store there and expose it via the Operator APIs that the web UI already consumes.

## Next steps
1. Define the JSONL/session telemetry contract (messages, ledger events, receipts) so the mail tab’s `Live Monitor` can pull the same `--analytics` metrics without a new ingestion layer.  Document which fields come from `buildSessionAnalytics` vs. new CLI outputs.
2. Prototype the conversation monitor component (read-only, shared `threadId`, quick actions) and wire it into `ShellRail`/`MonitorView` without adding another chat input.
3. Identify the definitive plugin state source inside `allternit-operator` (plugin metadata, filters, command-copy templates) and iterate `PluginRegistryView` to consume it, keeping the CLI’s auto-refresh cadence.
