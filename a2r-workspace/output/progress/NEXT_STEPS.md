# A2rchitect - Next Steps After N5 Completion

## ✅ Completed: N5 Environment Definition

The N5 Environment Definition is now fully integrated:
- Environment spec loading with caching
- Rootfs/initramfs conversion
- Shell UI with templates
- ProcessDriver environment preservation

---

## 🔧 Integration Gaps to Address

### 1. **Tool Execution → Driver Integration** (High Priority)

**Problem:** Tool execution doesn't use the driver registry or environment

**Current Flow:**
```
Tool Request → Tool Gateway → Direct Execution
```

**Target Flow:**
```
Tool Request → Tool Gateway → Driver Registry → Spawn + Exec
                ↓
         Environment (N5) + Resources (N11) + Budget (N11)
```

**Files to Modify:**
- `7-apps/api/src/tools_routes.rs` - Add driver spawning before tool execution
- `1-kernel/a2r-kernel/tools-gateway/` - Integrate with driver interface

**Implementation:**
```rust
async fn execute_native_tool(...) {
    // 1. Get environment from request or use default
    let env_spec = state.environment_loader.load(&env_source).await?;
    
    // 2. Spawn driver with environment
    let driver = state.driver_registry.get_driver(&driver_type).await?;
    let handle = driver.spawn(SpawnSpec { env: env_spec, ... }).await?;
    
    // 3. Execute tool in spawned environment
    let result = driver.exec(&handle, cmd_spec).await?;
    
    // 4. Cleanup
    driver.destroy(handle).await?;
    
    Ok(result)
}
```

---

### 2. **Workflow Execution Integration** (High Priority)

**Problem:** Workflow execution is stubbed (returns null)

**Current:**
```rust
async fn execute_workflow(...) {
    // TODO: Implement
    Ok(Json(json!({"status": "executed", "result": null})))
}
```

**Implementation Needed:**
- DAG topological sorting
- Node-by-node execution
- State management between nodes
- Error handling and retries

---

### 3. **Budget Metering Enforcement** (Medium Priority)

**Problem:** Budget API exists but isn't enforced during execution

**Current:** Budget status is tracked but not used

**Target:** Enforce budget limits on every execution

```rust
async fn execute_with_budget(
    &self,
    request: ExecutionRequest,
) -> Result<ExecutionResult, BudgetError> {
    // Check budget before execution
    let budget = self.budget_engine.check_quota(&tenant).await?;
    if budget.exhausted {
        return Err(BudgetError::QuotaExceeded);
    }
    
    // Execute with metering
    let result = self.execute(request).await?;
    
    // Record consumption
    self.budget_engine.record_usage(&tenant, result.cost).await?;
    
    Ok(result)
}
```

---

### 4. **Replay Engine Integration** (Medium Priority)

**Problem:** Replay API exists but not wired to execution

**Current:** Replay engine is standalone

**Target:** Capture execution state for deterministic replay

```rust
async fn execute_with_replay(
    &self,
    request: ExecutionRequest,
) -> Result<ExecutionResult, ExecutionError> {
    // Start capture
    let capture = self.replay_engine.start_capture(&request).await?;
    
    // Execute
    let result = self.execute(request).await?;
    
    // Store capture
    self.replay_engine.save_capture(capture, &result).await?;
    
    Ok(result)
}
```

---

### 5. **Prewarm Pool Integration** (Medium Priority)

**Problem:** Prewarm pools are configured but not used

**Target:** Use prewarmed environments for faster startup

```rust
async fn spawn(&self, spec: SpawnSpec) -> Result<ExecutionHandle, DriverError> {
    // Try to get from prewarm pool first
    if let Some(prewarmed) = self.pool_manager.acquire(&spec.env.image).await {
        return Ok(prewarmed);
    }
    
    // Fall back to fresh spawn
    self.fresh_spawn(spec).await
}
```

---

### 6. **Environment in API Execution Requests** (High Priority)

**Problem:** Tool/workflow execution APIs don't accept environment parameter

**Current Request:**
```json
{
  "tool_name": "bash.execute",
  "parameters": { "command": "ls" }
}
```

**Target Request:**
```json
{
  "tool_name": "bash.execute",
  "parameters": { "command": "ls" },
  "environment": "mcr.microsoft.com/devcontainers/rust:1",
  "driver": "process",
  "resources": { "cpu": 1000, "memory": 2048 }
}
```

---

## 📋 Recommended Implementation Order

### Phase 1: Core Execution Integration (Week 1)
1. Add environment parameter to tool execution API
2. Integrate driver registry with tool gateway
3. Test end-to-end tool execution with environment

### Phase 2: Resource Management (Week 2)
4. Wire budget metering to execution
5. Enforce resource limits
6. Add cost tracking to execution results

### Phase 3: Advanced Features (Week 3-4)
7. Integrate replay capture
8. Enable prewarm pools
9. Implement workflow execution

---

## 🔍 Files to Examine

### Execution Flow
- `7-apps/api/src/tools_routes.rs` - Tool execution entry point
- `1-kernel/a2r-kernel/tools-gateway/src/lib.rs` - Tool gateway implementation
- `1-kernel/infrastructure/a2r-driver-interface/src/lib.rs` - Driver interface
- `1-kernel/execution/a2r-process-driver/src/lib.rs` - Process driver

### Resource Management
- `7-apps/api/src/runtime_routes.rs` - Budget/replay/prewarm APIs
- `1-kernel/infrastructure/a2r-budget-metering/src/lib.rs` - Budget engine
- `1-kernel/infrastructure/a2r-replay/src/lib.rs` - Replay engine
- `1-kernel/infrastructure/a2r-prewarm/src/lib.rs` - Prewarm manager

### Workflow
- `7-apps/api/src/routes.rs` - Workflow execution stub
- `1-kernel/agent-systems/a2r-dak-runner/` - DAG runner

---

## 🎯 Success Criteria

1. **Tool Execution:**
   - Can specify environment in tool execution request
   - Tool runs in specified environment
   - Execution respects resource limits

2. **Budget:**
   - Each execution consumes budget credits
   - Execution rejected when budget exhausted
   - Cost visible in execution results

3. **Replay:**
   - Executions are captured
   - Can replay previous execution
   - Deterministic replay within envelope

4. **Workflow:**
   - Workflows execute node-by-node
   - State passes between nodes
   - Errors handled with retries

---

## 💡 Quick Wins

### 1. Add Environment to Tool Execution (2 hours)
```rust
#[derive(Deserialize)]
struct ToolExecutionRequest {
    tool_name: String,
    parameters: serde_json::Value,
    // ADD THIS:
    environment: Option<String>,
    driver: Option<String>,
}
```

### 2. Log Budget Consumption (1 hour)
```rust
info!(
    tenant = %tenant,
    credits_consumed = %cost,
    "Execution budget consumed"
);
```

### 3. Record Execution in Replay (2 hours)
```rust
let capture_id = replay_engine.start_capture().await?;
// ... execute ...
replay_engine.end_capture(capture_id, &result).await?;
```

---

## 🚧 Blockers to Resolve

1. **Workflow Engine API** - Workflow execution needs the workflow engine to be fully implemented
2. **MCP Tool Execution** - MCP tools are partially implemented
3. **MicroVM Driver** - Only process driver exists, MicroVM driver is stubbed

---

## Summary

The infrastructure is in place. The main work is **wiring components together** during actual execution:

- ✅ N5 Environment: Done
- ✅ N3/N4 Drivers: Done (but not used)
- ✅ N11 Budget: Done (but not enforced)
- ✅ N12 Replay: Done (but not recording)
- ✅ N16 Prewarm: Done (but not using)
- 🔄 Execution Integration: Next focus

**Estimated time to full integration: 2-3 weeks**
