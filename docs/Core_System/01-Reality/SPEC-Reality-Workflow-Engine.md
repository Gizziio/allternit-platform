# Allternit Reality Spec: Workflow Engine & Orchestration

**Location:** `services/orchestration/control-plane/allternit-agent-orchestration/workflows/` & `domains/kernel/allternit-agent-system-rails/src/work/`  
**Status:** IMPLEMENTED / PARTIALLY INTEGRATED  
**Date:** April 14, 2026

## 1. Role
The Workflow Engine is responsible for translating high-level declarative goals (like YAML templates) into deterministic execution plans (DAGs) and coordinating the agents that execute them.

## 2. Declarative Compilation
Implementation: `services/orchestration/control-plane/allternit-agent-orchestration/workflows/src/`
The system provides a robust toolchain for declarative workflows:
- **Loader:** Reads YAML-based workflow and agent definitions.
- **Validator:** Ensures schemas match the strict kernel contracts.
- **Compiler:** Translates valid templates into a deterministic Directed Acyclic Graph (DAG) of execution nodes.

## 3. DAG Execution & Tracking
Implementation: `domains/kernel/allternit-agent-system-rails/src/work/`
The execution of the DAG is managed by the Rails system's "Work-In-Hand" (WIH) state tracking:
- **Cycle Detection:** `graph.rs` ensures that compiled DAGs are acyclic before execution.
- **Node Readiness:** Nodes are dynamically scheduled as their dependencies (`blocked_by` edges) are resolved.

## 4. Current Gaps vs Target
- **Gateway Integration:** The `stdio` routing gateway currently has the workflow compiler explicitly commented out (`// use allternit_workflows::compiler::...`). This indicates that while the engine is built, it is not fully wired into the primary execution paths.
- **Scientific Loop:** The target spec emphasizes a "Scientific Loop" (Plan -> Act -> Validate). While the DAG supports basic dependencies, the advanced RL-based self-correction loops are not natively enforced at the engine level yet.
