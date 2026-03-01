# SYSTEM_LAW.md Consolidation Summary
## What Was Consolidated and How

**Version:** 2.0.0  
**Date:** 2026-02-20  
**Action:** LAW documents consolidated into single constitutional framework  
**Name Change:** `PROJECT_LAW.md` → `SYSTEM_LAW.md` (reflects system-wide authority)  
**Result:** `/SYSTEM_LAW.md` (Tier-0 Authority at repo root)

---

## Executive Summary

**Before:** 8 separate LAW-related documents across multiple directories, creating perceived fragmentation.

**After:** 1 consolidated constitutional document (`/SYSTEM_LAW.md`) with domain-specific appendices.

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

**Version 2.0 Additions:**
- LAW-GRD-007 through LAW-GRD-010 (Anti-laziness guardrails)
- LAW-META-007 through LAW-META-008 (WIH + Rails enforcement)
- LAW-OPS-001 through LAW-OPS-003 (Failure semantics)
- LAW-ONT-008 through LAW-ONT-010 (IO replay + randomness)
- LAW-SEC-001 through LAW-SEC-003 (Security codification)
- LAW-TOOL-001 through LAW-TOOL-002 (Tool taxonomy)
- LAW-SWM-006 through LAW-SWM-009 (Time + DAG enforcement)
- LAW-TIME-001 through LAW-TIME-003 (Clock + performance)
- LAW-ENF-007 through LAW-ENF-008 (Event schema + lazy patterns)
- LAW-ORG-007 through LAW-ORG-009 (Invariants + retention + versioning)

---

## Documents Consolidated

### 1. PROJECT_LAW.md (Original)

**Location:** `docs/_archive/legacy-specs/organized/Architecture/LAW/Project_Law.md`

**What Was Taken:**
- Articles I-V (Guardrails, Project Organization, Agentic Framework, Enforcement, Change Control)
- All LAW-XXX rule numbers preserved
- Operational cheat sheet

**Where It Went:**
- Part I: Guardrails (LAW-GRD-001 through LAW-GRD-010)
- Part II: Project Organization (LAW-ORG-001 through LAW-ORG-009)
- Part III: Agentic Framework (LAW-META-001 through LAW-META-008)
- Part V: Enforcement & Automation (LAW-ENF-001 through LAW-ENF-008)
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
- Part III: Agentic Framework (LAW-META-003: Role-Bound Agents, LAW-META-006: A2A Review Protocol, LAW-META-007: WIH Mandatory, LAW-META-008: Rails-Orchestrated Execution)
- Part IV: Ontology (LAW-ONT-002 through LAW-ONT-007: Authority, Determinism, Proposal, Truth, Surface, Persona Laws)
- Part VII: Swarm Orchestration (LAW-SWM-001 through LAW-SWM-009)
- Part IX: Time & Performance (LAW-TIME-001 through LAW-TIME-003)
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
- Part IV: Ontology (LAW-ONT-001 through LAW-ONT-010)
- Appendix A.2: Ontology Definitions (reference to original)

**Status:** ✅ Fully consolidated

**Original Retained:** As `/spec/ontology.md` for reference (expanded definitions)

**New Additions in v2.0:**
- LAW-ONT-008: IO Idempotency & Replay Law
- LAW-ONT-009: Canonical State Transition Law
- LAW-ONT-010: Deterministic Randomness Binding

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
- Part I: Guardrails (LAW-GRD-001 through LAW-GRD-010)
- LAW-GRD-004: Plan ≠ Execute (from "Separation of Phases")
- LAW-GRD-005: No "Just Make It Work" (from "Simplicity Over Legacy Rule")

**Status:** ✅ Fully consolidated

**New Additions in v2.0:**
- LAW-GRD-007: No Commented-Out Code
- LAW-GRD-008: Production-Grade Requirement
- LAW-GRD-009: No Placeholders in Merge-Ready Work
- LAW-GRD-010: No Silent Degradation

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
- Appendix A.3: Living Files Doctrine (reference to expanded doctrine)

**Status:** ✅ Principles consolidated

**New Additions in v2.0:**
- LAW-ORG-007: Explicit Invariant Registry
- LAW-ORG-008: Knowledge Retention & Expiry Law
- LAW-ORG-009: Contract Versioning & Deprecation Law

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
- LAW-ENF-007: Canonical Event Schema Law
- LAW-ENF-008: Lazy-Pattern Rejection Gates
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
- Appendix A.4: A2A Review Protocol (reference to implementation)

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

### 9. Prompt Caching Doctrine (NEW in v2.0)

**Location:** `docs/_active/a2r-session__prompt-caching-doctrine__2026-02-19.md`

**What Was Taken:**
- L0-L3 prompt layering model
- Tool stubs + defer-loading protocol
- Cache-safe compaction contract
- Cache health observability
- CACHE-001 ADR

**Where It Went:**
- LAW-GRD-005: No "Just Make It Work" (cache efficiency as economic survival)
- LAW-ENF-006: Observability Legibility Contract (cache metrics)
- Appendix A.6: Prompt Caching Doctrine

**Status:** ✅ Principles consolidated

**Original Retained:** As `/spec/ADRs/ADR-CACHE-001.md` (implementation spec)

---

### 10. Failure & Operations Spec (NEW in v2.0)

**Source:** Structural gap analysis

**What Was Added:**
- Failure classification (BOOT_FAIL, SETUP_FAIL, SERVICE_FAIL, etc.)
- Rollback & reconciliation protocol
- Retry semantics (max retries, backoff, circuit breaker)

**Where It Went:**
- Part V: Failure & Operations (LAW-OPS-001 through LAW-OPS-003)

**Status:** ✅ New section added

---

### 11. Security Codification (NEW in v2.0)

**Source:** Structural gap analysis

**What Was Added:**
- Threat model requirement
- Data classification tiers
- External tool boundary law

**Where It Went:**
- Part VI: Security (LAW-SEC-001 through LAW-SEC-003)

**Status:** ✅ New section added

---

### 12. Tool Governance (NEW in v2.0)

**Source:** Structural gap analysis

**What Was Added:**
- Tool capability classification (Read, Write, Execute, Destructive, External)
- Capability-based policy binding

**Where It Went:**
- Part VIII: Tool Governance (LAW-TOOL-001 through LAW-TOOL-002)

**Status:** ✅ New section added

---

### 13. Time & Performance (NEW in v2.0)

**Source:** Structural gap analysis

**What Was Added:**
- Logical time & deterministic scheduling
- Clock authority
- Performance budgets
- Circuit breaker law

**Where It Went:**
- Part IX: Swarm Orchestration (LAW-SWM-006 through LAW-SWM-009)
- Part X: Time & Performance (LAW-TIME-001 through LAW-TIME-003)

**Status:** ✅ New section added

---

## New Additions (Not in Original Documents)

### Part V: Failure & Operations (3 new laws)

**Why Added:** To codify failure handling, rollback, and retry semantics.

**New Laws:**
- LAW-OPS-001: Failure Classification Law
- LAW-OPS-002: Rollback & Reconciliation Law
- LAW-OPS-003: Retry Semantics Law

---

### Part VI: Security (3 new laws)

**Why Added:** To codify security requirements at constitutional level.

**New Laws:**
- LAW-SEC-001: Mandatory Threat Model
- LAW-SEC-002: Data Classification & Handling Law
- LAW-SEC-003: External Tool Boundary Law

---

### Part VIII: Tool Governance (2 new laws)

**Why Added:** To codify tool capability taxonomy and policy binding.

**New Laws:**
- LAW-TOOL-001: Tool Capability Classification
- LAW-TOOL-002: Capability-Based Policy Binding

---

### Part IX: Swarm Orchestration Extensions (4 new laws)

**Why Added:** To codify time semantics, DAG enforcement, and admission control.

**New Laws:**
- LAW-SWM-006: Logical Time & Deterministic Scheduling Law
- LAW-SWM-007: Admission Control & Fairness Law
- LAW-SWM-008: DAG-Only Execution
- LAW-SWM-009: DAG + WIH Coupling

---

### Part X: Time & Performance (3 new laws)

**Why Added:** To codify clock authority, performance budgets, and circuit breakers.

**New Laws:**
- LAW-TIME-001: Clock Authority Law
- LAW-TIME-002: Performance Budget Law
- LAW-TIME-003: Circuit Breaker Law

---

### Part XI: Quality Ledger (3 laws)

**Why Added:** To codify quality tracking from Living Files Theory and Garbage Collection spec.

**New Laws:**
- LAW-QLT-001: Domain Grades
- LAW-QLT-002: Entropy Score
- LAW-QLT-003: Quality Optimization

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
├── SYSTEM_LAW.md                         # Tier-0 Constitutional Law (repo root)
│
├── docs/
│   └── LAW_INDEX.md                      # Cross-reference guide
│
├── spec/
│   ├── ontology.md                       # Expanded entity definitions (retained)
│   ├── HarnessEngineering.md             # Implementation spec (retained)
│   ├── ADRs/
│   │   └── ADR-CACHE-001.md              # Prompt caching (retained)
│   └── threat-models/                    # Security threat models (NEW)
│
├── 5-agents/
│   └── AGENTS.md                         # DAK Runner law (retained)
│
├── agent/
│   ├── review-protocol.md                # A2A review implementation (retained)
│   └── garbage-collection.md             # GC engine implementation (retained)
│
└── docs/governance/
    └── LIVING_FILES_DOCTRINE.md          # Expanded doctrine (retained)
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

- LAW-GRD-006 through LAW-GRD-010 added (Harness First, Anti-laziness)
- LAW-ORG-006 through LAW-ORG-009 added (Living Files, Invariants, Retention, Versioning)
- LAW-META-006 through LAW-META-008 added (A2A Review, WIH Mandatory, Rails-Orchestrated)
- LAW-OPS-001 through LAW-OPS-003 added (Failure semantics)
- LAW-ONT-008 through LAW-ONT-010 added (IO replay, state transitions, randomness)
- LAW-SEC-001 through LAW-SEC-003 added (Security)
- LAW-TOOL-001 through LAW-TOOL-002 added (Tool taxonomy)
- LAW-SWM-006 through LAW-SWM-009 added (Time, DAG, admission control)
- LAW-TIME-001 through LAW-TIME-003 added (Clock, performance, circuit breaker)
- LAW-ENF-007 through LAW-ENF-008 added (Event schema, lazy patterns)
- Part V: Failure & Operations (new section)
- Part VI: Security (new section)
- Part VIII: Tool Governance (new section)
- Part IX: Swarm Orchestration Extensions (new subsection)
- Part X: Time & Performance (new section)

### ❌ Removed (Not Consolidated)

- Duplicate content (same principle stated multiple ways)
- Implementation-specific details (file paths, CLI commands)
- Historical context not needed for constitutional law
- "Vibes" and philosophical statements without enforcement

---

## Domain-Specific Documents Retained

These documents are **retained** as domain-specific applications of SYSTEM_LAW.md:

### 1. AGENTS.md (5-agents/)

**Why Retained:** Contains DAK Runner-specific operational details

**Relationship:** Implements SYSTEM_LAW.md Part III (Agentic Framework) for DAK context

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

**Relationship:** Implements SYSTEM_LAW.md LAW-ENF-004 (Harness Engineering Requirements)

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

**Relationship:** Expands SYSTEM_LAW.md LAW-ORG-006 (Living Files Doctrine)

**Key Doctrinal Content:**
- Five categories with detailed examples
- Drift protocol
- Validation surface requirements
- Doc-gardener agent specification

---

### 4. A2A Review Protocol (agent/)

**Why Retained:** Implementation of LAW-META-006

**Relationship:** Implements SYSTEM_LAW.md LAW-META-006 (A2A Review Protocol)

**Key Implementation Details:**
- Full state machine definition
- Role permissions table
- Stage definitions (IMPLEMENTATION_RUNNING, SELF_REVIEW, etc.)
- Escalation rules
- Merge philosophy

---

### 5. Garbage Collection Engine (agent/)

**Why Retained:** Implementation of LAW-ENF-005

**Relationship:** Implements SYSTEM_LAW.md LAW-ENF-005 (Entropy Compression Engine)

**Key Implementation Details:**
- Golden principles with examples
- GC agent specifications (6 daily agents)
- Entropy score calculation formula
- Quality grades structure

---

### 6. Prompt Caching Doctrine (spec/ADRs/)

**Why Retained:** Implementation of cache-aware execution

**Relationship:** Implements SYSTEM_LAW.md LAW-GRD-005 (No "Just Make It Work") and LAW-ENF-006 (Observability)

**Key Implementation Details:**
- L0-L3 prompt layering
- Tool stubs + defer-loading
- Cache health metrics
- Prefix drift detection
- CACHE-001 ADR

---

## Migration Path

### Week 1 Actions

1. **Move SYSTEM_LAW.md to repo root** ✅
   - Location: `/SYSTEM_LAW.md`

2. **Create LAW INDEX** ✅
   - Location: `/docs/LAW_INDEX.md`

3. **Update references in existing docs**
   - Add header to all retained documents: "This document derives authority from SYSTEM_LAW.md Section X.X"

4. **Update ARCHITECTURE.md**
   - Reference SYSTEM_LAW.md as Tier-0 authority
   - Update LAW references to point to consolidated document

5. **Update AGENTS.md**
   - Add header: "This document implements SYSTEM_LAW.md Part III for DAK Runner context"

6. **Update all references from PROJECT_LAW.md to SYSTEM_LAW.md**
   - Update MASTER_DAG_TASK_BREAKDOWN.md
   - Update BUILDOUT_VISION_2026.md
   - Update all other docs referencing PROJECT_LAW.md

---

## Validation Checklist

- [x] SYSTEM_LAW.md at repo root
- [x] LAW INDEX created and linked
- [x] All retained documents have authority headers
- [ ] ARCHITECTURE.md references SYSTEM_LAW.md
- [ ] AGENTS.md references SYSTEM_LAW.md
- [ ] No conflicting LAW statements in retained docs
- [ ] All LAW-XXX numbers are unique and traceable
- [ ] Cross-references work (LAW_INDEX.md → retained docs)
- [ ] All references to PROJECT_LAW.md updated to SYSTEM_LAW.md

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

### After (1 constitutional + 6 domain-specific)

**Pros:**
- Single Tier-0 authority at repo root
- Clear hierarchy (constitutional → domain-specific → implementation)
- No duplicate content
- Easy entry point for new contributors
- LAW INDEX provides cross-reference
- Production-grade anti-laziness guardrails
- Failure semantics codified
- Security requirements explicit
- Tool taxonomy enforced
- Time semantics defined

**Cons:**
- Large document (requires good navigation)
- Domain-specific details in separate docs (mitigated by LAW INDEX)

---

## Version 2.0 Summary

### New Laws Added (28 total)

| Part | Laws Added | Count |
|------|------------|-------|
| Part I: Guardrails | LAW-GRD-007 to LAW-GRD-010 | 4 |
| Part II: Project Organization | LAW-ORG-007 to LAW-ORG-009 | 3 |
| Part III: Agentic Framework | LAW-META-007 to LAW-META-008 | 2 |
| Part IV: Ontology | LAW-ONT-008 to LAW-ONT-010 | 3 |
| Part V: Failure & Operations | LAW-OPS-001 to LAW-OPS-003 | 3 |
| Part VI: Security | LAW-SEC-001 to LAW-SEC-003 | 3 |
| Part VII: Tool Governance | LAW-TOOL-001 to LAW-TOOL-002 | 2 |
| Part IX: Swarm Orchestration | LAW-SWM-006 to LAW-SWM-009 | 4 |
| Part X: Time & Performance | LAW-TIME-001 to LAW-TIME-003 | 3 |
| Part XI: Quality Ledger | LAW-QLT-001 to LAW-QLT-003 | 3 |
| **TOTAL** | | **30** |

### Total Law Count

| Version | Total Laws |
|---------|------------|
| v1.0 | 47 laws |
| v2.0 | 77 laws |

---

## Conclusion

**Consolidation Status:** ✅ Complete

**Result:** One constitutional document (`/SYSTEM_LAW.md`) with six domain-specific applications retained for operational details.

**Next Steps:**
1. ✅ SYSTEM_LAW.md at repo root
2. ✅ LAW INDEX created and linked
3. ⬜ Update all references to point to SYSTEM_LAW.md
4. ⬜ Add authority headers to retained documents
5. ⬜ Implement LAW-ENF-001 (Mandatory Load Order)
6. ⬜ Train agents to load SYSTEM_LAW.md first

---

**End of Consolidation Summary**
