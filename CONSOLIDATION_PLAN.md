# Consolidation Plan: Absorb Rust into React

## Strategy: Port Capabilities, Not Bridge

Instead of keeping Rust separate with FFI, we **port the Rust capabilities INTO the React codebase**.

## Phase 1: Extract Types from Rust → TypeScript

### 1.1 BrowserView Types
**From:** `6-ui/shell-ui/src/views/browserview/src/lib.rs`
**To:** `6-ui/a2r-platform/src/types/browser.ts` (NEW FILE)

```typescript
// Types to extract:
interface BrowserViewConfig {
  initial_url?: string;
  enable_javascript: boolean;
  enable_cookies: boolean;
  user_agent?: string;
  proxy?: ProxyConfig;
  viewport: ViewportSize;
  enable_adblock: boolean;
  enable_agent_mode: boolean;
}

interface BrowserState {
  current_url: string;
  title: string;
  loading: boolean;
  history: HistoryEntry[];
  history_index: number;
  session_id: string;
  agent_mode_active: boolean;
}

enum RendererType {
  Human = 'human',
  Agent = 'agent'
}

type BrowserAction = 
  | { action: 'navigate'; url: string; renderer: RendererType }
  | { action: 'back' }
  | { action: 'forward' }
  | { action: 'screenshot'; full_page: boolean }
  | { action: 'extract'; selector: string }
  | { action: 'click'; selector: string }
  | { action: 'type_text'; selector: string; text: string }
  | { action: 'evaluate'; script: string };
```

### 1.2 Runtime Types  
**From:** `6-ui/shell-ui/src/views/runtime/*.rs`
**To:** `6-ui/a2r-platform/src/types/runtime.ts` (EXTEND EXISTING)

Current React has basic types. Add from Rust:
- `PoolHealth` enum (Healthy, Degraded, Empty, Error)
- `ActivityType` enum (InstanceAcquired, Released, etc.)
- `PoolResources` struct (cpu_millicores, memory_mib, disk_mib)
- Richer `MeasurementEntry` with deltas

### 1.3 Workflow Types
**From:** `6-ui/shell-ui/src/views/workflow/*.rs`
**To:** `6-ui/a2r-platform/src/types/workflow.ts` (EXTEND EXISTING)

Add from Rust:
- `DesignerNode` with phase, inputs, outputs
- `DesignerEdge` with condition
- `NodeTypeDefinition` with category, icon, ports
- `NodeCategory` enum
- `PortDefinition` for typed inputs/outputs

## Phase 2: Port Business Logic

### 2.1 BrowserView Engine
**Current React:** Placeholder that shows "Rust engine exists"
**Action:** Create real implementation using Playwright via API

```typescript
// NEW: 6-ui/a2r-platform/src/services/browserEngine.ts
export class BrowserEngine {
  private sessionId: string;
  private webdriverUrl: string;
  
  async navigate(url: string, renderer: RendererType): Promise<void> {
    // Call backend API that runs Playwright
    await api.browser.navigate({ url, renderer, sessionId: this.sessionId });
  }
  
  async screenshot(fullPage: boolean): Promise<string> {
    // Returns base64 image
    return api.browser.screenshot({ sessionId: this.sessionId, fullPage });
  }
  
  async extract(selector: string): Promise<any> {
    return api.browser.extract({ sessionId: this.sessionId, selector });
  }
  
  async execute(action: BrowserAction): Promise<BrowserActionResult> {
    // Universal action executor
  }
}
```

### 2.2 Prewarm Pool Logic
**Current React:** UI only, no pool management logic
**Action:** Add pool lifecycle management

```typescript
// NEW: 6-ui/a2r-platform/src/services/poolManager.ts
export class PoolManager {
  calculateHealth(pool: PoolStatus): PoolHealth {
    if (pool.available_count === 0) return PoolHealth.Empty;
    const ratio = pool.available_count / pool.pool_size;
    if (ratio < 0.2) return PoolHealth.Degraded;
    return PoolHealth.Healthy;
  }
  
  async createPool(form: PoolCreateForm): Promise<void> {
    // Call runtime API
  }
  
  async warmupPool(poolName: string): Promise<void> {
    // Trigger manual warmup
  }
  
  getStats(pools: PoolStatus[]): PoolStats {
    // Aggregate stats from Rust logic
  }
}
```

### 2.3 Budget Calculation
**Current React:** Displays data from hooks
**Action:** Add client-side calculations from Rust

```typescript
// EXTEND: 6-ui/a2r-platform/src/hooks/useBudget.ts
export function useBudget() {
  const { quotas, usage } = useBudgetData(); // existing
  
  // Add from Rust budget.rs:
  const calculatePercentages = (quota, usage) => ({...});
  const getStats = (usage) => ({...}); // CPU hours, GB-h, etc.
  const cpuUsagePercent = (tenantId) => {...};
  
  return { quotas, usage, calculatePercentages, getStats, cpuUsagePercent };
}
```

### 2.4 Workflow Designer Engine
**Current React:** Uses React Flow for visual editing
**Action:** Add validation and DAG logic from Rust

```typescript
// NEW: 6-ui/a2r-platform/src/services/workflowEngine.ts
export class WorkflowDesignerEngine {
  validateWorkflow(nodes: DesignerNode[], edges: DesignerEdge[]): ValidationError[] {
    // Port from Rust designer.rs:
    // - Check for cycles
    // - Validate port connections
    // - Check required inputs
  }
  
  autoLayout(nodes: DesignerNode[], edges: DesignerEdge[]): NodePosition[] {
    // DAG layout algorithm
  }
  
  compileToExecutable(draft: WorkflowDraft): ExecutableWorkflow {
    // Convert designer state to runtime format
  }
}
```

## Phase 3: Backend API for Native Capabilities

Some things REQUIRE native code (Playwright). Create a lightweight sidecar:

### 3.1 Create Browser Service
```rust
// NEW: 8-cloud/a2r-node/src/services/browser_service.rs
// Lightweight HTTP service wrapping the browserview code
#[post("/browser/session")]
async fn create_session(config: BrowserViewConfig) -> SessionId

#[post("/browser/{session}/navigate")]
async fn navigate(session: Path<String>, body: NavigateRequest)

#[post("/browser/{session}/screenshot")]
async fn screenshot(session: Path<String>, full_page: bool) -> Base64Image
```

### 3.2 React Calls the Service
```typescript
// BrowserEngine calls this API instead of using FFI
const response = await fetch('/api/browser/session', {
  method: 'POST',
  body: JSON.stringify(config)
});
```

## Phase 4: Move Files, Remove Rust

### 4.1 Move OpenClawControlUI.tsx
```
FROM: 6-ui/shell-ui/src/views/openclaw/OpenClawControlUI.tsx
TO:   6-ui/a2r-platform/src/views/openclaw/OpenClawControlUI.tsx
```

### 4.2 Update Imports
```typescript
// In views that reference it
import { OpenClawControlUI } from '@/views/openclaw/OpenClawControlUI';
```

### 4.3 Remove Rust Directory
```bash
rm -rf 6-ui/shell-ui/
# Or move to archive:
mkdir -p 6-ui/_reference
mv 6-ui/shell-ui 6-ui/_reference/shell-native-rust
```

### 4.4 Update Workspace
```toml
# Cargo.toml - remove this entry
"6-ui/shell-ui/src/views/browserview",
```

## Phase 5: Consolidate Naming

### 5.1 Rename 6-ui → ui-core
```
6-ui/a2r-platform/ → ui-core/platform/
```

### 5.2 Rename 7-apps/shell-ui → apps/shell-web
```
7-apps/shell-ui/ → apps/shell/web/
7-apps/shell-electron/ → apps/shell/desktop/
7-apps/tui/a2r-tui/ → apps/shell/terminal/
```

### 5.3 Final Structure
```
apps/
└── shell/
    ├── core/                 # (was 6-ui/a2r-platform)
    ├── web/                  # (was 7-apps/shell-ui)
    ├── desktop/              # (was 7-apps/shell-electron)
    └── terminal/             # (was 7-apps/tui/a2r-tui)
```

## Implementation Order

1. **Extract types** - Create TypeScript interfaces from Rust (low risk)
2. **Port business logic** - Move calculations to React services
3. **Create browser API** - If Playwright is needed
4. **Move OpenClawControlUI** - Fix the misplaced file
5. **Test everything** - Ensure no regressions
6. **Remove Rust** - Only after everything works
7. **Rename directories** - Final cleanup

## What Gets Ported vs Deleted

| Rust Component | Port to React? | How |
|----------------|----------------|-----|
| **Types** (structs, enums) | ✅ YES | Convert to TypeScript interfaces |
| **Business Logic** (calculations) | ✅ YES | Port to service classes |
| **Playwright** (browser automation) | ⚠️ PARTIAL | Keep as HTTP API service |
| **WASM-related** | ❌ NO | Delete - not using WASM |
| **Tests** | ✅ YES | Port to Vitest |

## Benefits of This Approach

1. **Single codebase** - TypeScript only, no Rust/JS bridge complexity
2. **Types are shared** - React components use same types as logic
3. **Easier maintenance** - One language, one build system
4. **Keep native capabilities** - Playwright still available via API
5. **Clear structure** - Shell product is consolidated under `apps/shell/`
