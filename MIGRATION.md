# Migration Guide: New Structure (Option D)

> **Date**: February 2026  
> **Scope**: Rust → TypeScript Consolidation  
> **Impact**: 6-ui/, 7-apps/, hooks, types, and services

---

## Overview

The project has undergone a major restructuring to consolidate capabilities from Rust into TypeScript React components. This guide explains what changed and how to migrate your code.

### What Happened

1. **Ported Rust code to TypeScript**: All Rust code from `6-ui/shell-ui/` (~3,883 lines) has been absorbed into TypeScript
2. **Reorganized directories**: Clearer structure with `6-ui/` (UI components) and `7-apps/` (applications)
3. **New services**: Business logic now available as TypeScript services
4. **Updated hooks**: React hooks now use the new services

---

## What Moved

### Before (Old Structure)
```
6-ui/                          # UI layer
├── a2r-platform/              # React components
├── shell-ui/                  # ❌ Rust code (confusing name)
│   └── src/views/
│       ├── browserview/       # 916 lines Rust
│       ├── runtime/           # 793 lines Rust
│       └── workflow/          # 973 lines Rust
└── ...

7-apps/                        # Applications
├── shell-ui/                  # ❌ Web app (same name as Rust!)
├── shell-electron/            # Desktop wrapper
└── ...
```

### After (New Structure)
```
6-ui/                          # UI layer
├── a2r-platform/              # React components + NEW TypeScript services
│   ├── src/services/          # ✅ Ported from Rust
│   │   ├── browserEngine.ts
│   │   ├── budgetCalculator.ts
│   │   ├── poolManager.ts
│   │   └── workflowEngine.ts
│   ├── src/types/             # ✅ Ported from Rust
│   │   ├── browser.ts
│   │   ├── runtime.ts
│   │   └── workflow.ts
│   └── src/hooks/             # ✅ Updated to use services
│       ├── useBudget.ts
│       ├── usePrewarm.ts
│       └── useWorkflow.ts
├── _reference/                # Archived original Rust code
│   └── shell-native-rust/     # For reference only
└── ...

7-apps/                        # Applications (clean separation)
├── shell/                     # Shell product family
│   ├── web/                   # Browser shell (@a2rchitech/shell-ui)
│   ├── desktop/               # Electron wrapper
│   └── terminal/              # TUI
└── ...
```

---

## Import Path Updates

### Services

**Old (didn't exist - you would have used Rust FFI)**
```typescript
// ❌ No direct equivalent - would need Rust FFI
```

**New (TypeScript services)**
```typescript
// ✅ Use the new services directly
import { 
  createBrowserEngine,
  createBudgetCalculator,
  createPoolManager,
  createWorkflowEngine 
} from '@/services';

// Or import individually
import { createBrowserEngine } from '@/services/browserEngine';
```

### Types

**Old**
```typescript
// ❌ Old paths (if you had custom types)
import type { BudgetDashboard } from '6-ui/shell-ui/src/views/runtime/budget.rs';  // Rust!
```

**New**
```typescript
// ✅ New TypeScript types
import type { 
  BudgetDashboard,
  TenantQuota,
  UsageSummary 
} from '@/types';

// Or import by category
import type { BrowserViewConfig } from '@/types/browser';
import type { BudgetDashboard, PoolStatus } from '@/types/runtime';
import type { WorkflowDraft, DesignerNode } from '@/types/workflow';
```

### Hooks

**Old**
```typescript
// ❌ May have used direct fetch or different hook patterns
const { data } = useSWR('/api/budget', fetcher);
```

**New**
```typescript
// ✅ Use the new hooks with built-in services
import { useBudget, usePrewarm, useWorkflow } from '@/hooks';

function MyComponent() {
  const { quotas, stats, calculatePercentages } = useBudget();
  const { pools, createPool, calculateHealth } = usePrewarm();
  const { validateDesign, autoLayout } = useWorkflow();
}
```

---

## Hook Usage Guide

### useBudget

**Purpose**: Budget metering and quota management

```typescript
import { useBudget } from '@/hooks';

function BudgetView() {
  const {
    quotas,           // TenantQuota[] - all quotas
    usage,            // Record<string, UsageSummary> - usage by tenant
    measurements,     // MeasurementEntry[] - recent measurements
    alerts,           // BudgetAlert[] - active alerts
    isLoading,        // boolean
    error,            // Error | null
    refetch,          // () => void - refetch data
    addQuota,         // (quota) => Promise<void> - create new quota
    stats,            // FormattedUsageStats - formatted stats
    calculatePercentages,  // (tenantId) => BudgetPercentages | null
    getTotalUsage,    // () => UsageSummary
    checkQuotaExceeded,    // (tenantId) => AlertLevel | null
    getCriticalAlerts,     // () => BudgetAlert[]
  } = useBudget();

  // Example: Check if quota exceeded
  const alertLevel = checkQuotaExceeded('tenant-123');
  
  return (
    <div>
      <h1>Budget: {stats.total_cpu_hours} CPU hours</h1>
      {getCriticalAlerts().map(alert => (
        <Alert key={alert.timestamp} level={alert.level}>
          {alert.message}
        </Alert>
      ))}
    </div>
  );
}
```

### usePrewarm

**Purpose**: Prewarm pool management

```typescript
import { usePrewarm, PoolHealth } from '@/hooks';

function PoolView() {
  const {
    pools,            // PoolStatus[] - all pools
    activities,       // PoolActivity[] - activity log
    stats,            // PoolStats - global statistics
    selectedPool,     // PoolStatus | undefined
    isLoading,
    error,
    refetch,
    createPool,       // (config) => Promise<void>
    warmupPool,       // (name) => Promise<void>
    deletePool,       // (name) => Promise<void>
    acquireInstance,  // (name) => Promise<string>
    releaseInstance,  // (name, instanceId) => Promise<void>
    selectPool,       // (name) => void
    getPoolsByHealth, // (health) => PoolStatus[]
    calculateHealth,  // (pool) => PoolHealth
  } = usePrewarm();

  // Example: Get only healthy pools
  const healthyPools = getPoolsByHealth(PoolHealth.Healthy);
  
  return (
    <div>
      <h1>Pools: {stats.total_pools}</h1>
      {pools.map(pool => (
        <PoolCard 
          key={pool.name} 
          pool={pool} 
          health={calculateHealth(pool)}
        />
      ))}
    </div>
  );
}
```

### useWorkflow

**Purpose**: Workflow design, validation, and execution

```typescript
import { useWorkflow } from '@/hooks';

function DesignerView() {
  const {
    workflows,        // WorkflowListEntry[] - all workflows
    executions,       // WorkflowExecution[] - active/historical
    isLoading,
    error,
    refetch,
    createWorkflow,   // (workflow) => Promise<void>
    deleteWorkflow,   // (id) => Promise<void>
    executeWorkflow,  // (id) => Promise<string>
    stopExecution,    // (id) => Promise<void>
    validateDesign,   // (nodes, edges) => ValidationResult
    autoLayout,       // (nodes, edges) => Map<string, NodePosition>
    compileWorkflow,  // (draft) => ExecutableWorkflow
    wouldCreateCycle, // (from, to, edges) => boolean
  } = useWorkflow();

  // Example: Validate before adding edge
  const handleAddEdge = (from: string, to: string) => {
    if (wouldCreateCycle(from, to, currentEdges)) {
      alert('Cannot create cycle!');
      return;
    }
    addEdge(from, to);
  };

  // Example: Auto-layout
  const handleAutoLayout = () => {
    const positions = autoLayout(nodes, edges);
    updateNodePositions(positions);
  };
  
  return (
    <WorkflowDesigner 
      onValidate={validateDesign}
      onAutoLayout={handleAutoLayout}
    />
  );
}
```

---

## Using Services Directly

Sometimes you need direct service access outside of React components:

### BrowserEngine

```typescript
import { createBrowserEngine } from '@/services/browserEngine';

// Create engine instance
const engine = createBrowserEngine({
  apiBaseUrl: '/api/v1',
  onStateChange: (state) => console.log('URL:', state.current_url),
  onCapture: (capture) => displayScreenshot(capture.data),
});

// Session management
const sessionId = await engine.createSession({
  viewport: { width: 1920, height: 1080 },
  enable_agent_mode: true,
});

// Navigation
await engine.navigate('https://example.com');
await engine.back();
await engine.forward();
await engine.reload();

// Interactions
await engine.click('#submit-button');
await engine.typeText('#search', 'query');
await engine.scroll(0, 500);
await engine.evaluate('document.title');

// Screenshots
const capture = await engine.screenshot(true); // full page
console.log(capture.data); // base64 image

// Cleanup
await engine.closeSession();
```

### BudgetCalculator

```typescript
import { createBudgetCalculator, calculateBudgetPercentages } from '@/services/budgetCalculator';

const calculator = createBudgetCalculator({
  quotas: [{
    tenant_id: 'tenant-123',
    quota_id: 'quota-1',
    cpu_seconds_limit: 3600,
    memory_mb_seconds_limit: 3600 * 1024,
    network_bytes_limit: 1_073_741_824,
    max_concurrent_workers: 10,
  }],
});

// Add measurements
calculator.addMeasurement({
  measurement_id: 'm-1',
  run_id: 'run-1',
  timestamp: new Date().toISOString(),
  cpu_seconds_delta: 10,
  memory_mb_current: 512,
  network_bytes_sent: 1024,
  network_bytes_received: 2048,
});

// Calculate percentages
const percentages = calculator.calculatePercentages('tenant-123');
console.log(`CPU: ${percentages?.cpu}%`);

// Get formatted stats
const stats = calculator.getStats();
console.log(`${stats.total_cpu_hours} hours used`);

// Check for alerts
const alertLevel = calculator.checkQuotaExceeded('tenant-123');
if (alertLevel === AlertLevel.Critical) {
  sendAlert('Quota exceeded!');
}
```

### PoolManager

```typescript
import { createPoolManager, createDefaultPoolForm } from '@/services/poolManager';

const manager = createPoolManager({
  apiBaseUrl: '/api/v1',
  onPoolUpdate: (pool) => console.log('Pool updated:', pool.name),
  onActivity: (activity) => logActivity(activity),
});

// Create a pool
const pool = await manager.createPool({
  name: 'worker-pool',
  image: 'node:18-alpine',
  pool_size: 5,
  warmup_commands: ['npm install'],
  idle_timeout_seconds: 3600,
  resources: { cpu_millicores: 500, memory_mib: 512, disk_mib: 1024 },
});

// Or use default form
const form = createDefaultPoolForm('my-pool', 'node:18');
form.pool_size = 10;
const pool2 = await manager.createPool(form);

// Manage pool
await manager.warmupPool('worker-pool');
const instanceId = await manager.acquireInstance('worker-pool');
// ... use instance ...
await manager.releaseInstance('worker-pool', instanceId);

// Check health
const health = manager.calculateHealth(pool);
if (health === PoolHealth.Empty) {
  await manager.warmupPool(pool.name);
}

// Get statistics
const stats = manager.getStats();
console.log(`${stats.total_available} instances available`);
```

### WorkflowEngine

```typescript
import { createWorkflowEngine } from '@/services/workflowEngine';

const engine = createWorkflowEngine();

// Define nodes and edges
const nodes: DesignerNode[] = [
  { id: 'start', name: 'Start', node_type: 'trigger', phase: WorkflowPhase.Draft, position: { x: 0, y: 0 }, inputs: [], outputs: ['out'], config: {} },
  { id: 'process', name: 'Process', node_type: 'transform', phase: WorkflowPhase.Draft, position: { x: 200, y: 0 }, inputs: ['in'], outputs: ['out'], config: { operation: 'uppercase' } },
  { id: 'end', name: 'End', node_type: 'sink', phase: WorkflowPhase.Draft, position: { x: 400, y: 0 }, inputs: ['in'], outputs: [], config: {} },
];

const edges: DesignerEdge[] = [
  { id: 'e1', from: 'start', to: 'process' },
  { id: 'e2', from: 'process', to: 'end' },
];

// Validate
const validation = engine.validateWorkflow(nodes, edges);
if (!validation.valid) {
  console.error('Errors:', validation.errors);
  console.warn('Warnings:', validation.warnings);
}

// Check for cycles before adding edge
if (engine.wouldCreateCycle('end', 'start', edges)) {
  throw new Error('Cannot create cycle!');
}

// Auto-layout
const positions = engine.autoLayout(nodes, edges, {
  direction: 'horizontal',
  nodeWidth: 200,
  nodeHeight: 100,
  spacing: 50,
});
// positions.get('start') => { x: 0, y: -100 }

// Compile to executable
const draft: WorkflowDraft = {
  workflow_id: 'wf-123',
  version: '1.0.0',
  description: 'Sample workflow',
  nodes,
  edges,
};

const executable = engine.compileToExecutable(draft);
console.log('Entry point:', executable.entry_point);
```

---

## Type Exports

All types are now available from a central location:

```typescript
// Import all types
import type {
  // Browser types
  BrowserViewConfig,
  BrowserState,
  BrowserAction,
  RendererType,
  CaptureResult,
  
  // Runtime types
  BudgetDashboard,
  TenantQuota,
  UsageSummary,
  PoolStatus,
  PoolHealth,
  ActivityType,
  ReplayEntry,
  
  // Workflow types
  WorkflowDraft,
  DesignerNode,
  DesignerEdge,
  WorkflowExecution,
  ExecutionStatus,
  ValidationError,
} from '@/types';
```

---

## Removed/Renamed Paths

| Old Path | New Path | Status |
|----------|----------|--------|
| `6-ui/shell-ui/` | `6-ui/_reference/shell-native-rust/` | Archived |
| `6-ui/shell-ui/src/views/browserview/` | `6-ui/a2r-platform/src/services/browserEngine.ts` | Ported |
| `6-ui/shell-ui/src/views/runtime/budget.rs` | `6-ui/a2r-platform/src/services/budgetCalculator.ts` | Ported |
| `6-ui/shell-ui/src/views/runtime/prewarm.rs` | `6-ui/a2r-platform/src/services/poolManager.ts` | Ported |
| `6-ui/shell-ui/src/views/workflow/designer.rs` | `6-ui/a2r-platform/src/services/workflowEngine.ts` | Ported |
| `7-apps/shell-ui/` | `7-apps/shell/web/` | Renamed |
| `7-apps/shell-electron/` | `7-apps/shell/desktop/` | Renamed |
| `7-apps/tui/a2r-tui/` | `7-apps/shell/terminal/` | Renamed |

---

## Troubleshooting

### Import errors after migration

**Problem**: `Module not found: Can't resolve '@/services/...'`

**Solution**: Check your `tsconfig.json` paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Type errors with hooks

**Problem**: `Property 'calculatePercentages' does not exist on type...`

**Solution**: Make sure you're importing from the correct location:
```typescript
// ✅ Correct
import { useBudget } from '@/hooks';

// ❌ Incorrect (if you had a custom hook)
import { useBudget } from './custom-hooks/useBudget';
```

### Services not found

**Problem**: Cannot find module `@/services`

**Solution**: Check that `src/services/index.ts` exports the service:
```typescript
export * from './browserEngine';
export * from './budgetCalculator';
export * from './poolManager';
export * from './workflowEngine';
```

---

## Summary

✅ **What's New**:
- TypeScript services with same capabilities as original Rust
- React hooks that integrate services with UI state
- Centralized type definitions
- Clear directory separation (6-ui/ vs 7-apps/)

✅ **What Stayed the Same**:
- API endpoints unchanged
- Database schemas unchanged
- Business logic behavior unchanged
- React component structure mostly unchanged

✅ **What's Archived**:
- Original Rust code in `6-ui/_reference/shell-native-rust/`
- Available for reference but not used in build

---

## Need Help?

- See [docs/SERVICES.md](./docs/SERVICES.md) for detailed service documentation
- Check [CONSOLIDATION_COMPLETE.md](./CONSOLIDATION_COMPLETE.md) for the consolidation summary
- Review hook implementations in `6-ui/a2r-platform/src/hooks/`
