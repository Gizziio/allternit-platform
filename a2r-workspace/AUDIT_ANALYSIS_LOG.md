# Audit Directory Analysis Log

**Directory:** archive/audit_/
**Total Files:** 279
**Started:** 2026-02-24
**Analyst:** Agent

---

## Structure

- a2r-audit-output/: 248 files
- a2r-sessions-output/: 11 files
- a2rchitech_memory_v2_full/: 14 files
- archive/: 6 files

---


## a2r-audit-output/ (248 files)

### Key Markdown Documents:

1. **A2R_PATCH_PLAN.md** - Law Layer Implementation Plan
   - SOT.md, CODEBASE.md creation
   - spec/Contracts/ canonical directory
   - Acceptance tests spec

2. **A2R_REPO_COMPLIANCE_AUDIT.md** - Compliance Audit Report
   - Required law gate files NOT FOUND
   - Missing: /SOT.md, /CODEBASE.md, /spec/Contracts/*

3. **DELTA_0004.md** - Delta Proposal
   - Contract Root Canon (spec/Contracts/)
   - Security Boot Gates
   - Receipt Contract schema

4. **A2R_WIH_GRAPH_UPDATES.md** - Graph Update Proposal
   - Merge law-layer tasks into DAGs
   - Security + receipts nodes

5. **Memory_Structure_Quick_Explainer.md** - Memory Architecture
   - RAM (checkpointing), Disk (truth ledger)
   - Views (summaries), Web (precision graph)

6. **unified-ui-agent-brief.md** - UI Project Brief
   - Disco GenTabs-like system
   - A2UI integration

### Subdirectories:

- **patches/** (10+ files): Git patch files for law layer changes
  - 0001-T0000: Import law anchors
  - 0001-T0016: Remove auth bypass
  - 0001-T0017: Disable python exec
  - 0001-T0018: Enforce receipts
  - etc.

- **spec/**: Contracts and Deltas
  - Contracts/: JSON schemas (CapsuleBridgeEvent, CapsuleManifest, MCPAppDescriptor)
  - Deltas/: Delta specifications

- **graph_updates/** (74 files): WIH graph updates
  - bootstrap/, gateway/, program/
  - .a2r/wih/, .a2r/graphs/ subdirs

- **inputs/**: capsule_mcp_delta_pack, repo_spec_tree_v4

## a2r-sessions-output/ (11 files)

### Content:
1. **atlas_index.json** (28MB) - Auto-generated codebase index
2. **session_data.json** (3.2MB) - Auto-generated session data
3. **A2RCHITECH_BUILDOUT_MASTER_AGENT_REPORT.md** (1.2M) - Master report
4. **session_extracts.md** (1.0M) - Session extracts
5. **A2RCHITECH_STRUCTURED_PLAN.json** (705K) - Structured plan
6. **A2RCHITECH_ROADMAP_FROM_SESSIONS.md** (177K) - Roadmap
7. **gap_matrix.md** (189K) - Gap analysis
8. **A2RCHITECH_AGENT_COMPARE_TEMPLATE.md** (8.7K)
9. **A2RCHITECH_CONFLICTS_AND_OPEN_QUESTIONS.md** (3.7K)
10. **atlas_capability_matrix.json** (3.0K)
11. **capability_model.md** (4.4K)

**Note:** Two large JSON files (atlas_index.json, session_data.json) are auto-generated and take up 31MB.

## a2rchitech_memory_v2_full/ (14 files)

Content:
- README.md
- ROLL_OUT_PLAN.md
- crates/, migrations/, services/ subdirectories
- Contains memory architecture migration plans

## archive/ (6 files)

Historical audit archive files.

