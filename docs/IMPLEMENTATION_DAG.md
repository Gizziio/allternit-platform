# Allternit Implementation DAG (Living Document)

> 🛑 **CRITICAL: INCOMING AGENTS START HERE**
> Before picking up any task or modifying any code, you MUST read the `docs/MASTER_HANDOFF_PROMPT.md`. It contains the exact context, rules, and file pointers required to pick up execution without duplicating work, hallucinating old architecture, or destroying the unified codebase.

**Status:** IN PROGRESS (Drafting Phase)
**Goal:** A directed acyclic graph (DAG) of all tasks and subtasks required to fully implement the Allternit architecture as defined in the documentation.

---

## 🟢 PHASE 0: The "Wrapper" Fast-Path (Option A)
*Goal: Get immediate value by wrapping the existing OpenClaw UI natively in the platform, placing it in the left rail rather than inside Agent Hub.*
- [ ] **TASK 0.1:** Create a new Left Rail item for `GizziClaw` (or `OpenClaw Wrapper`) in `surfaces/allternit-platform/src/shell/rail/rail.config.tsx`.
- [ ] **TASK 0.2:** Create an iframe/webview container component that renders the OpenClaw frontend.
- [ ] **TASK 0.3:** Ensure OpenClaw backend is running and accessible to the platform.

---

## 🔵 PHASE 1: True GizziClaw MVP (Option C)
*Goal: Build the native, 5-layer Allternit agent architecture ("True GizziClaw") and wire it into the Agent Hub.*

### 1.1 Core Logic (The 5 Layers)
- [ ] **TASK 1.1.1:** Implement Layer 1 (Cognitive/Reasoning) in `domains/agent/gizziclaw/src/layers/layer1-cognitive.ts`.
- [ ] **TASK 1.1.2:** Implement Layer 2 (Identity/Persona) in `layer2-identity.ts`.
- [ ] **TASK 1.1.3:** Implement Layer 3 (Governance/Policy) in `layer3-governance.ts`.
- [ ] **TASK 1.1.4:** Implement Layer 4 (Skills) in `layer4-skills.ts`.
- [ ] **TASK 1.1.5:** Implement Layer 5 (Business) in `layer5-business.ts`.

### 1.2 Runtime Integration
- [ ] **TASK 1.2.1:** Wire GizziClaw into the Gizzi-Code runtime (`cmd/gizzi-code/src/runtime/agent/workspace-loader.ts`).
- [ ] **TASK 1.2.2:** Build CLI Bootstrap commands (`allternit agent create`, `bootstrap`, `run`).

### 1.3 UI Integration (Agent Hub)
- [ ] **TASK 1.3.1:** Create React hooks (`useWorkspace`, `useLayers`, `useSkills`) to bind the UI to the GizziClaw state.
- [ ] **TASK 1.3.2:** Build the 5-Layer Visualization panel in the Agent Dashboard.
- [ ] **TASK 1.3.3:** Build the Workspace View in Agent Hub.

---

## 🟣 PHASE 2: Recursive Language Model (RLM) Integration
*Goal: Integrate the Prime Intellect RLMEnv architecture to support long-horizon reasoning and context handling.*

### 2.1 Core RLM Infrastructure
- [ ] **TASK 2.1.1:** Implement the sandboxed Python REPL environment (`RLMEnvironment`) with safety checks.
- [ ] **TASK 2.1.2:** Create the `llm_batch` function for sub-LLM (Helper Model) delegation and orchestration.
- [ ] **TASK 2.1.3:** Build the `ReasoningOrchestrator` to manage root-model planning and sub-model execution.

### 2.2 Memory & Data Integration
- [ ] **TASK 2.2.1:** Connect RLM state persistence to the working memory (Redis/Valkey equivalent in Data Fabric).
- [ ] **TASK 2.2.2:** Integrate RLM episodic memory with PostgreSQL + pgvector (Ars Contexta).
- [ ] **TASK 2.2.3:** Connect RLM entity extraction to the Knowledge Graph in Ars Contexta.

### 2.3 API & Mode Access
- [ ] **TASK 2.3.1:** Add "RLM Mode" to the existing execution modes (`SAFE`, `AUTO`, `PLAN`, `CODE`).
- [ ] **TASK 2.3.2:** Expose RLM capabilities via API endpoints for use by the `routing-gateway`.
- [ ] **TASK 2.3.3:** Test RLM on long-context reasoning benchmarks (e.g., BrowseComp-Plus).

---

## 🟠 PHASE 3: Workflow Blueprints & Connectors
*Goal: Build a system to package, distribute, and execute deterministic agent organizations as "Workflow Blueprints".*

### 3.1 Blueprint Specification & Parser
- [ ] **TASK 3.1.1:** Define the schema for `blueprint.yaml` (Agents, Routines, Scheduling, Approvals, Config).
- [ ] **TASK 3.1.2:** Build a parser/validator for the Blueprint schema ensuring it meets kernel contracts.

### 3.2 CLI Commands (`gizzi blueprints`)
- [ ] **TASK 3.2.1:** Build `gizzi blueprints list` and `ls` commands.
- [ ] **TASK 3.2.2:** Build `gizzi blueprints install` and `uninstall` commands.
- [ ] **TASK 3.2.3:** Build `gizzi blueprints config` and `status` commands.
- [ ] **TASK 3.2.4:** Build `gizzi blueprints run <blueprint> --routine=<name>` command.
- [ ] **TASK 3.2.5:** Build creator commands: `gizzi blueprint init` and `validate`.

### 3.3 Engine Integration
- [ ] **TASK 3.3.1:** Integrate the declarative Blueprint Routines with the existing DAG Workflow Engine (`allternit-agent-orchestration/workflows`).
- [ ] **TASK 3.3.2:** Integrate Blueprint Scheduling with the existing cron systems.
- [ ] **TASK 3.3.3:** Integrate Blueprint Approvals with the Governance Gate (Human-in-the-loop safety checks).

### 3.4 Plugins & Packaging
- [ ] **TASK 3.4.1:** Formalize the Plugin Bundle schema (`cmd/gizzi-code/src/runtime/plugins/builtin/`).
- [ ] **TASK 3.4.2:** Implement Blueprint auto-installation of required Plugin Bundles (e.g., `engineering`, `marketing`).
- [ ] **TASK 3.4.3:** Connect Blueprint Agent Personas directly to `.gizzi/agents/` workspaces.

### 3.5 Connectors & Grounding
- [ ] **TASK 3.5.1:** Formalize the Connector configuration schema (OAuth, API Keys, Webhook Secrets) in `.allternit/connectors/`.
- [ ] **TASK 3.5.2:** Implement Blueprint-level dependency checks for required Connectors (e.g., GitHub, Slack).
- [ ] **TASK 3.5.3:** Build the Connector Event Trigger system (mapping external webhooks to Blueprint Routines).

---

## 🟡 PHASE 4: Task Engine & Execution Parity (Deltas 0001 & 0006)
*Goal: Implement a deterministic task DAG with persistence and resumable environments.*
- [ ] **TASK 4.1:** Implement Task Node lifecycle (PLANNED → READY → RUNNING → COMPLETE/FAILED/BLOCKED).
- [ ] **TASK 4.2:** Enforce `blockedBy` dependencies natively in the scheduler.
- [ ] **TASK 4.3:** Build `/install` semantics to create immutable execution presets (env + scopes + mounts).
- [ ] **TASK 4.4:** Build `/resume` semantics for deterministic rehydration from recorded cursors and receipts.
- [ ] **TASK 4.5:** Implement RunState and BeadsRunState alignment checks.

---

## 🟤 PHASE 5: Security, Canon & Receipts (Deltas 0003 & 0004)
*Goal: Formalize the contract root, enforce security boot gates, and implement the Receipts contract.*
- [ ] **TASK 5.1:** Canonicalize `/spec/Contracts/` and deprecate legacy contract paths.
- [ ] **TASK 5.2:** Enforce Security Boot Gates (remove auth bypass for core routes, forbid direct python `exec`).
- [ ] **TASK 5.3:** Implement the `Receipt.schema.json` contract for all tool and workflow boundaries.
- [ ] **TASK 5.4:** Implement Repo Cartography (RCP-001) for deterministic codebase generation.
- [ ] **TASK 5.5:** Wire CI Gates to enforce law presence, schema validation, and acceptance tests.

---

## 🟢 PHASE 6: Memory Promotion Pipeline (Delta 0002)
*Goal: Implement deterministic memory promotion rules allowing agents to auto-learn safely.*
- [ ] **TASK 6.1:** Formalize memory into 5 strict layers (law, graph, execution, semantic, proposal).
- [ ] **TASK 6.2:** Implement the `Proposal.schema.json` artifact lifecycle.
- [ ] **TASK 6.3:** Implement `PromotionRules.schema.json` with deterministic SOT checks and auto-approve gates.
- [ ] **TASK 6.4:** Restrict RLM policy modulation to semantic, execution, and proposal layers only.

---

## 🔵 PHASE 7: Capsule Runtime & MCP Host (Delta 0005)
*Goal: Build an interactive capsule runtime compatible with MCP Apps and a thin shell overlay.*
- [ ] **TASK 7.1:** Build the Global Thin Shell Overlay (Spotlight-like chat bar) for quick actions.
- [ ] **TASK 7.2:** Implement the Capsule Host to render sandboxed HTML/JS miniapps.
- [ ] **TASK 7.3:** Build the Host↔Capsule Bridge for brokered, policy-gated tool invocations.
- [ ] **TASK 7.4:** Implement the Browser Capsule (hardened WebView) that emits replayable receipts.

---

## 🟣 PHASE 8: OpenCode TUI Fork Integration (Delta 0007)
*Goal: Replace the legacy Rust TUI with a mature, TypeScript-based OpenCode TUI fork and ensure a realtime, no-silence UX.*
- [ ] **TASK 8.1:** Fork and adapt the OpenCode TUI core components.
- [ ] **TASK 8.2:** Build the `@allternit/sdk` TypeScript adapter for the TUI.
- [ ] **TASK 8.3:** Implement TUI compatibility API routes (`api/v1/sessions`, `api/v1/config`) in the Rust gateway.
- [ ] **TASK 8.4:** Wire SSE streams for real-time TUI event synchronization.
- [ ] **TASK 8.5:** Implement Instant Submit Acknowledgment (Time-to-first-visual <= 200ms) and the No-Silence Heartbeat lane (pulse updates every 400-800ms).
- [ ] **TASK 8.6:** Build the Event-First Render Lane (stream phase/tool receipts before long prose).
- [ ] **TASK 8.7:** Implement the Streaming-First Assistant Text Path and Runtime Trace Compaction rules.

---

## 🟤 PHASE 9: Embodiment & Robotics Control Plane (L8)
*Goal: Extend Allternit to control physical hardware (robots, drones, IoT) safely and deterministically.*
- [ ] **TASK 9.1:** Build the Device Identity system (AuthN, capability manifests, safety envelopes).
- [ ] **TASK 9.2:** Implement the Hard-Gated Control Flow (Intent → Policy → Sim → Execution).
- [ ] **TASK 9.3:** Build Device Adapters (ROS2, MQTT, CAN bus) as standardized Skills.
- [ ] **TASK 9.4:** Integrate Simulation/Gym infrastructure (ROS2 Gazebo, MuJoCo) for pre-reality validation.
- [ ] **TASK 9.5:** Implement Foundation Model integrations (VLA, LBMs) for zero-shot hardware control.

---

## ⚪ PHASE 10: Glass UI Component Migration
*Goal: Port the legacy "Glass" UI patterns into the native Allternit platform React components.*
- [ ] **TASK 10.1:** Map and adapt base primitives (`IconButton`, `List`, `Picker`, `Tab`, `DropdownMenu`).
- [ ] **TASK 10.2:** Build the Glass-style `Registry Filter Tabs`.
- [ ] **TASK 10.3:** Build the Glass-style `Agent Card` with install state and badges.
- [ ] **TASK 10.4:** Build the Glass-style `Rule Card` with severity and violation indicators.
- [ ] **TASK 10.5:** Build the Glass-style `Add Agent Dropdown` (Scratch vs. Documents vs. ACP).

---

## 🟤 PHASE 11: MCP Apps Integration
*Goal: Evolve the existing custom "capsule" runtime into a fully spec-compliant MCP Apps host.*
- [ ] **TASK 11.1:** Upgrade the backend MCP bridge to support UI resources (`_meta.ui.resourceUri`, `resources/read`).
- [ ] **TASK 11.2:** Implement the stable MCP Apps handshake (`ui/initialize`, `ui/notifications/initialized`).
- [ ] **TASK 11.3:** Build the Host Sandbox Proxy (ensure host origin and proxy origin differ for security).
- [ ] **TASK 11.4:** Update the frontend MCP client wrapper (`mcp-client.ts`) to mount MCP Apps alongside plain text and A2UI.

---

## 🟢 PHASE 12: Business Strategy & Operations
*Goal: Enforce strict brand guidelines and implement the multi-environment onboarding flow.*
- [ ] **TASK 12.1:** Audit and enforce the "Allternit Brand Authority" guidelines across all UI surfaces (e.g., lowercase `allternit`, `Allternit Protocol`, `a://`, `A://TERNIT`).
- [ ] **TASK 12.2:** Update all NPM packages and Rust crates to use the official `@allternit/` and `allternit-` namespaces.
- [ ] **TASK 12.3:** Implement the 5-option Infrastructure Onboarding Flow (Local Backend, Tunnel URL, SSH Server, Cloud VPS, Remote Desktop).
- [ ] **TASK 12.4:** Build the auto-detection logic for local backend connections (ports 8013, 4096, 3001, 8080).

---

## 🔵 PHASE 13: Computer Use & Desktop Plugin Integration
*Goal: Package the standalone browser and computer automation services into a unified Allternit Plugin, incorporating extensions and add-ins.*
- [ ] **TASK 13.1:** Implement the Computer Use Gateway (Port 8080) as a language-agnostic HTTP REST API for native agent consumption.
- [ ] **TASK 13.2:** Integrate full browser use (goto, click, fill, extract, screenshot, inspect, close) and native desktop use into the unified plugin.
- [ ] **TASK 13.3:** Integrate existing extensions and add-ins (e.g., Office Add-in, Browser Extension) with the Computer Use Plugin.
- [ ] **TASK 13.4:** Wire the plugin's tools into the ToolRegistry for native Agent Runner access.
- [ ] **TASK 13.5:** Implement the Observability Pipeline to generate `timeline.json`, `analysis.json`, and visual GIF replays (`run_xxx.gif`) for all executions.
- [ ] **TASK 13.6:** Enforce the Computer Use Threat Model mitigations (Domain Escape prevention, Auth Leakage isolation, Artifact Exfiltration guards) via the Policy Engine.

---

## 🟣 PHASE 14: Agent Runner System (The Execution Plane)
*Goal: Build the deterministic worker execution loop that reports back to the Rails Control Plane.*
- [ ] **TASK 14.1:** Implement the `ContextPack` seal contract (`pack_id` generation algorithm matching `cp_<sha256_hash>`).
- [ ] **TASK 14.2:** Build the Rails ↔ Runner Bridge (Lease request, claim, and release protocol).
- [ ] **TASK 14.3:** Implement the Worker Manager to spawn, supervise, and timebox worker agents.
- [ ] **TASK 14.4:** Build the `Ralph` Iteration Loop (the core state machine for bounded reasoning).
- [ ] **TASK 14.5:** Enforce the "No Drift" workspace allowlist (runner only writes to `.allternit/runner/`).
- [ ] **TASK 14.6:** Implement the Agent-to-Agent (A2A) Deterministic Review Protocol (Self-Review → Structural → Test → Security → Policy → Merge).
- [ ] **TASK 14.7:** Wire the UI React Hooks (`useThreads`, `useReceipts`, `spawnSession`) to the Execution Plane via the `RuntimeBridge` adapter.
- [ ] **TASK 14.8:** Implement Cowork Runtime Acceptance Tests (Terminal attach/detach, Replay, Worker Crash Recovery).
- [ ] **TASK 14.9:** Implement the Terminal Cowork CLI commands (`gizzi cowork start`, `attach`, `logs`, `approve`, `schedule`).

---

## 🔴 PHASE 15: Production Readiness & Hardening
*Goal: Complete all critical and high-priority operational tasks required for a stable enterprise deployment.*
- [ ] **TASK 15.1:** Standardize Port Configuration using environment variables across all services.
- [ ] **TASK 15.2:** Implement the SQLite Database Migration System (runner, version tracking, rollbacks).
- [ ] **TASK 15.3:** Add consistent `/health`, `/ready`, and `/live` endpoints to all services.
- [ ] **TASK 15.4:** Standardize structured JSON logging across Rust, Python, and TypeScript boundaries.
- [ ] **TASK 15.5:** Implement Graceful Shutdown (SIGTERM/SIGINT handlers) across all nodes.
- [ ] **TASK 15.6:** Complete Security Hardening (JWT auth, WAF configuration, Secret Rotation policy).
- [ ] **TASK 15.7:** Implement monitoring, observability, and compliance tracking (SOC2/GDPR scaffolding).
- [ ] **TASK 15.8:** Implement Multi-Region Swarm Coordination & State Replication (Hot/Warm/Cold paths).
- [ ] **TASK 15.9:** Implement Production Reliability Controls (Circuit breakers, exponential backoff, state checkpoints).
- [ ] **TASK 15.10:** Implement Environment Segregation (`dev`, `staging`, `prod` configurations for models and approvals).
- [ ] **TASK 15.11:** Build Advanced Debugging Tooling (Execution tracing, structured step-through, and replay).
- [ ] **TASK 15.12:** Implement Multi-Tenant Isolation (`domains/tenants/`): strict logical/physical data segregation for SaaS enterprise deployments.
- [ ] **TASK 15.13:** Implement the **Electron Distribution Pipeline**: Automated DMG/EXE/AppImage builds and Apple Developer code-signing for the Desktop release.
- [ ] **TASK 15.14:** Build the **BYOC Tunnel Orchestrator**: Manage the `cloudflared` bridge for secure web-to-local access (platform.allternit.com → user local backend).
- [ ] **TASK 15.15:** Configure the **Cloudflare Multi-Project Suite**: Standardize deployment across the 6 domains (docs, institute, install, platform, etc.).

---

## 🟠 PHASE 16: Brand Identity & UI Aesthetics
*Goal: Systematize the visual identity of the "Architect Monolith" persona.*
- [ ] **TASK 16.1:** Implement the `Persona` component with `variant="gizzi"`.
- [ ] **TASK 16.2:** Enforce the "Obsidian & Sand" palette (Accent: `#D4B08C`, Primary: `#1A1612`) across the UI.
- [ ] **TASK 16.3:** Enforce "Rectilinear Geometry" in component design (no organic shapes, use high-contrast glass borders).
- [ ] **TASK 16.4:** Implement the `ArchitectLogo.tsx` for all assistant visualizations.
- [ ] **TASK 16.5:** Implement the `allternit-identity` Skill (`SKILL.md`) to formally govern assistant persona, tone, and visual guidelines during execution.
- [ ] **TASK 16.6:** Implement the Avatar Motion State Machine as a pure consumer of `ActivityCenter` states (idle, connecting, reconnecting, thinking, streaming, speaking, done, error) with audio-coupling priority.
- [ ] **TASK 16.7:** Implement the Enhanced Floating Orb (Outer glass shell, subtle drop shadow, inner glow ring, animated micro-interactions based on ActivityCenter state).
- [ ] **TASK 16.8:** Implement the Top Navigation Mode Switcher (Chat, Cowork, Code) with glass-elevated background, animated active indicators, and custom Phosphor icons.
- [ ] **TASK 16.9:** Integrate Voice Services (`services/voice/`): Implement the **Swabble** macOS 26 speech hook daemon (Swift 6.2) using native `Speech.framework`.
- [ ] **TASK 16.10:** Implement the **Gizzi Mascot Animation Machine**: Build the 8-state Framer Motion logic (peeking, skimming, popping-up) with 1:1 linear mouse-tracking and audio-responsive leg stepping.
- [ ] **TASK 16.11:** Build `SwabbleKit`: A multi-platform target for wake-word gating (default "clawd") with post-trigger gap detection and audio-coupling priority.

---

## 🟡 PHASE 17: Workspace Isolation & Mode-Specific Sessions
*Goal: Implement strict isolation between Chat, Cowork, and Code modes, including Worktree sandboxing.*
- [ ] **TASK 17.1:** Split the unified Session Store into mode-specific stores (`useChatStore`, `useCoworkStore`, `useCodeModeStore`).
- [ ] **TASK 17.2:** Implement Session Linking (e.g., spawn a Cowork task from a Chat session).
- [ ] **TASK 17.3:** Implement Worktree Isolation (`.allternit/worktrees/<session_id>`) for safe Code Mode edits.
- [ ] **TASK 17.4:** Build the Diff-First Editing pipeline (propose ChangeSet → review → apply via patch bundle).
- [ ] **TASK 17.5:** Implement the Plan → Execute state machine for Cowork mode.

---

## 🟢 PHASE 18: Unified UI (A2UI & GenTabs Implementation)
*Goal: Migrate from imperative UI rendering to a declarative Agent-to-User Interface (A2UI v0.9) protocol using CopilotKit.*
- [ ] **TASK 18.1:** Implement the A2UI v0.9 JSON payload schema (supporting `createSurface` and `surfaceUpdate` directives).
- [ ] **TASK 18.2:** Build the Context Layer (URL Scraper, File Parser) to feed the orchestrator.
- [ ] **TASK 18.3:** Build the A2UI Renderer using `@copilotkit/a2ui-renderer` and define the Allternit Component Catalog (Metric, CodeViewer, RunStatusCard).
- [ ] **TASK 18.4:** Implement dynamic "GenTabs" generation based on LLM intent classification.
- [ ] **TASK 18.5:** Implement the Canvas Protocol: Declarative, non-executing interaction surfaces bound to canonical truth (Journal + artifacts) with explicit risk/provenance encoding.
- [ ] **TASK 18.6:** Implement the Capsule Protocol: Agent-generated, sandboxed mini-app instances enforcing ToolScope, SandboxPolicy, and ProvenanceLinks.
- [ ] **TASK 18.7:** Implement Dynamic Context Discovery (DCD): Progressive context retrieval and window packing (Stages A-D) to replace prompt stuffing.
- [ ] **TASK 18.8:** Implement the Directive/Command Architecture (DCA): The Directive Compiler translating user intent into typed `TaskSpecs` and `CommandSpecs` prior to runtime.
- [ ] **TASK 18.9:** Implement the Universal Text Interface (UTI) Layer: Intent Router, Domain Agent Manifest (`/.well-known/agent.json`), Trust/Consent/Receipts, and Anti-abuse mechanism.
- [ ] **TASK 18.10:** Build the Mini-App Data System Primitive (Ragic-Class): Canonical relational database + auto-generated views (Record, Table, Queue, Dashboard, Wizard, Approval) integrated into the Dynamic UI Shell.
- [ ] **TASK 18.11:** Integrate Vercel AI SDK UI elements (`Message`, `Conversation`, `ToolCall`, `Reasoning`, `Artifact`) mapped to Allternit's glass morphism and sand/nude palette.
- [ ] **TASK 18.12:** Integrate `@json-render/core` and `@json-render/react` for Generative UI: Define Zod-based Component Catalogs (guardrails) and native Allternit registries for Cowork Mode Forms and Agent-Generated UI.
- [ ] **TASK 18.13:** Integrate `@json-render/devtools-react` into the development layout to enable real-time debugging of AI-generated UIs (Spec, State, Actions, Stream, and DOM Picker).
- [ ] **TASK 18.14:** Implement `@json-render/mcp` to expose the generative UI capabilities via the Model Context Protocol to compatible agents (e.g., Claude Code, Cursor).
- [ ] **TASK 18.15:** Implement the Agent Studio Workflow: Auto-fetch agents, build `AgentSelector`, wire to Chat Composer, and map native sessions to selected agents.
- [ ] **TASK 18.16:** Inject the A2UI v0.9 specification and component allowed-list into the `ALLTERNIT_SYSTEM_PROMPT` (Backend Gateway).
- [ ] **TASK 18.17:** Configure CopilotKit as the primary transport layer for streaming A2UI JSON chunks from the gateway to the frontend.

---

## 🔵 PHASE 19: Multi-Agent Communication Layer
*Goal: Build the infrastructure for agents to communicate, ingest external webhooks, and collaborate in rooms.*
- [ ] **TASK 19.1:** Build the Webhook Ingestion Service (GitHub, Discord, Ant Farm normalizers).
- [ ] **TASK 19.2:** Implement Webhook Signature Verification and Allowlisting.
- [ ] **TASK 19.3:** Build the Chat Room multiplexer and Agent-to-Agent (A2A) event bus.
- [ ] **TASK 19.4:** Implement the "Loop Guard" to prevent infinite A2A communication cycles.

---

## 🟣 PHASE 20: Kernel Execution & Sandboxing (L2)
*Goal: Implement the abstract execution drivers and hardened microVM sandboxes for untrusted agent code.*
- [ ] **TASK 20.1:** Build the `ExecutionDriver` interface abstraction (`spawn`, `exec`, `destroy`).
- [ ] **TASK 20.2:** Implement the OS Process Driver prototype for local development and testing.
- [ ] **TASK 20.3:** Implement the Firecracker/Kata MicroVM Driver for hardened, production-grade isolation.
- [ ] **TASK 20.4:** Build the Environment Normalization layer (Devcontainer.json and Nix flake parsers).
- [ ] **TASK 20.5:** Implement the Determinism & Replay Service (ensure all agent executions can be perfectly replayed from their EventEnvelope and ContextBundle).
- [ ] **TASK 20.6:** Enforce strict prohibition of uncontrolled agent-to-agent delegation (all handoffs must route through the Policy Gate).

---

## 📚 PHASE 21: A://INSTITUTE — Content Generation & Review Pipeline
*Goal: Build the system that transforms raw source material into structured learning, hands-on builds, and verified credentials.*
- [ ] **TASK 21.1:** Build the **Generation Service**: Implement the `ingest-source` → `extract-structure` → `generate-course` pipeline for automated draft creation.
- [ ] **TASK 21.2:** Implement the **Review Service**: Build the automated gates for structure, practicality, correctness, and brand voice.
- [ ] **TASK 21.3:** Build the **Credential Service**: Implement the artifact submission intake and automated validation against course rubrics.
- [ ] **TASK 21.4:** Build the **Content API**: REST/GraphQL endpoints for managing the 3-Tier curriculum (CORE, OPS, AGENTS).
- [ ] **TASK 21.5:** Produce the A://Labs "Golden Paths" remixed courses (e.g., `ALABS-CORE-COPILOT`, `ALABS-OPS-N8N`).
- [ ] **TASK 21.6:** Implement the **Build-to-Verify** learner loop: Native code rendering, interactive Jupyter-style playgrounds, and automated artifact outcome checking.
- [ ] **TASK 21.7:** Build the **Secure Learner Environment**: Safe storage and injection of learner API keys (OpenAI, Anthropic, Serper) into tutorial sandboxes.

---

## ⚖️ PHASE 22: System Law & Source of Truth Enforcement
*Goal: Institutionalize the foundational constitutional rules ("Guardrails") and Source of Truth (SOT) extracted from the rescued legacy documentation into active codebase enforcement.*
- [ ] **TASK 22.1:** Implement the "No Silent State Mutation" enforcement (LAW-GRD-002): All state changes must produce an explicit Artifact or Journal receipt.
- [ ] **TASK 22.2:** Implement the "Plan ≠ Execute" state machine (LAW-GRD-004): Strictly isolate reasoning execution from side-effect execution.
- [ ] **TASK 22.3:** Implement the "No Placeholder" CI Scanner (LAW-GRD-009): Block PRs with fake logic unless labeled `PLACEHOLDER_APPROVED` with an expiration date.
- [ ] **TASK 22.4:** Implement the "Journal-First" Truth Model (SOT): Ensure the UI is strictly a projection of the append-only event ledger, not a separate source of state.
- [ ] **TASK 22.5:** Implement the "Canvas Protocol" UI Enforcer (SOT): Forbid ad-hoc UI primitives; force all agent output to map to the canonical 10 view types.
- [ ] **TASK 22.6:** Implement Tool Approval Middleware (AI SDK 6 Pattern): Intercept tool calls, evaluate against `ApprovalPolicy`, and queue destructive actions for Human-in-the-Loop review.

---

## 🗂️ PHASE 23: Documentation Alignment & Final Reorganization
*Goal: Ensure the documentation is continuously updated to reflect the actual state of the codebase and transition the `docs/` folder to its final, unified structure once the implementation gap is closed.*
- [ ] **TASK 23.1:** Rewrite and update the Target Specs (e.g., `SPEC-Subsystem-Kernel.md`, `UNIFIED_UI_IMPLEMENTATION.md`) to explicitly reflect the new design decisions made during the codebase alignment.
- [ ] **TASK 23.2:** Reconcile all "Gaps" identified in the codebase into the official architectural documents, ensuring no divergence between the running code and the source of truth.
- [ ] **TASK 23.3:** Perform the Final Documentation Reorganization: Dissolve the temporary `01-Reality`, `02-Target`, and `03-Gaps` folders into a cohesive, domain-based structure (e.g., `/docs/architecture`, `/docs/api`, `/docs/guides`) once parity is achieved.
- [ ] **TASK 23.4:** Update the `MASTER_INDEX.md` to reflect the final documentation structure and serve as the permanent entry point for developers.

---

## 🧠 PHASE 24: Egregore Shared Intelligence Integration
*Goal: Integrate Egregore's Git-based shared memory and coordination patterns into the Allternit Memory Service as a cold storage / shared sync layer.*
- [ ] **TASK 24.1:** Clone and analyze the Egregore reference architecture (`vendor/egregore`) to extract handoff logic and hook patterns.
- [ ] **TASK 24.2:** Extend the Memory Service Types (`api/services/memory/agent/src/types/memory.types.ts`) and SQLite Store (`api/services/memory/agent/src/store/sqlite-store.ts`) to support a `handoff` status and querying for recent handoffs.
- [ ] **TASK 24.3:** Implement `GitSyncAgent` (`api/services/memory/agent/src/git-sync-agent.ts`) to export insights/handoffs from SQLite to Markdown files in `./memory/` and perform Git commits ("Brain Sync: [Summary]").
- [ ] **TASK 24.4:** Build the Handoff Skill to allow Allternit agents to generate Egregore-style status reports for seamless context transitions.
- [ ] **TASK 24.5:** Inject the Shared Identity/Values (`egregore.md`) into the Allternit Kernel's system prompts.
- [ ] **TASK 24.6:** Update the Allternit CLI to support `allternit handoff` (trigger handoff synthesis & Git sync) and `allternit reflect` (run ConsolidateAgent on recent activity).

---

## 📱 PHASE 25: Ecosystem Parity & Mobile Integration
*Goal: Achieve feature parity with leading agentic platforms (Codex/Expo) by adding native mobile workflow and App Server support.*
- [ ] **TASK 25.1:** Formalize the **JSON-RPC App Server** architecture: Create the integration layer to support alternative frontends and remote clients.
- [ ] **TASK 25.2:** Implement the **Expo MCP Connector**: Build the bridge for Expo package management and EAS build/test operations.
- [ ] **TASK 25.3:** Build the **iOS Simulator Driver** (macOS): Implement XPC signal streaming and frame capture for native agent vision on mobile.
- [ ] **TASK 25.4:** Implement the `/simulator` toolset: Enable agent actions (tap, swipe, inspect-view) against the running iOS simulator.
- [ ] **TASK 25.5:** Build the **Comment Mode Bridge**: Allow DOM-element specific feedback from the UI to be journaled as high-priority reasoning intent.

---

## ⚡ PHASE 26: Intent OS & Task Compiler
*Goal: Abstract the core engine into a "Universal Execution Infrastructure" (Intent OS) that translates plain English intent into executable DAGs automatically.*
- [ ] **TASK 26.1:** Build the **Intent → DAG Generator**: A compiler layer that takes natural language intent and outputs structured WIH (Work In Hand) and DAG execution paths.
- [ ] **TASK 26.2:** Implement **Tool Auto-Mapping**: Automatically map requested tasks in the DAG to the available plugins and tools in the registry.
- [ ] **TASK 26.3:** Build the **Agent Role Generator**: Dynamically assign roles (Planner, Executor, Validator) for the generated DAG workflow.
- [ ] **TASK 26.4:** Implement the **Verification Layer**: Define empirical completion criteria for each generated task to produce enterprise-grade evidence of work.
- [ ] **TASK 26.5:** Develop **Execution Templates** (Layer 3): Create reusable blueprint components for Capture, Schedule, Qualify, Execute Task, Follow-up, and Optimize.
- [ ] **TASK 26.6:** Package **Domain Packs** (Layer 4): Map execution templates to specific industries (e.g., Dentists, HVAC, Logistics) as turn-key products.

---

## 📦 PHASE 27: Blueprint Foundation (Weeks 1-3)
*Goal: Implement the core manifest-based packaging system for shareable workflows.*
- [ ] **TASK 27.1:** Implement the Blueprint Schema (YAML) and JSON Schema Validator.
- [ ] **TASK 27.2:** Build the Blueprint Loader and Dependency Resolver.
- [ ] **TASK 27.3:** Implement the Blueprint Installer: Atomically install agents to `.gizzi/agents/` and register routines with Cowork.
- [ ] **TASK 27.4:** Build the core CLI commands: `gizzi blueprint validate`, `install`, `list`, and `run`.

## 🌐 PHASE 28: Dev/Prod Lifecycle & Versioning (Weeks 4-6)
*Goal: Enable safe promotion and rollbacks for production-grade agent workflows.*
- [ ] **TASK 28.1:** Implement Environment Overrides: Support staging/production specific configs for agents and connectors.
- [ ] **TASK 28.2:** Build the Deployment Pipeline: Commands for `gizzi blueprint deploy` and `promote`.
- [ ] **TASK 28.3:** Implement Git-based Versioning and Rollback: Revert a workspace to a previous blueprint state instantly.

## 📊 PHASE 29: Blueprint Observability & Costs (Weeks 7-9)
*Goal: Achieve the "Debug in < 5 Minutes" milestone.*
- [ ] **TASK 29.1:** Implement Blueprint Tracing: Step-level capture of prompts, responses, and timing.
- [ ] **TASK 29.2:** Build the Cost Tracking Engine: Token usage aggregation and per-run budget alerts.
- [ ] **TASK 29.3:** Implement the Terminal Observability Dashboard: Real-time run status and metrics view.

## 🛡️ PHASE 30: Reliability & Security (Weeks 10-17)
*Goal: Hardening the system for enterprise-scale execution (99.9% uptime).*
- [ ] **TASK 30.1:** Implement Circuit Breakers: State machine to prevent infinite agent loops and cost runaways.
- [ ] **TASK 30.2:** Build State Checkpoints: Enable agents to resume perfectly from a failure point.
- [ ] **TASK 30.3:** Implement RBAC & Secret Rotation: Encrypted storage for connector keys and fine-grained user permissions.

## 🏪 PHASE 31: Registry & Marketplace (Weeks 18-22)
*Goal: Go live with the "npm for agents" public repository.*
- [ ] **TASK 31.1:** Build the GitHub-backed Registry Protocol for publishing and fetching blueprints.
- [ ] **TASK 31.2:** Implement Blueprint Signing and Signature Verification for trusted community content.
- [ ] **TASK 31.3:** Build the Search & Discovery API for the marketplace.

## 🏛️ PHASE 32: Advanced Enterprise & Scale (Weeks 23-28)
*Goal: High Availability and Multi-Tenant scaling for 1000+ concurrent runs.*
- [ ] **TASK 32.1:** Implement Auto-scaling logic and Health Check orchestration.
- [ ] **TASK 32.2:** Implement High Availability (HA) Failover for the control plane.
- [ ] **TASK 32.3:** Implement Advanced Compliance: SOC2/GDPR automated audit trail exports.

---

*(Note: This document provides the comprehensive roadmap for fully realizing the Allternit architecture as specified in the documentation.)*
