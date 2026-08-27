# AllternitOS Native Distribution Blueprint

**Status:** Canonical design track  
**Owner:** Allternit  
**Created:** August 2, 2026  
**Target:** Bootable x86-64 and ARM64 operating system  
**Relationship:** Same Allternit kernel contracts as Hosted Distribution; different system substrate

## 1. Decision

AllternitOS is designed as a real bootable operating system, not only as a daemon
and application running inside somebody else's desktop. The hosted distribution
remains the fastest path to users and the migration bridge for existing Allternit
code. The native distribution is a first-class architecture and product track now.

```text
                    ONE ALLTERNIT OS CONTRACT
    workloads · capabilities · packages · artifacts · receipts · agents
                              │
                 ┌────────────┴────────────┐
                 │                         │
       Hosted Distribution       Native Distribution
       macOS/Windows/Linux        UEFI → Linux → Allternit shell
       app + daemon               owns session and experience
```

Both distributions run the same agent packages, workloads, policy, evidence,
memory, model manifests, and surface protocols. Native is not a separate product
fork. Hosted proves the kernel while Native owns the complete machine experience.

## 2. What “real OS” means here

Native AllternitOS must:

- boot directly on qualified hardware and in a VM;
- establish a verified chain of trust before agents or models run;
- own login, sessions, display composition, input, audio, networking, storage,
  power, updates, recovery, packages, applications, and administration;
- present an agent-native shell rather than opening a conventional desktop app;
- continue to run ordinary Linux applications in governed compatibility domains;
- operate offline with a bundled open-weight bootstrap model and local voice;
- isolate generated software and computer-use environments;
- update atomically and recover without relying on an active agent;
- expose a rescue path, console, accessibility, and human override outside the
  model-controlled experience.

Linux is the initial hardware kernel. That is still a real Allternit operating
system, just as Android, ChromeOS, SteamOS, and many appliances use Linux while
owning their system image, security model, lifecycle, shell, and application
environment. A from-scratch kernel would add enormous driver and compatibility
cost without improving the agentic constitution.

## 3. Native stack

```text
┌────────────────────────────────────────────────────────────────────┐
│ Human experience                                                   │
│ Allternit Shell · spaces · workload canvas · evidence · approvals  │
│ voice · notifications · settings · accessibility · recovery UI     │
├────────────────────────────────────────────────────────────────────┤
│ Programs and compatibility                                         │
│ Operator · Code · Cowork · Browser · Research · Documents · Design │
│ Linux apps · web apps · Android-app research lane · remote apps     │
├────────────────────────────────────────────────────────────────────┤
│ Agentic operating layer                                            │
│ workload kernel · scheduler · capability monitor · package manager │
│ artifact VFS · memory/context · models · voice · journal · receipts│
│ experience compiler · device/fleet · recovery controller           │
├────────────────────────────────────────────────────────────────────┤
│ System services                                                    │
│ identity · secrets · network · audio/video · input · discovery     │
│ power/thermal · update · backup · time · localization · telemetry  │
├────────────────────────────────────────────────────────────────────┤
│ Isolation and execution                                            │
│ WASM · namespaces/cgroups/seccomp/LSM · containers · KVM microVMs  │
│ dedicated agent desktops · GPU/NPU broker · remote executors        │
├────────────────────────────────────────────────────────────────────┤
│ Native platform                                                    │
│ Wayland compositor · systemd · D-Bus/Unix APIs · PipeWire · udev   │
│ NetworkManager/iwd · BlueZ · Mesa/Vulkan · Linux input/media stack  │
├────────────────────────────────────────────────────────────────────┤
│ Bootable system                                                    │
│ UEFI · Secure Boot · signed UKI · initramfs · immutable Linux image│
│ encrypted state · TPM-backed identity · A/B or OSTree deployments  │
├────────────────────────────────────────────────────────────────────┤
│ Hardware                                                           │
│ x86-64/ARM64 · CPU · GPU/NPU · RAM · NVMe · display · audio · I/O  │
└────────────────────────────────────────────────────────────────────┘
```

## 4. Boot and trust chain

1. UEFI firmware validates the Allternit boot authority through Secure Boot.
2. A signed Unified Kernel Image binds kernel, initramfs, command line, OS release
   metadata, and measurement policy into one verifiable artifact.
3. TPM measurements extend the boot state; disk unlock and device credentials may
   be released only for accepted measurements.
4. Early userspace mounts the immutable system deployment and encrypted state.
5. The external Recovery Controller validates the active deployment, journal, and
   required policy before starting the agentic kernel.
6. Core identity, policy, journal, capability, package, model, and session services
   start in a declared order with health gates.
7. The Allternit compositor and shell start before optional user agents.
8. Agents and models receive no ambient root privilege and do not own boot.

Boot modes:

- **Normal:** signed production system, standard policies.
- **Offline:** network disabled; local model, voice, tools, and cached artifacts.
- **Private:** ephemeral session with restricted persistence and egress.
- **Safe:** third-party packages and learned capabilities disabled.
- **Recovery:** separate minimal image for rollback, diagnostics, data export, and
  credential reset; it does not load the active model or agent packages.
- **Developer:** explicitly enrolled keys, visible watermark, expanded diagnostics,
  and no production attestation claim.

## 5. System image, state, and updates

The base OS is immutable and image-composed. `/usr` belongs to a signed deployment;
runtime mutation occurs only in explicitly writable state. A content-addressed
deployment system such as OSTree or an A/B image scheme provides atomic transitions:
power loss yields either the old deployment or the new one, never a half-updated OS.

Data classes:

| Class | Examples | Lifecycle |
|---|---|---|
| Immutable system | kernel, drivers, compositor, OS services, recovery tools | Signed build; atomic update/rollback |
| Machine identity | TPM keys, enrollment, hardware policy | Hardware-bound; recoverable by explicit ceremony |
| System state | service journal, package database, policies, health history | Transactional; versioned migrations |
| User vault | credentials, memories, personal configuration | Per-user encrypted; export/delete/restore |
| Workload state | events, checkpoints, approvals, receipts | Durable and replayable; retention by policy |
| Artifacts | documents, code, datasets, media | User-owned, versioned, portable, provenance-bearing |
| Models | weights, tokenizers, adapters, manifests | Verified packages; large-object storage and quota |
| Caches | indexes, embeddings, KV caches, thumbnails | Reconstructable; pressure-evictable |
| Ephemeral sandboxes | browser profiles, generated code, test fixtures | Snapshot, expire, destroy; no authority inheritance |

Update protocol:

- download signed metadata and content-addressed deltas;
- verify release, channel, device compatibility, revocation, and free space;
- stage a complete inactive deployment;
- run offline schema and package compatibility checks;
- reboot into a probationary slot;
- require system, compositor, kernel-service, model-bootstrap, network, storage,
  and policy health gates;
- bless the deployment only after healthy operation;
- automatically roll back after failed boot or critical health failure;
- retain recovery and at least one known-good deployment.

Agent packages update separately but cannot replace the trust root, updater,
capability monitor, compositor secure surfaces, or recovery controller.

## 6. The Allternit shell

The native shell must visibly behave like an operating system. It is not a
full-screen chat box and not a web desktop imitation.

### Persistent spatial model

- **Home:** current objectives, active workloads, scheduled automations, recent
  artifacts, device state, and system health.
- **Spaces:** durable activity contexts for work, life, organizations, or projects;
  each has identities, data mounts, policies, agents, and resource budgets.
- **Workload canvas:** live plans, branches, agents, evidence, approvals, artifacts,
  exceptions, resource use, checkpoints, and outcomes.
- **Programs:** independently launchable Code, Cowork, Browser, Research, Documents,
  Design, Workflow, Skill Studio, Model Lab, Runtime/Fleet, and Settings.
- **Artifact shelf:** user-owned outputs remain accessible independently of the
  agent or workload that created them.
- **System layer:** quick settings, connectivity, privacy state, recording state,
  model activity, compute/energy use, notifications, and emergency stop.

### Agent-native interaction

- Natural language, voice, touch, keyboard, pointer, and accessibility are peers.
- The shell can compose temporary task surfaces from declarative UI packages.
- Every generated surface is visibly identified and privilege-separated from
  secure system surfaces such as login, secrets, approvals, and recovery.
- Voice is full duplex, interruptible, captioned, and bound to the same workload.
- Search spans programs, artifacts, prior workloads, skills, settings, and devices
  while preserving permissions.
- Notifications carry a reason, requesting principal, deadline, consequence, and
  resumable action—not just agent prose.
- The emergency-stop gesture and secure attention sequence are processed beneath
  the shell and cannot be intercepted by applications or agents.

### Windowing

Allternit uses a Wayland compositor it controls. Ordinary resizable application
windows remain available, but the primary unit is the workload projection:

- a workload can appear as canvas, compact status tile, voice session, document,
  terminal, browser, or mobile continuation;
- closing a projection never implicitly kills durable work;
- focus and notification policy are workload-aware;
- secure surfaces are compositor-owned;
- applications receive only mediated input, clipboard, capture, file, and screen
  access according to capabilities;
- isolated agent desktops can be nested, streamed, snapshotted, and discarded.

## 7. Application and package model

Native AllternitOS supports three software classes:

1. **Allternit programs:** packages built around OS objects and workload contracts.
2. **Generated capabilities:** WASM tools, workflows, skills, harnesses, adapters,
   and declarative surfaces that pass qualification and staged promotion.
3. **Compatibility applications:** Linux desktop/CLI applications running inside
   constrained application domains with portals for files, clipboard, camera,
   microphone, notifications, secrets, and screen access.

One package transaction may contain multiple typed resources:

```text
identity + signature + compatibility + agent + model requirements + tools
+ workflows + skills + UI projections + policies + migrations + tests
+ declared capabilities + resource budgets + uninstall/recovery behavior
```

System packages and user programs are separate trust classes. Generated packages
cannot claim system class. Install, update, activation, rollback, revocation, and
removal are transactional and leave receipts.

## 8. Hardware and driver strategy

### Initial reference hardware

Constrain v1 Native support to configurations that can be qualified deeply:

- UEFI Secure Boot and TPM 2.0;
- x86-64 first, ARM64 reference board second;
- 16 GB RAM minimum, 32 GB recommended;
- NVMe storage with hardware health reporting;
- integrated AMD or Intel graphics first; one selected discrete-GPU lane;
- standard USB, Bluetooth, Wi-Fi, Ethernet, audio, camera, and display paths;
- recovery boot from internal partition and signed external media.

### Driver policy

- Reuse upstream Linux drivers and firmware packages wherever possible.
- Ship only qualified hardware IDs in production images.
- Run proprietary drivers in the narrowest practical trust boundary.
- Treat userspace app/API/device integrations as Allternit Driver packages.
- Permit agents to generate driver candidates only in QEMU or dedicated disposable
  hardware labs with fuzzing, replay, crash, suspend/resume, hotplug, and malicious
  input suites.
- Kernel driver promotion requires human review, signing, device-specific testing,
  rollback proof, and a non-agent recovery path.

## 9. Models and voice as system services

The Native image includes a redistributable bootstrap intelligence pack:

- small open-weight language/tool model for offline setup, settings, recovery
  explanation, basic planning, and hardware discovery;
- local speech recognition and speech synthesis;
- embedding/retrieval model;
- optional vision and full-duplex packs selected after hardware qualification.

Model weights are packages, not baked invisibly into the kernel. The Model Manager
owns verification, licensing metadata, residency, accelerator allocation, thermal
policy, fallback, updates, quotas, and unloading. The bootstrap model cannot
override system policy. Recovery does not require an LLM.

## 10. Isolation topology

| Work | Default boundary |
|---|---|
| Declarative system UI | Validated schema in compositor-owned renderer |
| Trusted deterministic extension | WASM component with capability imports |
| Ordinary Linux application | Per-app identity, namespace/cgroup, seccomp, LSM and portals |
| Browser agent | Dedicated encrypted profile in container or microVM |
| Generated native code | Disposable microVM; no host secrets or ambient network |
| Cross-application computer use | Dedicated nested agent desktop by default |
| Kernel/driver candidate | QEMU lab or sacrificial qualified device only |
| Third-party remote agent | Protocol proxy with attenuated capabilities and data filters |

GPU and NPU access require a broker so workloads cannot silently monopolize
accelerators or bypass data boundaries. Network egress, screen capture, input
injection, microphone, camera, clipboard, secrets, and host filesystem access are
explicit capabilities with visible indicators where appropriate.

## 11. Installer, onboarding, and recovery

Installer responsibilities:

- hardware qualification and firmware warning report;
- live-session accessibility before installation;
- whole-disk or explicit dual-boot layouts;
- encrypted state, recovery key, TPM enrollment, and verified recovery media;
- signed image installation and first-boot validation;
- offline account option; optional Allternit account and device pairing;
- model-pack selection based on RAM, storage, accelerator, energy, and license;
- import from Hosted Allternit without copying unapproved secrets or stale caches.

Recovery responsibilities:

- boot known-good or prior deployment;
- disable third-party packages, learned skills, models, and user autostart;
- verify filesystems, system images, package database, and event journal;
- export user artifacts and receipts without starting the normal agent runtime;
- rotate/recover credentials through explicit owner authorization;
- factory reset system separately from user vault where possible;
- produce a redacted diagnostic bundle.

## 12. Administration and development

Native provides two operator levels:

- **Settings:** ordinary human-readable control for accounts, privacy, models,
  devices, packages, updates, storage, accessibility, automations, and recovery.
- **System Console:** gizzi-code-based shell and diagnostics for services, journal,
  capabilities, packages, workloads, executors, performance, and policy simulation.

Developer mode is opt-in and visibly degrades production attestation. Development
uses a reproducible SDK image, VM reference target, package signing identities,
protocol simulators, capability-policy tests, accessibility tests, and conformance
suites. The host source tree is never required on an end-user machine.

## 13. Build and distribution recommendation

Do not immediately build an independent Linux distribution toolchain from nothing.
Evaluate two implementation lanes behind the same image contract:

| Lane | Best use | Recommendation |
|---|---|---|
| Fedora Atomic/rpm-ostree or bootc-derived | Fast workstation prototype, broad hardware, transactional base | Preferred prototype lane |
| Yocto/OpenEmbedded | Controlled appliance, selected hardware, deeply reproducible image | Preferred appliance/embedded lane |

The image contract must remain portable: signed boot artifact, immutable system,
encrypted state, transactional deployment, declarative services, Wayland shell,
KVM isolation, package protocol, recovery, and conformance. The underlying build
system is replaceable; user and package semantics are not.

## 14. Native milestones

### N0 - VM reference image

- Boot signed development image in QEMU/KVM.
- Start compositor, shell, identity, policy, journal, package, model, and workload
  services without a host desktop.
- Run bootstrap model offline.
- Demonstrate emergency stop and recovery image.

### N1 - First reference workstation

- Install on one published hardware bill of materials.
- Graphics, audio, networking, Bluetooth, suspend/resume, camera, and power pass.
- Encrypted storage, TPM identity, secure boot, and rollback pass.
- Hosted and Native resume the same portable workload.

### N2 - Application environment

- First-party Allternit programs are system-native projections.
- Governed Linux apps use portals and per-app identity.
- Browser and generated code run in isolated environments.
- Package install/update/remove/rollback and permissions UI pass.

### N3 - Agent-native daily system

- Full-duplex voice, workload canvas, search, notifications, accessibility,
  multi-user sessions, backup/restore, and energy-aware model routing pass.
- Seven-day daily-driver test with restart, sleep, offline, disk pressure, provider
  outage, bad package, failed update, and recovery scenarios.

### N4 - Developer preview

- Reproducible public image build and signed update channel.
- Installer, recovery media, hardware compatibility list, SDK, and conformance kit.
- Security review, threat model, vulnerability process, and rollback service.

### N5 - Appliance and OEM

- ARM64/reference edge hardware.
- Fleet enrollment, remote attestation, staged updates, policy, and remote recovery.
- OEM driver/update agreements and long-term support channel.

## 15. Acceptance gates

Native is not ready because it boots. It is ready when:

- the system is usable without launching a conventional desktop application;
- login, secure attention, approvals, emergency stop, and recovery are not
  model-controlled;
- all 48 canonical OS responsibilities have named Native owners and tests;
- power loss during update or package activation preserves a bootable system;
- one failed agent/model/package cannot take down the session or corrupt truth;
- ordinary applications and agent-generated software have separate identities and
  mediated access;
- the bundled offline model and voice path work on minimum hardware;
- suspend/resume, display hotplug, audio, network transitions, low storage, thermal
  pressure, accessibility, backup, restore, and rollback pass qualification;
- the same workload can move between Native, Hosted, Web, iOS, and gizzi-code
  without changing its identity or evidence history;
- a user can diagnose, export data, and restore the machine with all models disabled.

## 16. Primary implementation references

- [Yocto Project documentation](https://docs.yoctoproject.org/)
- [OSTree overview](https://ostreedev.github.io/ostree/introduction/) and
  [atomic upgrades](https://ostreedev.github.io/ostree/atomic-upgrades/)
- [systemd Unified Kernel Images](https://systemd.io/UNIFIED_KERNEL_IMAGE/)
- [Wayland architecture](https://wayland.freedesktop.org/index.html) and
  [system/session compositors](https://wayland.freedesktop.org/docs/book/Compositors.html)
- [Linux kernel documentation](https://docs.kernel.org/)

## Change log

- **2026-08-02:** Promoted Native AllternitOS from research-only language to a
  first-class bootable OS design track. Defined the dual-distribution contract,
  native stack, boot/trust, system image, shell, packages, hardware, models,
  isolation, installer/recovery, build lanes, milestones, and acceptance gates.
