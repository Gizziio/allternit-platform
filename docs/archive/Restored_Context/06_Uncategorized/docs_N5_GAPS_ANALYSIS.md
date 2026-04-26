# N5 Environment Definition - Gap Analysis

## Summary
The N5 Environment Definition infrastructure is in place but has several integration gaps that prevent it from being fully functional in production.

---

## 🔴 Critical Gaps (Must Fix)

### Gap #1: No Shared EnvironmentSpecLoader in AppState
**Location:** `cmd/api/src/main.rs` - `AppState` struct

**Problem:** Each API request creates a new `EnvironmentSpecLoader`, which means:
- No shared cache between requests
- Each request re-resolves the same images
- Wasted CPU/memory resources

**Current Code:**
```rust
// In resolve_environment handler:
let loader = EnvironmentSpecLoader::new()  // Created fresh each request!
    .map_err(|e| { ... })?;
```

**Fix Required:**
```rust
// Add to AppState:
pub struct AppState {
    // ... existing fields ...
    /// Environment spec loader with caching (N5)
    pub environment_loader: Arc<EnvironmentSpecLoader>,
}

// Initialize in main():
let environment_loader = Arc::new(
    EnvironmentSpecLoader::new()
        .expect("Failed to create environment loader")
);

// Use in handlers:
async fn resolve_environment(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ResolveRequest>,
) -> Result<Json<ResolveResponse>, StatusCode> {
    let spec = state.environment_loader.load(&request.source).await
        .map_err(|e| { ... })?;
    // ...
}
```

---

### Gap #2: ProcessDriver Doesn't Use EnvironmentSpec from spawn() in exec()
**Location:** `domains/kernel/execution/allternit-process-driver/src/lib.rs`

**Problem:** The `spawn()` method receives an `EnvironmentSpec`, but `exec()` creates a NEW empty spec instead of using the original one. This means:
- Environment configuration is lost between spawn and exec
- Image, mounts, env_vars from the spec are ignored
- Commands run in wrong environment

**Current Code:**
```rust
async fn exec(&self, handle: &ExecutionHandle, cmd_spec: CommandSpec) -> Result<ExecResult, DriverError> {
    // Creates NEW spec instead of using the one from spawn()!
    let spawn_spec = SpawnSpec {
        env: EnvironmentSpec {
            spec_type: EnvSpecType::Oci,
            image: "process-default".to_string(),  // WRONG!
            // ...
        },
        // ...
    };
    // ...
}
```

**Fix Required:**
Store the EnvironmentSpec in the ExecutionHandle or a registry:
```rust
pub struct ExecutionHandle {
    pub id: ExecutionId,
    pub tenant: Tenant,
    pub driver_info: HashMap<String, String>,
    // ADD THIS:
    pub env_spec: EnvironmentSpec,
}

async fn exec(&self, handle: &ExecutionHandle, cmd_spec: CommandSpec) -> Result<ExecResult, DriverError> {
    // Use the stored spec
    let spawn_spec = SpawnSpec {
        env: handle.env_spec.clone(),  // CORRECT!
        // ...
    };
    // ...
}
```

---

### Gap #3: Shell UI Doesn't Pass Environment to Backend
**Location:** `cmd/shell-ui/src/invoke.tsx`

**Problem:** The EnvironmentSelector allows users to select an environment, but this configuration is NOT sent to the backend when executing tasks.

**Current Flow:**
1. User selects environment in EnvironmentSelector ✓
2. Environment is stored in RuntimeSettingsPanel state ✓
3. User runs a task
4. Task runs WITHOUT environment configuration ✗

**Fix Required:**
Need to either:
1. Store environment in global state (Zustand store)
2. Pass environment with each execution request
3. Add environment parameter to the execute/task API calls

**Code Changes Needed:**
```typescript
// In invoke.tsx or task execution:
const handleExecute = async () => {
  const environment = useRuntimeStore.getState().environment;
  
  await fetch('/api/v1/execute', {
    method: 'POST',
    body: JSON.stringify({
      command: userCommand,
      environment: environment.resolved?.image,  // ADD THIS
    }),
  });
};
```

---

## 🟡 Medium Priority Gaps

### Gap #4: Environment Templates Not Used in UI
**Location:** `cmd/shell-ui/src/components/EnvironmentSelector.tsx`

**Problem:** The `/api/v1/environment/templates` endpoint exists and returns templates, but the UI doesn't:
- Show template suggestions
- Allow quick-select from templates
- Display template descriptions

**Fix Required:**
Add template loading to EnvironmentSelector:
```typescript
const [templates, setTemplates] = useState<EnvironmentTemplate[]>([]);

useEffect(() => {
  listEnvironmentTemplates().then(setTemplates);
}, []);

// In render:
<div className="template-grid">
  {templates.map(t => (
    <button key={t.id} onClick={() => selectTemplate(t)}>
      {t.name}
    </button>
  ))}
</div>
```

---

### Gap #5: No Environment Persistence
**Location:** `cmd/shell-ui/src/components/RuntimeSettingsPanel.tsx`

**Problem:** The selected environment is stored in component state but:
- Not persisted to localStorage
- Not saved to backend user preferences
- Lost on page refresh

**Fix Required:**
Add persistence:
```typescript
// Load on mount
useEffect(() => {
  const saved = localStorage.getItem('allternit.environment');
  if (saved) {
    setEnvironment(JSON.parse(saved));
  }
}, []);

// Save on change
useEffect(() => {
  localStorage.setItem('allternit.environment', JSON.stringify(environment));
}, [environment]);
```

---

### Gap #6: Environment Not Applied to Execution
**Location:** API execution routes

**Problem:** Even if environment is sent from UI, the execution endpoints don't:
- Accept environment parameter
- Pass environment to driver spawn()
- Apply environment mounts/env_vars

**Fix Required:**
Update execution routes to accept and use environment:
```rust
#[derive(Deserialize)]
struct ExecuteRequest {
    command: String,
    environment: Option<String>,  // ADD THIS
}

async fn execute(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ExecuteRequest>,
) -> Result<Json<ExecuteResponse>, StatusCode> {
    // Resolve environment if provided
    let env_spec = if let Some(env_source) = request.environment {
        state.environment_loader.load(&env_source).await
            .map_err(|_| StatusCode::BAD_REQUEST)?
    } else {
        EnvironmentSpec::default()
    };
    
    // Pass to driver
    let handle = state.driver_registry
        .spawn(SpawnSpec { env: env_spec, ... })
        .await?;
    // ...
}
```

---

## 🟢 Low Priority Gaps

### Gap #7: Missing Registry Authentication
**Location:** `domains/kernel/infrastructure/allternit-environment-spec/src/resolver/oci.rs`

**Problem:** The OCI resolver doesn't support authentication for private registries (Docker Hub, GHCR, ECR, etc.).

**Impact:** Can only pull public images

**Fix:** Add auth config support to OciResolver

---

### Gap #8: No Image Pre-pulling
**Location:** `allternit-environment-spec` crate

**Problem:** Images are pulled on first request, causing delays.

**Fix:** Add background pre-pulling for common images

---

### Gap #9: Limited Rootfs Builder Testing
**Location:** `allternit-environment-spec/src/converter/rootfs.rs`

**Problem:** Rootfs building requires external tools (skopeo/crane/mkfs.ext4) that may not be available.

**Impact:** Conversion endpoints will fail if tools missing

**Fix:** Add tool detection and fallback mechanisms

---

## 📋 Action Plan (Priority Order)

### Phase 1: Critical (Do First)
1. [ ] Add `environment_loader` to AppState
2. [ ] Fix ProcessDriver to store/retrieve EnvironmentSpec
3. [ ] Wire environment from Shell UI to API calls

### Phase 2: Important (Do Next)
4. [ ] Add templates UI to EnvironmentSelector
5. [ ] Add environment persistence (localStorage)
6. [ ] Update execution routes to accept environment

### Phase 3: Nice to Have
7. [ ] Add registry authentication
8. [ ] Add image pre-pulling
9. [ ] Improve rootfs builder error handling

---

## 🔧 Quick Wins

### 1. Add EnvironmentLoader to AppState (30 min)
```rust
// In main.rs AppState:
pub environment_loader: Arc<EnvironmentSpecLoader>,

// In main() initialization:
let environment_loader = Arc::new(
    EnvironmentSpecLoader::new()
        .expect("Failed to create environment loader")
);

// In routes:
let spec = state.environment_loader.load(&source).await?;
```

### 2. Fix ProcessDriver exec() (1 hour)
```rust
// Store spec in ExecutionHandle
pub struct ExecutionHandle {
    // ...
    pub env_spec: EnvironmentSpec,
}

// In exec(), use handle.env_spec
```

### 3. Add localStorage persistence (20 min)
```typescript
useEffect(() => {
  const saved = localStorage.getItem('allternit.environment');
  if (saved) setEnvironment(JSON.parse(saved));
}, []);

useEffect(() => {
  localStorage.setItem('allternit.environment', JSON.stringify(environment));
}, [environment]);
```

---

## Summary

The infrastructure is there, but the **wiring is incomplete**. The critical gaps prevent the environment from actually being used during execution. Fix gaps #1-3 first to make the feature functional.

**Estimated time to fix critical gaps:** 2-3 hours
**Estimated time for full integration:** 1-2 days
