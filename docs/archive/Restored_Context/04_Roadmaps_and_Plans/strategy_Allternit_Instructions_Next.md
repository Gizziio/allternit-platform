# Allternit OS Contract

## Purpose

This document defines the **authoritative execution contract** between:

- UI Surfaces
- Runtime Harness
- Governance Kernel
- System Kernel
- Services
- Adapters

It exists to prevent architectural drift.

No component may bypass this contract.

---

## Layer Roles (Authoritative)

| Layer | Name | Responsibility |
|------|-----|-------------|
| 0 | Substrate | Shared schemas, protocols, types |
| 1 | Kernel | Execution engines, sandboxes, process runners |
| 2 | Governance | Policy, WIH, approvals, receipts |
| 3 | Adapters | Runtime harness & vendor bridges |
| 4 | Services | Schedulers, routers, monitors |
| 5 | UI | Shell platform & embodiment |
| 6 | Apps | Entry points |

---

## Execution Flow (Canonical)

Every action in the system flows:

[UI/App]
↓
[Runtime Harness]
↓
[Governance]
↓
[Kernel]
↓
[Services / Providers]
↑
[Receipts + Events]

No exceptions.

---

## Component Interfaces

---

### UI → Runtime Harness

UI may only communicate with:

@allternit/runtime

#### UI Request Envelope

```ts
interface RuntimeRequest {
  request_id: string
  app_id: string
  user_id: string
  session_id: string

  intent: string
  mode: "cowork" | "code" | "cli" | "automation"

  dag?: DagSpec
  tools?: ToolInvocation[]

  context_refs?: string[]
}

UI never calls:
	•	governance
	•	kernel
	•	services
	•	vendors

directly.

⸻

Runtime Harness → Governance

Runtime must request permission before any execution.

interface GovernanceApprovalRequest {
  request_id: string
  actor: AgentIdentity

  intent: string
  resources: ResourceScope[]
  tools: string[]

  dag?: DagSpec
}

Governance returns:

interface GovernanceApproval {
  wih_id: string
  approved: boolean
  constraints: ExecutionConstraints
}


⸻

Governance → Kernel

Kernel is never called without:
	•	WIH
	•	scope
	•	constraints
	•	execution ID

interface KernelExecutionRequest {
  wih_id: string
  exec_id: string

  command: KernelCommand
  sandbox: SandboxSpec
  limits: ResourceLimits
}


⸻

Kernel → Services

Kernel may delegate:
	•	scheduling
	•	browser automation
	•	memory ops
	•	orchestration
	•	telemetry

to registered services.

Services cannot self-spawn tasks.

⸻

Services → Runtime

All service output returns to runtime as:

interface ExecutionEvent {
  exec_id: string
  stage: string
  output: unknown
  logs: string[]
}


⸻

Runtime → UI

UI only sees:
	•	structured results
	•	receipts
	•	progress
	•	artifacts
	•	errors

Never raw kernel handles.

⸻

Work-In-Hand (WIH)

Every execution requires:
	•	ticket issuance
	•	scope binding
	•	audit trail
	•	receipt generation

interface WorkInHand {
  wih_id: string
  actor: AgentIdentity
  permissions: PermissionSet
  expires_at: string
}


⸻

Receipts

All side effects generate receipts:

interface Receipt {
  receipt_id: string
  wih_id: string

  files_written: string[]
  commands_run: string[]
  network_calls: string[]

  duration_ms: number
  model_cost?: number
}

Receipts are immutable.

⸻

DAG Contract

Multi-agent workflows are expressed as DAGs.

interface DagSpec {
  id: string
  nodes: DagNode[]
  edges: DagEdge[]
}

Nodes cannot execute unless:
	•	upstream nodes completed
	•	WIH still valid
	•	constraints satisfied

⸻

Import Rules (Enforced)

Layer	May Import
6-apps	5-ui
5-ui	services
services	services, domains/governance
services	domains/governance, domains/kernel
domains/governance	domains/kernel, infrastructure
domains/kernel	infrastructure
infrastructure	none

Vendor code may only exist in:

services/vendor/


⸻

Rebranding Policy

Forked projects:
	•	UI-TARS
	•	OpenWork
	•	WebVM

must:
	•	live under vendor/
	•	be wrapped by Allternit adapters
	•	expose no public APIs
	•	be renamed internally

Public packages always use:

@allternit/*


⸻

Embodiment Systems

Agent presence systems (voice orb, UI-TARS forks, motion engines) are:

UI embodiment layers, not runtimes.

They belong in:

5-ui/embodiment/

They consume runtime streams.

They never invoke tools directly.

⸻

Enforcement Mechanisms

The following must exist:
	•	lint rules for import boundaries
	•	TS path aliases by layer
	•	cargo workspace segmentation
	•	CI boundary tests
	•	runtime spawn guards
	•	WIH validators
	•	receipt validators

⸻

Invariants

These are non-negotiable:
	•	No execution without WIH
	•	No vendor imports into UI
	•	No kernel access from UI
	•	No silent background jobs
	•	No service self-spawning
	•	No cross-layer shortcuts

⸻

Future Targets

The OS contract is designed to allow:
	•	cloud execution pools
	•	edge devices
	•	robotic hosts
	•	WebVM sandboxes
	•	cluster schedulers
	•	distributed memory

without changing UI or governance layers.

⸻

Canonical Status

This file is authoritative.

Any change to execution flow, runtime surface, or layer boundaries requires:
	•	spec update
	•	migration plan
	•	rollback strategy
	•	audit pass
	•	CI gate updates

---
