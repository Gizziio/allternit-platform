# AllternitOS Upstream Fork and Borrow Register

**Status:** Canonical sourcing and integration plan  
**Created:** August 3, 2026  
**Target:** AllternitOS Developer Preview in 30 calendar days  
**Companion:** `ALLTERNIT_OS_GAP_AND_TRACEABILITY_REGISTER.md`

## 1. Decision

AllternitOS will be assembled, not independently reinvented. Linux and mature
open-source projects supply established OS mechanisms. The existing Allternit
Platform supplies the agent runtime, programs, surfaces and differentiated
product capabilities. Allternit engineering supplies the constitutional glue:
one workload model, authority boundary, event history, package vocabulary and
coherent experience.

Only one project is designated as a broad product fork for the 30-day preview:
**Omarchy**. Other projects are adopted as upstream packages, used behind an
adapter, selectively vendored after review, or treated only as architectural
references. This prevents Allternit from becoming an unmaintainable fork-of-forks.

## 2. Integration action vocabulary

| Action | Meaning | Maintenance rule |
|---|---|---|
| Fork | Allternit maintains a branded derivative and upstream merge lane | keep upstream history; minimize divergence |
| Adopt | Install an unmodified distribution package/component | pin version; consume security updates |
| Adapter | Keep upstream replaceable behind an Allternit contract | never expose backend-specific semantics to workloads |
| Vendor | Carry a reviewed source/binary dependency | preserve license, notices, hashes and update provenance |
| Borrow | Reimplement a concept; copy no code | cite design influence and write Allternit-owned implementation |
| Reuse | Refactor existing Allternit code behind the OS contract | qualify code; remove duplicate authority |
| Build glue | New Allternit code connecting components | keep small, testable and contract-focused |
| Research only | Lab or benchmark; never production authority | isolated tree, no release dependency |

## 3. Approved source catalog

Licenses are an engineering inventory, not legal advice. Every pinned commit and
transitive dependency still requires an attribution and redistribution review.

| Source | Planned action | Supplies | License/status | 30-day boundary |
|---|---|---|---|---|
| Omarchy | Fork | Arch-based install, defaults, migrations, applications, Hyprland/Quickshell product composition | MIT | Allternit-native distribution base and branding |
| Arch Linux repositories | Adopt | kernel/userspace packages, pacman, hardware enablement | package-specific | upstream packages; do not fork the distribution archive |
| Linux kernel | Adopt | hardware kernel, VM, networking, filesystems, namespaces, cgroups | GPL-2.0-only | stock supported kernel; no Allternit kernel patch in preview |
| systemd | Adopt | init, services, journal, login, device and timer integration | LGPL-2.1-or-later and component-specific | system service supervision; Allternit daemon unit |
| Hyprland | Adopt + configure | Wayland compositor, workspaces, IPC and input | BSD-3-Clause | no compositor fork unless a blocker is proven |
| Quickshell/Omarchy shell | Fork configuration/shell layer | panels, launcher, menus, notifications and experience host | verify pinned component licenses | replace Omarchy identity and add Allternit projections |
| Btrfs + Snapper | Adopt | filesystem snapshots and recovery points | GPL-family | preview rollback substrate, not final atomic updater |
| Flatpak + Bubblewrap | Adopt/adapter | ordinary Linux apps and user-space sandbox/portals | license inventory required | application compatibility lane |
| QEMU/KVM | Adopt | bootable research image and conformance VM | GPL-2.0 and component-specific | canonical preview image and CI/manual conformance |
| Firecracker | Reuse existing adapter + adopt upstream VMM | microVM isolation | Apache-2.0 | Linux/KVM isolated workload tier |
| llama.cpp | Adapter/vendor binary | portable GGUF local inference | MIT | canonical embedded inference API |
| Ollama | Optional adapter | model download/serving and developer convenience | MIT | dev fallback; not canonical model package authority |
| whisper.cpp | Adapter/vendor binary | offline speech recognition | MIT | baseline offline STT |
| Piper or system TTS | Adapter | local speech synthesis | license/model review required | baseline TTS; full duplex deferred behind same contract |
| PipeWire/WirePlumber | Adopt | audio/video graph and device routing | MIT/LGPL mix | native media substrate |
| Microsoft Skill Recorder | Selective fork | capture UI, event recording and procedure construction | MIT; preserve notices/trademark separation | Allternit Teach Mode prototype |
| iii AgentOS | Borrow; selective adapter only after audit | narrow workers, functions, triggers, bus, retries and traces | Apache-2.0; pre-1.0 | design donor, not kernel replacement in month one |
| AIOS + Cerebrum | Borrow/benchmark | model/context/memory/tool managers, syscall metaphor, local/remote modes | license must be verified at pinned revisions | compare modules; do not wholesale merge in preview |
| Fable OS | Research/borrow only | generative drivers, compiler, kernel traces, persistent capabilities and self-repair | no explicit repository license found | copy no code; use isolated architectural benchmark |
| OSWorld | Benchmark concepts/data subject to license review | reproducible desktop task evaluation | research dataset/repo terms | task inspiration, not product runtime |
| Existing Allternit Platform | Reuse/refactor | agents, models, policy, receipts, workflows, artifacts, surfaces, device and browser systems | Allternit-owned plus existing dependencies | authoritative agentic layer |
| gizzi-code | Reuse/refactor | TUI, harness, goals/jobs, sessions, tools, skills, models and voice | Allternit-owned plus existing dependencies | primary admin/developer program |

## 4. Forty-eight-responsibility sourcing map

Every canonical responsibility has a source decision. “Glue” identifies the
Allternit-specific integration that still must be delivered; upstream code alone
does not prove the OS guarantee.

| ID | Responsibility | Primary upstream/foundation | Action | Allternit customization and authority | Day-30 proof |
|---|---|---|---|---|---|
| 01 | Constitution and ABI | Allternit benchmark; AIOS syscall and iii function concepts | Reuse + borrow + build | define Allternit protocol/versioning; no upstream owns system law | versioned preview protocol and compatibility header |
| 02 | Hardware/runtime inventory | Linux sysfs/udev, systemd, Omarchy hardware scripts; orchestrator discovery | Adopt + reuse | merge physical and agent-resource inventory into signed snapshots | hardware/model/tool inventory visible in system panel |
| 03 | Root of trust | Linux keyrings, host keystore, package signatures | Adopt + build | preview release key, package hashes and trusted-source manifest | reject tampered Allternit package/image |
| 04 | Secure/measured boot | Arch/Omarchy boot path; UEFI/Secure Boot concepts | Adopt + configure | signed preview image where practical; record boot/image versions | boot known image and detect changed system payload |
| 05 | Boot/early userspace | Omarchy + systemd | Fork + adopt | order Allternit journal/policy/daemon before agent programs | offline boot reaches functional shell and daemon |
| 06 | Hardware abstraction | Allternit computer-use/provider APIs; AIOS manager concepts | Reuse + borrow | one Model/Tool/Browser/Voice/Executor interface family | swap local/cloud model without workload rewrite |
| 07 | Kernel object model | Allternit goals/jobs/artifacts/receipts; Windows-handle and AIOS syscall concepts | Merge + borrow | canonical Workload, Step, Artifact, Lease, Receipt IDs/states | one object trace shown in TUI and Desktop |
| 08 | Interrupts/timers | Linux/systemd timers/signals; Allternit cancellation; voice barge-in | Adopt + reuse | privileged emergency stop and cancellation propagation | bounded stop across child work and voice |
| 09 | Scheduler | Allternit Rails/workflow/orchestrator; AIOS scheduler concepts | Merge + borrow | admission by model, executor, budget, risk and locality | route one job local/cloud and recover provider loss |
| 10 | Concurrency | Allternit DAG/orchestrator; iii worker/function concepts | Reuse + borrow | structured branches and parent cancellation | parallel research branches join and cancel correctly |
| 11 | Context/virtual memory | Allternit memory; AIOS Context Manager concepts | Reuse + borrow | context is cache; journal/artifacts remain truth | restart with reconstructed context and no state loss |
| 12 | Physical/model memory | Linux cgroups/pressure; executor resource manager; llama.cpp | Adopt + reuse + adapter | hardware tiers, model residency and degradation rules | memory pressure selects smaller model or pauses safely |
| 13 | Process/workload lifecycle | systemd transient units; Allternit jobs/goals/Cowork checkpoint | Adopt + merge | durable workload state machine above host processes | daemon crash resumes one reference workload |
| 14 | IPC/synchronization | Unix sockets/WebSocket; iii bus concepts; Allternit relay/events | Adopt + reuse | typed authenticated local protocol and event ordering | Desktop and TUI consume same ordered workload events |
| 15 | System-call boundary | Allternit policy/permissions; AIOS syscall metaphor | Adapt + borrow | capability gateway is the only consequential executor entrance | bypass test rejects direct unleased action |
| 16 | Device drivers | Linux drivers; Allternit browser/computer adapters; Fable concepts | Adopt + reuse + research | stable driver packages; generated candidates remain lab-only | browser and one desktop operation through same driver contract |
| 17 | Plug and Play | udev/systemd; MCP discovery; orchestrator runtime discovery | Adopt + reuse | attest/bind/quarantine tools, devices, MCP and model packs | hot add/remove model or MCP resource safely |
| 18 | I/O manager | Allternit executor/computer-use SDK; Firecracker API | Reuse + adapter | idempotency keys, timeout, cancel, typed result and receipt | reconcile a deliberately ambiguous tool completion |
| 19 | Filesystem/artifact VFS | Linux VFS/Btrfs; Allternit artifacts/connectors | Adopt + reuse | artifact namespace with hashes, versions and provenance | artifact survives surface and daemon restart |
| 20 | Storage/volumes | Btrfs/Snapper, LUKS; Allternit checkpoint/sync | Adopt + reuse | data classes, quotas and snapshot/export integration | encrypted install plus pre-change recovery point |
| 21 | Networking | Linux/nftables; Firecracker netpolicy/IPAM; Allternit relay | Adopt + reuse | identity/purpose-bound egress and offline queue | isolated browser allows approved host and denies another |
| 22 | Identity/sessions | systemd-logind/PAM; Allternit auth/pairing | Adopt + merge | unified person/device/agent/package principal IDs | login binds one user across Native and Hosted surface |
| 23 | Authorization monitor | Allternit Rails policy and acceptance tests | Reuse + harden | place policy outside model and complete all executor paths | policy outage fails closed; approval flow still inspectable |
| 24 | Capability handles | object-handle/lease concepts; Allternit approvals | Borrow + build | narrow expiring revocable lease with delegation ancestry | late approval and revoked lease cannot act |
| 25 | Isolation | Bubblewrap/Flatpak, containers, Firecracker, QEMU | Adopt + reuse + adapter | risk ladder and uniform mounts/network/receipt contract | risky browser/tool runs in disposable isolated environment |
| 26 | Crypto/secrets | kernel crypto, host keyrings, LUKS; Allternit vault | Adopt + adapt | opaque secret handles, redaction and rotation | model/tool uses credential without receiving/logging raw value |
| 27 | Accounting/quotas | cgroups/systemd accounting; Allternit executor/provider usage | Adopt + merge | tokens, money, CPU, RAM, storage and time ledger | budget exhaustion pauses workload with receipt |
| 28 | Service manager/init | systemd; iii worker supervision concepts | Adopt + borrow | Allternit service units, dependencies, health and backoff | daemon/model restart and crash-loop containment |
| 29 | Configuration database | Omarchy config/migrations; systemd; Allternit settings | Fork + merge | typed layered config with migration and provenance | system setting changes shell and daemon consistently |
| 30 | Runtime/compiler/linker | Linux toolchains, WASM runtime candidate; Fable concepts | Adopt + reuse + research | package loader and sandboxed generated-tool compiler lane | generate, build and run one bounded WASM tool |
| 31 | Package/application lifecycle | pacman/Omarchy, Flatpak; Allternit plugin/skill systems | Adopt + merge + build | Allternit resource manifest above OS packages; stage/revoke/rollback | install and revoke one signed skill/program package |
| 32 | Data model | Linux user dirs/portals; Allternit memory/artifact/purpose systems | Adopt + merge | explicit system/user/org/workload/cache/derived classes | export/delete reference workload data by class |
| 33 | Search/indexing | existing Allternit retrieval/memory; desktop index concepts | Reuse + adapt | permission-preserving artifact/memory/capability search | revoked artifact disappears from subsequent retrieval |
| 34 | GUI/session/window system | Hyprland + Quickshell/Omarchy; Allternit surfaces/A2UI | Adopt + fork + reuse | branded workload shell; windows are projections, not truth | launcher opens programs and shared workload projection |
| 35 | Input/accessibility/media | Wayland, PipeWire, accessibility trees; whisper.cpp | Adopt + adapter + reuse | Turn Manager normalizes text/voice/screen and interruptions | start by voice, interrupt, continue in TUI |
| 36 | Notifications/background | systemd timers, desktop notifications; Allternit jobs/approvals | Adopt + reuse | durable attention inbox with approval deadlines | pending approval survives logout/restart |
| 37 | Observability/evidence | system journal; Allternit Rails receipts/tests; Fable trace principle | Adopt + adapt + borrow | separate model prose from signed action evidence | complete request→policy→lease→action→receipt chain |
| 38 | Fault containment | systemd/cgroups, Firecracker jailer/seccomp; Allternit quarantine | Adopt + reuse | bounded retries, watchdogs, circuit breakers and quarantine | hung/lying tool is stopped without losing workload truth |
| 39 | Checkpoint/recovery | Btrfs/Snapper; Cowork checkpoints; recovery-agent patterns | Adopt + reuse | workload replay/compensation distinct from system snapshot | recover after crash between action and receipt |
| 40 | Updates/migration | Omarchy channels/migrations + Snapper | Fork + adapt | preview signed Allternit channel and pre-update snapshot; atomic A/B later | failed update returns to known-good preview state |
| 41 | Backup/restore/reset | Btrfs tools; Allternit sync/checkpoints | Adopt + build glue | portable workload/artifact export; exclude raw secrets/runtime cache | restore reference workload onto clean VM |
| 42 | Virtualization/containers | QEMU/KVM, Firecracker, Bubblewrap/Flatpak | Adopt + reuse | backend-neutral environment request and evidence | same tool task runs host sandbox and microVM lane |
| 43 | Distributed/fleet | Allternit pairing/relay/sync/runtime discovery; AIOS remote-mode concepts | Reuse + borrow | device enrollment, workload placement and remote stop | Desktop/iOS inspect one workload and revoke device |
| 44 | Power/thermal | Linux power profiles, systemd, Omarchy hardware tuning | Adopt + configure | checkpoint on sleep; lower model/concurrency on battery | suspend/resume workload on reference hardware/VM simulation |
| 45 | Admin/developer tools | gizzi-code; Omarchy CLI/menu; system diagnostics | Reuse + fork | gizzi-code becomes canonical OS console and menu backend | inspect objects, receipts, models, packages and recovery |
| 46 | Compatibility/conformance | existing acceptance/computer-use tests; QEMU; OSWorld concepts | Reuse + borrow | 48 test IDs, golden traces and 20 preview journeys | publish preview conformance report with failures visible |
| 47 | Privacy/deletion/tenancy | Linux accounts/encryption; Allternit purpose/memory policy | Adopt + build | deletion/derivation ledger and tenant keys; adapter deletion limited in preview | remove user/workload and prove indexed/artifact deletion |
| 48 | Localization/accessibility | Linux locale, Wayland/AT stack; Allternit semantic UI | Adopt + reuse | semantic projections, keyboard/voice/caption parity | keyboard-only and screen-reader smoke path including recovery |

## 5. Fork plans

### 5.1 Omarchy → AllternitOS Native

**Fork scope:** installer composition, packages, shell configuration, system menu,
themes, migrations, defaults, documentation and image identity.

**Keep upstream:** Arch repositories, Linux kernel, Hyprland, hardware packages,
security fixes and general-purpose applications.

**Replace/customize:** names, logos, boot visuals, wallpapers, default shortcuts,
launcher, program catalog, system menu, settings, first-run onboarding, default
browser profile, update channel metadata and support links.

**Add:** Allternit daemon system unit; gizzi-code; Desktop client; Workloads,
Models, Agents, Skills, Artifacts, Evidence, Approvals and Emergency Stop panels;
local model setup; isolated agent desktop; Allternit recovery entry.

**Merge discipline:** maintain an `upstream/omarchy` remote, a clean integration
branch and an Allternit patch series grouped by branding, packages, shell,
services and installer. Never edit third-party code merely to change a label when
configuration or packaging can do it.

### 5.2 Microsoft Skill Recorder → Allternit Teach Mode

**Fork scope:** recorder overlay, capture pipeline, event representation,
procedure builder and evaluation harness where portable.

**Replace:** Copilot-specific identity, commands, branding, output destinations
and provider assumptions.

**Integrate:** Allternit identity, capability leases, redaction, browser DOM and
accessibility capture, artifacts, Skills packages, replay sandbox, evidence and
promotion state machine.

**Preview boundary:** record one supported desktop/browser workflow, produce a
reviewable `SKILL.md` plus structured steps, replay it under approval and revoke
it. Automatic trust and adapter training are out of scope.

## 6. Borrow-only plans

| Source | Borrow | Explicitly do not inherit |
|---|---|---|
| AIOS | manager separation; agent syscalls; local/remote kernel modes; model/context scheduling | a second top-level kernel, Python-only authority or separate user/workload truth |
| iii AgentOS | narrow workers; function/trigger vocabulary; shared routing/retry/trace bus | wholesale replacement of mature Allternit packages or dependency on a pre-1.0 engine |
| Fable OS | generative driver/compiler lab; kernel-emitted evidence; persistent capabilities; fault-driven repair | ring-0 model networking, model-controlled trust, production self-patching or any unlicensed code |
| Omarchy | coherent defaults, warm shell, unified CLI/menu, migrations and practical hardware curation | unsandboxed extension authority, window-as-truth or permanently rolling mutable base |
| OSWorld | reproducible real-computer task fixtures and environment reset | benchmark score as proof of safety, recovery or long-horizon autonomy |
| mature OSs | handles, job groups, entitlements, reference monitor, per-app identity, verified updates | surface-specific APIs as the Allternit contract |

## 7. Build-versus-borrow ledger

The preview still requires small pieces that no upstream can own for Allternit:

| Allternit-owned glue | Why it cannot be outsourced | Preview scope |
|---|---|---|
| OS protocol and canonical object IDs | defines product identity and cross-surface compatibility | Workload, Step, Artifact, Lease, Receipt |
| capability gateway | upstream tools cannot decide Allternit purpose/authority | browser, shell and generated tool entrances |
| evidence correlator | must join policy, executor and artifact facts independently | one append-only reference-workload chain |
| surface projection protocol | prevents Desktop/iOS/TUI from forking state | status, approval, artifact and receipt projections |
| upstream adapter boundary | avoids coupling workloads to Omarchy/AIOS/iii/Ollama | Model, Tool, Browser, Executor and Voice adapters |
| Allternit package overlay | joins OS packages with agents/models/skills/UI resources | signed preview manifest and revocation |
| preview recovery coordinator | connects system snapshot and workload replay | known-good system + resumable reference workload |

## 8. Thirty-day integration plan

| Days | Track | Work | Exit evidence |
|---|---|---|---|
| 1–2 | Source freeze | pin commits/releases, verify licenses/notices, create upstream ledger and patch policy | approved bill of materials |
| 1–3 | Architecture | freeze five objects and Model/Tool/Browser/Executor/Voice adapters | protocol preview v0.1 |
| 2–6 | Native fork | fork Omarchy composition, rebrand installer/shell/defaults, add system units | branded bootable VM image |
| 3–8 | Runtime | launch existing Allternit daemon/gizzi-code/Desktop at boot/login | programs operate on Native image |
| 5–10 | Models/voice | llama.cpp adapter, model manifest/download, whisper.cpp and baseline TTS | offline typed and spoken turn |
| 7–14 | Kernel proof | capability gateway, receipt correlation, artifact commit and crash resume for browser workload | vertical trace and recovery test |
| 10–17 | Experience | Workload launcher, status, approvals, artifacts, evidence and emergency stop panels | coherent agentic shell demo |
| 13–20 | Surfaces | project same workload to TUI, Desktop, Web and iOS approval/status | cross-surface journey proof |
| 16–23 | Teach Mode | selective Skill Recorder fork, redaction, skill output, isolated replay and revoke | learned workflow demonstration |
| 18–25 | Isolation/apps | Firecracker path, Flatpak portal and ordinary Linux application lane | isolated agent and normal app proof |
| 22–28 | Recovery/update | snapshot, update migration, rollback, portable workload export/restore | failed-update and clean-VM restore |
| 26–30 | Qualification | run preview subsets of 48 tests and all 20 journeys; publish known gaps | signed Developer Preview image/report |

## 9. Definition of done for the Developer Preview

The month is successful only if an external user can:

1. download and boot/install an AllternitOS image;
2. reach an Allternit-branded native shell without assembling dependencies;
3. use gizzi-code and Desktop as programs over one running daemon;
4. run an offline open-weight model through an Allternit model contract;
5. start a durable research workload that uses an isolated browser;
6. approve an action and distinguish model prose from OS evidence;
7. receive a committed artifact and inspect its provenance;
8. crash/restart the daemon and resume the workload safely;
9. inspect or approve the same workload from another surface;
10. record, review, replay and revoke one learned skill;
11. launch an ordinary Linux application;
12. recover from a failed preview update or restore the workload in a clean VM.

Anything beyond these twelve proofs is secondary during the 30-day window.

## 10. Source-risk gates

- No source enters the image without pinned revision, license, copyright notice,
  source URL, update owner and vulnerability/removal path.
- No model ships until its weight license, redistribution, acceptable-use terms,
  prompt template and hardware envelope are recorded separately from runtime code.
- Projects without explicit licenses, including the currently observed Fable OS
  repository, are reference-only unless the owner grants written permission.
- Copyleft components remain separable and receive required source/notices;
  Allternit branding does not erase upstream attribution.
- An upstream daemon/framework may not become a second identity, workload,
  package, policy or evidence authority.
- Fork patches are minimized; adapters and configuration are preferred so
  security updates remain consumable.

## 11. Decisions still due within 48 hours of starting

1. Omarchy pinned release/commit and whether its current Quickshell layer or a
   thinner Allternit shell is the safest fork point.
2. The reference x86-64 hardware target in addition to QEMU.
3. llama.cpp directly versus Ollama as the preview default service.
4. The exact redistributed model and voice-model weights after license/hardware
   review.
5. Whether any iii AgentOS or AIOS code wins a module-level bake-off against
   existing Allternit code; default is no wholesale runtime replacement.
6. The five-person decision ownership: distribution, runtime/protocol,
   security/evidence, experience/surfaces and release/qualification.

## 12. Change log

| Date | Change |
|---|---|
| 2026-08-03 | Created the canonical upstream sourcing plan, mapped all 48 responsibilities, designated Omarchy and Skill Recorder fork scopes, constrained AIOS/iii/Fable to qualified borrow paths, and defined the 30-day integration schedule and preview acceptance contract. |
