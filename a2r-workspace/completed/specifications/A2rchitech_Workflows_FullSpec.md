# /spec/layers/workflows/FullSpec.md
# A2rchitech Workflow Engine Specification
## Scientific-Loop, Deterministic Orchestration

Status: Canonical  
Layer: L3 Agent Orchestration  
Scope: All agent-driven execution (software + robotics)

---

## 1. Purpose
The Workflow Engine is the **deterministic backbone** of A2rchitech.
It executes agent work as explicit, replayable programs.

Every workflow encodes the **scientific loop**:
OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN

No workflow may bypass this loop.

---

## 2. Core Responsibilities
- Execute workflows as DAGs
- Enforce phase ordering
- Manage retries, checkpoints, and rollbacks
- Emit artifacts and events
- Enforce success/failure criteria
- Enable deterministic replay

Non-responsibilities:
- No policy decisions
- No tool execution
- No memory writes (only candidates)

---

## 3. Workflow Definition Model

### 3.1 Workflow Manifest
Each workflow has a manifest declaring:
- workflow_id
- version
- description
- required roles
- allowed skill tiers
- phases used
- success criteria
- failure modes

### 3.2 Phase Nodes
Each phase node:
- binds to an agent role
- declares input artifacts
- declares output artifacts
- declares allowed skills
- declares time/budget constraints

---

## 4. Canonical Phases

### OBSERVE
- Collect initial state
- Retrieve scoped context
- Validate inputs
- No side effects allowed

### THINK
- Reasoning and analysis
- Hypothesis generation
- No side effects allowed

### PLAN
- Produce an execution plan
- Decompose into steps
- No side effects allowed

### BUILD
- Construct artifacts (code, configs, skills)
- Side effects allowed only in sandbox

### EXECUTE
- Run side-effecting skills
- Must pass policy + tool gateway

### VERIFY
- Validate outputs against success criteria
- Run tests, evals, simulations
- Failure here blocks promotion

### LEARN
- Propose memory or skill deltas
- Never commits directly
- Emits candidates for meta-pipelines

---

## 5. DAG Semantics

- Workflows are directed acyclic graphs
- Parallelism allowed within phases
- Phase boundaries are hard barriers
- Checkpoints stored after each phase

---

## 6. Failure Handling

### 6.1 Retry Policy
- Configurable retries per node
- Backoff strategies
- Retryable vs terminal failures

### 6.2 Rollback
- Rollback artifacts to last checkpoint
- Revert skills/configs via registry
- Emit failure artifacts + diagnostics

---

## 7. Artifacts

Artifacts are first-class:
- plans
- diffs
- reports
- datasets
- binaries
- simulation results

Artifacts must be:
- content-addressed
- immutable
- referenced by pointer

---

## 8. Integration with Messaging
- Each node execution is a Task
- Phase transitions emit Events
- Trace IDs preserved end-to-end

---

## 9. Integration with Policy
- Workflow manifests declare allowed tiers
- EXECUTE phase blocked until policy approval
- VERIFY may downgrade permissions on failure

---

## 10. Robotics Workflows
Robotics workflows extend EXECUTE and VERIFY with:
- simulation-first enforcement
- staged permission elevation
- telemetry-driven verification
- physical rollback semantics where possible

---

## 11. Acceptance Criteria
A valid workflow must:
1) enforce scientific loop ordering
2) be replayable from ledger
3) emit complete artifacts
4) block side effects outside EXECUTE
5) fail safely and audibly

---

End of Workflow Engine Specification
