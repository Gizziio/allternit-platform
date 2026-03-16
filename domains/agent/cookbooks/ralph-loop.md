# Cookbook: Ralph Loop (Bounded Fix Cycles)

**Purpose:** Deterministic procedure for Builder/Validator iteration until acceptance.

## Procedure

### Phase 1: Initialize
```
1. Set max_fix_cycles = 3 (from WIH or policy)
2. Set cycle = 0
3. Initialize empty fix_list = []
```

### Phase 2: Build-Validate Cycle
```
WHILE cycle < max_fix_cycles:
    cycle += 1
    
    // BUILD PHASE
    4. Spawn Builder worker with:
       - WIH specification
       - Current fix_list (if cycle > 1)
       - Lease scope for allowed paths
    
    5. Wait for Builder completion
       - IF Builder FAILS:
         - IF cycle >= max_fix_cycles: GOTO Phase 4 (Escalate)
         - ELSE: LOG error, add to fix_list, CONTINUE
    
    6. Collect Builder artifacts and receipts
    
    // VALIDATE PHASE
    7. Spawn Validator worker with:
       - Builder artifacts
       - Read-only scope
    
    8. Wait for Validator completion
       - IF Validator FAILS:
         - LOG error
         - IF cycle >= max_fix_cycles: GOTO Phase 4 (Escalate)
         - ELSE: Extract required_fixes, add to fix_list, CONTINUE
    
    9. IF Validator PASS:
       - GOTO Phase 3 (Success)
```

### Phase 3: Success
```
10. Emit validator_report receipt with verdict: PASS
11. Request WIH close with status: DONE
12. Release lease
13. EXIT
```

### Phase 4: Escalation
```
14. Emit validator_report receipt with verdict: FAIL
15. Record findings:
    - Cycles exhausted
    - Remaining required fixes
    - Blocking issues
16. Emit PromptDeltaNeeded or escalate to user
17. Release lease (if appropriate)
18. EXIT with BLOCKED status
```

## Receipts Required

| Phase | Receipt | Purpose |
|-------|---------|---------|
| Build | `tool_call_pre/post` | Each tool execution |
| Build | `build_report` | Builder completion |
| Validate | `tool_call_pre/post` | Each read/test |
| Validate | `validator_report` | PASS/FAIL verdict |
| End | `compaction_summary` | Run summary (optional) |

## Invariants

1. **Builder never validates own work**
2. **Validator is always read-only**
3. **PASS verdict required for completion**
4. **Max 3 fix cycles before escalation**
5. **All state changes through receipts**

## Example Log Output

```
[00:00:01] Ralph loop started (max_cycles=3)
[00:00:02] Cycle 1: Spawning Builder
[00:05:30] Cycle 1: Builder completed (2 files)
[00:05:31] Cycle 1: Spawning Validator
[00:06:15] Cycle 1: Validator FAIL - test failures
[00:06:16] Cycle 1: Fix list updated (2 items)
[00:06:17] Cycle 2: Spawning Builder with fixes
[00:10:45] Cycle 2: Builder completed
[00:10:46] Cycle 2: Spawning Validator
[00:11:30] Cycle 2: Validator PASS
[00:11:31] WIH close requested
[00:11:32] Complete
```
