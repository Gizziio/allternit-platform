# Agentic Operating Systems: Convergence and Allternit Direction

**Status:** Architecture research locked for AllternitOS v2  
**Date:** August 1, 2026  
**Companion:** `docs/Future_Blueprints/BLUEPRINT-ALLTERNIT_AGENTIC_OS_V2.md`

## Executive conclusion

Allternit should ship first as a native application plus an always-on agentic OS
daemon running above macOS, Linux, and Windows. It should use the host for trusted
UI and model acceleration while running agent-authored or untrusted work in a
tiered isolation fabric: declarative runtime, WASM, restricted process/container,
and hardware-backed VM.

It should not begin as a bare-metal operating system. Bare metal is a valuable
long-term research and appliance target, but it would discard mature host drivers,
accessibility APIs, application ecosystems, security updates, model accelerators,
and distribution channels before the agentic kernel itself is proven.

The product should feel like an app at installation and an operating system in
behavior:

- one installer;
- one local daemon;
- one model manager;
- first-party agents and skills available immediately;
- durable work that continues after windows close;
- the same workloads visible from desktop, web, iOS, and gizzi-code;
- generated skills, tools, drivers, and harnesses promoted through evidence;
- explicit capability, approval, receipt, and rollback boundaries.

## 1. What the field is converging on

Projects use “agentic OS” for several different things. They fall into five
families.

### 1.1 Agent resource kernels

AIOS separates an AIOS kernel from an agent SDK. Its kernel manages LLM access,
scheduling, context, memory, storage, tools, and access control. It supports local
and remote kernels, terminal and web interfaces, multiple agent frameworks, local
models, and optional GUI virtual environments for computer-use agents.

**Lesson for Allternit:** kernel/SDK separation and resource scheduling are now
table stakes. Allternit should differentiate through capability enforcement,
installable packages, generated systems, cross-surface durability, and recovery.

Primary sources:

- https://github.com/agiresearch/AIOS
- https://arxiv.org/abs/2403.16971

### 1.2 Agent frameworks marketed as operating systems

ElizaOS and similar systems combine an agent loop, plugins, memory, providers,
connectors, CLI, and web UI. Their strength is ecosystem reach and fast agent
development. Their “OS” is usually an application runtime, not a non-bypassable
authority layer.

**Lesson for Allternit:** plugins and connectors create adoption, but an SDK plus
dashboard is not sufficient. Kernel objects and enforcement must remain below
plugins and surfaces.

Primary source:

- https://github.com/elizaos/eliza

### 1.3 Local agent desktops

Open Interpreter, Open Cowork, Skales, OpenLoaf, AGNT, and adjacent projects are
converging on one-click desktop installation, local-first state, multiple model
providers, terminal/code execution, browser or desktop automation, skills, and
sandboxing.

**Lesson for Allternit:** the expected entry experience is a normal native app,
not an ISO image or developer stack. Installation friction will erase the value of
the deeper architecture if the first useful task takes hours to configure.

Primary sources:

- https://github.com/openinterpreter/open-interpreter
- https://www.openinterpreter.com/docs/desktop
- https://github.com/OpenCoworkAI/open-cowork
- https://github.com/agnt-gg/agnt

### 1.4 Self-extending agent runtimes

Fable OS is the clearest systems experiment: a bare-metal x86_64 kernel controlled
through natural language, with model-accessible syscalls, a bounded driver VM, an
on-machine C compiler, model-authored applications, persistent capabilities,
scheduling, and self-repair. Hermes makes a more immediately product-relevant
move: it treats skills as procedural memory and lets agents create, update, and
load skills after discovering useful workflows.

**Lesson for Allternit:** the key frontier is a generative systems layer that can
turn experience into persistent capabilities. The generated result must still pass
through packaging, isolation, evaluation, approval, and rollback.

Primary sources:

- https://github.com/robiot/fable-os
- https://github.com/robiot/fable-os/blob/main/README.os.md
- https://github.com/NousResearch/hermes-agent
- https://hermes-agent.nousresearch.com/docs/user-guide/features/skills

### 1.5 Bare-metal research systems

Fable OS proves that direct model-to-kernel interaction, runtime driver synthesis,
and runtime compilation are technically interesting. It also documents the cost:
no privilege separation, userspace, memory protection, or IOMMU containment in its
current experiment, plus executable kernel memory and a model-controlled compiler.

**Lesson for Allternit:** bare metal is not inherently “more agentic.” It merely
moves responsibility for every driver, security boundary, filesystem guarantee,
network stack, and recovery path into Allternit. That is a poor first commercial
trade unless the product is a controlled appliance.

## 2. The actual industry convergence

Across the projects and papers reviewed, the repeated architectural elements are:

1. A long-lived runtime separated from UI clients.
2. Agents treated as schedulable actors rather than chat personas.
3. A shared model service with local and remote backends.
4. Tool, plugin, or skill registries.
5. Durable memory and resumable state.
6. Natural language as a primary interface, not the only interface.
7. Browser and desktop action through specialized environments.
8. Background triggers and schedules.
9. Local-first or self-hostable deployment.
10. Web and terminal administration surfaces.
11. Increasing use of reusable experience or agent-created skills.
12. Isolation moving from ordinary containers toward VMs for hostile workloads.

What remains weak across most systems:

- non-bypassable capability enforcement;
- safe generated-code promotion;
- transactional package updates;
- deterministic receipts and replay;
- cross-device workload identity;
- revocable delegation;
- independent evaluation of self-authored skills;
- model and prompt provenance;
- recovery when the active agent runtime damages itself;
- honest separation between model claims and system evidence.

This weak area is where Allternit can lead.

## 3. Recommended product shape

### 3.1 What users install

The initial product is a signed native application containing:

- Allternit Desktop shell
- Allternit OS daemon/service
- Model manager
- Local protocol endpoint
- Package manager
- First-party agent distribution
- Small bootstrap model or guided model download
- Voice service
- Sandboxed execution manager
- Recovery helper installed outside the mutable agent runtime

The application window may close while the daemon continues approved work. A
menu-bar or system-tray item exposes runtime health, active workloads, microphone
state, autonomy state, resource use, and emergency stop.

The web app, iOS app, and gizzi-code attach to the same runtime locally or through
the paired encrypted relay. They are not separate agent brains.

### 3.2 What “OS” means here

Allternit virtualizes agentic resources rather than physical hardware:

| Traditional OS | AllternitOS |
|---|---|
| Process | Workload / agent run |
| Thread | Step / concurrent branch |
| Executable | Signed package resource |
| System call | Capability-gated tool invocation |
| User/group | Principal / organization / agent identity |
| Permission | Capability grant and lease |
| Scheduler | Workload, model, executor, and budget scheduler |
| Filesystem | Artifact, memory, package, and workspace state |
| Device driver | Tool/driver adapter under an isolation contract |
| Package manager | Agent/model/tool/workflow package manager |
| System log | Authenticated event journal and receipts |
| Crash recovery | Checkpoint, replay, retry, and rollback |
| Desktop shell | Desktop/web/iOS/TUI projections of OS state |

## 4. Shipping an open-weight model

### 4.1 Do not hard-code one permanent model

Model progress, licenses, hardware support, and user needs change too quickly.
Allternit should ship a model manifest and selection policy, not couple the OS ABI
to a single model family.

Each model package declares:

- model and tokenizer digests;
- source and license;
- parameter count and quantization;
- architecture and runtime compatibility;
- memory and storage requirements;
- context limit;
- modalities;
- structured output and tool-call support;
- measured performance on Allternit conformance tasks;
- privacy and network policy;
- compatible speculative/draft models;
- known safety and reliability limits.

### 4.2 Recommended inference runtimes

Use two initial runtime lanes:

1. **GGUF through llama.cpp** as the portable baseline across CPU, Metal, CUDA,
   HIP, Vulkan, and other supported backends.
2. **MLX on Apple silicon** as an optimized macOS lane when it materially improves
   speed, memory use, or supported modalities.

The OS-facing API remains stable while runtime adapters change. llama.cpp already
supports direct compatible-model download and a local server, making it a useful
bootstrap rather than an architecture to expose throughout the codebase.

Primary sources:

- https://github.com/ggml-org/llama.cpp
- https://github.com/ml-explore/mlx-examples/tree/main/llms

### 4.3 Distribution tiers

**Installer image:** runtime plus a very small bootstrap or routing model where
redistribution terms permit it. Keep the installer reasonable.

**First-run recommended pack:** a hardware-selected general/tool-use model,
embedding model, and optional vision model.

**Voice pack:** speech codec/model, VAD, echo cancellation configuration, and
fallback STT/TTS components.

**Capability packs:** coding, computer use, research, robotics, or organization-
managed model sets.

Large weights should normally use verified download-on-demand, resumable chunks,
content-addressed storage, deduplication, and explicit disk estimates. “Shipped
with Allternit” can mean installed and managed by Allternit during onboarding; it
does not require every DMG or installer to contain tens of gigabytes.

### 4.4 Hardware-aware selection

At setup, probe:

- architecture and OS;
- RAM or unified memory;
- GPU/NPU backend and usable memory;
- free storage;
- thermal/power class;
- desired offline/privacy level;
- latency target and modalities.

The manager offers an explainable recommendation and a safe fallback. It must be
possible to run a small local model for routing, privacy classification, command
interpretation, and emergency/offline operation while delegating difficult work
to a larger local or remote model.

### 4.5 Candidate policy, not a frozen model choice

Current candidates should be evaluated from families such as Gemma, Mistral,
Qwen, and other appropriately licensed open-weight releases. Small VLMs such as
SmolVLM2 demonstrate that local visual understanding can run at sub-3B and even
sub-1B scales. Model selection must follow measured Allternit workloads and a
license review rather than popularity.

Primary sources:

- https://deepmind.google/models/gemma
- https://docs.mistral.ai/models/
- https://huggingface.co/blog/smolvlm2

## 5. Full-duplex voice as an OS service

Voice cannot be implemented as “record, transcribe, wait, synthesize.” Full-duplex
interaction requires simultaneous listening and speaking, low-latency turn state,
barge-in, echo cancellation, partial commitment, and a record of what audio the
user actually heard.

### 5.1 Voice plane

```text
Microphone
   ↓
AEC / noise suppression / VAD
   ↓
Streaming speech model or STT
   ↓
Turn manager ↔ agent workload ↔ tool events
   ↓
Streaming speech model or TTS
   ↓
Speaker
```

The Turn Manager is an OS object responsible for:

- interruption and barge-in;
- overlapping user and agent speech;
- partial transcript stability;
- canceling unheard output;
- recording exactly what was spoken;
- separating conversational acknowledgement from action authorization;
- microphone and speaker capability leases;
- visible privacy state;
- local wake word and emergency stop where enabled.

Moshi is the strongest open reference for native full-duplex spoken dialogue and
reports approximately 200 ms practical latency. Pipecat is a strong transport and
pipeline reference supporting WebRTC, WebSockets, speech-to-speech backends, and
multi-agent voice pipelines.

Primary sources:

- https://github.com/kyutai-labs/moshi
- https://arxiv.org/abs/2410.00037
- https://github.com/pipecat-ai/pipecat

### 5.2 Recommended implementation sequence

1. Ship a reliable local cascade: VAD + streaming STT + text agent + streaming
   TTS, with barge-in and correct partial-output accounting.
2. Add Moshi or another full-duplex model as an optional hardware-qualified pack.
3. Preserve a common Turn Manager API so native speech-to-speech and cascaded
   pipelines share permissions, receipts, and interruption semantics.
4. Add remote full-duplex backends only as provider adapters.

Do not make voice the authority path. “Yes,” “send it,” and ambient speech are
not sufficient authorization for protected actions without explicit turn and
approval rules.

## 6. Computer, desktop, and browser use

Computer use is not one tool. It is a resolution ladder:

1. Native API or connector
2. Structured application protocol
3. Browser DOM/CDP/accessibility tree
4. Host accessibility APIs
5. Vision-grounded screen interaction
6. Raw pointer/keyboard automation

Agents should select the highest structured level available. Pixel interaction is
a fallback because it is slower, harder to verify, and more vulnerable to visual
changes and deceptive UI.

### 6.1 Browser use

Provide isolated persistent and ephemeral browser profiles. The browser executor
exposes semantic observations, screenshots, downloads, console/network events,
and a trace. Risky actions—authentication changes, purchases, messages, uploads,
deletions, publication—pass through explicit policy and approval.

Browser Use and Playwright are useful implementation references; Allternit should
wrap them behind its capability and receipt contracts rather than expose a library
as the kernel API.

Primary sources:

- https://github.com/browser-use/browser-use
- https://github.com/microsoft/playwright

### 6.2 Desktop use

Use host accessibility frameworks first:

- macOS Accessibility API
- Windows UI Automation
- Linux AT-SPI

Add screenshot/VLM grounding for elements absent from accessibility trees. The
executor records the observation used for each decision and verifies post-action
state. OSWorld’s real-application benchmark demonstrates why long-horizon,
cross-application tasks need recoverable state and evaluation rather than a
sequence of unverified clicks.

Primary source:

- https://arxiv.org/abs/2404.07972

### 6.3 Host session versus agent desktop

Offer two explicit modes:

- **Assistive host mode:** the user watches the agent operate existing apps. This
  requires narrow permissions and frequent approvals because personal data and
  authenticated sessions are present.
- **Isolated agent desktop:** a VM or separate OS session with controlled files,
  credentials, network, and snapshots. This is the default for unattended and
  higher-risk computer use.

The isolated desktop can be streamed into Allternit’s UI and still feel like a
native app. Users should not need to interact with QEMU controls or manage images.

## 7. Meta-skills and learning from successful work

The user’s desired loop—learn after successful turns and become faster—should be
a first-class OS subsystem called the **Experience Compiler**.

### 7.1 Never equate completion with learning evidence

A model saying “done” is not success. A skill candidate may be distilled only
from verified evidence such as:

- tests passed;
- artifact accepted;
- postcondition observed;
- user explicitly confirmed the result;
- external system returned a durable success identifier;
- repeated replay produced the same result.

### 7.2 Experience pipeline

```text
Trace + receipts + outcome
          ↓
Outcome verifier
          ↓
Episode summarizer
          ↓
Pattern matcher across similar episodes
          ↓
Skill/workflow/harness candidate
          ↓
Sanitize secrets and incidental state
          ↓
Replay in sandbox against fixtures
          ↓
Shadow use on future tasks
          ↓
Promotion, revision, merge, or retirement
```

### 7.3 Learning artifacts

The compiler can produce different artifacts:

- a short memory fact;
- a procedural SKILL.md;
- a parameterized deterministic workflow;
- a reusable tool or generated program;
- a test harness;
- a routing rule;
- a failure avoidance rule;
- an agent-team template;
- a proposed policy change requiring administrator approval.

Do not turn every success into prose. If a successful path is deterministic, the
system should compile it into a workflow or program and use the model only at the
ambiguous steps. That is how it becomes faster, cheaper, and more reliable.

### 7.4 Promotion policy

- First verified success: create an episodic record.
- Repeated or high-value pattern: stage a skill candidate.
- Fixture replay passes: mark qualified for shadow use.
- Shadow results beat baseline without new risk: propose activation.
- Active skill drifts or fails: fall back and reopen learning.

Hermes demonstrates agent-managed procedural skills, while Reflexion and Voyager
show research patterns for verbal feedback and persistent skill libraries. The
Allternit distinction is evidence-gated compilation and lifecycle management.

Primary sources:

- https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- https://arxiv.org/abs/2303.11366
- https://arxiv.org/abs/2305.16291

### 7.5 Preventing skill rot and poisoning

Every learned skill includes:

- origin episodes and receipts;
- applicable environment fingerprint;
- dependencies and capability requirements;
- secrets-redaction report;
- verification method;
- confidence and sample count;
- last successful use;
- failure and drift statistics;
- owner and promotion authority;
- expiry/revalidation triggers;
- prior versions and rollback.

Retrieved web content, tool output, and application UI are untrusted inputs. They
cannot write active skills, policies, or packages without the Experience Compiler
and promotion gates.

### 7.6 Demonstration learning and Microsoft Skill Recorder

Microsoft Skill Recorder is a concrete product reference for teaching workflows
by demonstration. It records application/window changes, browser URLs, screen
changes, short clipboard previews, and optional spoken narration. Analysis turns
the recording into an overall intent and ordered steps, then generates a SKILL.md
or scheduled automation. Importantly, it prefers native agent tools such as a CLI
or fetch operation over blindly replaying clicks.

Primary source:

- https://github.com/microsoft/skill-recorder

Allternit should make this a native **Teach Mode** of the Experience Compiler:

```text
User starts Teach Mode
        ↓
Local consent and capture boundary appears
        ↓
Screen + app/window + accessibility + browser + clipboard + narration events
        ↓
Local redaction and secret-risk scan
        ↓
Intent and semantic step reconstruction
        ↓
User edits and approves the reconstructed procedure
        ↓
Tool substitution and parameter extraction
        ↓
Generated skill + workflow + harness candidate
        ↓
Sandbox replay, verification, and staged promotion
```

Allternit should extend the reference pattern in six ways:

1. Capture accessibility and DOM/CDP events where possible, not only pixels,
   titles, and URLs.
2. Perform secret detection and redaction before any optional remote analysis.
3. Store capture data as an encrypted, short-retention evidence package.
4. Generate a verification harness and postconditions with the skill.
5. Bind generated actions to explicit capabilities and approval policy.
6. Replay the candidate in an isolated environment before allowing automation.

The capture UI must continuously display screen, microphone, clipboard, browser,
and accessibility capture state. Pausing one channel must take effect immediately.
Discard must be verifiable. The user chooses whether analysis is entirely local or
uses a remote model after reviewing a disclosure of exactly what will leave the
device.

Skill Recorder’s own warning is important: its analysis can send event timelines,
window/document titles, URLs, clipboard previews, extracted screen images, and
narration text to GitHub’s cloud. Allternit’s model router must treat captured work
as highly sensitive and default to local analysis when a qualified local model is
available.

The generated artifact is never promoted based only on one demonstration. One
recording supplies intent and a candidate path; fixtures, parameter variation,
postconditions, replay, and user review determine whether it generalizes.

## 8. Execution and isolation architecture

No single sandbox fits every workload. Use a risk-tiered fabric.

| Tier | Runtime | Intended work |
|---|---|---|
| 0 | Declarative interpreter | UI descriptions, plans, pure workflow graphs |
| 1 | WASM component | Portable tools, transforms, generated capabilities |
| 2 | Restricted host process | Trusted signed helpers needing host acceleration |
| 3 | Container / gVisor | General Linux tools with moderate isolation |
| 4 | MicroVM / VM | Untrusted code, GUI automation, package qualification |
| 5 | Dedicated device/runtime | Robotics, sensitive enterprise, physical systems |

### 8.1 WASM first

WASM should be the first generated-code target because it offers portable modules,
explicit imports, memory isolation, fuel/time limits, and a component interface.
It does not solve every side channel or host-call error; capabilities still gate
all imports.

### 8.2 macOS

Use the native app and daemon on the host so Allternit can access Metal/MLX,
microphone, accessibility, secure storage, and polished UI. Use Apple’s
Virtualization framework for isolated Linux or macOS environments. A guest agent
communicates through a narrow authenticated channel.

Primary source:

- https://developer.apple.com/documentation/virtualization

### 8.3 Linux and cloud

Use Firecracker for small, untrusted, headless workloads on KVM-capable Linux.
Use Kata when OCI/Kubernetes compatibility and hardware-backed per-pod isolation
are important. Use gVisor where syscall interception and container ergonomics fit
the risk model, recognizing it is a different boundary from a separate guest
kernel.

Primary sources:

- https://github.com/firecracker-microvm/firecracker
- https://github.com/kata-containers/kata-containers
- https://github.com/google/gvisor

### 8.4 Windows

Use a signed native shell and service. Prefer Hyper-V/WSL-backed isolated Linux
workloads and Windows Sandbox/VM patterns for GUI workloads, subject to edition
and deployment constraints. Use native UI Automation for assistive host mode.

### 8.5 QEMU’s role

QEMU is valuable for:

- cross-architecture development;
- complete virtual hardware labs;
- generated driver research;
- reproducible OS images;
- conformance and fault-injection testing;
- Fable-like bare-metal experiments.

It should not be the default consumer runtime when native virtualization offers a
smaller, better-integrated path. Hide it behind the executor contract.

### 8.6 Snapshot pools

Maintain signed golden environment images and warm snapshot pools for common
workloads. A workload gets a copy-on-write disk, scoped secrets, network policy,
and an expiry. Successful durable artifacts are exported through a controlled
channel; the environment itself is disposable unless explicitly retained.

## 9. App, appliance, distribution, or bare metal?

### 9.1 Phase-one answer: native app plus daemon

This maximizes adoption and lets Allternit use the host’s drivers and model
accelerators. It is the correct Personal and Pro product.

### 9.2 Server answer: headless runtime image

Ship a signed Linux service/container and optional appliance image. Enterprise and
cloud users operate it on bare-metal Linux or virtual machines, while Allternit
creates nested workload isolation only where supported.

### 9.3 Appliance answer: controlled Allternit Runtime OS

Later, create an immutable Linux appliance distribution for dedicated workstations,
edge boxes, robots, or managed enterprise runtimes. It boots into the Allternit
daemon, uses A/B system updates, measured boot, disk encryption, and a recovery
partition. This is “Allternit as the machine” without writing a general-purpose
kernel from scratch.

### 9.4 Bare-metal answer: research track only

A from-scratch Allternit kernel becomes rational only if one of these is true:

- a dedicated hardware product requires a smaller trusted computing base;
- deterministic real-time control cannot be achieved on Linux;
- research into native agent-generated drivers is itself the product;
- a safety-certified appliance justifies controlling the entire stack.

Until then, bare metal adds enormous cost and weakens compatibility and security.
Maintain it as an isolated Labs program informed by Fable OS, not the dependency
of Desktop, Web, iOS, or gizzi-code.

## 10. Recommended Allternit architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ Desktop │ Web │ iOS │ gizzi-code │ SDK │ Voice │ Extensions │
└─────────────────────────────┬────────────────────────────────┘
                              │ OS protocol
┌─────────────────────────────▼────────────────────────────────┐
│                   ALLTERNIT OS DAEMON                       │
│ Workloads │ Agents │ Models │ Voice │ Packages │ Experience │
│ Policy │ Leases │ Scheduler │ State │ Receipts │ Recovery   │
└──────────────┬──────────────────────────────┬────────────────┘
               │                              │
┌──────────────▼──────────────┐ ┌────────────▼────────────────┐
│ Trusted host services      │ │ Isolation fabric            │
│ Metal/MLX, audio, UI AX,   │ │ WASM, process, gVisor,      │
│ secure storage, local UI   │ │ container, microVM, VM      │
└─────────────────────────────┘ └─────────────────────────────┘
```

The daemon’s mutable agent logic is not the root of trust. A small recovery and
update controller outside it owns signed activation, A/B rollback, emergency
shutdown, and trust anchors.

## 11. Build path from the existing codebase

### Milestone 0 — Architecture lock and retirement

- Ratify the v2 blueprint and this deployment decision.
- Retire the React AllternitOS view safely.
- Inventory reusable kernel, policy, receipt, registry, workflow, model, voice,
  computer-use, VM, and surface code.
- Select canonical implementations rather than wrapping duplicates.

### Milestone 1 — Local OS daemon

- Stable Principal, Workload, Step, Event, Capability, Lease, Receipt, Artifact,
  Agent, Model, and Package contracts.
- Event journal and restart recovery.
- Local socket/stdio protocol.
- Desktop and gizzi-code clients showing the same workload.
- Emergency stop outside the agent loop.

### Milestone 2 — Model distribution

- Model manifests and hardware probe.
- llama.cpp GGUF lane and Apple MLX lane.
- Verified, resumable model install/remove/update.
- One selected bootstrap model and one larger recommended pack.
- Local/remote model routing with visible reasons and budgets.

### Milestone 3 — Voice and computer use

- Voice Turn Manager with cascade pipeline, barge-in, and spoken-output receipts.
- Browser executor with ephemeral profiles and trace artifacts.
- Host accessibility executor.
- Isolated GUI desktop executor through the platform VM backend.
- OSWorld-derived internal conformance tasks.

### Milestone 4 — Experience Compiler

- Outcome verification and episode store.
- Skill candidate generation from verified traces.
- Secret and environment sanitization.
- Fixture generation, sandbox replay, shadow evaluation, and promotion.
- Compile deterministic sequences into workflows or WASM tools.

### Milestone 5 — Generative systems

- Harness Foundry.
- WASM Tool Foundry.
- API/protocol Driver Foundry.
- QEMU hardware-driver research lab.
- A/B candidate runtime with external rollback.

### Milestone 6 — Appliance and ecosystem

- Immutable Linux runtime appliance.
- Private/public package registries and signing.
- Organization policy and fleet management.
- Third-party SDK and conformance certification.
- Evaluate dedicated hardware and bare-metal research results.

## 12. First reference system

The first complete demonstration should not be a toy calculator. It should prove
the commercial thesis:

> “Research a market, operate a browser and desktop data source, produce an
> evidence-backed report, learn the verified workflow, and repeat it faster.”

The run should:

1. Start by voice or text.
2. Use a packaged local Operator and Researcher agent.
3. Route easy/private steps to the local model and difficult reasoning according
   to policy.
4. Run browser work in an isolated profile.
5. Request approval before login, upload, purchase, message, or publication.
6. Create artifacts and authenticated receipts.
7. Survive daemon and surface restart.
8. Verify the output against citations and explicit acceptance criteria.
9. Distill a parameterized workflow and harness.
10. Replay in shadow mode and demonstrate reduced model calls, time, and cost.

This one vertical slice exercises models, voice, agents, browser use, isolation,
learning, receipts, packages, surfaces, and recovery.

## 13. Decisions locked by this research

Unless superseded by an explicit architecture decision record:

1. AllternitOS v2 is an application-layer agentic OS above existing host OSes.
2. The first distribution is a native app plus persistent daemon.
3. Bare metal remains a separate research/appliance track.
4. Surfaces are clients, never independent kernels.
5. Open-weight models are packages selected by hardware and policy.
6. GGUF/llama.cpp is the portable initial lane; MLX is the optimized Apple lane.
7. Full-duplex voice is an OS service governed by a Turn Manager.
8. Computer use follows semantic API → accessibility → vision → pixel fallback.
9. Unattended computer use defaults to an isolated agent desktop.
10. Generated code targets WASM first.
11. Linux/cloud hostile execution uses microVM-grade isolation when warranted.
12. QEMU is a lab/conformance backend, not the default consumer UX.
13. Successful turns create evidence, not automatically trusted skills.
14. The Experience Compiler promotes learning through replay and independent
    evaluation.
15. Deterministic learned sequences become workflows or programs, not perpetual
    LLM reasoning.
16. Agent-generated drivers, tools, harnesses, and repairs are versioned packages.
17. Trust anchors, emergency stop, and rollback live outside mutable agent logic.
18. OS evidence is structurally distinct from model prose in every UI.
19. Teach Mode is a first-class Experience Compiler input, with local-first
    capture, redaction, semantic reconstruction, harness generation, and replay.
20. Recorded clicks are generalized into native APIs, CLIs, DOM/accessibility
    actions, or deterministic workflows whenever those are available.

## 14. Open research questions

- Which model family passes Allternit’s tool-use and computer-use tests on each
  supported hardware tier under acceptable redistribution terms?
- Can a local full-duplex model coexist in memory with the primary reasoning and
  vision models, or must the model manager hot-swap or offload them?
- Which Apple virtualization implementation in the repository is closest to a
  reliable isolated desktop executor?
- What event journal and state engine satisfy durability without creating another
  distributed-systems project prematurely?
- Can WASM components cover most generated tools, or is a restricted native ABI
  needed early?
- How will model-generated harnesses be independently evaluated when no precise
  external oracle exists?
- What minimum evidence allows an organization to auto-promote a learned skill?
- Which actions must always require a human regardless of confidence history?
- How should personal learned skills synchronize across devices without leaking
  data, secrets, or environment-specific assumptions?
- When does a dedicated immutable Linux appliance become commercially justified?

## 15. Research integrity note

Repository descriptions and papers establish architecture and claimed results,
not production fitness. Fable OS explicitly documents serious security gaps;
computer-use benchmarks show real environments remain difficult; agent-created
skills can encode mistakes or poisoned inputs; and open-weight model quality,
license, and hardware fit change quickly. All model and runtime choices therefore
remain subject to reproducible Allternit conformance testing before distribution.

## 16. 2026 research update: the OS benchmark and wider convergence

The comparison set now includes mature operating systems as the canonical control,
not only projects that self-identify as an agent OS. Linux kernel subsystem and
userspace documentation, Darwin's Mach/BSD/I/O Kit architecture, Windows NT's
executive object/security model, and Android's verified/sandboxed application
model collectively expose 48 system responsibilities. They span root of trust,
boot, object lifecycle, scheduling, memory, IPC, drivers, storage, networking,
identity, authorization, isolation, service and package management, UI/input,
observability, recovery, update, fleet administration, and conformance.

The exhaustive benchmark and Allternit ownership map are maintained in
`docs/Core_System/00-Strategy/CANONICAL_OS_BENCHMARK_AND_AGENTIC_MAPPING.md`.
The decisive finding is that current agent-OS projects generally cover a vertical
slice of this stack:

- [Microsoft UFO²/UFO³](https://github.com/microsoft/UFO) progresses from a
  Windows desktop agent using UI Automation, Win32, COM, visual control, and APIs
  to dynamic DAG orchestration across heterogeneous devices. It is strong evidence
  for treating the desktop as one device agent beneath a multi-device control plane.
- [iii AgentOS](https://github.com/iii-hq/agentos) treats workers, functions, and
  triggers as runtime primitives and adds goals, budgets, tenancy, governance,
  scheduling, and self-improving functions. It demonstrates convergence between
  agent orchestration and a service/control-plane model.
- [CoWork OS](https://github.com/CoWork-OS/CoWork-OS) combines tasks, memory,
  skills, approvals, channels, devices, automations, artifacts, and external-agent
  orchestration in a local-first workbench. It is close to the Allternit product
  topology, while the canonical benchmark still demands proof of non-bypassable
  authority, transactional packaging, isolation, recovery, and conformance.
- [OpenDAN](https://github.com/fiatrete/OpenDAN-Personal-AI-OS) demonstrates the
  personal-AI aggregation direction: local knowledge, assistants, voice, workflows,
  and model customization in one environment.
- [OpenSwarm](https://github.com/openswarm-os/openswarm) explores local-first,
  decentralized coordination through shared latent state rather than conventional
  explicit agent messages.

Across these projects, the strongest directional signals are durable workload
graphs, governed tools, local-first models and memory, desktop-as-driver,
experience-to-skill compilation, multi-device placement, runtime-generated
software, and evidence-native interfaces. No surveyed project, by repository
claims alone, closes the full mature-OS lifecycle. That unclosed space is the
strategic opening for Allternit: combine its existing program breadth with an
explicit kernel constitution and prove every layer through conformance.

Primary mature-OS sources:

- [Linux kernel documentation](https://docs.kernel.org/),
  [subsystem APIs](https://docs.kernel.org/subsystem-apis.html), and
  [cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)
- [Darwin/XNU architecture](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/KernelProgramming/Architecture/Architecture.html)
  and [I/O Kit](https://developer.apple.com/library/archive/documentation/Darwin/Conceptual/KernelProgramming/IOKit/IOKit.html)
- [Windows kernel-mode components](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/)
  and [process security/access tokens](https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights)
- [Android security enhancements](https://source.android.com/docs/security/enhancements)
  and [verified on-device signing](https://source.android.com/docs/security/features/verifiedboot/on-device-signing-architecture)

## 17. Omarchy: native product-layer reference

[Omarchy](https://github.com/basecamp/omarchy) is a useful correction to an
architecture discussion dominated by kernels and agents. It is an installable,
opinionated Arch-based Linux distribution whose product identity comes from the
composition: bootloader, Hyprland, applications, keyboard grammar, themes,
hardware-specific setup, unified CLI, migrations, update channels, and snapshot
recovery. It demonstrates that Native AllternitOS can be unmistakably its own OS
while continuing to use Linux and its driver/application ecosystem.

The development repository also documents a single persistent Quickshell process
hosting the desktop, panels, overlays, notifications, services, plugin discovery,
and IPC. The valuable pattern is a warm coherent experience host and manifest
model. The current documentation warns that third-party QML plugins execute
unsandboxed inside that shell, which Allternit must not reproduce: generated and
third-party surfaces require declarative, WASM, or out-of-process isolation, and
secure approval/evidence/login/recovery surfaces remain compositor-owned.

Omarchy's update flow creates a pre-update Snapper snapshot, then updates system
and AUR packages and runs ordered migrations. This is pragmatic for a personal
developer distribution. Native AllternitOS should retain the visible recovery and
migration experience but use signed inactive deployments, boot probation, health
gates, and automatic rollback for its production base.

Omarchy patterns to adapt:

- one opinionated compositor, shell, command center, settings language, application
  set, update experience, and recovery path;
- one long-running shell with shared services and IPC;
- a machine-readable unified system CLI;
- themes as coordinated system resources;
- explicit stable/RC/edge/development channels and migrations;
- practical hardware-specific qualification and repair knowledge;
- an agent-readable system skill defining safe customization boundaries.

Patterns to reject or strengthen:

- unsandboxed code in the primary shell process;
- rolling in-place system mutation as the trusted production base;
- privileged authority distributed across shell scripts and ambient sudo;
- applications/windows as the durable unit of system truth;
- recovery that depends on the active user environment.

The strategic conclusion is to use Omarchy as a reference for how Native
AllternitOS should *feel and operate daily*, while keeping the Allternit kernel,
capability, evidence, package, isolation, model, and recovery architecture as the
stronger constitutional substrate.
