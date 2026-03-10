# A2R Specification

Specification documents for the A2R (Agent-to-Agent Runtime) platform.

> **Note on Naming**: The `agent_workspace` module (client-side) was formerly called `a2r_engine`. 
> It is the companion to the kernel, not a replacement. The kernel maintains authoritative state;
> agent_workspace maintains the distilled markdown view.

## Overview

The A2R platform enables seamless session handoffs between AI coding tools through the agent_workspace module:

1. **Session Discovery** - Find sessions across tools
2. **Context Preservation** - Extract meaningful state
3. **Quality Gates** - Validate handoffs before emission
4. **Structured Handoffs** - Standardized baton format

## Documents

### Platform Specification

| Document | Description |
|----------|-------------|
| [`Contracts/A2R-PLATFORM.md`](Contracts/A2R-PLATFORM.md) | Complete `.a2r/` directory specification, boot order, file lifecycle |
| [`Contracts/CONTINUITY.md`](Contracts/CONTINUITY.md) | Continuity module architecture, components, integration |

### Core Concepts

#### .a2r Directory

The `.a2r/` directory in a workspace maintains all session state:

```
.a2r/
├── config.json              # Platform configuration
├── receipts/
│   └── receipt.jsonl        # Append-only activity log
├── state/
│   └── state.json           # Current DAG node state
├── handoff/
│   └── latest.md            # Pointer to current baton
├── compact/
│   └── compact-*.md         # Compaction batons
├── usage/
│   └── usage-*.json         # Usage snapshots
├── conventions.json         # Project conventions (optional)
└── tasks/
    └── dag.json             # DAG task graph (optional)
```

**See**: [`Contracts/A2R-PLATFORM.md`](Contracts/A2R-PLATFORM.md) for complete specification.

#### Baton Format

Handoff batons contain 13 sections:

1. Objective
2. Current Plan
3. Work Completed
4. Files Changed
5. Commands Executed
6. Errors / Blockers
7. Decisions Made
8. Open TODOs
9. **DAG Tasks** (structured workflow)
10. Next Actions
11. **A2R Conventions** (project standards)
12. Evidence Pointers
13. Limits Snapshot

**See**: [`Contracts/CONTINUITY.md`](Contracts/CONTINUITY.md) for baton details.

#### CI Gates

Three validation gates ensure handoff quality:

| Gate | Purpose |
|------|---------|
| **Evidence** | Verify files exist, receipts valid, references correct |
| **No-Lazy** | Detect lazy patterns, ensure concrete actions |
| **Resume** | Validate baton fits context, workspace exists, actionable |

### Boot Order

When a tool starts, `.a2r/` initializes in 4 phases:

```
Phase 1: Directory Structure
  - Create all subdirectories

Phase 2: Core Files  
  - config.json (session config)
  - receipts/receipt.jsonl (empty)
  - state/state.json (initial DAG)

Phase 3: Optional Files
  - conventions.json (load or infer)
  - tasks/dag.json (load or empty)
  - handoff/latest.md (check for resume)

Phase 4: Runtime
  - Start accepting tool calls
  - Monitor thresholds
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     A2R PLATFORM                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Session    │  │    Guard     │  │   Continuity │       │
│  │  Discovery   │  │   System     │  │    Module    │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                  │               │
│         └─────────────────┼──────────────────┘               │
│                           │                                  │
│                           ▼                                  │
│                  ┌────────────────┐                         │
│                  │     .a2r/      │                         │
│                  │   Directory    │                         │
│                  └────────────────┘                         │
│                           │                                  │
│                           ▼                                  │
│                  ┌────────────────┐                         │
│                  │  Handoff Baton │                         │
│                  │   (Markdown)   │                         │
│                  └────────────────┘                         │
│                           │                                  │
│                           ▼                                  │
│                  ┌────────────────┐                         │
│                  │  Target Tool   │                         │
│                  │   (Resume)     │                         │
│                  └────────────────┘                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Implementation

### Source Files

| Component | Path | Layer |
|-----------|------|-------|
| Agent Workspace | `src/agent-workspace/` | All |
| Artifacts Manager | `src/agent-workspace/artifacts.ts` | File I/O |
| Boot Sequence | `src/agent-workspace/boot.ts` | Initialization |
| Policy Engine | `src/agent-workspace/policy.ts` | L2/L3 |
| Context Builder | `src/agent-workspace/context.ts` | All |
| Session Discovery | `src/continuity/index.ts` | L1 |
| Context Extractor | `src/continuity/context-extractor.ts` | L1 |
| Handoff Emitter | `src/continuity/handoff-emitter.ts` | L1 |
| CI Gates | `src/continuity/gates.ts` | L3 |
| Tool Parsers | `src/continuity/parsers/index.ts` | L1 |
| Guard Artifacts | `src/guard/artifacts.ts` | L1 |

### Tests

```bash
# All continuity tests
bun test test/continuity/

# Specific areas
bun test test/continuity/types.test.ts
bun test test/continuity/handoff-emitter.test.ts
bun test test/continuity/gates.test.ts
bun test test/continuity/parsers.test.ts
bun test test/continuity/dag-tasks.test.ts
```

## Supported Tools

| Tool | Status | Parser |
|------|--------|--------|
| OpenCode | ✅ Supported | Basic (SQLite ready) |
| Claude Code | ✅ Supported | JSONL parser |
| Codex | ✅ Supported | JSONL parser |
| Copilot | ✅ Supported | Basic |
| Cursor | ✅ Supported | Basic (SQLite ready) |
| Gemini CLI | ✅ Supported | Basic |
| A2R Shell | ✅ Native | Full |
| Kimi | ✅ Supported | JSON parser |
| Qwen | ✅ Supported | JSON parser |
| MiniMax | ✅ Supported | JSON parser |
| GLM | ✅ Supported | JSON/JSONL parser |

## Guard Thresholds

| Threshold | Context Ratio | Action | Indicator |
|-----------|--------------|--------|-----------|
| **WARN** | 70% | User notification | 🟡 Yellow |
| **COMPACT** | 85% | Auto-compact | 🟠 Orange |
| **HANDOFF** | 92% | Fail-closed handoff | 🔴 Red |

## Quick Reference

### Creating a Handoff

```typescript
import { ContextExtractor, HandoffEmitter, CIGates } from "@/continuity"

// Extract context
const context = await ContextExtractor.extract({
  source: sessionSource,
  workspace: "/path/to/project",
  messages: messageHistory,
})

// Emit baton
const baton = HandoffEmitter.emitJSON({
  context,
  target_tool: "claude_code",
  compact_reason: "threshold",
})

// Validate
const report = await CIGates.validate(baton, { strict: true })
if (!report.passed) {
  console.log(CIGates.formatReport(report))
}
```

### Resuming a Session

```typescript
import { GuardArtifacts } from "@/guard/artifacts"

// Check for handoff
const latestBaton = await GuardArtifacts.getLatestBaton(workspace)
if (latestBaton) {
  // Present to user for resume
  console.log(`Resume from: ${latestBaton}`)
}
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-24 | Initial release with 12 tools, 3 CI gates, DAG tasks, conventions |

## See Also

- [A2R Platform Spec](Contracts/A2R-PLATFORM.md) - Complete `.a2r/` specification
- [Continuity Spec](Contracts/CONTINUITY.md) - Continuity module details
- [Acceptance Tests](AcceptanceTests.md) - Platform acceptance criteria
