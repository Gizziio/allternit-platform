# Codebase vs DAG Cross-Reference Report

## The 22 Phases in the DAG
- 🟢 PHASE 0: The "Wrapper" Fast-Path (Option A)
- 🔵 PHASE 1: True GizziClaw MVP (Option C)
- 🟣 PHASE 2: Recursive Language Model (RLM) Integration
- 🟠 PHASE 3: Workflow Blueprints & Connectors
- 🟡 PHASE 4: Task Engine & Execution Parity (Deltas 0001 & 0006)
- 🟤 PHASE 5: Security, Canon & Receipts (Deltas 0003 & 0004)
- 🟢 PHASE 6: Memory Promotion Pipeline (Delta 0002)
- 🔵 PHASE 7: Capsule Runtime & MCP Host (Delta 0005)
- 🟣 PHASE 8: OpenCode TUI Fork Integration (Delta 0007)
- 🟤 PHASE 9: Embodiment & Robotics Control Plane (L8)
- ⚪ PHASE 10: Glass UI Component Migration
- 🟤 PHASE 11: MCP Apps Integration
- 🟢 PHASE 12: Business Strategy & Operations
- 🔵 PHASE 13: Computer Use & Desktop Plugin Integration
- 🟣 PHASE 14: Agent Runner System (The Execution Plane)
- 🔴 PHASE 15: Production Readiness & Hardening
- 🟠 PHASE 16: Brand Identity & UI Aesthetics
- 🟡 PHASE 17: Workspace Isolation & Mode-Specific Sessions
- 🟢 PHASE 18: Unified UI (A2UI & GenTabs Implementation)
- 🔵 PHASE 19: Multi-Agent Communication Layer
- 🟣 PHASE 20: Kernel Execution & Sandboxing (L2)
- 📚 PHASE 21: Course Publishing & Content Remixing
- ⚖️ PHASE 22: System Law & Source of Truth Enforcement

## Codebase Inventory & Mapping

### `api/`
- **`cloud/`** -> *Phase 15 (Cloud API)*
- **`core/`** -> *UNKNOWN*
- **`gateway/`** -> *Phase 0/1/18 (Routing Gateway)*
- **`kernel/`** -> *UNKNOWN (Needs mapping)*
- **`services/`** -> *UNKNOWN (Needs mapping)*

### `cmd/`
- **`allternit/`** -> *UNKNOWN (Needs mapping)*
- **`allternit-api/`** -> *UNKNOWN (Needs mapping)*
- **`allternit-cloud-api/`** -> *UNKNOWN (Needs mapping)*
- **`allternit-cloud-wizard/`** -> *UNKNOWN (Needs mapping)*
- **`cli/`** -> *UNKNOWN (Needs mapping)*
- **`cli-rust-archive/`** -> *UNKNOWN (Needs mapping)*
- **`cli-typescript/`** (EMPTY/SCAFFOLD) -> *UNKNOWN*
- **`cloud-backend/`** -> *UNKNOWN (Needs mapping)*
- **`gizzi-code/`** -> *Phase 1 (GizziClaw) / Phase 8 (TUI)*
- **`gizzi-core/`** -> *UNKNOWN (Needs mapping)*
- **`launcher/`** -> *UNKNOWN*

### `domains/`
- **`agent/`** -> *Phase 1 (GizziClaw) / Phase 14 (Agent Runner)*
- **`agent-swarm/`** -> *UNKNOWN (Needs mapping)*
- **`computer-use/`** -> *Phase 13 (Computer Use)*
- **`governance/`** -> *Phase 22 (System Law)*
- **`kernel/`** -> *Phase 20 (Kernel Sandboxing) / Phase 14 (Rails)*
- **`mcp/`** -> *Phase 11 (MCP Apps Integration)*
- **`tenants/`** (EMPTY/SCAFFOLD) -> *UNKNOWN (Likely Phase 15 Hardening or Unmapped)*

### `infrastructure/`
- **`0-infra/`** -> *UNKNOWN (Needs mapping)*
- **`allternit-cloud-providers/`** (EMPTY/SCAFFOLD) -> *UNKNOWN (Needs mapping)*
- **`chrome-stream/`** -> *UNKNOWN (Needs mapping)*
- **`cloud/`** -> *UNKNOWN (Needs mapping)*
- **`executor/`** -> *UNKNOWN (Needs mapping)*
- **`gateway/`** (EMPTY/SCAFFOLD) -> *UNKNOWN (Needs mapping)*
- **`link-card-service/`** (EMPTY/SCAFFOLD) -> *UNKNOWN (Needs mapping)*
- **`local/`** -> *UNKNOWN (Needs mapping)*
- **`providers/`** -> *UNKNOWN (Needs mapping)*
- **`scheduler/`** -> *UNKNOWN (Needs mapping)*
- **`vps-node/`** -> *UNKNOWN (Needs mapping)*

### `packages/`
- **`@allternit/`** -> *UNKNOWN (Needs mapping)*
- **`computer-use/`** -> *UNKNOWN (Needs mapping)*

### `services/`
- **`ai/`** (EMPTY/SCAFFOLD) -> *UNKNOWN (Possibly Phase 16 Avatar / Unmapped)*
- **`computer-use-operator/`** -> *Phase 13 (Computer Use)*
- **`consolidated-legacy/`** (EMPTY/SCAFFOLD) -> *UNKNOWN (Needs mapping)*
- **`gateway/`** -> *Phase 13 (Computer Use Gateway)*
- **`infrastructure/`** (EMPTY/SCAFFOLD) -> *Phase 15 (Production Readiness)*
- **`memory/`** -> *Phase 6 (Memory Promotion) / Phase 17 (Isolation)*
- **`ml/`** -> *Phase 2 (RLM) / Unmapped*
- **`operator/`** (EMPTY/SCAFFOLD) -> *UNKNOWN*
- **`orchestration/`** -> *Phase 14 (Agent Runner) / Phase 17 (Mode Sessions)*
- **`registry/`** -> *Phase 18 (Mini-App Data System)*
- **`runtime/`** -> *Phase 20 (Kernel Execution)*
- **`search/`** -> *UNKNOWN (Unmapped Retrieval/Search layer)*
- **`support/`** (EMPTY/SCAFFOLD) -> *UNKNOWN*
- **`tools/`** -> *Phase 13 (Computer Use)*
- **`udemy-downloader/`** -> *Phase 21 (Course Publishing)*
- **`ui/`** -> *Phase 18 (Unified UI)*
- **`voice/`** -> *UNKNOWN (Voice/Avatar Integration - Unmapped)*

### `surfaces/`
- **`allternit-desktop/`** -> *UNKNOWN (Needs mapping)*
- **`allternit-extensions/`** -> *Phase 13 (Browser Extension)*
- **`allternit-platform/`** -> *Phase 16, 17, 18 (UI)*
- **`docs/`** -> *UNKNOWN (Needs mapping)*
- **`platform/`** (EMPTY/SCAFFOLD) -> *UNKNOWN (Needs mapping)*
- **`platform-electron/`** -> *Phase 13 (Desktop App)*
- **`thin-client/`** -> *UNKNOWN*

## Critical Unmapped Findings
1. **Voice Services:** `services/voice/` exists and is active, but voice integration (TTS/Avatar Voice) is missing from the DAG.
2. **Search/Retrieval:** `services/search/` is missing from the DAG entirely. This usually handles RAG and web search tools.
3. **Tenants:** `domains/tenants/` implies a multi-tenant SaaS architecture which isn't fully detailed in the DAG.
4. **Launcher/Thin-Client:** `cmd/launcher/` and `surfaces/thin-client/` indicate alternative deployment wrappers not explicitly listed.
