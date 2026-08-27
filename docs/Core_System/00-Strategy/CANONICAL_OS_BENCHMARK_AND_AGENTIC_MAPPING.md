# Canonical OS Benchmark and Agentic Mapping

**Status:** Canonical architecture benchmark  
**Owner:** Allternit  
**Created:** August 2, 2026  
**Last reviewed:** August 2, 2026  
**Applies to:** AllternitOS architecture, implementation, conformance, and product claims  
**Living index:** `ALLTERNIT_OS_LIVING_ROADMAP.md`

## Purpose

This document answers a harder question than “what features should an AI agent
have?” It defines what an operating system actually does, from power-on through
applications, updates, failure, and administration, and then translates every
responsibility into an agentic operating-system requirement.

Linux, Windows NT, macOS/Darwin, and Android are the canonical benchmark because
they have survived adversarial workloads, hardware diversity, failures, upgrades,
multiple users, hostile software, and decades of compatibility pressure. An
“agent OS” does not need to replace their hardware kernels on day one. It does
need an equally coherent control plane for agents, models, tools, memory, work,
authority, packages, devices, and recovery.

This benchmark prevents category errors:

- a desktop skin is not an OS;
- an agent loop is not a scheduler;
- a vector database is not a memory manager;
- a plugin loader is not a package manager;
- a tool call is not a system call unless authority is enforced outside the model;
- a chat transcript is not an event journal;
- a prompt saying “be safe” is not a security reference monitor;
- a model retry is not crash recovery;
- a collection of agents is not a multi-user operating system.

## 1. Definition and product boundary

AllternitOS is an **agentic operating layer** hosted initially by macOS, Windows,
Linux, iOS, Android, or cloud infrastructure. Its “hardware” is the combined pool
of models, tools, browsers, applications, files, devices, networks, humans, and
execution environments. Its programs are agent packages and deterministic
applications. Its processes are durable workloads. Its system calls are
capability-checked operations. Its kernel is the smallest non-bypassable authority
that admits, schedules, isolates, records, and recovers work.

The initial product shape is:

```text
host firmware/kernel/drivers/security
                 │
signed Allternit app + independently recoverable daemon
                 │
agentic kernel contracts and durable control plane
                 │
programs, agents, models, skills, workflows, tools, and surfaces
```

The Native distribution is designed in parallel as a bootable immutable Linux OS
with an Allternit-owned compositor, shell, service graph, package lifecycle,
security model, updater, and recovery environment. A from-scratch hardware kernel
is not required; Linux supplies hardware support while Allternit owns the system.

## 2. Full front-to-back operating-system anatomy

The following is the canonical inventory. Every row must eventually have an
owner, public contract, threat model, lifecycle, telemetry, recovery behavior,
and conformance test.

| # | Traditional OS responsibility | Mature-OS behavior | Agentic OS equivalent | Allternit target |
|---:|---|---|---|---|
| 01 | Constitution and ABI policy | Defines invariants, privilege boundaries, compatibility, and change rules | System law, package ABI, protocol versioning, non-bypassable authority | Versioned OS protocol, ADRs, compatibility suite, system-law kernel |
| 02 | Hardware and firmware inventory | Discovers CPU, memory, accelerators, storage, radios, and security hardware | Discovers models, runtimes, tools, apps, devices, humans, costs, and trust levels | Capability and hardware inventory with attestation and health |
| 03 | Root of trust | Begins from immutable or hardware-backed keys | Establishes who may sign kernels, packages, models, policies, and updates | Offline root, release keys, device identities, signed manifests |
| 04 | Secure and measured boot | Verifies each boot stage before execution | Verifies daemon, policy, package index, model weights, and executor images | Signed bootstrap with measurement log and safe-mode path |
| 05 | Bootloader and early userspace | Selects system image, loads kernel, supports recovery | Starts minimal authority, journal, policy, registry, then optional agent services | Small supervisor independent of mutable agents and models |
| 06 | Hardware abstraction | Hides architecture-specific details behind stable contracts | Hides provider, model, device, browser, and executor differences | Model, Tool, Device, Voice, Browser, and Executor contracts |
| 07 | Kernel object model | Gives processes, files, handles, devices, jobs, and tokens identities and lifecycles | Gives workloads, steps, agents, artifacts, leases, approvals, receipts, packages, and models durable identity | Canonical schemas, ownership, state machines, handles, garbage collection |
| 08 | Interrupts, clocks, and timers | Handles urgent events and monotonic time | Handles user interruption, cancellation, deadlines, trigger events, lease expiry, and voice barge-in | Priority event path that does not wait for model cooperation |
| 09 | Scheduler | Allocates CPU fairly with priorities and preemption | Allocates models, tools, executors, tokens, time, money, devices, and human attention | Risk-, deadline-, budget-, and capability-aware workload scheduler |
| 10 | Threads and concurrency | Coordinates parallel execution, locks, and deadlock handling | Coordinates steps, agents, subagents, branches, shared resources, and human gates | Structured concurrency, resource locks, DAGs, cancellation propagation |
| 11 | Virtual memory | Gives processes isolated address spaces and pages data under pressure | Gives workloads bounded context, retrieves state, compresses history, and evicts caches without losing truth | Context manager separated from durable event/artifact state |
| 12 | Physical memory management | Accounts for and reclaims scarce RAM | Accounts for RAM, VRAM, KV cache, embeddings, context, and model residency | Hardware-aware model residency and memory-pressure policy |
| 13 | Process and job lifecycle | Spawn, suspend, resume, signal, terminate, reap, and group work | Admit, plan, run, wait, pause, resume, cancel, checkpoint, recover, and archive workloads | Durable Workload/Step state machines and job groups |
| 14 | IPC and synchronization | Provides pipes, sockets, shared memory, events, mutexes, and RPC | Provides typed events, streams, requests, handoffs, shared artifacts, locks, and agent protocols | Local OS protocol plus event bus; A2A/MCP adapters at the edge |
| 15 | System-call boundary | Validates transitions from unprivileged programs to kernel services | Validates every consequential model/agent request before action | Capability API; models cannot directly invoke privileged executors |
| 16 | Device drivers | Translate stable OS operations into device-specific behavior | Translate intents into app, API, browser, robot, data-source, and hardware operations | Signed driver/tool packages, generated-driver lab, qualification suite |
| 17 | Plug and Play | Discovers, binds, configures, and removes devices safely | Discovers MCP servers, apps, accounts, devices, runtimes, and new model packs | Capability negotiation, attestation, hot add/remove, quarantine |
| 18 | I/O manager | Routes asynchronous I/O, buffering, cancellation, and completion | Routes tool calls and streams with deadlines, retries, idempotency, and receipts | Executor gateway with typed results and cancellation |
| 19 | Filesystems and VFS | Names, stores, mounts, permissions, caches, journals, and recovers data | Names artifacts, memories, datasets, packages, workspaces, remote stores, and provenance | Artifact namespace, mounts/connectors, transactions, content addressing |
| 20 | Storage and volume management | Partitions, encrypts, snapshots, quotas, repairs, and migrates data | Separates system/user/org/workload stores; snapshots work and controls retention | Encrypted stores, quota classes, snapshots, export, backup, restore |
| 21 | Networking stack | Provides addressing, routing, transport, DNS, firewalling, and QoS | Connects agents, devices, model endpoints, relays, and services under policy | Identity-bound transport, egress policy, discovery, offline queueing |
| 22 | Identity and sessions | Authenticates users, services, devices, and login sessions | Authenticates people, organizations, agents, packages, models, runtimes, and devices | Unified principals, delegation chains, presence, session binding |
| 23 | Authorization/reference monitor | Mediates access to protected objects on every path | Decides whether an agent may read, infer, spend, communicate, mutate, or act | Non-bypassable policy decision/enforcement points outside prompts |
| 24 | Access tokens and handles | Carries scoped rights, ownership, integrity, and impersonation constraints | Carries time-, object-, purpose-, action-, and budget-scoped authority | Revocable capability leases with provenance and downstream narrowing |
| 25 | Isolation and sandboxing | Separates users/processes via address spaces, ACLs, namespaces, jails, sandboxes, VMs | Separates workloads, tenants, generated code, browser identities, data, and networks | Risk ladder: declarative → WASM → process → container → microVM → GUI VM |
| 26 | Cryptography and secrets | Protects keys and data at rest/in transit; supplies secure randomness | Protects credentials, model keys, user data, memory, packages, and receipts | OS key store, secret handles, redaction, envelope encryption, rotation |
| 27 | Resource accounting and quotas | Tracks CPU, memory, storage, network, power, and user limits | Tracks tokens, inference, spend, latency, tool calls, storage, risk, and human attention | Per-principal/workload/package budgets and auditable chargeback |
| 28 | Service manager/init | Starts, supervises, orders, restarts, and health-checks daemons | Supervises agents, model servers, connectors, triggers, and background workloads | Declarative services, dependency graph, health, backoff, circuit breakers |
| 29 | Configuration database | Stores system/user/service settings with precedence and policy | Stores model routes, package settings, policies, accounts, defaults, and feature flags | Typed, layered, migratable configuration with provenance |
| 30 | Runtime, compiler, and linker | Loads binaries/libraries; compiles programs; resolves dependencies | Loads agents/tools/skills; compiles learned procedures and generated capabilities | Package loader, WASM compiler lane, Harness/Tool/Driver Foundries |
| 31 | Package and application lifecycle | Install, verify, resolve, configure, update, remove, and roll back software transactionally | Manages agents, models, skills, tools, workflows, policies, drivers, and UI projections as packages | Signed manifests, dependency solver, staged activation, rollback, revocation |
| 32 | User and application data model | Separates system files, application state, user homes, caches, and portable documents | Separates kernel truth, workload state, memories, artifacts, credentials, caches, and exports | Explicit data classes with ownership, retention, portability, deletion |
| 33 | Search and indexing | Indexes files, metadata, applications, and content under ACLs | Retrieves memories, artifacts, capabilities, prior episodes, and tools under authority | Permission-preserving hybrid index with citations and freshness |
| 34 | GUI/session/window system | Composes windows, focus, clipboard, notifications, input, and multiple displays | Projects shared workload state into Desktop, Web, iOS, TUI, Office, voice, and APIs | Surface-neutral state plus declarative projections and attention manager |
| 35 | Input, accessibility, and media | Normalizes keyboard, pointer, touch, speech, cameras, displays, and assistive technology | Normalizes text, voice, screen, files, sensors, and accessibility trees | Multimodal input plane, shared Turn Manager, accessible approval surfaces |
| 36 | Notification/background model | Delivers events while respecting focus, power, and user preferences | Requests attention, approvals, exception handling, and completion without alert fatigue | Priority inbox, resumable approvals, escalation and quiet-hours policy |
| 37 | Observability and audit | Emits metrics, logs, traces, crash reports, and security events | Records model decisions, policy decisions, actions, evidence, state changes, cost, and outcomes | Append-only event journal, receipts, trace correlation, evidence UI |
| 38 | Fault containment | Contains crashes, hangs, corrupt state, resource exhaustion, and dependency failure | Contains runaway agents, loops, hallucinated actions, tool hangs, provider failures, and poisoned context | Watchdogs, deadlines, circuit breakers, bounded retries, quarantine |
| 39 | Checkpoint and recovery | Journals state, snapshots, resumes, repairs, and enters safe mode | Restores durable workloads after daemon/device/model/tool failure | Idempotent steps, checkpoints, compensation, replay, external recovery controller |
| 40 | Updates and migration | Delivers signed atomic updates with schema migration and rollback | Updates kernel, packages, policies, models, memories, and learned skills without silent semantic drift | Channels, staged rollout, health gates, compatibility checks, rollback |
| 41 | Backup, restore, reset | Restores data and system independently; supports factory reset | Restores identity, artifacts, workload history, packages, and policy while excluding bad runtime state | Encrypted backup, selective restore, portable export, safe reset |
| 42 | Virtualization and containers | Provides isolated machines and portable workload envelopes | Provides disposable browsers/desktops, reproducible environments, and risky-code isolation | Native virtualization first; QEMU conformance lab; cloud microVMs |
| 43 | Distributed and fleet management | Enrolls devices, deploys policy, updates systems, and reconciles offline state | Places workloads across personal devices, servers, robots, and remote agents | Device/runtime identities, placement, relay, sync, remote stop, fleet policy |
| 44 | Power and thermal management | Adapts performance to battery, thermals, sleep, and wake | Adapts model size, concurrency, accelerator use, background work, and network use | Energy-aware scheduler, sleep checkpoints, wake triggers, low-power models |
| 45 | Administration and developer tools | Shells, APIs, debuggers, profilers, policy tools, installers, and diagnostics | Lets operators inspect, explain, simulate, control, debug, and extend agentic work | gizzi-code TUI, admin UI/API, package SDK, replay debugger, policy simulator |
| 46 | Compatibility and conformance | Maintains ABI/API behavior and certifies hardware/software | Ensures packages and surfaces observe the same workload, authority, recovery, and evidence semantics | Golden protocol tests, executor tests, package certification, chaos scenarios |
| 47 | Privacy, deletion, and multi-tenancy | Enforces separation, consent, retention, deletion, and ownership | Prevents cross-user/org/workload leakage and makes learned state governable | Tenant keys, purpose binding, retention policy, derived-data deletion ledger |
| 48 | Localization and accessibility | Makes the system operable across language, ability, and modality | Makes agents, approvals, explanations, and voice usable and equivalent across surfaces | Semantic UI contracts, captions, keyboard/voice parity, locale-aware agents |

## 3. Canonical object translation

This is the vocabulary bridge between mature operating systems and AllternitOS.

| Traditional OS object | Agentic OS object | Required semantics |
|---|---|---|
| Machine | Runtime / Device | Identity, capabilities, health, location, trust, capacity |
| User/service account | Principal | Person, org, agent, service, package, device; authenticated and auditable |
| Process | Workload | Durable objective with owner, state, budget, policy, checkpoints, outcome |
| Thread | Step / branch | Cancellable unit with dependencies, executor, attempts, and typed result |
| Job/process group | Project / workload group | Shared budgets, cancellation, policy, artifacts, and reporting |
| Executable | Agent/program package | Signed code/config/resources with declared compatibility and authority needs |
| Dynamic library | Skill/tool/provider resource | Versioned dependency loaded through declared interfaces |
| System call | Capability request | Typed request mediated outside the model, with lease and receipt |
| Access token/file descriptor | Capability lease/handle | Narrow, revocable, delegable-only-by-attenuation authority |
| File | Artifact | Typed content, owner, provenance, policy, version, hash, retention |
| Filesystem mount | Connector/namespace mount | Governed view of local, cloud, SaaS, or device data |
| Virtual memory page | Context segment | Evictable model context backed by durable authoritative state |
| Swap/cache | Retrieval/cache tier | Reconstructable performance state, never sole system truth |
| Pipe/socket/RPC | Event/stream/request | Typed communication with identity, ordering, cancellation, backpressure |
| Device | Tool/app/model/browser/robot | Discoverable resource with driver, health, capabilities, and trust |
| Driver | Executor adapter | Stable operation mapped to a specific resource with qualification evidence |
| Scheduler | Workload scheduler/router | Chooses agent/model/executor/time using policy, budget, locality, and risk |
| Window | Surface projection | Revocable view/controller of shared state; never owner of the workload |
| Notification | Attention request | Priority, deadline, reason, resumable action, escalation policy |
| Audit record | Receipt/event | Tamper-evident statement of request, authority, action, result, and evidence |
| Core dump | Failure bundle | Redacted state, traces, inputs, versions, receipts, and replay reference |
| Checkpoint/hibernate image | Workload checkpoint | Portable resumable state independent of a specific UI or model process |
| Package repository | Signed registry | Discover, verify, resolve, revoke, update, and attest resources |
| Safe mode/recovery OS | Recovery controller | Minimal external authority that can stop agents, roll back, repair, and export |

## 4. How the established operating systems solve the benchmark

These systems provide patterns, not implementations to copy wholesale.

| Domain | Linux | macOS / Darwin | Windows NT | Android | Allternit adaptation |
|---|---|---|---|---|---|
| Kernel shape | Monolithic, modular subsystems | XNU hybrid: Mach + BSD + I/O Kit | NT kernel/executive with object manager | Linux kernel plus Android framework/HAL | Small agentic authority above host kernels; modular services around it |
| Scheduling | Tasks, classes, cgroups, CPU affinity | Mach threads/tasks and QoS integrated with user experience | Threads, priorities, job objects, processor groups | Linux scheduler plus app/background policy | Workloads/steps plus budget, deadline, risk, model, tool, and attention scheduling |
| Memory | VM, page cache, reclaim, cgroups | Mach VM/pagers, memory pressure | Virtual address spaces, working sets, sections | Per-app processes, LMKD, runtime heaps | Durable state plus bounded context/KV/VRAM management; caches are disposable |
| Object model | File descriptors, tasks, inodes, namespaces | Mach ports/tasks plus BSD objects | Uniform named executive objects and handles | Binder objects, apps, activities, services | Durable typed kernel objects and capability handles |
| IPC | Pipes, signals, sockets, shared memory, netlink | Mach messages/ports plus BSD IPC | LPC/ALPC, pipes, RPC, shared sections | Binder IPC plus intents | Typed local protocol/event stream; adapters for A2A/MCP/WebSocket |
| Drivers | Loadable modules, device model, sysfs/udev | I/O Kit object model and matching | Driver stacks, I/O manager, Plug and Play | HALs, kernel drivers, vendor interfaces | Signed adapters; hot discovery; generated candidates only after sandbox qualification |
| Files/data | VFS and many filesystems | APFS, VFS, per-user/application domains | NTFS, object namespaces, registry | Scoped storage, app data, content providers | Artifact VFS, connectors/mounts, provenance, transactions, data-class policy |
| Identity/security | UID/GID, capabilities, LSM, seccomp, namespaces | Code signing, sandbox, entitlements, Keychain, Secure Enclave | Access tokens, ACLs, integrity levels, SRM, AppContainer | App UID sandbox, SELinux, permissions, Keystore | Principals, purpose-bound leases, policy engine, secret handles, isolated executors |
| Services | init/systemd and daemons | launchd, XPC services | Service Control Manager and service hosts | init, system_server, services | Supervisor for agents/models/connectors/triggers with dependency and health policy |
| Packages/apps | Distribution package managers, Flatpak/Snap | Signed bundles, notarization, sandbox, App Store | MSI/MSIX, Store, servicing stack | APK/AAB, package manager, verified signing | One signed package format for agents/models/skills/tools/workflows/policy/UI |
| UI/session | Wayland/X11, compositors, desktop environments | WindowServer, AppKit/SwiftUI, accessibility | Win32/DWM/WinUI/UI Automation | SurfaceFlinger, activities, Compose, accessibility | Surface-neutral workloads projected to Desktop/Web/iOS/TUI/voice/Office |
| Updates/recovery | Distribution-specific atomic/image options, initramfs/rescue | Signed system volume, recoveryOS, APFS snapshots | Component servicing, WinRE, rollback | A/B seamless updates, Verified Boot, recovery | Signed atomic runtime/package/model updates; external recovery and staged rollout |
| Isolation | Users, namespaces, cgroups, seccomp, LSM, containers/KVM | Sandbox, entitlements, virtualization framework | ACLs, integrity, AppContainer, Hyper-V/WSL | UID sandbox, SELinux, seccomp, pVM | Backend-neutral executor ladder chosen by risk and reproducibility |
| Fleet | SSH, config/orchestration ecosystem | MDM | Group Policy/Intune/AD | Enterprise management | Personal/org fleet enrollment, policy reconciliation, placement, remote stop |

### What Allternit should borrow

- From Linux: explicit resource controllers, namespaces, inspectability, stable
  userspace contracts, composable tools, and virtualized execution.
- From macOS/Darwin: a layered hybrid architecture, strong code identity,
  entitlement-style capabilities, hardware-backed trust, coherent app experience,
  and recovery outside the mutable system volume.
- From Windows NT: a uniform object/handle model, centralized security reference
  monitor, job objects, rich asynchronous I/O, compatibility discipline, and
  enterprise administration.
- From Android: per-application identities, default sandboxing, permission UX,
  verified/A-B updates, hardware-backed keys, lifecycle-aware background work,
  and hardware abstraction boundaries.

## 5. Agent-OS convergence map

The field is converging in layers. The label “OS” currently spans research
kernels, desktop agents, orchestration runtimes, local workbenches, and generative
systems. Their overlap is useful; their omissions define Allternit's opportunity.

| Project | Primary convergence | OS layers covered | Important gap relative to canonical OS |
|---|---|---|---|
| Fable OS | Agents generate drivers, compilers, programs, harnesses, and repairs | Compiler/runtime, drivers, generative capability, evidence UI | Needs production trust roots, multi-user policy, transactional packaging, isolation, and external recovery |
| AIOS | Agent kernel/SDK and LLM, context, memory, storage, tool scheduling | Syscall abstraction, scheduler, memory/tool/model managers | Primarily an agent resource abstraction; not a complete device/user/package/update/recovery OS |
| Microsoft UFO²/UFO³ | Hybrid GUI/API desktop agents evolving into dynamic multi-device DAG orchestration | Desktop driver, planning/scheduling, device discovery, IPC/orchestration, knowledge | Host-dependent automation with incomplete package, authority, durable data, update, and recovery constitution |
| Microsoft Skill Recorder | Learns reusable workflows from screen, browser, clipboard, and narration demonstrations | Input capture, procedure compilation, skills | Recorder, not a full runtime; needs evidence, policy, secret safety, replay, promotion, drift, rollback |
| iii AgentOS | Workers/functions/triggers, control plane, budgets, tenants, governance, self-improving functions | Service manager, scheduler, control plane, packages/functions, observability | Broad runtime, but hardware/desktop/data lifecycle, signed supply chain, recovery, and host integration remain separate |
| CoWork OS | Local-first GUI workbench joining tasks, memory, skills, approvals, channels, devices, automations, and artifacts | Programs/UI, workload runtime, skills, policy UX, local data | Strong product convergence; must still prove non-bypassable kernel, transactional lifecycle, isolation, recovery, and conformance |
| OpenDAN | Personal local AI environment, assistants, knowledge, voice, workflows, model customization | User programs, knowledge, models, voice | Application platform more than complete OS authority/resource layer |
| OpenSwarm | Local-first decentralized coordination through shared latent state | Multi-agent IPC/state experiment | Experimental coordination substrate without the rest of the OS lifecycle |
| ElizaOS | Agent runtime, models, plugins, actions, providers, services, deployable projects | Runtime and application/plugin ecosystem | Extension/runtime layer, not hardware-to-recovery operating authority |
| Open Interpreter / computer agents | Local code and computer execution with approvals | Shell/desktop driver and application experience | Usually session/application-centric; incomplete durable kernel and package/fleet constitution |
| Hermes Agent | Procedural skills and progressive skill loading | Memory, skills, experience reuse | Needs independent outcome verification, authority, isolation, versioning, drift, and rollback |
| Browser Use / Playwright agents | Reliable browser control using semantic and visual interfaces | Browser driver/executor | One device class; requires identity isolation, policy, receipts, recovery, and system scheduling |
| OSWorld and related benchmarks | Reproducible evaluation of real desktop tasks | Conformance/evaluation | Benchmark rather than runtime; limited long-horizon governance/recovery measurement |

### Strongest convergence signals

1. **Durable workload graphs replace single chat loops.** DAGs, goals, triggers,
   background execution, checkpointing, and multi-device placement are becoming
   normal.
2. **Tools become governed capabilities.** MCP improves interoperability, but a
   real OS must add identity, attenuation, policy, cancellation, receipts, and
   revocation around it.
3. **Local-first returns as a trust and latency boundary.** Open-weight models,
   local memory, native apps, and private execution are increasingly first-class.
4. **The desktop becomes a device, not the kernel.** Accessibility, DOM, APIs,
   and pixels are driver tiers behind a shared workload control plane.
5. **Skills become compiled experience.** Demonstrations and successful traces
   become reusable procedures, but safe systems require evaluation and promotion.
6. **Multi-device is becoming the native topology.** The “computer” is a fleet of
   desktops, browsers, phones, servers, and embedded devices.
7. **Generated software is moving inside the runtime.** Agents increasingly
   create tools, harnesses, adapters, workflows, and code during operation.
8. **Evidence becomes a UI primitive.** Users need to distinguish model claims,
   observed state, policy decisions, actual actions, and verified outcomes.

## 6. Allternit implementation ownership map

| Canonical domain | Allternit system owner | Existing foundations | Required closure |
|---|---|---|---|
| Boot/trust/recovery | Supervisor + Trust service | Updater, governance, runtime infrastructure | Signed measured bootstrap, safe mode, rollback independent of agents |
| Kernel objects/protocol | OS Kernel contracts | Sessions, goals, tasks, artifacts, receipts, packages | Reconcile into canonical schemas/state machines and bindings |
| Workload scheduling | Scheduler service | workflow engine, Rails, orchestration, Cowork, parallel-run | One admission/placement/budget/cancellation authority |
| Context/memory | Memory Manager | gizzi brain/memory, platform memory, research knowledge | Separate durable truth, retrieval indexes, context cache, retention policy |
| Capability/syscall boundary | Policy + Executor gateway | gizzi permissions, governance crates, purpose binding | One non-bypassable lease/check/receipt path |
| Drivers and I/O | Executor/Driver Manager | tools, ACI, computer use, Office, provider/device adapters | Stable driver ABI, health, qualification, cancellation, hot removal |
| Artifacts/storage/VFS | Artifact service | artifact registry/UI, workspace and document systems | Namespaces, mounts, transactions, provenance, quota, backup/restore |
| Identity/secrets | Identity + Secret services | auth, pairing, orgs, device identity, credential stores | Agent/package/runtime principals, delegation, hardware binding, deletion |
| Packages/runtimes | Package Manager | plugin SDK/catalog, skill installer, local models, WASM runtime | Unified signed format, solver, staging, atomic activate/rollback/revoke |
| Service management | Supervisor | daemon, jobs, durable goals, background tasks | Declarative dependencies, watchdogs, health, safe restart |
| UI/input/attention | Experience and Turn Managers | Desktop/Web/iOS/TUI/Office, voice, A2UI/OpenUI | Surface-neutral projections, interrupt path, shared approval/attention model |
| Audit/observability | Journal + Receipt service | receipts, traces, audit, evals | Append-only correlated events, evidence taxonomy, export and replay |
| Virtualization/fleet | Runtime Manager | Apple VF, Firecracker, cloud relay, pairing, mobile instances | Executor contract, risk placement, snapshot/recovery, remote stop |
| Developer/admin | Operator + gizzi Code | TUI, terminal, Agent Hub, admin views, SDKs | Protocol debugger, policy simulator, package inspector, conformance CLI |
| Experience compilation | Skill Studio/Compiler | skills, workflows, memory, evals, harness patterns | Episode schema, redaction, replay, shadowing, promotion, drift/rollback |

## 7. Minimum claim gates

Allternit should not claim to be a real agentic OS until all **Gate A** conditions
pass. It does not need bare-metal drivers or its own hardware kernel.

### Gate A — Agentic OS

- A workload survives closure/restart of its originating surface.
- Desktop, Web, iOS, and TUI observe the same authoritative workload state.
- Every consequential action crosses one policy/capability enforcement boundary.
- Agents, models, skills, tools, workflows, and UI extensions have transactional
  install/update/remove/rollback semantics.
- Work is cancellable and bounded by time, spend, resource, data, and purpose.
- Generated code runs in qualified isolation and cannot grant itself authority.
- Kernel evidence, model claims, and external observations are visibly distinct.
- Daemon and package failure recover without corrupting durable workload truth.
- Emergency stop and rollback work without assistance from the active model.
- At least one third-party package passes a published conformance suite.

### Gate B — Primary-computing environment

- Signed native distributions and background service management on supported hosts.
- Isolated browser and desktop environments with snapshot/restore.
- Offline local bootstrap model and useful local work on qualified hardware.
- Full-duplex voice with interruption, shared state, and accessible alternatives.
- Fleet/device placement, encrypted sync, backup, restore, and remote stop.
- Stable package SDK/registry and administrator tooling.

### Gate C — Allternit appliance

- Immutable Linux image, verified boot, A/B updates, encrypted storage, recovery
  image, hardware qualification, installer, drivers, accessibility, and fleet admin.
- Host integration is no longer required for the primary experience.
- Bare-metal ownership remains optional; Linux/KVM can remain the hardware kernel.

## 8. Canonical test families

| Test family | Required proof |
|---|---|
| Authority | No tool, generated code, package, surface, or agent bypasses capability checks |
| Durability | Kill UI/daemon/model/executor at every state transition; resume exactly once |
| Isolation | Cross-tenant, cross-workload, filesystem, secret, browser, and network escape tests |
| Scheduling | Deadlines, priorities, fairness, quotas, cancellation, locks, and resource pressure |
| Package lifecycle | Signed install, dependency conflict, staged update, failed health gate, rollback, revoke |
| Evidence | Claims, observations, actions, policy decisions, receipts, and outcomes cannot be confused |
| Context/memory | Context eviction loses no authoritative state; retrieval honors ACL/deletion/freshness |
| Driver/executor | Discovery, capability negotiation, timeout, cancellation, hot removal, poisoned output |
| Surface parity | Same workload semantics and approvals through Desktop, Web, iOS, TUI, voice, and API |
| Recovery | Corrupt cache, unavailable provider, disk pressure, network partition, bad update, lost device |
| Experience learning | Secret-safe capture, semantic replay, fixture variation, shadowing, drift, expiry, rollback |
| Fleet | Enrollment, attestation, offline queue, conflict reconciliation, placement, remote stop |
| Accessibility | Keyboard, screen reader, captions, voice interruption, reduced motion, language changes |

## 9. Primary architectural references

- [Linux kernel documentation](https://docs.kernel.org/) and
  [subsystem APIs](https://docs.kernel.org/subsystem-apis.html)
- [Linux userspace API](https://docs.kernel.org/userspace-api/index.html) and
  [cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)
- [Darwin/XNU architecture](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/KernelProgramming/Architecture/Architecture.html),
  [Mach](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/KernelProgramming/Mach/Mach.html), and
  [I/O Kit](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/KernelProgramming/IOKit/IOKit.html)
- [Apple platform hardware security](https://support.apple.com/guide/security/hardware-security-overview-secf020d1074/web)
- [Windows kernel-mode components](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/),
  [Object Manager](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/windows-kernel-mode-object-manager), and
  [process security/access tokens](https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights)
- [Android platform security enhancements](https://source.android.com/docs/security/enhancements) and
  [on-device signing architecture](https://source.android.com/docs/security/features/verifiedboot/on-device-signing-architecture)
- [FreeBSD Architecture Handbook](https://docs.freebsd.org/en/books/arch-handbook/)
- [Fable OS](https://github.com/robiot/fable-os),
  [AIOS](https://github.com/agiresearch/AIOS),
  [Microsoft UFO](https://github.com/microsoft/UFO), and
  [Microsoft Skill Recorder](https://github.com/microsoft/skill-recorder)
- [iii AgentOS](https://github.com/iii-hq/agentos),
  [CoWork OS](https://github.com/CoWork-OS/CoWork-OS),
  [OpenDAN](https://github.com/fiatrete/OpenDAN-Personal-AI-OS), and
  [OpenSwarm](https://github.com/openswarm-os/openswarm)

## Change log

- **2026-08-02:** Established the mature operating-system anatomy as the
  canonical benchmark; mapped 48 responsibilities, 25 core object translations,
  Linux/macOS/Windows/Android patterns, current agent-OS convergence, Allternit
  ownership, claim gates, and conformance families.
