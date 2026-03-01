# A2RHITECH Implementation Guide

## 0. The Law (Read First)
Before writing code, you must understand the core architecture and authority boundaries.
*   [LAW/ONTOLOGY_LAW.md](./LAW/ONTOLOGY_LAW.md) - **Tier-0 Law**: Canonical definitions of IO, Kernel, Models, Shell, and Gizzi.

---

## 1. Phase 1: MVP (Foundation)
**Goal:** Establish a functional WebVM runtime with a side-effect-authorized IO daemon and basic presence.

### Core Architecture & State
*   [PHASE1_MVP/GIZZI_STATE_MODEL.md](./PHASE1_MVP/GIZZI_STATE_MODEL.md) - **Identity Law**: Single source of truth (Journal) and persistence rules.
*   [PHASE1_MVP/WEBVM_BOOT_AND_BRIDGE_CONTRACT.md](./PHASE1_MVP/WEBVM_BOOT_AND_BRIDGE_CONTRACT.md) - **Boot**: CheerpX initialization and filesystem mounting.
*   [PHASE1_MVP/IO_BRIDGE_CONTRACT.md](./PHASE1_MVP/IO_BRIDGE_CONTRACT.md) - **Transport**: The NDJSON-RPC bridge protocol (`io.*`, `skill.*`).

### Persona & Implementation
*   [PHASE1_MVP/GIZZI_PRESENCE_LAYER.md](./PHASE1_MVP/GIZZI_PRESENCE_LAYER.md) - **Presence**: Orb states, narration triggers, and event subscriptions.
*   [PHASE1_MVP/GIZZI_RUNNER_IMPLEMENTATION_SPEC.md](./PHASE1_MVP/GIZZI_RUNNER_IMPLEMENTATION_SPEC.md) - Internal IO logic and registry management.

### Deliverables Checklist
- [ ] **IO Boot**: IO daemon starts in WebVM and emits `IO_READY`.
- [ ] **Bridge**: IO accepts `io.ping` and `skill.invoke` over `stdio`.
- [ ] **Persistence**: `/var/gizzi` mounts via IDBDevice and survives browser refresh.
- [ ] **Gizzi Presence**: Visual orb renders and reacts to IO events.

---

## 2. Phase 2: Operator (UI-TARS)
**Goal:** Integrate vision-based GUI automation using the UI-TARS model.

### GUI & Inference
*   [PHASE2_OPERATOR/GUI_AGENT_SKILL_SPEC.md](./PHASE2_OPERATOR/GUI_AGENT_SKILL_SPEC.md) - **Skills**: `gui.observe`, `model.ui_tars.propose`, and `gui.execute`.
*   [PHASE2_OPERATOR/SCREENSHOT_PIPELINE.md](./PHASE2_OPERATOR/SCREENSHOT_PIPELINE.md) - **Observation**: KMS capture, normalization, and artifact storage.
*   [PHASE2_OPERATOR/UITARS_INFERENCE_LAYER.md](./PHASE2_OPERATOR/UITARS_INFERENCE_LAYER.md) - **Strategy**: Remote API placement and provider configuration.
*   [PHASE2_OPERATOR/WEBVM_CHEERPX_INTEGRATION.md](./PHASE2_OPERATOR/WEBVM_CHEERPX_INTEGRATION.md) - **Graphics**: KMS canvas setup and input injection.

### Deliverables Checklist
- [ ] **Observation**: `gui.observe` generates a hashed screenshot artifact.
- [ ] **Proposals**: `model.ui_tars.propose` provides semantic action suggestions.
- [ ] **Execution**: IO performs `gui.execute` (clicks/keys) after policy validation.
- [ ] **Approval**: Gizzi renders confirmation UI for high-risk GUI actions.

---

## 3. Core Mandates
1.  **Authority Law**: Only **IO** can cause side effects.
2.  **Proposal Law**: Models **propose**; IO **decides** and executes.
3.  **Persona Law**: **Gizzi** is presence; never a privileged executor.
4.  **Truth Law**: The **Journal** is the only authoritative record of history.
