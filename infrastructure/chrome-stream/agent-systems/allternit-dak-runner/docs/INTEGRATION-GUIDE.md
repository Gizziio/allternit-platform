# DAK Runner Integration Guide

Guide for integrating DAK Runner into your agent workflows.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Basic Setup](#basic-setup)
- [Rails Integration](#rails-integration)
- [Lease Management](#lease-management)
- [DAG Execution](#dag-execution)
- [Context Pack Building](#context-pack-building)
- [Shell UI Integration](#shell-ui-integration)
- [Monitoring & Observability](#monitoring--observability)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SHELL UI                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐   │
│  │  Rails   │ │   DAG    │ │  Lease   │ │    Context Packs     │   │
│  │ Monitor  │ │ Status   │ │ Monitor  │ │    Query & Seal      │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DAK RUNNER                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐   │
│  │  Rails   │ │   DAG    │ │  Lease   │ │ Context  │ │  Tool   │   │
│  │ Adapters │ │Executor  │ │ Manager  │ │  Pack    │ │ Snapshots│   │
│  │ HTTP/CLI │ │Toposort  │ │AutoRenew │ │  Builder │ │  Store  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        RAILS CONTROL PLANE                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Gates   │ │  Leases  │ │ Receipts │ │  Ledger  │ │ Context  │  │
│  │CheckPoint│ │Lifecycle │ │Evidence  │ │  Events  │ │  Packs   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Basic Setup

```typescript
import { 
  createRailsHttpAdapter,
  createLeaseManager,
  createDagExecutor,
  createContextPackBuilder 
} from '@allternit/dak-runner';

// 1. Initialize Rails adapter
const railsAdapter = createRailsHttpAdapter({
  baseURL: process.env.RAILS_API_URL || 'http://localhost:3001',
  apiKey: process.env.RAILS_API_KEY,
  timeoutMs: 30000,
  retries: 3,
});

// 2. Initialize lease manager with auto-renewal
const leaseManager = createLeaseManager({
  railsAdapter,
  renewalIntervalMs: 60000,   // Check every minute
  extensionSeconds: 300,      // Extend by 5 minutes
  warningThresholdMs: 60000,  // Warn 1 minute before expiry
  autoRenewal: true,
});

// 3. Set up event monitoring
leaseManager.on('lease:acquired', (lease) => {
  console.log(`✓ Lease acquired: ${lease.leaseId}`);
});

leaseManager.on('lease:renewed', (lease) => {
  console.log(`↻ Lease renewed: ${lease.leaseId} (${lease.renewalCount}x)`);
});

leaseManager.on('lease:expiring', (lease, timeRemaining) => {
  console.warn(`⚠ Lease expiring soon: ${lease.leaseId} (${timeRemaining}ms)`);
});

leaseManager.on('lease:failed', (lease, error) => {
  console.error(`✗ Lease renewal failed: ${lease.leaseId} - ${error.message}`);
});
```

---

## Rails Integration

### HTTP Adapter with Fallback

```typescript
import { createRailsUnifiedAdapter } from '@allternit/dak-runner';

// Try HTTP, fallback to CLI if HTTP fails
const adapter = createRailsUnifiedAdapter({
  cliPath: 'allternit',
  projectPath: '.',
  http: { baseURL: 'http://localhost:3001' },
  preferHttp: true,
  fallbackToCli: true,
});
```

### Direct API Usage

```typescript
// Discover work
const work = await railsAdapter.discoverWork({ role: 'builder' });

// Claim work and get lease
const lease = await railsAdapter.requestLease({
  wihId: work.id,
  dagId: 'dag_builder',
  nodeId: 'n_0001',
  agentId: 'builder:abc123',
  paths: ['src/', 'tests/'],
  tools: ['fs.read', 'fs.write', 'exec.bash'],
  ttlSeconds: 900,
});

// Gate checks before/after tool use
const decision = await railsAdapter.gateCheck({
  wihId: 'wih_001',
  dagId: 'dag_001',
  nodeId: 'n_0001',
  runId: 'run_001',
  tool: { tool: 'fs.write', args: { path: 'src/index.ts', content: '...' } },
  leaseId: lease.leaseId,
});

if (decision.decision !== 'allow') {
  throw new Error(`Gate blocked: ${decision.reason}`);
}
```

---

## Lease Management

### Auto-Renewal Lifecycle

```typescript
// Acquire and auto-manage lease
const managedLease = await leaseManager.acquireLease({
  leaseId: 'lease_abc123',
  wihId: 'wih_001',
  dagId: 'dag_001',
  nodeId: 'n_0001',
  acquiredAt: Date.now(),
  expiresAt: Date.now() + 900 * 1000,  // 15 minutes
  keys: ['src/', 'tests/'],
  renewalCount: 0,
});

// Lease manager automatically:
// 1. Renews lease before expiry
// 2. Tracks renewal count
// 3. Emits events for monitoring
// 4. Handles failures with retry logic

// Release when done
await leaseManager.releaseLease(managedLease.leaseId);

// Get statistics
console.log(leaseManager.getStats());
// {
//   totalLeases: 5,
//   activeLeases: 5,
//   totalRenewals: 12,
//   failedRenewals: 0,
// }
```

### Lease Validation in Hooks

```typescript
// Hook runtime validates lease before tool execution
const runtime = createHookRuntime(config, gateChecker, toolExecutor, receiptEmitter);

// This validates the lease before executing the tool
const result = await runtime.executeTool(toolCall, leaseManager);

// If lease is invalid, throws error before tool execution
```

---

## DAG Execution

### With Lease Management

```typescript
import { createDagExecutor } from '@allternit/dak-runner';

const executor = createDagExecutor({
  dag: parsedDag,
  runId: 'run_builder_001',
  parser: dagParser,
  wihParser,
  ralphLoop,
  workerManager,
  observability,
  railsAdapter,
  leaseManager,           // Enable lease management
  autoManageLeases: true, // Auto-acquire/release per node
  maxParallelNodes: 1,    // Start with serial execution
});

// Monitor execution
executor.on('dag:started', ({ dag_id, run_id }) => {
  console.log(`DAG ${dag_id} started with run ${run_id}`);
});

executor.on('node:started', ({ node_id }) => {
  console.log(`Node ${node_id} starting...`);
});

executor.on('lease:acquired', ({ node_id, lease_id }) => {
  console.log(`✓ Lease ${lease_id} acquired for node ${node_id}`);
});

executor.on('node:completed', ({ node_id, status, outputs }) => {
  console.log(`Node ${node_id} completed: ${status}`);
});

executor.on('lease:released', ({ node_id, lease_id }) => {
  console.log(`✓ Lease ${lease_id} released for node ${node_id}`);
});

// Execute
const result = await executor.execute();

console.log(`DAG execution: ${result.success ? 'SUCCESS' : 'FAILED'}`);
console.log(`Completed: ${result.completed_nodes.length}`);
console.log(`Failed: ${result.failed_nodes.length}`);
console.log(`Blocked: ${result.blocked_nodes.length}`);
```

---

## Context Pack Building

### Building and Sealing

```typescript
import { createContextPackBuilder } from '@allternit/dak-runner';

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

// Collect receipts from dependencies
const depReceipts = await builder.collectDependencyReceipts(
  'dag_001',
  ['node_a', 'node_b'],  // Dependency node IDs
  ['tool_call_post', 'validator_report', 'build_report']
);

// Build and seal context pack
const pack = await builder.buildAndSeal({
  wihId: 'wih_001',
  dagId: 'dag_001',
  nodeId: 'n_0001',
  wihContent: 'Build feature X',
  dagSlice: {
    node: dagNode,
    hardDeps: ['node_a', 'node_b'],
    ancestors: [],
    edges: [],
  },
  receiptRefs: depReceipts.map(r => r.receiptId),
  policyBundleId: 'pb_001',
  planArtifacts: {
    planPath: 'plan.md',
    todoPath: 'todo.md',
  },
  toolRegistryVersion: '1.0.0',
  leaseInfo: {
    leaseId: managedLease.leaseId,
    keys: managedLease.keys,
    expiresAt: managedLease.expiresAt,
  },
});

console.log(`Context pack sealed: ${pack.contextPackId}`);
```

---

## Shell UI Integration

### Monitoring Components

The Shell UI (`5-ui/allternit-platform/`) provides monitoring for DAK Runner:

#### 1. Lease Monitor (`RailsView.tsx`)

```typescript
// Add to RailsView tabs
<TabsTrigger value="leases">
  <Key className="w-4 h-4" /> Leases
  {activeLeases.length > 0 && <Badge>{activeLeases.length}</Badge>}
</TabsTrigger>

// Lease monitoring panel
function LeaseMonitorPanel({ leases }: { leases: ManagedLease[] }) {
  return (
    <div className="space-y-4">
      {leases.map(lease => (
        <Card key={lease.leaseId}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{lease.leaseId}</div>
                <div className="text-sm text-muted-foreground">
                  {lease.dagId} / {lease.nodeId}
                </div>
              </div>
              <LeaseStatusBadge 
                status={getLeaseStatus(lease)}
                timeRemaining={lease.expiresAt - Date.now()}
              />
            </div>
            <Progress value={getLeaseProgress(lease)} />
            <div className="text-xs text-muted-foreground mt-2">
              Renewals: {lease.renewalCount} | 
              Keys: {lease.keys.join(', ')}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

#### 2. DAG Status Panel

```typescript
// Real-time DAG execution status
function DagStatusPanel({ dagId, runId }: { dagId: string; runId: string }) {
  const [nodes, setNodes] = useState<DagNodeStatus[]>([]);
  
  useEffect(() => {
    const ws = new WebSocket(`ws://api/dags/${dagId}/runs/${runId}/stream`);
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      updateNodeStatus(update.node_id, update.status);
    };
    return () => ws.close();
  }, [dagId, runId]);
  
  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-4">
        <Badge variant={getDagStatusColor(nodes)}>
          {getDagStatusText(nodes)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {nodes.filter(n => n.status === 'completed').length} / {nodes.length} complete
        </span>
      </div>
      
      <div className="space-y-2">
        {nodes.map(node => (
          <div key={node.id} className="flex items-center gap-2">
            <NodeStatusIcon status={node.status} />
            <span className="text-sm">{node.id}</span>
            {node.leaseId && (
              <Badge variant="outline" className="text-xs">
                Lease: {node.leaseId.slice(0, 8)}...
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 3. Context Pack Browser

```typescript
function ContextPackBrowser({ dagId }: { dagId: string }) {
  const [packs, setPacks] = useState<ContextPack[]>([]);
  
  useEffect(() => {
    railsService.queryContextPacks({ dagId }).then(setPacks);
  }, [dagId]);
  
  return (
    <ScrollArea className="h-[500px]">
      {packs.map(pack => (
        <Card key={pack.contextPackId} className="mb-2">
          <CardHeader>
            <CardTitle className="text-sm">{pack.contextPackId}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Node: {pack.inputs.nodeId}</div>
              <div>Version: {pack.version}</div>
              <div>Receipts: {pack.inputs.receiptRefs.length}</div>
              <div>Created: {formatDate(pack.createdAt)}</div>
            </div>
            <div className="mt-3">
              <Button size="sm" variant="outline">
                <Download className="w-3 h-3 mr-1" /> Download
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </ScrollArea>
  );
}
```

---

## Monitoring & Observability

### Metrics Collection

```typescript
import { globalMetrics } from '@allternit/dak-runner';

// Count events
globalMetrics.increment('dag_executions', 1, { 
  status: result.success ? 'success' : 'failed' 
});

// Track lease operations
globalMetrics.increment('lease_acquisitions');
globalMetrics.increment('lease_renewals');
globalMetrics.increment('lease_releases');

// Time operations
await globalMetrics.time('node_execution', async () => {
  return await executeNode(node);
}, { node_type: node.type });

// Get Prometheus format
console.log(globalMetrics.getPrometheusMetrics());
```

### Event Streaming

```typescript
// Stream events to monitoring dashboard
const eventStream = new EventSource('/api/events');

eventStream.addEventListener('dag:started', (e) => {
  const event = JSON.parse(e.data);
  dashboard.addDagRun(event.dag_id, event.run_id);
});

eventStream.addEventListener('lease:acquired', (e) => {
  const event = JSON.parse(e.data);
  dashboard.addLease(event.lease_id, event.node_id);
});

eventStream.addEventListener('context_pack:sealed', (e) => {
  const event = JSON.parse(e.data);
  dashboard.addContextPack(event.context_pack_id);
});
```

---

## Troubleshooting

### Common Issues

#### Lease Renewal Failures

```typescript
leaseManager.on('lease:failed', (lease, error) => {
  if (error.message.includes('conflict')) {
    // Lease taken by another agent
    console.error('Lease conflict - another agent claimed this work');
  } else if (error.message.includes('expired')) {
    // Rails already expired the lease
    console.error('Lease expired on Rails side');
  }
});
```

#### Network Failures with Retry

```typescript
import { withRetry, RetryPresets } from '@allternit/dak-runner';

const result = await withRetry(
  async () => await railsAdapter.gateCheck(request),
  {
    ...RetryPresets.network,
    maxAttempts: 5,
    onRetry: (attempt, error, delay) => {
      console.warn(`Gate check retry ${attempt}/${5} after ${delay}ms`);
    },
  }
);
```

#### Context Pack Validation

```typescript
// Validate context pack before sealing
function validateContextPack(pack: ContextPack): boolean {
  const required = ['contextPackId', 'version', 'createdAt', 'inputs'];
  for (const field of required) {
    if (!(field in pack)) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }
  
  // Validate inputs
  const inputFields = ['wihId', 'dagId', 'nodeId', 'receiptRefs'];
  for (const field of inputFields) {
    if (!(field in pack.inputs)) {
      console.error(`Missing required input: ${field}`);
      return false;
    }
  }
  
  return true;
}
```

---

## Best Practices

1. **Always use LeaseManager for multi-node workflows** - Automatic renewal prevents mid-execution failures
2. **Enable `autoManageLeases` in DagExecutor** - Handles per-node lease acquisition/release
3. **Build context packs at node completion** - Capture all evidence including receipts
4. **Query receipts from dependencies** - Ensure complete audit trail
5. **Monitor lease events** - Set up alerts for `lease:failed` events
6. **Use circuit breakers** - Prevent cascading failures when Rails is unavailable
7. **Stream events to Shell UI** - Real-time visibility into execution

---

For API details, see [API-REFERENCE.md](./API-REFERENCE.md).
