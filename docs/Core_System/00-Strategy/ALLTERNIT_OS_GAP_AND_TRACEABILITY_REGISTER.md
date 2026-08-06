# AllternitOS Gap and Traceability Register

**Status:** Canonical living architecture register  
**Owner:** Allternit architecture program  
**Created:** August 3, 2026  
**Review cadence:** Every ADR, evidence change, milestone exit, or production incident  
**Companions:** `ALLTERNIT_OS_LIVING_ROADMAP.md`, `CANONICAL_OS_BENCHMARK_AND_AGENTIC_MAPPING.md`
**Upstream sourcing:** `ALLTERNIT_OS_UPSTREAM_FORK_AND_BORROW_REGISTER.md`

## 0. Purpose and rules

This register turns the AllternitOS vision into auditable obligations. A feature
is not an OS capability because it appears in a UI, package, or blueprint. It is
an OS capability only when it has an accountable owner, a non-bypassable
contract, durable state rules, deterministic failure and recovery behavior,
independent evidence, and a passing conformance test.

The initial entries are architecture findings, not claims of completion. Existing
paths identify candidate foundations and must be qualified before adoption.

**Disposition:** Adopt, Adapt, Merge, Build, Replace, Retire, Research, Blocked.  
**Maturity:** Idea, Specification, Prototype, Qualified, Production.  
**Severity:** G0 blocks a safe kernel; G1 blocks a coherent product; G2 blocks
scale or parity; G3 is an improvement.

## 1. Executive gap statement

Allternit already has substantial runtime, workflow, executor, policy, receipt,
browser, computer-use, artifact, memory, model, voice, plugin, device, and VM
code. What it does not yet have is one proven authority graph joining those
parts. The decisive gaps are:

1. no ratified language-neutral OS protocol and canonical object state machines;
2. no demonstrated non-bypassable capability gateway across every executor;
3. no single durable journal that is authoritative across surfaces and crashes;
4. no transactional package format spanning agents, models, skills, drivers,
   policies, UI projections, and generated components;
5. no independent evidence plane for safely promoting self-generated systems;
6. no Hosted/Native conformance suite proving one product with two backends;
7. no bootable Native reference image with immutable recovery authority;
8. incomplete identity, tenancy, deletion, backup, update, and incident lifecycles.

Deletion of the old AllternitOS shell must wait for an import/runtime evidence
audit. Its authority should be removed; reusable views may be retained as clients.

## 2. The 48-responsibility master register

The next three tables jointly record every required field for every
responsibility. `H` is the proposed Hosted owner; `N` is the proposed Native
boot/system owner. Owners are architectural service names until teams are named.

### 2.1 Requirement, ownership, parity, code, disposition

| ID | Responsibility / OS guarantee | Hosted owner | Native owner | Parity | Existing Allternit evidence | Status | Maturity | Gap |
|---|---|---|---|---|---|---|---|---|
| R01 | Constitution/ABI: invariants and compatibility cannot be bypassed or silently changed | Protocol Authority | signed system-law service | identical | roadmaps, benchmark, policy docs | Build | Specification | G0 |
| R02 | Inventory: enumerate hardware, models, tools, runtimes, devices, health and trust | Runtime Inventory daemon | udev/hw inventory + runtime inventory | same semantics/backend | orchestrator runtime discovery; Firecracker metrics | Merge | Prototype | G1 |
| R03 | Root of trust: verify signers for code, models, policy and updates | Trust service + host keystore | TPM/Secure Boot trust service | same semantics/backend | package/plugin manifests; Firecracker security design | Build | Specification | G0 |
| R04 | Measured boot: start only measured daemon, policy, packages, weights and images | signed launcher/measurement service | UEFI shim + measured early userspace | same semantics/backend | VM build/service material | Build | Specification | G0 |
| R05 | Early userspace: start journal, policy, registry and recovery before agents | bootstrap supervisor | initramfs bootstrap/recovery | same semantics/backend | daemon patterns; kernel service crates | Merge | Prototype | G0 |
| R06 | Hardware abstraction: stable Model/Tool/Device/Voice/Browser/Executor contracts | adapter registry | HAL/driver manager | identical contract/backend | provider adapters; computer-use SDK; browser tools | Adapt | Prototype | G1 |
| R07 | Object model: durable IDs and lifecycles for workloads, steps, leases, artifacts and packages | Object Registry | object registry system service | identical | sessions/goals/jobs, Cowork types/checkpoints | Merge | Prototype | G0 |
| R08 | Interrupts/timers: cancellation, expiry and emergency stop never await model cooperation | Interrupt service | privileged interrupt/watchdog | same semantics/backend | executor cancellation patterns; multimodal signaling | Build | Specification | G0 |
| R09 | Scheduler: allocate model, executor, money, energy, risk and attention fairly | Workload Scheduler | scheduler + placement service | identical policy/backend | Rails/workflow/orchestrator/job queue | Merge | Prototype | G0 |
| R10 | Concurrency: structured branches, locks, cancellation propagation and deadlock handling | Concurrency controller | same service under init | identical | DAG/workflow/orchestrator foundations | Adapt | Prototype | G1 |
| R11 | Context memory: bounded context may be evicted without losing authoritative truth | Context manager | context manager/model service | identical | gizzi memory; `rails/src/memory.rs`; memory acceptance tests | Adapt | Prototype | G1 |
| R12 | Physical/model memory: account RAM, VRAM, KV cache and residency under pressure | Resource manager | kernel telemetry + model residency manager | same semantics/backend | executor resource manager; Firecracker cgroups | Adapt | Prototype | G1 |
| R13 | Workload lifecycle: admit through archive with pause, resume, cancel and recovery | Workload Runtime | workload system service | identical | gizzi jobs/goals/sessions; Cowork run/checkpoint | Merge | Prototype | G0 |
| R14 | IPC: typed, authenticated, ordered, cancellable and backpressured communication | Event bus/RPC | local bus + protocol sockets | identical | relay, orchestration, streaming and event code | Merge | Prototype | G1 |
| R15 | System-call boundary: every consequential request passes policy and capability validation | Capability Gateway | privileged capability gateway | identical | Rails policy; permission and auth-bypass tests | Adapt | Prototype | G0 |
| R16 | Drivers: stable operations map to qualified device/app/browser/API implementations | Driver Manager | userspace/HAL driver manager | same semantics/backend | computer-use SDK/plugins; browser tools; generated-system blueprint | Adapt | Prototype | G1 |
| R17 | Plug-and-play: discover, attest, bind, quarantine and remove resources safely | Discovery service | device/resource discovery service | same semantics/backend | runtime discovery; MCP/plugin/device code | Merge | Prototype | G1 |
| R18 | I/O manager: typed async calls have timeout, idempotency, cancellation and receipts | Executor Gateway | executor gateway | identical | `infrastructure/executor`; computer-use canonical SDK | Adapt | Prototype | G0 |
| R19 | Artifact VFS: name and transact over artifacts, memory, packages and connectors | Artifact VFS | mounted artifact/data service | identical namespace/backend | artifact packages/UI; workspace and connector code | Merge | Prototype | G1 |
| R20 | Storage: encrypted classes, quota, snapshot, migration, repair and export | Storage service | volume/storage manager | same semantics/backend | Cowork checkpoint/sync; local stores | Build | Specification | G1 |
| R21 | Network: identity-bound transport, egress policy, discovery and offline queues | Network broker | network broker/firewall service | same semantics/backend | relay, Firecracker netpolicy/IPAM, device pairing | Adapt | Prototype | G0 |
| R22 | Identity/session: authenticate people, orgs, agents, packages, runtimes and devices | Identity service | login/session/identity service | identical principals/backend | auth and pairing foundations | Merge | Prototype | G0 |
| R23 | Reference monitor: all protected reads, actions, spend and communications are mediated | Policy monitor | privileged policy monitor | identical | `rails/src/policy.rs`; policy acceptance tests | Adapt | Prototype | G0 |
| R24 | Capability handles: rights are narrow, expiring, revocable and attenuated downstream | Lease service | lease service | identical | approvals/permission foundations | Build | Specification | G0 |
| R25 | Isolation: select a reproducible risk tier from declarative through GUI VM | Isolation manager | namespace/container/KVM manager | same semantics/backend | Firecracker driver/security; executor Docker | Adapt | Prototype | G0 |
| R26 | Secrets: opaque handles, encryption, redaction, rotation and revocation | Secret broker | TPM/keyring-backed secret broker | same semantics/backend | `rails/src/vault/oauth.rs`; provider key handling | Adapt | Prototype | G0 |
| R27 | Accounting: attribute compute, storage, tokens, money, energy and attention | Budget service | budget/resource service | identical | executor resources; usage/provider accounting candidates | Merge | Prototype | G1 |
| R28 | Service manager: dependencies, health, restart, backoff and circuit breaking | Service supervisor | init/system service manager | same semantics/backend | daemon/job and guest-health foundations | Adapt | Prototype | G1 |
| R29 | Configuration: typed, layered, migratable settings with provenance and policy | Config service | system/user config service | identical schema/backend | package and surface configuration | Merge | Prototype | G1 |
| R30 | Runtime/compiler: load packages and compile learned/generated capabilities safely | Compiler/runtime service | compiler/runtime service | identical | WASM/kernel candidates; skills/tools/plugins | Adapt | Prototype | G1 |
| R31 | Package lifecycle: signed resolution, staged activation, revocation and rollback | Package manager | system/package manager | identical format/backend | plugin SDK/catalog/installer foundations | Merge | Prototype | G0 |
| R32 | Data model: explicit ownership, class, retention, portability and deletion | Data governance service | user/system data service | identical | purpose/memory/artifact foundations | Build | Specification | G0 |
| R33 | Search/index: permission-preserving retrieval with citations and freshness | Index service | local index service | identical query/backend | memory/retrieval/search candidates | Adapt | Prototype | G1 |
| R34 | GUI/session: surfaces project shared state and never own workloads | Projection/session service | compositor/shell/session service | same semantics/backend | Desktop/Web/iOS/TUI/Office/A2UI surfaces | Adapt | Prototype | G1 |
| R35 | Input/media: normalize text, touch, voice, screen and accessibility input | Turn/input service | input/media/AT service | same semantics/backend | multimodal streaming; voice/computer-use | Adapt | Prototype | G1 |
| R36 | Attention: durable prioritized approvals, alerts and resumable escalation | Attention manager | notification/attention service | identical | approvals/UI/background-job patterns | Build | Specification | G1 |
| R37 | Evidence: append-only correlated events and receipts independent of model prose | Evidence service | protected evidence service | identical | Rails receipts; receipt chain acceptance tests | Adapt | Prototype | G0 |
| R38 | Fault containment: bound loops, hangs, false reports, exhaustion and poison | Fault manager | watchdog/quarantine service | identical | executor timeouts; quarantine; Firecracker isolation | Adapt | Prototype | G0 |
| R39 | Recovery: deterministic replay, compensation and safe mode after partial failure | Recovery controller | external recovery controller | same semantics/backend | Cowork checkpoints; recovery-agent materials | Build | Specification | G0 |
| R40 | Updates: signed atomic channels, schema migration, health gates and rollback | Update service | A/B image/package updater | same semantics/backend | packaging foundations; no unified updater proven | Build | Specification | G0 |
| R41 | Backup/reset: encrypted selective restore, portable export and safe reset | Backup service | recovery/backup service | same semantics/backend | sync/checkpoint candidates | Build | Specification | G1 |
| R42 | Virtualization: reproducible disposable environments selected by risk | VM manager | KVM/QEMU/libvirt service | same semantics/backend | Firecracker driver; VM service docs; executor | Adapt | Prototype | G1 |
| R43 | Fleet: enroll, place, reconcile, sync and remotely stop devices/workloads | Fleet controller | enrolled device agent | same semantics/backend | relay, pairing, runtime discovery, Cowork sync | Merge | Prototype | G1 |
| R44 | Energy/thermal: checkpoint and adapt model/concurrency to power and heat | Energy-aware scheduler | power/thermal integration service | Native-enhanced | resource accounting only; no coherent policy proven | Build | Idea | G2 |
| R45 | Admin/dev tools: inspect, replay, explain, simulate, debug and extend | Admin API + gizzi-code | gizzi-code/admin/recovery tools | identical APIs/backend | gizzi-code TUI; SDKs; diagnostics | Adapt | Prototype | G1 |
| R46 | Conformance: certify protocol, packages, executors, surfaces and recovery | Conformance service/lab | same suite + hardware lab | identical suite plus Native cases | computer-use conformance; acceptance tests | Merge | Prototype | G0 |
| R47 | Privacy/tenancy: isolation, consent, retention and derived-state deletion | Privacy/tenancy service | local tenant/data service | identical | memory retention/approval tests; purpose-binding concepts | Build | Specification | G0 |
| R48 | Localization/accessibility: equivalent operation across locale, ability and modality | Semantic UI/locale service | shell/AT/locale service | identical semantics/backend | accessibility trees and surface candidates | Build | Specification | G1 |

### 2.2 Contract, authority and durable state

| ID | Contract / state machine | Authority | Durable state |
|---|---|---|---|
| R01 | `ProtocolVersion`, compatibility negotiation, system-law decision | offline release authority; constrained admin policy | protocol/ABI versions, ADRs, policy hashes |
| R02 | `InventorySnapshot`, `ResourceChanged`, health/attestation lifecycle | signed discovery providers; inventory is read-only to agents | identities, capabilities, attestations, last health |
| R03 | signer and key lifecycle: pending→active→rotated/revoked | offline root/release security authority | roots, delegations, revocations, transparency proofs |
| R04 | measurement chain and boot verdict | immutable bootstrap only | measurements, verdict, selected image, failure reason |
| R05 | service DAG and bootstrap phases | bootstrap supervisor; recovery operator | boot attempt, service health, recovery selection |
| R06 | versioned Model/Tool/Device/Voice/Browser/Executor interfaces | package manager binds qualified adapters | adapter identity, compatibility, qualification |
| R07 | canonical object schemas and lifecycle events | owning principal plus policy-mediated system services | IDs, owners, versions, states, references, tombstones |
| R08 | `Interrupt`, `Cancel`, `LeaseExpired`, monotonic deadline | user emergency path, policy, scheduler, hardware watchdog | interrupt receipt and unresolved external effects |
| R09 | admission/placement decision and scheduling lifecycle | scheduler under policy/budget constraints | queues, priorities, reservations, decisions, rationale |
| R10 | branch/task group/lock lifecycle | parent workload and scheduler; no privilege amplification | DAG, child links, locks, joins, cancellation status |
| R11 | context segment lifecycle and retrieval request | context manager under data/capability policy | source references, summaries, compaction provenance |
| R12 | residency reservation/pressure/reclaim events | resource manager; agents request but cannot force | budgets, residency map, pressure/reclaim history |
| R13 | Workload and Step formal state machines | owner, delegated agent, scheduler, recovery controller | objective, plan, attempts, checkpoints, outputs, terminal state |
| R14 | typed event/stream/request with identity and ordering | authenticated principals with schema-granted rights | event offsets, acknowledgements, durable subscriptions |
| R15 | `CapabilityRequest→Decision→Lease→Invocation→Receipt` | reference monitor alone grants; user/policy approves | requests, decisions, leases, revocations, receipts |
| R16 | driver manifest and operation contract | signed package + qualification authority | versions, bindings, tests, quarantine/revocation |
| R17 | discovered→attested→bound→healthy/quarantined→removed | discovery proposes; policy and driver manager bind | resource identity, attestation, bindings, status |
| R18 | idempotent invocation and typed completion | capability-holding workload through gateway | invocation key, attempts, output refs, receipt |
| R19 | artifact/mount transaction and namespace API | owner/collaborators through leases | content hashes, versions, provenance, ACLs, retention |
| R20 | store/volume snapshot, repair and migration states | storage service; policy controls export/destruction | encrypted volumes, quotas, snapshots, schema versions |
| R21 | identity-bound connection/egress request | network broker under policy; no raw agent sockets by default | policies, peer identities, queues, connection receipts |
| R22 | Principal, DeviceEnrollment and UserSession machines | identity provider plus local login/recovery authority | principals, credentials refs, sessions, delegation graph |
| R23 | policy decision API with complete mediation invariant | protected policy monitor; policy authors cannot forge evidence | rules, versions, decisions, exceptions, policy provenance |
| R24 | lease lifecycle: requested→approved→active→expired/revoked | policy/approval authority; delegation only attenuates | scope, purpose, subject, budget, expiry, revocation |
| R25 | isolation envelope request and lifecycle | isolation manager selects minimum or stronger tier | image/config hashes, network/data mounts, exit/failure |
| R26 | opaque secret-handle and use/rotation API | secret broker; agents never receive raw secret by default | encrypted secrets, ACL/purpose, rotations, revocations |
| R27 | reserve/charge/release/reconcile budget API | owner/org policy and accounting service | ledgers, limits, reservations, costs, disputes |
| R28 | declarative service unit lifecycle | admin/package manager; supervisor controls runtime | definitions, dependencies, health, restart history |
| R29 | typed configuration with precedence/migration | owner/org/admin within schema policy | values, layer, provenance, version, migration history |
| R30 | package load/compile/qualify API | runtime loads only signed, compatible, leased resources | build inputs, outputs, toolchains, provenance, qualification |
| R31 | package machine: staged→verified→installed→active→revoked/rolled back | package authority; policy gates high-risk activation | manifests, signatures, dependency lock, active/rollback sets |
| R32 | data-class and deletion ledger | data owner subject to legal/org policy | class, owner, purpose, retention, derivations, tombstones |
| R33 | permission-filtered index/update/query API | index service derives only authorized searchable views | index versions, source refs, ACL snapshots, freshness |
| R34 | projection/session/focus/clipboard contract | authenticated user session; surfaces hold revocable views | layout preferences, session refs, not workload truth |
| R35 | normalized input/turn/media streams | active user/device plus scoped agent capture rights | transcripts/recordings only under retention policy |
| R36 | attention request lifecycle | services request; user/org policy prioritizes/escalates | pending decisions, deadlines, snooze/escalation history |
| R37 | event/receipt append/query/verify API | producers sign; protected service orders; evaluators read | hash-chained journal, receipts, evidence refs, trace graph |
| R38 | health/fault/quarantine lifecycle | watchdog/reference monitor/recovery controller | failure bundles, quarantine decisions, counters |
| R39 | checkpoint/replay/compensate/restore machine | external recovery controller; owner selects destructive repair | checkpoints, compensation log, restore point, repair evidence |
| R40 | update candidate/ring/health/rollback machine | signed release authority plus local policy | image/package sets, migrations, health, rollback slot |
| R41 | backup set/restore/reset state machines | owner/recovery authority with identity recovery | encrypted manifests, objects, restore logs, exclusions |
| R42 | environment/image/snapshot lifecycle | isolation/VM manager under workload lease | image hashes, config, snapshots, device bindings |
| R43 | enrollment/placement/sync/revocation machines | owner/org fleet authority and local device consent | device identities, policy, assignments, sync clocks |
| R44 | power mode/thermal pressure/sleep/wake events | OS power manager; workload supplies hints only | policy, checkpoints, energy attribution, wake triggers |
| R45 | inspect/replay/simulate/admin APIs | role-scoped operator/developer; break-glass audited | diagnostic sessions, simulations, admin changes |
| R46 | test manifest/result/certificate/revocation API | independent conformance authority | vectors, environment hashes, results, certificates |
| R47 | tenant/consent/retention/deletion/derived-state machines | data subject/org within declared legal authority | consent, purpose, keys, derivation graph, deletion proofs |
| R48 | semantic UI, locale and modality conformance contract | user preferences; policy cannot remove essential access | locale/AT preferences and accessibility test evidence |

### 2.3 Failure, recovery, evidence and conformance

| ID | Failure behavior and recovery | Required evidence | Conformance test |
|---|---|---|---|
| R01 | reject incompatible change; remain on known contract | signed protocol diff and compatibility report | CT-01 incompatible client/package is safely rejected |
| R02 | stale/untrusted resources become unavailable, not silently healthy | attestation and health receipts | CT-02 hot add/remove and forged inventory |
| R03 | revoked/unknown signer cannot activate; rotate from offline root | signature chain and transparency/revocation proof | CT-03 compromised signing key rotation |
| R04 | enter safe mode/known-good image | complete measurement log | CT-04 tampered daemon/model/image boot |
| R05 | dependency failure isolates optional services; minimal recovery stays live | ordered boot and health journal | CT-05 crash each boot phase |
| R06 | incompatible adapter is quarantined; fallback qualified adapter | binding/compatibility receipt | CT-06 cross-backend golden operations |
| R07 | illegal transition rejected; interrupted transition replayed | state/event sequence and invariant check | CT-07 object lifecycle/property tests |
| R08 | cancellation is bounded; unresolved side effects are surfaced | monotonic timestamps and cancel receipts | CT-08 maximum cancellation/barge-in latency |
| R09 | overload queues, sheds, or degrades by policy; no hidden overspend | admission/placement/budget rationale | CT-09 fairness, starvation and exhaustion chaos |
| R10 | parent failure cancels/reaps children; deadlock breaks deterministically | branch/lock/cancel trace | CT-10 cancellation and deadlock suite |
| R11 | discard cache and reconstruct from durable sources | source/compaction provenance | CT-11 context eviction without truth loss |
| R12 | unload/degrade/checkpoint before host instability | pressure and reclaim receipts | CT-12 RAM/VRAM exhaustion |
| R13 | resume idempotently or compensate; never guess completion | checkpoint, attempt, artifact and terminal receipts | CT-13 crash at every workload transition |
| R14 | dedupe/replay or dead-letter by schema policy | sequence IDs, acks, delivery trace | CT-14 duplicate, reorder and partition tests |
| R15 | deny closed if policy unavailable; emergency recovery is separate | request/decision/lease/invocation chain | CT-15 direct-executor bypass attempts |
| R16 | quarantine bad driver and bind known-good fallback | qualification and runtime health evidence | CT-16 malicious/failing driver rollback |
| R17 | untrusted resource remains quarantined; removal revokes leases | discovery/attestation/binding record | CT-17 hostile MCP hot-plug/unplug |
| R18 | ambiguous completion is reconciled by idempotency key/effect query | typed result plus external effect evidence | CT-18 succeeds-but-reports-failure inverse cases |
| R19 | atomic commit or rollback; repair from journal/content hashes | transaction and provenance chain | CT-19 crash/corrupt artifact transaction |
| R20 | quota pressure degrades safely; restore snapshot after corruption | snapshot, repair and migration evidence | CT-20 disk-full and schema migration rollback |
| R21 | deny unknown egress; queue permitted offline work; revoke peer | connection/egress receipts | CT-21 hostile endpoint and offline partition |
| R22 | revoke sessions/delegations; recover identity without stale authority | authentication and delegation chain | CT-22 stolen device/user removal |
| R23 | fail closed; protected recovery policy only | policy input, version, decision and enforcement receipt | CT-23 policy outage/bypass/cached-decision expiry |
| R24 | expired/revoked lease fails before effect; descendants revoked | lease ancestry and enforcement receipt | CT-24 late approval and delegated attenuation |
| R25 | destroy/quarantine envelope; preserve redacted failure bundle | image/config/containment receipts | CT-25 escape and cross-workload leakage tests |
| R26 | revoke/rotate; scrub handles and redact logs | use, rotation and access receipts without secret value | CT-26 secret exfiltration/logging attempts |
| R27 | pause/degrade/ask on exhaustion; reconcile reservations after crash | signed usage ledger and budget decisions | CT-27 tokens/money/compute exhaustion |
| R28 | restart with bounded backoff; isolate crash loops | health and restart trace | CT-28 dependency and crash-loop fault injection |
| R29 | reject invalid migration; revert prior version | config provenance and migration report | CT-29 corrupt/older/newer configuration |
| R30 | failed or malicious build remains sandboxed; use known-good runtime | reproducible build and qualification evidence | CT-30 poisoned toolchain/generated harness |
| R31 | activation is atomic; rollback/revoke complete dependency closure | signatures, lockfile, activation/rollback receipts | CT-31 malicious package install/revoke |
| R32 | deny undefined data class; propagate deletion to derivations | ownership/retention/deletion ledger | CT-32 remove user and derived state |
| R33 | omit unauthorized/stale result; rebuild disposable index | query authorization and source citation | CT-33 ACL change and stale-index leakage |
| R34 | surface crash loses no workload truth; reconnect/reproject | state version and projection ack | CT-34 Desktop→iOS→TUI convergence |
| R35 | device/media failure switches modality or requests help | turn/input timestamps and transcript policy | CT-35 duplex interruption and accessibility parity |
| R36 | persist request; escalate once; suppress storms by policy | attention lifecycle trace | CT-36 offline/late approval and alert storm |
| R37 | reject broken chain/forged producer; restore from replicated journal | hashes, signatures, independent observations | CT-37 evidence forgery and partial journal write |
| R38 | terminate/quarantine within bounds; preserve failure bundle | watchdog, circuit and quarantine record | CT-38 runaway/lying agent/provider chaos |
| R39 | boot/daemon-independent recovery chooses replay, compensate or rollback | recovery plan and verified outcome | CT-39 power loss at every external action boundary |
| R40 | failed health gate returns to known-good image/schema | signatures, rollout health and rollback receipt | CT-40 failed update and old recovery schema |
| R41 | restore onto new hardware without revoked secrets/bad runtime state | backup manifest and restore verification | CT-41 loss, full restore, selective restore, reset |
| R42 | kill and recreate environment; preserve only declared artifacts/checkpoint | image attestation and teardown receipt | CT-42 reproducibility and isolation escape |
| R43 | reconcile offline state; remote stop and device revocation win conflicts | enrollment, sync and stop receipts | CT-43 offline device/stolen device/fleet partition |
| R44 | checkpoint/degrade before thermal shutdown; resume safely after wake | energy/thermal decisions and checkpoint evidence | CT-44 battery, sleep/wake, thermal stress |
| R45 | admin tool failure cannot bypass kernel; replay is side-effect isolated | operator identity and diagnostic receipts | CT-45 role separation and replay safety |
| R46 | uncertified component cannot claim compatibility; revoke bad certificate | immutable environment/results/certificate | CT-46 Hosted/Native golden and chaos suite |
| R47 | isolate tenant; crypto-erase plus derived-state repair/retrain | consent, lineage and deletion proof | CT-47 cross-tenant, consent withdrawal, forgetting |
| R48 | inaccessible/incorrect projection blocks release; preserve alternate control path | semantic/accessibility/locale reports | CT-48 pre-login/recovery/cross-surface accessibility |

## 3. Hosted/Native parity audit

| Class | Meaning | Responsibilities | Rule |
|---|---|---|---|
| P1 Identical contract | Same externally observable semantics | 01, 06–19, 22–24, 26–39, 45–48 | Golden traces must match |
| P2 Same semantics, different backend | Host integration differs but guarantees do not | 02–05, 20–21, 25, 40–43 | Backend-specific receipts plus shared tests |
| P3 Native-enhanced | Native exposes hardware/boot behavior Hosted can only observe indirectly | 04–05, 20, 42, 44 | Workloads degrade explicitly when moved Hosted |
| P4 Hosted limitation | Host OS may deny raw hardware, boot, kernel or global networking control | 03–05, 16, 20–21, 40, 44 | Capability negotiation must make absence explicit |
| P5 Portable workload state | Objective, graph, policy refs, artifacts, checkpoints, receipts | 07, 09–15, 19, 27, 32, 37, 39 | No device driver or raw secret material |
| P6 Non-portable machine state | Firmware, device binding, thermal state, raw VM snapshot, local key handles | 02–05, 12, 16–17, 20–21, 42–44 | Export produces a portable reconstruction recipe |

Parity answers:

- Workloads move when required packages/capabilities exist; otherwise placement
  stops with an explicit unsatisfied-capability result.
- Learned adapters move only with compatible base-model hash, license, consent,
  evaluation, hardware budget, and provenance.
- Capability meanings are contract-identical; backend strength is attested.
- Native-only operations are declared requirements and may have a safe Hosted
  substitute, never an implicit downgrade.
- Drivers are machine packages excluded from portable workload bundles.
- Lost origin machines recover from journal, artifacts, package locks and portable
  checkpoints; opaque device keys require reauthorization.
- Native environments must export a reproducible recipe runnable in the Hosted
  conformance microVM when the device class permits it.

## 4. End-to-end journey coverage

Every journey is traced through: **Intent → identity → admission → planning →
authority → scheduling → execution → evidence → artifact → interruption → failure
→ recovery → deletion**. A dash is not allowed in a qualified journey.

| J | Journey | Critical transitions/services | Initial gap | Acceptance |
|---|---|---|---|---|
| J01 | Install Hosted and begin offline work | installer→identity→local model→workload→journal | signed bootstrap and offline pack not proven | JT-01 |
| J02 | Install Native on blank hardware | installer→measured boot→image→enrollment→shell | no qualified image/hardware target | JT-02 |
| J03 | Boot with no network | boot→local identity/policy/model→offline queue | dependency/offline matrix missing | JT-03 |
| J04 | Boot after failed update | boot verdict→known-good slot→schema rollback | atomic updater/recovery unimplemented | JT-04 |
| J05 | Desktop work continued on iOS | workload journal→sync→projection→lease refresh | canonical convergence authority unresolved | JT-05 |
| J06 | Voice start, interrupt, finish in TUI | turn manager→interrupt→checkpoint→TUI projection | bounded cross-surface interruption unproven | JT-06 |
| J07 | Seven-day autonomous workload | lease renewal→budget→checkpoint→provider failover | long-horizon admission/recovery unproven | JT-07 |
| J08 | Generate tool during workload | intent→foundry→WASM lab→promotion→lease | independent evaluator/promotion gate missing | JT-08 |
| J09 | Train and activate personal adapter | consent→episode set→train→eval→canary→load | derived deletion and ownership unresolved | JT-09 |
| J10 | Generate and test scheduler | candidate→simulation→shadow→canary→fallback | evaluator isolation and native canary absent | JT-10 |
| J11 | Install/revoke malicious package | registry→verify→stage→detect→revoke→repair | transactional dependency-wide revocation absent | JT-11 |
| J12 | Lose device during sensitive work | remote stop→key revoke→lease revoke→recovery | offline stolen-device guarantees unresolved | JT-12 |
| J13 | Remove user and derived memories | identity disable→lineage walk→delete/retrain→proof | derived-state ledger absent | JT-13 |
| J14 | Restore backup on new hardware | recover identity→verify backup→restore portable state | backup schema and secret exclusions undefined | JT-14 |
| J15 | Model provider dies mid-work | circuit→checkpoint→reroute→semantic validation | provider-neutral continuation semantics unproven | JT-15 |
| J16 | Exhaust disk/RAM/VRAM/tokens/money | pressure→admission/degrade→checkpoint→resume | unified resource policy absent | JT-16 |
| J17 | Recover with every LLM disabled | recovery UI/TUI→journal→rollback/export | recovery still risks model dependencies | JT-17 |
| J18 | Two users share one workload | principals→delegation→per-step leases→artifact ACL | collaboration authority model incomplete | JT-18 |
| J19 | Run ordinary Linux app in Native | package/container/portal→compositor→data lease | compatibility/portal strategy unspecified | JT-19 |
| J20 | Roll back generated kernel/driver | health signal→bypass→known-good boot→quarantine | production health authority not built | JT-20 |

Journey review rule: each `JT-*` test must inject interruption and failure after
every arrow, then verify recovery and deletion. The test is not complete if it
only proves the happy path.

## 5. Canonical state-machine inventory

| Object | Required states (minimum) | Transition authority | Gap |
|---|---|---|---|
| Workload | proposed→admitted→planned→ready→running↔waiting/paused→completed/failed/cancelled→archived/deleted | owner, admission, scheduler, recovery | G0 formalize |
| Step | pending→ready→leased→running→succeeded/failed/ambiguous→compensated/skipped | scheduler, executor gateway, recovery | G0 formalize |
| Capability lease | requested→approved/denied→active→expired/revoked→closed | policy/approval; clock/revoker | G0 build |
| Approval | requested→presented→approved/denied/expired/withdrawn→consumed | user or delegated policy | G1 merge |
| Artifact | draft→committed→versioned→shared→superseded→retained/deleted | owner/collaborator/data policy | G1 formalize |
| Agent package | staged→verified→installed→qualified→active→quarantined/revoked→removed | package/conformance authority | G0 build |
| Model package | staged→license/compat checked→evaluated→active→degraded/revoked→removed | model/package authority | G0 build |
| Generated kernel | draft→built→static checked→sandbox tested→adversarially tested→shadowed→canary→active→degraded→revoked→archived | independent evaluator; release authority | G0 research/build |
| Learned skill | candidate→sanitized→replayed→evaluated→approved→active→drifted/revoked→deleted | experience compiler; independent evaluator | G0 build |
| Native deployment | composed→signed→staged→boot probation→active→degraded→rolled back/recovered | release/root/recovery authority | G0 build |
| Device enrollment | discovered→challenged→enrolled→healthy/offline→lost/quarantined→revoked→retired | owner/org + device proof | G1 build |
| User session | authenticating→active→locked→reauthenticating→expired/revoked→closed | identity service/user/admin policy | G0 merge |
| Backup/restore | selected→snapshotted→encrypted→verified→retained→restoring→verified/failed→expired | owner/recovery service | G1 build |
| Security incident | detected→triaged→contained→eradicated→recovering→verified→closed/monitored | incident authority outside affected agent | G0 build |

Every transition requires: actor, preconditions, capability, policy version,
evidence, idempotency rule, timeout, interruption behavior, and compensation.

## 6. Trust boundaries and threat register

The hard invariant is: **a generated or compromised data-plane component cannot
modify the policy, evaluator, evidence, tests, or promotion decision that judges
it.** Independent does not merely mean a different agent prompt; it means a
separate identity, capability set, storage boundary, and release authority.

| Threat actor | Entry / escalation | Detection | Containment and recovery | Residual risk |
|---|---|---|---|---|
| Malicious user | crafted intent, approval abuse, shared artifacts | policy anomalies, rate/budget signals | least privilege, tenant isolation, revoke/export evidence | authorized misuse |
| Compromised agent | tool requests, delegation, evidence claims | independent observations, behavior canary | revoke leases, kill workload, quarantine package | actions already externalized |
| Poisoned model | weights/package/provider output | provenance, adversarial eval, shadow divergence | unload/reroute/rollback, invalidate derivatives | latent trigger coverage |
| Poisoned training episode | memory/trace/feedback | consent/lineage checks, outlier/replay eval | exclude episode, retrain/delete adapter | subtle distributed poison |
| Malicious skill/plugin | package install/runtime hooks | signing, static analysis, capability diff | sandbox, revoke dependency closure, rollback | supply-chain signer compromise |
| Compromised MCP server | discovery/tool response/prompt injection | attestation, schema and behavior monitors | quarantine resource, revoke network/secret leases | legitimate-looking bad data |
| Hostile website | DOM/content/download/SSRF | content boundary labels, browser isolation | disposable identity/VM, egress limits | novel injection patterns |
| Malicious document | parser/content instructions/macros | type scanner, provenance, canary parsers | isolated parser, no implicit tool authority | parser zero-days |
| Compromised provider | inference/API/logging | response/evidence mismatch, provider health | circuit breaker, local/offline fallback, key rotation | provider data retention |
| Stolen device | local storage/session/offline credentials | attestation absence, owner report | key/lease revoke, crypto erase, remote stop | offline attack window |
| Rogue administrator | policy/package/key changes | dual control, transparency log, anomaly review | break-glass expiration, key rotation, rollback | colluding authorities |
| Supply-chain attacker | dependency, build, firmware, registry | reproducible builds, SBOM, signature/transparency | quarantine, revoke, known-good image | hardware/firmware implants |
| Generated kernel attacks evaluator | benchmark hooks, telemetry forgery, policy weakening | external evaluator/evidence plane, hardware watchdog | kernel bypass, known-good boot, revoke signer | evaluator blind spots |
| Colluding agents | shared state, delegated leases, vote gaming | graph-level anomaly and independent constraints | cancel group, revoke ancestry, isolate principals | stealth coordination |
| Cross-workload prompt injection | shared memory/index/artifact | provenance/taint labels, retrieval policy | compartmentalize, invalidate context/index | semantic covert channels |
| Evidence-gaming agent | fake receipts, metric optimization | signed executor observations, counter-metrics, audits | reject promotion, quarantine lineage | Goodhart effects |

For each boundary—surface↔kernel, model↔capability gateway,
gateway↔executor, workload↔workload, tenant↔tenant, package↔registry,
device↔fleet, data↔evidence, generated candidate↔evaluator, updater↔recovery—an
implementation threat model must enumerate assets, entry points, privilege,
escalation, detection, containment, recovery, and accepted residual risk.

## 7. Control, data and evidence planes

```text
CONTROL PLANE (protected authority)
Identity → admission → policy → leases → scheduler → package/update/recovery
                      │ authorized commands
                      ▼
DATA PLANE (replaceable execution)
Models ↔ context ↔ tools/browser/files/voice/devices ↔ artifacts
                      │ signed observations, never self-issued authority
                      ▼
EVIDENCE PLANE (append-only independent history)
Events → receipts → hashes → evaluations → cost/outcome → promotion verdict
```

Required separations:

- Data-plane code has no write path to policy, trust roots or evidence history.
- Control decisions cite immutable policy and input versions.
- Evidence producers sign observations; the evidence service orders and verifies
  them but cannot invent executor success.
- Evaluators consume immutable candidates and evidence snapshots; candidates
  cannot select or rewrite their own tests.
- Recovery can disable both agents and models while retaining identity, journal,
  verification, rollback and export.

## 8. Model-evolution register

| Area | Required rule | Owner | Test/gap |
|---|---|---|---|
| Consent | no episode enters training beyond declared person/org purpose | Data Governance | ME-01 consent withdrawal; G0 |
| Selection | deterministic, reviewable episode queries with quality labels | Experience Manager | ME-02 reproduce dataset; G1 |
| Secret/PII removal | scan, redact/tokenize, quarantine before training | Secret/Data services | ME-03 seeded secret; G0 |
| Poisoning | provenance weighting, outlier analysis, adversarial replay | Independent Evaluator | ME-04 poison campaign; G0 |
| Ownership | adapter has explicit owner, license and delegation constraints | Package/Data services | ME-05 ownership transfer; G1 |
| Base compatibility | pin base hash, tokenizer, runtime and license | Model Package Manager | ME-06 incompatible base; G0 |
| Forgetting/deletion | lineage identifies derivatives; delete, subtract or retrain with proof | Privacy service | ME-07 user deletion; G0 research |
| Evaluation leakage | training selection cannot read held-out tests or verdicts | Conformance authority | ME-08 canary leakage; G0 |
| Benchmark contamination | label benchmark-derived episodes and exclude them | Evidence/Evaluation | ME-09 contaminated trace; G1 |
| Composition | declare ordering, conflicts, resource cost and joint eval | Model Runtime | ME-10 adapter composition; G1 |
| Personal vs org | org safety floor is not weakened; conflicts are visible | Policy monitor | ME-11 policy conflict; G0 |
| Rollback | unload immediately and restore pinned prior route | Model Runtime | ME-12 regression rollback; G0 |
| Budgets | bound storage, training compute, energy and money before job | Scheduler/Budget | ME-13 exhaustion; G1 |
| Licensing | record base/data/code redistribution constraints | Package Manager | ME-14 export denial; G0 |
| Synthetic provenance | retain generator, prompt/policy, sources and verifier | Evidence service | ME-15 lineage query; G1 |

Deletion rule: when an experience is deleted, every index, summary, skill,
adapter, evaluation cache, synthetic descendant and exported bundle in its
derivation graph must be evaluated for deletion, crypto-erasure, subtraction, or
retraining. A tombstone without derived-state action is not compliance.

## 9. Generated systems qualification

| Candidate | Static verification | Replay/fuzz | Shadow/canary | Human gate | Recovery |
|---|---|---|---|---|---|
| WASM tool | schema, imports, policy lint | replay + fuzz | shadow + risk canary | risk-based | package rollback |
| Model adapter | compatibility/data scan | adversarial eval | shadow + canary | data/risk-based | adapter unload |
| Userspace driver | signatures/interfaces | replay + mandatory fuzz | shadow + device canary | usually | known-good driver |
| CPU scheduler | verifier/symbolic lint | stress + fuzz | simulator shadow + boot canary | required | kernel bypass |
| Kernel driver | build/static/kernel checks | hardware replay + mandatory fuzz | lab shadow + signed hardware ring | required | known-good boot |
| System image | reproducible build/SBOM/signature | VM suite + fault injection | fleet ring + boot probation | release authority | atomic A/B rollback |

Promotion prerequisites are cumulative. Runtime telemetry is signed outside the
candidate. A candidate cannot modify evaluator images, test vectors, health
thresholds, evidence storage, rollback slots, or release keys.

## 10. Repository evidence audit

Initial findings require code-level qualification; they are not final
dispositions.

| Area | Candidate evidence | Initial disposition | Audit question |
|---|---|---|---|
| Policy/receipts | `rails/src/policy.rs`, `rails/src/receipts/`, acceptance tests | Adapt/Merge | do all executor paths pass the same monitor and receipt chain? |
| Execution | `infrastructure/executor/`, job queue/resource manager/Docker | Adapt | are effects idempotent, cancellable and capability-bound? |
| VM isolation | `drivers/firecracker/`, guest agent, netpolicy/cgroups/seccomp | Adapt | production qualification, image trust and cleanup completeness? |
| Workload/checkpoint | gizzi jobs/goals/sessions; Cowork run/checkpoint/sync | Merge | which object model is authoritative and crash-consistent? |
| Orchestration | `packages/@allternit/orchestrator/`, Rails/workflow/DAG systems | Merge | competing session, scheduler and delegation authorities? |
| Computer/browser use | `sdk/computer-use/`, `packages/computer-use/`, browser tools | Adapt | one canonical driver contract, identity boundary and recovery? |
| Memory | `rails/src/memory.rs`, memory acceptance suite, gizzi memory | Merge | data class, consent, lineage and deletion propagation? |
| Packages/skills/plugins | plugin SDK/catalog/installers and manifests | Merge | signing, dependency solver, atomic activation and revocation? |
| Models/voice | providers/local models; multimodal-streaming | Adapt | model package, duplex turn, offline and residency conformance? |
| Artifacts/surfaces | artifact UI/registry; Desktop/Web/iOS/TUI/Office/A2UI | Adapt | surface-owned durable state or direct action paths? |
| Devices/fleet | relay, pairing, runtime discovery, sync | Merge | unified identity, conflict resolution and remote stop? |
| Native/boot/update | kernel service/VM docs and packaging candidates | Research/Build | no proof yet of measured boot, immutable image or A/B recovery |
| Legacy AllternitOS shell | prior React/view implementation | Retire authority; salvage views | exact import/routes/state dependencies before removal? |

Required repository audit outputs:

1. a machine-readable component disposition ledger: Adopt, Adapt, Merge,
   Replace, Retire, Research, Unknown;
2. an authority graph identifying every direct executor, permission decision,
   durable store, scheduler, session/workload model and package loader;
3. a bypass report for paths that act without policy, lease and receipt;
4. a state-ownership report for durable state held by surfaces;
5. a placeholder report separating demonstrable behavior from UI-only claims;
6. a dependency report for private imports and transaction boundaries;
7. an evidence map linking tests to guarantees rather than appearances.

## 11. Failure-first review register

| Failure injection | Deterministic required answer | Test |
|---|---|---|
| process dies between action and receipt | mark ambiguous, query effect by idempotency key, then receipt or compensate | FF-01 |
| approval arrives after lease expiry | reject and request a new approval/lease | FF-02 |
| model responds twice | accept one turn ID; record and discard duplicate | FF-03 |
| tool succeeds but reports failure | reconcile external effect before retry | FF-04 |
| tool fails but reports success | independent effect verifier marks receipt disputed and triggers repair | FF-05 |
| device goes offline mid-transaction | preserve prepared/ambiguous state; resume or compensate after reconciliation | FF-06 |
| clock changes | use monotonic deadlines; trusted wall time only for audit | FF-07 |
| journal partially written | checksum/transaction rejects tail; recover last committed event | FF-08 |
| update changes capabilities | force re-admission/reapproval before activation | FF-09 |
| adapter regresses safety | circuit, unload, pin prior adapter, quarantine lineage | FF-10 |
| generated scheduler hangs | hardware watchdog/kernel bypass boots known-good scheduler | FF-11 |
| emergency stop during delegation | revoke lease ancestry, interrupt all descendants, list unresolved effects | FF-12 |
| backup contains revoked credential | restore excludes secret value and preserves revocation ledger | FF-13 |
| recovery image predates state schema | migrate in isolated copy or export; never mutate sole copy | FF-14 |

## 12. Acceptance and measurable service levels

Targets must be ratified through benchmark ADRs; they are not to be invented by
marketing. The suite must measure at least:

| ID | Measure | Required method |
|---|---|---|
| AT-01 | workload recovery time | crash each state; p50/p95/p99 time to safe resumption |
| AT-02 | action delivery semantics | classify each operation exactly-once, at-least-once+idempotent, or compensating |
| AT-03 | cancellation latency | user interrupt to executor stop and lease revocation |
| AT-04 | voice interruption | speech onset to audible stop and durable turn boundary |
| AT-05 | browser task success | fixed semantic/visual suites with effect verification |
| AT-06 | evidence completeness | percentage of consequential effects with full request→receipt chain |
| AT-07 | rollback | package/model/image rollback success under injected failures |
| AT-08 | state convergence | Desktop/Web/iOS/TUI versions and conflict convergence time |
| AT-09 | isolation | escape, cross-tenant and secret-exfiltration suite |
| AT-10 | model evolution | safety/task regression, poison and deletion compliance |
| AT-11 | generated systems | performance improvement subject to zero authority/evidence regression |
| AT-12 | battery/thermal | energy per useful outcome, thermal throttling and safe checkpoint |
| AT-13 | offline | percentage of reference workloads completed without network |
| AT-14 | update recovery | boot success and data integrity after failure at every update phase |
| AT-15 | backup restore | full/selective/new-hardware restore and revoked-state exclusion |
| AT-16 | accessibility | semantic, keyboard, screen-reader, captions, voice and recovery parity |
| AT-17 | learned efficiency | time/cost/tool-call delta on held-out repeated workflows |

## 13. Missing-area register

| Area | Severity | Required decision/output |
|---|---|---|
| multi-user login/fast switching | G1 | session isolation and shared-device policy |
| family/team/enterprise ownership | G0 | principal, delegation and data-ownership model |
| sync/conflict resolution | G0 | authoritative journal, clocks and merge semantics |
| derived model deletion | G0 | lineage, subtraction/retrain and proof policy |
| ordinary app compatibility/portals | G1 | Flatpak/container/native app and data portal strategy |
| network identity/peer discovery | G1 | mutual identity, attestation and offline discovery |
| incident/vulnerability response | G0 | PSIRT, emergency revocation and recovery runbooks |
| trusted time | G1 | monotonic/trusted timestamp and offline expiry policy |
| model/generated-code licensing | G0 | package license enforcement and export rules |
| hardware/firmware lifecycle | G1 | qualification matrix, firmware update and support policy |
| accessibility pre-login/recovery | G1 | recovery-shell accessibility requirements |
| abuse/compromised-user recovery | G0 | freeze, appeal, identity recovery and evidence access |
| marketplace economics | G2 | signing liability, revenue, revocation and support model |
| org policy vs personal autonomy | G0 | invariant safety floor and conflict UX |
| LTS/protocol compatibility | G1 | support window and deprecation rules |
| Hosted→Native migration | G1 | portable bundle and capability reconciliation |
| migration away from Allternit | G1 | documented open export and deletion proof |
| no-model recovery | G0 | deterministic recovery UI/TUI and tools |
| evaluator independence | G0 | separate identity/storage/compute/release authority |
| metrics gaming | G0 | counter-metrics, hidden tests, external outcome verification |

## 14. Ranked gaps and starting sequence

### Gate A — Constitution before refactor

1. Ratify R01, R07, R13, R15, R24 and R37 contracts and state machines.
2. Create the repository disposition ledger and authority/bypass graph.
3. Select the canonical journal, local daemon and protocol schema through ADRs.
4. Freeze deletion of legacy OS code until its imports, routes and state are
   classified; then remove authority first and UI second.

**Exit:** one workload can be represented, authorized, journaled and inspected
without depending on a particular surface.

### Gate B — One trustworthy vertical slice

Implement a reference workload through:

```text
Desktop or gizzi-code
→ identity/session
→ workload admission
→ policy decision
→ capability lease
→ scheduler
→ isolated executor
→ signed receipt
→ artifact commit
→ crash/restart/replay
→ second-surface projection
```

The slice must pass CT-07, CT-13, CT-15, CT-18, CT-23, CT-24, CT-37 and
JT-05. This is the first proof that the platform is becoming an OS.

### Gate C — Package and learning constitution

Unify agents, models, tools, skills, workflows, policies, drivers and UI
projections under R31. Add the Experience Compiler only after promotion evidence,
rollback, consent, lineage and derived deletion exist.

### Gate D — Native reference distribution

In parallel with Hosted productization, compose a signed QEMU image for
conformance, then a qualified x86-64 machine: measured boot, immutable A/B system,
Allternit shell/compositor, local daemon, local model pack, ordinary Linux app
portal, recovery without LLMs, and known-good kernel bypass.

### Gate E — Generative systems lab

Only after independent evidence and recovery are proven, enable agents to build
WASM tools, harnesses, adapters, userspace drivers, schedulers and kernel
components through the qualification ladder. Native promotion remains separate
from Hosted experimentation.

## 15. First implementation backlog

| Order | Deliverable | Accountable role | Proof |
|---|---|---|---|
| 1 | component disposition ledger and authority graph | architecture owner | every relevant package/path classified |
| 2 | OS protocol ADR and canonical schemas | protocol owner | generated bindings + compatibility vectors |
| 3 | Workload/Step/Lease/Approval/Artifact/Receipt machines | kernel owner | property tests for every transition |
| 4 | append-only transactional journal spike | evidence owner | partial-write/crash/replay tests |
| 5 | non-bypassable capability/executor gateway | security owner | direct-path bypass suite |
| 6 | reference workload across gizzi-code and Desktop | product/runtime owners | Gate B tests and shared artifact |
| 7 | signed package manifest and staged lifecycle | supply-chain owner | install/revoke/rollback malicious package |
| 8 | Hosted/Native conformance harness | quality owner | identical golden traces on host and QEMU |
| 9 | Native N0 signed image and no-model recovery | Native owner | blank-machine/failed-update/offline journeys |
| 10 | experience/model evolution lab | learning owner | consent, poison, regression, forgetting tests |

The program begins with items 1–5, not with a new desktop mockup, model choice,
or bare-metal kernel rewrite. Those choices become grounded once the authority,
state, evidence and recovery contracts exist.

For the 30-day Developer Preview, these items execute through the sourcing plan:
Omarchy is the product-level Native fork; Skill Recorder is a selective Teach
Mode fork; Linux/systemd/Hyprland/QEMU/Firecracker/llama.cpp/whisper.cpp are
upstream components behind Allternit contracts; AIOS, iii AgentOS and Fable OS
are qualified design donors rather than competing top-level kernels. The
responsibility-by-responsibility mapping and daily integration schedule live in
`ALLTERNIT_OS_UPSTREAM_FORK_AND_BORROW_REGISTER.md`.

## 16. Decision and change log

| Date | Change | Result |
|---|---|---|
| 2026-08-03 | Created canonical gap and traceability register | All 48 responsibilities now have requirement, Hosted/Native owner, code evidence, contract, authority, durable state, failure, recovery, evidence, conformance, disposition and maturity; added parity, journeys, state machines, threats, planes, model evolution, generated-system qualification, repository audit, failure-first tests and starting gates. |
| 2026-08-03 | Added upstream sourcing companion | Every responsibility now has a fork/adopt/adapter/borrow/reuse/build decision, upstream boundary and day-30 proof. |
