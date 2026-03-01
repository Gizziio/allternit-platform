# A2R Guard System

## Overview

The Guard System provides **automated protection** against context window limits, rate limits, and quota exhaustion. It implements a **Measure → Predict → Compact → Handoff → Resume** control loop.

```
┌─────────────────────────────────────────────────────────────┐
│                    GUARD CONTROL LOOP                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │  MEASURE │───▶│ PREDICT  │───▶│  ACT     │            │
│   │          │    │          │    │          │            │
│   │ • Tokens │    │ • Ratio  │    │ • WARN   │            │
│   │ • Cost   │    │ • Slope  │    │ • COMPACT│            │
│   │ • Errors │    │ • Trend  │    │ • HANDOFF│            │
│   └──────────┘    └──────────┘    └──────────┘            │
│         ▲                                    │              │
│         └────────────────────────────────────┘              │
│                    (feedback loop)                          │
└─────────────────────────────────────────────────────────────┘
```

## Guard Thresholds

| Threshold | Context Ratio | Action | Event Emitted |
|-----------|---------------|--------|---------------|
| **OK** | < 70% | Continue normally | - |
| **WARN** | ≥ 70% | Show TUI warning | `guard.warn` |
| **COMPACT** | ≥ 85% | Auto-compact session | `guard.compact` |
| **HANDOFF** | ≥ 92% | Switch runner/model | `guard.handoff` |
| **FAILCLOSED** | ≥ 98% or error | Emergency stop | `guard.failclosed` |

### Threshold Calculations

```typescript
// Context ratio
context_ratio = tokens_used / context_window

// Quota ratio (max of)
quota_ratio = max(
  rate_limit_errors > 0 ? 0.8 : 0,
  budget_used / budget_cap,
  tokens_day / tokens_day_limit
)
```

## The .a2r/ Workspace Directory

Every workspace (project) with A2R Guard enabled has a `.a2r/` directory:

```
workspace/
├── .a2r/
│   ├── receipts/
│   │   └── receipt.jsonl          # Append-only tool activity log
│   ├── state/
│   │   └── state.json             # Current DAG node, outputs, metadata
│   ├── handoff/
│   │   └── latest.md              # Pointer to most recent baton
│   ├── compact/
│   │   ├── compact-20260223-143022.md   # Compaction baton 1
│   │   ├── compact-20260223-151545.md   # Compaction baton 2
│   │   └── ...
│   └── usage/
│       ├── usage-20260223-143022.json   # Usage snapshot 1
│       └── ...
└── src/
    └── ...
```

### File Descriptions

#### `receipts/receipt.jsonl`
Append-only log of all tool calls with results.

```jsonl
{"ts":"2026-02-23T14:30:22Z","run_id":"uuid","dag_node_id":"implement-auth","tool":"bash","kind":"result","status":"ok","duration_ms":150,"files_touched":[{"path":"src/auth.ts","action":"modified"}]}
{"ts":"2026-02-23T14:31:10Z","run_id":"uuid","dag_node_id":"implement-auth","tool":"read","kind":"call","args_redacted":{"path":"src/types.ts"},"status":"ok"}
```

#### `state/state.json`
Current session state for resumption.

```json
{
  "session_id": "sess_abc123",
  "run_id": "run_xyz789",
  "dag_node_id": "implement-auth",
  "last_compact": 1740321622000,
  "compact_path": "/workspace/.a2r/compact/compact-20260223-143022.md",
  "message_count": 42,
  "initialized": true,
  "initialized_at": 1740321000000
}
```

#### `handoff/latest.md`
Pointer to the most recent baton.

```markdown
# A2R Handoff Pointer

Generated: 2026-02-23T14:30:22.123Z

## Current Baton

/workspace/.a2r/compact/compact-20260223-143022.md

## Metadata

- workspace: /workspace
- handoff_count: 2
```

#### `compact/compact-*.md` (The Baton)
Structured summary of session state with 11 required sections.

```markdown
# A2R Session Baton

**Session:** sess_abc123  
**Run:** run_xyz789  
**Node:** implement-auth  
**Generated:** 2026-02-23T14:30:22.123Z  
**Tool:** a2r_shell

---

## Objective

Implement authentication middleware for the API

---

## Current Plan

- Set up JWT verification
- Add middleware to protected routes
- Write tests for auth flow

---

## Work Completed

- 15 tool executions completed
- 3 files modified
- 8 responses generated

---

## Files Changed

- src/auth.ts: modified during session
- src/middleware.ts: created
- tests/auth.test.ts: modified

---

## Commands Executed

- **build:**
  - `npm run build`
- **test:**
  - `npm test`
- **git:**
  - `git add src/auth.ts`
  - `git commit -m "Add auth"`

---

## Errors / Blockers

- None

---

## Decisions Made

- Use JWT instead of sessions for stateless auth

---

## Open TODOs

- Add refresh token logic
- Implement rate limiting

---

## Next 5 Actions

1. Review current auth implementation
2. Add refresh token endpoint
3. Write integration tests
4. Update API documentation
5. Deploy to staging

---

## Evidence Pointers

- Receipts: /workspace/.a2r/receipts/receipt.jsonl
- State: /workspace/.a2r/state/state.json
- Messages: 42 total

---

## Limits Snapshot

- Context ratio: 48%
- Quota ratio: 0%
- Tokens total: 45,234
- Messages: 42
- Cost: $0.0234
```

## Usage

### Manual Compact (Hotkey: `C`)

Force immediate compaction:

```typescript
import { GuardCompaction, GuardArtifacts } from "@/guard"

const result = await GuardCompaction.emit({
  session_id: "sess_abc123",
  run_id: "run_xyz789",
  workspace: "/workspace",
  messages: [...],
  receipts: [...],
  usage_summary: {...},
  model: "claude-3-5-sonnet",
  provider: "anthropic",
  runner: "a2r_shell"
})

console.log(result.baton_path) // /workspace/.a2r/compact/compact-...
```

### Manual Handoff (Hotkey: `H`)

Trigger handoff to different runner:

```typescript
import { GuardPolicy } from "@/guard"

const result = GuardPolicy.evaluate(metrics, context)

if (result.action === "handoff") {
  // Switch to alternative runner
  await handoffToRunner(result.target_runner!, result.baton_path!)
}
```

### Check Guard State

```typescript
import { GuardPolicy } from "@/guard"

const metrics = {
  context_ratio: 0.85,  // 85% context used
  quota_ratio: 0.0,
  tokens_input: 25000,
  tokens_output: 15000,
  tokens_total: 40000,
  context_window: 200000,
  throttle_count: 0
}

const context = {
  session_id: "sess_abc123",
  run_id: "run_xyz789",
  model: "claude-3-5-sonnet",
  provider: "anthropic",
  runner: "a2r_shell",
  workspace: "/workspace"
}

const result = GuardPolicy.evaluate(metrics, context)
// result.state = "COMPACT"
// result.action = "compact"
```

### Record Metrics

```typescript
import { GuardMetrics } from "@/guard"

await GuardMetrics.record(
  {
    "gen_ai.usage.total_tokens": 45234,
    "a2r.context.ratio": 0.48,
    "a2r.guard.state": "OK"
  },
  {
    model: "claude-3-5-sonnet",
    provider: "anthropic",
    runner: "a2r_shell",
    workspace: "/workspace",
    session_id: "sess_abc123",
    run_id: "run_xyz789",
    dag_node_id: "implement-auth"
  }
)
```

### Initialize A2R Structure

```typescript
import { GuardArtifacts } from "@/guard"

const paths = await GuardArtifacts.initialize("/workspace")
// Creates all .a2r/ directories
```

## Events

Subscribe to guard events:

```typescript
import { Bus } from "@/bus"
import { GuardPolicy } from "@/guard"

Bus.on(GuardPolicy.Event.Warn, (event) => {
  console.log(`Warning: Context at ${event.context_ratio * 100}%`)
})

Bus.on(GuardPolicy.Event.Compact, (event) => {
  console.log(`Compacted: ${event.baton_path}`)
})

Bus.on(GuardPolicy.Event.Handoff, (event) => {
  console.log(`Handoff to ${event.target_runner}`)
})
```

## Configuration

```json
// config.json
{
  "guard": {
    "enabled": true,
    "thresholds": {
      "warn": 0.70,
      "compact": 0.85,
      "handoff": 0.92
    },
    "compact_cooldown_ms": 60000,
    "auto_handoff": true
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      GUARD MODULE                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │    Policy   │  │   Metrics   │  │  Artifacts  │     │
│  │             │  │             │  │             │     │
│  │ • Thresholds│  │ • OTel GenAI│  │ • .a2r/ fs  │     │
│  │ • Events    │  │ • Snapshots │  │ • Receipts  │     │
│  │ • Actions   │  │ • Slopes    │  │ • State     │     │
│  └──────┬──────┘  └─────────────┘  └─────────────┘     │
│         │                                                │
│  ┌──────┴──────┐                                         │
│  │  Compaction │                                         │
│  │             │                                         │
│  │ • Emitter   │  →  /.a2r/compact/*.md                 │
│  │ • 11-sect   │                                         │
│  │ • Handoff   │                                         │
│  └─────────────┘                                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Schema Validation

All batons validate against:
- `spec/Contracts/session-context.schema.json`
- `spec/Contracts/receipt.schema.json`

## Acceptance Tests

See `spec/AcceptanceTests.md` for full test suite.

Key tests:
1. Deterministic baton emission
2. Warn threshold (70%)
3. Compact threshold (85%)
4. Handoff threshold (92%)
5. Evidence gate (diffs require receipts)

## Related Modules

- **SessionUsage** (`src/session/usage.ts`) - Token/cost tracking
- **SessionCompaction** (`src/session/compaction.ts`) - Existing compaction
- **a2r-continuity** (pending) - Cross-tool session handoff
