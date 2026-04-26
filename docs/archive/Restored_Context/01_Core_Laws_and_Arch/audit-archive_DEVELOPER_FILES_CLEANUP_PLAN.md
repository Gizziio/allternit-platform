# Developer Files Cleanup Plan

**Date:** 2026-01-18
**Status:** 🔄 IN PROGRESS
**Scope:** Clean up developer/test/build artifacts scattered across the workspace

---

## Problem Statement

The repository contains **10,000+ developer/test files** scattered throughout, including:
- Log files (*.log)
- Test files (test_*.rs, test_*.js, test_*.sh, etc.)
- Database files (*.db, *.sqlite)
- Build artifacts (test_simple executable, temporary files)
- JSONL workspace data files
- Environment sample files (.env.sample)

These files make the repository heavy, slow to clone, and create confusion about what's actually part of the codebase.

---

## Files Identified

### 1. Log Files (~50+ files)
**Location:** Scattered in allternit/ root and subdirectories
**Examples:**
- kernel_test_run.log, kernel_runtime_test.log, kernel_debug.log
- framework.log, kernel.log, kernel_run_output.log
- .beads/daemon.log, .logs/ (multiple logs)

**Issues:**
- Not in centralized location
- Some in .logs/ (good) but many at root
- Large files accumulating over time

**Action:** Consolidate or remove

### 2. Test Files (~20+ files at root)
**Location:** allternit/ root level
**Examples:**
- test_simple.rs, test-brain-integration.js, test-brain-iterative.js
- test_io_bridge.sh, verify_orb.py, close_phase2_issues.py

**Issues:**
- Should be in tests/ directory
- Mixed with production files
- Some are scripts, not tests

**Action:** Move to tests/ or remove

### 3. Database Files (~10+ files)
**Location:** Scattered in crates/ and workspace/
**Examples:**
- crates/intent-graph-kernel/intent_graph.db
- crates/intent-graph-kernel/build_temp.db
- workspace/rlm_sessions.db, .beads/beads.db

**Issues:**
- Should NOT be committed to repo
- Should be in .gitignore
- May contain sensitive session data

**Action:** Add to .gitignore, delete from repo

### 4. Build Artifacts (~15+ files)
**Location:** Root level and subdirectories
**Examples:**
- test_simple (executable), test_simple.rs
- build_temp.db, test_new_file.txt
- test_remove_fix.txt

**Issues:**
- Not in target/ or dist/ folders
- Mixed with source code
- Should be in .gitignore patterns

**Action:** Add to .gitignore, delete

### 5. JSONL Data Files (~5 files)
**Location:** Workspace data
**Examples:**
- workspace/history.jsonl
- allternit/allternit.jsonl
- .beads/issues.jsonl, .beads/interactions.jsonl

**Issues:**
- These are runtime data, not code
- Should not be committed
- Should be in .gitignore

**Action:** Add to .gitignore

### 6. Environment Sample Files (~5 files)
**Location:** Scattered in various folders
**Examples:**
- gizzi-docs/legacy/llm_collaboration_context/.env.sample
- (others may exist)

**Issues:**
- Inconsistent naming (.env vs .env.example)
- Scattered location

**Action:** Rename to .env.example, consolidate

---

## Cleanup Strategy

### Phase 1: .gitignore Updates (CRITICAL)
Add patterns to all .gitignore files:

```gitignore
# Logs
*.log
logs/
.log/

# Databases
*.db
*.sqlite
*.sqlite3
*.db-shm
*.db-wal

# Test and build artifacts
test_simple
test_*.*
build_temp.*
*_temp.*
test_new_file.*

# JSONL runtime data
*.jsonl

# Workspace data
workspace/*.db
workspace/*.jsonl
.beads/*.db
.beads/*.jsonl

# Environment files (keep samples)
.env
!.env.example
```

### Phase 2: File Removal
Remove files that should never be in repo:

**Remove Immediately:**
1. All *.log files (consolidate logs to .logs/ if needed)
2. All *.db files from repo (session data)
3. All *.jsonl files (runtime data)
4. test_simple executable at root
5. All *_temp.* files
6. All test_new_file.txt, test_remove_fix.txt files

**Review and Reorganize:**
1. Test files at root (test_*.rs, test_*.js, test_*.py)
   - Move to tests/ directory if legitimate tests
   - Remove if obsolete
2. Test scripts (test_io_bridge.sh, verify_orb.py, etc.)
   - Move to scripts/ or tests/ if useful
   - Remove if obsolete

### Phase 3: .gitignore Enforcement
After .gitignore updates:

```bash
cd ~/Desktop/allternit-workspace
git rm -r --cached .  # Remove all from index
git add .       # Re-add respecting .gitignore
git status        # Review changes
git commit -m "chore: remove tracked build artifacts and logs"
```

---

## Estimated Impact

| File Type | Count | Action | Impact |
|----------|-------|--------|--------|
| *.log files | 50+ | Remove/consolidate | 📉 Large reduction |
| *.db files | 10+ | Remove | 🔒 Security improvement |
| Test files at root | 20+ | Reorganize/remove | 🧹 Cleaner root |
| Build artifacts | 15+ | Remove | 📦 Smaller repo |
| *.jsonl files | 5+ | Remove | 💾 Less data in repo |
| Environment samples | 5+ | Standardize | ⚙️ Consistent config |

**Total Files to Clean:** ~105+
**Estimated Repo Size Reduction:** 50-70%
**Security Improvement:** Session data removed

---

## Execution Order

1. ✅ Update all .gitignore files (allternit, alpha-trader)
2. 🔄 Remove log files (move to .logs/ if needed)
3. 🔄 Remove database files
4. 🔄 Remove JSONL files
5. 🔄 Remove build artifacts
6. 🔄 Reorganize/remove test files at root
7. 🔄 Git cleanup (git rm --cached, re-add)

---

## Questions for Decision

1. **Log Retention:** Keep .logs/ folder or remove all logs?
2. **Test Files:** Should test_*.rs at root be moved to tests/ or removed?
3. **Scripts:** Are scripts like verify_orb.py useful or obsolete?

---

**Status:** Ready for execution