# Thin Kernel-Service Wiring Rules

## Principle

The kernel-service must be **thin HTTP wiring only**. No business logic.

---

## Current Status

The existing kernel-service at `4-services/orchestration/kernel-service/` is **NOT thin**:
- `main.rs` is ~171KB (should be <100 lines)
- Contains business logic that should be in `a2r-runtime`

**Refactoring Required:** Move business logic from kernel-service to a2r-runtime.

---

## Rules

### Rule 1: No Provider Adapter Implementations

```bash
# WRONG - Provider logic in kernel-service
grep -r "impl ProviderAdapter" 4-services/orchestration/kernel-service/src/
# Expected: EMPTY

# CORRECT - Provider logic in 1-kernel/
grep -r "impl ProviderAdapter" 1-kernel/infrastructure/a2r-providers/src/
# Expected: Found
```

### Rule 2: No State Machine in HTTP Layer

```bash
# WRONG - State machine in kernel-service
grep -r "SessionState\|StateMachine\|state.transition" 4-services/orchestration/kernel-service/src/
# Expected: EMPTY

# CORRECT - State machine in a2r-runtime
grep -r "SessionState\|StateMachine" 1-kernel/infrastructure/a2r-runtime/src/
# Expected: Found (TO ADD)
```

### Rule 3: No Direct Runtime Imports in UI

```bash
# WRONG - UI imports runtime directly
grep -r "use a2r_runtime" 7-apps/cli/src/
# Expected: EMPTY

# CORRECT - UI uses HTTP API
grep -r "reqwest\|http::" 7-apps/cli/src/
# Expected: Found
```

### Rule 4: Handlers Only Delegate

```rust
// CORRECT - kernel-service handler (after refactoring)
async fn create_session_handler(
    State(runtime): State<Arc<dyn BrainRuntime>>,
    Json(req): Json<CreateSessionRequest>,
) -> impl IntoResponse {
    match runtime.create_session(req.into()).await {
        Ok(handle) => Json(SessionResponse::from(handle)),
        Err(e) => Json(ErrorResponse::from(e)),
    }
}

// WRONG - Business logic in handler (CURRENT STATE)
async fn create_session_handler(...) -> impl IntoResponse {
    // 100+ lines of validation, provider setup, etc.
}
```

---

## Current vs Target Architecture

### Current (Violates Rules)

```
kernel-service/src/
├── main.rs (171KB - WAY TOO BIG)
│   └── Contains: HTTP handlers + Business logic + Provider setup
├── brain/
│   ├── manager.rs (Business logic - SHOULD BE IN A2R-RUNTIME)
│   ├── gateway.rs (HTTP + Business logic)
│   └── runtime_registry.rs (Registry logic)
```

### Target (Follows Rules)

```
kernel-service/src/
├── main.rs (<100 lines)
│   └── Only: Route setup + Server start
├── handlers/
│   ├── sessions.rs (<30 lines each)
│   ├── prompts.rs (<30 lines each)
│   └── health.rs (<10 lines)
└── error.rs (Error mapping only)

1-kernel/infrastructure/a2r-runtime/src/
├── lib.rs (BrainRuntime trait)
├── session/
│   ├── state_machine.rs (NEW - Session lifecycle)
│   └── supervisor.rs (NEW - Multi-session mgmt)
├── tool_loop/
│   ├── arbiter.rs (NEW - Tool execution decisions)
│   ├── circuit_breaker.rs (NEW - Failure protection)
│   └── retry.rs (NEW - Retry policies)
└── streaming/
    ├── supervisor.rs (NEW - Backpressure)
    └── rate_limiter.rs (NEW - Token rate limits)
```

---

## Grep Checks (Automated)

```bash
#!/bin/bash
# run-boundary-checks.sh

cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech

ERRORS=0

echo "=== Boundary Checks ==="

# Check 1: No provider logic in kernel-service handlers
if grep -r "impl.*Provider" 4-services/orchestration/kernel-service/src/handlers/ 2>/dev/null; then
    echo "✗ FAIL: Provider logic in kernel-service handlers"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ PASS: No provider logic in kernel-service handlers"
fi

# Check 2: State machine in a2r-runtime (should exist after adding)
if grep -r "enum SessionState" 1-kernel/infrastructure/a2r-runtime/src/ 2>/dev/null; then
    echo "✓ PASS: State machine exists in a2r-runtime"
else
    echo "⚠ MISSING: State machine not yet added to a2r-runtime"
fi

# Check 3: No runtime imports in UI
if grep -r "use a2r_runtime" 7-apps/cli/src/ 2>/dev/null; then
    echo "✗ FAIL: UI imports runtime directly"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ PASS: UI uses HTTP API only"
fi

# Check 4: Kernel-service main.rs size
LINES=$(wc -l < 4-services/orchestration/kernel-service/src/main.rs)
if [ $LINES -gt 200 ]; then
    echo "✗ FAIL: kernel-service/main.rs too large ($LINES lines, should be <200)"
    ERRORS=$((ERRORS + 1))
else
    echo "✓ PASS: kernel-service/main.rs is $LINES lines"
fi

if [ $ERRORS -eq 0 ]; then
    echo "=== All Critical Checks Passed ==="
    exit 0
else
    echo "=== $ERRORS Critical Check(s) Failed ==="
    exit 1
fi
```

---

## Current Measurements

```bash
# Kernel-service main.rs size
$ wc -l 4-services/orchestration/kernel-service/src/main.rs
171580  # WAY TOO BIG - needs refactoring

# Brain module size
$ wc -l 4-services/orchestration/kernel-service/src/brain/*.rs
   400 brain/adapters/mod.rs
   292 brain/drivers/acp.rs
   ...

# Target size after refactoring
$ wc -l 4-services/orchestration/kernel-service/src/main.rs (target)
<100 lines
```

---

## Refactoring Plan

### Phase 1: Extract Business Logic to a2r-runtime (Week 1-2)

1. Move `BrainManager` logic to `a2r-runtime/src/supervision/manager.rs`
2. Move session tracking to `a2r-runtime/src/session/`
3. Keep only HTTP glue in kernel-service

### Phase 2: Add Missing Components (Week 3-4)

1. Add state machine to `a2r-runtime/src/session/state_machine.rs`
2. Add tool loop arbiter to `a2r-runtime/src/tool_loop/`
3. Add streaming supervisor to `a2r-runtime/src/streaming/`

### Phase 3: Thin kernel-service (Week 5)

1. Replace business logic with BrainRuntime calls
2. Reduce main.rs to <100 lines
3. Add integration tests

---

**END OF THIN WIRING RULES**
