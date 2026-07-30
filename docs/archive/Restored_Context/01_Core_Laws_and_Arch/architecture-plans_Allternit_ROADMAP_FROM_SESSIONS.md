# Allternit_ROADMAP_FROM_SESSIONS

## Phase 0

### Epic E-001: Stabilization, Law Layer, and Contract Hardening
- Goal: UNSTATED (derived from requirements below; see task evidence).
- User value: UNSTATED in sessions; inferred from requirement evidence (see tasks).
- Evidence: Derived from session requirement lines (see tasks).
- Codebase anchor: See task components per requirement.
- Dependencies: UNSTATED; derive from session evidence if present.
- Risks: UNSTATED in sessions unless otherwise noted in task evidence.

#### Task T-036: Auth Required (PTY subprocess)
- Implementation location(s): UNSTATED
- Acceptance criteria: Auth Required (PTY subprocess)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L0185 CLI Runtime Lifecycle Model]

#### Task T-118: "required": ["name", "version", "capability", "inputs", "outputs", "providers", "policy"],
- Implementation location(s): crates/kernel/policy/src/lib.rs
- Acceptance criteria: "required": ["name", "version", "capability", "inputs", "outputs", "providers", "policy"],
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0193 /spec/Contracts/SkillSchema.json (Contract)]

#### Task T-134: BrowserSkill must be executable with the **same contract** across:
- Implementation location(s): UNSTATED
- Acceptance criteria: BrowserSkill must be executable with the **same contract** across:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_221919_BrowserSkill_Artifacts_Extensions.md [L0048 2) Execution Contexts]

#### Task T-137: ### B. Non-Negotiable Allternit Upgrades (Governance Layer)
- Implementation location(s): crates/kernel/policy/src/lib.rs
- Acceptance criteria: ### B. Non-Negotiable Allternit Upgrades (Governance Layer)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_ElizaOS_Integration.md [L0038 B. Non-Negotiable Allternit Upgrades (Governance Layer)]

#### Task T-152: - All calls must be ToolABI mediated, policy checked, and event logged.
- Implementation location(s): crates/kernel/policy/src/lib.rs
- Acceptance criteria: - All calls must be ToolABI mediated, policy checked, and event logged.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0172 6.3 Python integration]

#### Task T-153: - Local connector daemon expands attack surface (USB/FS/BLE/camera) and should come after policy/verify maturity.
- Implementation location(s): crates/kernel/policy/src/lib.rs
- Acceptance criteria: - Local connector daemon expands attack surface (USB/FS/BLE/camera) and should come after policy/verify maturity.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0214 8) Decisions we locked to avoid scope explosion]

#### Task T-165: What you’re locking in is a topology that is structurally aligned with swarms/orchestration because it turns the platfor
- Implementation location(s): crates/kernel/policy/src/lib.rs
- Acceptance criteria: What you’re locking in is a topology that is structurally aligned with swarms/orchestration because it turns the platform into a set of typed capabilities with deterministic IO, policy gates, artifact provenance, and version enforcement. Those are exactly the properties swarms need to avoid chaos.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L0003 UNHEADED]

#### Task T-167: > Goal: implement a modular, contract-driven CLI layer system with a thin router, artifact-first IO, workflow runner, co
- Implementation location(s): UNSTATED
- Acceptance criteria: > Goal: implement a modular, contract-driven CLI layer system with a thin router, artifact-first IO, workflow runner, compatibility enforcement, and CI gates.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L0084 Allternit — Layered CLI Implementation Blueprint]

#### Task T-191: •	Proactivity must be policy-bound, auditable, and tenant-configurable.
- Implementation location(s): crates/kernel/policy/src/lib.rs
- Acceptance criteria: •	Proactivity must be policy-bound, auditable, and tenant-configurable.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0445 Continuous monitoring triggers]

#### Task T-219: Our unified platform should therefore support a distributed computing model: tasks are dynamically allocated either to t
- Implementation location(s): UNSTATED
- Acceptance criteria: Our unified platform should therefore support a distributed computing model: tasks are dynamically allocated either to the cloud or to edge devices depending on what’s optimal. Modern approaches like TinyML (tiny machine learning models optimized for low-power devices) and distributed federated learning can be incorporated so even small IoT sensors can participate intelligently ￼ ￼. For instance, a network of smart security cameras (IoT devices) could run lightweight person-detection models locally (to detect intruders in real time), while a central cloud AI aggregates their alerts and runs a heavier face recognition or decision-making model if needed. The platform would orchestrate these multi-tiered workloads transparently.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0067 UNHEADED]

#### Task T-220: However, simply giving everything an IP isn’t a silver bullet – proper address planning and device management is needed 
- Implementation location(s): UNSTATED
- Acceptance criteria: However, simply giving everything an IP isn’t a silver bullet – proper address planning and device management is needed to avoid chaos in large networks ￼ ￼. The platform should implement or integrate IoT device management practices: hierarchical addressing schemes (grouping devices by location or function) ￼, directories to keep track of devices, and security measures (for example, using IPv6 privacy extensions so devices don’t always broadcast the same identifier to the world ￼). In essence, IoT mapping refers to how devices are organized and reachable, and a well-designed addressing strategy (likely IPv6-based) ensures the platform can scale to millions of devices in a structured way.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0071 UNHEADED]

#### Task T-224: In short, evolution is expected. The platform’s design should prioritize modularity, plugin-based extensions, and contin
- Implementation location(s): crates/orchestration/workflows/src/lib.rs
- Acceptance criteria: In short, evolution is expected. The platform’s design should prioritize modularity, plugin-based extensions, and continuous updates (ideally delivered seamlessly via the cloud). Embracing open standards and open-source components makes it easier to integrate tomorrow’s technology. By building a solid foundation now – standardized communication, security, and a flexible orchestration layer – the platform can incorporate new AI capabilities as they come, rather than being rigid and getting outdated. This adaptability is the essence of being “ahead of the curve.”
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0085 UNHEADED]

#### Task T-227: •	Security and Governance: Becoming a standard means users trust the platform. Robust security (end-to-end encryption, a
- Implementation location(s): crates/kernel/policy/src/lib.rs
- Acceptance criteria: •	Security and Governance: Becoming a standard means users trust the platform. Robust security (end-to-end encryption, authentication for devices/users, fine-grained access control) must be baked in. Additionally, governance mechanisms (like certification for third-party apps/models to ensure they meet safety requirements) will be important, especially in domains like robotics where safety is critical. The platform could adopt a certification program for devices and modules that are “Platform Compatible”, giving assurance that any certified robot or AI model will not compromise the system.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0092 UNHEADED]

#### Task T-252: Allternit must implement **the same pattern as a multi-tenant kernel** with stronger governance.
- Implementation location(s): crates/kernel/policy/src/lib.rs
- Acceptance criteria: Allternit must implement **the same pattern as a multi-tenant kernel** with stronger governance.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0036 1.2 Why this mirrors Allternit specifically]

#### Task T-303: All executable work MUST be defined as a single-scope execution contract.
- Implementation location(s): UNSTATED
- Acceptance criteria: All executable work MUST be defined as a single-scope execution contract.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0387 16. Execution Contract Units (Task-Level Law)]

#### Task T-345: This appendix operationalizes five agentic engineering techniques as non-negotiable system law.
- Implementation location(s): crates/kernel/policy/src/lib.rs
- Acceptance criteria: This appendix operationalizes five agentic engineering techniques as non-negotiable system law.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0009 Agentic Engineering Techniques (Formalized)]

#### Task T-365: - Skill calls must be typed and policy-gated.
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: - Skill calls must be typed and policy-gated.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_cli_agents_skills_registry.md [L0139 8) Non-negotiables / Constraints]

#### Task T-369: - Suggests: Allternit should standardize “context bundles” that include: CODEBASE.md anchors, WIH headers, contract refs, acce
- Implementation location(s): UNSTATED
- Acceptance criteria: - Suggests: Allternit should standardize “context bundles” that include: CODEBASE.md anchors, WIH headers, contract refs, acceptance tests, and relevant prior session summaries.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0092 Category A — Context, Specs, and “Perfect Context” tooling]

## Phase 1

### Epic E-002: Core Brain Runtime and Session Orchestration
- Goal: UNSTATED (derived from requirements below; see task evidence).
- User value: UNSTATED in sessions; inferred from requirement evidence (see tasks).
- Evidence: Derived from session requirement lines (see tasks).
- Codebase anchor: See task components per requirement.
- Dependencies: UNSTATED; derive from session evidence if present.
- Risks: UNSTATED in sessions unless otherwise noted in task evidence.

#### Task T-001: 🎯 Session Goal
- Implementation location(s): UNSTATED
- Acceptance criteria: 🎯 Session Goal
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Agent Runtime Brainstorm.md [L0012 UNHEADED]

#### Task T-008: ## 1. Session Goal
- Implementation location(s): UNSTATED
- Acceptance criteria: ## 1. Session Goal
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Dynamic Context-Retrieval-Quantization.md [L0013 1. Session Goal]

#### Task T-018: From this session, Allternit should formalize as top-level concepts:
- Implementation location(s): UNSTATED
- Acceptance criteria: From this session, Allternit should formalize as top-level concepts:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- External signals and archtectural alignment.md [L0423 Kernel-like agent runtimes]

#### Task T-029: Brain registry must include:
- Implementation location(s): services/kernel/src/brain/
- Acceptance criteria: Brain registry must include:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-AG-UI.md [L0208 Required Allternit Integration Points]

#### Task T-042: Shell must render multiple Brain sessions concurrently.
- Implementation location(s): services/kernel/src/brain/
- Acceptance criteria: Shell must render multiple Brain sessions concurrently.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1352 Strategic Conclusion (Saved)]

#### Task T-043: Cowork panel must group sessions by project.
- Implementation location(s): UNSTATED
- Acceptance criteria: Cowork panel must group sessions by project.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1355 Strategic Conclusion (Saved)]

#### Task T-046: Goal: run thousands of agent brains concurrently.
- Implementation location(s): UNSTATED
- Acceptance criteria: Goal: run thousands of agent brains concurrently.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1525 Strategic Conclusion (Saved)]

#### Task T-060: The orchestrator should compile Beads-style task graphs into runtime DAGs inside worker agents.
- Implementation location(s): crates/orchestration/workflows/src/lib.rs
- Acceptance criteria: The orchestrator should compile Beads-style task graphs into runtime DAGs inside worker agents.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Claude-Tasks-Vs-Beads.md [L0191 Implications for Agent Swarms]

#### Task T-088: 5) CLI “brains” PTY coverage (must include MORE than prior list)
- Implementation location(s): UNSTATED
- Acceptance criteria: 5) CLI “brains” PTY coverage (must include MORE than prior list)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0111 CLI “brains” PTY coverage (must include MORE than prior list)]

#### Task T-107: ## Session Goal
- Implementation location(s): UNSTATED
- Acceptance criteria: ## Session Goal
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Studio-Kernel-UiBuild.md [L0003 Session Goal]

#### Task T-128: - Given `capability=heavy_code` and `privacy_mode=local_only`, the router must never select a `cloud` runtime.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Given `capability=heavy_code` and `privacy_mode=local_only`, the router must never select a `cloud` runtime.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0324 A) Routing Determinism]

#### Task T-129: ## 8) Phase 1 — Capability Router (MUST FIRST)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## 8) Phase 1 — Capability Router (MUST FIRST)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0344 8) Phase 1 — Capability Router (MUST FIRST)]

#### Task T-142: - This session is specifically about **ElizaOS → Allternit integration** and should be merged into the canonical Allternitchi
- Implementation location(s): UNSTATED
- Acceptance criteria: - This session is specifically about **ElizaOS → Allternit integration** and should be merged into the canonical Allternit buildout thread under:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_ElizaOS_Integration.md [L0110 Consolidation Notes for Canonical Buildout Chat]

#### Task T-151: - Python should be an **external Skills Gateway**, not embedded in the kernel trust boundary.
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: - Python should be an **external Skills Gateway**, not embedded in the kernel trust boundary.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0170 6.3 Python integration]

#### Task T-185: •	✅ Tool gateway exists as a deliberate side-effect boundary (AG1 requirement)
- Implementation location(s): UNSTATED
- Acceptance criteria: •	✅ Tool gateway exists as a deliberate side-effect boundary (AG1 requirement)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0316 Defines a clear trajectory for turning Allternit into a true PAI Platform OS]

#### Task T-214: From a technical standpoint, this means the platform should be hardware-agnostic and modular in design. A robot arm from
- Implementation location(s): services/kernel/src/brain/
- Acceptance criteria: From a technical standpoint, this means the platform should be hardware-agnostic and modular in design. A robot arm from Company A and an autonomous vehicle from Company B should both be able to register with the platform and interoperate. Again, looking at real examples: Wandelbots Nova OS positions itself as “one operating system for your entire robotics landscape” across brands, enabling integration whether you “retrofit legacy hardware or scale across vendors” via a vendor-agnostic approach ￼. Similarly, ROS 2 (Robot Operating System, v2) has become a common middleware standard that many robots speak; Karelics Brain leverages ROS 2 so that it can easily support various sensors and devices through standardized drivers, eliminating the complexity of managing unique software for each component ￼ ￼. Our unified platform would likely build upon such middleware and extend it with cloud connectivity and AI integration.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0047 UNHEADED]

#### Task T-244: 1. Meta Goal of This Session
- Implementation location(s): UNSTATED
- Acceptance criteria: 1. Meta Goal of This Session
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0361 Meta Goal of This Session]

#### Task T-306: The Orchestrator MUST halt execution if any of the following are true:
- Implementation location(s): crates/orchestration/workflows/src/lib.rs
- Acceptance criteria: The Orchestrator MUST halt execution if any of the following are true:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0445 18. Execution Gating Rules (Hard Stops)]

#### Task T-311: When starting any new project, the Orchestrator MUST:
- Implementation location(s): crates/orchestration/workflows/src/lib.rs
- Acceptance criteria: When starting any new project, the Orchestrator MUST:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0480 20. New Project Initialization Protocol (Mandatory)]

#### Task T-367: **Scope:** This session is treated as Allternit (Allternit) canonical material. It analyzes the provided links as signals for
- Implementation location(s): crates/orchestration/workflows/src/lib.rs
- Acceptance criteria: **Scope:** This session is treated as Allternit (Allternit) canonical material. It analyzes the provided links as signals for how Allternit should evolve as a **productivity OS / agentic platform**: an **agent harness** that reduces context switching, provides one-place discovery, and supports modular swarm orchestration.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0003 Allternit Session Summary — External Signals, Agent Harness, Orchestration, A2UI (Jan 26, 2026)]

#### Task T-388: - Backend emits `brain.required`.
- Implementation location(s): services/kernel/src/brain/
- Acceptance criteria: - Backend emits `brain.required`.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_shellui_brain_runtime_ui_e2e.md [L0081 C) Chat send with no agent selected]

### Epic E-003: Shell UI + Capsule OS Experience
- Goal: UNSTATED (derived from requirements below; see task evidence).
- User value: UNSTATED in sessions; inferred from requirement evidence (see tasks).
- Evidence: Derived from session requirement lines (see tasks).
- Codebase anchor: See task components per requirement.
- Dependencies: UNSTATED; derive from session evidence if present.
- Risks: UNSTATED in sessions unless otherwise noted in task evidence.

#### Task T-004: - Long-running agents must preserve prefix stability.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Long-running agents must preserve prefix stability.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Agent Runtime Positioning vs xpander.md [L0091 3.6 Prompt Caching as a Production Constraint]

#### Task T-006: Prefix stability must be preserved.
- Implementation location(s): UNSTATED
- Acceptance criteria: Prefix stability must be preserved.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Agent Runtime Positioning vs xpander.md [L0177 LAW-05: Cache-Aware Context Mutation]

#### Task T-024: AG-UI should become:
- Implementation location(s): services/agui-gateway/src/index.ts
- Acceptance criteria: AG-UI should become:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-AG-UI.md [L0130 Strategic Implications for Allternit]

#### Task T-025: All capsules (Terminal, Browser, Canvas, Inspector, Diff Viewer, Mini-Apps) should speak:
- Implementation location(s): crates/capsule-runtime/src/lib.rs
- Acceptance criteria: All capsules (Terminal, Browser, Canvas, Inspector, Diff Viewer, Mini-Apps) should speak:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-AG-UI.md [L0134 Strategic Implications for Allternit]

#### Task T-031: AG-UI should be treated as the reference design for the A2UI transport layer.
- Implementation location(s): services/agui-gateway/src/index.ts
- Acceptance criteria: AG-UI should be treated as the reference design for the A2UI transport layer.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-AG-UI.md [L0248 Net-New Strategic Conclusion]

#### Task T-032: - Long-running agents must preserve prefix stability.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Long-running agents must preserve prefix stability.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Agent-Governance.md [L0091 3.6 Prompt Caching as a Production Constraint]

#### Task T-034: Prefix stability must be preserved.
- Implementation location(s): UNSTATED
- Acceptance criteria: Prefix stability must be preserved.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Agent-Governance.md [L0177 LAW-05: Cache-Aware Context Mutation]

#### Task T-039: Shell UI must render:
- Implementation location(s): apps/shell/src/App.tsx
- Acceptance criteria: Shell UI must render:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L0818 New Requirements Inserted Into Allternit Roadmap]

#### Task T-041: Shell UI must render:
- Implementation location(s): apps/shell/src/App.tsx
- Acceptance criteria: Shell UI must render:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1113 New Requirements Inserted Into Allternit Roadmap]

#### Task T-062: - Long-running agents must preserve prefix stability.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Long-running agents must preserve prefix stability.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Context Engineering - Long Running Agents.md [L0091 3.6 Prompt Caching as a Production Constraint]

#### Task T-064: Prefix stability must be preserved.
- Implementation location(s): UNSTATED
- Acceptance criteria: Prefix stability must be preserved.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Context Engineering - Long Running Agents.md [L0177 LAW-05: Cache-Aware Context Mutation]

#### Task T-072: •	Steps must be auditable
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Steps must be auditable
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0199 UNHEADED]

#### Task T-079: •	OpenWork must be integrated as a first-class Shell UI tab/view, not an iframe pointing at the shell Vite port.
- Implementation location(s): apps/shell/src/App.tsx
- Acceptance criteria: •	OpenWork must be integrated as a first-class Shell UI tab/view, not an iframe pointing at the shell Vite port.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0022 Ground truth decisions (locked)]

#### Task T-080: •	Miniapp capsules + browser chrome should be schema-driven (A2UI), not hardcoded React-only chrome, if we want dynamic/
- Implementation location(s): services/browser-runtime/src/index.ts
- Acceptance criteria: •	Miniapp capsules + browser chrome should be schema-driven (A2UI), not hardcoded React-only chrome, if we want dynamic/agent-extensible surfaces.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0034 Ground truth decisions (locked)]

#### Task T-081: Correct: OpenWork must be a Shell tab/view at 5713, integrated as UI, not a server pointer.
- Implementation location(s): UNSTATED
- Acceptance criteria: Correct: OpenWork must be a Shell tab/view at 5713, integrated as UI, not a server pointer.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0052 What was failing / why progress felt fake]

#### Task T-083: Capsules must support:
- Implementation location(s): UNSTATED
- Acceptance criteria: Capsules must support:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0060 Required end-state UX (what “done” looks like)]

#### Task T-084: Browser capsule must include:
- Implementation location(s): crates/capsule-runtime/src/lib.rs
- Acceptance criteria: Browser capsule must include:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0069 Required end-state UX (what “done” looks like)]

#### Task T-085: •	Capsule icons must be custom SVG assets (vendor or generated), not emojis.
- Implementation location(s): crates/capsule-runtime/src/lib.rs
- Acceptance criteria: •	Capsule icons must be custom SVG assets (vendor or generated), not emojis.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0077 Required end-state UX (what “done” looks like)]

#### Task T-086: •	On capsule creation, icon should be derived from:
- Implementation location(s): crates/capsule-runtime/src/lib.rs
- Acceptance criteria: •	On capsule creation, icon should be derived from:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0078 Required end-state UX (what “done” looks like)]

#### Task T-092: 7.2 Windowing OS behaviors must be real, not stubbed
- Implementation location(s): UNSTATED
- Acceptance criteria: 7.2 Windowing OS behaviors must be real, not stubbed
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0161 Corrective directives that must be reflected in the agent’s execution]

#### Task T-094: 7.4 UI-TARS must be executable loop, not “primitives only”
- Implementation location(s): UNSTATED
- Acceptance criteria: 7.4 UI-TARS must be executable loop, not “primitives only”
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0175 Corrective directives that must be reflected in the agent’s execution]

#### Task T-110: - Studio UI is not allowed to “imply” capability: all actions must be truth-bound to control-plane endpoints.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Studio UI is not allowed to “imply” capability: all actions must be truth-bound to control-plane endpoints.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Studio-Kernel-UiBuild.md [L0088 Notable Decisions Locked This Session]

#### Task T-111: - Kernel becomes the single control-plane surface; apps/api workflow routes can be proxied/migrated but Studio must call
- Implementation location(s): UNSTATED
- Acceptance criteria: - Kernel becomes the single control-plane surface; apps/api workflow routes can be proxied/migrated but Studio must call kernel.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Studio-Kernel-UiBuild.md [L0089 Notable Decisions Locked This Session]

#### Task T-150: - But: you must **design the ToolABI and capsule schema now** to support WASM later **without refactor**.
- Implementation location(s): crates/capsule-runtime/src/lib.rs
- Acceptance criteria: - But: you must **design the ToolABI and capsule schema now** to support WASM later **without refactor**.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0163 6.2 Is WASM necessary right now?]

#### Task T-155: - Capsule build/verify required to run
- Implementation location(s): crates/capsule-runtime/src/lib.rs
- Acceptance criteria: - Capsule build/verify required to run
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0235 MVP-2: Strict capsule lifecycle + assistant actions]

#### Task T-213: Any platform aiming to be a global standard for robotics integration must accommodate the full diversity of robotics har
- Implementation location(s): UNSTATED
- Acceptance criteria: Any platform aiming to be a global standard for robotics integration must accommodate the full diversity of robotics hardware in the market. This includes industrial arms, mobile robots, drones, service robots, IoT sensors, and more – coming from established players in North America, Europe, and the rapidly growing cohort of Chinese robotics companies. In fact, China has become the world’s largest robotics market by far, and its domestic robot makers (like SIASUN, Estun, DJI, Unitree, etc.) are now highly competitive. In 2024, China accounted for 54% of new industrial robot installations worldwide – a record 295,000 units in one year ￼. For the first time, Chinese manufacturers sold more robots in China than foreign suppliers did, seizing a 57% domestic market share (up from 28% a decade earlier) ￼. Moreover, China’s robotics industry revenue more than doubled from 2020 to 2024, and Chinese brands’ market share in-country jumped to 58.5% ￼ ￼. These trends indicate that any “unified platform” must be truly international and not biased to a single region’s hardware or protocols.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0045 UNHEADED]

#### Task T-217: Additionally, data centers are the hub connecting all enterprise systems, so our platform should easily integrate with e
- Implementation location(s): UNSTATED
- Acceptance criteria: Additionally, data centers are the hub connecting all enterprise systems, so our platform should easily integrate with existing cloud services and enterprise data pipelines. For instance, a company might want the robotics platform to pull data from their warehouse database or send logs to their analytics cloud. Using standardized cloud APIs and having a flexible integration layer will be key. The platform essentially becomes part of the broader AI & data infrastructure of organizations.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0059 UNHEADED]

#### Task T-221: AI is a fast-moving field, and “mainstream models are getting better” at an extraordinary pace. A future-proof platform 
- Implementation location(s): UNSTATED
- Acceptance criteria: AI is a fast-moving field, and “mainstream models are getting better” at an extraordinary pace. A future-proof platform must be architected with adaptability in mind, so that new paradigms in AI can be integrated with minimal disruption. What might these new paradigms be? Some are already on the horizon or here: multimodal models that handle text, images, and actions together; advanced reasoning techniques like chain-of-thought prompting; and more specialized AI agents that can perform autonomous tasks.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0077 UNHEADED]

#### Task T-320: Rules/constraints should be modular, composable, independently testable.
- Implementation location(s): UNSTATED
- Acceptance criteria: Rules/constraints should be modular, composable, independently testable.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0081 LAW-ORG-004 (SOFT) — Modular Rules Architecture]

#### Task T-325: All actions must be attributable, reproducible, explainable. If it cannot be audited, it cannot run.
- Implementation location(s): UNSTATED
- Acceptance criteria: All actions must be attributable, reproducible, explainable. If it cannot be audited, it cannot run.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0118 LAW-ENF-002 (HARD) — Auditability]

#### Task T-358: Any additional complexity must live as **toggle modes within existing tabs**, especially Console and Browser.
- Implementation location(s): services/browser-runtime/src/index.ts
- Acceptance criteria: Any additional complexity must live as **toggle modes within existing tabs**, especially Console and Browser.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_agentops_session_summary.md [L0017 1) UI IA Decision (keep tabs minimal)]

#### Task T-380: - Therefore it should be integrated as a **Capsule** that subscribes to agent state, never generating agent decisions.
- Implementation location(s): crates/capsule-runtime/src/lib.rs
- Acceptance criteria: - Therefore it should be integrated as a **Capsule** that subscribes to agent state, never generating agent decisions.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_gizzi-avatar-3d.md [L0025 1) Role of `avatar-3d` in Allternit]

#### Task T-389: ## 5) ShellUI UI Build: Required Frontend Features
- Implementation location(s): apps/shell/src/App.tsx
- Acceptance criteria: ## 5) ShellUI UI Build: Required Frontend Features
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_shellui_brain_runtime_ui_e2e.md [L0091 5) ShellUI UI Build: Required Frontend Features]

### Epic E-004: Memory, Evidence, and Replay
- Goal: UNSTATED (derived from requirements below; see task evidence).
- User value: UNSTATED in sessions; inferred from requirement evidence (see tasks).
- Evidence: Derived from session requirement lines (see tasks).
- Codebase anchor: See task components per requirement.
- Dependencies: UNSTATED; derive from session evidence if present.
- Risks: UNSTATED in sessions unless otherwise noted in task evidence.

#### Task T-146: - Must be deterministic and replayable.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Must be deterministic and replayable.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0055 **Capsule**]

#### Task T-169: * Artifact IDs without durability (must persist).
- Implementation location(s): UNSTATED
- Acceptance criteria: * Artifact IDs without durability (must persist).
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L0182 `a2-artifact` CLI (minimal)]

#### Task T-205: > Auto-generated. Every claim should include evidence paths.
- Implementation location(s): UNSTATED
- Acceptance criteria: > Auto-generated. Every claim should include evidence paths.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0238 Codebase Documentation]

#### Task T-235: Therefore memory must be:
- Implementation location(s): services/state/memory/src/lib.rs
- Acceptance criteria: Therefore memory must be:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0602 Legal, Privacy, and Consent Layer]

### Epic E-008: Runtime Integrations (Browser/WebVM/Voice/Local)
- Goal: UNSTATED (derived from requirements below; see task evidence).
- User value: UNSTATED in sessions; inferred from requirement evidence (see tasks).
- Evidence: Derived from session requirement lines (see tasks).
- Codebase anchor: See task components per requirement.
- Dependencies: UNSTATED; derive from session evidence if present.
- Risks: UNSTATED in sessions unless otherwise noted in task evidence.

#### Task T-002: 🧠 First-Principles Definition: What an Agent Runtime Must Do
- Implementation location(s): UNSTATED
- Acceptance criteria: 🧠 First-Principles Definition: What an Agent Runtime Must Do
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Agent Runtime Brainstorm.md [L0020 UNHEADED]

#### Task T-003: An agent runtime must satisfy five irreducible functions:
- Implementation location(s): UNSTATED
- Acceptance criteria: An agent runtime must satisfy five irreducible functions:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Agent Runtime Brainstorm.md [L0022 UNHEADED]

#### Task T-050: - Allternit should treat browser automation as **a tool-callable capability** surfaced via:
- Implementation location(s): services/browser-runtime/src/index.ts
- Acceptance criteria: - Allternit should treat browser automation as **a tool-callable capability** surfaced via:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Browser Control Frontier.md [L0046 Decision: Browser-first frontier = browser-use skill]

#### Task T-053: For now, you can still achieve the practical goal: **no Playwright-authored code and no Playwright exposed to agents**, 
- Implementation location(s): services/browser-runtime/src/index.ts
- Acceptance criteria: For now, you can still achieve the practical goal: **no Playwright-authored code and no Playwright exposed to agents**, while tolerating it as a hidden dependency if needed.  [oai_citation:9‡Bright Data](https://brightdata.com/blog/ai/browser-use-with-scraping-browser?utm_source=chatgpt.com)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Browser Control Frontier.md [L0084 R1 — “No Playwright at all” may be infeasible if browser-use depends on it]

#### Task T-115: - Intercept in shell for browser/miniappps; legacy `apps/ui` BrowserView must not render `browser_view`.
- Implementation location(s): services/browser-runtime/src/index.ts
- Acceptance criteria: - Intercept in shell for browser/miniappps; legacy `apps/ui` BrowserView must not render `browser_view`.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_SESSION_2026-01-26_shell-ui-browser-capsules.md [L0117 Hard constraints]

#### Task T-126: "required": ["input", "context", "runtime"],
- Implementation location(s): UNSTATED
- Acceptance criteria: "required": ["input", "context", "runtime"],
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0289 /spec/Contracts/ModelProviderAdapter.json (Contract)]

#### Task T-144: - Tools must be dynamically discoverable at runtime.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Tools must be dynamically discoverable at runtime.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0049 **ToolABI** (Unix-style “syscall interface”)]

#### Task T-157: 5) New tools must be recognized at runtime without kernel rebuild.
- Implementation location(s): UNSTATED
- Acceptance criteria: 5) New tools must be recognized at runtime without kernel rebuild.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0291 New tools must be recognized at runtime without kernel rebuild.]

#### Task T-218: While cloud computing is crucial, the platform must also embrace edge computing, especially for IoT and robotics tasks t
- Implementation location(s): UNSTATED
- Acceptance criteria: While cloud computing is crucial, the platform must also embrace edge computing, especially for IoT and robotics tasks that require real-time performance or must run offline. Edge AI computing in IoT refers to running AI algorithms locally on devices like robots, drones, sensors, etc., rather than sending all data to the cloud. This is often necessary because robots deal with high-bandwidth sensor data and split-second decisions. A drone avoiding an obstacle, for example, cannot wait hundreds of milliseconds for a cloud round-trip; it needs to process the camera feed and react immediately on-board. By utilizing edge AI, “a drone can process video feeds locally for obstacle avoidance, reducing both latency and reliance on cloud connectivity” ￼. In general, edge computing reduces latency, saves bandwidth, and can improve privacy (sensitive data doesn’t have to leave the device).
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0065 UNHEADED]

#### Task T-222: For example, Google DeepMind’s recent work on Robotics Transformer (RT) models illustrates how AI paradigms are shifting
- Implementation location(s): UNSTATED
- Acceptance criteria: For example, Google DeepMind’s recent work on Robotics Transformer (RT) models illustrates how AI paradigms are shifting to encompass robotics. Their RT-2 model is a vision-language-action network that can take web-trained knowledge and directly output actions for a robot ￼. In essence, “RT-2 removes [the] complexity and enables a single model to perform the complex reasoning seen in foundation models, but also output robot actions” ￼. This blurs the line between “thinking” (AI in the cloud) and “doing” (robot control) – one model can handle both. Our platform should be ready to exploit such breakthroughs: if a unified model can control a robot more intelligently, we should allow it as a module within the system. Likewise, if tomorrow’s GPT-6 or Claude Next can autonomously operate software tools (as AI agents), the platform could delegate higher-level decision-making to them while it handles the execution and safety layer.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0079 UNHEADED]

#### Task T-228: •	Continuous Evolution: A future-proof platform must not rest after version 1. It needs a roadmap for continuous improve
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Continuous Evolution: A future-proof platform must not rest after version 1. It needs a roadmap for continuous improvement, informed by technological advances and user feedback. Regular updates (delivered over-the-air, as mentioned, ideally with minimal disruption) will keep it on the cutting edge. Cloud connectivity makes this easier – core logic can be updated in the cloud, and edge device firmware can receive OTA updates regularly (with rollback options for safety). The one-click updates already implemented by platforms like Karelics show how even complex robot software can be updated fleet-wide with minimal effort ￼. This ensures that once a user invests in the platform, their system actually gets better over time with new features and optimizations, rather than becoming obsolete.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0094 UNHEADED]

#### Task T-321: Failures must produce rules/tests/specs, not tribal knowledge.
- Implementation location(s): UNSTATED
- Acceptance criteria: Failures must produce rules/tests/specs, not tribal knowledge.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0084 LAW-ORG-005 (SOFT) — System Evolution Mindset]

#### Task T-360: Browser must be a **real browsing surface** while supporting:
- Implementation location(s): services/browser-runtime/src/index.ts
- Acceptance criteria: Browser must be a **real browsing surface** while supporting:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_agentops_session_summary.md [L0061 6) Browser Tab Goals (miniapp capsules + gentabs-like clustering)]

#### Task T-361: A “real browser engine” must render pages, either:
- Implementation location(s): services/browser-runtime/src/index.ts
- Acceptance criteria: A “real browser engine” must render pages, either:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_agentops_session_summary.md [L0075 7) Core Problem: web-only browser not loading pages]

#### Task T-362: ## 11) Required Agent Types for Browser
- Implementation location(s): services/browser-runtime/src/index.ts
- Acceptance criteria: ## 11) Required Agent Types for Browser
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_agentops_session_summary.md [L0110 11) Required Agent Types for Browser]

#### Task T-363: 1. Confirm runtime: web-only vs electron/tauri (affects whether streaming is required)
- Implementation location(s): UNSTATED
- Acceptance criteria: 1. Confirm runtime: web-only vs electron/tauri (affects whether streaming is required)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_agentops_session_summary.md [L0150 Confirm runtime: web-only vs electron/tauri (affects whether streaming is required)]

#### Task T-366: - Default deny network; allowlists for browser domains where required.
- Implementation location(s): services/browser-runtime/src/index.ts
- Acceptance criteria: - Default deny network; allowlists for browser domains where required.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_cli_agents_skills_registry.md [L0142 8) Non-negotiables / Constraints]

### Epic E-009: Miscellaneous Requirements
- Goal: UNSTATED (derived from requirements below; see task evidence).
- User value: UNSTATED in sessions; inferred from requirement evidence (see tasks).
- Evidence: Derived from session requirement lines (see tasks).
- Codebase anchor: See task components per requirement.
- Dependencies: UNSTATED; derive from session evidence if present.
- Risks: UNSTATED in sessions unless otherwise noted in task evidence.

#### Task T-005: All agents must operate primarily through:
- Implementation location(s): UNSTATED
- Acceptance criteria: All agents must operate primarily through:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Agent Runtime Positioning vs xpander.md [L0148 LAW-01: OS Is the Action Plane]

#### Task T-007: Context rewriting must be deliberate.
- Implementation location(s): UNSTATED
- Acceptance criteria: Context rewriting must be deliberate.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Agent Runtime Positioning vs xpander.md [L0178 LAW-05: Cache-Aware Context Mutation]

#### Task T-009: Summaries must include:
- Implementation location(s): UNSTATED
- Acceptance criteria: Summaries must include:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Dynamic Context-Retrieval-Quantization.md [L0092 **Rolling summary (prompt-safe)**]

#### Task T-010: - CPU-only requirement
- Implementation location(s): UNSTATED
- Acceptance criteria: - CPU-only requirement
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Dynamic Context-Retrieval-Quantization.md [L0126 Optional cross-encoder rerank]

#### Task T-011: ## 13. Hard Defaults (Non-Negotiable)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## 13. Hard Defaults (Non-Negotiable)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Dynamic Context-Retrieval-Quantization.md [L0209 13. Hard Defaults (Non-Negotiable)]

#### Task T-012: All future Allternit research must **map to this structure** or explicitly extend it.
- Implementation location(s): UNSTATED
- Acceptance criteria: All future Allternit research must **map to this structure** or explicitly extend it.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Dynamic Context-Retrieval-Quantization.md [L0236 15. Strategic Outcome]

#### Task T-013: Allternit should formally define:
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit should formally define:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- External signals and archtectural alignment.md [L0121 Kernel-like agent runtimes]

#### Task T-014: The destructive_command_guard pattern should be:
- Implementation location(s): UNSTATED
- Acceptance criteria: The destructive_command_guard pattern should be:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- External signals and archtectural alignment.md [L0177 Kernel-like agent runtimes]

#### Task T-015: Allternit must treat GUI automation as:
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit must treat GUI automation as:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- External signals and archtectural alignment.md [L0222 Kernel-like agent runtimes]

#### Task T-016: Allternit should formalize:
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit should formalize:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- External signals and archtectural alignment.md [L0262 Kernel-like agent runtimes]

#### Task T-017: Allternit must ship as:
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit must ship as:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- External signals and archtectural alignment.md [L0306 Kernel-like agent runtimes]

#### Task T-019: This thread should be exported under a title like:
- Implementation location(s): UNSTATED
- Acceptance criteria: This thread should be exported under a title like:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- External signals and archtectural alignment.md [L0441 Swarm Topology Engine]

#### Task T-021: Every backend should be runnable as:
- Implementation location(s): UNSTATED
- Acceptance criteria: Every backend should be runnable as:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Multimodal Stack.md [L0270 Hot-swappable providers]

#### Task T-022: 🛠 What You Should Build in Allternit First
- Implementation location(s): UNSTATED
- Acceptance criteria: 🛠 What You Should Build in Allternit First
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- Multimodal Stack.md [L0309 Hot-swappable providers]

#### Task T-026: Agents should emit:
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents should emit:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-AG-UI.md [L0140 Strategic Implications for Allternit]

#### Task T-027: 6. Required Allternit Integration Points
- Implementation location(s): UNSTATED
- Acceptance criteria: 6. Required Allternit Integration Points
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-AG-UI.md [L0169 Required Allternit Integration Points]

#### Task T-028: Agents must emit versioned UI definitions:
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents must emit versioned UI definitions:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-AG-UI.md [L0196 Required Allternit Integration Points]

#### Task T-030: This Markdown should be merged under sections:
- Implementation location(s): UNSTATED
- Acceptance criteria: This Markdown should be merged under sections:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-AG-UI.md [L0229 Items to Merge into Canonical Allternit Buildout]

#### Task T-033: All agents must operate primarily through:
- Implementation location(s): UNSTATED
- Acceptance criteria: All agents must operate primarily through:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Agent-Governance.md [L0148 LAW-01: OS Is the Action Plane]

#### Task T-035: Context rewriting must be deliberate.
- Implementation location(s): UNSTATED
- Acceptance criteria: Context rewriting must be deliberate.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Agent-Governance.md [L0178 LAW-05: Cache-Aware Context Mutation]

#### Task T-037: •	CLI agents must always be subprocess-wrapped
- Implementation location(s): UNSTATED
- Acceptance criteria: •	CLI agents must always be subprocess-wrapped
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L0267 Strategic Decisions Locked In]

#### Task T-038: We should steal the UX ideas, not the architecture:
- Implementation location(s): UNSTATED
- Acceptance criteria: We should steal the UX ideas, not the architecture:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L0793 What 1Code Still Gives Us Strategically]

#### Task T-040: We should steal the UX ideas, not the architecture:
- Implementation location(s): UNSTATED
- Acceptance criteria: We should steal the UX ideas, not the architecture:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1088 What 1Code Still Gives Us Strategically]

#### Task T-045: Goal: offload heavy jobs to machines / homelabs / cloud VMs.
- Implementation location(s): UNSTATED
- Acceptance criteria: Goal: offload heavy jobs to machines / homelabs / cloud VMs.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1508 Strategic Conclusion (Saved)]

#### Task T-047: Goal: cross-organization compute meshes.
- Implementation location(s): UNSTATED
- Acceptance criteria: Goal: cross-organization compute meshes.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1542 Strategic Conclusion (Saved)]

#### Task T-048: L-003	Tests must pass
- Implementation location(s): UNSTATED
- Acceptance criteria: L-003	Tests must pass
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1577 Strategic Conclusion (Saved)]

#### Task T-049: L-005	ADR required
- Implementation location(s): UNSTATED
- Acceptance criteria: L-005	ADR required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1579 Strategic Conclusion (Saved)]

#### Task T-051: ### Non-goal (your directive)
- Implementation location(s): UNSTATED
- Acceptance criteria: ### Non-goal (your directive)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Browser Control Frontier.md [L0050 Non-goal (your directive)]

#### Task T-052: - If Playwright exists, it should be **an implementation detail**, not an API.
- Implementation location(s): UNSTATED
- Acceptance criteria: - If Playwright exists, it should be **an implementation detail**, not an API.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Browser Control Frontier.md [L0052 Non-goal (your directive)]

#### Task T-054: “Playwright is deprecated” is often a misread of “Microsoft Playwright Testing is retired.” The platform decision should
- Implementation location(s): UNSTATED
- Acceptance criteria: “Playwright is deprecated” is often a misread of “Microsoft Playwright Testing is retired.” The platform decision should not be based on that confusion; base it on Allternit’s desired abstraction (agent-friendly browsing).  [oai_citation:10‡Microsoft Learn](https://learn.microsoft.com/en-us/rest/api/playwright/includes/retirement-banner?utm_source=chatgpt.com)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Browser Control Frontier.md [L0087 R2 — Confusion from Microsoft product retirement]

#### Task T-056: ## 7. Required Allternit Parity Modules
- Implementation location(s): UNSTATED
- Acceptance criteria: ## 7. Required Allternit Parity Modules
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Claude-TS-.md [L0133 7. Required Allternit Parity Modules]

#### Task T-057: Execution must be anchored in:
- Implementation location(s): UNSTATED
- Acceptance criteria: Execution must be anchored in:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Claude-TS-.md [L0170 8. Architecture Principle Reinforced]

#### Task T-058: Install effort	None	Required
- Implementation location(s): UNSTATED
- Acceptance criteria: Install effort	None	Required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Claude-Tasks-Vs-Beads.md [L0115 Direct Comparison Matrix]

#### Task T-059: Allternit should implement:
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit should implement:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Claude-Tasks-Vs-Beads.md [L0159 Strategic Direction for Allternit]

#### Task T-061: Allternit must unify both.
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit must unify both.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Claude-Tasks-Vs-Beads.md [L0250 Durable distributed cognition]

#### Task T-063: All agents must operate primarily through:
- Implementation location(s): UNSTATED
- Acceptance criteria: All agents must operate primarily through:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Context Engineering - Long Running Agents.md [L0148 LAW-01: OS Is the Action Plane]

#### Task T-065: Context rewriting must be deliberate.
- Implementation location(s): UNSTATED
- Acceptance criteria: Context rewriting must be deliberate.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Context Engineering - Long Running Agents.md [L0178 LAW-05: Cache-Aware Context Mutation]

#### Task T-066: Agent roles	Agent (role, goal, backstory)
- Implementation location(s): UNSTATED
- Acceptance criteria: Agent roles	Agent (role, goal, backstory)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0034 UNHEADED]

#### Task T-067: goal: >
- Implementation location(s): UNSTATED
- Acceptance criteria: goal: >
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0090 UNHEADED]

#### Task T-068: goal: >
- Implementation location(s): UNSTATED
- Acceptance criteria: goal: >
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0113 UNHEADED]

#### Task T-069: goal: >
- Implementation location(s): UNSTATED
- Acceptance criteria: goal: >
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0145 UNHEADED]

#### Task T-070: •	Tasks must declare expected_output
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Tasks must declare expected_output
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0167 UNHEADED]

#### Task T-071: •	Output must be structured
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Output must be structured
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0198 UNHEADED]

#### Task T-073: │  │ Planner Agent│  ← decomposes goal │
- Implementation location(s): UNSTATED
- Acceptance criteria: │  │ Planner Agent│  ← decomposes goal │
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0247 UNHEADED]

#### Task T-074: Allternit systems must persist state. CrewAI gives you hooks — you add storage.
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit systems must persist state. CrewAI gives you hooks — you add storage.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0276 UNHEADED]

#### Task T-075: goal: >
- Implementation location(s): UNSTATED
- Acceptance criteria: goal: >
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0382 UNHEADED]

#### Task T-076: goal: >
- Implementation location(s): UNSTATED
- Acceptance criteria: goal: >
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0391 UNHEADED]

#### Task T-077: goal: >
- Implementation location(s): UNSTATED
- Acceptance criteria: goal: >
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0399 UNHEADED]

#### Task T-078: Allternit Requirement	Covered By
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit Requirement	Covered By
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-CrewAI.md [L0467 UNHEADED]

#### Task T-082: 3) Required end-state UX (what “done” looks like)
- Implementation location(s): UNSTATED
- Acceptance criteria: 3) Required end-state UX (what “done” looks like)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0056 Required end-state UX (what “done” looks like)]

#### Task T-087: 4.2 Display pipeline (must be consistent everywhere)
- Implementation location(s): UNSTATED
- Acceptance criteria: 4.2 Display pipeline (must be consistent everywhere)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0096 Miniapp capsules: where they live and how they render]

#### Task T-089: Each must be supported as:
- Implementation location(s): UNSTATED
- Acceptance criteria: Each must be supported as:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0125 CLI “brains” PTY coverage (must include MORE than prior list)]

#### Task T-090: 7) Corrective directives that must be reflected in the agent’s execution
- Implementation location(s): UNSTATED
- Acceptance criteria: 7) Corrective directives that must be reflected in the agent’s execution
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0154 Corrective directives that must be reflected in the agent’s execution]

#### Task T-091: 7.1 OpenWork integration (non-negotiable)
- Implementation location(s): UNSTATED
- Acceptance criteria: 7.1 OpenWork integration (non-negotiable)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0156 Corrective directives that must be reflected in the agent’s execution]

#### Task T-093: 7.3 Icons must be SVG assets (no emojis)
- Implementation location(s): UNSTATED
- Acceptance criteria: 7.3 Icons must be SVG assets (no emojis)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0170 Corrective directives that must be reflected in the agent’s execution]

#### Task T-095: 8) What “next agent” must do (high-level, ordered)
- Implementation location(s): UNSTATED
- Acceptance criteria: 8) What “next agent” must do (high-level, ordered)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md [L0181 What “next agent” must do (high-level, ordered)]

#### Task T-097: ### Required files
- Implementation location(s): UNSTATED
- Acceptance criteria: ### Required files
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0059 Required files]

#### Task T-099: ## D) Installer invariants (MUST)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## D) Installer invariants (MUST)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0171 D) Installer invariants (MUST)]

#### Task T-101: 2. Frontmatter MUST include: `id`, `name`, `version`, `description`.
- Implementation location(s): UNSTATED
- Acceptance criteria: 2. Frontmatter MUST include: `id`, `name`, `version`, `description`.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0173 Frontmatter MUST include: `id`, `name`, `version`, `description`.]

#### Task T-103: 4. Hashes in `.well-known` index MUST match downloaded content (`sha256`).
- Implementation location(s): UNSTATED
- Acceptance criteria: 4. Hashes in `.well-known` index MUST match downloaded content (`sha256`).
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0175 Hashes in `.well-known` index MUST match downloaded content (`sha256`).]

#### Task T-104: 5. Installer MUST refuse path traversal in declared files (`..`, absolute paths).
- Implementation location(s): UNSTATED
- Acceptance criteria: 5. Installer MUST refuse path traversal in declared files (`..`, absolute paths).
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0176 Installer MUST refuse path traversal in declared files (`..`, absolute paths).]

#### Task T-105: - `DISABLE_TELEMETRY=1` should disable all telemetry, matching the ecosystem norm. citeturn0search1
- Implementation location(s): UNSTATED
- Acceptance criteria: - `DISABLE_TELEMETRY=1` should disable all telemetry, matching the ecosystem norm. citeturn0search1
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0193 F) Telemetry (opt-out)]

#### Task T-108: A final, non-negotiable implementation prompt for a kernel agent to execute Phase 1:
- Implementation location(s): UNSTATED
- Acceptance criteria: A final, non-negotiable implementation prompt for a kernel agent to execute Phase 1:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Studio-Kernel-UiBuild.md [L0060 3) Kernel Phase 1 “Control-Plane” Implementation Prompt]

#### Task T-109: - required markdown deliverables + patch output expectations.
- Implementation location(s): UNSTATED
- Acceptance criteria: - required markdown deliverables + patch output expectations.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Studio-Kernel-UiBuild.md [L0070 4) Codex Task Pack (Phase 1 Control-Plane Registry Consolidation)]

#### Task T-112: The goal is not to copy these products, but to **absorb their strengths as one tier** in a broader, more powerful ecosys
- Implementation location(s): UNSTATED
- Acceptance criteria: The goal is not to copy these products, but to **absorb their strengths as one tier** in a broader, more powerful ecosystem.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Web Agent Layer Integration.md [L0007 Context]

#### Task T-113: ## Objective (non-negotiable outcomes)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## Objective (non-negotiable outcomes)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_SESSION_2026-01-26_shell-ui-browser-capsules.md [L0107 Objective (non-negotiable outcomes)]

#### Task T-114: - Avoid circular deps: **apps/ui must not import from apps/shell**.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Avoid circular deps: **apps/ui must not import from apps/shell**.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_SESSION_2026-01-26_shell-ui-browser-capsules.md [L0116 Hard constraints]

#### Task T-116: ## Verification (must provide proof)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## Verification (must provide proof)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_SESSION_2026-01-26_shell-ui-browser-capsules.md [L0150 Verification (must provide proof)]

#### Task T-117: - `capability` (required)
- Implementation location(s): UNSTATED
- Acceptance criteria: - `capability` (required)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0133 6) Routing Rules (Deterministic Core)]

#### Task T-119: "required": ["name", "kind", "required"],
- Implementation location(s): UNSTATED
- Acceptance criteria: "required": ["name", "kind", "required"],
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0205 /spec/Contracts/SkillSchema.json (Contract)]

#### Task T-120: "required": { "type": "boolean" }
- Implementation location(s): UNSTATED
- Acceptance criteria: "required": { "type": "boolean" }
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0209 /spec/Contracts/SkillSchema.json (Contract)]

#### Task T-121: "required": ["type"],
- Implementation location(s): UNSTATED
- Acceptance criteria: "required": ["type"],
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0217 /spec/Contracts/SkillSchema.json (Contract)]

#### Task T-122: "required": ["id", "priority", "adapter", "runtime_modes"],
- Implementation location(s): UNSTATED
- Acceptance criteria: "required": ["id", "priority", "adapter", "runtime_modes"],
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0228 /spec/Contracts/SkillSchema.json (Contract)]

#### Task T-123: "required": ["safety_level"],
- Implementation location(s): UNSTATED
- Acceptance criteria: "required": ["safety_level"],
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0255 /spec/Contracts/SkillSchema.json (Contract)]

#### Task T-124: > Standard interface each provider adapter must implement.
- Implementation location(s): UNSTATED
- Acceptance criteria: > Standard interface each provider adapter must implement.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0273 /spec/Contracts/ModelProviderAdapter.json (Contract)]

#### Task T-125: "required": ["id", "capabilities", "invoke"],
- Implementation location(s): UNSTATED
- Acceptance criteria: "required": ["id", "capabilities", "invoke"],
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0280 /spec/Contracts/ModelProviderAdapter.json (Contract)]

#### Task T-127: "required": ["mode"],
- Implementation location(s): UNSTATED
- Acceptance criteria: "required": ["mode"],
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0302 /spec/Contracts/ModelProviderAdapter.json (Contract)]

#### Task T-130: required: true
- Implementation location(s): UNSTATED
- Acceptance criteria: required: true
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0445 Example: vision.ocr]

#### Task T-131: required: true
- Implementation location(s): UNSTATED
- Acceptance criteria: required: true
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0472 Example: code.fast]

#### Task T-132: required: false
- Implementation location(s): UNSTATED
- Acceptance criteria: required: false
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Multimodal_Modular_Stack_2026-01-26.md [L0475 Example: code.fast]

#### Task T-133: ## Reliability additions (required for real web variance)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## Reliability additions (required for real web variance)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_221919_BrowserSkill_Artifacts_Extensions.md [L0029 Reliability additions (required for real web variance)]

#### Task T-135: **Invariant:** If the canvas monitor is absent, events are ignored and execution must not fail.
- Implementation location(s): UNSTATED
- Acceptance criteria: **Invariant:** If the canvas monitor is absent, events are ignored and execution must not fail.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_221919_BrowserSkill_Artifacts_Extensions.md [L0097 Artifact viewer topics]

#### Task T-136: To deliver this slice, the minimum required units are:
- Implementation location(s): UNSTATED
- Acceptance criteria: To deliver this slice, the minimum required units are:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_221919_BrowserSkill_Artifacts_Extensions.md [L0125 6) Minimal Implementation Units]

#### Task T-138: The spec asserts Allternit must enforce:
- Implementation location(s): UNSTATED
- Acceptance criteria: The spec asserts Allternit must enforce:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_ElizaOS_Integration.md [L0039 B. Non-Negotiable Allternit Upgrades (Governance Layer)]

#### Task T-139: Lifecycle checkpoints required:
- Implementation location(s): UNSTATED
- Acceptance criteria: Lifecycle checkpoints required:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_ElizaOS_Integration.md [L0060 D. Runtime Control Model (Supervisor/Sub-runtime)]

#### Task T-140: Raw text must not directly trigger actions.
- Implementation location(s): UNSTATED
- Acceptance criteria: Raw text must not directly trigger actions.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_ElizaOS_Integration.md [L0075 F. Event Normalization (No Raw-Text Execution)]

#### Task T-141: Tasks are DAG-based; consensus required for high-risk actions.
- Implementation location(s): UNSTATED
- Acceptance criteria: Tasks are DAG-based; consensus required for high-risk actions.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_ElizaOS_Integration.md [L0088 H. Multi-Agent Orchestration Rules]

#### Task T-143: These primitives are the non-negotiable backbone that make it OS-like:
- Implementation location(s): UNSTATED
- Acceptance criteria: These primitives are the non-negotiable backbone that make it OS-like:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0045 2) The key primitives (your “OS kernel invariants”)]

#### Task T-145: - Each tool declares required capabilities.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Each tool declares required capabilities.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0050 **ToolABI** (Unix-style “syscall interface”)]

#### Task T-147: - Anything you can do in UI should be doable in CLI:
- Implementation location(s): UNSTATED
- Acceptance criteria: - Anything you can do in UI should be doable in CLI:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0096 3.2 CLI parity rule]

#### Task T-148: - CLI and UI must produce the same event semantics.
- Implementation location(s): UNSTATED
- Acceptance criteria: - CLI and UI must produce the same event semantics.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0101 3.2 CLI parity rule]

#### Task T-149: Rule: **No kernel rebuild required** to add a new tool.
- Implementation location(s): UNSTATED
- Acceptance criteria: Rule: **No kernel rebuild required** to add a new tool.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0150 Class B: Extensible tools (dynamic, runtime-discoverable)]

#### Task T-154: Goal: it already feels like an OS.
- Implementation location(s): UNSTATED
- Acceptance criteria: Goal: it already feels like an OS.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0221 MVP-1: Browser-OS shell + CLI + cloud runs (no WebVM execution yet)]

#### Task T-156: > These are the categories we agreed to use; final selection should be pinned as submodules/forks.
- Implementation location(s): UNSTATED
- Acceptance criteria: > These are the categories we agreed to use; final selection should be pinned as submodules/forks.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0250 10) Integration-first: OSS projects we identified to avoid building from scratch]

#### Task T-158: ## 13) Open questions we did not need to resolve yet (but tracked)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## 13) Open questions we did not need to resolve yet (but tracked)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary_2026-01-26_browser_os_cli_capsules.md [L0331 13) Open questions we did not need to resolve yet (but tracked)]

#### Task T-160: 3) Fix tests with a proper harness: TempDir, db path creation, schema init, required FS dirs.
- Implementation location(s): UNSTATED
- Acceptance criteria: 3) Fix tests with a proper harness: TempDir, db path creation, schema init, required FS dirs.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary__Memory_v2_Proof_Gating_and_External_Memory_Systems.md [L0138 Fix tests with a proper harness: TempDir, db path creation, schema init, required FS dirs.]

#### Task T-161: Agents must run it and attach raw output for PASS.
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents must run it and attach raw output for PASS.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary__Memory_v2_Proof_Gating_and_External_Memory_Systems.md [L0147 B) Add a single Proof Gate script]

#### Task T-163: Tasks are DAG-based. Consensus is required for irreversible actions.
- Implementation location(s): UNSTATED
- Acceptance criteria: Tasks are DAG-based. Consensus is required for irreversible actions.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ElizaOS_Allternit_Unified_Integration_Spec.md [L0100 7. Multi-Agent Orchestration]

#### Task T-164: Every action must satisfy:
- Implementation location(s): UNSTATED
- Acceptance criteria: Every action must satisfy:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ElizaOS_Allternit_Unified_Integration_Spec.md [L0106 8. Safety & Constraints]

#### Task T-166: •	schema validation + golden fixtures + doctor must fail when broken
- Implementation location(s): UNSTATED
- Acceptance criteria: •	schema validation + golden fixtures + doctor must fail when broken
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L0063 Strict tool contracts are enforced in CI]

#### Task T-168: ### 1.2 Non-Negotiable Guarantees
- Implementation location(s): UNSTATED
- Acceptance criteria: ### 1.2 Non-Negotiable Guarantees
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L0096 1.2 Non-Negotiable Guarantees]

#### Task T-170: The emerging requirement is:
- Implementation location(s): UNSTATED
- Acceptance criteria: The emerging requirement is:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L0491 1. Problem Statement]

#### Task T-171: Every layer must:
- Implementation location(s): UNSTATED
- Acceptance criteria: Every layer must:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L0630 A3. CLI Behavioral Contract]

#### Task T-172: Every new CLI must ship:
- Implementation location(s): UNSTATED
- Acceptance criteria: Every new CLI must ship:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L0950 F4. Layer Template]

#### Task T-174: | Requirement        | Layered CLI Benefit                |
- Implementation location(s): UNSTATED
- Acceptance criteria: | Requirement        | Layered CLI Benefit                |
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L1057 I2. Why This Works for Agent Swarms]

#### Task T-175: Each task run must pin:
- Implementation location(s): UNSTATED
- Acceptance criteria: Each task run must pin:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L1141 I6. Versioning at Swarm Scale]

#### Task T-176: * latency must be microseconds
- Implementation location(s): UNSTATED
- Acceptance criteria: * latency must be microseconds
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L1213 I10. Strategic Conclusion]

#### Task T-177: * everything must run in‑process
- Implementation location(s): UNSTATED
- Acceptance criteria: * everything must run in‑process
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L1214 I10. Strategic Conclusion]

#### Task T-179: Kernel responsibilities must be strictly limited to:
- Implementation location(s): UNSTATED
- Acceptance criteria: Kernel responsibilities must be strictly limited to:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0051 PAI Kernel Model Adopted]

#### Task T-180: Workflow completion must be a state transition, not convention.
- Implementation location(s): UNSTATED
- Acceptance criteria: Workflow completion must be a state transition, not convention.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0102 Critical Gaps Identified in Current Architecture]

#### Task T-181: Kernel must remain deterministic.
- Implementation location(s): UNSTATED
- Acceptance criteria: Kernel must remain deterministic.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0110 Critical Gaps Identified in Current Architecture]

#### Task T-182: Kernel must freeze:
- Implementation location(s): UNSTATED
- Acceptance criteria: Kernel must freeze:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0145 PAIMM Tier Mapping for Allternit]

#### Task T-183: Dimension	Allternit Today	Required for AS
- Implementation location(s): UNSTATED
- Acceptance criteria: Dimension	Allternit Today	Required for AS
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0199 Six Capability Dimensions Mapping]

#### Task T-184: Allternit must hold the line as:
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit must hold the line as:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0255 Strategic Conclusion]

#### Task T-186: •	✅ Workflows exist and you explicitly include VERIFY as a phase (AG1/AG2 requirement)
- Implementation location(s): UNSTATED
- Acceptance criteria: •	✅ Workflows exist and you explicitly include VERIFY as a phase (AG1/AG2 requirement)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0317 Defines a clear trajectory for turning Allternit into a true PAI Platform OS]

#### Task T-188: Tier-by-tier: what Allternit must implement to “claim” each tier
- Implementation location(s): UNSTATED
- Acceptance criteria: Tier-by-tier: what Allternit must implement to “claim” each tier
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0327 Defines a clear trajectory for turning Allternit into a true PAI Platform OS]

#### Task T-189: 2.	Goal/project model integrated into context packs
- Implementation location(s): UNSTATED
- Acceptance criteria: 2.	Goal/project model integrated into context packs
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0422 Goal/project model integrated into context packs]

#### Task T-190: •	Your kernel must support current→desired as a first-class workflow primitive.
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Your kernel must support current→desired as a first-class workflow primitive.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0444 Continuous monitoring triggers]

#### Task T-192: •	Goal/project/metric context layer
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Goal/project/metric context layer
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0491 Governance around “life-critical” actions and monitoring]

#### Task T-194: All repo-map statements must be grounded in:
- Implementation location(s): UNSTATED
- Acceptance criteria: All repo-map statements must be grounded in:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0021 1) Evidence-Backed Truth]

#### Task T-195: No speculation; unknowns must be labeled with “next file to inspect”.
- Implementation location(s): UNSTATED
- Acceptance criteria: No speculation; unknowns must be labeled with “next file to inspect”.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0024 1) Evidence-Backed Truth]

#### Task T-196: Documentation must include:
- Implementation location(s): UNSTATED
- Acceptance criteria: Documentation must include:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0041 4) Operational Utility > Narrative]

#### Task T-197: # CODEBASE.md Required Structure (Final)
- Implementation location(s): UNSTATED
- Acceptance criteria: # CODEBASE.md Required Structure (Final)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0060 CODEBASE.md Required Structure (Final)]

#### Task T-198: A valid CODEBASE must include:
- Implementation location(s): UNSTATED
- Acceptance criteria: A valid CODEBASE must include:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0076 Validation Gates (Anti-Fluff)]

#### Task T-199: - operational + change-safety requirements that agents must satisfy
- Implementation location(s): UNSTATED
- Acceptance criteria: - operational + change-safety requirements that agents must satisfy
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0093 Intended Use in Allternit]

#### Task T-200: Goals (non-negotiable)
- Implementation location(s): UNSTATED
- Acceptance criteria: Goals (non-negotiable)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0103 Intended Use in Allternit]

#### Task T-201: •	Every claim must be backed by file references (paths) or direct snippets.
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Every claim must be backed by file references (paths) or direct snippets.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0105 Intended Use in Allternit]

#### Task T-202: - Every finding MUST include:
- Implementation location(s): UNSTATED
- Acceptance criteria: - Every finding MUST include:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0131 Global Rules (apply to all agents)]

#### Task T-203: - Output must be structured Markdown sections.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Output must be structured Markdown sections.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0139 Global Rules (apply to all agents)]

#### Task T-204: - invariants (what must always be true)
- Implementation location(s): UNSTATED
- Acceptance criteria: - invariants (what must always be true)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0203 Agent 7 — Core Domains & Business Logic]

#### Task T-206: •	Component graph (Mermaid-like text, but no requirement)
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Component graph (Mermaid-like text, but no requirement)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Repo Documentation Bootstrap.md [L0337 CODEBASE.graph.md (text-only diagrams)]

#### Task T-208: To build this comprehensive platform, we must consider all the major components and stakeholders that will make it viabl
- Implementation location(s): UNSTATED
- Acceptance criteria: To build this comprehensive platform, we must consider all the major components and stakeholders that will make it viable and valuable:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0013 UNHEADED]

#### Task T-209: For technology developers and vendors (robotics manufacturers, software providers, AI model creators), the unified platf
- Implementation location(s): UNSTATED
- Acceptance criteria: For technology developers and vendors (robotics manufacturers, software providers, AI model creators), the unified platform should be friendly and open to integration. They should be able to plug in their products via well-defined APIs and standards, rather than reinventing the wheel for connectivity. An example of this philosophy in action is the emerging robot-agnostic operating systems like Wandelbots NOVA, which connect entire robotics landscapes via open, robust interfaces – allowing new sensors, legacy hardware, or different brands of robots to all hook into one system ￼. Such a platform provides native SDKs (e.g. in common languages like Python or TypeScript) so developers can use familiar tools to control and extend the system ￼.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0017 UNHEADED]

#### Task T-210: Critically, to become a true standard, the platform should be vendor-neutral and open-standard (possibly even open-sourc
- Implementation location(s): UNSTATED
- Acceptance criteria: Critically, to become a true standard, the platform should be vendor-neutral and open-standard (possibly even open-source at its core). This encourages broad adoption. Industry consortia and standards bodies can help here – for example, the OPC Foundation recently introduced a new OPC UA Companion Specification for Identification and Localization that defines a unified data model for spatial information across machines and robots ￼. This kind of standard is foundational for different vendors’ robots to “speak the same language” about location, enabling coordinated interaction in flexible production environments ￼. Incorporating and building upon such standards will reassure vendors that the platform isn’t a closed garden, but rather an inclusive ecosystem aligning with industry-wide norms.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0021 UNHEADED]

#### Task T-211: While developers care about openness, consumers and end-users care about simplicity and reliability. For widespread adop
- Implementation location(s): UNSTATED
- Acceptance criteria: While developers care about openness, consumers and end-users care about simplicity and reliability. For widespread adoption, the unified platform must abstract away complexity and offer easy, possibly one-click setups and GUI-based management tools. The idea is that a user – whether a tech-savvy hobbyist or a busy company manager – can add a new device or deploy a new AI service with minimal hassle, no deep technical fiddling required.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0025 UNHEADED]

#### Task T-215: A concrete use-case of multi-vendor support is fleet management in heterogeneous environments. On a construction site, y
- Implementation location(s): UNSTATED
- Acceptance criteria: A concrete use-case of multi-vendor support is fleet management in heterogeneous environments. On a construction site, you might have robots from multiple manufacturers – drones, Boston Dynamics Spot-like quadrupeds, excavator robots, etc. The platform should provide a central interface to control all of them. In Karelics’ example, their cloud platform allows “seamlessly [controlling] robots from various manufacturers using a friendly, centralized interface” and sharing data like maps and task schedules among them ￼ ￼. We envision the unified platform doing the same, but on an even broader scale and with AI-driven coordination (e.g. an AI planner assigning tasks to the best robot for the job, regardless of make or model).
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0049 UNHEADED]

#### Task T-216: In summary, robotics manufacturers (whether in China or elsewhere) stand to gain because a unifying standard would enlar
- Implementation location(s): UNSTATED
- Acceptance criteria: In summary, robotics manufacturers (whether in China or elsewhere) stand to gain because a unifying standard would enlarge their potential market (their machines could plug into any customer’s system if everyone speaks the same “language”). It also pushes them toward excellence in their niche (since the platform will make it easy to substitute components, each vendor must compete on performance and cost rather than locking customers into an ecosystem). This competitive yet collaborative environment accelerates progress – for instance, Chinese companies have rapidly improved hardware capabilities (like Estun’s heavy-duty arms and SIASUN’s fast welding robots) to meet rising demand ￼ ￼. A platform that can integrate those advanced machines with equally advanced AI guidance will truly unlock their potential.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0051 UNHEADED]

#### Task T-223: Another paradigm is the rise of open-source and decentralized AI. We saw with DeepSeek-R1 that open models can rival clo
- Implementation location(s): UNSTATED
- Acceptance criteria: Another paradigm is the rise of open-source and decentralized AI. We saw with DeepSeek-R1 that open models can rival closed ones ￼. The platform shouldn’t assume all AI comes from a handful of big labs; it should be able to incorporate community-driven models or specialized models fine-tuned for certain industries. This might mean hosting an “App Store” for AI models within the platform, where users can drop in a new model (much like plugins). Containerization and standard model formats (like ONNX or others) will facilitate this.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0081 UNHEADED]

#### Task T-225: •	Modularity and Microservices: The platform should be built from modular components that can be independently updated o
- Implementation location(s): crates/orchestration/workflows/src/lib.rs
- Acceptance criteria: •	Modularity and Microservices: The platform should be built from modular components that can be independently updated or replaced. For example, the AI orchestration engine, the device communication layer, the user interface, etc., are separate services. This way, if a new technology comes along (say a new comms protocol or a new AI model type), that module can be added or swapped without rewriting the whole system. Cloud-native microservice architectures (with containers and orchestration like Kubernetes) are well-suited to this flexibility ￼. In fact, Wandelbots NOVA emphasizes its “cloud-native architecture, lightweight deployment, and Kubernetes-ready backend”, allowing it to run on-premises or in cloud and scale as needed ￼ ￼.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0090 UNHEADED]

#### Task T-226: •	Open Interfaces and APIs: To encourage widespread adoption, all key interfaces should be open or standardized. This in
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Open Interfaces and APIs: To encourage widespread adoption, all key interfaces should be open or standardized. This includes device interfaces (perhaps building on ROS2 for robot APIs, and standard IoT protocols like MQTT or OPC UA for sensor data), and AI model interfaces (using standard ML model serving protocols). Developers should be able to write extensions or custom integrations without reverse-engineering or special licenses. An open plugin system invites community contributions and third-party support, which accelerates the platform’s growth. We already see moves in industry toward open data models (e.g., the OPC UA spatial data model we cited, available free to all ￼).
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0091 UNHEADED]

#### Task T-229: To fully honor your instruction “every single detail… even if over a few files”, the next file(s) should include:
- Implementation location(s): UNSTATED
- Acceptance criteria: To fully honor your instruction “every single detail… even if over a few files”, the next file(s) should include:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0137 UNHEADED]

#### Task T-230: Therefore the platform must be:
- Implementation location(s): UNSTATED
- Acceptance criteria: Therefore the platform must be:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0176 18. Future-Proofing Principle (First Law)]

#### Task T-231: The platform must never ask:
- Implementation location(s): UNSTATED
- Acceptance criteria: The platform must never ask:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0194 Core Insight]

#### Task T-232: It must instead ask:
- Implementation location(s): UNSTATED
- Acceptance criteria: It must instead ask:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0198 Core Insight]

#### Task T-233: > “Which model(s) should solve *this specific sub-task* right now?”
- Implementation location(s): UNSTATED
- Acceptance criteria: > “Which model(s) should solve *this specific sub-task* right now?”
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0200 Core Insight]

#### Task T-234: The platform must:
- Implementation location(s): UNSTATED
- Acceptance criteria: The platform must:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0255 Platform Response]

#### Task T-236: The name must:
- Implementation location(s): UNSTATED
- Acceptance criteria: The name must:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0673 Branding & Naming Implications]

#### Task T-237: Agents must never begin by grepping the repo.
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents must never begin by grepping the repo.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0044 Locked Architectural Principles]

#### Task T-238: CI must fail on divergence.
- Implementation location(s): UNSTATED
- Acceptance criteria: CI must fail on divergence.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0103 Locked Architectural Principles]

#### Task T-239: •	Must expose local AGENT.md
- Implementation location(s): UNSTATED
- Acceptance criteria: •	Must expose local AGENT.md
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0129 Repo Topology Doctrine]

#### Task T-240: goal → code → cli → prompts → agents
- Implementation location(s): UNSTATED
- Acceptance criteria: goal → code → cli → prompts → agents
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0164 Emit acceptance evidence]

#### Task T-241: decision_ladder: [goal, code, cli, prompts, agents]
- Implementation location(s): UNSTATED
- Acceptance criteria: decision_ladder: [goal, code, cli, prompts, agents]
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0185 WIH vNext — Canonical Fields]

#### Task T-242: •	WIH required
- Implementation location(s): UNSTATED
- Acceptance criteria: •	WIH required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0229 Automation & Enforcement Layer]

#### Task T-243: •	CODEBASE refs required
- Implementation location(s): UNSTATED
- Acceptance criteria: •	CODEBASE refs required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0230 Automation & Enforcement Layer]

#### Task T-245: decision_ladder: [goal, code, cli, prompts, agents]
- Implementation location(s): UNSTATED
- Acceptance criteria: decision_ladder: [goal, code, cli, prompts, agents]
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0470 WIH / Beads Front Matter — Deterministic Execution Envelope]

#### Task T-246: • local AGENT.md required
- Implementation location(s): UNSTATED
- Acceptance criteria: • local AGENT.md required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0614 Repo Topology Doctrine]

#### Task T-247: goal → code → cli → prompts → agents
- Implementation location(s): UNSTATED
- Acceptance criteria: goal → code → cli → prompts → agents
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0663 Miessler PAI → Agent Order-of-Operations]

#### Task T-248: Agents must justify dropping to higher entropy layers.
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents must justify dropping to higher entropy layers.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0665 Miessler PAI → Agent Order-of-Operations]

#### Task T-249: • WIH required
- Implementation location(s): UNSTATED
- Acceptance criteria: • WIH required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0679 Enforcement Surfaces]

#### Task T-250: • CODEBASE refs required
- Implementation location(s): UNSTATED
- Acceptance criteria: • CODEBASE refs required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session-Repo Law vNext.md [L0680 Enforcement Surfaces]

#### Task T-251: ## 1) Miessler PAI v2: the “setup” we should mirror (extract + normalization)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## 1) Miessler PAI v2: the “setup” we should mirror (extract + normalization)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0020 1) Miessler PAI v2: the “setup” we should mirror (extract + normalization)]

#### Task T-253: - embeddings/RAG (optional; not required for v1)
- Implementation location(s): UNSTATED
- Acceptance criteria: - embeddings/RAG (optional; not required for v1)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0097 **Context Hydrator**]

#### Task T-254: **Required structure**
- Implementation location(s): UNSTATED
- Acceptance criteria: **Required structure**
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0142 5.1 Skillpack]

#### Task T-255: ### 7.1 Hard enforcement (non-negotiable)
- Implementation location(s): UNSTATED
- Acceptance criteria: ### 7.1 Hard enforcement (non-negotiable)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0213 7.1 Hard enforcement (non-negotiable)]

#### Task T-257: **Goal**: fork repo as `allternit/pai-kernel-reference` and treat it as an upstream “reference kernel”.
- Implementation location(s): UNSTATED
- Acceptance criteria: **Goal**: fork repo as `allternit/pai-kernel-reference` and treat it as an upstream “reference kernel”.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0244 8.3 Fork option (fastest)]

#### Task T-258: **Goal**: implement PAI Kernel natively, and import only content:
- Implementation location(s): UNSTATED
- Acceptance criteria: **Goal**: implement PAI Kernel natively, and import only content:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0260 8.4 Selective transplant (cleaner long-term)]

#### Task T-259: **Key point:** Allternit’s immediate build (2026) should prioritize **CH3 → AG2**, because that is where “kernel + pack
- Implementation location(s): UNSTATED
- Acceptance criteria: **Key point:** Allternit’s immediate build (2026) should prioritize **CH3 → AG2**, because that is where “kernel + packs + hooks + history + deterministic routing” becomes a compounding advantage.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0369 AS3 — “Full DA: continuous advocate + senses + protection”]

#### Task T-261: - hooks must declare permissions
- Implementation location(s): UNSTATED
- Acceptance criteria: - hooks must declare permissions
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0385 10.2 Risk: “Hooks become ungoverned code execution”]

#### Task T-262: These are first-class surfaces and must always follow the grammar.
- Implementation location(s): UNSTATED
- Acceptance criteria: These are first-class surfaces and must always follow the grammar.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Branding/Brand-Allternit.md [L0063 Reserved System Namespaces]

#### Task T-263: All marks must obey:
- Implementation location(s): UNSTATED
- Acceptance criteria: All marks must obey:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Branding/Brand-Allternit.md [L0120 Geometry Constraints]

#### Task T-264: The // must visually imply 2 without breaking URI grammar.
- Implementation location(s): UNSTATED
- Acceptance criteria: The // must visually imply 2 without breaking URI grammar.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Branding/Brand-Allternit.md [L0129 Geometry Constraints]

#### Task T-265: The sigil must always exist in monochrome first before accented versions.
- Implementation location(s): UNSTATED
- Acceptance criteria: The sigil must always exist in monochrome first before accented versions.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Branding/Brand-Allternit.md [L0166 Color System]

#### Task T-266: The identity system must always reinforce:
- Implementation location(s): UNSTATED
- Acceptance criteria: The identity system must always reinforce:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Branding/Brand-Allternit.md [L0226 Brand Positioning Summary]

#### Task T-267: """Handle a hook event (must be idempotent)"""
- Implementation location(s): UNSTATED
- Acceptance criteria: """Handle a hook event (must be idempotent)"""
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Architecture_Documentation.md [L0486 hooks/bus.py]

#### Task T-268: - Every workflow must include verification step
- Implementation location(s): UNSTATED
- Acceptance criteria: - Every workflow must include verification step
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Architecture_Documentation.md [L0669 5. Verification Enforcement]

#### Task T-269: ## 1. Core Philosophy (Non-Negotiable)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## 1. Core Philosophy (Non-Negotiable)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0021 1. Core Philosophy (Non-Negotiable)]

#### Task T-270: ### Required Plan Template
- Implementation location(s): UNSTATED
- Acceptance criteria: ### Required Plan Template
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0046 Required Plan Template]

#### Task T-271: - Goal (1–2 sentences)
- Implementation location(s): UNSTATED
- Acceptance criteria: - Goal (1–2 sentences)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0049 Required Plan Template]

#### Task T-272: - Tests Required
- Implementation location(s): UNSTATED
- Acceptance criteria: - Tests Required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0055 Required Plan Template]

#### Task T-273: Agents must **not**:
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents must **not**:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0066 RULE: Planning ≠ Execution]

#### Task T-274: Agents must choose the **cleaner abstraction**.
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents must choose the **cleaner abstraction**.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0088 RULE: Simplest Correct Shape Wins]

#### Task T-275: If an exception is required, agents must emit:
- Implementation location(s): UNSTATED
- Acceptance criteria: If an exception is required, agents must emit:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0116 RULE: No Rule Disabling Without Justification]

#### Task T-276: Agents must not introduce:
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents must not introduce:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0142 RULE: Tokenized Design Only]

#### Task T-277: All styling and config must map to:
- Implementation location(s): UNSTATED
- Acceptance criteria: All styling and config must map to:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0148 RULE: Tokenized Design Only]

#### Task T-278: Every change must result in one of:
- Implementation location(s): UNSTATED
- Acceptance criteria: Every change must result in one of:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0159 RULE: No Untestable Changes]

#### Task T-279: Agents must assume:
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents must assume:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Guardrails.md [L0179 RULE: Reproducible Contexts]

#### Task T-280: 1.1 Baseline + Deltas (Non-Negotiable)
- Implementation location(s): UNSTATED
- Acceptance criteria: 1.1 Baseline + Deltas (Non-Negotiable)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0031 Core Design Principles]

#### Task T-281: All agents must read from a single canonical pointer that never moves.
- Implementation location(s): UNSTATED
- Acceptance criteria: All agents must read from a single canonical pointer that never moves.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0040 Core Design Principles]

#### Task T-282: Anything worth remembering must become:
- Implementation location(s): UNSTATED
- Acceptance criteria: Anything worth remembering must become:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0045 Core Design Principles]

#### Task T-283: Every project MUST contain this file at root.
- Implementation location(s): UNSTATED
- Acceptance criteria: Every project MUST contain this file at root.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0053 Canonical Source of Truth (/SOT.md)]

#### Task T-284: Every agent output MUST explicitly confirm it loaded /SOT.md.
- Implementation location(s): UNSTATED
- Acceptance criteria: Every agent output MUST explicitly confirm it loaded /SOT.md.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0077 Acceptance & Verification]

#### Task T-285: Required Files
- Implementation location(s): UNSTATED
- Acceptance criteria: Required Files
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0117 /agent Directory (Workflow Law)]

#### Task T-286: Every agent output MUST include:
- Implementation location(s): UNSTATED
- Acceptance criteria: Every agent output MUST include:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0135 /agent Directory (Workflow Law)]

#### Task T-287: 5.    Delta updates required (if any)
- Implementation location(s): UNSTATED
- Acceptance criteria: 5.    Delta updates required (if any)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0140 Delta updates required (if any)]

#### Task T-288: Inputs (Required)
- Implementation location(s): UNSTATED
- Acceptance criteria: Inputs (Required)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0169 Meta Agent Prompt (/agent/META_PROMPT.md)]

#### Task T-289: •    All fixes must be durable
- Implementation location(s): UNSTATED
- Acceptance criteria: •    All fixes must be durable
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0195 Verification method]

#### Task T-290: Every orchestration run MUST:
- Implementation location(s): crates/orchestration/workflows/src/lib.rs
- Acceptance criteria: Every orchestration run MUST:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0231 Boot Sequence (Mandatory)]

#### Task T-291: ## 14. Intent Artifacts (Required Structure)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## 14. Intent Artifacts (Required Structure)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0310 14. Intent Artifacts (Required Structure)]

#### Task T-292: All projects MUST include the following directory: /intent/
- Implementation location(s): UNSTATED
- Acceptance criteria: All projects MUST include the following directory: /intent/
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0312 14. Intent Artifacts (Required Structure)]

#### Task T-293: ### Required Files
- Implementation location(s): UNSTATED
- Acceptance criteria: ### Required Files
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0313 Required Files]

#### Task T-294: Must contain:
- Implementation location(s): UNSTATED
- Acceptance criteria: Must contain:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0318 `/intent/00_Context.md`]

#### Task T-295: If this file is missing or incomplete, agents MUST halt or request clarification.
- Implementation location(s): UNSTATED
- Acceptance criteria: If this file is missing or incomplete, agents MUST halt or request clarification.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0325 `/intent/00_Context.md`]

#### Task T-296: Must contain:
- Implementation location(s): UNSTATED
- Acceptance criteria: Must contain:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0332 `/intent/10_Exploration.md`]

#### Task T-297: Exploration may be messy but must be explicit.
- Implementation location(s): UNSTATED
- Acceptance criteria: Exploration may be messy but must be explicit.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0338 `/intent/10_Exploration.md`]

#### Task T-298: Must contain:
- Implementation location(s): UNSTATED
- Acceptance criteria: Must contain:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0345 `/intent/20_Objectives.md`]

#### Task T-299: All projects MUST include: /plan/
- Implementation location(s): UNSTATED
- Acceptance criteria: All projects MUST include: /plan/
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0357 15. Planning Artifacts (Execution Translation Layer)]

#### Task T-300: ### Required Files
- Implementation location(s): UNSTATED
- Acceptance criteria: ### Required Files
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0359 Required Files]

#### Task T-301: Must contain:
- Implementation location(s): UNSTATED
- Acceptance criteria: Must contain:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0364 `/plan/30_Roadmap.md`]

#### Task T-302: Must contain:
- Implementation location(s): UNSTATED
- Acceptance criteria: Must contain:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0375 `/plan/40_Backlog.md`]

#### Task T-304: Each task file MUST include:
- Implementation location(s): UNSTATED
- Acceptance criteria: Each task file MUST include:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0394 Task Contract Requirements]

#### Task T-305: Each agent MUST:
- Implementation location(s): UNSTATED
- Acceptance criteria: Each agent MUST:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0427 Context Pack Construction Rules]

#### Task T-307: - Required deltas are not declared post-execution
- Implementation location(s): UNSTATED
- Acceptance criteria: - Required deltas are not declared post-execution
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0451 18. Execution Gating Rules (Hard Stops)]

#### Task T-308: Verification MUST update one or more of:
- Implementation location(s): UNSTATED
- Acceptance criteria: Verification MUST update one or more of:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0459 Verification Outputs]

#### Task T-309: If human correction was required:
- Implementation location(s): UNSTATED
- Acceptance criteria: If human correction was required:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0467 Learning Rule]

#### Task T-310: The Meta Agent MUST convert the correction into:
- Implementation location(s): UNSTATED
- Acceptance criteria: The Meta Agent MUST convert the correction into:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/OperatingSystem.md [L0471 Learning Rule]

#### Task T-312: **Change Control:** Append-only via ADR; breaking changes allowed but must be explicit
- Implementation location(s): UNSTATED
- Acceptance criteria: **Change Control:** Append-only via ADR; breaking changes allowed but must be explicit
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0007 Canonical Project Law for Monorepo & Agentic Systems]

#### Task T-313: - **SOFT** — default expectation; deviation must be justified
- Implementation location(s): UNSTATED
- Acceptance criteria: - **SOFT** — default expectation; deviation must be justified
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0034 DEFINITIONS (GLOBAL)]

#### Task T-314: - **OPTIONAL** — allowed, not required
- Implementation location(s): UNSTATED
- Acceptance criteria: - **OPTIONAL** — allowed, not required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0035 DEFINITIONS (GLOBAL)]

#### Task T-315: All assumptions must be explicitly stated or derived from a spec.
- Implementation location(s): UNSTATED
- Acceptance criteria: All assumptions must be explicitly stated or derived from a spec.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0048 LAW-GRD-001 (HARD) — No Silent Assumptions]

#### Task T-316: Backwards compatibility must be explicitly justified.
- Implementation location(s): UNSTATED
- Acceptance criteria: Backwards compatibility must be explicitly justified.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0055 LAW-GRD-003 (HARD) — No Backwards Compatibility by Default]

#### Task T-317: Every meaningful unit of work must begin with a spec or PRD.
- Implementation location(s): UNSTATED
- Acceptance criteria: Every meaningful unit of work must begin with a spec or PRD.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0069 LAW-ORG-001 (HARD) — PRD-First Development]

#### Task T-318: All work must be reducible to explicit commands: inputs, outputs, side effects.
- Implementation location(s): UNSTATED
- Acceptance criteria: All work must be reducible to explicit commands: inputs, outputs, side effects.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0073 LAW-ORG-002 (HARD) — Command-ify Everything]

#### Task T-319: Context must be discoverable, reloadable, reconstructible.
- Implementation location(s): UNSTATED
- Acceptance criteria: Context must be discoverable, reloadable, reconstructible.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0077 LAW-ORG-003 (HARD) — Context Reset Discipline]

#### Task T-322: There must exist a Baseline and explicit Deltas. No mutation of baseline without a delta.
- Implementation location(s): UNSTATED
- Acceptance criteria: There must exist a Baseline and explicit Deltas. No mutation of baseline without a delta.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0091 LAW-META-001 (HARD) — Baseline + Deltas Model]

#### Task T-323: Every system must declare exactly one SOT. Duplicated truth is a defect.
- Implementation location(s): UNSTATED
- Acceptance criteria: Every system must declare exactly one SOT. Duplicated truth is a defect.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0094 LAW-META-002 (HARD) — Single Source of Truth]

#### Task T-324: Agents and tools must load:
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents and tools must load:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0110 LAW-ENF-001 (HARD) — Mandatory Load Order]

#### Task T-326: Enforcement should be automated via lint/spec checks/acceptance tests where possible.
- Implementation location(s): UNSTATED
- Acceptance criteria: Enforcement should be automated via lint/spec checks/acceptance tests where possible.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0121 LAW-ENF-003 (SOFT) — CI & Gatekeeping]

#### Task T-327: Rewrites must preserve history, intent, and traceability.
- Implementation location(s): UNSTATED
- Acceptance criteria: Rewrites must preserve history, intent, and traceability.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/PROJECT_LAW copy.md [L0131 LAW-CHG-002 (HARD) — Append-Only Mentality]

#### Task T-328: Change Control: Append-only via ADR; breaking changes allowed but must be explicit
- Implementation location(s): UNSTATED
- Acceptance criteria: Change Control: Append-only via ADR; breaking changes allowed but must be explicit
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0010 UNHEADED]

#### Task T-329: •    SOFT — default expectation; deviation must be justified
- Implementation location(s): UNSTATED
- Acceptance criteria: •    SOFT — default expectation; deviation must be justified
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0036 UNHEADED]

#### Task T-330: •    OPTIONAL — allowed, not required
- Implementation location(s): UNSTATED
- Acceptance criteria: •    OPTIONAL — allowed, not required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0037 UNHEADED]

#### Task T-331: All assumptions must be explicitly stated or derived from a spec.
- Implementation location(s): UNSTATED
- Acceptance criteria: All assumptions must be explicitly stated or derived from a spec.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0056 UNHEADED]

#### Task T-332: Backwards compatibility must be explicitly justified, never assumed.
- Implementation location(s): UNSTATED
- Acceptance criteria: Backwards compatibility must be explicitly justified, never assumed.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0075 UNHEADED]

#### Task T-333: Every meaningful unit of work must begin with a spec or PRD.
- Implementation location(s): UNSTATED
- Acceptance criteria: Every meaningful unit of work must begin with a spec or PRD.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0105 UNHEADED]

#### Task T-334: All work must be reducible to explicit commands:
- Implementation location(s): UNSTATED
- Acceptance criteria: All work must be reducible to explicit commands:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0113 UNHEADED]

#### Task T-335: Context must be:
- Implementation location(s): UNSTATED
- Acceptance criteria: Context must be:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0124 UNHEADED]

#### Task T-336: Rules, constraints, and logic should be:
- Implementation location(s): UNSTATED
- Acceptance criteria: Rules, constraints, and logic should be:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0135 UNHEADED]

#### Task T-337: Fixes must become:
- Implementation location(s): UNSTATED
- Acceptance criteria: Fixes must become:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0146 UNHEADED]

#### Task T-338: There must exist:
- Implementation location(s): UNSTATED
- Acceptance criteria: There must exist:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0158 UNHEADED]

#### Task T-339: Every system must declare exactly one SOT.
- Implementation location(s): UNSTATED
- Acceptance criteria: Every system must declare exactly one SOT.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0168 UNHEADED]

#### Task T-340: All agent workflows must follow a visible loop:
- Implementation location(s): UNSTATED
- Acceptance criteria: All agent workflows must follow a visible loop:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0186 UNHEADED]

#### Task T-341: Agents and tools must load, in order:
- Implementation location(s): UNSTATED
- Acceptance criteria: Agents and tools must load, in order:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0209 UNHEADED]

#### Task T-342: All actions must be:
- Implementation location(s): UNSTATED
- Acceptance criteria: All actions must be:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0220 Relevant Specs]

#### Task T-343: Where possible, enforcement should be automated via:
- Implementation location(s): UNSTATED
- Acceptance criteria: Where possible, enforcement should be automated via:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0231 Relevant Specs]

#### Task T-344: Rewrites must preserve:
- Implementation location(s): UNSTATED
- Acceptance criteria: Rewrites must preserve:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/Project_Law.md [L0251 Relevant Specs]

#### Task T-346: Required Location:
- Implementation location(s): UNSTATED
- Acceptance criteria: Required Location:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0022 A1. PRD-FIRST DEVELOPMENT (INTENT ANCHOR)]

#### Task T-347: - All tasks must reference PRD sections.
- Implementation location(s): UNSTATED
- Acceptance criteria: - All tasks must reference PRD sections.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0026 A1. PRD-FIRST DEVELOPMENT (INTENT ANCHOR)]

#### Task T-348: - Brownfield projects must maintain a reverse-PRD.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Brownfield projects must maintain a reverse-PRD.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0027 A1. PRD-FIRST DEVELOPMENT (INTENT ANCHOR)]

#### Task T-349: Context must be explicitly loaded, never ambient.
- Implementation location(s): UNSTATED
- Acceptance criteria: Context must be explicitly loaded, never ambient.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0034 A2. MODULAR RULES ARCHITECTURE (CONTEXT ISOLATION)]

#### Task T-350: Required Structure:
- Implementation location(s): UNSTATED
- Acceptance criteria: Required Structure:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0039 A2. MODULAR RULES ARCHITECTURE (CONTEXT ISOLATION)]

#### Task T-351: - Agents must declare loaded context.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Agents must declare loaded context.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0047 A2. MODULAR RULES ARCHITECTURE (CONTEXT ISOLATION)]

#### Task T-352: Required Location:
- Implementation location(s): UNSTATED
- Acceptance criteria: Required Location:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0060 A3. COMMAND-IFY EVERYTHING (DETERMINISM LAYER)]

#### Task T-353: - Instructions repeated twice must be formalized.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Instructions repeated twice must be formalized.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0065 A3. COMMAND-IFY EVERYTHING (DETERMINISM LAYER)]

#### Task T-354: Planning and execution must not share degraded context.
- Implementation location(s): UNSTATED
- Acceptance criteria: Planning and execution must not share degraded context.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0073 A4. CONTEXT RESET (SESSION BOUNDARY LAW)]

#### Task T-355: Every failure must upgrade the system.
- Implementation location(s): UNSTATED
- Acceptance criteria: Every failure must upgrade the system.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0089 A5. SYSTEM EVOLUTION MINDSET (COMPOUNDING LAW)]

#### Task T-356: Required Outcome:
- Implementation location(s): UNSTATED
- Acceptance criteria: Required Outcome:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0094 A5. SYSTEM EVOLUTION MINDSET (COMPOUNDING LAW)]

#### Task T-357: One of the following must be updated:
- Implementation location(s): UNSTATED
- Acceptance criteria: One of the following must be updated:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/_Repo Framework/RepoLaw.md [L0095 A5. SYSTEM EVOLUTION MINDSET (COMPOUNDING LAW)]

#### Task T-359: Chat should remain **human-first** (conversation surface), not overloaded with separate “Direct/Delegate/Review” modes a
- Implementation location(s): UNSTATED
- Acceptance criteria: Chat should remain **human-first** (conversation surface), not overloaded with separate “Direct/Delegate/Review” modes as a primary concept.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_agentops_session_summary.md [L0032 3) Chat Tab Direction]

#### Task T-370: - The existence of versioned prompts indicates prompt/tool contracts shift; Allternit should abstract this via **adapter layer
- Implementation location(s): UNSTATED
- Acceptance criteria: - The existence of versioned prompts indicates prompt/tool contracts shift; Allternit should abstract this via **adapter layers** rather than tightly coupling to one vendor’s prompt stack.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0123 Category C — Claude Code internals, system prompts, and role-separated sub-agent patterns]

#### Task T-371: - Confirms GUI control is a dominant frontier: agents must click, drag, type, and operate complex interfaces.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Confirms GUI control is a dominant frontier: agents must click, drag, type, and operate complex interfaces.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0226 Category I — Native GUI agents and UI interaction research]

#### Task T-372: - Allternit should treat “PRD/Spec-driven loops” as first-class job types.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Allternit should treat “PRD/Spec-driven loops” as first-class job types.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0257 Category K — Autonomous coding loops (“Ralph”) and PRD completion loops]

#### Task T-373: - Allternit should adopt this as a reference point and go further by embedding:
- Implementation location(s): UNSTATED
- Acceptance criteria: - Allternit should adopt this as a reference point and go further by embedding:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0271 Category L — Orchestration terminals and swarms]

#### Task T-375: - Allternit should treat tools as an ecosystem with:
- Implementation location(s): UNSTATED
- Acceptance criteria: - Allternit should treat tools as an ecosystem with:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0290 Category M — Tool search vs tool discovery]

#### Task T-377: - Allternit should consider a “system-level presence” for quick actions and run status.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Allternit should consider a “system-level presence” for quick actions and run status.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0373 Category Q — Menu bar / desktop UX for AI (CodexBar)]

#### Task T-378: These were stated as pillars Allternit should formalize as top-level concepts:
- Implementation location(s): UNSTATED
- Acceptance criteria: These were stated as pillars Allternit should formalize as top-level concepts:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0436 5) Pillars to codify in Allternit (explicitly listed in-session)]

#### Task T-379: - human override required
- Implementation location(s): UNSTATED
- Acceptance criteria: - human override required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0473 Delta: Law Layer — destructive boundary enforcement]

#### Task T-381: The avatar must not “think” or influence agent reasoning directly. It should be a **pure subscriber** to an intent/state
- Implementation location(s): UNSTATED
- Acceptance criteria: The avatar must not “think” or influence agent reasoning directly. It should be a **pure subscriber** to an intent/state bus.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_gizzi-avatar-3d.md [L0030 2) Boundary rule: no feedback loop]

#### Task T-382: - Must be isolated from AGENT Playwright automation surface to avoid tool confusion and stage bounds/render issues.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Must be isolated from AGENT Playwright automation surface to avoid tool confusion and stage bounds/render issues.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_gizzi-avatar-3d.md [L0056 Runtime mode]

#### Task T-383: ## Gaps (Non-Optional Work Still Required)
- Implementation location(s): UNSTATED
- Acceptance criteria: ## Gaps (Non-Optional Work Still Required)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_gizzi-avatar-3d.md [L0069 Gaps (Non-Optional Work Still Required)]

#### Task T-384: - Must define a symbolic affect state (e.g., calm/confident/uncertain/alert) and map it to animation blends.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Must define a symbolic affect state (e.g., calm/confident/uncertain/alert) and map it to animation blends.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_gizzi-avatar-3d.md [L0077 **Emotion/affect abstraction**]

#### Task T-385: - Gizzi should be stylized with consistent geometry, palette, motion constraints.
- Implementation location(s): UNSTATED
- Acceptance criteria: - Gizzi should be stylized with consistent geometry, palette, motion constraints.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_gizzi-avatar-3d.md [L0085 **Avatar identity spec**]

#### Task T-386: - Should Gizzi avatar be:
- Implementation location(s): UNSTATED
- Acceptance criteria: - Should Gizzi avatar be:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_gizzi-avatar-3d.md [L0123 Open Questions (Tracked, Not Blocking)]

#### Task T-387: ## 4) UX Flows Required
- Implementation location(s): UNSTATED
- Acceptance criteria: ## 4) UX Flows Required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_shellui_brain_runtime_ui_e2e.md [L0066 4) UX Flows Required]

#### Task T-391: - aitmpl-like systems often do direct “install/enable”; Allternit must do **import-to-draft then promote**.
- Implementation location(s): UNSTATED
- Acceptance criteria: - aitmpl-like systems often do direct “install/enable”; Allternit must do **import-to-draft then promote**.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_marketplace_registry.md [L0060 UX Target (inspired by aitmpl)]

## Phase 2

### Epic E-005: Skills, Marketplace, and Discovery
- Goal: UNSTATED (derived from requirements below; see task evidence).
- User value: UNSTATED in sessions; inferred from requirement evidence (see tasks).
- Evidence: Derived from session requirement lines (see tasks).
- Codebase anchor: See task components per requirement.
- Dependencies: UNSTATED; derive from session evidence if present.
- Risks: UNSTATED in sessions unless otherwise noted in task evidence.

#### Task T-020: Tool search should not be search but discovery | Nicolay Gerold
- Implementation location(s): UNSTATED
- Acceptance criteria: Tool search should not be search but discovery | Nicolay Gerold
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- External signals and archtectural alignment.md [L0473 Swarm Topology Engine]

#### Task T-055: Allternit’s browser automation should treat **browser-use** as the standard agent browser skill and the dominant “front
- Implementation location(s): crates/kernel/tools-gateway/src/lib.rs
- Acceptance criteria: Allternit’s browser automation should treat **browser-use** as the standard agent browser skill and the dominant “frontier” interface (MCP/CLI callable). Playwright is not a platform API and should not be the recommended integration surface, even if it remains a hidden underlying dependency in some modes.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Browser Control Frontier.md [L0105 8) Final recorded position (verbatim intent, normalized)]

#### Task T-096: - **Minimal, strict skill spec** (frontmatter + required fields + versioning).
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: - **Minimal, strict skill spec** (frontmatter + required fields + versioning).
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0043 What to copy (good engineering primitives)]

#### Task T-098: ### SKILL.md (required) — example frontmatter
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: ### SKILL.md (required) — example frontmatter
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0067 SKILL.md (required) — example frontmatter]

#### Task T-100: 1. Skill MUST contain `SKILL.md`.
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: 1. Skill MUST contain `SKILL.md`.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0172 Skill MUST contain `SKILL.md`.]

#### Task T-102: 3. If `skill.json` exists, `id/version` MUST match SKILL.md.
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: 3. If `skill.json` exists, `id/version` MUST match SKILL.md.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0174 If `skill.json` exists, `id/version` MUST match SKILL.md.]

#### Task T-106: Allternit should implement **multi-source discovery + installation middleware** now (compat + modularity), and delay an
- Implementation location(s): UNSTATED
- Acceptance criteria: Allternit should implement **multi-source discovery + installation middleware** now (compat + modularity), and delay any attempt to “replace” centralized discovery until you have enough distribution and telemetry volume to make ranking meaningful.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Skill_Discovery_Session_2026-01-26.md [L0224 Outcome]

#### Task T-162: - Allternit should represent skills as first-class objects:
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: - Allternit should represent skills as first-class objects:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit_Session_Summary__Skills_Discovery__2026-01-26.md [L0064 B) Architecture implications]

#### Task T-193: •	Allternit today: Basic→Deep (skills + history), but goals must be first-class for AS1/AS2.
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: •	Allternit today: Basic→Deep (skills + history), but goals must be first-class for AS1/AS2.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0507 Context: None → Basic → Deep → Purpose/Goals]

#### Task T-207: Modern enterprises and tech enthusiasts alike are seeking an all-in-one platform that aggregates diverse technologies in
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: Modern enterprises and tech enthusiasts alike are seeking an all-in-one platform that aggregates diverse technologies into a single ecosystem. Imagine a platform where you can update your household robot’s software, install new AI-driven skills to an industrial arm, or chain multiple AI services together – all through one intuitive interface. The goal is to combine technologies that are each robust on their own (advanced robots, powerful AI models, cloud and edge computing) in a way that multiplies their capabilities when working in concert. This synergy is comparable to the concept of the “Smart Factory” in manufacturing, where AI, IoT, and robotics converge to create intelligent, responsive systems ￼ ￼. But here the vision extends beyond the factory floor to every context: home robotics, enterprise automation, and beyond.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0007 UNHEADED]

#### Task T-212: For consumers at home or enterprise users, the platform should offer “app store”-like simplicity. Think of installing a 
- Implementation location(s): crates/capsule-runtime/src/marketplace_routes.rs
- Acceptance criteria: For consumers at home or enterprise users, the platform should offer “app store”-like simplicity. Think of installing a new capability to a robot as easily as installing an app on your smartphone. In fact, platforms like Wandelbots NOVA advertise an integrated App Store for robotics applications, where you can develop once and deploy your robot app across different hardware via containerized modules ￼. The unified platform could host a marketplace of AI skills, drivers, and modules – vetted for compatibility – that users can enable with a click. This approach not only makes life easier for users but also creates a vibrant developer community who can distribute their innovations through the platform.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Session- Ai Software company blue print.md [L0031 UNHEADED]

#### Task T-256: - **AllowList tool registry**: tools must be declared in a pack, with permissions
- Implementation location(s): crates/control/registry/src/lib.rs
- Acceptance criteria: - **AllowList tool registry**: tools must be declared in a pack, with permissions
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0215 7.1 Hard enforcement (non-negotiable)]

#### Task T-260: - required SKILL.md triggers
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: - required SKILL.md triggers
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit_PAI_Kernel_Spec_and_PAIMM_Mapping.md [L0378 10.1 Risk: “Skills become a junk drawer”]

#### Task T-364: **Key principle agreed:** tool discovery + invocation should be **out-of-band** (runner-side), not token-side (prompt).
- Implementation location(s): UNSTATED
- Acceptance criteria: **Key principle agreed:** tool discovery + invocation should be **out-of-band** (runner-side), not token-side (prompt).
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_cli_agents_skills_registry.md [L0066 3.2 Data plane (Runner)]

#### Task T-368: 25. Tool search should not be search but discovery | Nicolay Gerold
- Implementation location(s): UNSTATED
- Acceptance criteria: 25. Tool search should not be search but discovery | Nicolay Gerold
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0032 Tool search should not be search but discovery | Nicolay Gerold]

#### Task T-374: - Tool search should not be search but discovery | Nicolay Gerold
- Implementation location(s): UNSTATED
- Acceptance criteria: - Tool search should not be search but discovery | Nicolay Gerold
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0285 Category M — Tool search vs tool discovery]

#### Task T-376: - Allternit should treat “skills” as:
- Implementation location(s): crates/skills/src/lib.rs
- Acceptance criteria: - Allternit should treat “skills” as:
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_2026-01-26_external-signals_agent-harness_a2ui.md [L0338 Category O — Skills marketplace and capability packaging]

#### Task T-390: **Registry and Marketplace are distinct control-plane concepts but should appear as one UI surface.**
- Implementation location(s): crates/capsule-runtime/src/marketplace_routes.rs
- Acceptance criteria: **Registry and Marketplace are distinct control-plane concepts but should appear as one UI surface.**
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: allternit_session_marketplace_registry.md [L0018 Core Decision]

### Epic E-006: Swarm Orchestration and Multi-Agent Coordination
- Goal: UNSTATED (derived from requirements below; see task evidence).
- User value: UNSTATED in sessions; inferred from requirement evidence (see tasks).
- Evidence: Derived from session requirement lines (see tasks).
- Codebase anchor: See task components per requirement.
- Dependencies: UNSTATED; derive from session evidence if present.
- Risks: UNSTATED in sessions unless otherwise noted in task evidence.

#### Task T-044: Goal: multi-agent coding on a laptop.
- Implementation location(s): UNSTATED
- Acceptance criteria: Goal: multi-agent coding on a laptop.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session-Brain CLI-ShellUI.md [L1482 Strategic Conclusion (Saved)]

#### Task T-173: This section evaluates whether the layered‑CLI topology is **sound at large scale** and **appropriate for multi‑agent sw
- Implementation location(s): crates/orchestration/workflows/src/lib.rs
- Acceptance criteria: This section evaluates whether the layered‑CLI topology is **sound at large scale** and **appropriate for multi‑agent swarms and orchestration**, and what must exist for it to hold.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L1029 PART I — Scalability & Agent‑Swarm Viability]

#### Task T-178: For Allternit’s goal — **agent‑native OS with swarm orchestration** — this is a first‑principles‑aligned architecture.
- Implementation location(s): crates/orchestration/workflows/src/lib.rs
- Acceptance criteria: For Allternit’s goal — **agent‑native OS with swarm orchestration** — this is a first‑principles‑aligned architecture.
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Blueprint-Framing.md [L1216 I10. Strategic Conclusion]

## Phase 3

### Epic E-007: Enterprise Hardening and Compliance
- Goal: UNSTATED (derived from requirements below; see task evidence).
- User value: UNSTATED in sessions; inferred from requirement evidence (see tasks).
- Evidence: Derived from session requirement lines (see tasks).
- Codebase anchor: See task components per requirement.
- Dependencies: UNSTATED; derive from session evidence if present.
- Risks: UNSTATED in sessions unless otherwise noted in task evidence.

#### Task T-023: Guardrails / audit	Required
- Implementation location(s): UNSTATED
- Acceptance criteria: Guardrails / audit	Required
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Allternit Session- NL Shells.md [L0134 Architectural Alignment]

#### Task T-159: ### Proof-gated audit (what “PASS” must require)
- Implementation location(s): UNSTATED
- Acceptance criteria: ### Proof-gated audit (what “PASS” must require)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: ALLTERNIT_Session_Summary__Memory_v2_Proof_Gating_and_External_Memory_Systems.md [L0064 Proof-gated audit (what “PASS” must require)]

#### Task T-187: •	✅ History/audit ledger exists (AG2 requirement if it’s enforced)
- Implementation location(s): UNSTATED
- Acceptance criteria: •	✅ History/audit ledger exists (AG2 requirement if it’s enforced)
- Definition of done: Requirement satisfied as written in acceptance criteria; validate against session evidence.
- Trace links: Framing/Allternit Paimm.md [L0318 Defines a clear trajectory for turning Allternit into a true PAI Platform OS]
