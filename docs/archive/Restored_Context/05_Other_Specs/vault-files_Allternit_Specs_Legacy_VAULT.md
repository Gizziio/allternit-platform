# Allternit-Specs (Gizzi Legacy) - Vault Summary

**Original Folder:** `allternit-specs(temporary)/`
**Date:** 2026-01-18  
**Status:** OBSOLETE - Legacy Gizzi specs that evolved into Allternit

## Context

This folder contains early Allternit/Gizzi specifications that were written during Phase 1-2 development. These specs describe a WebVM-based agent system that has since evolved into the current Allternit architecture.

## Key Components Analyzed

### 1. The Law (Authority & Rules)
**File:** `LAW/ONTOLOGY_LAW.md`
**Content:** Canonical definitions for:
- IO (Input/Output) layer
- Kernel state management
- Model inference
- Shell interaction
- Gizzi presence/behavior

**Key Decisions:**
- Only IO can cause side effects
- Models propose; IO decides and executes
- Gizzi is presence layer, never privileged executor
- The Journal is the only authoritative history record

### 2. Phase 1: MVP - Foundation
**Goal:** Establish functional WebVM runtime with side-effect-authorized IO daemon

**Core Architecture:**
- GIZZI_STATE_MODEL.md - Identity law and persistence rules
- WEBVM_BOOT_AND_BRIDGE_CONTRACT.md - CheerpX initialization and filesystem mounting
- IO_BRIDGE_CONTRACT.md - NDJSON-RPC bridge protocol (`io.*`, `skill.*`)
- GIZZI_PRESENCE_LAYER.md - Orb states, narration triggers, event subscriptions
- GIZZI_RUNNER_IMPLEMENTATION_SPEC.md - Internal IO logic and registry management

**Deliverables Checklist:**
- [ ] IO Boot: IO daemon starts in WebVM, emits `IO_READY`
- [ ] Bridge: IO accepts `io.ping` and `skill.invoke` over stdio
- [ ] Persistence: `/var/gizzi` mounts via IDBDevice, survives browser refresh
- [ ] Gizzi Presence: Visual orb renders and reacts to IO events

### 3. Phase 2: Operator (UI-TARS)
**Goal:** Integrate vision-based GUI automation using UI-TARS model

**Core Components:**
- GUI_AGENT_SKILL_SPEC.md - Skills: `gui.observe`, `model.ui_tars.propose`, `gui.execute`
- SCREENSHOT_PIPELINE.md - KMS capture, normalization, artifact storage
- UITARS_INFERENCE_LAYER.md - Remote API placement and provider configuration
- WEBVM_CHEERPIX_INTEGRATION.md - KMS canvas setup and input injection

**Deliverables Checklist:**
- [ ] Observation: `gui.observe` generates hashed screenshot artifact
- [ ] Proposals: `model.ui_tars.propose` provides semantic action suggestions
- [ ] Execution: IO performs `gui.execute` (clicks/keys) after policy validation
- [ ] Approval: Gizzi renders confirmation UI for high-risk GUI actions

## Key Learnings Extracted

### Authority & Safety Architecture
1. **Law-based constraints:** Core mandates defined and enforced
2. **Side-effect control:** Only IO layer authorized to modify state
3. **Proposal-decision pattern:** Models suggest, IO layer executes
4. **Persona enforcement:** Gizzi as presence/visual layer, never executor

### WebVM Integration Strategy
1. **Filesystem mounting:** `/var/gizzi` for persistence
2. **Bridge protocol:** NDJSON-RPC over stdio for communication
3. **Event-driven:** IO emits events, Gizzi reacts to them

### Vision/GUI Architecture
1. **Observation pipeline:** Screenshot capture → normalization → artifact storage
2. **Inference separation:** UI-TARS model for vision/understanding
3. **Multi-modal execution:** Clicks, keyboard, screenshots all coordinated

## Research Outcomes

### Phase 1 Foundation Success
- **WebVM runtime:** CheerpX-based Linux VM established
- **IO daemon:** Side-effect controlled input/output layer
- **Persistence:** IndexedDB filesystem for state
- **Bridge protocol:** NDJSON-RPC standard

### Phase 2 Vision Integration
- **Screenshot pipeline:** KMS integration for capture
- **UI-TARS model:** Remote inference for vision tasks
- **GUI automation:** Vision-based execution capabilities

## Evolution to Allternit

### What Was Preserved
1. **Authority patterns:** Law-based constraints and safety models
2. **Event-driven architecture:** Bridge protocol and event subscriptions
3. **Multi-layer design:** IO → Model → Execution → Presence
4. **WebVM foundation:** Browser-based execution environment

### What Changed
1. **Architecture:** WebVM → Full agent platform with multiple services
2. **Interface:** IO bridge → Kernel + multiple interfaces (CLI, TUI, Shell, Voice)
3. **Integration:** CheerpX → Playwright for browser automation
4. **Scope:** Single platform (Gizzi) → Multi-service agentic OS

## Actionable Items Extracted

### From Phase 1 MVP
- [ ] Implement IO Boot with `IO_READY` emission
- [ ] Implement bridge accepting `io.ping` and `skill.invoke`
- [ ] Ensure `/var/gizzi` mounting and persistence
- [ ] Implement Gizzi Presence visual orb

### From Phase 2 Operator
- [ ] Implement `gui.observe` for screenshot capture
- [ ] Implement `model.ui_tars.propose` for action suggestions
- [ ] Implement `gui.execute` for GUI automation
- [ ] Add policy validation before GUI execution
- [ ] Implement Gizzi confirmation UI

---

## Original Files Status

**Location:** `archive/for-deletion/allternit-specs(temporary)/` (entire folder)  
**Reason for Archive:** These are legacy Gizzi specifications that evolved into current Allternit architecture. All key learnings, patterns, and decisions have been extracted above.  
**Deletion Approved:** ✅ Ready for deletion after vault extraction.

**Impact on Current Allternit:**
The patterns and learnings from these specs formed the foundation of the current Allternit system:
- Service-based architecture (IO, Model, Gizzi layers)
- Event-driven communication
- Law-based safety constraints
- Multi-modal interfaces (CLI, TUI, Shell, Voice)

The current Allternit implementation supersedes these specs while preserving their core principles.