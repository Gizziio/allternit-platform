# Agent Workspace Implementation Summary

## Overview

This implementation provides **client-side workspace management** for the A2R platform, complementing the kernel's authoritative state with a distilled markdown view that agents can rehydrate.

**Architecture**:
```
KERNEL (Rust/Ledger) ←→ MARKDOWN (Distillation) ←→ AGENT WORKSPACE (This) ←→ AGENT (LLM)
```

- **Kernel**: Authoritative state, deterministic execution, ledger receipts
- **Markdown**: Human-readable distillation of kernel state
- **Agent Workspace**: Client-side management of the 5-layer structure
- **Agent**: Reads markdown, decides, acts, logs

## Module Structure

```
src/agent-workspace/
├── index.ts        # Public API exports
├── artifacts.ts    # 5-layer file management (21-phase boot)
├── boot.ts         # Boot sequence orchestration
├── policy.ts       # Policy engine (L2/L3 enforcement)
└── context.ts      # Context pack builder (LLM aggregation)
```

## 5-Layer Organization

| Layer | Path | Purpose | Key Files |
|-------|------|---------|-----------|
| **L1** | `L1-COGNITIVE/` | Thinking & Memory | BRAIN.md, memory.jsonl, state.json |
| **L2** | `L2-IDENTITY/` | Who We Are | IDENTITY.md, CONVENTIONS.md, POLICY.md |
| **L3** | `L3-GOVERNANCE/` | How We Work | PLAYBOOK.md, TOOLS.md, HEARTBEAT.md |
| **L4** | `L4-SKILLS/` | What We Can Do | INDEX.md, skills/ |
| **L5** | `L5-BUSINESS/` | Who We Serve | CLIENTS.md, crm/, projects/ |

## Key APIs

### Initialize Workspace (21-Phase Boot)

```typescript
import { AgentWorkspace, BootSequence } from "@/agent-workspace"

// Full 21-phase initialization
const paths = await AgentWorkspace.initialize("/path/to/project", {
  sessionId: "sess-abc-123",
  runner: "opencode",
  enableL5: true, // Include business layer
})

// Or use boot sequence for progress tracking
const result = await BootSequence.execute({
  workspace: "/path/to/project",
  runner: "opencode",
})
```

### Policy Enforcement

```typescript
import { PolicyEngine } from "@/agent-workspace"

// Evaluate tool call against policies
const result = await PolicyEngine.evaluateToolCall(workspace, {
  tool: "bash",
  args: { command: "rm -rf /" },
  context: { sessionId: "sess-1", dagNodeId: "node-1", filesAccessed: [] }
})

if (!result.allowed) {
  console.log(`Blocked: ${result.reason}`)
}
```

### Build Context Pack

```typescript
import { ContextPackBuilder } from "@/agent-workspace"

// Aggregate 5 layers for LLM
const pack = await ContextPackBuilder.build(workspace, {
  includeLayers: [1, 2, 3], // Cognitive, Identity, Governance
  maxTokens: 100000,
})

// Format for LLM
const context = ContextPackBuilder.formatForLLM(pack)
```

### Handoff Management

```typescript
import { AgentWorkspace } from "@/agent-workspace"

// Update handoff pointer
await AgentWorkspace.updateHandoff(workspace, batonPath, {
  objective: "Implement feature X",
  progress: "75%",
  contextRatio: 0.92,
  targetTool: "claude_code",
})

// Check for existing handoff
const baton = await AgentWorkspace.getLatestBaton(workspace)
if (baton) {
  console.log(`Resume from: ${baton}`)
}
```

## Integration with Continuity Module

The continuity module provides:
- **Session Discovery**: Find sessions across tools (12 tools supported)
- **Context Extraction**: Parse messages, extract decisions, TODOs, DAG tasks
- **Handoff Emitter**: Generate 13-section batons
- **CI Gates**: Validate handoffs (evidence, no-lazy, resume)

These feed into the agent_workspace:
```typescript
// Extract context from session
const context = await ContextExtractor.extract({ source, workspace, messages })

// Emit baton
const baton = HandoffEmitter.emitMarkdown({ context, compact_reason: "threshold" })

// Validate
const report = await CIGates.validate(baton)

// Store in workspace
await AgentWorkspace.updateHandoff(workspace, batonPath, metadata)
```

## Boot Sequence (21 Phases)

```
Phases 1-6:   L1-COGNITIVE setup (brain, memory, state)
Phases 7-14:  L2-IDENTITY setup (ID, soul, policy, conventions)
Phases 15-18: L3-GOVERNANCE setup (playbook, tools, heartbeat)
Phase 19:     L4-SKILLS setup (skill registry)
Phase 20:     L5-BUSINESS setup (optional)
Phase 21:     Handoff discovery (resume check)
```

## File Mapping (Old → New)

| Old Path | New Path | Notes |
|----------|----------|-------|
| `.a2r/config.json` | `.a2r/manifest.json` | Updated schema |
| `.a2r/receipts/receipt.jsonl` | `.a2r/L1-COGNITIVE/memory/memory.jsonl` | Same format |
| `.a2r/state/state.json` | `.a2r/L1-COGNITIVE/brain/state.json` | Same format |
| `.a2r/handoff/latest.md` | `.a2r/L1-COGNITIVE/memory/handoff.md` | Same format |
| `.a2r/compact/*.md` | `.a2r/L1-COGNITIVE/brain/batons/*.md` | Same format |
| `.a2r/conventions.json` | `.a2r/L2-IDENTITY/CONVENTIONS.md` | Markdown conversion |

## Testing

```bash
# All tests
bun test test/continuity/
bun test test/agent-workspace/  # (when added)

# 64 tests passing
# - Types: 7
# - HandoffEmitter: 9
# - DAG Tasks: 13
# - CI Gates: 25
# - Tool Parsers: 10
```

## Alignment with Kernel Architecture

| Kernel Component | Agent Workspace Equivalent |
|------------------|---------------------------|
| `HistoryLedger` | `L1-COGNITIVE/memory/memory.jsonl` |
| `SkillRegistry` | `L4-SKILLS/` |
| `ContextPack` | `ContextPackBuilder.build()` |
| `PolicyEngine` | `PolicyEngine.evaluateToolCall()` |
| `TaskGraph` | `L1-COGNITIVE/brain/taskgraph.json` |

## Future Work

- [ ] Sync with kernel ledger (`syncWithKernel()`)
- [ ] Shell UI integration (visual editors for .md files)
- [ ] Checkpoint system integration
- [ ] Shared crate extraction for CLI + Shell UI

## Key Distinction

> **agent_workspace ≠ kernel**
> 
> - **Kernel**: Authoritative, Rust, ledger, deterministic
> - **agent_workspace**: Client-side, TypeScript, markdown distillation, rehydration
> 
> The agent_workspace is the bridge between kernel state and LLM context.
