# DAK Runner ↔ Rails System Analysis

**Analysis Date:** 2026-02-08  
**DAK Runner Version:** 1.0.0  
**Bridge Spec Version:** 1.0.0

---

## Executive Summary

The DAK Runner and Rails system are **well-integrated** with the core bridge protocol implemented. The architecture correctly maintains the **authority separation** with Rails as the control plane and DAK Runner as the execution plane.

### Implementation Status

| Component | Status | Coverage |
|-----------|--------|----------|
| Hook Lifecycle | ✅ Implemented | SessionStart → PreToolUse → PostToolUse → SessionEnd |
| Gate Checking | ✅ Implemented | ALLOW/BLOCK/TRANSFORM/REQUIRE_APPROVAL |
| Lease Management | ✅ Implemented | Request, renew, release |
| Receipt Emission | ✅ Implemented | tool_call_pre/post/failure |
| ContextPack Building | ✅ Implemented | SHA-256 hashed, deterministic |
| Work Discovery | ✅ Implemented | Via Rails CLI |
| WIH Close | ✅ Implemented | Validator PASS → close |
| Ralph Loop | ✅ Implemented | Bounded fix cycles |

---

## 1. Coordination Points

### 1.1 Hook Lifecycle Coordination

```
DAK Runner                              Rails
──────────                              ─────
   │                                      │
   │ 1. SessionStart                      │
   │ ─────────────────>                   │
   │    (context_pack_id, policy_bundle)  │
   │                                      │
   │ 2. PreToolUse                        │
   │ ─────────────────>                   │
   │    POST /gate/check                  │
   │    {tool, args, context}             │
   │                                      │
   │ <──────────────────                  │
   │    GateDecision                      │
   │    {ALLOW|BLOCK|TRANSFORM}           │
   │                                      │
   │ 3. [If ALLOW] Execute tool locally   │
   │    in DAK Runner                     │
   │                                      │
   │ 4. PostToolUse                       │
   │ ─────────────────>                   │
   │    POST /gate/commit                 │
   │    {result, affected_paths}          │
   │                                      │
   │ 5. SessionEnd                        │
   │ ─────────────────>                   │
   │    Emit ledger event                 │
   │                                      │
```

**Implementation:** `src/hooks/runtime.ts` lines 122-217

**Key Code:**
```typescript
// Phase 1: PreToolUse - Gate check (line 129-146)
const gateResult = await this.gateChecker.check(toolCall);

// Phase 2: PostToolUse - Record outcome (line 189-206)
await this.gateChecker.commit(toolCall, result, postReceiptId);
```

---

### 1.2 Lease Coordination

```
DAK Runner                              Rails
──────────                              ─────
   │                                      │
   │ 1. Request Lease                     │
   │ ─────────────────>                   │
   │    a2r lease request <wih_id>        │
   │    --paths "src/" --ttl 900          │
   │                                      │
   │ <──────────────────                  │
   │    LeaseGranted / LeaseDenied        │
   │                                      │
   │ 2. [During execution]                │
   │    Renew lease periodically          │
   │ ─────────────────>                   │
   │    a2r lease renew <lease_id>        │
   │                                      │
   │ 3. Release on completion             │
   │ ─────────────────>                   │
   │    a2r lease release <lease_id>      │
   │                                      │
```

**Implementation:** `src/adapters/rails_api.ts` lines 83-159

**Key Code:**
```typescript
// Request lease (line 93-96)
const { stdout } = await this.execRails(
  `lease request ${wihId} --paths "${pathsArg}" --ttl ${ttlSeconds} --json`
);

// Renew lease (line 138-141)
await this.execRails(`lease renew ${leaseId} --extend ${additionalSeconds}`);

// Release lease (line 151-153)
await this.execRails(`lease release ${leaseId}`);
```

---

### 1.3 Receipt Coordination

Receipts are the **audit trail** connecting both systems:

| Receipt | Emitter | Storage | Purpose |
|---------|---------|---------|---------|
| `injection_marker` | DAK Runner | `.a2r/markers/` | Proof of policy injection |
| `context_pack_seal` | DAK Runner | `.a2r/runner/` | Context pack validation |
| `tool_call_pre` | DAK Runner → Rails | Rails ledger | Pre-execution gate check |
| `tool_call_post` | DAK Runner → Rails | Rails ledger | Successful execution |
| `tool_call_failure` | DAK Runner → Rails | Rails ledger | Failed execution |
| `validator_report` | DAK Runner → Rails | Rails ledger | PASS/FAIL decision |

**Implementation:** 
- DAK Runner side: `src/hooks/runtime.ts` lines 139, 190, 294
- Rails side: `src/adapters/rails_api.ts` lines 257-270

---

### 1.4 ContextPack Coordination

```
DAK Runner                              Rails
──────────                              ─────
   │                                      │
   │ 1. Collect inputs from Rails         │
   │ <──────────────────                  │
   │    - WIH content                     │
   │    - DAG slice                       │
   │    - Receipts from deps              │
   │    - Policy bundle                   │
   │                                      │
   │ 2. Build ContextPack                 │
   │    (local computation)               │
   │                                      │
   │ 3. Generate cp_{hash}                │
   │    SHA-256 of inputs                 │
   │                                      │
   │ 4. Seal and store                    │
   │ ─────────────────>                   │
   │    Persist pack reference            │
   │                                      │
```

**Implementation:** `src/context/builder.ts` lines 90-141

**Key Code:**
```typescript
// Generate deterministic pack ID (line 112-117)
const packHash = crypto
  .createHash('sha256')
  .update(JSON.stringify(packData.inputs))
  .digest('hex');

const contextPackId: ContextPackId = `cp_${packHash.slice(0, 24)}`;
```

---

### 1.5 Ralph Loop Coordination

```
DAK Runner                              Rails
──────────                              ─────
   │                                      │
   │ 1. Builder completes work            │
   │ ─────────────────>                   │
   │    Emit build_report receipt         │
   │                                      │
   │ 2. Request Validator spawn           │
   │ ─────────────────>                   │
   │    Rails grants validator lease      │
   │                                      │
   │ 3. Validator executes                │
   │    (read-only, gated)                │
   │                                      │
   │ 4. Validator completes               │
   │ ─────────────────>                   │
   │    Emit validator_report             │
   │                                      │
   │ 5. Check result                      │
   │    PASS → Request WIH close          │
   │    FAIL → Loop (if < max)            │
   │    Max exceeded → Escalate           │
   │                                      │
```

**Implementation:** `src/loop/ralph.ts`

---

## 2. What's Implemented ✅

### 2.1 Core Bridge Protocol

| Bridge Spec Section | Implementation | File |
|--------------------|----------------|------|
| §3 Work Discovery | ✅ `discoverWork()` | `src/adapters/rails_api.ts:69` |
| §3.2 Claim Protocol | ✅ `claimWork()` | `src/adapters/rails_api.ts:83` |
| §4 ContextPack | ✅ `ContextPackBuilder.build()` | `src/context/builder.ts:90` |
| §5.1 PreToolUse | ✅ `gateCheck()` | `src/adapters/rails_api.ts:164` |
| §5.2 Gate Decision | ✅ All 4 decisions | `src/hooks/runtime.ts:148-177` |
| §5.4 PostToolUse | ✅ `gateCommit()` | `src/adapters/rails_api.ts:205` |
| §5.5 PostToolUseFailure | ✅ `gateFail()` | `src/adapters/rails_api.ts:231` |
| §6 Receipts | ✅ All required kinds | `src/hooks/runtime.ts` |
| §7 Ralph Loop | ✅ Bounded cycles | `src/loop/ralph.ts` |

### 2.2 Hook Lifecycle Events

| Event | Status | Location |
|-------|--------|----------|
| `SessionStart` | ✅ | `src/hooks/runtime.ts:87` |
| `UserPromptSubmit` | ✅ | `src/types/index.ts:67` |
| `PreToolUse` | ✅ | `src/hooks/runtime.ts:136` |
| `PostToolUse` | ✅ | `src/hooks/runtime.ts:205` |
| `PostToolUseFailure` | ✅ | `src/hooks/runtime.ts:287` |
| `SessionEnd` | ✅ | `src/hooks/runtime.ts:108` |
| `PermissionRequest` | ✅ | `src/hooks/runtime.ts:162` |

### 2.3 Gate Decisions

| Decision | Status | Handler |
|----------|--------|---------|
| `ALLOW` | ✅ | Execute with original args |
| `BLOCK` | ✅ | Return error, emit failure receipt |
| `TRANSFORM` | ✅ | Execute with transformed args |
| `REQUIRE_APPROVAL` | ✅ | Emit PermissionRequest, return error |

### 2.4 Tool Integration

```typescript
// Full tool lifecycle (src/hooks/runtime.ts:122-217)
async executeTool(toolCall: ToolCall): Promise<ToolResult> {
  // 1. Emit PreToolUse hook
  // 2. Emit tool_call_pre receipt
  // 3. Call Rails gate check
  // 4. [If blocked] Emit failure, return
  // 5. [If approval needed] Emit request, return
  // 6. Execute tool (with transformed args if applicable)
  // 7. Emit tool_call_post receipt
  // 8. Emit PostToolUse hook
  // 9. Call Rails gate commit
}
```

---

## 3. Gaps and Missing Pieces ⚠️

### 3.1 Critical Gaps

#### 1. HTTP Mode Not Implemented

**Location:** `src/adapters/rails_api.ts:354-362`

**Current:**
```typescript
private async execRails(command: string): Promise<{ stdout: string; stderr: string }> {
  if (this.config.useHttp && this.config.httpEndpoint) {
    // HTTP implementation would go here
    throw new Error('HTTP mode not yet implemented');  // <-- GAP
  }
  return execAsync(fullCommand, { cwd: this.config.projectPath });
}
```

**Impact:** High - Currently requires Rails CLI to be installed locally

**Solution:** Implement HTTP client for Rails API

---

#### 2. Missing ContextPack Persistence

**Bridge Spec §4.2:** Requires ContextPack seal to be persisted to Rails

**Current:** `ContextPackBuilder.build()` generates the pack but doesn't persist to Rails

**Gap:** No `POST /context-pack/seal` or equivalent

**Impact:** Medium - Context packs exist in memory only

**Solution:** Add Rails adapter method:
```typescript
async sealContextPack(pack: ContextPack): Promise<void> {
  await this.execRails(`context-pack seal --data '${JSON.stringify(pack)}'`);
}
```

---

#### 3. No Lease Auto-Renewal

**Current:** Leases must be manually renewed

**Gap:** No background task to auto-renew leases during long executions

**Impact:** High - Long-running tools may lose lease

**Solution:** Add lease manager with auto-renewal:
```typescript
class LeaseManager {
  private renewInterval: NodeJS.Timeout;
  
  startAutoRenew(leaseId: string, intervalMs: number = 60000) {
    this.renewInterval = setInterval(() => {
      this.railsAdapter.renewLease(leaseId, 300);
    }, intervalMs);
  }
}
```

---

#### 4. Missing Receipt Query API

**Bridge Spec §6.2:** Requires querying receipts for evidence

**Current:** `writeReceipt()` exists but no `queryReceipts()`

**Gap:** Cannot retrieve dependency evidence from Rails

**Impact:** Medium - Context building incomplete

**Solution:** Add to Rails adapter:
```typescript
async queryReceipts(query: ReceiptQuery): Promise<Receipt[]> {
  const { stdout } = await this.execRails(
    `receipt query --wih ${query.wihId} --kinds ${query.kinds.join(',')} --json`
  );
  return JSON.parse(stdout);
}
```

---

#### 5. No Prompt Delta Handling

**Bridge Spec §8.2:** `PromptDeltaNeeded` for missing/ambiguous input

**Current:** Not implemented

**Gap:** Cannot request clarification from user

**Impact:** Medium - Poor UX for incomplete WIH

**Solution:** Add to hook runtime:
```typescript
async requestPromptDelta(
  reasonCode: 'MISSING_INPUT' | 'AMBIGUOUS_REQUIREMENT',
  requestedFields: string[]
): Promise<void> {
  await this.emitHookEvent('PromptDeltaNeeded', { reasonCode, requestedFields });
  // Halt execution, wait for user input
}
```

---

### 3.2 Minor Gaps

| Gap | Location | Impact | Solution |
|-----|----------|--------|----------|
| No blob storage refs | `gateCommit()` | Low | Add blob:// URL support |
| Missing correlation ID propagation | Various | Low | Ensure all calls include corr_id |
| No iteration events in Ralph Loop | `src/loop/ralph.ts` | Low | Add emitIterationStarted/Completed |
| HTTP endpoint config unused | `RailsConfig` | Low | Remove or implement |

---

## 4. Integration Architecture

### 4.1 Current Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   DAK Runner                                                      │
│   ──────────                                                      │
│   ┌─────────────┐                                                │
│   │ HookRuntime │──┐                                             │
│   └─────────────┘  │                                              │
│         │          │     ┌─────────────┐                         │
│         ▼          └────►│ RailsAdapter│◄──┐                    │
│   ┌─────────────┐        └──────┬──────┘   │                    │
│   │ ToolExecutor│               │          │                    │
│   └─────────────┘               │ CLI      │                    │
│         ▲                       ▼          │                    │
│         │               ┌─────────────┐    │                    │
│         └───────────────┤  Rails CLI  │    │                    │
│                         └──────┬──────┘    │                    │
│                                │            │                    │
│                                ▼            │                    │
│                         ┌─────────────┐     │                    │
│                         │ Rails Core  │─────┘                    │
│                         │ (Control)   │  (ledger, leases)        │
│                         └─────────────┘                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Recommended Improvements

```
┌─────────────────────────────────────────────────────────────────┐
│                  RECOMMENDED ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   DAK Runner                                                      │
│   ──────────                                                      │
│   ┌─────────────┐    ┌──────────────┐                          │
│   │ HookRuntime │───►│ LeaseManager │──┐                       │
│   └─────────────┘    │ (auto-renew) │  │                       │
│         │            └──────────────┘  │                       │
│         │                              │                       │
│         ▼                              ▼                       │
│   ┌─────────────┐        ┌─────────────────┐                  │
│   │ ToolExecutor│        │   RailsAdapter  │                  │
│   └─────────────┘        │   (HTTP + CLI)  │                  │
│         ▲                └────────┬────────┘                  │
│         │                         │                           │
│         │          ┌──────────────┼──────────────┐            │
│         │          │              │              │            │
│         └──────────┤ HTTP API     │ CLI Fallback │            │
│                    │              │              │            │
│                    ▼              ▼              ▼            │
│              ┌─────────────────────────────────────────┐      │
│              │              Rails Core                  │      │
│              │  (Control Plane - Ledger Authority)      │      │
│              └─────────────────────────────────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Testing Gaps

### 5.1 Missing Integration Tests

| Test Scenario | Status | Priority |
|--------------|--------|----------|
| Rails CLI integration | ❌ Not tested | Critical |
| Lease auto-renewal | ❌ Not tested | High |
| Gate decision handling | ❌ Partial | High |
| Context pack persistence | ❌ Not tested | Medium |
| Receipt query flow | ❌ Not tested | Medium |
| Ralph loop with Rails | ❌ Not tested | High |

### 5.2 Mock Rails Implementation

**Recommendation:** Create a mock Rails for testing:

```typescript
// __tests__/mocks/mock-rails.ts
export class MockRailsAdapter implements RailsAdapterInterface {
  private leases: Map<string, Lease> = new Map();
  private receipts: Receipt[] = [];
  
  async gateCheck(request: GateCheckRequest): Promise<GateCheckResponse> {
    // Mock implementation for testing
    return { allowed: true, decision: 'ALLOW', checkId: 'mock-check' };
  }
  
  // ... other methods
}
```

---

## 6. Recommendations

### 6.1 Priority 1: Critical

1. **Implement HTTP mode in RailsAdapter**
   - Add HTTP client (axios/fetch)
   - Implement all CLI methods as HTTP endpoints
   - Add fallback logic

2. **Add LeaseManager with auto-renewal**
   - Background interval for lease renewal
   - Handle renewal failures gracefully

3. **Add Rails integration tests**
   - Mock Rails adapter
   - Test full hook lifecycle

### 6.2 Priority 2: Important

1. **ContextPack persistence to Rails**
2. **Receipt query API**
3. **Prompt delta handling**

### 6.3 Priority 3: Nice to Have

1. **Blob storage references**
2. **Complete correlation ID propagation**
3. **Iteration events in Ralph Loop**

---

## 7. Summary

### Strengths ✅

1. **Correct authority separation** - Rails owns control, DAK owns execution
2. **Complete hook lifecycle** - All events implemented
3. **Proper gate checking** - Every tool call goes through Rails
4. **Deterministic ContextPacks** - SHA-256 hashed for verification
5. **Receipt emission** - Full audit trail

### Weaknesses ⚠️

1. **CLI-only Rails communication** - No HTTP mode
2. **No lease auto-renewal** - Risk of lease expiration
3. **Missing persistence** - Context packs not saved to Rails
4. **Incomplete testing** - No Rails integration tests

### Overall Assessment

The DAK Runner ↔ Rails integration is **architecturally sound** and **functionally complete** for the core protocol. The main gaps are in:

1. **Transport layer** (HTTP mode)
2. **Operational robustness** (lease renewal)
3. **Testing coverage**

With the recommended improvements, the system will be production-ready for high-reliability deployments.

---

**END OF ANALYSIS**
