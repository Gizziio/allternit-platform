# A2RCHITECH LAW INDEX
## Cross-Reference Guide to Legal Documents

**Version:** 2.0.0  
**Date:** 2026-02-20  
**Authority:** Derives from `/SYSTEM_LAW.md` (Tier-0)

**Name Change Notice:** `PROJECT_LAW.md` was renamed to `SYSTEM_LAW.md` on 2026-02-20 to reflect system-wide constitutional authority.

---

## Tier-0: Constitutional Authority

| Document | Location | Purpose | Status |
|----------|----------|---------|--------|
| **SYSTEM_LAW.md** | `/SYSTEM_LAW.md` (repo root) | Constitutional law for entire project | ✅ **ACTIVE** |

---

## Tier-1: Domain-Specific Applications

These documents apply SYSTEM_LAW.md to specific domains. They **cannot conflict** with SYSTEM_LAW.md but can add domain-specific rules.

### 1. DAK Runner Law

| Document | Location | Scope | Relationship to SYSTEM_LAW.md |
|----------|----------|-------|-------------------------------|
| **AGENTS.md** | `/5-agents/AGENTS.md` | DAK Runner agents | Implements: LAW-META-003 (roles), LAW-ENF-002 (auditability), LAW-SWM-005 (receipts) |
| **DAK Runner Spec** | `/1-kernel/agent-systems/a2r-dak-runner/` | DAK implementation | Implements: LAW-ONT-002 (authority), LAW-SWM-001 (DAG execution) |

**Key Additions:**
- Authority separation (Rails Control vs DAK Execution)
- Tool execution rule (PreToolUse gate, receipts)
- Write discipline (`.a2r/runner/` boundaries)
- Mutual blocking (Builder ≠ Validator)
- Ralph loop rules (bounded fix cycles)

---

### 2. Ontology Definitions

| Document | Location | Scope | Relationship to SYSTEM_LAW.md |
|----------|----------|-------|-------------------------------|
| **ONTOLOGY_LAW.md** | `/spec/ontology.md` | Entity definitions | Implements: LAW-ONT-001 (canonical entities) |

**Key Additions:**
- Detailed entity definitions (IO, Kernel, Models, Shell, Gizzi)
- Authority flow diagram
- Naming restrictions
- Contract namespaces

**Note:** This document was consolidated into SYSTEM_LAW.md Part IV. Original retained for reference.

---

### 3. Harness Engineering

| Document | Location | Scope | Relationship to PROJECT_LAW.md |
|----------|----------|-------|-------------------------------|
| **HarnessEngineering.md** | `/spec/HarnessEngineering.md` | Harness implementation | Implements: LAW-ENF-004 (harness requirements) |
| **Harness Blueprint** | `/harness/README.md` | Harness structure | Implements: LAW-ENF-004, LAW-ENF-005 |

**Key Additions:**
- Context engineering layer
- Architectural constraints (linters, structural tests)
- Garbage collection agents
- Tool wrapper system
- Evidence-based merge

---

### 4. Living Files Doctrine

| Document | Location | Scope | Relationship to PROJECT_LAW.md |
|----------|----------|-------|-------------------------------|
| **Living Files Doctrine** | `/docs/governance/LIVING_FILES_DOCTRINE.md` | Living Files enforcement | Implements: LAW-ORG-006 (Living Files) |
| **Harness Engineering** | `/docs/design/A2R_HARNESS_BLUEPRINT.md` | Harness implementation | Implements: LAW-ENF-004 |

**Key Additions:**
- Five categories of Living Files
- Drift protocol
- Validation surface requirements
- Doc-gardener agents

---

### 5. A2A Review Protocol

| Document | Location | Scope | Relationship to PROJECT_LAW.md |
|----------|----------|-------|-------------------------------|
| **Review Protocol** | `/agent/review-protocol.md` | Agent-to-Agent review | Implements: LAW-META-006 (A2A Review) |

**Key Additions:**
- Review state machine
- Role definitions (Implementer, Reviewer, Tester, Security, Policy Gate)
- Escalation rules
- Merge philosophy

---

### 6. Garbage Collection Engine

| Document | Location | Scope | Relationship to PROJECT_LAW.md |
|----------|----------|-------|-------------------------------|
| **Garbage Collection** | `/agent/garbage-collection.md` | Entropy compression | Implements: LAW-ENF-005 (Entropy Engine) |

**Key Additions:**
- Golden principles
- GC agent specifications (daily runs)
- Entropy score calculation
- Quality grades

---

### 7. Swarm Orchestration

| Document | Location | Scope | Relationship to PROJECT_LAW.md |
|----------|----------|-------|-------------------------------|
| **Swarm Runtime Spec** | `/docs/_active/A2R_Swarm_Runtime_Kernel_Spec_v1.md` | Swarm execution | Implements: LAW-SWM-001 to LAW-SWM-005 |

**Key Additions:**
- Deterministic DAG execution
- Parallelism without shared mutable state
- Conflict arbitration rules
- Budget-aware scheduling
- Evidence-first outputs

---

### 8. Quality Ledger

| Document | Location | Scope | Relationship to PROJECT_LAW.md |
|----------|----------|-------|-------------------------------|
| **Quality Scores** | `/quality/domain-grades.md` (to be created) | Domain grades | Implements: LAW-QLT-001 |
| **Entropy Score** | `/quality/entropy-score.md` (to be created) | Entropy tracking | Implements: LAW-QLT-002 |

**Key Additions:**
- Architecture adherence scoring
- Test coverage tracking
- Observability completeness
- Drift frequency measurement

---

## Tier-2: Implementation Specs

These documents provide implementation details for LAW requirements.

| Spec | Location | Implements | Status |
|------|----------|------------|--------|
| **WIH Schema** | `/harness/schemas/wih.schema.json` | LAW-ORG-001, LAW-ENF-001 | 🟡 In Progress |
| **Evidence Schema** | `/harness/schemas/evidence.schema.json` | LAW-ENF-002, LAW-SWM-005 | 🟡 In Progress |
| **Risk Tiers** | `/harness/policies/risk_tiers.yaml` | LAW-GRD-005, LAW-SWM-004 | 🟡 In Progress |
| **Role Matrix** | `/harness/policies/role_matrix.yaml` | LAW-META-003 | 🟡 In Progress |
| **Boundaries** | `/harness/policies/boundaries.yaml` | LAW-ORG-004, LAW-ENF-004 | 🟡 In Progress |
| **Receipt Schema** | `/spec/Contracts/receipt.schema.json` | LAW-META-006, LAW-SWM-005 | ✅ Complete |
| **Canvas Protocol** | `/spec/presentation/CanvasProtocol.md` | LAW-ONT-006 (Surface Law) | ✅ Complete |
| **Capsule Protocol** | `/spec/presentation/CapsuleProtocol.md` | LAW-SWM-002 (Shared State) | ✅ Complete |

---

## Tier-3: Reference Documents

These documents provide context and background but are not enforceable law.

| Document | Location | Purpose |
|----------|----------|---------|
| **Guardrails.md** | `/docs/_archive/legacy-specs/organized/Architecture/LAW/Guardrails.md` | Historical guardrails (superseded by PROJECT_LAW.md Part I) |
| **Architecture_Documentation.md** | `/docs/_archive/legacy-specs/organized/Architecture/LAW/Architecture_Documentation.md` | Historical architecture docs |
| **OperatingSystem.md** | `/docs/_archive/legacy-specs/organized/Architecture/LAW/OperatingSystem.md` | Historical OS concepts |
| **BUILDER_ENTRY_INDEX.md** | `/docs/_archive/legacy-specs/organized/Architecture/LAW/BUILDER_ENTRY_INDEX.md` | Historical builder docs |

---

## Consolidation Status

### ✅ Consolidated into PROJECT_LAW.md

The following documents have been **fully consolidated** into PROJECT_LAW.md:

| Original Document | Status | PROJECT_LAW.md Section |
|-------------------|--------|----------------------|
| PROJECT_LAW.md (original) | ✅ Consolidated | Parts I, II, V, VI |
| AGENTS.md | ✅ Principles consolidated | Parts III, VII |
| ONTOLOGY_LAW.md | ✅ Consolidated | Part IV |
| Guardrails.md | ✅ Consolidated | Part I |
| Living Files Theory | ✅ Consolidated | LAW-ORG-006 |
| Harness Engineering | ✅ Principles consolidated | LAW-ENF-004 |
| A2A Review Protocol | ✅ Consolidated | LAW-META-006 |
| Garbage Collection Spec | ✅ Consolidated | LAW-ENF-005 |

### ⚠️ Retained as Domain-Specific Applications

The following documents are **retained** as domain-specific applications:

| Document | Reason for Retention |
|----------|---------------------|
| AGENTS.md (5-agents/) | DAK Runner-specific operational details |
| HarnessEngineering.md | Implementation spec for LAW-ENF-004 |
| Living Files Doctrine | Doctrinal expansion of LAW-ORG-006 |
| A2A Review Protocol | Implementation of LAW-META-006 |
| Garbage Collection Engine | Implementation of LAW-ENF-005 |
| Swarm Runtime Spec | Implementation of LAW-SWM-001 to LAW-SWM-005 |

---

## Enforcement Map

| LAW Section | Enforcement Mechanism | Location |
|-------------|----------------------|----------|
| LAW-GRD-001 (No Silent Assumptions) | WIH header validation | `/harness/wih/validator.rs` |
| LAW-GRD-002 (No Silent Mutation) | Receipt emission | `/harness/evidence/emitter.rs` |
| LAW-ORG-001 (PRD-First) | Spec reference validation | `/harness/ci/scripts/a2r-validate-contracts` |
| LAW-META-003 (Role-Bound) | Role isolation enforcement | `/harness/policies/role_matrix.yaml` |
| LAW-META-006 (A2A Review) | Review state machine | `/harness/state/lifecycle.rs` |
| LAW-ENF-004 (Harness) | CI gates | `.github/workflows/a2r_harness.yml` |
| LAW-ENF-005 (GC) | Daily GC agents | `/harness/gc_agents/` |
| LAW-SWM-001 (DAG) | DAG validation | `/services/orchestration/swarm-scheduler/` |

---

## Quick Reference

### For New Contributors

**Read First:**
1. `/PROJECT_LAW.md` (this document) - Constitutional law
2. `/SOT.md` - Source of Truth
3. `/5-agents/AGENTS.md` - If working with DAK Runner

**Then:**
4. Domain-specific specs (see Tier-1 above)
5. Implementation specs (see Tier-2 above)

### For Agent Developers

**Required Reading:**
- PROJECT_LAW.md Part III (Agentic Framework)
- PROJECT_LAW.md Part IV (Ontology)
- `/5-agents/AGENTS.md` (DAK Runner law)

### For Architecture Changes

**Required Process:**
1. Read PROJECT_LAW.md Part VI (Change Control)
2. Create ADR (Architecture Decision Record)
3. Update relevant specs
4. Add contract tests

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-20 | Initial LAW INDEX created with PROJECT_LAW.md consolidation |

---

**Authority:** This index derives authority from `/PROJECT_LAW.md` Part X, Final Clause.

**Maintenance:** Updated when new domain-specific documents are created or existing documents are consolidated.

---

**End of LAW INDEX**
