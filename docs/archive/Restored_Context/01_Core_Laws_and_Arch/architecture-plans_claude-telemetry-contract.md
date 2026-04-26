# Claude Telemetry Contract

This document defines the data contract between the Claude CLI analytics surface (`davila7/claude-code-templates --analytics`) and the Allternit Platform’s existing `MonitorView`/`SessionAnalytics` data aggregates.  The goal is to ensure the mail tab’s “Live Monitor” renders the same telemetry without inventing a parallel ingestion path.

## 1. CLI analytics payload (observed fields)
1. `session_id` / `thread_id` – identifier for the user/agent conversation.  Matches `mailThreads.thread_id`.
2. `messages` – chronological list of exchanges with timestamps, senders, and model/tool tags.  We already store those in `mailMessages` (`from_agent`, `timestamp`, `body`).
3. `ledger_events` – receipts emitted by DAK/Rails (tool calls, gate pass/fail).  We surface these via `ledgerEvents` and `useUnifiedStore().ledgerEvents`.
4. `receipts` – cost-aware receipts such as `tool_call_post` and `tool_call_failure`.  These are represented by `state.receipts` (used in `buildSessionAnalytics`).  Each receipt carries `tool`, `node_id`, `payload.cost`, etc.
5. `logs` – execution/debug logs tied to the session, mapped to `state.logs` filtered by `threadId`.
6. `metrics` – aggregates reported by CLI: `total_messages`, `tool_call_count`, `model_breakdown`, `token_counts`, `estimated_cost`, `session_duration`, and timeline snapshots.

## 2. Mapping to `SessionAnalytics`
| CLI metric | Allternit source | Notes |
|------------|------------|-------|
| `total_messages` | `mailMessages.filter(thread_id)` | Already computed as `messages.length`. |
| `participants` | `messages.from_agent` dedup | `SessionAnalytics.participants` captures this. |
| `tool_call_count` | `receipts.kind === 'tool_call_post'` | Already aggregated via `toolReceipts`. |
| `estimated_cost` | `receipts.payload.cost` | `receiptCost` sum provides base estimate. Add `tool_call_failure` counters for sanity. |
| `timeline` | `mailMessages + ledgerEvents` | Provide new `SessionAnalytics.timeline` array (timestamp + snippet). |
| `model_breakdown` | receipt payload or log metadata | Extend `SessionAnalytics` with `modelUsage` (map of model name → message count/average latency). Requires rails to tag logs/receipts with `model_name`. |
| `token_usage` | receipt payload (input/output tokens) | Add `tokenUsage` object (input, output, total) derived from receipts if payload exposes it, or add rails-level counters. |
| `tool_usage_details` | receipts by `tool` | Expand `SessionAnalytics.toolNames` into `toolUsage: { name: string; count: number }[]`. |
| `session_status` | `thread.status` (pending/complete) | Mirror rails metadata in `mailThreads` for `status` field. |

## 3. Proposed extensions to `SessionAnalytics`
- `timeline: { label: string; timestamp: number; type: 'message' | 'ledger' | 'receipt'; speaker?: string }[]`
- `tokenUsage?: { input: number; output: number; total: number; cached?: number }`
- `modelUsage?: Record<string, { messages: number; toolCalls: number; avgLatencyMs?: number }>`
- `toolUsage?: { name: string; count: number; lastUsedAt: number }[]`
- `sessionDuration?: { startedAt: number; lastActivityAt: number; minutes: number }`
- `status?: 'active' | 'idle' | 'complete' | 'error'` (derived from rails thread metadata)

## 4. Implementation notes
1. Reuse `buildSessionAnalytics` to populate the new fields.  For example, use `state.logs` and `state.receipts` to build timeline entries, and inspect `receipt.payload` for `model`/`tokens` fields.  Ensure rest of UI consumes these optional fields safely.
2. Keep telemetry ingestion on the Rails side—`railsApi.mail`, `railsApi.ledger`, and receipt listings already provide the raw data.  The CLI analytics simply re-reads these JSONL/receipt streams, so the UI will stay in sync if the store values are identical.
3. Add smoke tests (if possible) that verify `SessionAnalytics.timeline` length increases when new mail messages or ledger events arrive.

## 5. Next steps
1. Confirm the rails receipts include the necessary `payload.cost`, `payload.tool`, `payload.tokens`, and `payload.model_name` keys by checking the `allternit-agent-system-rails` schema or DAK Runner emission hooks (`domains/kernel/dak-runner`).
2. Extend `buildSessionAnalytics` in `unified.store.ts` to populate `tokenUsage`, `modelUsage`, `toolUsage`, and `timeline` (plan out data shapes before coding).  This is the bridge that keeps the CLI metrics and web UI in sync.
3. Surface the enhanced summary in `MailMonitorPanel` (and the upcoming conversation monitor) so the mail tab mirrors the CLI analytics panel’s totals, cost, and tool breakdown.
