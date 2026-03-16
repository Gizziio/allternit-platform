# DAK Runner API Reference

Complete API reference for the Deterministic Agent Kernel (DAK) Runner.

**Version:** 1.1.0  
**Last Updated:** 2026-02-08

---

## Table of Contents

- [Quick Start](#quick-start)
- [Rails Adapters](#rails-adapters)
- [Lease Management](#lease-management)
- [DAG Execution](#dag-execution)
- [Context Pack Builder](#context-pack-builder)
- [Hook Runtime](#hook-runtime)
- [Policy Injection](#policy-injection)
- [Tool Snapshots](#tool-snapshots)
- [Monitoring](#monitoring)

---

## Quick Start

```typescript
import { 
  createRailsHttpAdapter,
  createLeaseManager,
  createDagExecutor,
  createContextPackBuilder 
} from '@a2r/dak-runner';

// 1. Create Rails HTTP adapter
const railsAdapter = createRailsHttpAdapter({
  baseURL: 'http://localhost:3001',
  apiKey: process.env.RAILS_API_KEY,
  timeoutMs: 30000,
});

// 2. Create lease manager for auto-renewal
const leaseManager = createLeaseManager({
  railsAdapter,
  renewalIntervalMs: 60000,
  extensionSeconds: 300,
  autoRenewal: true,
});

// 3. Create DAG executor with lease management
const executor = createDagExecutor({
  dag,
  runId: 'run_001',
  railsAdapter,
  leaseManager,
  autoManageLeases: true,
});

// 4. Execute with full monitoring
executor.on('lease:acquired', ({ node_id, lease_id }) => {
  console.log(`Lease ${lease_id} acquired for node ${node_id}`);
});

await executor.execute();
```

---

## Rails Adapters

### RailsHttpAdapter

Full REST API client for Rails control plane.

```typescript
import { createRailsHttpAdapter } from '@a2r/dak-runner';

const adapter = createRailsHttpAdapter({
  baseURL: 'http://rails-api:3001',
  apiKey: 'secret-key',
  timeoutMs: 30000,
  retries: 3,
});
```

#### Methods

##### Work Discovery
```typescript
// Discover available work items
const workItems = await adapter.discoverWork({
  role: 'builder',
  ready: true,
});
```

##### Lease Management
```typescript
// Request a lease
const lease = await adapter.requestLease({
  wihId: 'wih_001',
  dagId: 'dag_001',
  nodeId: 'n_0001',
  agentId: 'builder:abc123',
  paths: ['src/', 'tests/'],
  tools: ['fs.read', 'fs.write'],
  ttlSeconds: 900,
});

// Renew lease
await adapter.renewLease(lease.leaseId, 300);

// Release lease
await adapter.releaseLease(lease.leaseId);
```

##### Gate Checking
```typescript
// PreToolUse gate check
const decision = await adapter.gateCheck({
  wihId: 'wih_001',
  dagId: 'dag_001',
  nodeId: 'n_0001',
  runId: 'run_001',
  tool: {
    tool: 'fs.write',
    args: { path: 'src/file.ts', content: '...' },
    intendedPaths: ['src/file.ts'],
  },
  contextPackId: 'cp_abc123',
  policyBundleId: 'pb_def456',
  leaseId: 'lease_789',
});

// PostToolUse commit
await adapter.gateCommit(checkId, toolCall, result, receiptId);

// PostToolUse failure
await adapter.gateFail(checkId, toolCall, error, receiptId);
```

##### Receipt Management
```typescript
// Write receipt
const receiptId = await adapter.writeReceipt({
  kind: 'tool_call_post',
  runId: 'run_001',
  dagId: 'dag_001',
  nodeId: 'n_0001',
  wihId: 'wih_001',
  timestamp: new Date().toISOString(),
  payload: { result: 'success' },
});

// Query receipts
const receipts = await adapter.queryReceipts({
  dagId: 'dag_001',
  nodeId: 'n_0001',
  kinds: ['tool_call_post', 'validator_report'],
  limit: 100,
});
```

##### Context Pack
```typescript
// Seal context pack to Rails
await adapter.sealContextPack({
  contextPackId: 'cp_abc123',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  inputs: {
    wihId: 'wih_001',
    dagId: 'dag_001',
    nodeId: 'n_0001',
    receiptRefs: ['rcpt_001', 'rcpt_002'],
    policyBundleId: 'pb_abc',
    planHashes: { plan: 'hash1', todo: 'hash2' },
  },
  correlationId: 'corr_xyz789',
});
```

### RailsUnifiedAdapter

Combines CLI and HTTP adapters with automatic fallback.

```typescript
import { createRailsUnifiedAdapter } from '@a2r/dak-runner';

const adapter = createRailsUnifiedAdapter({
  cliPath: 'a2r',
  projectPath: '.',
  http: { baseURL: 'http://localhost:3001' },
  preferHttp: true,
  fallbackToCli: true,
});

// Will try HTTP first, fall back to CLI if HTTP fails
const result = await adapter.gateCheck(request);
```

---

## Lease Management

### LeaseManager

Automatic lease renewal and lifecycle management.

```typescript
import { createLeaseManager } from '@a2r/dak-runner';

const leaseManager = createLeaseManager({
  railsAdapter,
  renewalIntervalMs: 60000,  // Check every minute
  extensionSeconds: 300,     // Extend by 5 minutes
  warningThresholdMs: 60000, // Warn 1 minute before expiry
  maxRetries: 3,
  autoRenewal: true,
});
```

#### Events

```typescript
// Monitor lease lifecycle
leaseManager.on('lease:acquired', (lease) => {
  console.log(`Acquired lease ${lease.leaseId}`);
});

leaseManager.on('lease:renewed', (lease) => {
  console.log(`Renewed lease ${lease.leaseId}, count: ${lease.renewalCount}`);
});

leaseManager.on('lease:expiring', (lease, timeRemaining) => {
  console.warn(`Lease expiring in ${timeRemaining}ms`);
});

leaseManager.on('lease:failed', (lease, error) => {
  console.error(`Lease renewal failed: ${error.message}`);
});
```

#### Methods

```typescript
// Acquire and auto-manage lease
const managedLease = await leaseManager.acquireLease(lease);

// Manual renewal
const success = await leaseManager.renewLease(lease.leaseId);

// Check status
console.log(leaseManager.getStats());
// { totalLeases: 5, activeLeases: 5, totalRenewals: 12, ... }

// Release
await leaseManager.releaseLease(lease.leaseId);

// Graceful shutdown
await leaseManager.shutdown();
```

---

## DAG Execution

### DagExecutor

Executes DAGs with topological ordering and lease management.

```typescript
import { createDagExecutor } from '@a2r/dak-runner';

const executor = createDagExecutor({
  dag,
  runId: 'run_001',
  parser,
  wihParser,
  ralphLoop,
  workerManager,
  observability,
  railsAdapter,
  leaseManager,           // Enable lease management
  autoManageLeases: true, // Auto-acquire/release per node
  maxParallelNodes: 1,
});
```

#### Events

```typescript
executor.on('dag:started', ({ dag_id, run_id }) => {
  console.log(`DAG ${dag_id} started`);
});

executor.on('node:started', ({ node_id }) => {
  console.log(`Node ${node_id} started`);
});

executor.on('lease:acquired', ({ node_id, lease_id }) => {
  console.log(`Lease ${lease_id} acquired for ${node_id}`);
});

executor.on('node:completed', ({ node_id, status }) => {
  console.log(`Node ${node_id} completed with status ${status}`);
});

executor.on('dag:completed', (result) => {
  console.log(`DAG completed: ${result.success}`);
});
```

#### Execution

```typescript
const result = await executor.execute();

console.log(result);
// {
//   success: true,
//   dag_id: 'dag_001',
//   run_id: 'run_001',
//   completed_nodes: ['n_0001', 'n_0002'],
//   failed_nodes: [],
//   blocked_nodes: [],
//   node_results: Map {...},
//   started_at: '2026-02-08T15:00:00Z',
//   completed_at: '2026-02-08T15:05:00Z',
// }
```

---

## Context Pack Builder

### ContextPackBuilder

Builds and seals deterministic context packs.

```typescript
import { createContextPackBuilder } from '@a2r/dak-runner';

const builder = createContextPackBuilder({
  basePath: '.',
  railsAdapter: {
    sealContextPack: async (pack) => {
      await railsAdapter.sealContextPack(pack);
    },
    queryReceipts: async (query) => {
      return await railsAdapter.queryReceipts(query);
    },
  },
});
```

#### Build and Seal

```typescript
// Build context pack
const pack = await builder.build({
  wihId: 'wih_001',
  dagId: 'dag_001',
  nodeId: 'n_0001',
  wihContent: '...',
  dagSlice: { node, hardDeps, ancestors, edges },
  receiptRefs: ['rcpt_001', 'rcpt_002'],
  policyBundleId: 'pb_001',
  planArtifacts: {
    planPath: 'plan.md',
    todoPath: 'todo.md',
  },
  toolRegistryVersion: '1.0.0',
  leaseInfo: { leaseId: 'lease_001', keys: ['src/'], expiresAt: '...' },
});

// Seal to Rails
await builder.sealToRails(pack);

// Or build and seal in one operation
const pack = await builder.buildAndSeal(inputs);
```

#### Dependency Evidence

```typescript
// Collect receipts from dependency nodes
const receipts = await builder.collectDependencyReceipts(
  'dag_001',
  ['node_a', 'node_b'],  // Dependency node IDs
  ['tool_call_post', 'validator_report', 'build_report']
);

// Returns:
// [
//   { receiptId: 'rcpt_001', kind: 'validator_report', nodeId: 'node_a', payload: {...} },
//   { receiptId: 'rcpt_002', kind: 'tool_call_post', nodeId: 'node_b', payload: {...} },
// ]
```

---

## Hook Runtime

### HookRuntime

Manages hook lifecycle with lease validation.

```typescript
import { createHookRuntime } from '@a2r/dak-runner';

const runtime = createHookRuntime(
  {
    runId: 'run_001',
    wihId: 'wih_001',
    dagId: 'dag_001',
    nodeId: 'n_0001',
    role: 'builder',
    contextPackId: 'cp_001',
    policyBundleId: 'pb_001',
    leaseId: 'lease_001',  // Optional: for lease validation
  },
  gateChecker,
  toolExecutor,
  receiptEmitter
);
```

#### Execute with Lease Validation

```typescript
// Tool execution validates lease before execution
const result = await runtime.executeTool(toolCall, leaseManager);

// If lease is invalid, throws error before tool execution
```

#### Events

```typescript
runtime.on('SessionStart', (event) => {
  console.log('Session started:', event.payload.reason);
});

runtime.on('PreToolUse', (event) => {
  console.log('Tool about to execute:', event.payload.toolCall.tool);
});

runtime.on('PostToolUse', (event) => {
  console.log('Tool executed:', event.payload.result);
});

runtime.on('PostToolUseFailure', (event) => {
  console.error('Tool failed:', event.payload.error);
});
```

---

## Policy Injection

### PolicyInjector

Generates and injects policy markers.

```typescript
import { PolicyInjector } from '@a2r/dak-runner';

const injector = new PolicyInjector({
  bundle_id: 'pb_001',
  injection_points: ['session_start', 'dag_load', 'node_entry'],
  marker_output_dir: '.a2r/markers',
});

await injector.loadBundle(policyBundle);

// Inject at different points
await injector.injectForSession('sess_001', 'agent_001');
await injector.injectForDAG('dag_001', 'sess_001', 'agent_001');
await injector.injectForNode('dag_001', 'node_001', 'sess_001', 'agent_001');
```

---

## Tool Snapshots

### SnapshotStore & ReplayEngine

Content-addressed storage for deterministic replay.

```typescript
import { SnapshotStore, ReplayEngine, withSnapshots } from '@a2r/dak-runner';

const store = new SnapshotStore({
  storage_dir: '.a2r/snapshots',
  max_snapshots: 10000,
  ttl_seconds: 7 * 24 * 60 * 60,
});

const engine = new ReplayEngine(store, {
  match_strategy: 'exact',
  fallback_to_live: true,
  record_on_miss: true,
});

// Execute with snapshot caching
const result = await engine.execute(
  'web_search',
  { query: 'typescript tips' },
  async (req) => fetchSearchResults(req),
  { session_id: 'sess_001', dag_id: 'dag_001' }
);

// Or use wrapper
const searchWithCache = withSnapshots('search', liveSearch, store);
```

---

## Monitoring

### Circuit Breaker

```typescript
import { createCircuitBreaker } from '@a2r/dak-runner';

const breaker = createCircuitBreaker('rails_api', 'strict');

const result = await breaker.execute(async () => {
  return await railsAdapter.gateCheck(request);
});
```

### Retry Logic

```typescript
import { withRetry, RetryPresets } from '@a2r/dak-runner';

const result = await withRetry(
  async () => await fetchData(),
  {
    ...RetryPresets.network,
    maxAttempts: 5,
    onRetry: (attempt, error, delay) => {
      console.log(`Retry ${attempt} after ${delay}ms`);
    },
  }
);
```

### Metrics

```typescript
import { globalMetrics, MetricsCollector } from '@a2r/dak-runner';

// Count events
globalMetrics.increment('dag_executions', 1, { status: 'success' });

// Time operations
await globalMetrics.time('node_execution', async () => {
  return await executeNode(node);
}, { node_type: 'builder' });

// Get Prometheus format
console.log(globalMetrics.getPrometheusMetrics());
```

---

## Error Handling

All methods throw structured errors:

```typescript
try {
  await adapter.gateCheck(request);
} catch (error) {
  if (error.code === 'NETWORK_ERROR') {
    // Handle network failure
  } else if (error.code === 'LEASE_EXPIRED') {
    // Handle lease expiration
  } else if (error.code === 'GATE_BLOCKED') {
    // Handle policy block
  }
}
```

---

## TypeScript Types

All types are exported:

```typescript
import type {
  // Rails
  RailsHttpConfig,
  UnifiedRailsConfig,
  RailsError,
  
  // Lease
  LeaseManagerConfig,
  ManagedLease,
  LeaseManagerEvents,
  
  // DAG
  DagExecutorConfig,
  DagExecutionResult,
  
  // Context
  ContextPackInputs,
  ContextPackBuilderConfig,
  
  // Hooks
  HookRuntimeConfig,
  HookEventType,
  
  // Policy
  InjectionMarker,
  InjectionPoint,
  
  // Snapshots
  Snapshot,
  ReplayConfig,
  ReplayResult,
  
  // Monitoring
  CircuitBreakerConfig,
  RetryConfig,
  MetricValue,
} from '@a2r/dak-runner';
```

---

For more examples, see the [Integration Guide](./INTEGRATION-GUIDE.md).
