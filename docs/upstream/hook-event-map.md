# Kimi Code hook-event parity map

Behavioral reference: `MoonshotAI/kimi-code` at `3086e47`, especially `agent-core-v2/src/agent/externalHooks` and `docs/en/customization/hooks.md`.

Allternit hooks are fail-open on crashes, timeouts, and unexpected non-zero exits. Exit code `2` or a structured deny response blocks only the three blockable lifecycle points. Matching hooks execute concurrently, and an identical command or URL runs once per event.

| Kimi event | Allternit lifecycle point | Blocking |
| --- | --- | --- |
| `UserPromptSubmit` | Before the durable user message is created | Yes |
| `PreToolUse` | Shared tool dispatcher, before permission and execution | Yes |
| `PostToolUse` | Shared tool dispatcher after success | No |
| `PostToolUseFailure` | Shared tool dispatcher after failure or policy denial | No |
| `PermissionRequest` | Immediately before an approval is published | No |
| `PermissionResult` | Immediately after an approval reply | No |
| `Stop` | Model turn completion boundary | Yes |
| `StopFailure` | Model turn terminal error | No |
| `Interrupt` | User cancellation boundary | No |
| `SessionStart` | Agent-loop startup/resume | No |
| `SessionEnd` | Agent-loop close | No |
| `SubagentStart` | Task/swarm child launch | No |
| `SubagentStop` | Task/swarm child terminal state | No |
| `PreCompact` | Before a manual or automatic compaction request | No |
| `PostCompact` | After a successful compaction | No |
| `Notification` | Durable background-task status transition | No |

The event names are a compatibility contract. Payloads use Allternit's current `{ name, timestamp, sessionId, payload }` envelope; transport normalization to Kimi's snake-case stdin shape remains isolated to hook senders.
