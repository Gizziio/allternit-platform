# A://TERNIT --- Swarm Runtime Kernel Spec v1

**Doc ID:** Allternit-SWARM-KERNEL-v1\
**Date:** 2026-02-19\
**Status:** Draft (ready for implementation)

------------------------------------------------------------------------

## 0. Why this is not a pivot

This spec does **not** replace the Agent Studio or existing
orchestration work. It formalizes a missing layer:

> A deterministic, policy-bound, cost-governed swarm execution kernel.

A://TERNIT already aims to orchestrate multi-agent work. This spec
turns that intent into: - a precise runtime contract, - deterministic
scheduling semantics, - conflict arbitration rules, - failure
containment, so swarms become production-grade.

------------------------------------------------------------------------

## 1. Problem statement

Parallel agent teams without a kernel spec produce: - non-deterministic
behavior, - uncontrolled cost, - conflicting edits, - unreliable
merges, - weak auditability.

A swarm kernel must coordinate many agents as if they are a single
bounded machine.

------------------------------------------------------------------------

## 2. Goals

1.  Deterministic DAG execution (given fixed inputs and policies).
2.  Parallelism without shared mutable state.
3.  Explicit inter-agent communication channels.
4.  Conflict arbitration (code changes, PR merges).
5.  Budget-aware scheduling (quotas, kill switches).
6.  Evidence-first outputs (receipts, artifacts, lineage).
7.  Multi-tenant safety (trust-tiered behavior).

------------------------------------------------------------------------

## 3. Non-goals

-   A specific LLM provider API.
-   A specific hypervisor/container runtime.
-   A "personality" system for agents (handled in Agent Studio layer).

------------------------------------------------------------------------

## 4. Core objects

### 4.1 Swarm

A swarm is an execution graph with: - `swarmId`, `tenantId`,
`projectId` - `graph` (DAG) - `policy` (policyHash) - `budget`
(limits) - `inputs` (context pack references) - `agents` (roles +
capability requirements)

### 4.2 Node (Task)

A node is a unit of work: - id, name - dependencies (edges) - required
capabilities - environment requirement (NES ref or profile) - expected
artifacts - acceptance checks (tests, linters)

### 4.3 Worker

A worker is a sandboxed execution unit mapped 1:1 to an Environment
Instance: - `workerId`, `envInstanceId`, `envHash` - scoped
credentials - resource caps

### 4.4 Receipt

An append-only evidence record: - tool calls, commands, stdout/stderr -
hashes: envHash, policyHash, inputsHash, codeHash - artifact manifests
with integrity hashes

------------------------------------------------------------------------

## 5. Deterministic scheduling semantics

### 5.1 DAG model

-   Graph must be acyclic.
-   Scheduler executes a topological order.
-   A node becomes **READY** when all dependencies are **DONE**.

### 5.2 Determinism rules (v1)

Given fixed (graph + inputs + policy + env specs): - node admission
order is deterministic: - READY queue ordered by (priority, then nodeId
lexical) - worker assignment deterministic: - assign smallest available
workerId - retries deterministic: - fixed backoff schedule, bounded by
policy

### 5.3 Concurrency controls

Enforce caps at: - tenant level - project level - swarm level - per-node
max parallelism

------------------------------------------------------------------------

## 6. Swarm execution phases

1.  **Plan**
    -   validate DAG
    -   validate budgets and policy
    -   resolve node environment profiles to NES references
2.  **Allocate**
    -   request worker slots from execution fabric
    -   enforce quotas and budgets
3.  **Execute**
    -   for each READY node:
        -   spawn/attach Environment Instance (EI)
        -   run node commands/tools
        -   run node validation checks
        -   collect artifacts
        -   emit receipts
4.  **Aggregate**
    -   combine patches, reports, and test evidence
    -   run conflict arbitration
    -   produce PR(s) or change sets
5.  **Govern**
    -   apply merge gates
    -   optionally request approvals
    -   publish outputs to repo/SCM
6.  **Teardown**
    -   destroy EIs
    -   finalize ledger entries

------------------------------------------------------------------------

## 7. Inter-agent communication (no shared mutable state)

### 7.1 Channels

Agents may communicate only via explicit channels: - message bus
(control plane mediated) - shared read-only context packs - shared
artifact store (append-only manifests)

No direct shared filesystem. No shared DB state unless declared as a
service in NES and scoped to swarm.

### 7.2 Message schema (v1)

Messages are typed: - `status`, `finding`, `proposal`, `patch`,
`question`, `approval_request` All messages are logged in receipts.

------------------------------------------------------------------------

## 8. Conflict arbitration

### 8.1 Code conflicts

If multiple nodes produce overlapping diffs: - detect overlap by
file+range (or git merge-base) - arbitration strategy (v1 defaults): 1.
prefer higher-priority node 2. if equal priority: prefer node with
stronger evidence (tests passed + narrower diff) 3. otherwise: split
into separate PRs

### 8.2 PR strategy

Swarm can emit: - one PR per node - one PR per group (subgraph) - a
consolidated PR (only if conflicts resolved and evidence complete)

Default recommendation: - **one PR per subgraph** with a single merge
arbiter node.

------------------------------------------------------------------------

## 9. Budget + economics (swarm-level enforcement)

Swarm budgets include: - max wall clock time - max CPU-seconds - max
memory-seconds - max egress - max spawned EIs - max retries

Enforcement: - admission control denies new nodes when budget
exhausted - kill switch can terminate workers - receipts must record
budget events

------------------------------------------------------------------------

## 10. Failure model + quarantine

### 10.1 Failure taxonomy (v1)

-   BOOT_FAIL
-   SETUP_FAIL
-   SERVICE_FAIL
-   CHECK_FAIL
-   TEST_FAIL
-   POLICY_VIOLATION
-   TIMEOUT
-   SUSPECTED_COMPROMISE

### 10.2 Retry rules

-   retries only for: TIMEOUT (limited), transient BOOT_FAIL
-   never retry on: POLICY_VIOLATION, SUSPECTED_COMPROMISE without
    operator action

### 10.3 Quarantine

On SUSPECTED_COMPROMISE: - freeze artifacts - block merge and
publication - require operator review - optionally disable agent/version
for tenant

------------------------------------------------------------------------

## 11. Merge governance integration

Swarm outputs must satisfy Merge Governance gates: - required tests
executed inside EI - required receipts present - envHash + policyHash +
inputsHash present - signatures (agent identity, optional human
approval) recorded - risk-tiered auto-merge rules applied

------------------------------------------------------------------------

## 12. Trust tiers

Swarm kernel behavior depends on trust tier: - Public marketplace:
microVM required, default-deny egress, stricter gates - Enterprise BYOC:
customer policies decide; still requires receipts and hashes - Internal:
may allow relaxed gates; still must be auditable

------------------------------------------------------------------------

## 13. Acceptance tests (v1)

1.  Same DAG + inputs produces same node execution order.
2.  No shared mutable state between workers.
3.  Overlapping diffs trigger arbitration rules deterministically.
4.  Budget exhaustion stops new admissions and logs events.
5.  All nodes emit receipts with required hashes.
6.  Policy violations stop execution and record reason.
7.  Quarantine blocks merges and preserves artifacts.

------------------------------------------------------------------------

## 14. Implementation checklist

-   Swarm spec objects + schemas
-   Deterministic scheduler implementation
-   Worker allocation bridge to execution driver
-   Message bus (typed, logged)
-   Diff overlap detector + arbitration
-   Budget metering hooks
-   Merge arbiter integration with SCM
-   Ledger/provenance integration
