# Garbage Collection Agents Specification

**Version:** 1.0.0  
**Status:** Draft  
**Related:** LAW-QLT-002, LAW-ENF-005 (Entropy Compression)

---

## 1. Overview

This specification defines automated garbage collection agents that run daily to compress entropy and maintain codebase quality.

---

## 2. Golden Principles

GC agents enforce these principles:

| Principle | Rule | Detection |
|-----------|------|-----------|
| No unvalidated external data | All inputs validated | Missing validation |
| Boundary parsing required | Clear module boundaries | Cross-boundary imports |
| Shared utilities over duplication | DRY enforcement | Duplicate code |
| Structured logging mandatory | Consistent logging | Ad-hoc console.log |
| No silent catch | Error handling visible | Empty catch blocks |
| Max file size threshold | Files < 500 LOC | Large files |
| Strict dependency direction | Layered architecture | Circular deps |

---

## 3. GC Agents

### 3.1 Duplicate Detector

```typescript
interface DuplicateDetector {
  scan(): Promise<DuplicateReport>;
  suggestRefactor(duplicates: CodeBlock[]): RefactorSuggestion;
}

interface DuplicateReport {
  blocks: Array<{
    hash: string;
    locations: string[];
    lines: number;
    similarity: number;
  }>;
  totalWaste: number; // LOC
}
```

### 3.2 Boundary Enforcer

```typescript
interface BoundaryEnforcer {
  check(): Promise<BoundaryViolation[]>;
  autoFix(violation: BoundaryViolation): Promise<void>;
}

interface BoundaryViolation {
  file: string;
  import: string;
  fromLayer: string;
  toLayer: string;
  severity: 'warning' | 'error';
}
```

### 3.3 Documentation Sync

```typescript
interface DocumentationSync {
  detectDrift(): Promise<DocDrift[]>;
  generateUpdates(drift: DocDrift): Promise<DocUpdate[]>;
}
```

---

## 4. Entropy Score

### 4.1 Calculation

```
entropy_score = (
  rule_violations * 10 +
  drift_rate * 5 +
  test_coverage_delta * -2 +
  documentation_mismatch * 3
)
```

### 4.2 Thresholds

| Score | Status | Action |
|-------|--------|--------|
| 0-10 | Healthy | None |
| 11-50 | Warning | Auto-fix PR |
| 51-100 | Critical | Block merge |
| 100+ | Emergency | Page on-call |

### 4.3 Recording

```markdown
# Entropy Score History

| Date | Score | Change | Top Contributor |
|------|-------|--------|-----------------|
| 2026-02-24 | 15 | -5 | duplicate_detector |
| 2026-02-23 | 20 | +3 | boundary_enforcer |
```

---

## 5. Small PR Automation

### 5.1 Auto-Merge Rules

| Risk Tier | Review Required | Auto-Merge |
|-----------|-----------------|------------|
| Low (GC fix) | 0 | Yes |
| Medium | 1 | After approval |
| High | 2 | After approval + CI |

### 5.2 Reviewability Target

- **Goal:** Reviewable in < 1 minute
- **Max diff size:** 200 LOC
- **Max files changed:** 10

---

## 6. Implementation

### 6.1 Cron Schedule

```yaml
gc_agents:
  schedule: "0 2 * * *" # Daily at 2 AM
  timeout: 30m
  notify_on:
    - entropy_score > 50
    - auto_fix_failed
```

### 6.2 Output

```json
{
  "run_id": "gc-2026-02-24",
  "timestamp": "2026-02-24T02:00:00Z",
  "entropy_score": 15,
  "violations_found": 5,
  "auto_fixes_applied": 3,
  "prs_created": ["#1234", "#1235"],
  "duration_ms": 45000
}
```

---

## 7. Related Documents

- [LAW-QLT-002](../../SYSTEM_LAW.md#law-qlt-002) - Entropy Compression
- [Quality Score System](./quality-score.md)
- [Harness Engineering](./harness-engineering.md)
