# COMPREHENSIVE BRAINSTORM GAP ANALYSIS

**Date:** 2026-02-20  
**Purpose:** Map ALL brainstorm session files against current DAG tasks  
**Finding:** 12 MAJOR capabilities missing from DAG

---

## Executive Summary

After analyzing ALL brainstorm session files, I found **12 major capability gaps** that were discussed but NOT added to the DAG tasks:

| # | Capability | Source File | Priority | Effort |
|---|------------|-------------|----------|--------|
| 1 | **MCP Apps / Interactive Capsules** | mcp-apps.md | 🔴 HIGH | 3 weeks |
| 2 | **Playground System** | playgrounda2r.md | 🔴 HIGH | 3 weeks |
| 3 | **Chrome Extension (Browser Capsule)** | A2R_Chrome_Extension_Map.md | 🔴 HIGH | 4 weeks |
| 4 | **Avatar Engine (AVSP)** | A2R_Session_2026-02-18_Avatar_Engine.md | 🟡 MEDIUM | 2 weeks |
| 5 | **Operator (Browser-use) Tools** | a2r-session-2026-02-18-operator-mapping.md | 🔴 HIGH | 3 weeks |
| 6 | **Evolution Layer (ALMA/SkillRL)** | a2r-evolution-layer-blueprint.md | 🔴 HIGH | 6 weeks |
| 7 | **JSON Render / UGI** | a2r-session__json-render-UGI__2026-02-18.md | 🟡 MEDIUM | 3 weeks |
| 8 | **Form Surfaces** | a2r-session-form-surfaces.md | 🟡 MEDIUM | 2 weeks |
| 9 | **Agent Teams (Multi-Agent Runtime)** | agent-teams.md | ✅ IN DAG (P2.1) | - |
| 10 | **Context Control (OneContext/GCC)** | contextcontrol.md | 🔴 HIGH | 4 weeks |
| 11 | **Prompt Caching Doctrine** | a2r-session__prompt-caching-doctrine__2026-02-19.md | 🟡 MEDIUM | 2 weeks |
| 12 | **Output Studio** | A2R_SESSION_SUMMARY_OutputStudio_Marketplace.md | ✅ IN DAG (P3.2) | - |

**Total New Work:** 29 weeks (if all implemented)

---

## Gap 1: MCP Apps / Interactive Capsules

**Source:** `mcp-apps.md`

**What It Is:**
- Tools return interactive UI surfaces (not just text/JSON)
- Host renders sandboxed HTML surfaces
- Bidirectional bridge: tool data → UI, UI → tool invocation
- Becomes "stateful interactive capsules"

**A2R Mapping:**
| MCP Apps Concept | A2R Equivalent |
|-----------------|----------------|
| Tool UI resource | Capsule UI Module |
| Host bridge | A2R Runtime Bridge |
| Sandboxed iframe | Hardened Capsule Frame |
| Tool invocation from UI | Intent-Tagged Agent Action |
| Inline chat embedding | Agent Studio Surface |

**Missing from DAG:** ❌

**New Tasks to Add:**
```
P3.9: MCP Apps Integration (3 weeks)
  - Capsule UI contract definition
  - Runtime bridge API
  - Permission model
  - Event schema
  - Threat model
  - Review harness integration
```

---

## Gap 2: Playground System

**Source:** `playgrounda2r.md`

**What It Is:**
- Visual interaction layer for complex agent workflows
- Bidirectional bridge between HUMAN and AGENT renderers
- Structured output surface (prompts + patches + receipts)
- Living Artifact layer

**Core Templates:**
1. Site Structure Audit Playground
2. Component Variation Playground
3. Copy Review Playground
4. Codebase Architecture Map Playground
5. Diff Review Playground (HIGH PRIORITY)
6. Rive Playground

**Runtime Model:**
```
Browser (HUMAN Capsule)
  POST → /a2r/playground/<id>/event
  POST → /a2r/playground/<id>/submit

Local Relay (Shell Embedded)
  - Stores state
  - Emits observability events
  - Exposes watch interface to agents

Agent Runner Tools
  - playground.watch({id})
  - playground.open({id})
```

**Missing from DAG:** ❌ (partially added in PLAYGROUND_DAG_ADDENDUM.md)

**Status:** ✅ Added as P3.6, P3.7, P3.8

---

## Gap 3: Chrome Extension (Browser Capsule)

**Source:** `A2R_Chrome_Extension_Map.md`

**What It Is:**
- Chrome extension as "Browser Capsule" edge executor
- MV3 architecture (service worker + content script + approval UI)
- Native Messaging or WebSocket transport
- Tool contracts: BROWSER.GET_CONTEXT, BROWSER.ACT, BROWSER.NAV, etc.

**Safety Model:**
- Host allowlist (default deny)
- Human-in-loop gates for high-risk actions
- Circuit breakers (runtime-level)
- Data minimization (no password/2FA exfiltration)

**Missing from DAG:** ❌

**New Tasks to Add:**
```
P3.10: Chrome Extension / Browser Capsule (4 weeks)
  - MV3 extension architecture
  - Native Messaging host
  - Tool contracts (BROWSER.*)
  - Safety model implementation
  - Receipt integration
  - Observability timeline
```

---

## Gap 4: Avatar Engine (AVSP)

**Source:** `A2R_Session_2026-02-18_Avatar_Engine.md`

**What It Is:**
- A2R Visual State Protocol (AVSP)
- Agent mood/intensity/confidence/reliability taxonomy
- Telemetry → mood mapping
- Adapter architecture (clawd-react as adapter, not foundation)

**Packages:**
```
packages/
  a2r-visual-state/     # AVSP types, schemas, mapping utilities
  a2r-avatar/           # core avatar React components
  a2r-avatar-adapters/  # adapters for external mascot kits
  a2r-remotion/         # Remotion helpers
```

**Missing from DAG:** ❌

**New Tasks to Add:**
```
P3.11: Avatar Engine / AVSP (2 weeks)
  - AVSP types + JSON schema
  - Telemetry → mood mapping
  - Core avatar component
  - Adapter architecture (clawd, etc.)
  - Integration with Chat, Dashboard, Marketplace
```

---

## Gap 5: Operator (Browser-use) Tools

**Source:** `a2r-session-2026-02-18-operator-mapping.md`

**What It Is:**
- `desktop_control` tool (existing via a2r-operator)
- `browser_control` tool (NEW - sibling tool)
- Unified Operator capsule interface
- Single event protocol for both

**Browser Operations:**
- browser_control.open(url)
- browser_control.click(selector | text | role)
- browser_control.type(selector, text)
- browser_control.extract(selector | querySpec)
- browser_control.wait(condition)
- browser_control.screenshot()

**Missing from DAG:** ❌

**New Tasks to Add:**
```
P3.12: Browser-use / Operator Browser Tool (3 weeks)
  - browser_control tool family
  - Playwright/CDP integration
  - Unified event stream
  - Safety + capability gates
  - Receipt schema extension
  - A2UI timeline renderer
```

---

## Gap 6: Evolution Layer

**Source:** `a2r-evolution-layer-blueprint.md`

**What It Is:**
- Memory Evolution Engine (MEE) - ALMA-style
- Skill Evolution Engine (SEE) - SkillRL-style
- Confidence-Based Routing Layer (CRL) - AdaptEvolve-style
- Organizational Evolution Engine (OEE) - Agyn-style
- Trajectory Optimization Engine (TOE) - InftyThink-style

**Architecture:**
```
Agent Studio
    ↓
Evolution Layer
    ↓
Execution Kernel
    ↓
Rails
```

**5 Engines:**
1. Memory Evolution (schema competition + evaluation)
2. Skill Evolution (trajectory distillation → SkillBank)
3. Confidence Routing (small → mid → frontier model escalation)
4. Organizational Evolution (dynamic workflow mutation)
5. Trajectory Optimization (iterative boundary controller)

**Missing from DAG:** ❌

**New Tasks to Add:**
```
P4.7: Evolution Layer (6 weeks)
  - Observability substrate
  - Iteration controller
  - Confidence routing
  - Skill extraction pipeline
  - Memory schema runtime
  - Organizational workflow mutation
```

---

## Gap 7: JSON Render / UGI

**Source:** `a2r-session__json-render-UGI__2026-02-18.md`

**What It Is:**
- Vercel Labs json-render integration
- Declarative UI execution engine
- JSON → UI components with:
  - Stateful runtime
  - Expression evaluation
  - Two-way binding
  - Event system
  - RFC 6902 JSON Patch updates
  - Catalog-aware prompting

**A2R Mapping:**
- Layer: Interaction Plane (Human ↔ Agent)
- A2R-IX (Interface eXecution) kernel
- UI IR (JSON tree validated against schema)
- Catalog Registry (versioned components/actions)
- State Store (scoped per capsule/agent/user)
- Patch Engine (RFC 6902 + audit log)
- Policy Gate (action execution permissions)

**Missing from DAG:** ❌

**New Tasks to Add:**
```
P3.13: JSON Render / UGI Integration (3 weeks)
  - A2R-IX UI IR schema
  - Catalog registry format
  - Patch audit log + replay
  - Capsule runtime integration
  - Policy gate integration
  - CI tests for schema conformance
```

---

## Gap 8: Form Surfaces

**Source:** `a2r-session-form-surfaces.md`

**What It Is:**
- Forms as first-class agent communication surface
- Dynamic schema with versioning + diffs
- Answer locks (prevent agent override)
- Invalidation graph (selective re-ask)
- Two-mode UX (guided vs advanced)

**Surface Family:**
- ChatSurface (existing)
- FormSurface (NEW)
- DocSurface (optional)
- DiffSurface (optional)
- DashboardSurface (future)

**MVP Flow:** "New Project Spec Intake"
- Renders form intake surface
- Captures answers into Answer Store
- Emits: /spec/Vision.md, /spec/Requirements.md, /spec/AcceptanceTests.md

**Missing from DAG:** ❌

**New Tasks to Add:**
```
P3.14: Form Surfaces (2 weeks)
  - surface.render(form) protocol
  - SurfaceHost + FormRenderer
  - Answer Store + schema registry
  - Invalidation graph
  - Artifact emitters (Vision/Requirements/Acceptance)
```

---

## Gap 9: Agent Teams (Multi-Agent Runtime)

**Source:** `agent-teams.md`

**Status:** ✅ **ALREADY IN DAG** (P2.1: Swarm Scheduler Core)

**What Was Discussed:**
- Claude Code Agent Teams analysis
- Persistent multi-agent runtime
- Task DAG coordination
- Filesystem-backed IPC
- Lead orchestration model
- Supervisor lifecycle control

**Already Covered By:**
- P2.1: Swarm Scheduler Core ✅
- P2.2: Worker Supervisor ✅
- P4.1: Swarm Scheduler Advanced Features ✅

---

## Gap 10: Context Control (OneContext/GCC)

**Source:** `contextcontrol.md`

**What It Is:**
- Git Context Controller (GCC) implementation
- Context as first-class object (not chat history)
- Versioned memory ops: commit/branch/merge/context
- Multi-resolution retrieval: summary → state → traces
- Handoff mechanism (share context as artifact)

**Filesystem Layout:**
```
.a2r/
  context/
    contexts/<context_id>/
      context.md
      state.json
      branches/<branch_id>/
        summary.md
        commits/<ts>-<hash>/
          commit.md
          traces.ndjson
          artifacts/
          patchset/
      index.json
      share/
        bundles/<bundle_id>.tar.zst
```

**Tool Contracts:**
- ctx.commit(context_id, branch_id, message, evidence_refs[])
- ctx.branch(context_id, from_branch_id, new_branch_id, intent)
- ctx.merge(context_id, source_branch_id, target_branch_id, strategy)
- ctx.context(context_id, branch_id, query, resolution, time_range?)

**Missing from DAG:** ❌

**New Tasks to Add:**
```
P4.8: Context Control Plane (4 weeks)
  - Context filesystem layout
  - Tool contracts (commit/branch/merge/context)
  - Multi-resolution retrieval
  - Share/export bundle system
  - Garbage collection policy
  - UI context browser
```

---

## Gap 11: Prompt Caching Doctrine

**Source:** `a2r-session__prompt-caching-doctrine__2026-02-19.md`

**What It Is:**
- Cache-safe Living Files architecture
- Cache observability dashboard
- Swarm scheduler cache-aware economics
- Cache-safe compaction protocol

**Already Discussed:** ✅ Added in PROMPT_CACHING_DAG_ADDENDUM.md

**Status:** ✅ Tasks added (P0.9, P1.9, P1.10, P2.9, P2.10, P2.11, P3.9)

---

## Gap 12: Output Studio

**Source:** `A2R_SESSION_SUMMARY_OutputStudio_Marketplace.md`

**Status:** ✅ **ALREADY IN DAG** (P3.2: Output Studio Implementation)

---

## Summary: New Work Required

### 🔴 HIGH Priority (Missing from DAG)

| Task | Effort | Priority |
|------|--------|----------|
| P3.9: MCP Apps Integration | 3 weeks | 🔴 HIGH |
| P3.10: Chrome Extension | 4 weeks | 🔴 HIGH |
| P3.12: Browser-use Tools | 3 weeks | 🔴 HIGH |
| P4.7: Evolution Layer | 6 weeks | 🔴 HIGH |
| P4.8: Context Control | 4 weeks | 🔴 HIGH |

**Subtotal:** 20 weeks

---

### 🟡 MEDIUM Priority (Missing from DAG)

| Task | Effort | Priority |
|------|--------|----------|
| P3.11: Avatar Engine | 2 weeks | 🟡 MEDIUM |
| P3.13: JSON Render / UGI | 3 weeks | 🟡 MEDIUM |
| P3.14: Form Surfaces | 2 weeks | 🟡 MEDIUM |

**Subtotal:** 7 weeks

---

### ✅ Already in DAG

| Task | Status |
|------|--------|
| P3.6-3.8: Playground System | ✅ Added |
| P3.2: Output Studio | ✅ Already there |
| P2.1: Agent Teams / Swarm | ✅ Already there |
| Prompt Caching | ✅ Added via addendum |

---

## Revised Total DAG Scope

### Original DAG:
- P0: 10 tasks ✅
- P1: 13 tasks ✅
- P2: 13 tasks ✅
- P3: 5 tasks
- P4: 6 tasks
- **Total:** 47 tasks

### With New Capabilities:
- P0: 10 tasks ✅
- P1: 13 tasks ✅
- P2: 13 tasks ✅
- P3: 5 + 6 = 11 tasks
- P4: 6 + 2 = 8 tasks
- **NEW TOTAL:** 52 tasks (+5 new capabilities)

### Revised Timeline:
- P0-P2: ✅ Complete (5 weeks actual)
- P3: 11 tasks → 19 weeks (was 12 weeks)
- P4: 8 tasks → 19 weeks (was 13 weeks)
- **NEW TOTAL:** 43 weeks remaining (was 25 weeks)

---

## Recommendation

### Option 1: Full Implementation (43 weeks)
Implement all 12 capabilities.

**Pros:**
- Complete platform
- All differentiators
- Maximum value

**Cons:**
- 10+ months of work
- High complexity

---

### Option 2: High-Priority Only (25 weeks)
Implement only 🔴 HIGH priority gaps:
- P3.9: MCP Apps
- P3.10: Chrome Extension
- P3.12: Browser-use Tools
- P4.7: Evolution Layer
- P4.8: Context Control

**Pros:**
- Core differentiators
- Manageable scope

**Cons:**
- Still 6 months of work

---

### Option 3: Deploy Current State (1-2 weeks)
Deploy what's already built (P0-P2 complete).

**Pros:**
- Immediate validation
- User feedback
- Revenue potential

**Cons:**
- Missing advanced features

---

**My Recommendation:** Option 3 → Option 2

1. Deploy current state (P0-P2) for validation
2. Based on feedback, prioritize HIGH priority gaps
3. Iterate based on user needs

---

**End of Gap Analysis**
