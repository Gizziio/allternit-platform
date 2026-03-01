# A2rchitech Consolidated Buildout Plans

**Document Purpose:** This document consolidates all orphaned planning documents, session notes, and incomplete specifications into actionable buildout plans.

**Created:** 2026-02-18  
**Last Updated:** 2026-02-18 (Post-Audit)  
**Source:** Extracted from 50+ orphaned planning documents across the docs folder  
**Status:** Updated with codebase audit findings

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Implementation Status](#current-implementation-status)
3. [Phase 0: Critical Fixes](#phase-0-critical-fixes)
4. [Phase 1: Agent Studio Enhancement](#phase-1-agent-studio-enhancement)
5. [Phase 2: CLI/TUI Unified Console](#phase-2-clitui-unified-console)
6. [Phase 3: WASM Agentic OS](#phase-3-wasm-agentic-os)
7. [Phase 4: UI Integration & Recovery](#phase-4-ui-integration--recovery)
8. [Phase 5: Voice Implementation](#phase-5-voice-implementation)
9. [Phase 6: OpenClaw Integration](#phase-6-openclaw-integration)
10. [Implementation Priority Matrix](#implementation-priority-matrix)

---

## Executive Summary

### Current State (Post-Audit 2026-02-18)

The A2rchitech codebase has:
- ✅ **Core architecture implemented** (7-layer architecture, services, kernel) - **90% complete**
- ✅ **React UI shell built** - **85% complete** with 61 AI Elements components
- ✅ **Electron wrapper complete** (BrowserView support, IPC)
- ✅ **CLI/TUI foundation** (Rust-based CLI, terminal UI)
- ✅ **Kernel components** (WASM runtime, capsule system, DAK runner)
- ✅ **8 major services running** (Operator, Voice, Memory, Registry, Kernel, Gateway, Prompt Pack, Pattern)
- ⚠️ **Integration gaps** (backend wiring incomplete) - **Critical**
- ⚠️ **Missing services** (Policy Service:3003, Task Executor:3510) - **Critical**
- ⚠️ **Voice components exist but NOT integrated** - **High Priority**

### Implementation Progress by Layer

| Layer | Complete | Partial | Missing | Status |
|-------|:--------:|:-------:|:-------:|--------|
| UI (6-ui/) | 85% | 10% | 5% | 🟡 Good |
| Services (4-services/) | 80% | 5% | 15% | 🔴 Needs Work |
| Kernel (1-kernel/) | 90% | 10% | 0% | 🟢 Excellent |
| Apps (7-apps/) | 85% | 5% | 10% | 🟡 Good |
| Agents (5-agents/) | 95% | 5% | 0% | 🟢 Excellent |

**Overall: 87% Complete**

### Critical Findings (NEW - Post-Audit)

1. **Documentation Drift**: ARCHITECTURE.md claims services that don't exist (Policy:3003, Task Executor:3510)
2. **Voice Integration Gap**: Components exist (VoiceOverlay, VoiceSelector) but NOT wired to message flow
3. **Backend Wiring**: UI components complete but polling/streaming not implemented
4. **Model Picker**: ✅ Actually IMPLEMENTED at `src/components/model-picker.tsx`
5. **Browser Capsule**: ✅ Actually IMPLEMENTED (3 versions: standard, enhanced, real)

### Revised Gaps (Verified)

1. **P0 - Critical**:
   - Voice integration NOT wired (components exist)
   - ARCHITECTURE.md outdated (claims non-existent services)
   - Tool invocation backend polling not implemented
   
2. **P1 - High**:
   - Plan visualization not streamed from backend
   - Error StackTrace display not implemented
   - Onboarding wizard not implemented
   - RAG sources panel not wired
   
3. **P2 - Medium**:
   - Test results streaming not implemented
   - TTS audio player not wired to message flow
   - Confirmation dialogs not wired
   - Commit operations not wired

---

## Phase 0: Critical Fixes (NEW - Post-Audit)

**Duration:** 1 week  
**Priority:** P0 - Critical  
**Goal:** Fix documentation drift and complete critical voice integration

### 0.1 Update ARCHITECTURE.md

**Status:** ❌ Outdated  
**Required:** Remove or implement missing services

**Actions:**
1. Remove Policy Service (port 3003) - NOT FOUND in codebase
2. Remove Task Executor (port 3510) - NOT FOUND in codebase
3. Verify all port assignments against actual implementations
4. Add verified port registry

**Files to Modify:**
- `/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/ARCHITECTURE.md`

### 0.2 Complete Voice Integration

**Status:** ⚠️ Components exist but NOT wired  
**Required:** Wire voice into message flow

**Components Available:**
- ✅ `VoiceOverlay.tsx` - Voice recording overlay
- ✅ `VoiceSelector.tsx` - Voice selection UI
- ✅ `speech-input.tsx` - Speech input component
- ✅ Voice Service running on port 8001

**What's Missing:**
- ❌ Integration with ChatView message input
- ❌ TTS audio player wiring to message flow
- ❌ Speech-to-text input pipeline

**Files to Modify:**
- `6-ui/a2r-platform/src/views/chat/ChatViewWrapper.tsx` - Add voice input button
- `6-ui/a2r-platform/src/components/ai-elements/` - Wire audio player
- `6-ui/a2r-platform/src/integration/voice/` - Complete voice pipeline

### 0.3 Backend Wiring for Tool Invocation

**Status:** ⚠️ UI exists, backend polling missing  
**Required:** Implement tool invocation polling from Rails

**Components Available:**
- ✅ `Tool.tsx` - Tool invocation display
- ✅ RunnerView with DAK store
- ✅ Rails API client

**What's Missing:**
- ❌ Polling logic for tool invocation status
- ❌ Event streaming from Rails ledger

**Files to Modify:**
- `6-ui/a2r-platform/src/runner/` - Add backend polling
- `6-ui/a2r-platform/src/integration/rails/` - Add event streaming

### Acceptance Criteria

- [ ] ARCHITECTURE.md updated with accurate service status
- [ ] Voice button visible in ChatView
- [ ] Voice recording triggers TTS/STT pipeline
- [ ] Tool invocations show live status updates
- [ ] Port registry verified and documented

---

## Phase 1: Agent Studio Enhancement

**Source Documents:**
- `/docs/strategy/AGENT_STUDIO_GAME_PLAN.md`
- `/docs/strategy/AGENT_STUDIO_REALITY_CHECK.md`
- `/docs/strategy/AGENT_STUDIO_SERVICE_MAPPING.md`

### Overview

**Goal:** Fully functional Agent Studio with Rails integration, voice support, and agent communication

**Status:** ✅ UI shell COMPLETE, ⚠️ backend integration incomplete

### Current Implementation Status (Post-Audit)

**What's Actually Implemented:**
- ✅ AgentStudio.tsx - Main studio component
- ✅ InstanceManagementPanel - Agent instance management
- ✅ ApprovalQueuePanel - Approval workflow UI
- ✅ TelemetryPanel - Telemetry display
- ✅ DebugTracePanel - Debug tracing
- ✅ VoiceSelector - Voice selection component (NOT wired)
- ✅ ModelPicker - Model selection component

**What's Missing:**
- ❌ Voice settings integration with agent creation
- ❌ Agent type differentiation UI
- ❌ Rails DAG execution pipeline wiring
- ❌ Prompt pack browser integration

### 1.1 Voice Settings Integration

**Current:** No voice settings in agent creation
**Required:** Add voice selection and persona configuration

#### Implementation

```typescript
// Add to CreateAgentInput type
interface CreateAgentInput {
  // ... existing fields
  voice?: {
    voiceId: string;        // From voice service
    speed: number;          // 0.5 - 2.0
    pitch: number;          // -10 to +10
    persona?: string;       // "professional", "friendly", "technical"
  };
  personaTemplate?: string;  // Pre-defined persona
}
```

#### Files to Modify
- `agent.types.ts` - Add voice config types
- `CreateAgentForm` - Add voice UI section
- `agent.service.ts` - Add voice config methods
- `6-apps/api/src/agents.rs` - Add voice endpoints

### 1.2 Agent Type Differentiation

**Current:** All agents are the same type
**Required:** Orchestrator, Sub-agent, Worker, Reviewer types

```typescript
enum AgentType {
  ORCHESTRATOR = 'orchestrator',  // Coordinates other agents
  SUB_AGENT = 'sub-agent',        // Child of orchestrator
  WORKER = 'worker',              // Executes tasks
  REVIEWER = 'reviewer',          // Reviews/approves work
  STANDALONE = 'standalone'       // Independent agent
}
```

### 1.3 Rails Integration (Critical)

**Current:** `startRun()` creates DAG but doesn't execute

**Required Execution Flow:**
```
User Input
    ↓
Agent Studio UI
    ↓
1. Create DAG (Rails) - POST /api/v1/rails/v1/plan
    ↓
2. Create WIHs (Rails) - Automatic from DAG
    ↓
3. Pick up WIH (Rails) - POST /api/v1/rails/v1/wihs/pickup
    ↓
4. Execute via Kernel - POST /api/v1/sessions
    ↓
5. Stream events (Ledger) - GET /api/v1/rails/v1/ledger/tail
    ↓
6. Update WIH status (Rails) - POST /api/v1/rails/v1/wihs/:id/close
```

### 1.4 Prompt Pack Integration

**New Service Required:** `4-services/prompt-pack/`

```
Endpoints:
GET  /api/v1/prompts              - List all prompts
GET  /api/v1/prompts/:id          - Get prompt details
POST /api/v1/prompts/:id/execute  - Execute prompt with params
GET  /api/v1/categories           - List categories
GET  /api/v1/tags                 - List tags
```

### 1.5 Agent Communication (Rails Mail)

**Required UI Components:**
1. Thread List - Shows all conversations
2. Message View - Shows messages in thread
3. Compose - Send new message
4. Reviews - Handle review requests
5. Attachments - Share files/context

### Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 1.1 - Voice | 2 days | Voice selector, API endpoints |
| 1.2 - Agent Types | 2 days | Type selector, hierarchy |
| 1.3 - Run Execution | 5 days | Working pipeline, event streaming |
| 1.4 - Prompt Pack | 4 days | Service, browser, integration |
| 1.5 - Communication | 4 days | Mail UI, messaging |

**Total: ~3 weeks**

---

## Phase 2: CLI/TUI Unified Console

**Source Documents:**
- `/docs/audit_/archive/for-deletion/ACTION_PLAN_CLI_TUI_UNIFIED.md`
- `/docs/strategy/OPENCLAW_CLI_TUI_GAP_ANALYSIS.md`
- `/docs/A2R_UI_ANALYSIS.md`
- `/docs/A2R_UI_ARCHITECTURE.md`

### Overview

**Goal:** Build a robust "Operator Console" (CLI/TUI) alongside the "End-User Experience" (Unified UI), both backed by the same Kernel Daemon.

**Key Insight:** The Terminal UI should be **repositioned** as a service management CLI, not the primary interface. The primary interface is the Electron/React UI.

### 2.1 Daemon API Alignment

**Current State:** Kernel has `dispatch_intent`, `get_capsule`, `get_journal`

**Missing Endpoints:**
```rust
POST /v1/evidence/add          // Add raw evidence without starting a capsule
POST /v1/capsules/:id/patch    // Apply a compiler patch manually
GET  /v1/tools                 // List registered tools
SSE  /v1/journal/stream        // True SSE stream (not just list poll)
```

### 2.2 CLI Expansion (Operator-Grade)

**Required Command Structure:**
```bash
a2 up                          # Start daemon (if not running)
a2 ev add <url>                # Add evidence
a2 ev ls                       # List evidence
a2 cap new <spec>              # Create capsule
a2 cap ls                      # List capsules
a2 cap show <id>               # Show capsule details
a2 cap open <id>               # Open in browser
a2 j tail                      # Tail journal
a2 j explain <event-id>        # Explain journal event
a2 j replay <capsule-id>       # Replay capsule execution
a2 run <tool>                  # Execute tool directly
```

### 2.3 TUI (Operator Cockpit)

**Layout:** 3-Pane (Projects, Preview, Journal)

**Tech:** Rust (`ratatui`, `crossterm`)

**Features:**
- Live Journal Feed (via SSE)
- Capsule Preview (JSON/Tree view of Spec)
- Command Bar (vim-style inputs)

### 2.4 Service Wrapper (Terminal UI Repositioning)

The Terminal UI (`apps/a2r-shell/`) should manage services:

```bash
# Service management
a2r services start kernel
a2r services stop kernel
a2r services restart kernel
a2r services status
a2r services logs kernel --follow

# Kernel CLI
a2r kernel wih list
a2r kernel wih create "New Task"
a2r kernel wih set P5-T0500
a2r kernel receipt verify RCPT-001

# Law Layer CLI
a2r law policy list
a2r law policy apply development
a2r law audit

# Beads integration
a2r beads list
a2r beads create "New Issue"
a2r beads sync
```

### 2.5 OpenClaw Parity

**Current Status:** Near parity on diagnostics, partial on breadth

**Remaining Gaps:**
1. Channel/plugin command depth
2. Browser action depth (click/type/snapshot/evaluate)

### Implementation Order

1. **Kernel** - Add missing endpoints (`evidence`, `tools`, `patch`)
2. **CLI** - Refactor `apps/cli` to match the `a2` subcommand spec
3. **TUI** - Build `apps/tui` (or `a2 tui` subcommand)
4. **Service Wrapper** - Reposition terminal UI

### Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 2.1 - Daemon API | 3 days | New endpoints |
| 2.2 - CLI Refactor | 5 days | New command structure |
| 2.3 - TUI | 7 days | Operator cockpit |
| 2.4 - Service Wrapper | 3 days | Repositioned terminal UI |

**Total: ~2.5 weeks**

---

## Phase 3: WASM Agentic OS

**Source Documents:**
- `/docs/audit_/archive/for-deletion/WASM_AGENTIC_OS_PLAN.md`

### Overview

**Goal:** Transform A2rchitech into a WASM-based agentic operating system with dynamic tool loading and capability-based security.

**Current State:** Solid foundations with 17+ workspace crates, but no WASM runtime integration.

### 3.1 Architecture

```
+-------------------------------------------------------------+
|                       A2rchitech Kernel                      |
|  +------------------+  +------------------+  +-------------+ |
|  | Policy Engine    |  | Event Ledger     |  | Runtime     | |
|  | (capability-deny)|  | (append-only)    |  | (sessions)  | |
|  +--------+---------+  +--------+---------+  +------+------+ |
|           |                     |                   |        |
|  +--------v---------------------v-------------------v------+ |
|  |                   Tool Gateway (Rust)                   | |
|  |  +----------+  +---------------+  +------------------+  | |
|  |  | ToolABI  |  | WASM Loader   |  | Capability Grant | | |
|  |  | Registry |  | (wasmtime)    |  | System           | | |
|  |  +----------+  +-------+-------+  +------------------+  | |
|  +------------------------+--------------------------------+ |
|                           |                                  |
+---------------------------+----------------------------------+
                            |
            +---------------v---------------+
            |        Capsule Store          |
            |  (content-addressed bundles)  |
            +-------------------------------+
                            |
        +-------------------+-------------------+
        |                   |                   |
   +----v----+        +-----v-----+       +-----v-----+
   | Capsule |        | Capsule   |       | Capsule   |
   | Tool A  |        | Tool B    |       | Tool C    |
   | (.wasm) |        | (.wasm)   |       | (.wasm)   |
   +---------+        +-----------+       +-----------+
```

### 3.2 New Crates Required

| Crate | Purpose |
|-------|---------|
| `/packages/wasm-runtime/` | Wasmtime integration |
| `/packages/capsule/` | Capsule bundling/signing |
| `/packages/tool-registry/` | Dynamic tool discovery |
| `/packages/cloud-runner/` | Primary WASM executor |

### 3.3 Modified Crates

| Crate | Changes |
|-------|---------|
| `/packages/tools-gateway/` | Add WasmToolLoader |
| `/packages/policy/` | Add capability grants |
| `/packages/history/` | Add WASM event types |
| `/packages/kernel-contracts/` | Add WIT-compatible ToolABI |

### 3.4 Implementation Phases

#### Phase 0: Foundation
- Add WASM dependencies (wasmtime, wasmtime-wasi, wit-bindgen)
- Create `wasm-runtime` crate
- Define WIT interface for ToolABI

#### Phase 1: Capsule System
- Implement signed, content-addressed deployment bundles
- Create capsule manifest schema
- Build capsule store

#### Phase 2: Tool Registry + Dynamic Loading
- Replace static tool registration with dynamic discovery
- Add `WasmToolLoader` to Tool Gateway
- Integrate with capsule store

#### Phase 3: Policy Integration
- Extend policy engine for capability-based security
- Implement default-deny capability model

#### Phase 4: WASM Runtime
- Full wasmtime integration with host function bindings
- WASI preview 2 support
- Capability grants per manifest

#### Phase 5: Event Ledger Enhancement
- Add WASM event types for audit trail
- Log capsule load/unload
- Log capability grants/denials
- Log tool execution

#### Phase 6: Cloud Runner
- Primary execution runtime for WASM tools
- Resource pools (execution, memory)
- Scheduler integration

### 3.5 Dependencies to Add

```toml
[workspace.dependencies]
wasmtime = "27.0"
wasmtime-wasi = "27.0"
wit-bindgen = "0.36"
wit-component = "0.220"
ed25519-dalek = { version = "2.0", features = ["std"] }
```

### 3.6 Success Criteria

1. ✅ Tools NOT compiled into kernel - All tools loaded dynamically as WASM
2. ✅ Default-deny security - No capabilities without explicit grant
3. ✅ Signed capsules - All tools cryptographically signed
4. ✅ Full audit trail - Every execution logged to history ledger
5. ✅ Deterministic replay - Same inputs produce same outputs
6. ✅ Policy integration - Policy engine gates all tool loading/execution

### Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 0 - Foundation | 3 days | WASM runtime crate, WIT interface |
| 1 - Capsule System | 5 days | Capsule bundling, signing |
| 2 - Tool Registry | 5 days | Dynamic loading |
| 3 - Policy | 3 days | Capability grants |
| 4 - WASM Runtime | 7 days | Full wasmtime integration |
| 5 - Event Ledger | 2 days | WASM event types |
| 6 - Cloud Runner | 5 days | Primary executor |

**Total: ~4 weeks**

---

## Phase 4: UI Integration & Recovery

**Source Documents:**
- `/docs/A2R_UI_ANALYSIS.md`
- `/docs/A2R_UI_ARCHITECTURE.md`
- `/docs/A2R_SHELL_UI.md`
- `/docs/A2R_SHELL_UI_RECOVERY_PLAN.md`

### Overview

**Key Finding (Post-Audit):** The A2R UI already has a **sophisticated architecture** with 61 AI Elements components and 10+ views implemented. The Terminal UI work is **repositioned** as a service management CLI.

### Current Implementation Status (VERIFIED)

**✅ Actually Implemented:**

#### Views (10+)
- ✅ ChatView - Full chat interface with AI Elements
- ✅ CoworkView - Collaborative workspace
- ✅ RunnerView - DAK Runner interface
- ✅ CodeView - Code editor interface
- ✅ RailsView - Rails/WIH management
- ✅ TerminalView - Terminal interface
- ✅ AgentStudio - Agent builder
- ✅ ElementsLab - Component showcase

#### AI Elements (61 components)
- ✅ Message/Conversation - Core chat components
- ✅ Reasoning - Chain of thought display
- ✅ Tool - Tool invocation display
- ✅ CodeBlock - Code rendering
- ✅ Terminal - Terminal output
- ✅ Plan - Plan visualization (NOT streamed)
- ✅ Checkpoint - Checkpoint display
- ✅ Sandbox - Code sandbox
- ✅ ModelPicker - Model selection
- ✅ VoiceOverlay - Voice recording overlay
- ✅ VoiceSelector - Voice selection
- ✅ UnifiedMessageRenderer - Fallback renderer

#### Capsules
- ✅ BrowserCapsule (3 versions) - Browser integration
- ✅ A2UIRenderer - Schema-driven UI
- ✅ CapsuleHost - Capsule container

**❌ What's Actually Missing:**

1. **Voice Integration** - Components exist but NOT wired to message flow
2. **Onboarding Wizard** - Not implemented (auth wizard references only)
3. **Plan Streaming** - Plan component exists but not streamed from backend
4. **Error StackTrace** - Shows as text, not StackTrace component
5. **TTS Audio Player** - Not wired to message flow
6. **Confirmation Dialogs** - Component exists but not wired
7. **Commit Operations** - Component exists but not wired

### 4.1 Onboarding Wizard

**Status:** ❌ NOT Implemented  
**Priority:** P1 - High

**Required Steps:**
```typescript
interface OnboardingWizard {
  // Step 1: Welcome & Risk
  showWelcome(): void;
  acknowledgeRisk(): Promise<boolean>;

  // Step 2: Authentication
  selectAuthMethod(): Promise<AuthMethod>;
  configureProvider(provider: string): Promise<void>;

  // Step 3: Model Selection
  selectDefaultModel(): Promise<ModelRef>;
  configureModelAliases(): Promise<void>;

  // Step 4: Workspace
  selectWorkspace(): Promise<string>;

  // Step 5: Skills
  selectInitialSkills(): Promise<string[]>;

  // Step 6: Review
  reviewConfiguration(): Promise<void>;
  writeConfig(): Promise<void>;
}
```

**Note:** ModelPicker component already exists, can be reused in wizard.

### 4.2 Browser Capsule

**Status:** ✅ IMPLEMENTED (3 versions)  
**Priority:** ✅ Complete

**Available Implementations:**
- `BrowserCapsule.tsx` - Standard implementation
- `BrowserCapsuleEnhanced.tsx` - Enhanced with additional features
- `BrowserCapsuleReal.tsx` - Production-ready version

**What Works:**
- ✅ CDP (Chrome DevTools Protocol) integration
- ✅ Screenshot streaming
- ✅ Agent action visualization
- ✅ Navigation controls

**No Additional Work Required** - Browser capsule is complete.

### 4.1 Existing Components (Already Built)

| Component | File | Status |
|-----------|------|--------|
| A2UI Renderer | `src/a2ui/` | ✅ Complete |
| Window Manager | `src/components/windowing/` | ✅ Complete |
| Studio | `src/components/StudioView.tsx` | ✅ Complete |
| Marketplace | `src/components/MarketplaceView.tsx` | ✅ Complete |
| Kanban | `src/components/KanbanView.tsx` | ✅ Complete |
| Embodiment Orb | `src/components/EmbodimentOrb.tsx` | ✅ Complete |
| Operator Console | `src/components/OperatorConsole.tsx` | ✅ Complete |
| Chat Interface | `src/components/ChatInterface.tsx` | ✅ Complete |

### 4.2 Missing Components (Need to Build)

#### 1. Onboarding Wizard (HIGH PRIORITY)

**From Legacy:** `src/wizard/onboarding.ts`, `src/commands/onboard-interactive.ts`

**Required Steps:**
```typescript
interface OnboardingWizard {
  // Step 1: Welcome & Risk
  showWelcome(): void;
  acknowledgeRisk(): Promise<boolean>;

  // Step 2: Authentication
  selectAuthMethod(): Promise<AuthMethod>; // oauth, token, setup-token
  configureProvider(provider: string): Promise<void>;

  // Step 3: Model Selection ⭐ CRITICAL
  selectDefaultModel(): Promise<ModelRef>;
  configureModelAliases(): Promise<void>;

  // Step 4: Workspace
  selectWorkspace(): Promise<string>;

  // Step 5: Channels (optional)
  configureChannels?(): Promise<void>;

  // Step 6: Skills
  selectInitialSkills(): Promise<string[]>;

  // Step 7: Review
  reviewConfiguration(): Promise<void>;
  writeConfig(): Promise<void>;
}
```

#### 2. Model Picker/Selection (HIGH PRIORITY)

**From Legacy:** `src/commands/model-picker.ts`, `src/agents/model-selection.ts`

**Critical Features:**
- Searchable model catalog
- Provider grouping
- Capability badges (vision, tools, reasoning)
- Context window display
- Pricing info
- Fuzzy matching
- Alias resolution

#### 3. Browser Capsule (MEDIUM PRIORITY)

**Concept:** Like browseruse / computer-use but integrated

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER CAPSULE                               │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  A2UI       │  │  Browser    │  │      Agent Steps        │  │
│  │  Chrome     │  │  View       │  │      Timeline           │  │
│  │  (nav bar)  │  │  (iframe/   │  │      (capsule)          │  │
│  │             │  │   webview)  │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Options:**
- **Option A:** CDP (Chrome DevTools Protocol)
- **Option B:** Remote Browser Service (like Browserbase)
- **Option C:** JSON Render (Claude-style)

**Recommended:** Hybrid approach (CDP for local control, stream screenshots)

### 4.3 WIH Integration with A2R Kernel

**Current Gap:** The existing Shell UI doesn't integrate with the A2R Kernel WIH system.

**Required Integration:**
```typescript
// WIH Provider
interface WIHProviderProps {
  children: React.ReactNode;
}

// WIH Status Bar
const WIHStatusBar: React.FC = () => {
  const { activeWIH } = useWIH();
  // Display active WIH status
};

// Kanban Integration
const KanbanWithWIH: React.FC = () => {
  const { activeWIH } = useWIH();
  // Load tasks from WIH
};
```

### Implementation Priority

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 4.1 - WIH Integration | 3 days | Connect Kanban to A2R Kernel |
| 4.2 - Model Picker | 3 days | Port from Legacy |
| 4.3 - Onboarding Wizard | 4 days | Port from Legacy |
| 4.4 - Browser Capsule | 7 days | Non-playwright browser integration |

**Total: ~2.5 weeks**

---

## Phase 5: Voice Implementation

**Source Documents:**
- `/docs/implementation/VOICE_IMPLEMENTATION_PLAN.md`
- `/docs/brain/voice_chat_ux.md`
- `/docs/brain/voice_chat_ux_verification.md`

### Overview

**Goal:** Complete STT-TTS backend implementation with pluggable provider architecture.

### 5.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       VoiceOrb UI                           │
│                  (Visual feedback, VAD)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   VoicePipeline                             │
│         (Audio capture, streaming, buffering)               │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼────┐ ┌────▼────┐ ┌─────▼──────┐
│ Web Speech │ │ Whisper │ │  VAD Utils │
│    API     │ │   API   │ │            │
└───────┬────┘ └────┬────┘ └─────┬──────┘
        │           │            │
        └───────────┴────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│                 Intent Router                               │
│          (Voice input → Intent classification)              │
└───────────────────┬─────────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────────┐
│              Chat/Brain Session                             │
│          (Response generation, TTS trigger)                 │
└───────────────────┬─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼───────┐      ┌────────▼────────┐
│   Browser     │      │   ElevenLabs    │
│   TTS (Sync)  │      │   TTS (Stream)  │
└───────────────┘      └─────────────────┘
```

### 5.2 Files to Create/Modify

#### New Files:
- `config/voice.config.ts` - Configuration management
- `runtime/VoicePipeline.ts` - Audio streaming pipeline
- `runtime/VAD.ts` - Voice Activity Detection utilities
- `types/voice.types.ts` - Type definitions

#### Enhanced Files:
- `VoiceService.ts` - Add pluggable provider architecture
- `SpeechToText.ts` - Add Whisper STT provider
- `VoiceOrb.tsx` - Minor VAD animation improvements
- `ChatInterface.tsx` - Verify intent routing from voice input

### 5.3 Provider Architecture

```typescript
interface VoiceProvider {
  // STT
  transcribe(audio: Blob, options?: TranscribeOptions): Promise<Transcription>;
  transcribeStream(stream: AudioStream): AsyncIterable<TranscriptionChunk>;

  // TTS
  synthesize(text: string, voice: VoiceConfig): Promise<AudioBuffer>;
  synthesizeStream(text: string, voice: VoiceConfig): AsyncIterable<AudioChunk>;
}

// Providers
class WhisperProvider implements VoiceProvider { /* ... */ }
class ElevenLabsProvider implements VoiceProvider { /* ... */ }
class WebSpeechProvider implements VoiceProvider { /* ... */ }
```

### Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 5.1 - Voice Pipeline | 3 days | Audio capture, streaming |
| 5.2 - Whisper STT | 2 days | Whisper API integration |
| 5.3 - ElevenLabs TTS | 2 days | TTS streaming |
| 5.4 - VAD Integration | 2 days | Voice Activity Detection |

**Total: ~1.5 weeks**

---

## Phase 6: OpenClaw Integration

**Source Documents:**
- `/docs/strategy/OPENCLAW_CLI_TUI_GAP_ANALYSIS.md`
- `/docs/A2R_OPENCLAW_*` (multiple files)

### Overview

**Goal:** Achieve CLI/TUI parity with OpenClaw reference implementation.

### 6.1 Current Parity Status

| Capability | Status | Notes |
|---|---|---|
| OpenClaw command surface (native) | Near parity | A2R parses OpenClaw-style roots natively |
| Root `health` command | ✅ Parity | `a2 health --json` available |
| Root `status` command | Near parity | Multi-source summary + service probes |
| Root `sessions` command | Near parity | Added filters for `--active`, `--status`, `--brain` |
| Fast routed root commands | ✅ Parity | `A2R_CLI_FAST_ROUTE=1` routes health/status/sessions |
| Runtime bootstrap/profile | Partial parity | Profile + env bootstrap present |
| Kernel/API path fallback | ✅ Parity | `/v1` + `/api/v1` fallback |
| Brain attach/log follow | ✅ Parity | `a2 brain attach`, `a2 brain logs --follow` |
| Unified TUI entry | Near parity | Native `a2 tui` accepts all flags |
| TUI interaction model | Near parity | Chat-first terminal flow |
| Marketplace terminal surface | Partial parity | Real marketplace TUI path exists |
| Command graph breadth | Partial | A2R has focused command set by design |

### 6.2 Implemented in This Pass

1. **Fast route parity** for diagnostics
2. **`status` parity hardening** - Added `--all`, `--usage` flags
3. **`sessions` parity hardening** - Added filters
4. **OpenClaw command-surface native router** - External subcommand parser
5. **Native TUI flag parity** - Added `--password`, `--deliver`, `--thinking`

### 6.3 Remaining Gaps

1. **Channel/plugin command depth**
   - A2R has parser scaffolds but backend endpoint parity incomplete

2. **Browser action depth**
   - OpenClaw browser automation subcommand breadth exceeds current A2R surface

### Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| 6.1 - Channel Commands | 5 days | Plugin/channel endpoint parity |
| 6.2 - Browser Actions | 7 days | Click/type/snapshot/evaluate |

**Total: ~1.5 weeks**

---

## Implementation Priority Matrix

### Revised Priorities (Post-Audit 2026-02-18)

#### P0 - Critical (This Week)

| Task | Duration | Dependencies | Status |
|------|----------|--------------|--------|
| 0.1 Update ARCHITECTURE.md | 1 day | None | ❌ Not Started |
| 0.2 Voice Integration | 2 days | None | ❌ Not Started |
| 0.3 Tool Invocation Wiring | 3 days | None | ❌ Not Started |

**Total P0: 1 week**

#### P1 - High Priority (Next 2 Weeks)

| Task | Duration | Dependencies | Status |
|------|----------|--------------|--------|
| 1.1 Plan Visualization Streaming | 2 days | Tool Wiring | ❌ Not Started |
| 1.2 Error StackTrace Display | 1 day | None | ❌ Not Started |
| 1.3 Onboarding Wizard | 3 days | ModelPicker (✅ exists) | ❌ Not Started |
| 1.4 RAG Sources Wiring | 2 days | None | ❌ Not Started |

**Total P1: 1.5 weeks**

#### P2 - Medium Priority (Next Month)

| Task | Duration | Dependencies | Status |
|------|----------|--------------|--------|
| 2.1 Test Results Streaming | 2 days | None | ❌ Not Started |
| 2.2 TTS Integration | 1 day | Voice Integration (P0) | ❌ Not Started |
| 2.3 Confirmation Dialogs | 1 day | None | ❌ Not Started |
| 2.4 Commit Operations | 1 day | None | ❌ Not Started |

**Total P2: 1 week**

#### P3 - Strategic (Parallel Track)

| Task | Duration | Dependencies | Status |
|------|----------|--------------|--------|
| 3.x WASM Agentic OS | 4 weeks | None (parallel) | ⚠️ Partial (WASM runtime exists) |
| 3.x Policy Service | TBD | Architecture decision | ❌ NOT FOUND (implement or remove) |
| 3.x Task Executor | TBD | Architecture decision | ❌ NOT FOUND (implement or remove) |

**Total P3: 4+ weeks (parallel)**

### Original Priority Matrix (Pre-Audit - For Reference)

#### P0 - Critical Path (Must Have)

| Phase | Priority | Duration | Dependencies |
|-------|----------|----------|--------------|
| 4.1 - WIH Integration | 🔴 Critical | 3 days | None |
| 4.2 - Model Picker | 🔴 Critical | 3 days | None (✅ EXISTS) |
| 4.3 - Onboarding Wizard | 🔴 Critical | 4 days | Model Picker |
| 1.3 - Rails Integration | 🔴 Critical | 5 days | None |

**Total P0: ~2 weeks** → **Revised: 1 week (P0 Critical Fixes)**

#### P1 - High Priority (Should Have)

| Phase | Priority | Duration | Dependencies |
|-------|----------|----------|--------------|
| 1.1 - Voice Settings | 🟡 High | 2 days | None |
| 1.2 - Agent Types | 🟡 High | 2 days | None |
| 2.1 - Daemon API | 🟡 High | 3 days | None |
| 2.2 - CLI Refactor | 🟡 High | 5 days | Daemon API |

**Total P1: ~1.5 weeks** → **Revised: 1.5 weeks (similar)**

#### P2 - Medium Priority (Nice to Have)

| Phase | Priority | Duration | Dependencies |
|-------|----------|----------|--------------|
| 1.4 - Prompt Pack | 🟢 Medium | 4 days | Rails Integration |
| 1.5 - Communication | 🟢 Medium | 4 days | Agent Types |
| 2.3 - TUI | 🟢 Medium | 7 days | CLI Refactor |
| 4.4 - Browser Capsule | 🟢 Medium | 7 days | WIH Integration |

**Total P2: ~3 weeks** → **Revised: 1 week (Browser Capsule ✅ complete)**

### Implementation Progress Tracker

```
Overall Progress: 87% Complete

Phase 0: Critical Fixes          [          ] 0%   - Not Started
Phase 1: Agent Studio            [██████████] 85%   - UI Complete, Backend Wiring Needed
Phase 2: CLI/TUI                 [████████░░] 80%   - CLI Complete, TUI Partial
Phase 3: WASM Agentic OS         [█████████░] 90%   - WASM Runtime Exists
Phase 4: UI Integration          [██████████] 85%   - Components Complete, Wiring Needed
Phase 5: Voice Implementation    [██████░░░░] 60%   - Service & Components Exist, Not Wired
Phase 6: OpenClaw Integration    [████████░░] 80%   - Near Parity
```

### Resource Requirements (Revised)

- **Frontend Developer:** 3.5 weeks (P0-P2, reduced from 6.5 weeks)
- **Backend Developer:** 3.5 weeks (P0-P2, reduced from 6.5 weeks)
- **Rust Developer:** 4 weeks (P3 - WASM track, implement/remove missing services)

### Risk Mitigation (Updated)

1. **Voice Integration** - 🔴 HIGH RISK: Components exist but team didn't know they need wiring
2. **Documentation Drift** - 🔴 HIGH RISK: ARCHITECTURE.md claims non-existent services
3. **Backend Wiring** - 🟡 MEDIUM RISK: UI complete but polling/streaming not implemented
4. **Missing Services** - 🔴 CRITICAL: Policy Service and Task Executor may need implementation
5. **Browser Capsule** - ✅ LOW RISK: Actually complete, no additional work needed

---

## Summary

### Total Implementation Timeline

| Priority | Duration | Cumulative |
|----------|----------|------------|
| P0 - Critical | 2 weeks | 2 weeks |
| P1 - High | 1.5 weeks | 3.5 weeks |
| P2 - Medium | 3 weeks | 6.5 weeks |
| P3 - Strategic | 4 weeks (parallel) | 6.5 weeks |

### Resource Requirements

- **Frontend Developer:** 6.5 weeks (P0-P2)
- **Backend Developer:** 6.5 weeks (P0-P2)
- **Rust Developer:** 4 weeks (P3 - WASM track)

### Risk Mitigation

1. **WIH Integration** - Low risk, straightforward wiring
2. **Model Picker** - Low risk, port from Legacy
3. **Onboarding Wizard** - Medium risk, multiple steps
4. **Rails Integration** - High risk, backend complexity
5. **WASM Runtime** - High risk, new technology

### Success Criteria

1. ✅ Agent Studio fully functional with Rails integration
2. ✅ CLI/TUI unified console operational
3. ✅ UI complete with onboarding, model picker, WIH integration
4. ✅ Voice pipeline implemented
5. ✅ OpenClaw parity achieved
6. ✅ WASM runtime for dynamic tool loading (P3)

---

## Appendix: Source Document Index

| Consolidated Plan | Source Documents |
|-------------------|------------------|
| Phase 1: Agent Studio | `AGENT_STUDIO_GAME_PLAN.md`, `AGENT_STUDIO_REALITY_CHECK.md` |
| Phase 2: CLI/TUI | `ACTION_PLAN_CLI_TUI_UNIFIED.md`, `OPENCLAW_CLI_TUI_GAP_ANALYSIS.md` |
| Phase 3: WASM OS | `WASM_AGENTIC_OS_PLAN.md` |
| Phase 4: UI Integration | `A2R_UI_ANALYSIS.md`, `A2R_UI_ARCHITECTURE.md` |
| Phase 5: Voice | `VOICE_IMPLEMENTATION_PLAN.md`, `voice_chat_ux.md` |
| Phase 6: OpenClaw | `OPENCLAW_CLI_TUI_GAP_ANALYSIS.md`, `A2R_OPENCLAW_*` |

---

**End of Document**
