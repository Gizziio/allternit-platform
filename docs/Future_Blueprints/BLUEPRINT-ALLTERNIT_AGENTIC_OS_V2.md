# Allternit Agentic OS v2

**Status:** Proposed canonical target architecture  
**Decision type:** System-wide replacement of the legacy web-only AllternitOS  
**Scope:** Runtime, governance, packages, agents, models, state, and every product surface  
**Date:** August 1, 2026

## 1. Executive decision

AllternitOS must no longer mean a desktop-like React view containing a hard-coded
set of programs. It must mean the system-wide agentic operating layer that owns
execution authority, identities, capabilities, durable work, models, agents,
packages, state, receipts, and recovery.

The desktop app, web app, iOS app, and gizzi-code TUI are **surfaces**. They do
not contain separate operating systems and must not implement independent agent
lifecycle rules. Every surface communicates with the same versioned OS protocol.

The host operating system remains macOS, Linux, Windows, iOS, or a cloud machine.
Allternit is an agentic operating system in the same architectural role that a
database operating layer or container control plane occupies: it governs agentic
resources and side effects above a conventional host OS. It must not claim to be
a hardware kernel or a replacement for Darwin, Linux, or Windows NT.

## 2. Product thesis

Allternit ships a usable agent computer rather than an empty framework:

- A local-first runtime with an optional cloud control plane
- First-party agents installed at setup
- Local and remote model support, with selected local models optionally bundled
- An installable package format for agents, skills, tools, workflows, models,
  policies, memory schemas, and UI contributions
- One identity, capability, audit, scheduling, and state model across all surfaces
- Human approval as a first-class kernel primitive
- Durable work that survives UI closure, process restarts, and device handoff

The valuable unit is not a chat session. It is a governed, resumable **workload**
performed by agents using explicit capabilities and producing inspectable
artifacts and receipts.

## 3. System position

```text
Users, organizations, and automation triggers
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                         SURFACES                             │
│ Desktop │ Web │ iOS │ gizzi-code TUI │ SDK/API │ Extensions │
└─────────────────────────────┬────────────────────────────────┘
                              │ Allternit OS Protocol
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    ALLTERNIT AGENTIC OS                     │
│ Identity │ Policy │ Scheduler │ Workloads │ Packages        │
│ Agents   │ Models │ Context   │ Memory    │ Receipts        │
│ Approvals│ Secrets│ Artifacts │ Recovery  │ Device routing  │
└─────────────────────────────┬────────────────────────────────┘
                              │ capability-gated execution
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    EXECUTION SUBSTRATES                     │
│ Process │ WASM │ Container │ VM │ Browser │ Mobile │ Robot │
└─────────────────────────────┬────────────────────────────────┘
                              │
                              ▼
             macOS │ Linux │ Windows │ iOS │ Cloud
```

AllternitOS is therefore above the current kernel drivers and orchestration
services, but below every user-facing surface. In code ownership terms, no
surface directory is the canonical home of the OS.

## 4. Canonical planes

### 4.1 Contract plane

Owns stable, language-neutral schemas for:

- Workloads, steps, events, and checkpoints
- Agent, model, tool, workflow, and package identities
- Capabilities, grants, denials, and approval requests
- Artifacts, memory references, receipts, and provenance
- Surface sessions and device handoff

Contracts are versioned independently from implementations. Rust, TypeScript,
Swift, and external SDKs are generated or verified against the same schemas.

### 4.2 Control plane

Owns desired state and system decisions:

- Workload admission and scheduling
- Agent lifecycle and delegation
- Policy evaluation and approval routing
- Package installation and activation
- Model selection and routing
- Budget, quota, and concurrency enforcement
- Device and executor selection
- Cancellation, retry, suspension, and recovery

Only the control plane may authorize a side effect. Models and surfaces propose;
the control plane decides; an executor performs.

### 4.3 Execution plane

Runs admitted work in an explicit isolation class:

- `wasm`: preferred portable sandbox for deterministic tools and packages
- `process`: local command execution with a restricted environment
- `container`: reproducible service or build workloads
- `vm`: high-risk or full-computer workloads
- `browser`: browser-context automation
- `device`: phone, edge device, or robotics execution
- `remote`: a paired Allternit runtime on another machine

Every execution has an identity, capability lease, resource limits, cancellation
path, event stream, and receipt trail.

### 4.4 State plane

Owns durable system truth:

- Workload journal and event log
- Agent and package registry
- Artifact store and provenance graph
- Context and memory references
- Secrets metadata (never plaintext in general state)
- Checkpoints, leases, locks, and recovery records
- Cost, token, compute, and storage accounting

Surface-local state is a cache or presentation preference, never the only copy of
an active workload.

### 4.5 Experience plane

Surfaces project OS state into form factors:

- Desktop: complete administration and local execution experience
- Web: remote control, collaboration, artifacts, approvals, and cloud workloads
- iOS: monitoring, approvals, capture, handoff, and safe remote actions
- gizzi-code: terminal-native creation, execution, inspection, and administration
- Extensions: context capture and narrow actions through scoped capabilities

Feature parity means shared semantics, not identical UI.

### 4.6 Agent-native interface

The UI is not a fake desktop full of hard-coded applications. It is a live view
of kernel objects and agent work, rendered appropriately on each surface.

Every surface distinguishes three voices visually and structurally:

- **User intent:** what was requested and what constraints were given
- **Agent proposal:** plans, explanations, generated code, and recommendations
- **OS evidence:** policy decisions, approvals, tool calls, receipts, state
  transitions, checkpoints, and actual results

Agent prose must never be able to forge OS evidence. Evidence components are
rendered from signed or authenticated OS events, not from model-generated markup.

The primary UI objects are:

- Workload timeline and live plan
- Agent/team topology
- Capability and approval cards
- Artifact workspace
- Package and model manager
- Generated driver/compiler/harness workbench
- Receipts and replay inspector
- Resource, budget, and autonomy controls
- Device/runtime fleet
- Recovery and rollback center

Desktop and web may present these as windows, canvases, panels, or spatial
workspaces. iOS emphasizes approvals, observation, capture, and handoff. The TUI
uses the same events and actions in terminal-native views. Connection, execution,
and approval status always come from runtime state; static “connected” labels and
decorative program counters are prohibited.

## 5. Kernel objects

The v2 kernel exposes a small set of durable objects:

| Object | Purpose |
|---|---|
| Principal | User, organization, service, agent, package, or device identity |
| Workload | Durable unit of requested work with lifecycle and budget |
| Step | Schedulable, retryable unit within a workload |
| Agent | Policy-bound actor definition with instructions and allowed capabilities |
| Model | Intelligence resource with provenance, constraints, and runtime location |
| Capability | Named authority to read, write, execute, communicate, or control |
| Lease | Time- and scope-limited grant of a capability or resource |
| Package | Signed installable unit contributing one or more OS resources |
| Artifact | Immutable or versioned output with provenance |
| Memory | Governed reference available to declared principals and purposes |
| Approval | Human decision required before a protected transition |
| Receipt | Tamper-evident record of a decision, action, result, and authority chain |
| Checkpoint | Recoverable workload state at a known event boundary |

Chat sessions, windows, tabs, and terminal panes are surface concepts. They may
reference workloads, but they are not kernel objects.

## 6. Installable package model

The package model is the defining difference between the failed prototype and a
real OS. A package is installed once into an OS scope and becomes discoverable by
every authorized surface.

### 6.1 Package resource types

A single package may contribute:

- `agent`
- `skill`
- `tool`
- `workflow`
- `model`
- `policy`
- `memory-schema`
- `connector`
- `surface-extension`
- `device-driver`

“Program” is not a privileged kernel type. A user-facing program is normally a
package containing an agent or workflow plus optional surface extensions.

### 6.2 Minimum manifest

```yaml
apiVersion: os.allternit.com/v1alpha1
kind: Package
metadata:
  id: com.allternit.research
  name: Allternit Research
  version: 1.0.0
  publisher: allternit
  license: proprietary
spec:
  resources:
    - agents/researcher.yaml
    - workflows/deep-research.yaml
    - tools/citation-fetcher.wasm
    - surfaces/research-artifact.yaml
  capabilities:
    required:
      - network.http.read
      - artifacts.write
    optional:
      - files.workspace.read
  runtimes:
    - wasm
  models:
    requirements:
      modalities: [text]
      minContextTokens: 32000
  compatibility:
    osProtocol: ">=1.0 <2.0"
  integrity:
    digest: sha256:...
    signature: sigstore:...
```

### 6.3 Installation lifecycle

1. Resolve package and dependencies.
2. Verify digest, publisher, signature, and compatibility.
3. Inspect requested capabilities and policy implications.
4. Obtain required administrator or user approvals.
5. Stage content without activation.
6. Run static validation and sandboxed health checks.
7. Commit registry state atomically.
8. Activate resources and emit an installation receipt.

Update and uninstall use the same transaction model. Failure restores the prior
registry state. Packages cannot silently expand capabilities during updates.

### 6.4 Scopes

- `system`: installed for the runtime administrator
- `organization`: managed and policy-controlled
- `user`: follows a user across authorized devices
- `workspace`: versioned with a project or team space
- `ephemeral`: attached only to a workload and removed afterward

## 7. Agents shipped with the OS

The initial distribution should be small and dependable:

1. **Operator** — decomposes user intent, starts workloads, requests approvals,
   and explains system state.
2. **Builder** — works with code, tests, repositories, and development artifacts.
3. **Researcher** — searches, retrieves, cites, and produces research artifacts.
4. **Analyst** — works with tabular data, calculations, visualizations, and reports.
5. **Automator** — builds and operates scheduled or event-triggered workflows.
6. **System Steward** — diagnoses the OS, packages, runtimes, budgets, and policy;
   it cannot grant itself authority.

These are signed first-party packages, not hard-coded UI components. Users can
inspect their versions, capabilities, policies, models, and execution history.

## 7A. Generative systems layer

AllternitOS must be able to extend itself at runtime instead of requiring every
future tool, driver, harness, and adapter to ship in the original distribution.
This is the architectural lesson to take from systems such as Fable OS: an agent
can inspect an unknown device or interface, author a bounded implementation,
compile or assemble it, exercise it against real feedback, install the successful
result as a named capability, and reuse it later without repeating discovery.

The required loop is:

```text
observe → specify → synthesize → compile → sandbox-test → evaluate
        → approve → install → monitor → retain, revise, or revert
```

Runtime generation is not an exception around the package system. It creates a
new package revision with provenance, capabilities, tests, evaluation results,
resource bounds, and a rollback point.

### 7A.1 Driver foundry

The Driver Foundry creates adapters for previously unknown devices, protocols,
APIs, file formats, and execution environments.

It receives a machine-readable target description rather than unrestricted raw
authority:

- Device identity and enumerated resources
- Protocol or API schema
- Allowed ports, registers, endpoints, files, or operations
- Read/write and DMA policy
- Time, instruction, memory, and retry budgets
- Required probe and conformance tests
- A simulator, record/replay fixture, or sacrificial environment when possible

Generated drivers run first in a bounded VM, WASM component, container, or
disposable VM. Direct kernel-native installation is not a normal production path.
Hardware DMA requires IOMMU-backed isolation or an explicit high-risk policy; a
software instruction sandbox alone cannot contain a physical device.

### 7A.2 Compiler service

Compilers are OS services available to agents through capabilities. The service
supports language frontends and verified output targets without giving models an
unrestricted native-code pointer.

Initial targets:

- WebAssembly Component Model for portable tools and drivers
- Restricted native helpers inside a process/container sandbox
- eBPF only where the host OS verifier and policy permit it
- UI descriptions compiled into declarative surface extensions
- Workflow and agent definitions compiled into canonical workload graphs

Compilation produces an immutable artifact plus source digest, compiler identity,
flags, dependency lock, software bill of materials, diagnostics, and tests. Native
outputs are never activated merely because compilation succeeded.

### 7A.3 Harness foundry

Agents may generate the harness required to prove a new capability. A harness is
a first-class package resource containing:

- Fixtures and synthetic inputs
- Simulator or emulator configuration
- Property and invariant tests
- Golden traces and expected receipts
- Fault injection and timeout cases
- Resource ceilings
- Security and policy probes
- Success thresholds and confidence bounds

Harness generation and implementation generation must be separated where
practical. The same agent may propose both, but an independent evaluator or
deterministic oracle decides promotion. A self-authored test that merely agrees
with self-authored code is evidence of consistency, not correctness.

### 7A.3.1 Teach Mode

Users can teach the OS a workflow by performing it once while Allternit records an
explicitly consented evidence stream. Inspired by Microsoft Skill Recorder, Teach
Mode captures screen changes, active applications and windows, browser navigation,
accessibility/DOM events, short clipboard transitions, and optional narration.

Before synthesis, the OS performs local secret detection and redaction. It then
reconstructs intent and semantic steps, asks the user to correct the procedure,
replaces UI replay with stable APIs/CLIs/DOM/accessibility actions where possible,
extracts parameters, and produces a skill, deterministic workflow, and harness
candidate. The candidate still passes sandbox replay and promotion gates; one
demonstration is not sufficient evidence of general correctness.

Capture channels remain individually visible and pausable. Remote analysis is
opt-in after a precise disclosure of which frames, titles, URLs, clipboard data,
narration, and events would leave the device.

### 7A.4 Capability synthesis

A successful generated implementation is saved as a named, versioned capability.
Future agents discover it through the registry and call it by contract rather than
regenerating code. The registry records:

- Natural-language purpose and structured input/output schema
- Implementation and harness digests
- Required capabilities and isolation class
- Provenance, authoring agent, model, and prompts
- Evaluation history and known limitations
- Compatible hardware, protocol, and OS versions
- Activation scope and expiry
- Superseded versions and rollback target

Capabilities can be composed into higher-level capabilities, but delegation never
expands the union of granted authority.

### 7A.5 Autonomous improvement

The OS may autonomously propose or stage:

- New tools and connectors
- Drivers for discovered devices or protocols
- Task-specific agent harnesses
- Better prompts, policies, and workflows
- Performance specializations
- Failure repairs and compatibility updates

It may not silently promote generated native code, weaken policy, grant new
capabilities, alter the receipt path, modify its trust anchors, or erase the prior
working version. Promotion levels are explicit:

1. `draft` — source or definition exists.
2. `compiled` — an artifact was reproducibly produced.
3. `sandboxed` — bounded tests ran without escaping constraints.
4. `qualified` — the conformance harness and independent evaluation passed.
5. `approved` — required human or organization policy approved activation.
6. `active` — the capability may receive workloads.
7. `trusted` — operational evidence permits reduced approval friction, never
   unlimited authority.

### 7A.6 Self-repair boundary

Self-repair operates through an A/B runtime strategy:

1. Diagnose from receipts, traces, crashes, and health signals.
2. Generate a candidate repair in a disposable environment.
3. Replay the failing workload and the full affected conformance suite.
4. Boot or activate the candidate as a canary.
5. Preserve the known-good runtime and an external rollback controller.
6. Promote only after policy gates and observation windows pass.

The active kernel cannot be the sole authority validating a patch to its own
policy evaluator, receipt system, updater, or rollback controller. Those changes
require an external root of trust and recovery path.

## 8. Models shipped with the OS

Allternit should ship **model capability**, not promise that every installer
contains a large model binary.

The distribution includes:

- A model manager and versioned model manifests
- Provider adapters for approved remote models
- Local inference runtime support
- An optional small local model selected per supported hardware class
- Embedding and reranking models where licensing permits redistribution
- Verified download-on-demand for larger local models
- Hardware probing, storage estimates, checksums, licenses, and removal controls

Model manifests declare origin, license, quantization, required memory, context,
modalities, tool-use support, data-handling constraints, and integrity. Model
selection is a control-plane decision constrained by workload policy, privacy,
latency, quality, availability, and budget.

No model receives direct tool or filesystem authority. It emits proposals into
the governed execution path.

## 9. Capability and security model

Capabilities use deny-by-default names such as:

```text
files.workspace.read
files.workspace.write
files.user.read
network.http.read
network.http.write
process.spawn
secrets.use:github
messages.send:slack
browser.control
desktop.control
device.camera.capture
robot.motion.command
```

Grants bind principal, purpose, resource scope, constraints, expiry, workload,
and approval provenance. A grant is not transferable unless policy explicitly
allows delegation. High-risk capabilities require short leases and observable
approval.

The non-bypassable action path is:

```text
proposal → identity → policy → approval → lease → executor → receipt → state
```

Surfaces, packages, agents, tools, and models cannot call privileged executors
around this path.

## 10. Workload lifecycle

```text
draft → admitted → queued → running → waiting → completed
                              │          │
                              ├→ suspended
                              ├→ failed → retrying
                              └→ cancelling → cancelled
```

Every transition is persisted before it is presented as successful. Workloads
support idempotency keys, deadlines, budgets, retries, checkpoints, cancellation,
and an explicit recovery policy. Background work continues when a surface closes.

## 11. OS protocol

All surfaces use one semantic protocol over multiple transports:

- Local Unix socket or named pipe
- Stdio for gizzi-code and embedded runtimes
- HTTP for request/response administration
- WebSocket or SSE for event streams
- Cloud relay for paired devices

The protocol includes discovery, authentication, workload CRUD, event streams,
approvals, packages, agents, models, artifacts, policy explanations, health, and
administration. Transport-specific gateways adapt bytes, not semantics.

The existing `allternit://` desktop deep-link scheme remains a surface handoff
mechanism. It is not the OS RPC protocol. Existing auth and pairing routes must
remain compatible until individually migrated.

## 12. Repository ownership target

The final physical layout should follow ownership rather than historical layers:

```text
os/
  contracts/        # canonical schemas and generated bindings
  kernel/           # state machine and non-bypassable authority path
  control-plane/    # scheduling, packages, agents, models, policy coordination
  state/            # journal, registry, artifacts, checkpoints, migrations
  package-runtime/  # verification, install transactions, WASM host
  protocol/         # semantic API and transport adapters
  distribution/     # first-party agents, policies, model manifests
  conformance/      # black-box qualification suite

executors/          # process, WASM, container, VM, browser, device implementations
surfaces/           # desktop, web, iOS, gizzi-code, extensions
sdk/                # external package and client SDKs
```

This is a target ownership map, not authorization for an immediate directory
shuffle. Existing implementations move only after a contract and conformance
test identifies them as the selected implementation.

## 13. Legacy AllternitOS disposition

### Remove after dependency proof

- `surfaces/ai.allternit.com/src/allternit-os/`
- `surfaces/ai.allternit.com/src/views/AllternitOSView.tsx`
- Its view-registry entry and navigation policy entry
- Its built desktop bundle during the next normal surface packaging operation
- Documentation that calls the React subsystem the operating system

### Extract or re-home before removal

Potentially useful code must be evaluated as ordinary surface components:

- Research document rendering
- Data grid and visualization UI
- Presentation rendering
- Code preview and sandbox UI
- Artifact/file browsing UI
- Workflow graph editing
- Citation annotation UI
- Generic program error boundary if still imported elsewhere

The current audit found two confirmed inbound dependencies that block immediate
subtree deletion:

- `src/views/NativeAgentView.tsx` imports `ProgramErrorBoundary`.
- `src/lib/openui/registry.tsx` imports `OrchestratorProgram`.

They must be moved to neutral surface-owned locations and their imports updated,
or explicitly replaced, before `src/allternit-os/` is removed.

These components do not belong to the kernel. Keep them only when another live
surface imports them or when they are deliberately adopted as surface extensions.

### Explicitly preserve

- `allternit://auth/...` compatibility while any auth client uses it
- `allternit://pairing/...` runtime pairing handoff
- Plugin SDK contracts that are independent of the React OS prototype
- Kernel, policy, receipt, workflow, artifact, provider, and executor packages
  selected through the v2 implementation audit
- NativeAgentView's error boundary dependency until it is re-homed

## 14. Decommission sequence

No recursive deletion is the first step.

1. Freeze legacy AllternitOS feature development.
2. Mark its route experimental/deprecated and remove the false Production status.
3. Produce a complete inbound-import and runtime-route inventory.
4. Re-home shared components imported outside the subsystem.
5. Remove navigation and view-registry exposure behind a reversible flag.
6. Verify web and desktop source references with static searches.
7. Delete the source subtree as one reviewed change.
8. Regenerate packaged surface assets only through the normal release process.
9. Retain history in Git; do not keep a second live archive directory.
10. Update reality documentation to distinguish retired UI from the v2 OS.

OAuth, pairing, and plugin deep links are tested separately because their shared
URI prefix makes them easy to break accidentally.

## 15. Delivery roadmap

### Phase 0 — Truth and retirement

- Ratify this architecture and terminology.
- Deprecate and safely remove the legacy web subsystem.
- Establish an implementation inventory for every proposed kernel object.
- Choose one canonical schema location and eliminate contradictory authority.

**Exit:** no UI subsystem claims to be AllternitOS; selected legacy components
have owners; all valid deep links still have owners.

### Phase 1 — Vertical kernel slice

- Implement the canonical Workload, Step, Capability, Lease, Receipt, and
  Principal contracts.
- Provide one local daemon and protocol endpoint.
- Execute one WASM or restricted-process tool through policy and receipts.
- Persist journal state and recover after daemon restart.
- Expose the same workload from gizzi-code and the desktop/web surface.

**Exit:** a workload created on one surface can be inspected, approved, resumed,
and cancelled from another without duplicating execution logic.

### Phase 2 — Package system

- Implement manifest parsing, verification, dependency resolution, staging,
  transactional installation, activation, update, and uninstall.
- Package one first-party agent and one tool instead of compiling them into a UI.
- Add capability inspection and approval UX to desktop, web, and TUI.

**Exit:** a signed package installs without rebuilding a surface and cannot use an
undeclared capability.

### Phase 3 — Agents and models distribution

- Ship the initial first-party agent set as packages.
- Implement model manifests, hardware discovery, remote adapters, local model
  installation, and model policy.
- Add budgets and routing explanations.

**Exit:** a workload can use a permitted local or remote model and its complete
model/tool authority chain appears in receipts.

### Phase 4 — Durable autonomy

- Add schedules, triggers, long-running leases, checkpoints, retry policy,
  notification routing, and device handoff.
- Support unattended execution only inside explicit policy and budgets.
- Implement incident controls and a global autonomy kill switch.

**Exit:** approved background workloads survive surface and daemon restarts,
remain bounded, and provide complete recovery and audit evidence.

### Phase 5 — Ecosystem

- Publish package SDK, validation tools, signing flow, registry protocol, and
  conformance suite.
- Add organization distribution and policy management.
- Permit third-party packages only after isolation and update rollback pass the
  security qualification suite.

**Exit:** an external developer can build, test, sign, install, update, and remove
a package without private repository knowledge.

## 16. Conformance gates

Allternit may call the runtime an agentic OS only when automated black-box tests
prove all of the following:

1. A surface cannot execute a privileged action without a valid capability lease.
2. A model cannot bypass policy or invoke a tool directly.
3. A package requesting an undeclared capability is denied and receipted.
4. Package installation, update, and uninstall are atomic and recoverable.
5. An active workload survives daemon restart from its last safe checkpoint.
6. Duplicate delivery does not duplicate a protected side effect.
7. Cancellation reaches every child step and executor within a defined bound.
8. Every side effect can be traced to principal, workload, policy, approval,
   package, agent, model, tool, executor, and result.
9. Secrets are referenced and used without entering general logs or model context.
10. A workload started from any surface has the same lifecycle semantics.
11. A package can be installed without rebuilding any surface.
12. A prior package version can be restored after a failed update.
13. Local-only mode performs a useful workload without cloud connectivity.
14. Global autonomy shutdown prevents new side effects and safely suspends work.
15. A generated driver cannot access resources outside its declared target and
    capability lease.
16. A generated harness cannot promote the implementation it evaluates without an
    independent gate.
17. Generated code is retained with source, compiler, dependency, test, and model
    provenance sufficient for reproduction.
18. Failure during generated-capability activation restores the known-good
    revision without relying on the failed capability.
19. Self-repair cannot modify the external rollback controller or trust roots.

## 17. Commercial packaging

The architecture enables a clearer product ladder:

- **Allternit Personal:** local runtime, bundled agents, local/bring-your-own
  models, personal packages, and desktop/TUI surfaces
- **Allternit Pro:** remote access, schedules, higher autonomy, encrypted sync,
  premium first-party agent packs, and advanced local model management
- **Allternit Teams:** shared packages, roles, approvals, budgets, audit retention,
  collaboration, and managed runtimes
- **Allternit Enterprise:** private registry, policy administration, identity
  federation, compliance exports, dedicated control plane, and fleet management
- **Allternit Runtime:** headless licensed runtime for devices, servers, and robots

Revenue attaches to governed autonomous capacity, managed distribution, premium
agent/model packages, collaboration, compliance, and fleet operations—not to a
decorative desktop shell.

## 18. Immediate decisions required

Before implementation begins, maintainers must ratify:

1. `os/` as the future canonical ownership root or an equivalent name.
2. The first supported isolation runtime: WASM is recommended.
3. The canonical state engine and journal.
4. The canonical contract format and code-generation strategy.
5. Whether packages use Sigstore, another signature system, or both.
6. Which existing policy, receipt, workflow, and registry implementations survive
   the implementation audit.
7. The first vertical workload used as the conformance reference.

The recommended reference workload is a research task that uses a bundled agent,
a model, one network-read tool, an artifact writer, an approval-gated export, and
a restart checkpoint. It exercises the system without requiring dangerous local
process or desktop-control authority.
