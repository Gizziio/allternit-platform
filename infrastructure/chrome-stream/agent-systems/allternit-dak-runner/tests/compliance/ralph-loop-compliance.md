# Ralph Loop Compliance CI Gate

**Version:** 1.0.0  
**Status:** LOCKED  
**Authority:** Implements SYSTEM_LAW.md LAW-AUT-001 through LAW-AUT-005

---

## Purpose

This CI gate validates that the DAK Runner implementation complies with the Ralph Loop requirements defined in SYSTEM_LAW.md.

**Non-Negotiable:** CI fails if any compliance check fails.

---

## Compliance Checks

### 1. ContextPack Seal Validation (LAW-AUT-002)

**Check:** Runner cannot execute WIH without sealed ContextPack

**Validation:**
```typescript
// In ralph.ts or scheduler
beforeEach(async () => {
  const contextPack = await contextPackBuilder.buildAndSeal({ dagId, nodeId, wihId });
  expect(contextPack.pack_id).toMatch(/^cp_[a-f0-9]{64}$/);
  expect(contextPack.inputs.tier0_law).toBeDefined();
  expect(contextPack.inputs.sot).toBeDefined();
  expect(contextPack.inputs.architecture).toBeDefined();
});
```

**CI Failure If:**
- ContextPack not sealed before execution
- pack_id doesn't match `cp_<sha256>` format
- Missing required inputs (LAW, SOT, Architecture)

---

### 2. Lease Auto-Renew Validation (LAW-AUT-003)

**Check:** Long-running sessions must auto-renew leases

**Validation:**
```typescript
// In lease/renew-supervisor.test.ts
test('Lease renew supervisor renews before expiry', async () => {
  const supervisor = createLeaseRenewSupervisor(rails, {
    renewThresholdSeconds: 60,
    renewExtendSeconds: 300,
  });
  
  supervisor.start();
  await supervisor.registerLease(testLease);
  
  // Wait for renewal
  await sleep(70000);
  
  expect(renewCalled).toBe(true);
  expect(newLease.expiresAt).toBeGreaterThan(oldLease.expiresAt);
});
```

**CI Failure If:**
- Lease renew supervisor not initialized
- Renew threshold > 60 seconds
- No renewal events emitted during long-running test

---

### 3. Receipt Queryability Validation (LAW-AUT-004)

**Check:** System must support querying receipts to decide next actions

**Validation:**
```typescript
// In adapters/rails_http.test.ts
test('Receipt query API returns filtered receipts', async () => {
  const receipts = await rails.receipts.query({
    wihId: 'wih_123',
    type: 'tool_call_post',
    limit: 100,
  });
  
  expect(Array.isArray(receipts)).toBe(true);
  expect(receipts.every(r => r.wihId === 'wih_123')).toBe(true);
});
```

**CI Failure If:**
- Receipt query endpoint not implemented
- Query doesn't support filtering by wih_id, type, correlation_id
- Query doesn't support pagination

---

### 4. PromptDeltaNeeded Validation (LAW-AUT-005)

**Check:** If blocked by missing context, MUST emit PromptDeltaNeeded

**Validation:**
```typescript
// In hooks/prompt-delta.test.ts
test('PromptDeltaNeeded emitted when context missing', async () => {
  const hook = createPromptDeltaHook(rails);
  
  let emitted = false;
  hook.on('delta:emitted', () => { emitted = true; });
  
  await hook.emitPromptDeltaNeeded({
    dagId: 'dag_123',
    nodeId: 'n_001',
    wihId: 'wih_456',
    reasonCode: 'MISSING_INPUT',
    requestedFields: ['user_requirements'],
  });
  
  expect(emitted).toBe(true);
});
```

**CI Failure If:**
- PromptDeltaNeeded hook not implemented
- No event emitted when context missing
- Missing required fields in delta request

---

### 5. No-Stop Scheduling Validation (LAW-AUT-001)

**Check:** If DAG has READY work, MUST pickup and execute next WIH

**Validation:**
```typescript
// In loop/no-stop-scheduler.test.ts
test('Scheduler executes all READY nodes without stopping', async () => {
  const scheduler = createRalphNoStopScheduler(rails, ralphLoop, contextPackBuilder);
  
  let executedCount = 0;
  scheduler.on('node:completed', () => { executedCount++; });
  
  await scheduler.start();
  
  // Wait for all nodes to execute
  await sleep(10000);
  
  expect(executedCount).toBe(readyNodes.length);
  expect(scheduler.getReadyQueueLength()).toBe(0);
});
```

**CI Failure If:**
- Scheduler stops while READY nodes exist
- Nodes not executed in deterministic order (priority, then nodeId lexical)
- Scheduler idles without explicit gate requirement

---

### 6. Deterministic Ordering Validation

**Check:** READY ordering must be deterministic (priority, then nodeId lexical)

**Validation:**
```typescript
// In loop/no-stop-scheduler.test.ts
test('Ready queue sorted deterministically', () => {
  const nodes: ReadyNode[] = [
    { dagId: 'dag_1', nodeId: 'n_003', priority: 1, ... },
    { dagId: 'dag_1', nodeId: 'n_001', priority: 1, ... },
    { dagId: 'dag_1', nodeId: 'n_002', priority: 2, ... },
  ];
  
  scheduler.sortReadyQueue();
  
  expect(nodes[0].nodeId).toBe('n_002'); // Highest priority
  expect(nodes[1].nodeId).toBe('n_001'); // Same priority, lexical order
  expect(nodes[2].nodeId).toBe('n_003');
});
```

**CI Failure If:**
- Queue not sorted by priority (descending)
- Same priority nodes not sorted by nodeId (lexical ascending)

---

## CI Configuration

### GitHub Actions Workflow

```yaml
# .github/workflows/ralph-loop-compliance.yml
name: Ralph Loop Compliance

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  compliance:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 1-kernel/agent-systems/allternit-dak-runner/package-lock.json
      
      - name: Install dependencies
        run: npm ci
        working-directory: 1-kernel/agent-systems/allternit-dak-runner
      
      - name: Run compliance tests
        run: npm test -- --testPathPattern='compliance'
        working-directory: 1-kernel/agent-systems/allternit-dak-runner
      
      - name: Check ContextPack schema
        run: |
          npx ajv validate -s harness/schemas/context_pack.schema.json -d test-data/context-pack.json
        working-directory: 1-kernel/agent-systems/allternit-dak-runner
      
      - name: Verify LAW-AUT imports
        run: |
          grep -r "LAW-AUT" src/ || (echo "ERROR: LAW-AUT not referenced in code" && exit 1)
        working-directory: 1-kernel/agent-systems/allternit-dak-runner
```

---

## Acceptance Tests

### AT-RLC-001: ContextPack Seal Required

```typescript
test('WIH execution fails without sealed ContextPack', async () => {
  const request: NodeExecutionRequest = {
    dagId: 'dag_123',
    nodeId: 'n_001',
    wihId: 'wih_456',
    runId: 'run_789',
    baseContextPack: null as any, // Missing ContextPack
    basePolicyBundle: { role: 'builder' },
    planFiles: { ... },
  };
  
  await expect(ralphLoop.executeNode(request))
    .rejects
    .toThrow('ContextPack required');
});
```

### AT-RLC-002: Lease Renewal During Long Run

```typescript
test('Lease renewed during 2+ hour run', async () => {
  const supervisor = createLeaseRenewSupervisor(rails);
  supervisor.start();
  
  const renewEvents: any[] = [];
  supervisor.on('lease:renewed', (event) => { renewEvents.push(event); });
  
  // Simulate 2-hour run with 5-minute lease
  await sleep(120 * 60 * 1000);
  
  expect(renewEvents.length).toBeGreaterThanOrEqual(24); // At least 24 renewals in 2 hours
});
```

### AT-RLC-003: Receipt Query Before Retry

```typescript
test('Ralph Loop queries receipts before retrying WIH', async () => {
  const ralphLoop = createRalphLoop(workerManager, planManager, rails);
  
  const querySpy = jest.spyOn(rails.receipts, 'query');
  
  await ralphLoop.executeNode(request);
  
  expect(querySpy).toHaveBeenCalledWith({
    wihId: request.wihId,
    type: 'tool_call_post',
  });
});
```

### AT-RLC-004: PromptDeltaNeeded Emitted

```typescript
test('PromptDeltaNeeded emitted when blocked', async () => {
  const hook = createPromptDeltaHook(rails);
  
  const emittedEvents: any[] = [];
  hook.on('delta:emitted', (event) => { emittedEvents.push(event); });
  
  await hook.emitPromptDeltaNeeded({
    dagId: 'dag_123',
    nodeId: 'n_001',
    wihId: 'wih_456',
    reasonCode: 'MISSING_INPUT',
    requestedFields: ['requirements'],
  });
  
  expect(emittedEvents.length).toBe(1);
  expect(emittedEvents[0].request.reasonCode).toBe('MISSING_INPUT');
});
```

### AT-RLC-005: No-Stop Execution

```typescript
test('Scheduler never stops while READY nodes exist', async () => {
  const scheduler = createRalphNoStopScheduler(rails, ralphLoop, contextPackBuilder);
  await scheduler.start();
  
  // Add nodes during execution
  setTimeout(() => {
    scheduler.readyQueue.push({ dagId: 'dag_2', nodeId: 'n_004', priority: 1, ... });
  }, 5000);
  
  await sleep(15000);
  
  // All nodes should be executed
  expect(scheduler.getReadyQueueLength()).toBe(0);
  expect(scheduler.getStats().nodesExecuted).toBeGreaterThanOrEqual(4);
});
```

---

## Compliance Report

After CI passes, a compliance report is generated:

```json
{
  "compliance_version": "1.0.0",
  "timestamp": "2026-02-20T12:00:00Z",
  "checks": {
    "context_pack_seal": { "passed": true, "law": "LAW-AUT-002" },
    "lease_renewal": { "passed": true, "law": "LAW-AUT-003" },
    "receipt_query": { "passed": true, "law": "LAW-AUT-004" },
    "prompt_delta": { "passed": true, "law": "LAW-AUT-005" },
    "no_stop_scheduling": { "passed": true, "law": "LAW-AUT-001" },
    "deterministic_ordering": { "passed": true, "law": "LAW-AUT-001" }
  },
  "overall": "COMPLIANT"
}
```

---

**END OF CI GATE SPEC**
