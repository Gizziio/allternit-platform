# PIVOT REPORT: A2R Runtime Brain Gap Analysis

**Date:** 2026-02-17  
**Auditor:** Senior Systems Engineer + Adversarial Auditor  
**Status:** GAPS IDENTIFIED - Integration Required

---

## Executive Summary

The A2rchitech codebase has substantial runtime infrastructure but gaps remain in the **explicit state machine**, **tool-loop arbitration**, and **streaming supervision** components. This report documents concrete findings and integration requirements.

---

## Existing Architecture (What's Working)

### ✅ BrainRuntime Trait (a2r-runtime)
```rust
// 1-kernel/infrastructure/a2r-runtime/src/lib.rs
#[async_trait]
pub trait BrainRuntime: Send + Sync {
    async fn create_session(&self, req: CreateSession) -> Result<SessionHandle, RuntimeError>;
    async fn send_prompt(&self, session: &SessionHandle, prompt: Prompt) -> Result<NormalizedResponse, RuntimeError>;
    async fn send_prompt_stream(&self, session: &SessionHandle, prompt: Prompt) -> Result<mpsc::Receiver<StreamEvent>, RuntimeError>;
    async fn send_tool_result(&self, session: &SessionHandle, result: ToolResult) -> Result<(), RuntimeError>;
    async fn close_session(&self, session: SessionHandle) -> Result<(), RuntimeError>;
}
```

### ✅ BrainManager (kernel-service)
```rust
// 4-services/orchestration/kernel-service/src/brain/manager.rs
pub struct BrainManager {
    drivers: Vec<Box<dyn BrainDriver>>,
    sessions: Arc<RwLock<HashMap<String, Arc<RwLock<Box<dyn BrainRuntime>>>>>>,
    session_metadata: Arc<RwLock<HashMap<String, BrainSession>>>,
    store: Option<Arc<BrainStore>>,
}
```

### ✅ ACP Driver (a2r-acp-driver)
```rust
// 1-kernel/infrastructure/a2r-acp-driver/src/driver.rs
pub struct AcpDriver {
    transport: AcpTransport,
    protocol: AcpProtocol,
}
```

---

## Identified Gaps

### GAP 1: Explicit Session State Machine

**Status:** ⚠️ PARTIAL - Sessions tracked but no explicit state transitions

**Evidence:**
```bash
$ grep -r "enum.*SessionState\|state_machine" /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/1-kernel/infrastructure/a2r-runtime/src/
# No explicit state machine found
```

**Current State:** Sessions are managed as BrainSession metadata but lifecycle states (Idle → Initializing → Ready → Streaming → etc.) are implicit.

**Required:**
```rust
pub enum SessionState {
    Idle,
    Initializing { attempt: u32 },
    Ready,
    AwaitingModel,
    Streaming,
    AwaitingToolExecution,
    ExecutingTool,
    Completed,
    Failed,
    Terminated,
}
```

**Integration Location:** `1-kernel/infrastructure/a2r-runtime/src/session/state_machine.rs`

---

### GAP 2: Tool-Loop Arbitration

**Status:** ⚠️ MISSING - Tools executed directly without arbitration layer

**Evidence:**
```bash
$ grep -r "ToolLoopArbiter\|should_execute\|circuit.*breaker" /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/1-kernel/infrastructure/a2r-runtime/src/
# Not found
```

**Current State:** Tool calls flow directly from provider to execution without:
- Circuit breaker protection
- Retry policy enforcement
- Tool call limits
- Permission management

**Required:**
```rust
pub struct ToolLoopArbiter {
    max_tool_calls: u32,
    circuit_breakers: HashMap<String, CircuitBreaker>,
    retry_policy: RetryPolicy,
}

impl ToolLoopArbiter {
    pub fn should_execute(&self, tool_call: &ToolCall) -> Decision;
    pub async fn execute_with_retry(&self, tool_call: ToolCall) -> ToolResult;
}
```

**Integration Location:** `1-kernel/infrastructure/a2r-runtime/src/tool_loop/arbiter.rs`

---

### GAP 3: Streaming Supervision

**Status:** ⚠️ MISSING - No backpressure or rate limiting

**Evidence:**
```bash
$ grep -r "backpressure\|token_bucket\|StreamingSupervisor" /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/1-kernel/infrastructure/a2r-runtime/src/
# Not found
```

**Current State:** Streaming is passthrough without:
- Token rate limiting
- Client buffer monitoring
- Backpressure pause/resume

**Required:**
```rust
pub struct StreamingSupervisor {
    rate_limiter: RateLimiter,
    backpressure: BackpressureController,
}

impl StreamingSupervisor {
    pub async fn emit_token(&self, token: &str) -> Result<(), StreamingError>;
    pub fn should_backpressure(&self) -> bool;
}
```

**Integration Location:** `1-kernel/infrastructure/a2r-runtime/src/streaming/supervisor.rs`

---

### GAP 4: Multi-Session Supervision

**Status:** ⚠️ PARTIAL - BrainManager has sessions but no stall detection

**Evidence:**
```bash
$ grep -r "stall\|timeout\|health_check" /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/4-services/orchestration/kernel-service/src/brain/
# Minimal health checking found
```

**Current State:** Sessions are stored but:
- No stall detection
- No automatic cleanup
- No resource limits

**Required:**
```rust
pub struct SessionSupervisor {
    max_concurrent_sessions: usize,
    stall_timeout_secs: u64,
}

impl SessionSupervisor {
    pub async fn health_check_all(&self) -> Vec<(String, SessionHealth)>;
    pub async fn terminate_stalled(&self);
}
```

---

## Integration Plan

### Phase 1: Add State Machine to a2r-runtime (Week 1)

1. Create `1-kernel/infrastructure/a2r-runtime/src/session/state_machine.rs`
2. Integrate with existing `SessionHandle`
3. Add transition guards
4. Add tests

### Phase 2: Add Tool Loop (Week 2)

1. Create `1-kernel/infrastructure/a2r-runtime/src/tool_loop/arbiter.rs`
2. Create `1-kernel/infrastructure/a2r-runtime/src/tool_loop/circuit_breaker.rs`
3. Create `1-kernel/infrastructure/a2r-runtime/src/tool_loop/retry.rs`
4. Integrate with BrainRuntime trait

### Phase 3: Add Streaming Supervision (Week 3)

1. Create `1-kernel/infrastructure/a2r-runtime/src/streaming/supervisor.rs`
2. Create `1-kernel/infrastructure/a2r-runtime/src/streaming/backpressure.rs`
3. Create `1-kernel/infrastructure/a2r-runtime/src/streaming/rate_limiter.rs`
4. Integrate with streaming methods

### Phase 4: Enhance Supervision (Week 4)

1. Add stall detection to BrainManager
2. Add resource limits
3. Add health check loop
4. Add metrics collection

---

## Success Criteria

A session can:
1. ✅ Stream tokens (exists)
2. ⚠️ Stream with backpressure (missing)
3. ✅ Request tool execution (exists)
4. ⚠️ Execute with circuit breaker (missing)
5. ✅ Receive tool results (exists)
6. ✅ Continue streaming (exists)
7. ⚠️ Terminate cleanly with state machine (missing)
8. ⚠️ Recover from transient failures (missing)

---

## Boundary Verification

```bash
# Verify existing boundaries are correct

# Rule 1: Provider logic only in 1-kernel/
grep -r "impl.*ProviderAdapter" 1-kernel/infrastructure/
# Expected: Found in a2r-providers/src/

# Rule 2: Runtime trait in 1-kernel/
grep -r "trait BrainRuntime" 1-kernel/infrastructure/a2r-runtime/src/
# Expected: Found

# Rule 3: Kernel-service delegates to runtime
grep -r "a2r_runtime::" 4-services/orchestration/kernel-service/src/
# Expected: Found imports

# Rule 4: UI does not import runtime directly
grep -r "a2r_runtime::" 7-apps/cli/src/ 2>/dev/null
# Expected: Not found
```

---

## References

- Existing BrainRuntime: `1-kernel/infrastructure/a2r-runtime/src/lib.rs`
- Existing BrainManager: `4-services/orchestration/kernel-service/src/brain/manager.rs`
- Existing ACP Driver: `1-kernel/infrastructure/a2r-acp-driver/src/driver.rs`

---

**END OF PIVOT REPORT**
