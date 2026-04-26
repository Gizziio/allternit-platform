# GAPS IDENTIFIED in DAK Implementation

After reviewing all files in `agent/` folder, here are the gaps between the spec and my implementation:

## CRITICAL GAPS

### 1. DAG Schema Support (MISSING)
**Spec:** `agent/Agentic Prompts/formats/dag-schema.md`

**What's Missing:**
- DAG YAML parser (dag_version, dag_id, title, defaults, nodes)
- Topological sort for node execution
- Gate evaluation (validator_pass, tests_green, lint_green, policy_pass, etc.)
- Dependency tracking (depends_on)
- Concurrency policy (max_parallel_nodes)

**Required:**
```typescript
// src/dag/parser.ts
export interface DagDefinition {
  dag_version: number;
  dag_id: string;
  title: string;
  defaults: DagDefaults;
  nodes: DagNode[];
  hooks?: DagHooks;
  concurrency?: ConcurrencyPolicy;
}

export interface DagNode {
  id: string;
  wih: string;  // Path to WIH file
  depends_on: string[];
  gates: string[];
  roles: RoleAssignments;
  loop?: LoopConfig;
  stop_conditions?: StopConditions;
  output?: OutputConfig;
}
```

### 2. WIH Schema Support (MISSING)
**Spec:** `agent/Agentic Prompts/formats/wih-scheme.md`

**What's Missing:**
- WIH Markdown parser with YAML front matter
- WIH validation against schema
- WIH scope enforcement (allowed_paths, forbidden_paths, allowed_tools)
- Acceptance criteria tracking
- Blockers and stop conditions handling

**Required:**
```typescript
// src/wih/parser.ts
export interface WIH {
  wih_version: number;
  work_item_id: string;
  title: string;
  owner_role: string;
  assigned_roles: RoleAssignments;
  inputs: WIHInputs;
  scope: WIHScope;
  outputs: WIHOutputs;
  acceptance: AcceptanceCriteria;
  blockers: Blockers;
  stop_conditions: StopConditions;
}

export interface WIHScope {
  allowed_paths: string[];
  forbidden_paths: string[];
  allowed_tools: string[];
  forbidden_tools: string[];
  execution_permission: ExecutionPermission;
}
```

### 3. Prompt Format Spec (PFS v1) Support (INCOMPLETE)
**Spec:** `agent/Agentic Prompts/formats/prompt-format-spec-v1.md`

**What's Missing:**
- Full PFS v1 parser with all metadata fields
- Variables declaration and validation
- Instructions section parsing
- Workflow section (STEP 1, STEP 2, etc.)
- Report format schema enforcement
- Examples section handling

**Current:** Basic Jinja2 rendering only
**Required:** Full PFS v1 compliance with all 8 sections

### 4. Specific Prompt Pack Templates (MISSING)
**Spec:** `agent/Agentic Prompts/prompt-packs-index.md` defines 13 packs

**Missing Packs:**

#### Core Packs (4):
1. `allternit.pack.core.context_prime@v1` - Context injection marker
2. `allternit.pack.core.normalize_request_to_wih_dag@v1` - User prompt → DAG/WIH
3. `allternit.pack.core.plan_with_files@v1` - Plan files management
4. `allternit.pack.core.cleanup_and_seal@v1` - End-of-run cleanup

#### Orchestration Packs (3):
5. `allternit.pack.orch.orchestrator_loop@v1` - Ralph loop orchestration
6. `allternit.pack.orch.delegation_spawn@v1` - Worker spawning
7. `allternit.pack.orch.control_flow@v1` - Conditional branching

#### Role Packs (4):
8. `allternit.pack.role.builder@v1` - Builder role prompt
9. `allternit.pack.role.validator@v1` - Validator role prompt
10. `allternit.pack.role.reviewer@v1` - Reviewer role prompt
11. `allternit.pack.role.security@v1` - Security role prompt

#### Evidence Packs (2):
12. `allternit.pack.evidence.receipt_emit@v1` - Receipt generation
13. `allternit.pack.evidence.trace_summarize@v1` - Compaction summaries

**Required:**
Create `agents/packs/templates/` with all 13 packs following PFS v1 format.

### 5. Report Format Schemas (MISSING)
**From:** `wih-scheme.md` and `prompt-format-spec-v1.md`

**Missing:**
- `build_report.yaml` schema
- `validator_report.yaml` schema
- `security_report.yaml` schema
- `review_report.md` schema

**Required:**
```yaml
# validator_report.yaml schema
result: "PASS" | "FAIL"
violations: []
required_fixes: []
evidence: []
```

### 6. Agent Execution Request/Receipt Types (INCOMPLETE)
**From:** `agent/examples/agent_execution_*.json`

**What's Missing:**
- Proper TypeScript types matching the examples
- Receipt aggregation (node_receipts, tool_receipts, subprocess_receipts)
- Run state management

**Current:** Basic types exist
**Required:** Match example JSON exactly

### 7. Folder Structure Gaps
**From:** `agent/spec/AgentRunner_System_Spec_v1.md`

**Missing Folders:**
- `src/dag/` - DAG parser and executor
- `src/wih/` - WIH parser and validator
- `src/packs/templates/` - PFS v1 prompt templates
- `src/policy/injection_marker.ts` - Injection marker emitter
- `src/context/slicer.ts` - DAG/receipts slicing
- `src/context/seal.ts` - Integrity metadata
- `src/observability/store.sqlite` - Optional SQLite store
- `tests/determinism/` - Determinism tests
- `tests/idempotency/` - Idempotency tests
- `tests/slicing/` - Context slicing tests

### 8. Policy Bundle Integration (INCOMPLETE)
**From:** `agent/spec/AgentRunner_System_Spec_v1.md`

**What's Missing:**
- `src/policy/injection_marker.ts` - Emit injection marker receipt
- `src/policy/agents_md/` - Cached render / hash snapshots
- Integration with ContextPack builder for policy injection

### 9. Tool Snapshot Support (MISSING)
**From:** `agent/spec/AgentRunner_System_Spec_v1.md`

**What's Missing:**
- `src/tools/snapshots/` - Web fetch/search snapshots for replay
- Snapshot storage and retrieval
- Replay using snapshots

### 10. Rails Integration Gaps
**From:** `agent/spec/bridge-rails-runner.md`

**What's Missing:**
- Full gate.check/commit/fail contract implementation
- Receipt format exactly as specified
- PromptDeltaNeeded escalation
- PermissionRequest flow

## SUMMARY

**Completed:**
- ✅ Basic hook runtime
- ✅ Tool registry with schemas
- ✅ Policy engine with decisions
- ✅ Rails adapter (basic)
- ✅ Context pack builder (basic)
- ✅ Plan manager
- ✅ Worker manager
- ✅ Ralph loop (basic)
- ✅ Observability events
- ✅ Prompt Pack Service (Rust)

**Missing:**
- ❌ DAG YAML parser and executor
- ❌ WIH Markdown parser
- ❌ PFS v1 full support
- ❌ All 13 prompt pack templates
- ❌ Report format schemas
- ❌ Complete folder structure
- ❌ Policy injection markers
- ❌ Tool snapshots
- ❌ Full Rails contract

**Next Agent Should:**
1. Implement DAG parser (`src/dag/`)
2. Implement WIH parser (`src/wih/`)
3. Create all 13 prompt pack templates
4. Add report format schemas
5. Complete policy injection system
6. Add comprehensive tests
