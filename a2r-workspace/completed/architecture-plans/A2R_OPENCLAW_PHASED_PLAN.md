# A2R × OpenClaw Integration: Phased Plan & Dependency DAGs

**Date:** 2026-01-31  
**Status:** Draft for Review  
**Format:** Dependency DAGs with WIH (Work Item Header) front matter  

---

## Overview

This document provides a phased implementation plan for integrating OpenClaw into A2rchitech. Each phase includes:
- WIH-formatted task headers
- Dependency DAGs
- Acceptance criteria
- Compliance checkpoints

---

## Phase 0: Foundation Fork (Week 1)

**Objective:** Establish controlled fork infrastructure with upstream compatibility.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 0 DAG: Foundation Fork                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  P0-T0000 ─────┬─────▶ P0-T0001 ─────▶ P0-T0002 ─────▶ P0-T0003           │
│  (Fork)        │       (Remotes)      (Branches)      (Verify)            │
│                │                                                            │
│                └─────▶ P0-T0004 ─────▶ P0-T0005                           │
│                       (Rerere)         (CI Gates)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P0-T0000: Fork OpenClaw Repository
```json
{
  "wih_id": "P0-T0000",
  "task_type": "infrastructure",
  "domain": "git",
  "phase": "0",
  "title": "Fork OpenClaw to controlled repository",
  "description": "Create fork of openclaw/openclaw to A2R organization",
  "blockedBy": [],
  "produces": ["fork_url", "origin_remote"],
  "estimated_hours": 1,
  "acceptance_criteria": [
    "Fork exists at github.com/{org}/openclaw",
    "Write access confirmed",
    "Default branch is 'a2r-main'"
  ],
  "compliance_checks": ["git_governance"]
}
```

**Commands:**
```bash
# On GitHub: Fork openclaw/openclaw to your org
# Local setup
git clone https://github.com/{org}/openclaw.git a2rchitech-openclaw
cd a2rchitech-openclaw
git remote rename origin fork-origin
git remote add origin https://github.com/{org}/a2rchitech-openclaw.git
git remote add upstream https://github.com/openclaw/openclaw.git
```

---

### P0-T0001: Configure Remotes
```json
{
  "wih_id": "P0-T0001",
  "task_type": "infrastructure",
  "domain": "git",
  "phase": "0",
  "title": "Configure git remotes for controlled fork",
  "description": "Set up origin and upstream remotes per FORK_SYNC_POLICY",
  "blockedBy": ["P0-T0000"],
  "produces": ["remote_config"],
  "estimated_hours": 0.5,
  "acceptance_criteria": [
    "'origin' points to A2R fork",
    "'upstream' points to openclaw/openclaw",
    "Both remotes accessible via SSH/HTTPS"
  ],
  "compliance_checks": ["remote_verification"]
}
```

**Commands:**
```bash
git remote add upstream https://github.com/openclaw/openclaw.git
git fetch upstream
git checkout -b upstream-main upstream/main
git push -u origin upstream-main
git checkout -b a2r-main
git push -u origin a2r-main
```

---

### P0-T0002: Create Branch Structure
```json
{
  "wih_id": "P0-T0002",
  "task_type": "infrastructure",
  "domain": "git",
  "phase": "0",
  "title": "Establish branch structure",
  "description": "Create upstream-main mirror and a2r-main product branch",
  "blockedBy": ["P0-T0001"],
  "produces": ["branches", "branch_protection_rules"],
  "estimated_hours": 1,
  "acceptance_criteria": [
    "'upstream-main' branch exists and tracks upstream/main",
    "'a2r-main' branch exists as product branch",
    "Branch protection on upstream-main (no direct commits)"
  ],
  "compliance_checks": ["branch_policy"]
}
```

---

### P0-T0003: Verify Fork Integrity
```json
{
  "wih_id": "P0-T0003",
  "task_type": "infrastructure",
  "domain": "git",
  "phase": "0",
  "title": "Verify fork integrity",
  "description": "Confirm upstream-main equals upstream/main byte-for-byte",
  "blockedBy": ["P0-T0002"],
  "produces": ["integrity_report"],
  "estimated_hours": 0.5,
  "acceptance_criteria": [
    "git diff upstream/main upstream-main shows no differences",
    "All upstream tags mirrored",
    "Submodules intact"
  ],
  "compliance_checks": ["byte_equality_check"]
}
```

---

### P0-T0004: Enable Rerere
```json
{
  "wih_id": "P0-T0004",
  "task_type": "infrastructure",
  "domain": "git",
  "phase": "0",
  "title": "Enable rerere for conflict learning",
  "description": "Configure git rerere to remember conflict resolutions",
  "blockedBy": ["P0-T0000"],
  "produces": ["rerere_config"],
  "estimated_hours": 0.25,
  "acceptance_criteria": [
    "rerere.enabled = true in git config",
    "rerere.autoupdate = true"
  ],
  "compliance_checks": ["git_config_check"]
}
```

---

### P0-T0005: Establish CI Gates
```json
{
  "wih_id": "P0-T0005",
  "task_type": "infrastructure",
  "domain": "ci",
  "phase": "0",
  "title": "Initialize CI gates",
  "description": "Set up GitHub Actions for build, test, and sync validation",
  "blockedBy": ["P0-T0002", "P0-T0004"],
  "produces": ["ci_workflows"],
  "estimated_hours": 2,
  "acceptance_criteria": [
    "Build workflow passes on a2r-main",
    "Test workflow passes",
    "Sync validation workflow created"
  ],
  "compliance_checks": ["ci_gates"]
}
```

---

## Phase 1: Vendor Map & Seam Discovery (Week 2)

**Objective:** Map all OpenClaw entry points and identify integration seams.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1 DAG: Vendor Map & Seam Discovery                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  P1-T0100 ─────▶ P1-T0101 ─────┬─────▶ P1-T0104 ─────▶ P1-T0105           │
│  (Structure)    (Entrypoints)  │       (Seams ID)      (Doc: Vendor        │
│                                │                       Map)               │
│                                │                                            │
│                                ├─────▶ P1-T0106 ─────▶ P1-T0107           │
│                                │       (Session)       (Doc: Session       │
│                                │                       API)               │
│                                │                                            │
│                                └─────▶ P1-T0108 ─────▶ P1-T0109           │
│                                        (Tools)          (Doc: Tools         │
│                                                         Pipeline)          │
│                                                                             │
│  P1-T0110 ─────▶ P1-T0111 ─────▶ P1-T0112 ─────▶ P1-T0113                 │
│  (Channels)     (File IO)       (Skills)        (Doc: Skills)             │
│                                                                             │
│  P1-T0114 ─────▶ P1-T0115                                                 │
│  (UI)           (Doc: UI Consolidation)                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P1-T0100: Map Repository Structure
```json
{
  "wih_id": "P1-T0100",
  "task_type": "analysis",
  "domain": "openclaw",
  "phase": "1",
  "title": "Map OpenClaw repository structure",
  "description": "Document complete file tree, dependencies, and build system",
  "blockedBy": ["P0-T0003"],
  "produces": ["structure_map", "dependency_graph"],
  "estimated_hours": 4,
  "acceptance_criteria": [
    "Complete file tree documented",
    "Package.json dependencies mapped",
    "Build scripts documented",
    "Entry points identified"
  ],
  "compliance_checks": ["documentation_complete"]
}
```

---

### P1-T0101: Identify Entry Points
```json
{
  "wih_id": "P1-T0101",
  "task_type": "analysis",
  "domain": "openclaw",
  "phase": "1",
  "title": "Identify all entry points",
  "description": "Map CLI, gateway, and UI entry points",
  "blockedBy": ["P1-T0100"],
  "produces": ["entrypoint_list"],
  "estimated_hours": 3,
  "acceptance_criteria": [
    "CLI commands documented",
    "Gateway endpoints documented",
    "UI routes documented"
  ],
  "compliance_checks": ["coverage_check"]
}
```

---

### P1-T0104: Identify Integration Seams
```json
{
  "wih_id": "P1-T0104",
  "task_type": "analysis",
  "domain": "integration",
  "phase": "1",
  "title": "Identify integration seams",
  "description": "Find hook points for law layer, routing, and receipts",
  "blockedBy": ["P1-T0101"],
  "produces": ["seam_catalog"],
  "estimated_hours": 6,
  "acceptance_criteria": [
    "Tool execution wrapper identified",
    "Skill registry dispatcher located",
    "File IO utilities found",
    "Session spawn layer identified"
  ],
  "compliance_checks": ["seam_viability"]
}
```

---

### P1-T0105: Document Vendor Map
```json
{
  "wih_id": "P1-T0105",
  "task_type": "documentation",
  "domain": "integration",
  "phase": "1",
  "title": "Create VENDOR_MAP.md",
  "description": "Produce comprehensive vendor map document",
  "blockedBy": ["P1-T0104", "P1-T0107", "P1-T0109", "P1-T0113"],
  "produces": ["docs/integration/VENDOR_MAP.md"],
  "estimated_hours": 4,
  "acceptance_criteria": [
    "VENDOR_MAP.md exists at docs/integration/",
    "All entrypoints documented",
    "All seams documented with line numbers",
    "A newcomer can locate seams in <10 minutes"
  ],
  "compliance_checks": ["doc_review"]
}
```

---

### P1-T0115: Document UI Consolidation Map
```json
{
  "wih_id": "P1-T0115",
  "task_type": "documentation",
  "domain": "ui",
  "phase": "1",
  "title": "Create UI_CONSOLIDATION_MAP.md",
  "description": "Map OpenClaw screens to A2R Shell screens",
  "blockedBy": ["P1-T0114"],
  "produces": ["docs/integration/UI_CONSOLIDATION_MAP.md"],
  "estimated_hours": 3,
  "acceptance_criteria": [
    "All OpenClaw UI features mapped",
    "A2R Shell target screens identified",
    "Migration strategy documented"
  ],
  "compliance_checks": ["ui_review"]
}
```

---

## Phase 2: A2R Kernel Contracts (Week 3)

**Objective:** Establish kernel contracts for WIH, receipts, and routing.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2 DAG: Kernel Contracts                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  P2-T0200 ─────▶ P2-T0201 ─────▶ P2-T0202 ─────▶ P2-T0203                 │
│  (WIH         (Receipt       (Routing       (Kernel                        │
│   Schema)      Schema)        Function)      Package)                     │
│                                                                             │
│                                                                             │
│  P2-T0204 ─────▶ P2-T0205 ─────▶ P2-T0206                                 │
│  (Policy      (Write         (Acceptance                                  │
│   Engine)      Gate)          Tests)                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P2-T0200: Define WIH Schema
```json
{
  "wih_id": "P2-T0200",
  "task_type": "contract",
  "domain": "kernel",
  "phase": "2",
  "title": "Define WIH schema",
  "description": "Create Work Item Header JSON schema",
  "blockedBy": [],
  "produces": ["spec/Contracts/WIH.schema.json"],
  "estimated_hours": 4,
  "acceptance_criteria": [
    "WIH.schema.json exists",
    "Schema validates all required fields",
    "blockedBy DAG field present",
    "produces field present"
  ],
  "compliance_checks": ["schema_validation"]
}
```

**Schema Outline:**
```json
{
  "$id": "WIH.schema.json",
  "type": "object",
  "required": ["wih_id", "task_type", "domain", "phase", "blockedBy", "produces"],
  "properties": {
    "wih_id": { "type": "string", "pattern": "^P[0-9]-T[0-9]+$" },
    "task_type": { "enum": ["infrastructure", "analysis", "contract", "adapter", "ui", "test"] },
    "domain": { "type": "string" },
    "phase": { "type": "string" },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "blockedBy": { "type": "array", "items": { "type": "string" } },
    "produces": { "type": "array", "items": { "type": "string" } },
    "estimated_hours": { "type": "number" },
    "acceptance_criteria": { "type": "array", "items": { "type": "string" } },
    "compliance_checks": { "type": "array", "items": { "type": "string" } }
  }
}
```

---

### P2-T0201: Define Receipt Schema
```json
{
  "wih_id": "P2-T0201",
  "task_type": "contract",
  "domain": "kernel",
  "phase": "2",
  "title": "Define Receipt schema",
  "description": "Create Receipt JSON schema for deterministic logging",
  "blockedBy": ["P2-T0200"],
  "produces": ["spec/Contracts/Receipt.schema.json"],
  "estimated_hours": 3,
  "acceptance_criteria": [
    "Receipt.schema.json exists",
    "Tool call receipts defined",
    "File write receipts defined",
    "Artifact receipts defined"
  ],
  "compliance_checks": ["schema_validation"]
}
```

---

### P2-T0203: Create a2r-kernel Package
```json
{
  "wih_id": "P2-T0203",
  "task_type": "implementation",
  "domain": "kernel",
  "phase": "2",
  "title": "Create packages/a2r-kernel",
  "description": "Implement WIH parser, policy engine, and receipt writer",
  "blockedBy": ["P2-T0200", "P2-T0201", "P2-T0202", "P2-T0205"],
  "produces": ["packages/a2r-kernel/"],
  "estimated_hours": 16,
  "acceptance_criteria": [
    "WIH parser validates headers",
    "Policy engine can deny operations",
    "Receipt writer produces valid receipts",
    "All unit tests pass"
  ],
  "compliance_checks": ["unit_tests", "integration_tests"]
}
```

---

## Phase 3: OpenClaw Runtime Adapter (Week 4-5)

**Objective:** Create adapter layer between A2R WorkItems and OpenClaw sessions.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3 DAG: Runtime Adapter                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  P3-T0300 ─────▶ P3-T0301 ─────┬─────▶ P3-T0304 ─────▶ P3-T0305           │
│  (Adapter      (WorkItem       │       (Receipt       (Acceptance          │
│   Interface)    Mapping)       │       Streamer)       Tests)             │
│                                │                                            │
│                                ├─────▶ P3-T0306 ─────▶ P3-T0307           │
│                                │       (Session        (Artifacts          │
│                                │       Bridge)         Collector)         │
│                                │                                            │
│                                └─────▶ P3-T0308                           │
│                                        (NEEDS_HUMAN                        │
│                                         Handler)                          │
│                                                                             │
│  P3-T0309 ─────▶ P3-T0310                                                 │
│  (Gateway      (Event                                                      │
│   Bridge)       Bus Integration)                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P3-T0300: Define Adapter Interface
```json
{
  "wih_id": "P3-T0300",
  "task_type": "contract",
  "domain": "adapter",
  "phase": "3",
  "title": "Define OpenClaw adapter interface",
  "description": "Create stable interface for A2R-OpenClaw integration",
  "blockedBy": ["P2-T0203"],
  "produces": ["packages/a2r-runtime-openclaw/src/contracts.ts"],
  "estimated_hours": 4,
  "acceptance_criteria": [
    "TypeScript interfaces defined",
    "WorkItem to Session mapping specified",
    "Receipt streaming interface defined",
    "NEEDS_HUMAN protocol defined"
  ],
  "compliance_checks": ["interface_review"]
}
```

---

### P3-T0301: Implement WorkItem Mapping
```json
{
  "wih_id": "P3-T0301",
  "task_type": "implementation",
  "domain": "adapter",
  "phase": "3",
  "title": "Implement WorkItem to OpenClaw session mapping",
  "description": "Convert A2R WorkItems to OpenClaw session configs",
  "blockedBy": ["P3-T0300"],
  "produces": ["packages/a2r-runtime-openclaw/src/adapter/workitem.ts"],
  "estimated_hours": 8,
  "acceptance_criteria": [
    "WIH fields map to OpenClaw agent config",
    "Channel routing configured",
    "Skill context injected"
  ],
  "compliance_checks": ["mapping_tests"]
}
```

---

### P3-T0305: Acceptance Tests
```json
{
  "wih_id": "P3-T0305",
  "task_type": "test",
  "domain": "adapter",
  "phase": "3",
  "title": "Adapter acceptance tests",
  "description": "End-to-end test: WorkItem → Session → Receipts",
  "blockedBy": ["P3-T0304", "P3-T0307"],
  "produces": ["tests/adapter/acceptance.test.ts"],
  "estimated_hours": 8,
  "acceptance_criteria": [
    "One WorkItem executes end-to-end",
    "Receipts are produced",
    "Artifacts are routed correctly",
    "Smoke test passes"
  ],
  "compliance_checks": ["e2e_tests", "receipt_validation"]
}
```

---

## Phase 4: Deterministic File Governance (Week 6)

**Objective:** Implement write gates and quarantine system.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4 DAG: File Governance                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  P4-T0400 ─────▶ P4-T0401 ─────▶ P4-T0402 ─────▶ P4-T0403                 │
│  (Write        (Allowed       (Write         (PreTool                      │
│   Gate Hook)    Roots Config)  Gate Impl)     Integration)                │
│                                                                             │
│                                                                             │
│  P4-T0404 ─────▶ P4-T0405 ─────▶ P4-T0406 ─────▶ P4-T0407                 │
│  (Quarantine   (ROUTE_ME      (Janitor       (Acceptance                   │
│   System)       Schema)        Agent)         Tests)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P4-T0400: Implement Write Gate Hook
```json
{
  "wih_id": "P4-T0400",
  "task_type": "implementation",
  "domain": "law",
  "phase": "4",
  "title": "Implement write gate hook",
  "description": "Create PreToolUse hook for write authorization",
  "blockedBy": ["P2-T0203"],
  "produces": ["extensions/a2r-lawlayer/src/hooks/write_gate.ts"],
  "estimated_hours": 8,
  "acceptance_criteria": [
    "Hook intercepts file writes",
    "Path validation against allowed roots",
    "Canonical path computation",
    "Rejection for non-compliant paths"
  ],
  "compliance_checks": ["hook_tests", "path_validation"]
}
```

---

### P4-T0404: Implement Quarantine System
```json
{
  "wih_id": "P4-T0404",
  "task_type": "implementation",
  "domain": "law",
  "phase": "4",
  "title": "Implement quarantine system",
  "description": "Quarantine uncertain writes to inbox/",
  "blockedBy": ["P4-T0402"],
  "produces": ["extensions/a2r-lawlayer/src/quarantine/"],
  "estimated_hours": 6,
  "acceptance_criteria": [
    "Uncertain writes go to work/inbox/",
    "ROUTE_ME.json generated per file",
    "Files isolated from main workspace"
  ],
  "compliance_checks": ["isolation_tests"]
}
```

---

### P4-T0406: Implement Janitor Agent
```json
{
  "wih_id": "P4-T0406",
  "task_type": "implementation",
  "domain": "law",
  "phase": "4",
  "title": "Implement janitor agent",
  "description": "Cron agent to process quarantine inbox",
  "blockedBy": ["P4-T0404", "P4-T0405"],
  "produces": ["extensions/a2r-lawlayer/src/janitor/organizer.ts"],
  "estimated_hours": 8,
  "acceptance_criteria": [
    "Scans inbox periodically",
    "Proposes moves above confidence threshold",
    "Logs every action",
    "Executes approved moves"
  ],
  "compliance_checks": ["audit_log"]
}
```

---

## Phase 5: UI Consolidation (Week 7-8)

**Objective:** Build unified A2R Shell consolidating OpenClaw + Claude desktopruntime + OpenWork + A2R existing.

**UI Sources:**
- A2R Shell (`apps/shell/`) - Base architecture
- OpenClaw (`upstream/openclaw/ui/`) - Channels, Canvas, Skills UI
- Claude Desktop (`desktopruntime/`) - Window chrome, model selector
- OpenWork (`apps/openwork/`) - Workspace panels, file tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5 DAG: UI Consolidation                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  P5-T0500 ─────▶ P5-T0501 ─────▶ P5-T0502 ─────▶ P5-T0503                 │
│  (Shell        (WorkItems     (Agent         (Inspector                   │
│   Scaffold)     View)          Roster)        View)                       │
│                                                                             │
│                                                                             │
│  P5-T0504 ─────▶ P5-T0505 ─────▶ P5-T0506 ─────▶ P5-T0507                 │
│  (Scheduler    (Channels      (Skills        (Acceptance                  │
│   View)         Integration)    Integration)   Tests)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P5-T0500: Create A2R Shell Scaffold
```json
{
  "wih_id": "P5-T0500",
  "task_type": "implementation",
  "domain": "ui",
  "phase": "5",
  "title": "Create apps/a2r-shell scaffold",
  "description": "Initialize new consolidated shell application",
  "blockedBy": ["P3-T0305"],
  "produces": ["apps/a2r-shell/"],
  "estimated_hours": 4,
  "acceptance_criteria": [
    "React/TypeScript project scaffolded",
    "Build system configured",
    "Routing infrastructure ready",
    "Base components imported"
  ],
  "compliance_checks": ["build_pass"]
}
```

---

### P5-T0505: Channels Integration
```json
{
  "wih_id": "P5-T0505",
  "task_type": "implementation",
  "domain": "ui",
  "phase": "5",
  "title": "Integrate OpenClaw channels into Shell",
  "description": "Add WhatsApp/Telegram/Slack/Discord channels to Shell UI",
  "blockedBy": ["P5-T0500"],
  "produces": ["apps/a2r-shell/src/integrations/openclaw/ChannelPanel.tsx"],
  "estimated_hours": 16,
  "acceptance_criteria": [
    "Channel list visible",
    "Message history displayed",
    "Send/receive functional",
    "DM pairing UI implemented"
  ],
  "compliance_checks": ["ui_tests", "integration_tests"]
}
```

---

### P5-T0506: Skills Integration
```json
{
  "wih_id": "P5-T0506",
  "task_type": "implementation",
  "domain": "ui",
  "phase": "5",
  "title": "Integrate OpenClaw skills into Marketplace",
  "description": "Merge OpenClaw skills with A2R Marketplace",
  "blockedBy": ["P5-T0500"],
  "produces": ["apps/a2r-shell/src/integrations/marketplace/OpenClawSkillCard.tsx"],
  "estimated_hours": 12,
  "acceptance_criteria": [
    "OpenClaw skills browsable",
    "Install gating functional",
    "Skill config UI working"
  ],
  "compliance_checks": ["ui_tests"]
}
```

---

## Phase 6: Upstream Update Pipeline (Week 9)

**Objective:** Document and automate upstream merge process.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 6 DAG: Upstream Pipeline                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  P6-T0600 ─────▶ P6-T0601 ─────▶ P6-T0602 ─────▶ P6-T0603                 │
│  (Sync         (Merge         (Conflict      (Document                     │
│   Script)       Procedure)     Resolution)     FORK_SYNC                   │
│                                                 _POLICY)                  │
│                                                                             │
│                                                                             │
│  P6-T0604 ─────▶ P6-T0605 ─────▶ P6-T0606                                 │
│  (CI Gates     (Vendor        (Smoke                                                        │
│   Enhancement)  Build Test)     Test)                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P6-T0603: Document Fork Sync Policy
```json
{
  "wih_id": "P6-T0603",
  "task_type": "documentation",
  "domain": "git",
  "phase": "6",
  "title": "Create FORK_SYNC_POLICY.md",
  "description": "Document exact commands and procedures for upstream sync",
  "blockedBy": ["P6-T0600", "P6-T0601", "P6-T0602"],
  "produces": ["docs/integration/FORK_SYNC_POLICY.md"],
  "estimated_hours": 4,
  "acceptance_criteria": [
    "Exact commands documented",
    "Branch rules specified",
    "Rerere workflow described",
    "CI gate requirements listed"
  ],
  "compliance_checks": ["doc_review"]
}
```

---

### P6-T0606: Smoke Test
```json
{
  "wih_id": "P6-T0606",
  "task_type": "test",
  "domain": "ci",
  "phase": "6",
  "title": "Implement smoke test",
  "description": "Test that runs one WorkItem and verifies receipts + routed artifacts",
  "blockedBy": ["P6-T0604", "P6-T0605"],
  "produces": [".github/workflows/smoke-test.yml"],
  "estimated_hours": 4,
  "acceptance_criteria": [
    "WorkItem executes",
    "Receipts exist and are valid",
    "Artifacts routed to canonical paths",
    "No writes outside workspace"
  ],
  "compliance_checks": ["smoke_pass"]
}
```

---

## Phase 7: Rebranding & Naming Cleanup (Post-Integration)

**Objective:** Remove all OpenClaw branding and establish unified A2R naming after full integration is verified working.

**Prerequisite:** All Phase 0-6 acceptance criteria passed. Shell UI operational. Runtime stable.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 7 DAG: Rebranding (Execute ONLY after P6-T0606 passes)                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  P7-T0700 ─────▶ P7-T0701 ─────▶ P7-T0702 ─────▶ P7-T0703                 │
│  (Audit        (Namespace     (UI String     (Documentation                │
│   References)    Rename)       Cleanup)       Update)                     │
│                                                                             │
│                                                                             │
│  P7-T0704 ─────▶ P7-T0705 ─────▶ P7-T0706                                 │
│  (Config       (Package       (Final                                        │
│   Keys)         Names)         Verification)                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P7-T0700: Audit OpenClaw References
```json
{
  "wih_id": "P7-T0700",
  "task_type": "analysis",
  "domain": "rebrand",
  "phase": "7",
  "title": "Audit all OpenClaw naming references",
  "description": "Comprehensive grep for 'openclaw', 'OpenClaw', 'claw' branding in user-visible strings",
  "blockedBy": ["P6-T0606"],
  "produces": ["rebrand/OPENCLAW_REFERENCES_AUDIT.md"],
  "estimated_hours": 2,
  "acceptance_criteria": [
    "Complete list of files containing OpenClaw branding",
    "Categorized by: user-visible, config keys, internal refs, docs",
    "Impact assessment for each reference"
  ],
  "compliance_checks": ["audit_complete"]
}
```

---

### P7-T0701: Rename Namespaces & Modules
```json
{
  "wih_id": "P7-T0701",
  "task_type": "refactor",
  "domain": "rebrand",
  "phase": "7",
  "title": "Rename runtime namespaces from OpenClaw to A2R",
  "description": "Change package names, module imports, type names while preserving functionality",
  "blockedBy": ["P7-T0700"],
  "produces": ["packages/a2r-runtime/", "extensions/a2r-channels/"],
  "estimated_hours": 8,
  "acceptance_criteria": [
    "packages/a2r-runtime-openclaw/ renamed to packages/a2r-runtime/",
    "No 'openclaw' in import paths",
    "All tests pass after rename",
    "No functional changes"
  ],
  "compliance_checks": ["tests_pass", "no_regressions"]
}
```

---

### P7-T0702: UI String Cleanup
```json
{
  "wih_id": "P7-T0702",
  "task_type": "refactor",
  "domain": "rebrand",
  "phase": "7",
  "title": "Remove OpenClaw branding from UI strings",
  "description": "Update labels, titles, descriptions in Shell UI and TUI",
  "blockedBy": ["P7-T0701"],
  "produces": ["clean_ui_strings"],
  "estimated_hours": 4,
  "acceptance_criteria": [
    "No 'OpenClaw' in user-facing UI text",
    "Channel names remain descriptive (WhatsApp, Telegram, etc.)",
    "Runtime labeled as 'A2R Runtime'",
    "Help text updated"
  ],
  "compliance_checks": ["ui_audit"]
}
```

---

### P7-T0704: Update Config Keys
```json
{
  "wih_id": "P7-T0704",
  "task_type": "refactor",
  "domain": "rebrand",
  "phase": "7",
  "title": "Migrate config keys from openclaw to a2r",
  "description": "Update configuration schema and provide migration for existing configs",
  "blockedBy": ["P7-T0701"],
  "produces": ["config_migration_script"],
  "estimated_hours": 6,
  "acceptance_criteria": [
    "Config keys use 'a2r' or 'runtime' prefix",
    "Migration script for existing openclaw.json configs",
    "Backward compatibility handled or documented",
    "Environment variables updated"
  ],
  "compliance_checks": ["migration_test"]
}
```

---

### P7-T0706: Final Verification
```json
{
  "wih_id": "P7-T0706",
  "task_type": "verification",
  "domain": "rebrand",
  "phase": "7",
  "title": "Final rebranding verification",
  "description": "Complete sweep to confirm no OpenClaw references remain in user-facing surfaces",
  "blockedBy": ["P7-T0702", "P7-T0703", "P7-T0704", "P7-T0705"],
  "produces": ["rebrand/VERIFICATION_REPORT.md"],
  "estimated_hours": 2,
  "acceptance_criteria": [
    "grep -r 'openclaw\\|OpenClaw' --include='*.ts' --include='*.tsx' --include='*.json' returns only upstream/ references",
    "UI displays 'A2R Runtime' not 'OpenClaw'",
    "Documentation uses unified naming",
    "All acceptance tests pass"
  ],
  "compliance_checks": ["zero_references", "full_test_pass"]
}
```

---

---

## Master Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MASTER DEPENDENCY GRAPH                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 0 (Foundation Fork)                                                  │
│  ├── P0-T0000 (Fork) ─────────────────────────┐                            │
│  ├── P0-T0001 (Remotes) ◄─────────────────────┤                            │
│  ├── P0-T0002 (Branches) ◄────────────────────┤                            │
│  ├── P0-T0003 (Verify) ◄──────────────────────┤                            │
│  ├── P0-T0004 (Rerere) ◄──────────────────────┘                            │
│  └── P0-T0005 (CI Gates) ◄────────────────────┐                            │
│                                               │                            │
│  PHASE 1 (Vendor Map) ◄───────────────────────┘                            │
│  ├── P1-T0100 (Structure)                                                   │
│  ├── P1-T0101 (Entrypoints) ◄──┬──┬──┐                                     │
│  ├── P1-T0104 (Seams) ◄────────┘  │  │                                     │
│  ├── P1-T0105 (VENDOR_MAP) ◄───────┘  │                                     │
│  ├── P1-T0106 (Session API) ◄─────────┤                                     │
│  ├── P1-T0107 (Doc Session) ◄─────────┘                                     │
│  ├── P1-T0108 (Tools Pipeline) ◄──────┐                                     │
│  ├── P1-T0109 (Doc Tools) ◄───────────┤                                     │
│  ├── P1-T0112 (Doc Skills) ◄──────────┤                                     │
│  └── P1-T0115 (UI Consolidation Map) ◄┘                                     │
│                                                                             │
│  PHASE 2 (Kernel Contracts)                                                 │
│  ├── P2-T0200 (WIH Schema) ◄──┬──┬──┐                                      │
│  ├── P2-T0201 (Receipt Schema)◄┘  │  │                                      │
│  ├── P2-T0202 (Routing) ◄─────────┤  │                                      │
│  ├── P2-T0203 (Kernel Package) ◄──┴──┼──┬──┐                               │
│  ├── P2-T0204 (Policy Engine) ◄──────┘  │  │                               │
│  └── P2-T0205 (Write Gate) ◄────────────┘  │                               │
│                                             │                               │
│  PHASE 3 (Runtime Adapter) ◄────────────────┘                               │
│  ├── P3-T0300 (Adapter Interface)                                           │
│  ├── P3-T0301 (WorkItem Mapping) ◄──┬──┬──┐                                │
│  ├── P3-T0304 (Receipt Streamer) ◄──┘  │  │                                │
│  ├── P3-T0306 (Session Bridge) ◄───────┤  │                                │
│  ├── P3-T0307 (Artifacts) ◄────────────┘  │                                │
│  ├── P3-T0308 (NEEDS_HUMAN) ◄─────────────┤                                │
│  ├── P3-T0309 (Gateway Bridge) ◄──────────┤                                │
│  └── P3-T0310 (Event Bus) ◄───────────────┘                                │
│                                                                             │
│  PHASE 4 (File Governance)                                                  │
│  ├── P4-T0400 (Write Gate Hook)                                             │
│  ├── P4-T0401 (Allowed Roots) ◄──┐                                          │
│  ├── P4-T0402 (Gate Impl) ◄──────┤                                          │
│  ├── P4-T0403 (PreTool Integration)◄┼──┐                                   │
│  ├── P4-T0404 (Quarantine) ◄────────┘  │                                   │
│  ├── P4-T0405 (ROUTE_ME) ◄─────────────┤                                   │
│  └── P4-T0406 (Janitor) ◄──────────────┘                                   │
│                                                                             │
│  PHASE 5 (UI Consolidation)                                                 │
│  ├── P5-T0500 (Shell Scaffold)                                              │
│  ├── P5-T0501 (WorkItems) ◄──┬──┬──┬──┐                                    │
│  ├── P5-T0502 (Agent Roster)◄┘  │  │  │                                    │
│  ├── P5-T0503 (Inspector) ◄─────┘  │  │                                    │
│  ├── P5-T0504 (Scheduler) ◄────────┘  │                                    │
│  ├── P5-T0505 (Channels) ◄────────────┤                                    │
│  └── P5-T0506 (Skills) ◄──────────────┘                                    │
│                                                                             │
│  PHASE 6 (Upstream Pipeline)                                                │
│  ├── P6-T0600 (Sync Script)                                                 │
│  ├── P6-T0601 (Merge Procedure) ◄──┐                                        │
│  ├── P6-T0602 (Conflict Resolution)◄┼──┐                                   │
│  ├── P6-T0603 (FORK_SYNC_POLICY) ◄──┘  │                                   │
│  ├── P6-T0604 (CI Gates) ◄─────────────┤                                   │
│  ├── P6-T0605 (Vendor Build) ◄─────────┘                                   │
│  └── P6-T0606 (Smoke Test)                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Compliance Checkpoints by Phase

| Phase | Checkpoint | Verification |
|-------|------------|--------------|
| 0 | Git governance | Remotes, branches, rerere configured |
| 1 | Vendor map complete | VENDOR_MAP.md reviewed |
| 2 | Kernel contracts | Schemas validate, tests pass |
| 3 | Adapter functional | E2E test passes |
| 4 | File governance | No writes outside workspace |
| 5 | UI functional | Shell operates without OpenClaw UI |
| 6 | Upstream ready | Merge tested, smoke passes |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OpenClaw upstream breaks API | Medium | High | Pin versions, use patches/ sparingly |
| WIH schema too restrictive | Low | Medium | Iterate schema with ADR process |
| Performance degradation | Medium | Medium | Benchmark at each phase |
| UI consolidation complexity | High | Medium | Incremental migration, feature flags |
| Compliance gaps missed | Low | High | Automated compliance checks in CI |

---

## Definition of Done (Integration Complete)

- [ ] A2R Shell runs core workflows
- [ ] WorkItems execute through OpenClaw runtime adapter
- [ ] All outputs routed deterministically
- [ ] Receipts produced for every operation
- [ ] Upstream merges repeatable and low-conflict
- [ ] CI gates pass (build, test, smoke)
- [ ] Compliance audit passes
- [ ] Rebranding complete (Phase 7) - no OpenClaw user-facing references

---

**End of Phased Plan Document**

*Next: See A2R_OPENCLAW_UI_CONCEPTS.md for ASCII UI wireframes and screen designs*
