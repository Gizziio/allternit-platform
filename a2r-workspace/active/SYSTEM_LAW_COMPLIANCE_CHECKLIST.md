# SYSTEM_LAW Compliance Checklist

**Purpose:** Ensure ALL code produced for A2R respects SYSTEM_LAW without exception.

**Usage:** Run this checklist BEFORE any code generation, AFTER code generation, and BEFORE any commit.

---

## Pre-Generation Checklist

### LAW-GRD-001 (No Silent Assumptions)
- [ ] Have I explicitly stated all assumptions?
- [ ] Are requirements derived from specs, not assumed?
- [ ] Is intent documented?

### LAW-GRD-004 (Plan ≠ Execute)
- [ ] Is there a spec/plan document for this work?
- [ ] Is execution separate from planning?
- [ ] Are there explicit gates between phases?

---

## Post-Generation Checklist

### LAW-GRD-005 (No "Just Make It Work")
- [ ] Are there any comments like "// TODO: fix this later"?
- [ ] Are there any "// In production, this would be..." comments?
- [ ] Are there any temporary hacks without explicit tracking?
- [ ] Is all technical debt explicitly labeled, scoped, tracked, and scheduled?

**RED FLAGS:**
```rust
// ❌ FORBIDDEN
// TODO: implement this properly
// In production, we would use real dependencies
// This is just a stub for now
// Placeholder - will fix later
```

```rust
// ✅ ALLOWED (only if all 4 conditions met)
// TECHNICAL_DEBT: [ID-123] Using in-memory SQLite for IO Service
// Scope: Development/testing only
// Tracked: docs/_active/TECHNICAL_DEBT.md
// Scheduled: Remove before P0.3 completion
```

### LAW-GRD-008 (Production-Grade Requirement)
- [ ] Is the code correctness-oriented (not "demo works")?
- [ ] Is there proper error handling?
- [ ] Are there typed boundaries?
- [ ] Is behavior deterministic where required?
- [ ] Are there observability hooks (logs/metrics/traces)?
- [ ] Are tests proportional to risk tier?

**RED FLAGS:**
```rust
// ❌ FORBIDDEN
fn quick_fix() { /* simple implementation */ }
panic!("should not happen"); // No proper error handling
let data = get_data().unwrap(); // No error handling
```

```rust
// ✅ REQUIRED
fn proper_implementation() -> Result<Data, AppError> {
    let data = get_data()
        .map_err(|e| AppError::GetDataFailed(e))?;
    Ok(data)
}
```

### LAW-GRD-009 (No Placeholders in Merge-Ready Work)
- [ ] Are there any fake returns or hardcoded constants standing in for real logic?
- [ ] Are there any empty method bodies?
- [ ] Are there any "temporary" bypass conditions?
- [ ] Are there any UI placeholders that misrepresent state?

**RED FLAGS:**
```rust
// ❌ FORBIDDEN
fn get_data() -> Data {
    Data::default() // Fake data
}

fn process() {
    // TODO: implement
}

if feature_flag { /* real logic */ } else { /* placeholder */ }
```

### LAW-GRD-002 (No Silent State Mutation)
- [ ] Does all state mutation produce explicit artifacts?
- [ ] Are receipts emitted for all side effects?
- [ ] Is there journal entries for all state changes?

### LAW-ONT-002 (Only IO Executes Side Effects)
- [ ] Does this code execute side effects?
- [ ] If yes, does it flow through IO Service?
- [ ] Is policy enforcement BEFORE execution?

### LAW-ONT-003 (Determinism Law)
- [ ] Is Kernel code deterministic?
- [ ] Given same inputs, does it produce same outputs?
- [ ] Are there any random/unseeded operations?

---

## Compilation Checklist

### Build Verification
- [ ] Does `cargo check` pass with 0 errors?
- [ ] Are warnings only in dependencies (not our code)?
- [ ] Are there NO `#[allow(dead_code)]` or `#[allow(unused)]` suppressing real issues?

### Import Verification
- [ ] Are all imports used?
- [ ] Are there no unused variables (except intentionally `_prefixed`)?
- [ ] Are all types properly annotated?

---

## Ontology Verification

### Entity Boundaries
- [ ] Does Kernel code avoid IO operations?
- [ ] Does IO Service handle all side effects?
- [ ] Are Models only proposing (not executing)?
- [ ] Is Shell only rendering (not deciding)?

### LAW-ENT Compliance
- [ ] Is IO Service on port 3510?
- [ ] Is Kernel Service on port 3004?
- [ ] Do service names match SYSTEM_LAW.md definitions?

---

## Documentation Verification

### Spec References
- [ ] Does code reference its governing spec?
- [ ] Are there LAW comments for constitutional compliance?
- [ ] Is there a README for new services?

### Example:
```rust
//! A2R IO Service - The ONLY Permitted Side-Effect Path
//!
//! Implements SYSTEM_LAW.md:
//! - LAW-ONT-002: Only IO can execute side effects
//! - LAW-ONT-003: Deterministic execution with policy enforcement
//! - LAW-ONT-008: IO Idempotency & Replay
```

---

## Automated Checks (CI Gates)

### To Be Implemented
```yaml
# .github/workflows/system-law-compliance.yml
name: SYSTEM_LAW Compliance

on: [push, pull_request]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for forbidden patterns
        run: |
          # LAW-GRD-005: No TODOs without tracking
          grep -r "TODO" src/ | grep -v "TECHNICAL_DEBT" && exit 1 || true
          
          # LAW-GRD-009: No placeholders
          grep -r "placeholder" src/ && exit 1 || true
          grep -r "stub" src/ | grep -v "test" && exit 1 || true
          
          # LAW-GRD-008: Production-grade
          grep -r "quick_fix\|hack\|workaround" src/ && exit 1 || true
      
      - name: Verify LAW comments
        run: |
          # Check for LAW compliance comments in new files
          new_files=$(git diff --name-only HEAD~1 | grep '\.rs$')
          for file in $new_files; do
            if ! grep -q "SYSTEM_LAW\|LAW-" "$file"; then
              echo "Warning: $file missing LAW compliance comment"
            fi
          done
      
      - name: Build verification
        run: cargo check --workspace --all-targets
```

---

## Violation Response Protocol

### If Violation Found
1. **STOP** all work immediately
2. **DOCUMENT** the violation in `docs/_active/LAW_VIOLATIONS.md`
3. **FIX** before proceeding
4. **ANALYZE** root cause
5. **UPDATE** this checklist if needed

### Violation Template
```markdown
## LAW Violation Report

**Date:** YYYY-MM-DD
**File:** path/to/file.rs
**LAW Violated:** LAW-GRD-XXX
**Severity:** Critical/High/Medium/Low

**Description:**
[What happened]

**Root Cause:**
[Why it happened]

**Fix:**
[How it was fixed]

**Prevention:**
[How to prevent recurrence]
```

---

## Sign-Off

**Before any commit, verify:**

- [ ] Pre-Generation Checklist complete
- [ ] Post-Generation Checklist complete
- [ ] Compilation Checklist complete
- [ ] Ontology Verification complete
- [ ] Documentation Verification complete
- [ ] No LAW violations detected

**Signed:** ________________  
**Date:** ________________

---

**REMEMBER:** Speed without correctness is technical debt. Correctness without LAW compliance is architectural drift.

**LAW FIRST. ALWAYS.**
