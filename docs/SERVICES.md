# Service Documentation

> **A2rchitect UI Services**  
> Business logic services ported from Rust to TypeScript  
> Location: `6-ui/a2r-platform/src/services/`

---

## Overview

The UI layer provides four core services for browser automation, budget management, pool management, and workflow orchestration. These services were ported from the original Rust implementation in `6-ui/shell-ui/` to TypeScript for seamless React integration.

| Service | Purpose | Lines of Code | Ported From |
|---------|---------|---------------|-------------|
| **BrowserEngine** | Browser automation via Playwright API | ~300 | `browserview/*.rs` |
| **BudgetCalculator** | Budget metering and quota calculations | ~250 | `runtime/budget.rs` |
| **PoolManager** | Prewarm pool lifecycle management | ~350 | `runtime/prewarm.rs` |
| **WorkflowEngine** | Workflow validation, layout, compilation | ~450 | `workflow/designer.rs` |

---

## BrowserEngine

Browser automation service for controlling headless browsers via backend API.

### Location
`6-ui/a2r-platform/src/services/browserEngine.ts`

### Types
`6-ui/a2r-platform/src/types/browser.ts`

### Class: BrowserEngine

```typescript
class BrowserEngine {
  constructor(options: BrowserEngineOptions)
  
  // Session Management
  createSession(config?: Partial<BrowserViewConfig>): Promise<string>
  closeSession(): Promise<void>
  getSessionId(): string | null
  isActive(): boolean
  
  // Navigation
  navigate(url: string, renderer?: RendererType): Promise<void>
  back(): Promise<void>
  forward(): Promise<void>
  reload(): Promise<void>
  stop(): Promise<void>
  
  // Interactions
  click(selector: string): Promise<void>
  typeText(selector: string, text: string): Promise<void>
  scroll(x: number, y: number): Promise<void>
  waitFor(selector: string, timeoutMs?: number): Promise<void>
  evaluate(script: string): Promise<unknown>
  extract(selector: string): Promise<unknown>
  
  // Capture
  screenshot(fullPage?: boolean): Promise<CaptureResult>
  
  // State
  getState(): BrowserState
  getHistory(): HistoryEntry[]
  setAgentMode(active: boolean): Promise<void>
  
  // Receipts
  createReceipt(action: string, metadata?: Record<string, unknown>): Promise<string>
}
```

### Usage Example

```typescript
import { createBrowserEngine, RendererType } from '@/services/browserEngine';

// Create engine
const engine = createBrowserEngine({
  apiBaseUrl: '/api/v1',
  onStateChange: (state) => {
    console.log('Current URL:', state.current_url);
    console.log('Loading:', state.loading);
  },
  onCapture: (capture) => {
    displayImage(capture.data); // base64 image
  },
});

// Create session
const sessionId = await engine.createSession({
  initial_url: 'https://example.com',
  viewport: { width: 1920, height: 1080 },
  enable_agent_mode: true,
});

// Navigate
await engine.navigate('https://example.com/search');

// Interact
await engine.typeText('#search-input', 'A2rchitect platform');
await engine.click('#search-button');
await engine.waitFor('.results', 30000);

// Extract data
const results = await engine.extract('.result-item');

// Take screenshot
const capture = await engine.screenshot(true); // full page
console.log(`Screenshot: ${capture.width}x${capture.height}`);

// Cleanup
await engine.closeSession();
```

### Types Reference

```typescript
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
  last_capture?: CaptureResult;
}

interface CaptureResult {
  data: string;          // Base64-encoded image
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  timestamp: string;
  url: string;
}

enum RendererType {
  Human = 'human',
  Agent = 'agent',
}
```

---

## BudgetCalculator

Budget metering and quota management service.

### Location
`6-ui/a2r-platform/src/services/budgetCalculator.ts`

### Types
`6-ui/a2r-platform/src/types/runtime.ts`

### Class: BudgetCalculator

```typescript
class BudgetCalculator {
  constructor(dashboard?: Partial<BudgetDashboard>)
  
  // Data Management
  addQuota(quota: TenantQuota): void
  updateUsage(usage: UsageSummary): void
  addMeasurement(measurement: MeasurementEntry): void
  addAlert(alert: BudgetAlert): void
  
  // Calculations
  cpuUsagePercent(tenantId: string): number | null
  memoryUsagePercent(tenantId: string): number | null
  calculatePercentages(tenantId: string, usage: UsageSummary): BudgetPercentages | null
  
  // Statistics
  getStats(): FormattedUsageStats
  getTotalUsage(): UsageSummary
  
  // Alerts
  checkQuotaExceeded(tenantId: string): AlertLevel | null
  getAlertsForTenant(tenantId: string): BudgetAlert[]
  getCriticalAlerts(): BudgetAlert[]
  
  // Creation
  createQuotaFromForm(form: QuotaForm): TenantQuota
  
  // Accessors
  getDashboard(): BudgetDashboard
  getQuotas(): TenantQuota[]
  getRecentMeasurements(): MeasurementEntry[]
}
```

### Usage Example

```typescript
import { createBudgetCalculator, calculateBudgetPercentages } from '@/services/budgetCalculator';
import { AlertLevel } from '@/types/runtime';

// Create calculator
const calculator = createBudgetCalculator({
  quotas: [
    {
      tenant_id: 'tenant-123',
      quota_id: 'quota-1',
      cpu_seconds_limit: 3600,
      memory_mb_seconds_limit: 3600 * 1024,
      network_bytes_limit: 1_073_741_824,
      max_concurrent_workers: 10,
    },
  ],
});

// Update usage
calculator.updateUsage({
  total_cpu_seconds_used: 1800,
  total_memory_mb_seconds_used: 1800 * 512,
  total_network_bytes_used: 536_870_912,
  current_active_workers: 5,
  peak_workers: 8,
});

// Add measurement
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
const percentages = calculator.calculatePercentages('tenant-123', usage);
console.log(`CPU: ${percentages?.cpu.toFixed(1)}%`);
console.log(`Memory: ${percentages?.memory.toFixed(1)}%`);

// Get formatted stats
const stats = calculator.getStats();
console.log(`Total CPU: ${stats.total_cpu_hours} hours`);
console.log(`Total Memory: ${stats.total_memory_gb_hours} GB-hours`);
console.log(`Network: ${stats.network_gb} GB`);
console.log(`Active Workers: ${stats.active_workers}`);

// Check for alerts
const alertLevel = calculator.checkQuotaExceeded('tenant-123');
if (alertLevel === AlertLevel.Critical) {
  sendCriticalAlert('Quota exceeded!');
} else if (alertLevel === AlertLevel.Warning) {
  sendWarningAlert('Approaching quota limit');
}

// Get critical alerts
const criticalAlerts = calculator.getCriticalAlerts();
criticalAlerts.forEach(alert => {
  console.error(`[${alert.level}] ${alert.message}`);
});
```

### Utility Functions

```typescript
// Calculate percentages helper
const percentages = calculateBudgetPercentages(quota, usage);

// Format bytes
import { formatBytes } from '@/services/budgetCalculator';
console.log(formatBytes(1_073_741_824)); // "1.00 GB"

// Format hours
import { formatHours } from '@/services/budgetCalculator';
console.log(formatHours(3600)); // "1.00"
```

### Types Reference

```typescript
interface BudgetDashboard {
  quotas: TenantQuota[];
  usage_summary: UsageSummary;
  recent_measurements: MeasurementEntry[];
  alerts: BudgetAlert[];
}

interface TenantQuota {
  tenant_id: string;
  quota_id: string;
  cpu_seconds_limit: number;
  memory_mb_seconds_limit: number;
  network_bytes_limit: number;
  max_concurrent_workers: number;
  valid_until?: string;
}

interface UsageSummary {
  total_cpu_seconds_used: number;
  total_memory_mb_seconds_used: number;
  total_network_bytes_used: number;
  current_active_workers: number;
  peak_workers: number;
}

interface BudgetPercentages {
  cpu: number;
  memory: number;
  network: number;
  workers: number;
}

enum AlertLevel {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}
```

---

## PoolManager

Prewarm pool lifecycle management service.

### Location
`6-ui/a2r-platform/src/services/poolManager.ts`

### Types
`6-ui/a2r-platform/src/types/runtime.ts`

### Class: PoolManager

```typescript
class PoolManager {
  constructor(options: PoolManagerOptions, initialState?: Partial<PrewarmPoolManager>)
  
  // Pool Lifecycle
  createPool(form: PoolCreateForm): Promise<PoolStatus>
  destroyPool(poolName: string): Promise<void>
  warmupPool(poolName: string): Promise<void>
  refreshPools(): Promise<void>
  
  // Instance Management
  acquireInstance(poolName: string): Promise<string>
  releaseInstance(poolName: string, instanceId: string): Promise<void>
  
  // Health & Stats
  calculateHealth(pool: PoolStatus): PoolHealth
  calculateStats(pools: PoolStatus[]): PoolStats
  
  // Queries
  getPool(name: string): PoolStatus | undefined
  getPools(): PoolStatus[]
  getPoolsByHealth(health: PoolHealth): PoolStatus[]
  getStats(): PoolStats
  getActivityLog(limit?: number): PoolActivity[]
  
  // Selection
  selectPool(poolName: string | undefined): void
  getSelectedPool(): PoolStatus | undefined
  
  // State
  getState(): PrewarmPoolManager
}
```

### Usage Example

```typescript
import { createPoolManager, createDefaultPoolForm } from '@/services/poolManager';
import { PoolHealth, ActivityType } from '@/types/runtime';

// Create manager
const manager = createPoolManager(
  {
    apiBaseUrl: '/api/v1',
    onPoolUpdate: (pool) => {
      console.log(`Pool ${pool.name} updated: ${pool.available_count} available`);
    },
    onActivity: (activity) => {
      console.log(`[${activity.activity_type}] ${activity.details}`);
    },
  },
  { pools: [], stats: { ...defaultStats }, activity_log: [] }
);

// Create a pool from scratch
const pool = await manager.createPool({
  name: 'worker-pool',
  image: 'node:18-alpine',
  pool_size: 5,
  warmup_commands: ['npm install', 'npm run build'],
  idle_timeout_seconds: 3600,
  resources: {
    cpu_millicores: 500,
    memory_mib: 512,
    disk_mib: 1024,
  },
});

// Or use default form helper
const form = createDefaultPoolForm('my-pool', 'node:18');
form.pool_size = 10;
form.warmup_commands = ['npm ci'];
const pool2 = await manager.createPool(form);

// Check health
const health = manager.calculateHealth(pool);
switch (health) {
  case PoolHealth.Healthy:
    console.log('Pool is healthy');
    break;
  case PoolHealth.Degraded:
    console.warn('Pool is degraded - consider warm-up');
    break;
  case PoolHealth.Empty:
    console.error('Pool is empty - immediate attention needed');
    await manager.warmupPool(pool.name);
    break;
}

// Get pools by health
const healthyPools = manager.getPoolsByHealth(PoolHealth.Healthy);
const degradedPools = manager.getPoolsByHealth(PoolHealth.Degraded);

// Use instances
const instanceId = await manager.acquireInstance('worker-pool');
console.log(`Acquired instance: ${instanceId}`);
// ... use instance ...
await manager.releaseInstance('worker-pool', instanceId);

// Get statistics
const stats = manager.getStats();
console.log(`Total pools: ${stats.total_pools}`);
console.log(`Available instances: ${stats.total_available}`);
console.log(`In use: ${stats.total_in_use}`);
console.log(`Total warmups: ${stats.total_warmups_performed}`);
console.log(`Avg warmup time: ${stats.avg_warmup_time_ms}ms`);

// Get recent activity
const activities = manager.getActivityLog(10);
activities.forEach(activity => {
  console.log(`${activity.timestamp} [${activity.pool_name}] ${activity.details}`);
});

// Cleanup
await manager.destroyPool('worker-pool');
```

### Types Reference

```typescript
interface PrewarmPoolManager {
  pools: PoolStatus[];
  selected_pool?: string;
  stats: PoolStats;
  activity_log: PoolActivity[];
}

interface PoolStatus {
  name: string;
  image: string;
  pool_size: number;
  available_count: number;
  in_use_count: number;
  warming_up_count: number;
  status: PoolHealth;
  created_at: string;
  last_activity: string;
}

interface PoolStats {
  total_pools: number;
  total_instances: number;
  total_available: number;
  total_in_use: number;
  total_warmups_performed: number;
  total_reuses: number;
  avg_warmup_time_ms: number;
}

enum PoolHealth {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Empty = 'empty',
  Error = 'error',
}

enum ActivityType {
  InstanceAcquired = 'instance_acquired',
  InstanceReleased = 'instance_released',
  InstanceCreated = 'instance_created',
  InstanceDestroyed = 'instance_destroyed',
  WarmupStarted = 'warmup_started',
  WarmupCompleted = 'warmup_completed',
  CleanupPerformed = 'cleanup_performed',
  Error = 'error',
}
```

---

## WorkflowEngine

Workflow validation, auto-layout, and compilation service.

### Location
`6-ui/a2r-platform/src/services/workflowEngine.ts`

### Types
`6-ui/a2r-platform/src/types/workflow.ts`

### Class: WorkflowDesignerEngine

```typescript
class WorkflowDesignerEngine {
  // Validation
  validateWorkflow(nodes: DesignerNode[], edges: DesignerEdge[]): ValidationResult
  wouldCreateCycle(fromNodeId: string, toNodeId: string, existingEdges: DesignerEdge[]): boolean
  
  // Layout
  autoLayout(
    nodes: DesignerNode[],
    edges: DesignerEdge[],
    options?: LayoutOptions
  ): Map<string, NodePosition>
  
  // Compilation
  compileToExecutable(draft: WorkflowDraft): ExecutableWorkflow
  
  // Graph Analysis
  getUpstreamNodes(nodeId: string, edges: DesignerEdge[]): string[]
  getDownstreamNodes(nodeId: string, edges: DesignerEdge[]): string[]
  
  // Suggestions
  suggestConnections(
    nodeType: string,
    availableNodes: DesignerNode[],
    nodeTypes: NodeTypeDefinition[]
  ): { inputs: DesignerNode[]; outputs: DesignerNode[] }
}
```

### Usage Example

```typescript
import { createWorkflowEngine, validateWorkflow, autoLayoutNodes } from '@/services/workflowEngine';
import { WorkflowPhase, NodeCategory, ExecutionStatus } from '@/types/workflow';

// Create engine
const engine = createWorkflowEngine();

// Define workflow nodes
const nodes = [
  {
    id: 'trigger',
    name: 'HTTP Trigger',
    node_type: 'webhook',
    phase: WorkflowPhase.Draft,
    position: { x: 0, y: 0 },
    inputs: [],
    outputs: ['out'],
    config: { path: '/webhook', method: 'POST' },
  },
  {
    id: 'process',
    name: 'Process Data',
    node_type: 'transform',
    phase: WorkflowPhase.Draft,
    position: { x: 200, y: 0 },
    inputs: ['in'],
    outputs: ['out'],
    config: { operation: 'uppercase', field: 'name' },
  },
  {
    id: 'save',
    name: 'Save to DB',
    node_type: 'database',
    phase: WorkflowPhase.Draft,
    position: { x: 400, y: 0 },
    inputs: ['in'],
    outputs: [],
    config: { table: 'users', action: 'insert' },
  },
];

// Define edges
const edges = [
  { id: 'e1', from: 'trigger', to: 'process' },
  { id: 'e2', from: 'process', to: 'save' },
];

// Validate workflow
const validation = engine.validateWorkflow(nodes, edges);
if (!validation.valid) {
  console.error('Validation errors:');
  validation.errors.forEach(err => {
    console.error(`  [${err.code}] ${err.message}`);
  });
} else {
  console.log('✅ Workflow is valid');
  if (validation.warnings.length > 0) {
    console.warn('Warnings:');
    validation.warnings.forEach(warn => {
      console.warn(`  [${warn.code}] ${warn.message}`);
    });
  }
}

// Check for cycles before adding edge
const newEdge = { from: 'save', to: 'trigger' };
if (engine.wouldCreateCycle(newEdge.from, newEdge.to, edges)) {
  console.error('Cannot add edge: would create cycle');
} else {
  edges.push({ id: 'e3', ...newEdge });
}

// Auto-layout
const positions = engine.autoLayout(nodes, edges, {
  direction: 'horizontal',
  nodeWidth: 200,
  nodeHeight: 100,
  spacing: 50,
});

// Update node positions
positions.forEach((pos, nodeId) => {
  const node = nodes.find(n => n.id === nodeId);
  if (node) {
    node.position = pos;
  }
});

// Compile to executable
try {
  const draft = {
    workflow_id: 'wf-123',
    version: '1.0.0',
    description: 'Process webhook data',
    nodes,
    edges,
  };
  
  const executable = engine.compileToExecutable(draft);
  console.log('Compiled workflow:');
  console.log(`  Entry point: ${executable.entry_point}`);
  console.log(`  Nodes: ${executable.nodes.length}`);
  console.log(`  Edges: ${executable.edges.length}`);
  console.log(`  Variables: ${executable.variables.map(v => v.name).join(', ')}`);
} catch (error) {
  console.error('Compilation failed:', error.message);
}

// Analyze dependencies
const upstream = engine.getUpstreamNodes('save', edges);
console.log(`Upstream of 'save': ${upstream.join(', ')}`); // trigger, process

const downstream = engine.getDownstreamNodes('trigger', edges);
console.log(`Downstream of 'trigger': ${downstream.join(', ')}`); // process, save
```

### Helper Functions

```typescript
// Standalone validation
const validation = validateWorkflow(nodes, edges);

// Standalone auto-layout
const positions = autoLayoutNodes(nodes, edges, {
  direction: 'vertical',
  nodeWidth: 180,
  nodeHeight: 80,
  spacing: 40,
});
```

### Types Reference

```typescript
interface WorkflowDraft {
  workflow_id: string;
  version: string;
  description: string;
  nodes: DesignerNode[];
  edges: DesignerEdge[];
}

interface DesignerNode {
  id: string;
  name: string;
  node_type: string;
  phase: WorkflowPhase;
  position: NodePosition;
  inputs: string[];
  outputs: string[];
  config: Record<string, unknown>;
}

interface DesignerEdge {
  id: string;
  from: string;
  to: string;
  condition?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

interface ValidationError {
  code: string;
  message: string;
  node_id?: string;
  edge_id?: string;
  severity: 'error' | 'warning';
}

interface LayoutOptions {
  direction: 'horizontal' | 'vertical';
  nodeWidth: number;
  nodeHeight: number;
  spacing: number;
}

interface ExecutableWorkflow {
  workflow_id: string;
  version: string;
  entry_point: string;
  nodes: ExecutableNode[];
  edges: ExecutableEdge[];
  variables: WorkflowVariable[];
}

enum WorkflowPhase {
  Draft = 'draft',
  Active = 'active',
  Deprecated = 'deprecated',
  Archived = 'archived',
}

enum ExecutionStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}
```

---

## Service Integration with React Hooks

All services are integrated with React hooks for seamless UI development:

| Service | Hook | Purpose |
|---------|------|---------|
| BudgetCalculator | `useBudget` | Budget dashboard UI state |
| PoolManager | `usePrewarm` | Pool management UI state |
| WorkflowEngine | `useWorkflow` | Workflow designer UI state |

### Hook Usage

```typescript
import { useBudget, usePrewarm, useWorkflow } from '@/hooks';

function MyComponent() {
  const budget = useBudget();
  const prewarm = usePrewarm();
  const workflow = useWorkflow();
  
  // All hooks provide:
  // - Data (from API)
  // - Loading states
  // - Actions (mutations)
  // - Service calculations
}
```

See [MIGRATION.md](../MIGRATION.md) for detailed hook documentation.

---

## Error Handling

All services follow consistent error handling patterns:

```typescript
try {
  const result = await service.operation();
} catch (error) {
  if (error instanceof Error) {
    console.error('Operation failed:', error.message);
  }
}
```

### Common Error Types

- **Network errors**: API unavailable or timeout
- **Validation errors**: Invalid input data
- **State errors**: Operation not allowed in current state
- **Not found**: Resource doesn't exist

---

## Testing Services

Services can be tested independently of React:

```typescript
import { describe, it, expect } from 'vitest';
import { createBudgetCalculator } from '@/services/budgetCalculator';

describe('BudgetCalculator', () => {
  it('calculates percentages correctly', () => {
    const calculator = createBudgetCalculator({
      quotas: [{
        tenant_id: 't1',
        quota_id: 'q1',
        cpu_seconds_limit: 100,
        memory_mb_seconds_limit: 100 * 1024,
        network_bytes_limit: 1_000_000,
        max_concurrent_workers: 5,
      }],
    });
    
    calculator.updateUsage({
      total_cpu_seconds_used: 50,
      total_memory_mb_seconds_used: 50 * 1024,
      total_network_bytes_used: 500_000,
      current_active_workers: 3,
      peak_workers: 4,
    });
    
    const percentages = calculator.calculatePercentages('t1', calculator.getTotalUsage());
    expect(percentages?.cpu).toBe(50);
    expect(percentages?.memory).toBe(50);
  });
});
```

---

## Related Documentation

- [MIGRATION.md](../MIGRATION.md) - Migration guide for developers
- [CONSOLIDATION_COMPLETE.md](../CONSOLIDATION_COMPLETE.md) - Consolidation summary
- [6-ui/ARCHITECTURE.md](../6-ui/ARCHITECTURE.md) - UI layer architecture
- Type definitions in `6-ui/a2r-platform/src/types/`
- Hook implementations in `6-ui/a2r-platform/src/hooks/`
