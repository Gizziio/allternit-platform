# A:// Coordination Protocol

**Status:** Internal architecture contract. Implementation-backed where marked; not a public interoperability claim.

## 1. Purpose

A:// is Allternit's coordination protocol for humans, agents, bots, tools, models, services, runtimes, and compute.

A:// defines the common grammar for identity, addressing, intent, delegation, capabilities, policy, execution ownership, approvals, events, attribution, results, and transport-independent coordination.

A:// does **not** mean one omnipotent agent owns every action.

> A:// is not the intelligence. A:// is the protocol by which intelligence coordinates.

The user-facing Coworker is **A://**, pronounced **Al**. In technical specifications and code, use lowercase `a://` for the protocol namespace and reserve **Al** for the persistent user-facing principal/persona.

## 2. Architectural invariants

1. **Identity != model != session.** A principal may outlive any model process or conversation.
2. **Orchestration is a role, not a security root.** Al is the default orchestrator, not a mandatory ancestor of every action.
3. **Every actor is independently attributable.** Initiator, delegator, and executor are distinct when applicable.
4. **Capabilities and permissions are separate.** A worker may be technically capable of an action and still be denied by policy.
5. **Possession of an `a://` address is not authentication.** Principal identity must be proven by the execution transport.
6. **A component is not A:// conformant merely because it stores an `a://` identifier.** Conformance requires participation in the relevant lifecycle.
7. **Cowork is the control room, not the identity.** Cowork observes and governs runs, principals, approvals, artifacts, and events.
8. **Fabric Transport is the worker/lease execution transport, not the A:// protocol itself.**

## 3. Product identities

### 3.1 Al

Canonical user-facing identity: **A://**

Pronunciation: **Al**

Technical role:

```text
principal: a://workspace/{workspace}/principal/al
roles:
  - orchestrator
  - user-interface
```

Al receives work, creates or delegates intent, tracks runs, requests approval, and reports outcomes. Al does not automatically own every connector credential, every bot memory, every execution authority, or every audit event.

### 3.2 Gizzi

Gizzi is the primary technical worker below Al: Gizzi Code / terminal / repository / build / debugging / developer-environment work.

```text
principal: a://workspace/{workspace}/principal/gizzi
roles:
  - worker
  - code
  - terminal
```

Gizzi is not the Coworker identity.

### 3.3 User-created bots

Bots are first-class persistent worker principals with independent identity, permissions, credentials, memory scope, triggers, compute policy, model policy, budgets, and audit history.

Example:

```text
a://workspace/acme/bot/research
a://workspace/acme/bot/bookkeeper
```

## 4. Four-layer model

A:// rests on four separable layers:

```text
Participants / Principals
    identity, credentials, memory, policy, attribution

Roles
    orchestrator, worker, reviewer, observer, human, system

Transport
    CommRails and other transports carry semantic messages

Execution
    Run/DAG runtime + Fabric Transport lease ownership
```

No layer should silently absorb the responsibility of another.

## 5. Addressing

Canonical persisted addresses are workspace scoped.

```text
a://workspace/{workspace}/principal/{principal}
a://workspace/{workspace}/bot/{bot}
a://workspace/{workspace}/run/{run}
a://workspace/{workspace}/artifact/{artifact}
a://workspace/{workspace}/connector/{connector}
a://workspace/{workspace}/compute/{target}
```

Short aliases such as `a://bot/research` may exist after workspace resolution, but persisted identities must remain tenant safe.

The `a://` namespace is an **internal logical address space**. It does not promise an operating-system URI handler, DNS-like resolution, or public scheme interoperability.

## 6. Intent

A:// work should normalize into an Intent envelope before execution.

Conceptual shape:

```yaml
version: a/0.1
intent_id: intent_...
workspace: a://workspace/acme
initiator:
  principal: a://workspace/acme/user/joe
target:
  principal: a://workspace/acme/bot/research
action:
  type: research
  description: Compare three vendors.
permissions:
  requested:
    - web.read
    - files.project.read
compute:
  policy: auto
model:
  policy: router:auto
approval:
  policy: risk-gated
return:
  channel: cowork
```

An Intent describes requested work. It does not imply that execution has begun.

## 7. Runs, jobs, and execution ownership

The canonical execution path is:

```text
Intent
  -> Run
  -> DAG / Jobs
  -> queued Job
  -> Fabric Transport claim
  -> active lease generation
  -> execution
  -> heartbeat / renew
  -> completion | failure | expiry | reassignment
  -> Result
  -> attributed events / ledger
```

A UI must not report work as running merely because a model said it delegated the task. Running work requires a valid runtime state and execution ownership.

## 8. Fabric Transport and Lease Protocol

Fabric Transport is the current worker-facing implementation of durable execution ownership.

Current API surface is under:

```text
/api/v1/fabric/transport/*
```

The transport implements the worker lifecycle around:

- principal registration/authentication
- long-poll claim
- capability eligibility
- persistence-level atomic claim
- lease ID and lease generation
- server-authoritative expiry
- heartbeat
- renew
- expiry/requeue
- stale-generation rejection
- attributed completion

### 8.1 Canonical correctness rules

- Claim exclusivity must be enforced in the persistence layer, not only with an in-process lock.
- `lease_generation` increases when execution ownership changes.
- Lease expiry is evaluated using the server clock.
- A stale worker cannot complete work using an expired generation.
- Recovery resumes from the last committed checkpoint; in-memory process state is not assumed portable.
- v0.1 worker discovery uses long-poll claim. CommRails push may optimize wake-up but is not required for correctness.

## 9. Principal authentication

Executable principals are workspace-scoped identities. Workers authenticate before claiming or mutating leased jobs.

The current local proof slice stores hashed bearer credentials in `cowork_principals`. Raw tokens are not the principal identity; the authenticated token resolves to one.

Future transports may use local peer identity, short-lived worker credentials, mTLS, or enrolled-machine identity, but all mechanisms must bind the runtime process to the principal that acts.

## 10. Capabilities and policy

Capabilities are flat, namespaced strings in v0.1.

Examples:

```text
web.read
files.project.read
files.project.write
shell.exec
git.read
git.write
gui.observe
gui.control
browser.navigate
connector.github.read
connector.github.write
artifact.create
```

Workers declare capabilities. Jobs declare required capabilities. The transport may only grant execution to an eligible principal.

Capability means **can**. Policy means **may**.

## 11. Delegation and causation

Delegation preserves provenance.

```text
User -> Al -> Research Bot -> Browser Bot
```

Material events should preserve initiator, delegator, and executor.

Delegation must not implicitly transfer all credentials or permissions from the delegator to the executor.

Delegation chains must reject cycles. A configurable maximum depth should be enforced when multi-hop delegation is enabled.

## 12. Approvals

Approval is scoped to the actual action and execution context. At minimum, protected approval should be bindable to executor, capability, target, run, job, and lease generation.

When execution ownership changes, stale approval must not silently authorize a new executor or a new lease generation unless an explicit reusable policy says otherwise.

## 13. Attribution

A:// audit semantics distinguish who asked, who delegated, and who acted.

```yaml
initiator: a://workspace/acme/user/joe
delegator: a://workspace/acme/principal/al
executor: a://workspace/acme/bot/research
```

Al must not appear as executor merely because Al coordinated the work.

The event/ledger layer should allow an auditor to answer:

- who requested this?
- who delegated it?
- who executed it?
- under what policy?
- with which capabilities/connectors?
- on which compute?
- what result was committed?

## 14. Cowork

Cowork is the control room for A:// activity.

It should expose canonical runtime truth for conversation, plans, runs and jobs, principals and bots, delegations, approvals, timelines, artifacts, connectors, compute, and event/audit history.

Al may be conversationally present in Cowork, but Cowork must not collapse into a transcript that hides execution state.

## 15. Transport independence

A:// defines coordination semantics. CommRails, HTTP, WebSocket, local IPC, Slack adapters, email adapters, or future transports can carry those semantics.

Transport does not redefine principal identity, run state, attribution, or approval meaning.

## 16. Current implementation status

### Implemented / backed by code

- workspace-scoped `cowork_principals`
- bearer token hash authentication for Fabric Transport proof slice
- principal capability storage
- job lease ID / generation / expiry / claimed-at fields
- required job capabilities
- initiator / delegator / executor attribution fields
- long-poll worker claim API
- persistence-level atomic claim path
- heartbeat / renew / complete API
- lease sweeper / expiry path
- stale lease-generation protection
- typed result storage on jobs
- Fabric Transport terminology and `/api/v1/fabric/transport/*` routes

### Partial / still needs hardening

- full IntentEnvelope as a first-class canonical type/store
- approval-to-lease binding across all protected tools/connectors
- principal-scoped memory and connector brokerage
- canonical multi-store consolidation beyond the proof slice
- delegation-depth / causation-chain enforcement across every execution path
- complete capability vocabulary across all workers
- cross-surface Cowork visualization of the protocol entities

### Planned / not implied by v0.1

- public URI scheme registration
- public interoperability standard
- every Allternit subsystem being A:// conformant
- every bot or connector using Fabric Transport automatically

## 17. Conformance

A worker may claim A:// worker conformance only when it can:

1. resolve/authenticate a principal identity;
2. declare and satisfy capabilities;
3. claim work under the canonical execution-ownership rules;
4. maintain or lose a lease correctly;
5. emit attributable events;
6. obey approval/policy boundaries;
7. reject stale execution authority;
8. commit a result exactly once.

A surface may claim A:// control conformance only when it observes canonical runtime state instead of deriving authority from model text.

## 18. Naming rules

Use these names consistently:

- **A://** — branded user-facing mark; pronounced **Al** when referring to the Coworker persona.
- **Al** — the persistent user-facing principal/persona.
- **`a://`** — protocol namespace in code/spec prose.
- **Fabric Transport** — worker-facing execution transport and lease mechanism.
- **CommRails** — peer/message transport layer.
- **Run/DAG runtime** — durable execution state machine.
- **Cowork** — human control room.
- **Gizzi** — technical/terminal/code worker.
- **Bot** — independently permissioned persistent worker identity.

Avoid saying "A:// decided" in implementation docs when the actor is actually Al, a bot, a policy engine, or the runtime.

## 19. Source-of-truth rule

When prose and code disagree, do not silently preserve both descriptions. Update this document or explicitly mark the implementation as non-conformant.

Every future Cowork, Bot, Fabric, or agent feature should answer:

> Does this participate in A://, or are we creating another execution island?
