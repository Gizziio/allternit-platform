# Allternit × OpenClaw Integration: Codebase Skeleton & Architecture Mapping

**Date:** 2026-01-31  
**Status:** Pre-Integration Analysis  
**Classification:** Architecture Blueprint

---

## Executive Summary

This document provides a complete structural mapping of both Allternit (Unix-first Agentic OS) and OpenClaw (Personal AI Assistant), identifying integration points, primitive layers, and the merged architecture vision.

**Key Principle:** Allternit Kernel remains the governing authority (WIH/Beads/Law Layer/Receipts/Inspector). OpenClaw becomes a runtime substrate (sessions/tools/sandbox) integrated via controlled fork.

---

## Part 1: Allternit Architecture - LOCKED PRIMITIVES

These components are foundational and govern the integration. They are **immutable anchors**.

### 1.1 Kernel Layer (Rust - Port 3000)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Allternit KERNEL PRIMITIVES                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │   WIH PARSER    │───▶│  POLICY ENGINE  │───▶│   RECEIPT SUBSYSTEM     │ │
│  │  (Work Item     │    │  (Law Layer)    │    │  (Deterministic Log)    │ │
│  │   Header)       │    │                 │    │                         │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
│           │                      │                        │                │
│           ▼                      ▼                        ▼                │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │  BEADS GRAPH    │◀──▶│  ROUTING TABLE  │◀──▶│  ARTIFACT REGISTRY      │ │
│  │  (DAG Store)    │    │  (Canonical     │    │  (Versioned Outputs)    │ │
│  │                 │    │   Paths)        │    │                         │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────────────┘ │
│                                                                             │
│  LEGEND: These primitives are NON-MALLEABLE. OpenClaw integrates BELOW.    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**File Locations:**
- `services/kernel/src/main.rs` - Kernel service entry
- `services/kernel/src/brain/manager.rs` - Brain orchestration
- `crates/orchestration/hooks/src/lib.rs` - HookBus for gating
- `agent/` - Policy gates, tool registry, boot order (B0)

**WIH Schema (Work Item Header):**
```json
{
  "wih_id": "T0001",
  "task_type": "integration",
  "domain": "kernel",
  "blockedBy": ["T0000"],
  "produces": ["receipt"],
  "canonical_path": "/.allternit/wih/T0001.wih.json",
  "law_checks": ["pre_tool", "write_gate", "receipt_emit"]
}
```

### 1.2 Services Layer (Multi-Language)

| Service | Port | Language | Purpose | Status |
|---------|------|----------|---------|--------|
| Kernel | 3000 | Rust | Orchestration, policy | **LOCKED** |
| Framework | 3003 | Rust | Capsule runtime | **LOCKED** |
| Voice | 8001 | Python | TTS/Voice control | **STABLE** |
| WebVM | 8002 | Rust/TS | Browser Linux VM | **STABLE** |
| Browser | 8000 | Rust | WebRTC + Playwright | **STABLE** |
| AGUI Gateway | 8010 | TypeScript | Event streaming | **STABLE** |
| Copilot Runtime | 8011 | TypeScript | CopilotKit API | **STABLE** |
| A2A Gateway | 8012 | Rust | Agent discovery | **STABLE** |

### 1.3 Crates (Shared Rust Libraries)

```
crates/
├── kernel/
│   ├── tools-gateway/         # Tool execution gateway
│   ├── policy-engine/         # Law enforcement
│   └── hooks/                 # PreToolUse gating
├── orchestration/
│   ├── workflows/             # DAG execution
│   ├── hooks/                 # Event-driven gating
│   └── receipts/              # Receipt generation
├── control/
│   ├── artifact-registry/     # Artifact routing
│   └── capsule/               # Capsule runtime
└── security/
    └── evals/                 # Evaluation engine (disabled)
```

### 1.4 Apps Layer (UI - Malleable Zone)

```
apps/
├── shell/                     # React/TS Main UI
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface/
│   │   │   ├── CoworkPanel/   # Multi-agent view
│   │   │   ├── ConductorPanel/# Timeline view
│   │   │   └── BrainManagerWidget/
│   │   └── hooks/
│   │       └── brain/
│   │           └── useBrainEventCursor.ts
│   └── copilotkit-reference/  # CopilotKit integration
├── cli/                       # Rust CLI
│   └── src/commands/
│       ├── tui.rs             # TUI Cockpit
│       ├── brain_integration.rs
│       └── skills.rs
├── api/                       # Rust API server
└── shell-electron/            # Electron wrapper
```

**MALLEABLE:** The Shell UI is the primary touchpoint for OpenClaw integration.

### 1.5 Spec & Contracts Layer (Law)

```
spec/                          # MANDATORY: Canonical contract path
├── Contracts/
│   ├── WIH.schema.json        # Work Item Header schema
│   ├── Receipt.schema.json    # Receipt schema
│   ├── BootManifest.schema.json
│   ├── CapsuleManifest.schema.json
│   └── ToolRegistry.schema.json
├── Deltas/
│   ├── 0001-task-engine.md
│   ├── 0002-memory-promotion.md
│   └── 0005-capsule-runtime-mcp-host.md
└── AcceptanceTests.md         # B0 gate requirement
```

---

## Part 2: OpenClaw Architecture Analysis

### 2.1 High-Level Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OPENCLAW ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   INBOUND CHANNELS                    GATEWAY (Node.js)                     │
│   ┌─────────────┐                     ┌──────────────────────────┐         │
│   │  WhatsApp   │────────────────────▶│  WS Control Plane        │         │
│   │  Telegram   │────────────────────▶│  Port: 18789             │         │
│   │  Slack      │────────────────────▶│  Sessions/Cron/Config    │         │
│   │  Discord    │────────────────────▶│  Webhooks/Control UI     │         │
│   │  iMessage   │────────────────────▶│  Canvas Host             │         │
│   │  Signal     │────────────────────▶└──────────┬───────────────┘         │
│   │  WebChat    │───────────────────────────────┬─┘                         │
│   └─────────────┘                               │                           │
│                                                 ▼                           │
│   RUNTIME                    TOOLS            SKILLS                        │
│   ┌─────────────────┐       ┌──────────┐     ┌─────────────────┐           │
│   │  Pi Agent       │◀─────▶│  Browser │◀───▶│  Bundled        │           │
│   │  (RPC mode)     │       │  Canvas  │     │  Managed        │           │
│   │  Tool streaming │       │  Nodes   │     │  Workspace      │           │
│   └─────────────────┘       └──────────┘     └─────────────────┘           │
│                                                                             │
│   NODES (Device Local)                                                      │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                          │
│   │  macOS App  │ │  iOS Node   │ │ Android Node│                          │
│   │  Menu bar   │ │  Camera     │ │  Camera     │                          │
│   │  Voice Wake │ │  Screen rec │ │  Screen rec │                          │
│   └─────────────┘ └─────────────┘ └─────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Package Structure (Source Analysis)

```
openclaw/                      # Upstream repository
├── src/
│   ├── gateway/               # WebSocket control plane
│   │   ├── server.ts
│   │   ├── sessions.ts
│   │   └── channels/
│   ├── agent/                 # Pi agent runtime
│   │   ├── runtime.ts
│   │   └── tools/
│   ├── channels/              # Channel adapters
│   │   ├── whatsapp.ts
│   │   ├── telegram.ts
│   │   ├── slack.ts
│   │   └── discord.ts
│   ├── tools/                 # Built-in tools
│   │   ├── browser.ts
│   │   ├── canvas.ts
│   │   ├── nodes.ts
│   │   └── cron.ts
│   └── skills/                # Skills platform
│       ├── registry.ts
│       └── loader.ts
├── ui/                        # Control UI + WebChat
│   ├── src/
│   │   ├── components/
│   │   ├── canvas/
│   │   └── chat/
│   └── build/
├── cli/                       # CLI surface
│   ├── commands/
│   │   ├── gateway.ts
│   │   ├── agent.ts
│   │   ├── onboard.ts
│   │   └── doctor.ts
│   └── index.ts
└── package.json
```

### 2.3 OpenClaw Entry Points & Seams

| Entry Point | Path | Purpose | Integration Hook |
|-------------|------|---------|------------------|
| Gateway WS | `src/gateway/server.ts` | Main control plane | Allternit Kernel routing |
| Session Spawn | `src/gateway/sessions.ts` | Session lifecycle | WorkItem adapter |
| Tool Execution | `src/agent/tools/*.ts` | Tool invocation | PreToolUse gate |
| Channel Router | `src/channels/*.ts` | Message routing | Allternit Law Layer |
| Skills Loader | `src/skills/loader.ts` | Skill discovery | Allternit Marketplace |
| File Writes | `src/tools/filesystem.ts` | IO operations | Write-gate enforcement |

---

## Part 3: Integration Mapping - Allternit × OpenClaw

### 3.1 Architectural Integration Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MERGED ARCHITECTURE: Allternit + OpenClaw                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Allternit KERNEL (GOVERNING LAYER)                                        │
│  ╔═══════════════════════════════════════════════════════════════════════╗ │
│  ║  WIH Parser ◀──▶ Policy Engine ◀──▶ Receipt Subsystem                ║ │
│  ║       │              │                    │                          ║ │
│  ║       ▼              ▼                    ▼                          ║ │
│  ║  Beads Graph ◀──▶ Routing Table ◀──▶ Artifact Registry              ║ │
│  ╚═══════╪════════════════════════════════════════════╪═════════════════╝ │
│          │                                            │                    │
│          │         ADAPTER LAYER                      │                    │
│          │    ┌──────────────────────┐               │                    │
│          │    │ packages/allternit-runtime │               │                    │
│          │    │    -openclaw/        │               │                    │
│          │    │                      │               │                    │
│          │    │ WorkItem ◀──▶ OpenClaw│               │                    │
│          │    │   Session Adapter      │               │                    │
│          │    └──────────┬───────────┘               │                    │
│          │               │                           │                    │
│          ▼               ▼                           ▼                    │
│  OPENCLAW RUNTIME (SUBSTRATE LAYER)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Gateway (WS) ◀──▶ Pi Agent ◀──▶ Tools ◀──▶ Skills                  │ │
│  │       │                                           │                 │ │
│  │       ▼                                           ▼                 │ │
│  │  Channels (Multi)                           Browser/Canvas          │ │
│  │  WhatsApp/Telegram/Slack/Discord/etc.                             │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  UI CONSOLIDATION (Allternit Shell absorbs OpenClaw UI)                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Allternit Shell UI                                                      │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │ │
│  │  │  Chat   │ │ Cowork  │ │Conductor│ │Channels │ │ Skills  │      │ │
│  │  │(Primary)│ │(Agents) │ │(Timeline│ │(OpenClaw│ │(OpenClaw│      │ │
│  │  │         │ │         │ │   DAG)  │ │Adapter) │ │Adapter) │      │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Mapping Matrix

| OpenClaw Component | Maps To Allternit | Integration Strategy | Status |
|-------------------|-------------|---------------------|--------|
| Gateway WS Server | AGUI Gateway + Kernel | Runtime adapter | New pkg |
| Pi Agent Runtime | Brain Runtime | Subprocess wrapper | Adapter |
| Session Manager | Brain Manager | WIH binding | Adapter |
| Channels (all) | Allternit Channel Service | Plugin architecture | New svc |
| Browser Tool | Browser Service (8000) | Direct reuse | Existing |
| Canvas/A2UI | Shell Canvas components | Merge/extend | Hybrid |
| Skills Registry | Allternit Marketplace | Consolidate | Merge |
| Tools Registry | Tool Gateway | Add OpenClaw tools | Extend |
| Cron/Wakeups | Allternit Scheduler | Adapter | New svc |
| Nodes (device) | Allternit Nodes | Keep both, unify API | Hybrid |
| macOS App | Shell Electron | Merge features | Hybrid |

### 3.3 Data Flow: WorkItem → OpenClaw Session

```
Allternit WorkItem (WIH)
       │
       ▼
┌─────────────────────┐
│  packages/allternit-      │
│  runtime-openclaw   │
│                     │
│  1. Parse WIH       │
│  2. Check Law       │
│  3. Route artifacts │
│  4. Spawn receipt   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  OpenClaw Gateway   │
│  Session.spawn()    │
│  - agent config     │
│  - channel routing  │
│  - skill context    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  Pi Agent Runtime   │◀───▶│  Tools (browser,    │
│  - tool streaming   │     │  canvas, nodes)     │
│  - block streaming  │     │                     │
└──────────┬──────────┘     └─────────────────────┘
           │
           │ Events
           ▼
┌─────────────────────┐
│  Allternit Receipt System │
│  - tool_calls       │
│  - outputs          │
│  - artifacts        │
└─────────────────────┘
```

### 3.4 File Governance: Write Gate Integration

```
OpenClaw Tool Execution
         │
         ▼
┌──────────────────────┐
│ extensions/allternit-      │
│ lawlayer/            │
│                      │
│ Hook: pre_tool_use   │
│ - Check allowlist    │
│ - Validate paths     │
│ - Compute canonical  │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌────────┐  ┌─────────────┐
│ ALLOW  │  │   DENY      │
│        │  │             │
│ Write  │  │ Quarantine  │
│ to     │  │ to inbox/   │
│ canonical│  │ ROUTE_ME    │
│ path   │  │             │
└────────┘  └─────────────┘
```

---

## Part 4: New Package Structure (Post-Integration)

### 4.1 Additive Packages (New)

```
packages/
├── allternit-kernel/                    # Allternit Kernel contracts
│   ├── src/
│   │   ├── wih/
│   │   │   ├── parser.ts
│   │   │   └── validator.ts
│   │   ├── law/
│   │   │   ├── policy.ts
│   │   │   └── checks.ts
│   │   ├── receipts/
│   │   │   ├── schema.ts
│   │   │   └── writer.ts
│   │   └── routing/
│   │       └── canonical.ts
│   └── package.json
│
├── allternit-runtime-openclaw/          # OpenClaw adapter
│   ├── src/
│   │   ├── adapter/
│   │   │   ├── workitem.ts
│   │   │   ├── session.ts
│   │   │   └── status.ts
│   │   ├── bridge/
│   │   │   ├── gateway.ts
│   │   │   └── events.ts
│   │   └── receipts/
│   │       ├── collector.ts
│   │       └── streamer.ts
│   └── package.json
│
└── allternit-shell-extensions/          # UI enhancements
    ├── src/
    │   ├── channels/
    │   │   └── OpenClawChannelPanel.tsx
    │   ├── skills/
    │   │   └── OpenClawSkillCard.tsx
    │   └── canvas/
    │       └── A2UICanvas.tsx
    └── package.json
```

### 4.2 Extensions Directory (New)

```
extensions/
└── allternit-lawlayer/
    ├── src/
    │   ├── hooks/
    │   │   ├── pre_tool.ts
    │   │   ├── write_gate.ts
    │   │   └── receipt_emit.ts
    │   ├── config/
    │   │   └── allowed_roots.json
    │   └── janitor/
    │       ├── quarantine.ts
    │       └── organizer.ts
    └── package.json
```

### 4.3 Skills Directory (New)

```
skills/
└── allternit/
    ├── filesystem/
    │   ├── SKILL.md
    │   └── index.ts
    ├── shell/
    │   ├── SKILL.md
    │   └── index.ts
    └── openclaw-bridge/
        ├── SKILL.md
        └── index.ts
```

---

## Part 5: Repository Layout (Post-Fork)

```
allternit-openclaw/           # Merged repository
├── docs/
│   └── integration/
│       ├── VENDOR_MAP.md          # Entrypoints & seams
│       ├── FORK_SYNC_POLICY.md    # Upstream update rules
│       ├── ALLTERNIT_OPENCLAW_INTEGRATION_PLAN.md
│       └── UI_CONSOLIDATION_MAP.md
│
├── packages/                      # ADDITIVE
│   ├── allternit-kernel/
│   ├── allternit-runtime-openclaw/
│   └── allternit-shell-extensions/
│
├── apps/
│   ├── allternit-shell/                 # NEW: Consolidated UI
│   │   ├── src/
│   │   │   ├── views/
│   │   │   │   ├── WorkItems.tsx
│   │   │   │   ├── AgentRoster.tsx
│   │   │   │   ├── Inspector.tsx
│   │   │   │   └── Scheduler.tsx
│   │   │   └── integrations/
│   │   │       ├── openclaw/
│   │   │       │   └── ChannelPanel.tsx
│   │   │       └── marketplace/
│   │   │           └── SkillBrowser.tsx
│   │   └── package.json
│   ├── shell/                     # ORIGINAL (deprecated)
│   ├── cli/                       # ORIGINAL
│   └── api/                       # ORIGINAL
│
├── extensions/
│   └── allternit-lawlayer/              # NEW
│
├── skills/
│   └── allternit/                       # NEW
│
├── upstream/                      # VENDOR (read-only)
│   └── openclaw/                  # Git submodule or subtree
│       ├── src/
│       ├── ui/
│       └── cli/
│
├── patches/                       # PATCH QUEUE
│   ├── 0001-openclaw-wih-hooks.patch
│   ├── 0002-openclaw-receipts.patch
│   └── 0003-openclaw-write-gate.patch
│
├── services/                      # Allternit ORIGINAL
├── crates/                        # Allternit ORIGINAL
├── spec/                          # Allternit ORIGINAL
└── .git/
    ├── origin                     # Our fork
    └── upstream                   # openclaw/openclaw
```

---

## Part 6: Integration Boundaries & Contracts

### 6.1 Safe Divergence Zones

| Zone | Allowed Changes | Examples |
|------|----------------|----------|
| `packages/allternit-*` | Full create | New kernel packages |
| `apps/allternit-*` | Full create | New shell UI |
| `extensions/` | Full create | Law layer hooks |
| `skills/` | Full create | Deterministic skills |
| `patches/` | Additive only | Minimal patches |
| `upstream/` | None (read-only) | Vendor code |

### 6.2 High-Conflict Zones (AVOID)

| Zone | Risk Level | Strategy |
|------|------------|----------|
| `upstream/src/` | HIGH | Use patches/ only |
| `upstream/ui/` | HIGH | Override in allternit-shell |
| `services/kernel/` | CRITICAL | Never touch - adapter only |
| `crates/orchestration/` | CRITICAL | Never touch - adapter only |

### 6.3 Contract Boundaries

```typescript
// packages/allternit-runtime-openclaw/src/contracts.ts

// Allternit → OpenClaw
interface WorkItemToSession {
  wih: WIHHeader;
  agent_config: OpenClawAgentConfig;
  channel_routing: ChannelConfig;
  skill_context: SkillContext;
}

// OpenClaw → Allternit
interface SessionReceipt {
  wih_id: string;
  session_id: string;
  tool_calls: ToolCallReceipt[];
  artifacts: Artifact[];
  status: 'completed' | 'failed' | 'needs_human';
}

// Artifact routing
interface ArtifactRoute {
  type: 'file' | 'canvas' | 'message';
  canonical_path: string;
  wih_glob: string;
}
```

---

## Part 7: Compliance Alignment

### 7.1 Addressing Allternit Audit Gaps

| Audit Finding | OpenClaw Integration Solution |
|--------------|------------------------------|
| Missing SOT.md | Create at root per integration |
| Missing CODEBASE.md | Generate from merged structure |
| No WIH/Beads on DAG nodes | Adapter injects WIH at session spawn |
| No receipts subsystem | Runtime adapter generates receipts |
| PreToolUse only logs | Law layer extension adds gating |
| Tool exec unsandboxed | Write-gate enforcement in adapter |
| Port sprawl | Gateway consolidation in allternit-runtime |
| Auth bypass on endpoints | Remove bypass, use Allternit auth |
| Python exec() unsafe | Wrap with subprocess sandbox |

### 7.2 OpenClaw Features Mapping to Allternit Compliance

| OpenClaw Feature | Allternit Compliance Mapping |
|-----------------|----------------------|
| DM pairing | Allternit Policy Engine rule |
| Sandbox mode | Allternit Capsule runtime |
| Workspace isolation | Allternit Canonical paths |
| Skills gating | Allternit Law Layer check |
| Session isolation | Allternit Brain runtime |

---

## Appendix A: File Index

### Critical Files (Must Not Change)
- `services/kernel/src/main.rs`
- `services/kernel/src/brain/manager.rs`
- `crates/orchestration/hooks/src/lib.rs`
- `crates/kernel/tools-gateway/src/lib.rs`

### Integration Points (Adapter Layer)
- `packages/allternit-runtime-openclaw/src/adapter/workitem.ts`
- `packages/allternit-runtime-openclaw/src/bridge/gateway.ts`
- `extensions/allternit-lawlayer/src/hooks/pre_tool.ts`

### UI Consolidation Points
- `apps/allternit-shell/src/integrations/openclaw/ChannelPanel.tsx`
- `apps/allternit-shell/src/views/AgentRoster.tsx`

### Vendor Files (Read-Only)
- `upstream/openclaw/src/gateway/server.ts`
- `upstream/openclaw/src/agent/runtime.ts`
- `upstream/openclaw/src/channels/*.ts`

---

**End of Codebase Skeleton Document**

*Next: See ALLTERNIT_OPENCLAW_PHASED_PLAN.md for implementation phases and dependency DAGs*
