# Plan to Actually Finish the DAG Implementation

**Date:** 2026-02-23  
**Objective:** Complete N3-N5, N12, N14, N16 with full end-to-end integration

---

## Current State Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  RUST BACKEND                    ✅ Ready (60%)                 │
│  ├── allternit-driver-interface        ✅ Complete                    │
│  ├── allternit-process-driver          ✅ Complete                    │
│  ├── allternit-replay                  ✅ Complete                    │
│  ├── allternit-versioning              ✅ Complete                    │
│  └── allternit-prewarm                 ✅ Complete                    │
├─────────────────────────────────────────────────────────────────┤
│  REST API                        ❌ Missing (5%)                │
│  ├── runtime_routes.rs           ❌ Not created                 │
│  ├── replay_routes.rs            ❌ Not created                 │
│  ├── prewarm_routes.rs           ❌ Not created                 │
│  └── version_routes.rs           ❌ Not created                 │
├─────────────────────────────────────────────────────────────────┤
│  TYPESCRIPT SERVICES             ❌ Missing (10%)               │
│  ├── runtimeService.ts           ❌ Not created                 │
│  ├── replayService.ts            ❌ Not created                 │
│  └── prewarmService.ts           ❌ Not created                 │
├─────────────────────────────────────────────────────────────────┤
│  ELECTRON SHELL UI               ❌ Wrong location (0%)         │
│  ├── UI in allternit-platform          ✅ Visual only                 │
│  ├── UI in cmd/shell-ui       ❌ Not created                 │
│  └── Settings integration        ❌ Not started                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: REST API Routes (4-6 hours)

### 1.1 Runtime Routes

**File:** `cmd/api/src/runtime_routes.rs` (NEW)

```rust
// GET /api/v1/runtime/config - Get current runtime configuration
// POST /api/v1/runtime/config - Update runtime configuration
// GET /api/v1/runtime/drivers - List available drivers
// GET /api/v1/runtime/drivers/{type}/health - Check driver health
// POST /api/v1/runtime/executions - Spawn new execution
// GET /api/v1/runtime/executions/{id} - Get execution status
// DELETE /api/v1/runtime/executions/{id} - Destroy execution
```

**Integration:**
- Add to `cmd/api/src/main.rs` router
- Use `allternit_driver_interface` and `allternit_process_driver`

### 1.2 Replay Routes

**File:** `cmd/api/src/replay_routes.rs` (NEW)

```rust
// GET /api/v1/replay/settings - Get replay capture settings
// POST /api/v1/replay/settings - Update replay settings
// GET /api/v1/replay/manifests - List captured manifests
// GET /api/v1/replay/manifests/{run_id} - Get specific manifest
// POST /api/v1/replay/manifests/{run_id}/replay - Replay execution
```

### 1.3 Prewarm Routes

**File:** `cmd/api/src/prewarm_routes.rs` (NEW)

```rust
// GET /api/v1/prewarm/pools - List all pools
// POST /api/v1/prewarm/pools - Create new pool
// GET /api/v1/prewarm/pools/{name} - Get pool status
// DELETE /api/v1/prewarm/pools/{name} - Delete pool
// POST /api/v1/prewarm/pools/{name}/warmup - Warm up pool
// POST /api/v1/prewarm/pools/{name}/cleanup - Cleanup idle instances
```

### 1.4 Update Main Router

**File:** `cmd/api/src/main.rs` (MODIFY)

Add the new route modules to the Axum router.

---

## Phase 2: TypeScript Services (3-4 hours)

### 2.1 Runtime Service

**File:** `surfaces/allternit-platform/src/capsules/browser/runtimeService.ts` (NEW)

**Interface:**
```typescript
export interface RuntimeDriverConfig {
  driverType: 'process' | 'container' | 'microvm';
  isolationLevel: 'limited' | 'standard' | 'hardened' | 'maximum';
  resources: ResourceSpec;
  enablePrewarm: boolean;
}

export class RuntimeService {
  async getConfig(): Promise<RuntimeDriverConfig>;
  async setConfig(config: RuntimeDriverConfig): Promise<void>;
  async getAvailableDrivers(): Promise<DriverCapabilities[]>;
  async getDriverHealth(driverType: string): Promise<DriverHealth>;
}
```

### 2.2 Replay Service

**File:** `surfaces/allternit-platform/src/capsules/browser/replayService.ts` (NEW)

```typescript
export interface ReplaySettings {
  captureLevel: 'none' | 'minimal' | 'full';
}

export class ReplayService {
  async getSettings(): Promise<ReplaySettings>;
  async setSettings(settings: ReplaySettings): Promise<void>;
  async getManifests(): Promise<ReplayManifest[]>;
}
```

### 2.3 Prewarm Service

**File:** `surfaces/allternit-platform/src/capsules/browser/prewarmService.ts` (NEW)

```typescript
export class PrewarmService {
  async getPools(): Promise<PoolStatus[]>;
  async createPool(config: PoolConfig): Promise<void>;
  async deletePool(name: string): Promise<void>;
  async warmupPool(name: string): Promise<void>;
}
```

---

## Phase 3: Electron Shell UI Decision (1 hour)

### Decision Point: Where Do Settings Go?

**Option A: Extend invoke.tsx**
- Add a settings panel to the existing invoke UI
- Pros: Single interface, familiar to users
- Cons: May clutter the invoke panel

**Option B: Create settings.tsx**
- New dedicated settings component
- Pros: Clean separation, room for all settings
- Cons: Need to integrate into main flow

**Option C: Use allternit-platform ControlCenter**
- Import and embed the existing ControlCenter
- Pros: Reuse existing work
- Cons: May require build configuration changes

**Recommendation:** Option A for MVP (quick), Option B for production (proper).

### 3.1 If Option A (Extend invoke.tsx)

**File:** `cmd/shell-ui/src/invoke.tsx` (MODIFY)

Add:
```typescript
// State for runtime settings
const [runtimeConfig, setRuntimeConfig] = useState<RuntimeDriverConfig>();
const [showSettings, setShowSettings] = useState(false);

// Fetch config on mount
useEffect(() => {
  runtimeService.getConfig().then(setRuntimeConfig);
}, []);

// Settings panel component
function SettingsPanel() {
  // Driver selection, resource sliders, etc.
}
```

### 3.2 If Option B (New settings.tsx)

**File:** `cmd/shell-ui/src/settings.tsx` (NEW)

Create a full settings component with:
- Driver selection
- Resource limits
- Replay settings
- Prewarm pools
- Version info

**File:** `cmd/shell-ui/src/main.tsx` (MODIFY)

Integrate settings into the main app flow.

---

## Phase 4: Wire UI to Services (2-3 hours)

### 4.1 Replace Local State with Service Calls

**Current (UI only):**
```typescript
const [driverType, setDriverType] = useState('process');
```

**Needed (Connected):**
```typescript
const [config, setConfig] = useState<RuntimeDriverConfig>();

useEffect(() => {
  runtimeService.getConfig().then(setConfig);
}, []);

const handleDriverChange = async (type: DriverType) => {
  const newConfig = { ...config, driverType: type };
  await runtimeService.setConfig(newConfig);
  setConfig(newConfig);
};
```

### 4.2 Add Loading States

```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### 4.3 Add Error Handling

```typescript
try {
  await runtimeService.setConfig(newConfig);
} catch (err) {
  setError(err.message);
}
```

---

## Phase 5: N5 Environment Definition (6-8 hours)

### 5.1 Devcontainer Parser

**File:** `domains/kernel/execution/environment-standardization/src/devcontainer.rs` (NEW)

Parse `devcontainer.json` and convert to `EnvironmentSpec`.

### 5.2 Nix Parser

**File:** `domains/kernel/execution/environment-standardization/src/nix.rs` (NEW)

Parse `flake.nix` and convert to `EnvironmentSpec`.

### 5.3 Environment Normalizer

**File:** `domains/kernel/execution/environment-standardization/src/normalizer.rs` (NEW)

Normalize different environment specs to common `EnvironmentSpec`.

---

## Phase 6: End-to-End Testing (2-3 hours)

### 6.1 Test Scenarios

1. **Driver Selection**
   - Change driver in UI
   - Verify config persists after reload
   - Verify driver is actually used

2. **Resource Limits**
   - Set CPU/Memory limits
   - Spawn execution
   - Verify limits are enforced

3. **Replay Capture**
   - Enable replay
   - Run execution
   - Verify manifest is created
   - Verify replay works

4. **Prewarm Pools**
   - Create pool
   - Verify instances are warmed
   - Acquire from pool
   - Verify faster startup

### 6.2 Integration Tests

```bash
# Test API
curl http://localhost:3000/api/v1/runtime/config

# Test execution
curl -X POST http://localhost:3000/api/v1/runtime/executions \
  -d '{"driver_type": "process", ...}'
```

---

## Task Breakdown for Reporting

### Completed ✅
- N1: Repo Alignment Audit (document)
- N2: Target Architecture Spec (document)
- N3: Driver Interface Rust trait
- N4: Process Driver Rust implementation
- N12: Replay Service Rust crate
- N14: Versioning Rust crate
- N16: Prewarm Service Rust crate
- Visual UI components (in wrong location)

### In Progress 🚧
- None currently

### Not Started ❌
- REST API routes (runtime, replay, prewarm)
- TypeScript services (runtime, replay, prewarm)
- Electron shell-ui integration
- UI-to-service wiring
- N5: Environment Definition
- End-to-end testing

---

## Honest Completion Percentages

| Component | Real % | Claimed % |
|-----------|--------|-----------|
| Rust Backend | 60% | 100% |
| REST API | 0% | N/A |
| TypeScript Services | 0% | N/A |
| Web UI (allternit-platform) | 30% | 90% |
| Electron Shell UI | 0% | N/A |
| Integration | 0% | N/A |
| **OVERALL** | **15%** | **70%** |

---

## Next Immediate Steps

1. **Choose Electron UI approach** (A, B, or C)
2. **Create REST API routes** (start with runtime_routes.rs)
3. **Create TypeScript service** (start with runtimeService.ts)
4. **Wire one component end-to-end** (driver selection)
5. **Verify it works** (test, debug, fix)
6. **Repeat for remaining components**

---

## Time Estimate to Complete

| Phase | Time | Cumulative |
|-------|------|------------|
| Phase 1: REST API | 4-6 hrs | 4-6 hrs |
| Phase 2: TypeScript Services | 3-4 hrs | 7-10 hrs |
| Phase 3: UI Decision + Setup | 1 hr | 8-11 hrs |
| Phase 4: UI Wiring | 2-3 hrs | 10-14 hrs |
| Phase 5: N5 Environment | 6-8 hrs | 16-22 hrs |
| Phase 6: Testing | 2-3 hrs | 18-25 hrs |

**Total: 18-25 hours of focused work**

---

**Recommendation:** 
1. Pick ONE component (driver selection) and finish it end-to-end first
2. Then replicate the pattern for other components
3. Don't claim completion until settings actually persist and affect execution

---
