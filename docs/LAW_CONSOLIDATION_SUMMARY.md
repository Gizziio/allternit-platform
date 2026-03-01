# LAW Consolidation Summary
## What Was Consolidated and How

**Date:** 2026-02-20  
**Action:** LAW documents consolidated into single constitutional framework  
**Result:** `/PROJECT_LAW.md` (Tier-0 Authority at repo root)

---

## Executive Summary

**Before:** 8 separate LAW-related documents across multiple directories, creating perceived fragmentation.

**After:** 1 consolidated constitutional document (`/PROJECT_LAW.md`) with domain-specific appendices.

**Key Insight:** The documents were **complementary, not conflicting** - they served different scopes:
- PROJECT_LAW.md: Constitutional law
- AGENTS.md: DAK Runner-specific law
- ONTOLOGY_LAW.md: Entity definitions
- Guardrails.md: Implementation templates
- Living Files Theory: Knowledge management doctrine
- Harness Engineering: Enforcement plane spec
- A2A Review Protocol: Review state machine
- Garbage Collection: Entropy compression

**Consolidation Approach:** Merge constitutional principles into single document, retain domain-specific implementations as appendices.

---

## Documents Consolidated

### 1. PROJECT_LAW.md (Original)

**Location:** `docs/_archive/legacy-specs/organized/Architecture/LAW/Project_Law.md`

**What Was Taken:**
- Articles I-V (Guardrails, Project Organization, Agentic Framework, Enforcement, Change Control)
- All LAW-XXX rule numbers preserved
- Operational cheat sheet

**Where It Went:**
- Part I: Guardrails (LAW-GRD-001 through LAW-GRD-005)
- Part II: Project Organization (LAW-ORG-001 through LAW-ORG-005)
- Part III: Agentic Framework (LAW-META-001 through LAW-META-005)
- Part V: Enforcement & Automation (LAW-ENF-001 through LAW-ENF-003)
- Part VI: Change Control (LAW-CHG-001 through LAW-CHG-003)
- Part X: Final Clause

**Status:** ✅ Fully consolidated

---

### 2. AGENTS.md (DAK Runner Law)

**Location:** `5-agents/AGENTS.md`

**What Was Taken:**
- Non-negotiable invariants (Authority Separation, Tool Execution Rule, Write Discipline, Mutual Blocking)
- Role definitions (Orchestrator, Builder, Validator, Reviewer, Security, Planner)
- Hook lifecycle
- Context pack injection requirements
- Receipt requirements
- Ralph loop rules

**Where It Went:**
- Part III: Agentic Framework (LAW-META-003: Role-Bound Agents, LAW-META-006: A2A Review Protocol)
- Part IV: Ontology (LAW-ONT-002 through LAW-ONT-007: Authority, Determinism, Proposal, Truth, Surface, Persona Laws)
- Part VII: Swarm Orchestration (LAW-SWM-001 through LAW-SWM-005)
- Appendix A.1: DAK Runner Law (retained as domain-specific application)

**Status:** ⚠️ Principles consolidated, operational details retained in `/5-agents/AGENTS.md`

**Reason for Retention:** AGENTS.md contains DAK Runner-specific operational details (file paths, CLI commands, specific implementations) that are too granular for constitutional law.

---

### 3. ONTOLOGY_LAW.md

**Location:** `docs/_archive/legacy-specs/organized/a2rchitech-specs(temporary)/LAW/ONTOLOGY_LAW.md`

**What Was Taken:**
- Canonical entity definitions (IO, Kernel, Models, Shell, Gizzi)
- Non-negotiable laws (Authority Law, Determinism Law, Proposal Law, Truth Law, Surface Law, Persona Law)
- Naming restrictions
- Contract namespaces
- Authority flow diagram

**Where It Went:**
- Part IV: Ontology (LAW-ONT-001 through LAW-ONT-007)
- Appendix A.2: Ontology Definitions (reference to original)

**Status:** ✅ Fully consolidated

**Original Retained:** As `/spec/ontology.md` for reference (expanded definitions)

---

### 4. Guardrails.md

**Location:** `docs/_archive/legacy-specs/organized/Architecture/LAW/Guardrails.md`

**What Was Taken:**
- Core philosophy (No Backwards Compatibility Bias, Plan Before Action, Separation of Phases)
- Mandatory planning guardrail
- Simplicity over legacy rule
- Static safety guardrails
- Structural separation rules
- Testing as first-class output

**Where It Went:**
- Part I: Guardrails (LAW-GRD-001 through LAW-GRD-006)
- LAW-GRD-004: Plan ≠ Execute (from "Separation of Phases")
- LAW-GRD-005: No "Just Make It Work" (from "Simplicity Over Legacy Rule")

**Status:** ✅ Fully consolidated

**Original Retained:** In archive for historical reference

---

### 5. Living Files Theory

**Location:** `docs/_archive/brainstorm session files/livingfilestheory.md`

**What Was Taken:**
- Living File definition (versioned artifact referenced by agents, validated mechanically, influences behavior, subject to drift detection, triggers remediation)
- Five categories (Intent, Constraint, Quality Ledger, Runtime Legibility, Generated)
- Enforcement rule (no file without validation surface)
- Drift protocol
- Doc-gardener agent concept

**Where It Went:**
- LAW-ORG-006: Living Files Doctrine
- LAW-ENF-005: Entropy Compression Engine (drift detection)
- Part VIII: Quality Ledger (LAW-QLT-001 through LAW-QLT-003)
- Appendix A.4: Living Files Doctrine (reference to expanded doctrine)

**Status:** ✅ Principles consolidated

**Original Retained:** As `/docs/governance/LIVING_FILES_DOCTRINE.md` (expanded doctrinal document)

---

### 6. Harness Engineering Blueprint

**Location:** `docs/_archive/brainstorm session files/harness-engineering.md`

**What Was Taken:**
- Three core components (Context Engineering, Architectural Constraints, Garbage Collection)
- Context pack generator concept
- Structural linters requirement
- Risk tier enforcement
- Tool wrapper system
- Evidence-based merge
- Adaptive feedback loop

**Where It Went:**
- LAW-ENF-004: Harness Engineering Requirements
- LAW-ENF-006: Observability Legibility Contract
- Part II: Project Organization (context reset discipline)

**Status:** ✅ Principles consolidated

**Original Retained:** As `/spec/HarnessEngineering.md` (implementation spec)

---

### 7. A2A Review Protocol

**Location:** `docs/_archive/brainstorm session files/` (from agent-teams.md, livingfilestheory.md)

**What Was Taken:**
- Review roles (Implementer, Self-Reviewer, Structural Reviewer, Tester, Security Reviewer, Policy Gate, Garbage Collector)
- State machine (TASK_CREATED → ... → MERGED)
- Human escalation criteria
- Merge philosophy

**Where It Went:**
- LAW-META-006: A2A Deterministic Review Protocol
- Appendix A.5: A2A Review Protocol (reference to implementation)

**Status:** ✅ Consolidated as constitutional requirement

**Original Retained:** As `/agent/review-protocol.md` (implementation spec)

---

### 8. Garbage Collection Engine

**Location:** `docs/_archive/brainstorm session files/` (from livingfilestheory.md, harness-engineering.md)

**What Was Taken:**
- Golden principles (no unvalidated external data, boundary parsing, shared utilities, structured logging, no silent catch, max file size, dependency direction)
- GC agent specifications (daily runs, duplicate detection, boundary violations, missing observability, stale documentation, test coverage)
- Entropy score calculation
- Quality grades concept

**Where It Went:**
- LAW-ENF-005: Entropy Compression Engine
- Part VIII: Quality Ledger (LAW-QLT-001 through LAW-QLT-003)

**Status:** ✅ Consolidated as constitutional requirement

**Original Retained:** As `/agent/garbage-collection.md` (implementation spec)

---

## New Additions (Not in Original Documents)

### 1. Swarm Orchestration Section (Part VII)

**Why Added:** To codify swarm orchestration principles from `A2R_Swarm_Runtime_Kernel_Spec_v1.md` at constitutional level.

**New Laws:**
- LAW-SWM-001: Deterministic DAG Execution
- LAW-SWM-002: Parallelism Without Shared Mutable State
- LAW-SWM-003: Conflict Arbitration
- LAW-SWM-004: Budget-Aware Scheduling
- LAW-SWM-005: Evidence-First Outputs

---

### 2. Quality Ledger Section (Part VIII)

**Why Added:** To codify quality tracking from Living Files Theory and Garbage Collection spec.

**New Laws:**
- LAW-QLT-001: Domain Grades
- LAW-QLT-002: Entropy Score
- LAW-QLT-003: Quality Optimization

---

### 3. Operational Cheat Sheet (Part IX)

**Why Added:** To provide quick reference for different roles.

**Content:**
- Role-based reading guide
- Quick lookup by task type

---

## Structural Changes

### Before: Fragmented Structure

```
docs/_archive/legacy-specs/organized/Architecture/LAW/
├── Project_Law.md
├── RepoLaw.md
├── Guardrails.md
├── OperatingSystem.md
├── PROJECT_LAW copy.md
└── Architecture_Documentation.md

docs/_archive/legacy-specs/organized/a2rchitech-specs(temporary)/LAW/
└── ONTOLOGY_LAW.md

5-agents/
└── AGENTS.md

docs/_archive/brainstorm session files/
├── livingfilestheory.md
├── harness-engineering.md
└── agent-teams.md
```

### After: Consolidated Structure

```
/
├── PROJECT_LAW.md                          # Tier-0 Constitutional Law (repo root)
│
├── docs/
│   └── LAW_INDEX.md                        # Cross-reference guide
│
├── spec/
│   ├── ontology.md                         # Expanded entity definitions (retained)
│   ├── HarnessEngineering.md               # Implementation spec (retained)
│   └── ...
│
├── 5-agents/
│   └── AGENTS.md                           # DAK Runner law (retained)
│
├── agent/
│   ├── review-protocol.md                  # A2A review implementation (retained)
│   └── garbage-collection.md               # GC engine implementation (retained)
│
└── docs/governance/
    └── LIVING_FILES_DOCTRINE.md            # Expanded doctrine (retained)
```

---

## What Changed vs What Stayed the Same

### ✅ Preserved (No Changes)

- All LAW-XXX rule numbers from original PROJECT_LAW.md
- Core guardrails (No Silent Assumptions, No Silent Mutation, etc.)
- Ontology definitions (IO, Kernel, Models, Shell, Gizzi)
- Role definitions (Architect, Implementer, Tester, Reviewer, Security)
- Receipt requirements
- ADR requirements for changes

### ⚠️ Modified (Minor Changes)

- LAW-GRD-006 added (Harness First, Not Prompt First) - from Harness Engineering
- LAW-ORG-006 added (Living Files Doctrine) - from Living Files Theory
- LAW-META-006 added (A2A Review Protocol) - from Review Protocol
- LAW-ENF-004 through LAW-ENF-006 added (Harness, Observability, Entropy) - from various specs
- Part VII (Swarm Orchestration) added - from Swarm Runtime Spec
- Part VIII (Quality Ledger) added - from GC spec

### ❌ Removed (Not Consolidated)

- Duplicate content (same principle stated multiple ways)
- Implementation-specific details (file paths, CLI commands)
- Historical context not needed for constitutional law
- "Vibes" and philosophical statements without enforcement

---

## Domain-Specific Documents Retained

These documents are **retained** as domain-specific applications of PROJECT_LAW.md:

### 1. AGENTS.md (5-agents/)

**Why Retained:** Contains DAK Runner-specific operational details

**Relationship:** Implements PROJECT_LAW.md Part III (Agentic Framework) for DAK context

**Key Operational Details:**
- Authority separation (Rails Control vs DAK Execution)
- Tool execution rule (PreToolUse gate, receipts)
- Write discipline (`.a2r/runner/` boundaries)
- Mutual blocking (Builder ≠ Validator)
- Ralph loop rules (bounded fix cycles)
- Hook lifecycle (SessionStart → UserPromptSubmit → PreToolUse → PostToolUse → SessionEnd)
- Context pack injection requirements
- Specific receipt types and requirements

---

### 2. HarnessEngineering.md (spec/)

**Why Retained:** Implementation spec for LAW-ENF-004

**Relationship:** Implements PROJECT_LAW.md LAW-ENF-004 (Harness Engineering Requirements)

**Key Implementation Details:**
- Context pack generator implementation
- Structural linters (WIH header, boundary, contract, docs drift)
- Risk tier model (0-4)
- Tool wrapper system
- Evidence-based merge workflow
- CI scaffold (GitHub Actions)

---

### 3. Living Files Doctrine (docs/governance/)

**Why Retained:** Doctrinal expansion of LAW-ORG-006

**Relationship:** Expands PROJECT_LAW.md LAW-ORG-006 (Living Files Doctrine)

**Key Doctrinal Content:**
- Five categories with detailed examples
- Drift protocol with detection mechanisms
- Validation surface requirements
- Doc-gardener agent specification

---

### 4. A2A Review Protocol (agent/)

**Why Retained:** Implementation of LAW-META-006

**Relationship:** Implements PROJECT_LAW.md LAW-META-006 (A2A Review Protocol)

**Key Implementation Details:**
- Full state machine definition
- Role permissions table
- Stage definitions (IMPLEMENTATION_RUNNING, SELF_REVIEW, etc.)
- Escalation rules
- Merge philosophy

---

### 5. Garbage Collection Engine (agent/)

**Why Retained:** Implementation of LAW-ENF-005

**Relationship:** Implements PROJECT_LAW.md LAW-ENF-005 (Entropy Compression Engine)

**Key Implementation Details:**
- Golden principles with examples
- GC agent specifications (6 daily agents)
- Entropy score calculation formula
- Quality grades structure

---

## Migration Path

### Week 1 Actions

1. **Move PROJECT_LAW.md to repo root** ✅
   - Location: `/PROJECT_LAW.md`

2. **Create LAW INDEX** ✅
   - Location: `/docs/LAW_INDEX.md`

3. **Update references in existing docs**
   - Add header to all retained documents: "This document derives authority from PROJECT_LAW.md Section X.X"

4. **Update ARCHITECTURE.md**
   - Reference PROJECT_LAW.md as Tier-0 authority
   - Update LAW references to point to consolidated document

5. **Update AGENTS.md**
   - Add header: "This document implements PROJECT_LAW.md Part III for DAK Runner context"

---

## Validation Checklist

- [ ] PROJECT_LAW.md at repo root
- [ ] LAW INDEX created and linked
- [ ] All retained documents have authority headers
- [ ] ARCHITECTURE.md references PROJECT_LAW.md
- [ ] AGENTS.md references PROJECT_LAW.md
- [ ] No conflicting LAW statements in retained docs
- [ ] All LAW-XXX numbers are unique and traceable
- [ ] Cross-references work (LAW_INDEX.md → retained docs)

---

## Benefits of Consolidation

### Before (8 documents)

**Pros:**
- Detailed domain-specific guidance
- Separation of concerns

**Cons:**
- Perceived fragmentation ("critical crisis")
- Hard to find authoritative source
- Duplicate content across documents
- No single entry point for new contributors

### After (1 constitutional + 5 domain-specific)

**Pros:**
- Single Tier-0 authority at repo root
- Clear hierarchy (constitutional → domain-specific → implementation)
- No duplicate content
- Easy entry point for new contributors
- LAW INDEX provides cross-reference

**Cons:**
- Large document (requires good navigation)
- Domain-specific details in separate docs (mitigated by LAW INDEX)

---

## Conclusion

**Consolidation Status:** ✅ Complete

**Result:** One constitutional document (`/PROJECT_LAW.md`) with five domain-specific applications retained for operational details.

**Next Steps:**
1. Update all references to point to consolidated document
2. Add authority headers to retained documents
3. Train agents to load PROJECT_LAW.md first
4. Implement LAW-ENF-001 (Mandatory Load Order)

---

**End of Consolidation Summary**
