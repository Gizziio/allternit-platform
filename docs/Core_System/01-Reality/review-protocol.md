# Allternit Review Protocol Specification

**Version:** 1.0.0  
**Status:** SYSTEM-WIDE (extracted from DAK Runner)  
**Authority:** Implements SYSTEM_LAW.md LAW-META-006 (A2A Deterministic Review Protocol)

---

## 1. Purpose

This specification defines the system-wide review protocol for all agent-to-agent (A2A) code reviews in Allternit.

**Goal:** Ensure all code changes are reviewed by an independent agent before merge.

---

## 2. Review State Machine

```
TASK_CREATED
    ↓
IMPLEMENTATION_RUNNING
    ↓
SELF_REVIEW
    ↓
STRUCTURAL_VALIDATION
    ↓
TEST_EXECUTION
    ↓
SECURITY_SCAN
    ↓
POLICY_EVALUATION
    ↓
MERGE_READY
    ↓
MERGED
```

**Transitions:**
- Forward transitions are automatic on success
- Backward transitions require explicit fix iteration
- Any stage can transition to BLOCKED on failure

---

## 3. Review Roles

### 3.1 Implementer
**Responsibilities:**
- Implement feature per WIH spec
- Produce code, tests, docs, build reports
- Run self-review before submission

**Constraints:**
- Cannot review own work
- Cannot merge without validator PASS

### 3.2 Self-Reviewer
**Responsibilities:**
- Review own code before submission
- Check for obvious issues
- Add comments for reviewer

**Constraints:**
- Does not count as independent review
- Cannot approve for merge

### 3.3 Structural Reviewer
**Responsibilities:**
- Check architecture compliance
- Verify dependency direction
- Validate boundary enforcement

**Constraints:**
- Read-only access
- Cannot modify code

### 3.4 Tester
**Responsibilities:**
- Run acceptance tests
- Verify test coverage
- Check test determinism

**Constraints:**
- Read-only access
- Cannot modify tests

### 3.5 Security Reviewer
**Responsibilities:**
- Scan for vulnerabilities
- Check input validation
- Verify auth/authz

**Constraints:**
- Read-only access
- Cannot bypass security checks

### 3.6 Policy Gate
**Responsibilities:**
- Verify SYSTEM_LAW compliance
- Check receipt emission
- Validate review completeness

**Constraints:**
- Cannot approve incomplete reviews
- Must enforce all gates

---

## 4. Review Receipts

### 4.1 Self-Review Receipt
```json
{
  "receipt_id": "rcpt_self_review_001",
  "type": "self_review",
  "run_id": "run_abc",
  "wih_id": "wih_xyz",
  "node_id": "n_001",
  "reviewer_id": "agent_implementer",
  "timestamp": "2026-02-20T12:00:00Z",
  "payload": {
    "files_changed": ["src/main.rs", "tests/main_test.rs"],
    "lines_added": 150,
    "lines_removed": 20,
    "self_review_passed": true,
    "comments": ["Added error handling", "Updated tests"]
  }
}
```

### 4.2 Structural Validation Receipt
```json
{
  "receipt_id": "rcpt_structural_001",
  "type": "structural_validation",
  "run_id": "run_abc",
  "wih_id": "wih_xyz",
  "node_id": "n_001",
  "reviewer_id": "agent_structural_reviewer",
  "timestamp": "2026-02-20T12:05:00Z",
  "payload": {
    "architecture_compliant": true,
    "dependency_direction_valid": true,
    "boundary_enforcement_valid": true,
    "violations": []
  }
}
```

### 4.3 Test Execution Receipt
```json
{
  "receipt_id": "rcpt_test_001",
  "type": "test_execution",
  "run_id": "run_abc",
  "wih_id": "wih_xyz",
  "node_id": "n_001",
  "reviewer_id": "agent_tester",
  "timestamp": "2026-02-20T12:10:00Z",
  "payload": {
    "tests_run": 25,
    "tests_passed": 25,
    "tests_failed": 0,
    "coverage_percent": 85.5,
    "deterministic": true
  }
}
```

### 4.4 Security Scan Receipt
```json
{
  "receipt_id": "rcpt_security_001",
  "type": "security_scan",
  "run_id": "run_abc",
  "wih_id": "wih_xyz",
  "node_id": "n_001",
  "reviewer_id": "agent_security",
  "timestamp": "2026-02-20T12:15:00Z",
  "payload": {
    "vulnerabilities_found": 0,
    "input_validation_valid": true,
    "authz_checks_valid": true,
    "security_tier": "T2"
  }
}
```

### 4.5 Policy Evaluation Receipt
```json
{
  "receipt_id": "rcpt_policy_001",
  "type": "policy_evaluation",
  "run_id": "run_abc",
  "wih_id": "wih_xyz",
  "node_id": "n_001",
  "reviewer_id": "agent_policy_gate",
  "timestamp": "2026-02-20T12:20:00Z",
  "payload": {
    "system_law_compliant": true,
    "receipts_complete": true,
    "review_complete": true,
    "gates_passed": ["self_review", "structural", "test", "security"],
    "ready_for_merge": true
  }
}
```

### 4.6 Validator Receipt (Final)
```json
{
  "receipt_id": "rcpt_validator_001",
  "type": "validator",
  "run_id": "run_abc",
  "wih_id": "wih_xyz",
  "node_id": "n_001",
  "reviewer_id": "agent_validator",
  "timestamp": "2026-02-20T12:25:00Z",
  "payload": {
    "verdict": "PASS",
    "reasons": ["All tests pass", "Architecture compliant", "Security valid"],
    "required_fixes": [],
    "affected_files": ["src/main.rs", "tests/main_test.rs"]
  }
}
```

---

## 5. Ralph Loop (Bounded Fix Cycles)

### 5.1 Configuration
```typescript
interface RalphLoopConfig {
  maxFixCycles: number;  // Default: 3
  enableParallelValidation: boolean;  // Default: false
}
```

### 5.2 Execution Flow
```
Builder produces
       ↓
Validator checks
       ↓
   ┌───┴───┐
  PASS    FAIL
   ↓        ↓
   ↓   Fix cycle count < max?
   ↓        ↓
   ↓   ┌────┴────┐
   ↓  Yes       No
   ↓   ↓         ↓
   ↓   ↓         ↓
 DONE  Retry   Escalate
```

### 5.3 Escalation Conditions
- Max fix cycles exceeded (default: 3)
- Ambiguous failure (cannot determine fix)
- Policy violation (requires human review)
- Security vulnerability (requires human review)

---

## 6. CI Gates

### 6.1 Pre-Merge Checks
```yaml
# .github/workflows/review-compliance.yml
name: Review Compliance

on: [pull_request]

jobs:
  review-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check review receipts
        run: |
          # Verify all required receipts present
          receipts=$(find .allternit/receipts -name "*.json")
          
          # Check for self-review
          if ! grep -q '"type": "self_review"' $receipts; then
            echo "Missing self-review receipt"
            exit 1
          fi
          
          # Check for structural validation
          if ! grep -q '"type": "structural_validation"' $receipts; then
            echo "Missing structural validation receipt"
            exit 1
          fi
          
          # Check for test execution
          if ! grep -q '"type": "test_execution"' $receipts; then
            echo "Missing test execution receipt"
            exit 1
          fi
          
          # Check for security scan
          if ! grep -q '"type": "security_scan"' $receipts; then
            echo "Missing security scan receipt"
            exit 1
          fi
          
          # Check for policy evaluation
          if ! grep -q '"type": "policy_evaluation"' $receipts; then
            echo "Missing policy evaluation receipt"
            exit 1
          fi
          
          # Check for validator PASS
          if ! grep -q '"verdict": "PASS"' $receipts; then
            echo "Validator did not PASS"
            exit 1
          fi
          
          echo "All review receipts present and valid"
```

### 6.2 Merge Gates
- [ ] Self-review receipt present
- [ ] Structural validation PASS
- [ ] Test execution PASS (all tests)
- [ ] Security scan PASS (no vulnerabilities)
- [ ] Policy evaluation PASS (SYSTEM_LAW compliant)
- [ ] Validator PASS (verdict: PASS)

---

## 7. Integration Points

### 7.1 With Policy Engine
- Policy Gate uses `PolicyEngine::evaluate()` for compliance checks
- Safety tier enforcement (T0-T4)
- Role isolation verification

### 7.2 With History Ledger
- All review receipts appended to ledger
- Receipts are immutable and queryable
- Replay support for audit

### 7.3 With Messaging System
- Review events published to event bus
- Notifications for review assignments
- Escalation alerts

---

## 8. Acceptance Tests

### AT-REVIEW-001: Review State Machine
```typescript
test('Review progresses through all states', async () => {
  const review = await createReview(wih_id, node_id);
  
  expect(review.state).toBe('TASK_CREATED');
  
  await review.transitionTo('IMPLEMENTATION_RUNNING');
  expect(review.state).toBe('IMPLEMENTATION_RUNNING');
  
  await review.transitionTo('SELF_REVIEW');
  expect(review.state).toBe('SELF_REVIEW');
  
  // ... continue through all states
  
  await review.transitionTo('MERGED');
  expect(review.state).toBe('MERGED');
});
```

### AT-REVIEW-002: Validator PASS Required
```typescript
test('Cannot merge without validator PASS', async () => {
  const review = await createReview(wih_id, node_id);
  
  // Complete all reviews except validator
  await review.completeSelfReview();
  await review.completeStructuralValidation();
  await review.completeTestExecution();
  await review.completeSecurityScan();
  await review.completePolicyEvaluation();
  
  // Try to merge without validator
  await expect(review.merge()).rejects.toThrow('Validator PASS required');
  
  // Complete validator with FAIL
  await review.completeValidator({ verdict: 'FAIL' });
  await expect(review.merge()).rejects.toThrow('Validator PASS required');
  
  // Complete validator with PASS
  await review.completeValidator({ verdict: 'PASS' });
  await expect(review.merge()).resolves.toBeDefined();
});
```

### AT-REVIEW-003: Max Fix Cycles
```typescript
test('Escalates after max fix cycles', async () => {
  const review = await createReview(wih_id, node_id, { maxFixCycles: 3 });
  
  // Fail validation 3 times
  for (let i = 0; i < 3; i++) {
    await review.runFixCycle();
    await review.validate({ verdict: 'FAIL' });
  }
  
  // 4th failure should escalate
  await review.runFixCycle();
  const result = await review.validate({ verdict: 'FAIL' });
  
  expect(result.status).toBe('BLOCKED');
  expect(result.escalationReason).toContain('Max fix cycles exceeded');
});
```

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-20 | Initial extraction from DAK Runner |

---

## 10. References

- **SYSTEM_LAW.md** - LAW-META-006 (A2A Deterministic Review Protocol)
- **DAK Runner** - `1-kernel/agent-systems/allternit-dak-runner/src/loop/ralph.ts`
- **Policy Engine** - `2-governance/identity-access-control/policy-engine/src/lib.rs`

---

**End of Specification**
