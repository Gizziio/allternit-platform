# Allternit × OpenClaw Integration: Execution Queue

**Date:** 2026-01-31  
**Status:** Ready for Execution  
**Constraint Check:**
- ✅ Backup handled externally
- ✅ Phase 7 Rebranding queued (post-integration)
- ✅ UI sources identified (Allternit + OpenClaw + Claude + OpenWork)
- ✅ No placeholders policy acknowledged
- ✅ WIH DAG governs execution

---

## Current Execution Window: Phase 0 → Phase 1

**Execute these in order. Do not proceed to next until acceptance criteria pass.**

---

### ▶️ NOW EXECUTING: P0-T0000

```json
{
  "wih_id": "P0-T0000",
  "task_type": "infrastructure",
  "domain": "git",
  "phase": "0",
  "title": "Fork OpenClaw to controlled repository",
  "description": "Create fork of openclaw/openclaw to Allternit organization",
  "blockedBy": [],
  "produces": ["fork_url", "origin_remote"],
  "estimated_hours": 1,
  "acceptance_criteria": [
    "Fork exists at github.com/{org}/openclaw",
    "Write access confirmed",
    "Default branch is 'allternit-main'"
  ],
  "compliance_checks": ["git_governance"],
  "non_negotiables": ["no_placeholder_code", "no_todo_comments"]
}
```

**Commands:**
```bash
# On GitHub: Fork openclaw/openclaw to your org
# Local setup
git clone https://github.com/{org}/openclaw.git allternit-openclaw
cd allternit-openclaw
git remote rename origin fork-origin
git remote add origin https://github.com/{org}/allternit-openclaw.git
git remote add upstream https://github.com/openclaw/openclaw.git
```

**Next After Completion:** P0-T0001

---

### ⏳ QUEUED: P0-T0001

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
    "'origin' points to Allternit fork",
    "'upstream' points to openclaw/openclaw",
    "Both remotes accessible via SSH/HTTPS"
  ],
  "compliance_checks": ["remote_verification"]
}
```

---

### ⏳ QUEUED: P0-T0002

```json
{
  "wih_id": "P0-T0002",
  "task_type": "infrastructure",
  "domain": "git",
  "phase": "0",
  "title": "Establish branch structure",
  "description": "Create upstream-main mirror and allternit-main product branch",
  "blockedBy": ["P0-T0001"],
  "produces": ["branches", "branch_protection_rules"],
  "estimated_hours": 1,
  "acceptance_criteria": [
    "'upstream-main' branch exists and tracks upstream/main",
    "'allternit-main' branch exists as product branch",
    "Branch protection on upstream-main (no direct commits)"
  ],
  "compliance_checks": ["branch_policy"]
}
```

---

### ⏳ QUEUED: P0-T0003

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

### ⏳ QUEUED: P0-T0004

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

### ⏳ QUEUED: P0-T0005

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
    "Build workflow passes on allternit-main",
    "Test workflow passes",
    "Sync validation workflow created"
  ],
  "compliance_checks": ["ci_gates"]
}
```

---

## Phase 1 Execution Queue (Post-Phase 0)

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
    "Tool execution wrapper identified with file path",
    "Skill registry dispatcher located",
    "File IO utilities found",
    "Session spawn layer identified"
  ],
  "compliance_checks": ["seam_viability"]
}
```

### P1-T0105: Create VENDOR_MAP.md
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
    "All entrypoints documented with line numbers",
    "All seams documented with file paths",
    "A newcomer can locate seams in <10 minutes"
  ],
  "compliance_checks": ["doc_review"]
}
```

---

## Critical Execution Rules

**From user constraints - non-negotiable:**

1. **No Placeholder Code**
   - Every function must be fully implemented
   - No `// TODO: implement` comments
   - No stub functions
   - No mock data in production paths

2. **No TODO Drift**
   - Issues must be tracked in WIH/Beads
   - Code comments explain "why", not "what's missing"
   - Incomplete work blocks merge

3. **Context Retention**
   - Current task context preserved
   - Next task pre-loaded
   - Dependencies tracked in WIH blockedBy

4. **WIH DAG is Law**
   - No task starts until blockedBy clear
   - Acceptance criteria gate progression
   - Compliance checks mandatory

---

## Phase 7 Preview (Post-Integration Rebranding)

**DO NOT EXECUTE NOW - For Reference Only**

- P7-T0700: Audit OpenClaw references
- P7-T0701: Rename namespaces
- P7-T0702: UI string cleanup
- P7-T0704: Config key migration
- P7-T0706: Final verification

**Trigger:** After P6-T0606 (smoke test) passes AND shell UI operational.

---

**Execution Queue Status: READY**

Begin with P0-T0000.
