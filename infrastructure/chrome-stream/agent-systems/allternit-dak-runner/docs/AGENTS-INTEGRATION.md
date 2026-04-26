# DAK Runner ↔ Agents Folder Integration

This document maps how the DAK Runner integrates with the `agents/` folder structure.

---

## Overview

The DAK Runner is the **execution engine** that implements the specifications, roles, and templates defined in the `agents/` folder.

```
┌────────────────────────────────────────────────────────────────┐
│                      Allternit SYSTEM                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   agents/               DAK Runner              Rails           │
│   (Definitions)         (Execution)             (Control)       │
│                                                                 │
│   ┌──────────┐          ┌──────────┐           ┌──────────┐    │
│   │ AGENTS.md│─────────►│Enforces  │           │ Gates    │    │
│   │(Law)     │          │Law       │◄─────────►│ Leases   │    │
│   └──────────┘          └──────────┘           │ Receipts │    │
│        │                                              │        │
│   ┌────┴────┐          ┌──────────┐                  │        │
│   │spec/    │─────────►│ Implements│                  │        │
│   │         │          │Schemas   │                  │        │
│   └─────────┘          └──────────┘                  │        │
│        │                                             │        │
│   ┌────┴────┐          ┌──────────┐                  │        │
│   │roles/   │─────────►│Enforces  │                  │        │
│   │         │          │Constraints│                 │        │
│   └─────────┘          └──────────┘                  │        │
│        │                                             │        │
│   ┌────┴────┐          ┌──────────┐                  │        │
│   │packs/   │─────────►│Renders   │                  │        │
│   │templates│          │Templates │                  │        │
│   └─────────┘          └──────────┘                  │        │
│                                                       │        │
└────────────────────────────────────────────────────────────────┘
```

---

## File Mapping

### 1. Agent Law (`agents/AGENTS.md`)

**Purpose:** Defines non-negotiable invariants for all agents.

**DAK Runner Implementation:**

| Law | Implementation |
|-----|----------------|
| Authority Separation | `src/adapters/rails_api.ts` - All state changes proxied through Rails |
| Tool Execution Rule | `src/tools/enforce.ts` - Gate checks before all tool calls |
| Write Discipline | `src/policy_engine/engine.ts` - Path validation against WIH scope |
| Mutual Blocking | `src/dag/executor.ts` - Builder/Validator role separation |

**Code References:**
```typescript
// src/tools/enforce.ts
export class ToolEnforcement {
  async enforce(context: EnforcementContext): Promise<EnforcementResult> {
    // 1. Check PreToolUse gate via Rails
    const gateResult = await this.rails.checkGate({...});
    
    // 2. Validate against ToolRegistry schema
    const schemaValid = this.registry.validate(toolName, inputs);
    
    // 3. Check WIH allowed_tools + lease scope
    const scopeValid = this.checkScope(context.wih, toolName);
    
    // 4. Emit tool_call_pre receipt
    await this.emitReceipt('tool_call_pre', {...});
  }
}
```

---

### 2. Specifications (`agents/spec/`)

#### `DAG_SCHEMA.md` → `src/dag/`

| Schema Element | Implementation |
|----------------|----------------|
| `dag_version` | `DagDefinition.dag_version` in `src/dag/types.ts` |
| `dag_id` | Validation in `src/dag/parser.ts` |
| `nodes[]` | `DAGNode` interface with `id`, `action`, `depends_on` |
| `gates[]` | `GateDefinition` interface, evaluation in `executor.ts` |
| `retry` | `RetryPolicy` interface, handled by `RetryExecutor` |

**Parser Validation:**
```typescript
// src/dag/parser.ts
export class DagParser {
  validate(dag: DAG): ValidationResult {
    // Validate dag_version = 'v1'
    // Validate dag_id format (dag_{string})
    // Check node references in depends_on exist
    // Validate gate conditions are parseable
  }
}
```

#### `WIH_SCHEMA.md` → `src/wih/`

| Schema Element | Implementation |
|----------------|----------------|
| `wih_version` | `WIH.wih_version` in `src/wih/types.ts` |
| `work_item_id` | Validation and parsing |
| `scope` | `WIHScope` with path/tool constraints |
| `inputs` | `WIHInputs` with SoT, requirements |
| `outputs` | `WIHOutputs` with artifacts, receipts |
| `acceptance` | `AcceptanceCriteria` with gates |

**Scope Enforcement:**
```typescript
// src/wih/types.ts
export interface WIHScope {
  allowed_paths: string[];      // Enforced by path validation
  forbidden_paths: string[];    // Enforced by path validation
  allowed_tools: string[];      // Enforced by ToolRegistry
  forbidden_tools: string[];    // Enforced by ToolRegistry
  execution_permission: {
    mode: 'read_only' | 'write_leased' | 'write_any';
    flags: string[];
  };
}
```

#### `BRIDGE_RAILS_RUNNER.md` → `src/adapters/rails_api.ts`

| Bridge Component | Implementation |
|------------------|----------------|
| Gate Check API | `RailsAdapter.checkGate()` |
| Lease Request API | `RailsAdapter.requestLease()` |
| Receipt Emission API | `RailsAdapter.emitReceipt()` |
| Context Bundle API | `ContextPackBuilder.build()` |

---

### 3. Roles (`agents/roles/`)

#### `orchestrator.md` → `src/loop/ralph.ts`, `src/runner/agent-runner.ts`

**Orchestrator Responsibilities:**
- Spawns workers per DAG/WIH
- Manages Ralph loop (bounded fix cycles)
- Handles escalation

**Implementation:**
```typescript
// src/loop/ralph.ts
export class RalphLoop {
  async run(config: RalphLoopConfig): Promise<RalphLoopResult> {
    // Spawn builder
    // Await build_report
    // Spawn validator  
    // Await validator_report
    // Check PASS/FAIL
    // If FAIL and retries < max: loop
    // If FAIL and retries >= max: escalate
  }
}
```

#### `builder.md` → `src/workers/manager.ts`

**Builder Constraints:**
- Writes only under lease scope
- Produces: code, tests, docs, build reports

**Implementation:**
```typescript
// src/workers/manager.ts
export class WorkerManager {
  async spawnBuilder(context: WorkerContext): Promise<Worker> {
    // Validate lease exists for paths
    // Set up file watchers
    // Execute builder with WIH scope constraints
    // Collect build_report
  }
}
```

#### `validator.md` → `src/reports/schemas.ts`

**Validator Constraints:**
- Read-only validation
- Produces validator report (PASS/FAIL)

**Implementation:**
```typescript
// src/reports/schemas.ts
export const ValidatorReportSchema = z.object({
  status: z.enum(['PASS', 'FAIL', 'BLOCKED']),
  findings: z.array(FindingSchema),
  required_fixes: z.array(FixSchema),
  // ...
});

export function validateValidatorReport(report: unknown): ValidationResult {
  // Schema validation
  // Ensure validator didn't modify files (read-only check)
}
```

---

### 4. Prompt Packs (`agents/packs/`)

#### Pack Definitions → Prompt Pack Service

| Pack File | Purpose | Templates |
|-----------|---------|-----------|
| `dak-core-v1.yaml` | Core DAK templates | `context_prime.j2` |
| `dak-tools-v1.yaml` | Tool templates | `receipt_emit.j2`, `trace_summarize.j2` |
| `dak-orch-v1.yaml` | Orchestration templates | `orchestrator_loop.j2` |

**Integration Flow:**
```
DAK Runner              Prompt Pack Service (Port 3005)
     │                            │
     │ POST /render               │
     │ {                          │
     │   pack_id: "dak-core-v1",  │
     │   template: "context_prime",│
     │   variables: {...}         │
     │ }                          │
     │────────────────────────────►│
     │                            │
     │◄────────────────────────────│
     │ 200 OK                     │
     │ { rendered_prompt: "..." }  │
     │                            │
```

#### Templates → DAK Runner Usage

| Template | DAK Runner Usage |
|----------|------------------|
| `core/context_prime.j2` | Injected at SessionStart hook |
| `roles/builder.j2` | Used when spawning builder worker |
| `roles/validator.j2` | Used when spawning validator worker |
| `orch/orchestrator_loop.j2` | Used by RalphLoop for iterations |
| `control_flow/escalation.j2` | Used when max retries exceeded |
| `evidence/receipt_emit.j2` | Template for receipt formatting |

**Context Injection:**
```typescript
// src/context/builder.ts
export class ContextPackBuilder {
  async build(inputs: ContextPackInputs): Promise<ContextPack> {
    // 1. Load AGENTS.md hash
    // 2. Load policy bundle
    // 3. Load DAG slice
    // 4. Load plan artifacts
    // 5. Render context_prime template with variables
    // 6. Seal and return
  }
}
```

---

### 5. Cookbooks (`agents/cookbooks/`)

#### `policy-injection.md` → `src/policy/injection.ts`

**Cookbook Steps → Implementation:**

| Cookbook Step | Implementation |
|---------------|----------------|
| Load policy bundle | `PolicyInjector.loadBundle()` |
| Validate bundle hash | Hash verification in `loadBundle()` |
| Generate marker | `createInjectionMarker()` |
| Sign marker | Signature generation in `inject()` |
| Persist marker | `persistMarker()` to `.allternit/markers/` |

#### `ralph-loop.md` → `src/loop/ralph.ts`

**Cookbook Flow → Implementation:**

```
Cookbook: ralph-loop.md          Implementation: ralph.ts
─────────────────────            ───────────────────────
1. Initialize iteration     →    Set iteration = 0
2. Spawn builder            →    workerManager.spawnBuilder()
3. Await build_report       →    await builder.complete
4. Spawn validator          →    workerManager.spawnValidator()
5. Await validator_report   →    await validator.complete
6. Check PASS/FAIL          →    report.status === 'PASS'
7. If FAIL, check max       →    iteration < maxIterations
8. If max exceeded          →    escalate()
```

---

## Hook Lifecycle Mapping

The hook lifecycle defined in `agents/AGENTS.md` maps to DAK Runner implementation:

```
AGENTS.md Hook          DAK Runner Implementation
─────────────────────────────────────────────────
SessionStart       →    src/hooks/runtime.ts::HookRuntime
                        - Inject context pack
                        - Emit session_start marker

UserPromptSubmit   →    src/runner/agent-runner.ts
                        - Parse user intent
                        - Load DAG/WIH

PreToolUse         →    src/tools/enforce.ts
                        - Call Rails gate check
                        - Validate lease scope
                        - Emit tool_call_pre receipt

ToolExecution      →    src/tools/executor.ts
                        - Execute tool
                        - Store snapshot (if configured)

PostToolUse        →    src/hooks/runtime.ts
                        - Emit tool_call_post receipt
                        - Update metrics

PostToolUseFailure →    src/hooks/runtime.ts
                        - Emit tool_call_failure receipt
                        - Trigger retry logic

SessionEnd         →    src/hooks/runtime.ts
                        - Cleanup leases
                        - Finalize receipts
                        - Emit cleanup_and_seal
```

---

## Receipt Mapping

### Required Receipts (All Roles)

| Receipt | AGENTS.md Definition | DAK Runner Implementation |
|---------|---------------------|---------------------------|
| `injection_marker` | Context assembled | `src/policy/injection.ts::createInjectionMarker()` |
| `context_pack_seal` | Context sealed | `src/context/builder.ts::sealContextPack()` |
| `tool_call_pre` | Before each tool | `src/tools/enforce.ts::emitReceipt()` |
| `tool_call_post` | After successful tool | `src/hooks/runtime.ts::onToolSuccess()` |
| `tool_call_failure` | After failed tool | `src/hooks/runtime.ts::onToolFailure()` |

### Role-Specific Receipts

| Role | Receipt | Implementation |
|------|---------|----------------|
| Builder | `build_report` | `src/reports/schemas.ts::createBuilderReport()` |
| Validator | `validator_report` | `src/reports/schemas.ts::createValidatorReport()` |
| Security | `security_report` | `src/reports/schemas.ts::createSecurityReport()` |

---

## File Path Mapping

| Agents Folder | DAK Runner Reads | DAK Runner Writes |
|---------------|------------------|-------------------|
| `agents/AGENTS.md` | Hash for context injection | Never |
| `agents/spec/*.md` | Reference for implementation | Never |
| `agents/roles/*.md` | Role constraints | Never |
| `agents/packs/*.yaml` | Pack definitions | Never |
| `agents/packs/templates/*.j2` | Template loading via PFS | Never |
| `agents/cookbooks/*.md` | Procedures | Never |

**Write Locations (Runner Workspace):**
- `.allternit/runner/{run_id}/` - Execution artifacts
- `.allternit/snapshots/` - Tool snapshots
- `.allternit/markers/` - Policy injection markers

**Read-Only Locations (Rails Managed):**
- `.allternit/ledger/` - Canonical state
- `.allternit/leases/` - Active leases
- `.allternit/receipts/` - Emitted receipts
- `.allternit/graphs/` - DAG definitions
- `.allternit/wih/` - Work item headers

---

## Compliance Verification

To verify DAK Runner complies with agents/AGENTS.md:

### Automated Checks

```typescript
// __tests__/compliance.test.ts
describe('AGENTS.md Compliance', () => {
  it('should check all tool calls have PreToolUse gate receipts', async () => {
    const run = await executeTestDAG();
    for (const toolCall of run.toolCalls) {
      expect(toolCall.receipts).toContain('tool_call_pre');
      expect(toolCall.gateCheck).toBeDefined();
    }
  });

  it('should verify no writes outside runner workspace without lease', async () => {
    const writes = await monitorFileWrites();
    for (const write of writes) {
      if (write.path.startsWith('.allternit/ledger/')) {
        expect(write.source).toBe('rails');
      }
    }
  });

  it('should confirm validator PASS before WIH close', async () => {
    const run = await executeTestWIH();
    const wihClose = run.events.find(e => e.type === 'wih_close');
    const validatorPass = run.events.find(e => 
      e.type === 'validator_report' && e.status === 'PASS'
    );
    expect(validatorPass.timestamp).toBeLessThan(wihClose.timestamp);
  });

  it('should validate context injection at each boundary', async () => {
    const run = await executeTestWithBoundaries();
    for (const boundary of run.boundaries) {
      expect(boundary.markers).toContain('injection_marker');
    }
  });
});
```

---

## Summary

| Agents Component | DAK Runner Module | Key Files |
|-----------------|-------------------|-----------|
| `AGENTS.md` (Law) | Enforcement | `src/policy/`, `src/tools/enforce.ts` |
| `spec/DAG_SCHEMA.md` | DAG Engine | `src/dag/parser.ts`, `src/dag/executor.ts` |
| `spec/WIH_SCHEMA.md` | WIH Parser | `src/wih/parser.ts`, `src/wih/types.ts` |
| `spec/BRIDGE_RAILS_RUNNER.md` | Rails Adapter | `src/adapters/rails_api.ts` |
| `roles/orchestrator.md` | Ralph Loop | `src/loop/ralph.ts` |
| `roles/builder.md` | Worker Manager | `src/workers/manager.ts` |
| `roles/validator.md` | Report Schemas | `src/reports/schemas.ts` |
| `packs/templates/*.j2` | Context Builder | `src/context/builder.ts` |
| `cookbooks/*.md` | Procedures | Implemented across modules |

---

**The DAK Runner is the executable implementation of the agents/ folder specifications.**
