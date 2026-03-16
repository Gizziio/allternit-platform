# Conflict Arbitration Engine Specification

**Version:** 1.0.0  
**Location:** `4-services/orchestration/conflict-arbitration/`  
**Implements:** SYSTEM_LAW.md LAW-SWM-003 (Conflict Arbitration)

---

## Purpose

The Conflict Arbitration Engine detects and resolves conflicts between concurrent changes in the A2R system.

**Key Capabilities:**
- Diff overlap detection
- Priority-based arbitration
- Evidence-based arbitration
- PR splitting recommendations
- Merge arbitration

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Conflict Arbitration Engine                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │  Diff Overlap   │  │    Priority     │               │
│  │    Detector     │  │   Arbitration   │               │
│  └─────────────────┘  └─────────────────┘               │
│                                                          │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │    Evidence     │  │      PR         │               │
│  │   Arbitration   │  │    Splitter     │               │
│  └─────────────────┘  └─────────────────┘               │
│                                                          │
│  ┌─────────────────┐                                     │
│  │  Merge Arbiter  │                                     │
│  └─────────────────┘                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Overlap Types

| Type | Description | Severity |
|------|-------------|----------|
| **DirectOverlap** | Same lines modified | Critical/High |
| **Adjacent** | Within 3 lines of each other | Medium |
| **SameFunction** | Same function/method modified | High |
| **SameLogicalBlock** | Same struct/impl block | Medium |
| **None** | No overlap (compatible) | Low |

---

## Conflict Severity

| Severity | Auto-Resolve | Manual Review |
|----------|--------------|---------------|
| **Critical** | Never | Always |
| **High** | Rarely (confidence > 0.9) | Usually |
| **Medium** | Sometimes (confidence > 0.7) | Sometimes |
| **Low** | Usually (confidence > 0.5) | Rarely |

---

## Arbitration Decisions

| Decision | Description | When Used |
|----------|-------------|-----------|
| **AcceptA** | Accept change A | A has higher score |
| **AcceptB** | Accept change B | B has higher score |
| **Merge** | Merge both changes | Non-critical overlap |
| **Split** | Split into separate PRs | Direct overlap |
| **ManualResolution** | Require human review | Critical conflicts |

---

## Scoring Algorithm

```rust
change_score = (priority / 10.0) * priority_weight
             + (evidence_count / 10.0) * evidence_weight

confidence = |score_a - score_b| / (score_a + score_b)

auto_resolve = confidence >= auto_resolve_threshold
```

**Default Weights:**
- `priority_weight`: 0.4
- `evidence_weight`: 0.6
- `auto_resolve_threshold`: 0.8

---

## API

### Detect Conflicts

```rust
let engine = ConflictArbitrationEngine::with_defaults();

let changes = vec![change_a, change_b, change_c];
let result = engine.detect_conflicts(&changes);

// result.conflicts: Vec<Conflict>
// result.compatible_changes: Vec<Change>
```

### Arbitrate Conflicts

```rust
let arbitration = engine.arbitrate(&result.conflicts);

// arbitration.decisions: Vec<ArbitrationDecision>
// arbitration.auto_resolved_count: usize
// arbitration.manual_resolution_required: usize
// arbitration.split_recommendations: Vec<SplitRecommendation>
```

### Recommend Splits

```rust
let splits = engine.recommend_splits(&changes, &conflicts);

// Each split recommendation contains:
// - original_run_id
// - split_into: Vec<SplitGroup>
// - reason
```

---

## Integration Points

### With Rails Service
- Conflict detection triggered before merge
- Arbitration decisions logged as receipts
- Split recommendations create new WIHs

### With DAK Runner
- Changes submitted with priority and evidence
- Worker receives arbitration decisions
- Split changes executed as separate nodes

### With Receipt System
- All changes include receipt IDs as evidence
- Arbitration decisions produce receipts
- Split recommendations logged

---

## Acceptance Tests

### AT-CONFLICT-001: Direct Overlap Detection
```rust
#[test]
fn test_detect_direct_overlap() {
    let engine = ConflictArbitrationEngine::with_defaults();
    
    let changes = vec![
        create_change("a", 10, 20),  // Lines 10-20
        create_change("b", 15, 25),  // Lines 15-25 (overlap)
    ];
    
    let result = engine.detect_conflicts(&changes);
    
    assert_eq!(result.conflicts.len(), 1);
    assert_eq!(result.conflicts[0].overlap_type, OverlapType::DirectOverlap);
}
```

### AT-CONFLICT-002: Priority-Based Arbitration
```rust
#[test]
fn test_arbitration_priority() {
    let engine = ConflictArbitrationEngine::with_defaults();
    
    let changes = vec![
        create_change_with_priority("a", 10, 20, 9),  // High priority
        create_change_with_priority("b", 15, 25, 3),  // Low priority
    ];
    
    let result = engine.detect_conflicts(&changes);
    let arbitration = engine.arbitrate(&result.conflicts);
    
    assert!(arbitration.decisions[0].auto_resolvable);
    assert!(matches!(arbitration.decisions[0].decision, Decision::AcceptA));
}
```

### AT-CONFLICT-003: Evidence-Based Arbitration
```rust
#[test]
fn test_arbitration_evidence() {
    let mut engine = ConflictArbitrationEngine::with_defaults();
    engine.config.evidence_weight = 0.9;
    
    let change_a = create_change_with_evidence("a", vec!["rcpt_1", "rcpt_2", "rcpt_3"]);
    let change_b = create_change_with_evidence("b", vec![]);  // No evidence
    
    let conflict = create_conflict(change_a, change_b);
    let decision = engine.arbitrate_conflict(&conflict);
    
    assert!(matches!(decision.decision, Decision::AcceptA));
}
```

### AT-CONFLICT-004: PR Split Recommendation
```rust
#[test]
fn test_split_recommendation() {
    let engine = ConflictArbitrationEngine::with_defaults();
    
    let changes = vec![
        create_change("a", 10, 20),
        create_change("b", 15, 25),  // Direct overlap
    ];
    
    let result = engine.detect_conflicts(&changes);
    let arbitration = engine.arbitrate(&result.conflicts);
    
    assert!(!arbitration.split_recommendations.is_empty());
    assert_eq!(arbitration.split_recommendations[0].split_into.len(), 2);
}
```

---

## Configuration

```rust
pub struct ArbitrationConfig {
    pub adjacent_line_threshold: usize,  // Default: 3
    pub priority_weight: f32,            // Default: 0.4
    pub evidence_weight: f32,            // Default: 0.6
    pub auto_resolve_threshold: f32,     // Default: 0.8
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-20 | Initial implementation |

---

**End of Specification**
