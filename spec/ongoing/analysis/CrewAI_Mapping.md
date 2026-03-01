# CrewAI → A2rchitech Concept Mapping

## 1. CrewAI → A2rchitech Concept Mapping Table

| CrewAI Concept | A2rchitech Equivalent | Status | Notes |
|---|---|---|---|
| Agent | ❌ Not a kernel concept | Rejected | Violates determinism and kernel control; agents imply autonomous entities |
| Task | Workflow Node | Partial | Needs strict contract enforcement; must fit into scientific loop phases |
| Crew | Workflow Run | Accepted | Maps directly to kernel's WorkflowExecution concept |
| Process.sequential | Workflow DAG | Accepted | Already exists in A2rchitech as directed acyclic graphs |
| Process.parallel | Workflow DAG | Accepted | With policy gates and resource constraints |
| Agent Memory | Memory Fabric | Accepted | Kernel-governed memory system already superior |
| Tools | Tool Gateway | Accepted | A2rchitech's Tool Gateway is already more sophisticated |
| Delegation | ❌ | Rejected | Breaks auditability and violates policy-before-action principle |
| Collaboration | Workflow Phases | Partial | Scientific loop phases (OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN) provide structured collaboration |
| Planning | Plan Phase | Accepted | Part of scientific loop, policy-gated |
| Execution | Execute Phase | Accepted | Part of scientific loop, goes through Tool Gateway |
| Reflection | Verify Phase | Accepted | Part of scientific loop, requires verification artifacts |
| Human Feedback | Policy Gate | Accepted | Integrated into policy engine |
| Context Sharing | Context Router | Accepted | Precision hydration with safety boundaries |
| Role | Persona Kernel | Partial | Maps to persona concept but must be kernel-controlled |
| Goal | Workflow Success Criteria | Accepted | Defined in workflow specifications |
| Backstory | Persona Metadata | Partial | Part of persona kernel but controlled by governance |
| LLM | Provider Router | Accepted | Model routing through provider abstraction |
| Function Calling | Tool Gateway | Accepted | All side effects through policy-gated gateway |

## 2. Explicit Justification for Rejections

### Agent (Rejected)
- **Reason**: Violates AG2 determinism requirements
- **Invariant Violated**: Kernel must maintain deterministic control over all execution
- **Alternative**: Use persona kernel with policy-gated execution through workflows

### Delegation (Rejected)
- **Reason**: Breaks auditability and creates hidden execution paths
- **Invariant Violated**: All side effects must go through Tool Gateway with policy enforcement
- **Alternative**: Use explicit workflow phases with defined handoffs

### Autonomous Agents (Rejected)
- **Reason**: Creates uncontrolled execution outside kernel governance
- **Invariant Violated**: Kernel must enforce governance and security invariants
- **Alternative**: Use persona kernel with strict policy enforcement

## 3. Structural Compatibility Analysis

### Compatible Concepts
The following CrewAI concepts are structurally compatible with A2rchitech:
- **Sequential/Parallel Processing**: Already implemented as workflow DAGs
- **Tool Integration**: A2rchitech's Tool Gateway is more sophisticated than CrewAI's tools
- **Memory Systems**: A2rchitech's Memory Fabric is more advanced than CrewAI's memory
- **Structured Workflows**: A2rchitech's scientific loop is more rigorous than CrewAI's process

### Incompatible Concepts
The following CrewAI concepts violate A2rchitech kernel contracts:
- **Autonomous Agent Behavior**: Kernel must control all execution paths
- **Hidden State/Learning**: All state changes must be auditable through history ledger
- **Direct LLM Calls**: All provider calls must go through policy engine
- **Agent-to-Agent Communication**: All communication must go through kernel-controlled messaging

## 4. Kernel Contract Compliance

Every mapped concept must comply with these frozen kernel contracts:
- **EventEnvelope**: All events must conform to frozen schema
- **RunModel**: All executions must follow state machine transitions
- **ToolABI**: All side effects must go through Tool Gateway with proper contracts
- **PolicyDecisionArtifact**: All actions must be policy-approved
- **VerifyArtifacts**: All completions must have verification artifacts
- **ContextBundle**: All context must be deterministically compiled