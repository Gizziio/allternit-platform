# A2R Continuity + Guard Acceptance Tests

## Overview
These tests verify the continuity layer (session handoff) and guard policy (threshold-based actions) work correctly.

---

## Guard Policy Tests

### Test 1: Deterministic Baton Emission
**Given** a synthetic session with receipts and state  
**When** compaction is triggered  
**Then** the output baton is identical across multiple runs (stable ordering, no timestamps in diff)

### Test 2: Warn Threshold (70%)
**Given** `context_ratio = 0.70`  
**When** guard policy evaluates  
**Then** `A2R_GUARD_WARN` event is emitted  
**And** TUI shows "Compaction recommended" indicator  
**And** no automatic compaction occurs

### Test 3: Compact Threshold (85%)
**Given** `context_ratio = 0.85`  
**When** guard policy evaluates  
**Then** `A2R_GUARD_COMPACT` event is emitted  
**And** compaction runs automatically  
**And** `/.a2r/compact/compact-YYYYMMDD-HHMM.md` is created  
**And** `/.a2r/handoff/latest.md` is updated to point to new compact

### Test 4: Fail-Closed Handoff Threshold (92%)
**Given** `context_ratio = 0.92`  
**When** guard policy evaluates  
**Then** compaction runs first (if not fresh)  
**Then** `A2R_GUARD_HANDOFF` event is emitted  
**And** handoff to target runner is attempted  
**And** if actuator unavailable, run halts with `A2R_GUARD_FAILCLOSED`

### Test 5: Handoff Preserves DAG
**Given** a session at DAG node "implement-auth"  
**When** handoff occurs  
**Then** new runner receives correct `dag_node_id` and `next_actions`

### Test 6: Evidence Gate
**Given** code changes exist in workspace  
**And** no receipt entries since last run marker  
**When** CI evidence gate runs  
**Then** gate fails with "Diff without receipts"

---

## Continuity Layer Tests

### Test 7: Deterministic Rehydration
**Given** `state.json` + `handoff.md` + receipts  
**When** runner resumes  
**Then** runner starts at correct DAG node with correct next actions

### Test 8: Index Correctness
**Given** multiple sessions in cache  
**When** index is queried  
**Then** sessions are stable and de-duplicated  
**And** TTL refresh does not reorder unexpectedly

### Test 9: Parser Robustness
**Given** fixture inputs for each supported tool  
**When** parser runs  
**Then** output matches golden `SessionContext`

### Test 10: Tool Switching Continuity
**Given** Session A from Tool A  
**When** context is extracted and injected into Tool B  
**Then** Tool B can continue with same objective, progress, decisions, blockers, next steps

---

## Baton Format Tests

### Test 11: Baton Contains All Required Sections
**Given** any session  
**When** compaction emits baton  
**Then** markdown contains all 11 required sections in order

### Test 12: Baton Schema Validation
**Given** any emitted baton  
**When** validated against `session-context.schema.json`  
**Then** validation passes with no errors

---

## Success Criteria

All tests MUST pass before release:
- ✅ Deterministic outputs
- ✅ Threshold triggers correct actions
- ✅ File artifacts created
- ✅ Events emitted
- ✅ Schema validation passes
- ✅ CI gates enforce rules
