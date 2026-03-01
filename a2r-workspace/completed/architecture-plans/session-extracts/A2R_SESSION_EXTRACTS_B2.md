# A2R Session Extracts — Batch 2 (UI / Routing / Repo Law / Remaining)

- Generated: 2026-01-27
- Files processed in this batch: 34

---

## A2rchitech Session Summary — Gizzi Avatar (avatar-3d)
**File:** `a2r-sessions/a2r_session_2026-01-26_gizzi-avatar-3d.md`  
**Size:** 5,494 chars

### Headings
- Context
- Decisions and Positioning
- 1) Role of `avatar-3d` in A2rchitech
- 2) Boundary rule: no feedback loop
- Proposed Integration Design
- Placement in repo
- Runtime mode
- Control Contract (Intent Bus)
- Gaps (Non-Optional Work Still Required)
- A2rchitech Mapping
- A2rchitech Tier / Layer Mapping
- Law Layer / Guardrails Alignment (implicit)

### Key sections
**Decisions and Positioning**
```

```

**Gaps (Non-Optional Work Still Required)**
```
`avatar-3d` alone does **not** provide:

1. **Speech sync (visemes / phonemes)**
   - Need mapping from TTS output timing → mouth shapes (viseme blendshapes) or bone-based jaw/mouth rigs.
   - Requires a TTS engine that can output word/phoneme timestamps, or an approximation layer.

2. **Emotion/affect abstraction**
   - Must define a symbolic affect state (e.g., calm/confident/uncertain/alert) and map it to animation blends.
   - Avoid “emotion = facial expression” naive mapping. Keep it controlled and minimal.

3. **Performance gating**
   - FPS throttling, idle sleep, reduced update loops when minimized, GPU fallback.
   - Deterministic bounds and DPR handling inside Electron (important in A2rchitech due to windowed capsule system).

4. **Avatar identity spec**
   - Gizzi should be stylized with consistent geometry, palette, motion constraints.
   - Decide: GLTF-only vs VRM-only pipeline (VRM often simplifies humanoid + visemes, but adds constraints).
```

**Open Questions (Tracked, Not Blocking)**
```
- Should Gizzi avatar be:
  - a) Always-on sidebar presence, or
  - b) A summonable capsule window (recommended: summonable to reduce GPU load)?
- Do we prioritize:
  - a) stylized minimal face (low uncanny risk), or
  - b) higher realism with visemes (higher engineering + uncanny risk)?
```

### Determinism / enforcement lines
- - Therefore it should be integrated as a **Capsule** that subscribes to agent state, never generating agent decisions.
- The avatar must not “think” or influence agent reasoning directly. It should be a **pure subscriber** to an intent/state bus.
- - The avatar never becomes a control plane.
- This preserves deterministic orchestration and avoids recursion / coupling failures.
- - Must be isolated from AGENT Playwright automation surface to avoid tool confusion and stage bounds/render issues.
- - Must define a symbolic affect state (e.g., calm/confident/uncertain/alert) and map it to animation blends.
- - Deterministic bounds and DPR handling inside Electron (important in A2rchitech due to windowed capsule system).
- - Deterministic intent → animation mapping tests
- - a) Always-on sidebar presence, or

### Bullets
- - https://github.com/0xGF/avatar-3d
- - a2r_session_2026-01-26_gizzi-avatar-3d.md
- - Proposed input repo: `avatar-3d` (Three.js-based 3D avatar rendering / control in browser)
- - Target platform: A2rchitech (Electron shell + capsule system; HUMAN vs AGENT renderer separation)
- - The repo is suitable as a **browser-safe 3D humanoid renderer** (Three.js + glTF/rigged avatar pipeline).
- - It is *not* an “avatar system” for an agent by itself (no cognition, state model, speech sync, identity, or orchestration).
- - Therefore it should be integrated as a **Capsule** that subscribes to agent state, never generating agent decisions.
- - Agent Core emits: intent + speech timing + status
- - Avatar Capsule renders: animation, pose, visemes, idle/thinking/speaking states
- - The avatar never becomes a control plane.
- - **Runs under HUMAN renderer** (Electron BrowserView / UI surface).
- - Subscribes to agent events; does not execute agent tools.
- - Must be isolated from AGENT Playwright automation surface to avoid tool confusion and stage bounds/render issues.
- - idle
- - thinking
- - listening
- - speaking (with intensity + timing hooks)
- - ack

---

## A2rchitech Session Summary — Registry + Marketplace
**File:** `a2r-sessions/a2r_session_marketplace_registry.md`  
**Size:** 4,691 chars

### Headings
- Context
- Core Decision
- Architecture Model (Federated “Asset” System)
- UX Target (inspired by aitmpl)
- Prompts Produced (Agent Commands)
- A) Repo audit prompt (marketplace control plane)
- B) Registry vs Marketplace decision
- C) Agent prompt to build Marketplace UI correctly (A2rchitech)
- D) “Wrong directory” correction prompt (no git)
- Artifacts Saved (Images / Visuals)
- Marketplace Tab Wireframe
- Next Execution Steps (High-confidence)

### Key sections
**Core Decision**
```
**Registry and Marketplace are distinct control-plane concepts but should appear as one UI surface.**

- **Registry (authoritative system of record):** editable, testable, activatable.
- **Marketplace (discovery/import lens):** browse/inspect/import → **draft** only (never direct activation).

Recommended UI: one “Registry” tab with two modes:
- **Registered**
- **Marketplace**

And a strict lifecycle boundary:
**Marketplace Import → Draft (Available) → Registry Review/Test → Activate**
```

**B) Registry vs Marketplace decision**
```
Guidance: keep Registry and Marketplace separate as concepts, unified as one surface with two modes.
```

### Determinism / enforcement lines
- - **Marketplace (discovery/import lens):** browse/inspect/import → **draft** only (never direct activation).
- 2) Marketplace never activates; activation is Registry-only.
- - aitmpl-like systems often do direct “install/enable”; A2rchitech must do **import-to-draft then promote**.

### Bullets
- - a2_marketplace_tab_wireframe.png
- - https://www.aitmpl.com/agents
- - **Registry (authoritative system of record):** editable, testable, activatable.
- - **Marketplace (discovery/import lens):** browse/inspect/import → **draft** only (never direct activation).
- - **Registered**
- - **Marketplace**
- - Skill
- - Tool (MCP/OpenAPI/CLI wrapper)
- - Agent/Persona
- - Prompt
- - Workflow
- - Pack (bundle)
- - **Source adapters** (read-only): GitHub, SkillsMP, MCP registries, prompt hubs, internal catalogs
- - **Resolver**: resolves an asset reference, pins to immutable versions, verifies, caches, returns a pinned asset record
- - **Content-addressed cache**: stores fetched assets by hash/digest for reproducibility + offline
- - **Policy/permissions**: capability-based permissions + trust tiers
- - **Sandbox runner**: executes assets under constrained permissions
- - **Audit/provenance**: logs of tool calls, provenance chain, activation history

---

## A2rchitech Session Summary — 2026-01-26
**File:** `a2r-sessions/A2R Session-Context Engineering - Long Running Agents.md`  
**Size:** 5,017 chars

### Headings
- 1. Session Focus
- 2. Core First-Principles Conclusion
- 3. Observed Industry Patterns (Extracted)
- 3.1 Context Scarcity
- 3.2 “Give Agents a Computer”
- 3.3 Collapsing Tool Explosion
- 3.4 Progressive Disclosure
- 3.5 Filesystem as External Memory
- 3.6 Prompt Caching as a Production Constraint
- 3.7 Context Isolation with Sub-Agents
- 3.8 Evolving Context Over Time
- 3.9 Learned Context Management

### Key sections
**5. Open Research Directions Logged**
```
- Learned retrieval vs manual compaction
- Offline “sleep-time compute”
- Recursive self-management
- Multi-agent conflict resolution protocols
- Standards for observability & debugging

---
```

### Determinism / enforcement lines
- - YAML header always loaded
- - Long-running agents must preserve prefix stability.
- All agents must operate primarily through:
- Prefix stability must be preserved.
- Context rewriting must be deliberate.
- Parallel work always uses:

### Bullets
- - Context as a scarce resource
- - OS-level agent control
- - Filesystem-based memory
- - Progressive disclosure of tools
- - Sub-agent isolation
- - Long-running orchestration loops
- - Learned / evolving agent memory
- - Minimizing token growth
- - Externalizing state
- - Delaying tokenization
- - Isolating interference
- - Amortizing cost through caching
- - Moving expressivity into OS primitives
- - Context windows degrade with size.
- - Tool schemas and traces overload attention budgets.
- - Long-running tasks are growing faster than usable context.
- - Live on a real or virtual OS
- - Use:

---

## A2rchitech Session Summary (A2R) — Browser-OS + CLI + Agentic Runtime (Contracts / Capsules / Tools)
**File:** `a2r-sessions/A2R_Session_Summary_2026-01-26_browser_os_cli_capsules.md`  
**Size:** 11,561 chars

### Headings
- 0) What triggered this session
- 1) Top-level thesis we converged on
- 1.1 The OS is not the UI
- 1.2 The “Browser-OS” is a desktop shell in the browser
- 1.3 The real unifier is Capsule
- 2) The key primitives (your “OS kernel invariants”)
- 3) The product surface: Browser-OS shell + CLI
- 3.1 Modes (the desktop-shell model)
- 3.2 CLI parity rule
- 4) WebVM / Browser-OS angle: what it realistically adds
- 4.1 WebVM is not the product
- 4.2 Digital twins and replay debugger

### Key sections
**6) WASM vs Rust vs Python (decisions and rationale)**
```

```

**8) Decisions we locked to avoid scope explosion**
```
**Ship order:** Cloud runner first  
**Connectivity (v1):** Always-connected  
**Local connector daemon (v1):** Defer

Rationale:
- Cloud runner makes “real work” happen now.
- Offline-first browser shell introduces major complexity (sync, auth, policy offline).
- Local connector daemon expands attack surface (USB/FS/BLE/camera) and should come after policy/verify maturity.

---
```

**13) Open questions we did not need to resolve yet (but tracked)**
```
- Exact UI base fork: Open WebUI vs a Next.js template baseline.
- Exact event storage backing (NATS JetStream vs DB + pubsub).
- Whether to adopt OCI artifacts for capsules immediately or start with tar.zst and migrate.
- When to introduce WASM tool execution (planned after MVP-1/2 once contracts stabilize).
- When to add local connector daemon + capability prompts.

---
```

### Determinism / enforcement lines
- - Tools must be dynamically discoverable at runtime.
- - Each tool declares required capabilities.
- - Must be deterministic and replayable.
- - CLI and UI must produce the same event semantics.
- - **Deterministic replay** of runs (“flight recorder” playback).
- We decided: do **always-connected** for browser shell v1.
- Rule: **No kernel rebuild required** to add a new tool.
- - But: you must **design the ToolABI and capsule schema now** to support WASM later **without refactor**.
- - All calls must be ToolABI mediated, policy checked, and event logged.
- **Connectivity (v1):** Always-connected
- - Capsule build/verify required to run
- 5) New tools must be recognized at runtime without kernel rebuild.

### Bullets
- - cloud web console
- - terminal-first CLI
- - desktop app
- - full operating system
- - The “OS” is the **contract-enforced runtime and governance layer**, not the visual shell.
- - The web console and CLI are **shells / gateways** into the same underlying primitives.
- - “Desktop OS in browser” = a **workspace shell** (ClickUp-like) with panes and modes:
- - **Authoring mode**
- - **Ops mode**
- - **Shell mode** (terminal + assistant)
- - It can embed a terminal and later embed WebVM replay/sandbox as a plugin.
- - **Capsule** becomes the unit of deployment across:
- - cloud runner (ship first)
- - WebVM replay/sandbox (later)
- - edge agents (later)
- - This avoids “ISO images” distribution and matches “web distribution” logic for devices.
- 1. **ToolABI** (Unix-style “syscall interface”)
- - Stable, versioned interface for tools.

---

## A2rchitech Session Summary — ShellUI Brain Runtime + UI Integration + E2E QA
**File:** `a2r-sessions/a2r_session_2026-01-26_shellui_brain_runtime_ui_e2e.md`  
**Size:** 6,249 chars

### Headings
- 1) Product Direction Decision: Fork vs Rebuild
- 2) Core Architecture: “Everything is a Brain Session”
- Key principles
- 3) Backend Capabilities Spec (Brain Gateway + Orchestrator + Router)
- Brain Gateway (single contract to frontend)
- Session Orchestrator
- Model Router (policy engine)
- Capability Registry (OpenRouter-like)
- 4) UX Flows Required
- A) First open / onboarding (Brain Setup Wizard)
- B) Homepage “Run an Agent”
- C) Chat send with no agent selected

### Key sections
**1) Product Direction Decision: Fork vs Rebuild**
```
- Initial idea: fork an OSS chat interface (e.g., LobeChat vs Open WebUI) and wire its functionality into A2rchitech.
- Conclusion: **avoid forking for core product** if proprietary branding + long-term maintainability matter.
  - Use OSS projects as **reference implementations** (UX patterns + feature checklist), but implement capabilities in A2rchitech’s own **Brain Session** contract.
- Reason: reduce licensing/branding constraints, avoid inheriting framework coupling, and keep a stable internal API boundary.

---
```

**Capability Registry (OpenRouter-like)**
```
Per brain profile:
- `type: api|cli|local`
- capability flags (tools, vision, long_context, code, json_mode, fast_stream)
- requirements (api_key, binary_path, model_downloaded, deps)
- install + auth recipes (deep links + scripts)
- healthcheck

---
```

**A) First open / onboarding (Brain Setup Wizard)**
```
- Detect OS + shell + permissions.
- Offer three paths:
  1) Cloud API brain (enter key + test)
  2) Local brain (install runtime/model + test)
  3) CLI brain (install deps + CLI + test)
- Store default brain + fallback chain.
```

### Determinism / enforcement lines
- - Backend emits `brain.required`.
- A deterministic e2e QA prompt was produced to make an agent:

### Bullets
- - Initial idea: fork an OSS chat interface (e.g., LobeChat vs Open WebUI) and wire its functionality into A2rchitech.
- - Conclusion: **avoid forking for core product** if proprietary branding + long-term maintainability matter.
- - Use OSS projects as **reference implementations** (UX patterns + feature checklist), but implement capabilities in A2rchitech’s own **Brain Session** contract.
- - Reason: reduce licensing/branding constraints, avoid inheriting framework coupling, and keep a stable internal API boundary.
- - **Native API adapter**: Claude/Gemini/OpenAI/Qwen, etc.
- - **Local runtime**: Ollama / vLLM / llama.cpp
- - **CLI agent process**: Claude Code, Gemini CLI, Qwen CLI wrapper, Codex CLI (if used)
- - **Single frontend contract**: UI talks only to the Brain Gateway (Responses/OpenResponses-shaped streaming).
- - **Stateful sessions**: kernel moves from one-off calls to resumable, streaming sessions.
- - **Dual-stream UX**:
- - Chat stream = narrative output
- - Console drawer = raw terminal/log stream
- - `POST /v1/sessions`
- - `GET /v1/sessions/:id/events` (SSE)
- - `POST /v1/sessions/:id/input`
- - `GET /v1/brain/profiles`
- - `POST /v1/brain/route`
- - Select runtime type (api/local/cli)

---

## A2rchitech Session Summary — Web Agent Layer Integration
**File:** `a2r-sessions/A2R Session-Web Agent Layer Integration.md`  
**Size:** 5,383 chars

### Headings
- Context
- Reference Platforms (Inspiration, Not Targets)
- Kimi (kimi.com)
- Qwen Chat (chat.qwen.ai)
- MiniMax Agent (agent.minimax.io)
- Claude Bot (Slack / web style)
- What A2rchitech Adds Beyond Them
- Updated Surface Stack (Canonical)
- Cloud Web Agent Layer — Definition
- What it is
- What it does
- What it does NOT do alone

### Bullets
- * Cloud‑hosted conversational agent
- * Strong long‑context handling
- * Clean, fast web UX
- * No OS execution, no SMS entry, no agent identity
- * Web‑native AI interface
- * Tool‑assisted reasoning
- * Multi‑modal support
- * Model‑centric, not execution‑centric
- * Task‑oriented cloud agent
- * Workflow / agent metaphors
- * Still bounded to browser + cloud execution
- * Embedded where users already are (Slack)
- * Strong precedent for **agent inside existing habit surface**
- * Limited execution beyond APIs
- * SMS‑first entry (no install)
- * Messages‑native UI (iMessage extension)
- * App Clip onboarding
- * Local + edge models

---

## A2R Session-Claude-Tasks-Vs-Beads.md
**File:** `a2r-sessions/A2R Session-Claude-Tasks-Vs-Beads.md`  
**Size:** 4,982 chars

### Determinism / enforcement lines
- Install effort	None	Required
- A2rchitech must unify both.

### Bullets
- 1. Problem Being Examined
- 2. Claude Code Tasks — Technical Characterization
- 3. Beads Project — Technical Characterization
- 4. Direct Comparison Matrix
- 5. Key Architectural Insight for A2rchitech
- 6. Strategic Direction for A2rchitech
- 7. Implications for Agent Swarms
- 8. A2rchitech Actionable Design Hooks
- 9. Canonical Terminology Added
- 10. Why This Matters
- 1.	Fast local schedulers
- 2.	Durable distributed cognition
- 11. Tagged for Canonical A2rchitech Thread

---

## A2R Session- NL Shells.md
**File:** `a2r-sessions/A2R Session- NL Shells.md`  
**Size:** 3,919 chars

### Determinism / enforcement lines
- •	Receive deterministic shell plans
- •	Repo Law permissions
- Guardrails / audit	Required

### Bullets
- 1. Core Observation
- 2. What Makes nlsh-Type Tools Distinct
- 3. Why This Is Strategically Important for A2rchitech
- 4. Proposed A2rchitech Integration Pattern
- 5. Architectural Alignment
- 6. Design Direction for A2rchitech
- 7. Candidate Roadmap Slot
- 8. Key Takeaway

---

## A2rchitech Session Summary — AgentOps Extension (A2R)
**File:** `a2r-sessions/a2r_agentops_session_summary.md`  
**Size:** 5,998 chars

### Headings
- 1) UI IA Decision (keep tabs minimal)
- 2) Console as AgentOps Surface (modes inside Console)
- 3) Chat Tab Direction
- 4) Studio Deep Dive (agentic builders + multimodal)
- 5) End-to-End Flow (Browser → Studio → Registry → Console)
- 6) Browser Tab Goals (miniapp capsules + gentabs-like clustering)
- 7) Core Problem: web-only browser not loading pages
- 8) Remote Browser Transport Options (wrapper approach)
- 9) CopilotKit, but proprietary (no Copilot branding)
- 10) WebVM Consideration (Linux WASM VM in repo)
- 11) Required Agent Types for Browser
- 12) Planned Services (implementation gameplan)

### Key sections
**1) UI IA Decision (keep tabs minimal)**
```
**Keep existing essential tabs:**
- Chat
- Console
- Studio (multimodal / ComfyUI / agentic builders)
- Registry
- Marketplace
- Browser (in development)

**No extra “Mission Control” tab list.**  
Any additional complexity must live as **toggle modes within existing tabs**, especially Console and Browser.

---
```

**14) Key Open Decisions / Next Actions**
```
1. Confirm runtime: web-only vs electron/tauri (affects whether streaming is required)
2. Confirm WebVM capability: GUI framebuffer vs headless-only
3. Choose MVP transport: **WebSocket streaming first** vs jumping directly to WebRTC
4. Implement Browser clusters (Option A) with **dynamic AG-UI capsules**:
   - capsules subscribe to streams
   - emit actions/tool calls
   - spawn agents/workflows via Console/Registry definitions

---

**End of session summary.**
```

### Determinism / enforcement lines
- Any additional complexity must live as **toggle modes within existing tabs**, especially Console and Browser.
- Browser must be a **real browsing surface** while supporting:
- A “real browser engine” must render pages, either:
- 1. Confirm runtime: web-only vs electron/tauri (affects whether streaming is required)

### Bullets
- - Chat
- - Console
- - Studio (multimodal / ComfyUI / agentic builders)
- - Registry
- - Marketplace
- - Browser (in development)
- - **Observe:** event/log/trace view (filtered by context)
- - **Command:** terminal + command palette + quick actions (spawn/bind/run)
- - **Visual:** abstract/RTS-like visualization of agent actions (optional)
- - Human → System
- - Human → Agent
- - Human → Workflow Run
- - **Agent Builder** (definitions, permissions, bindings)
- - **Workflow Builder** (DAG, versions, simulate/dry-run)
- - **Multimodal/ComfyUI pipelines** (graphs that produce artifacts + reusable pipeline defs)
- - **Artifacts & Templates** (outputs + reusable defs)
- 1. **Browser**: browse/search; capture page snapshots/clips; cite sources
- 2. **Studio**: convert artifacts into agents/workflows/pipelines

---

## A2rchitech Session Summary — 2026-01-26
**File:** `a2r-sessions/A2R Session-Agent-Governance.md`  
**Size:** 5,017 chars

### Headings
- 1. Session Focus
- 2. Core First-Principles Conclusion
- 3. Observed Industry Patterns (Extracted)
- 3.1 Context Scarcity
- 3.2 “Give Agents a Computer”
- 3.3 Collapsing Tool Explosion
- 3.4 Progressive Disclosure
- 3.5 Filesystem as External Memory
- 3.6 Prompt Caching as a Production Constraint
- 3.7 Context Isolation with Sub-Agents
- 3.8 Evolving Context Over Time
- 3.9 Learned Context Management

### Key sections
**5. Open Research Directions Logged**
```
- Learned retrieval vs manual compaction
- Offline “sleep-time compute”
- Recursive self-management
- Multi-agent conflict resolution protocols
- Standards for observability & debugging

---
```

### Determinism / enforcement lines
- - YAML header always loaded
- - Long-running agents must preserve prefix stability.
- All agents must operate primarily through:
- Prefix stability must be preserved.
- Context rewriting must be deliberate.
- Parallel work always uses:

### Bullets
- - Context as a scarce resource
- - OS-level agent control
- - Filesystem-based memory
- - Progressive disclosure of tools
- - Sub-agent isolation
- - Long-running orchestration loops
- - Learned / evolving agent memory
- - Minimizing token growth
- - Externalizing state
- - Delaying tokenization
- - Isolating interference
- - Amortizing cost through caching
- - Moving expressivity into OS primitives
- - Context windows degrade with size.
- - Tool schemas and traces overload attention budgets.
- - Long-running tasks are growing faster than usable context.
- - Live on a real or virtual OS
- - Use:

---

## A2rchitech Session Summary — Memory Architecture, Proof-Gating, and External Memory Systems
**File:** `a2r-sessions/A2R_Session_Summary__Memory_v2_Proof_Gating_and_External_Memory_Systems.md`  
**Size:** 6,843 chars

### Headings
- 1) Objective of this session
- 2) Key artifacts created / referenced (local)
- Specs & explainers
- Implementation packs (zips)
- 3) Memory v2: what was intended
- Core properties (non-negotiables)
- 4) The critical process breakthrough: proof-gating
- Why it mattered
- Proof-gated audit (what “PASS” must require)
- 5) Results: MEMORY_V2_PROOF_REPORT.md (agent-provided)
- Executive verdict
- Pass/Fail summary

### Key sections
**Proof-gated audit (what “PASS” must require)**
```
- Forbidden-pattern grep (no overwrite semantics / placeholders)
- SQLite schema dumps + index verification
- Minimal repro proving supersession chains (old -> superseded, new row inserted)
- Runtime proof for maintenance daemon (tick logs/metrics)
- `cargo test` proof, with regression traps

---
```

**Gaps discovered (the key takeaway)**
```
1) **Maintenance daemon not actually integrated**  
   - `main.rs` had placeholder spawn text (“would start here”).
2) **No runtime proof instrumentation**  
   - Missing tick logs/metrics to prove daemon execution.
3) **Failing tests**  
   - `Io(NotFound)` suggests missing test directories/schema initialization.
```

**Cognee (open-source)**
```
Stance reached:
- Cognee/Weaviate-style systems are best treated as **memory substrates** (graph/vector + ingestion).
- A2rchitech Memory v2 is the **control plane** (truth semantics, governance, budgets, auditability).
- Therefore, Cognee is a backend candidate under MemoryFabric—not a replacement for TruthEngine/Policy/Routing.

---
```

**8) Decisions and directional stance**
```
1) Proof-gating is mandatory for kernel/memory-critical systems.  
2) External memory engines are **backends**, not authority layers.  
3) A2rchitech’s differentiator is **epistemic memory** (truth maintenance + governance + auditability).

---
```

**A) Close the verified gaps (R3 + R7)**
```
1) Wire `MemoryMaintenanceDaemon` to real `Arc<MemoryFabric>` from AppState; delete placeholder boot code.  
2) Add tick instrumentation + dev/test interval override (env var).  
3) Fix tests with a proper harness: TempDir, db path creation, schema init, required FS dirs.
```

### Determinism / enforcement lines
- 3) Fix tests with a proper harness: TempDir, db path creation, schema init, required FS dirs.
- Agents must run it and attach raw output for PASS.

### Bullets
- - Designing / implementing **Memory v2** with truth maintenance, conflict resolution, decay/maintenance, and graph memory.
- - Establishing a **proof-gated audit process** so “implementation theater” cannot pass.
- - Reevaluating whether external projects (Cognee, Weaviate context-engineering) can replace or augment A2rchitech’s memory stack.
- - Identifying how a workflow plugin (EveryInc compound-engineering-plugin) can improve **meta prompting** and **agent learning loops**.
- - `A2rchitech_Memory_Architecture_Spec.md`
- - `Memory_Structure_Quick_Explainer.md`
- - `a2rchitech_memory_upgrade_pack.zip`
- - `a2rchitech_memory_v2_full.zip`
- - **Truth-preserving writes** (no overwrite truth loss):
- - Supersession chains instead of overwrites
- - `status`, `valid_from`, `valid_to`, `authority`, `confidence`, `supersedes_memory_id`
- - **Conflict resolution** strategies:
- - Temporal shift (job changes, preference changes)
- - Parallel truths (multiple valid contexts)
- - Overwrite-with-archive (preserve history)
- - **Decay + maintenance**:
- - Scheduled consolidation and pruning without deleting “source of truth”
- - Nightly/weekly/monthly maintenance patterns

---

## A2rchitech Session Summary — Studio + Kernel + UI Build Prompts (2026-01-26)
**File:** `a2r-sessions/A2R Session-Studio-Kernel-UiBuild.md`  
**Size:** 5,825 chars

### Headings
- Session Goal
- Key Inputs / Evidence Loaded This Session
- Audit Outputs (Reality + Gaps + Forward Map)
- Frozen Implementation Specs (Derived From Audit)
- Deliverables Produced In-Chat
- 1) Codebase Audit Agent Prompt (Ground-Truth Discovery)
- 2) Post-Audit Planning Agent Prompt (Map Reality → Build Plan)
- 3) Kernel Phase 1 “Control-Plane” Implementation Prompt
- 4) Codex Task Pack (Phase 1 Control-Plane Registry Consolidation)
- 5) Full Studio UI Build Agent Prompt (“Build UI all the way”)
- Notable Decisions Locked This Session
- Next Execution Steps (According To Roadmap)

### Key sections
**Audit Outputs (Reality + Gaps + Forward Map)**
```
- `CODEBASE_REALITY.md` — evidence-based map of repo structure, runtime boundaries, and what Studio actually does vs implies.
- `STUDIO_GAP_MATRIX.md` — explicit Exists/Partial/Missing per Studio capability (UI↔kernel wiring missing; artifacts in-memory; ComfyUI is embed-only; registries fragmented).
- `ARCHITECTURAL_ALIGNMENT.md` — forward mapping: keep primitives, rewire through a single control-plane, unify registries, route execution through policy-gated ToolGateway, persist artifacts via ArtifactRegistry.
```

**Notable Decisions Locked This Session**
```
- Studio UI is not allowed to “imply” capability: all actions must be truth-bound to control-plane endpoints.
- Kernel becomes the single control-plane surface; apps/api workflow routes can be proxied/migrated but Studio must call kernel.
- ToolGateway is the canonical tool registry/executor (policy-gated); ToolExecutor becomes a startup adapter.
- Artifact persistence is mandatory before Artifacts UI claims functionality (Phase 2).

---
```

### Determinism / enforcement lines
- - required markdown deliverables + patch output expectations.
- - Studio UI is not allowed to “imply” capability: all actions must be truth-bound to control-plane endpoints.
- - Kernel becomes the single control-plane surface; apps/api workflow routes can be proxied/migrated but Studio must call kernel.

### Bullets
- - `CODEBASE_REALITY.md` — evidence-based map of repo structure, runtime boundaries, and what Studio actually does vs implies.
- - `STUDIO_GAP_MATRIX.md` — explicit Exists/Partial/Missing per Studio capability (UI↔kernel wiring missing; artifacts in-memory; ComfyUI is embed-only; registries fragmented).
- - `ARCHITECTURAL_ALIGNMENT.md` — forward mapping: keep primitives, rewire through a single control-plane, unify registries, route execution through policy-gated ToolGateway, persist artifacts via ArtifactRegistry.
- - `STUDIO_PRIMITIVES.md` — canonical type decisions:
- - Agent = `AgentSpec` (kernel), Workflow = `WorkflowDefinition` (workflows crate),
- - Tool source-of-truth = ToolGateway `ToolDefinition`,
- - Skill canonical = `crates/skills` `Skill`,
- - Pipeline = `MiniAppManifest`,
- - Artifact persistence = ArtifactRegistry metadata, kernel Artifact transient,
- - Templates = versioned instances of underlying primitives,
- - Sessions/Runs = kernel sessions + workflow executions.
- - `REGISTRY_AND_KERNEL_PLAN.md` — unified control-plane API surface under kernel `/v1/*` for agents/tools/skills/workflows/templates/artifacts; workflows validate/compile can proxy from apps/api until migrated.
- - `EXECUTION_AND_SAFETY_MODEL.md` — single execution path:
- - Intent → ToolGateway (policy-gated) → artifacts captured; ToolExecutor becomes adapter registering local tools into ToolGateway.
- - Workflows execute via WorkflowEngine + SkillRegistry + ToolGateway.
- - `BUILD_ORDER_ROADMAP.md` — dependency-ordered build sequence:
- - map repo topology (UI → API → runtime → storage → external tools),
- - validate the Studio tab reality (Builders/Pipelines/Artifacts/Templates),

---

## A2rchitech Session Summary — Browser Control Frontier (browser-use vs Playwright)
**File:** `a2r-sessions/A2R Session-Browser Control Frontier.md`  
**Size:** 6,632 chars

### Headings
- 1) Core claim under discussion
- 2) What is factually true (important distinctions)
- 2.1 Playwright is not “deprecated” as a framework
- 2.2 browser-use is a strong agent-facing control layer, but often depends on Playwright
- 3) browser-use integration surfaces that match A2rchitech’s tool gateway model
- 3.1 MCP server (cloud HTTP + local stdio)
- 3.2 Existing community MCP wrappers
- 4) Platform decision recorded for A2rchitech (what you want)
- Decision: Browser-first frontier = browser-use skill
- Non-goal (your directive)
- 5) Implementation blueprint (gateway-level)
- 5.1 Tool contract (A2rchitech-facing)

### Key sections
**4) Platform decision recorded for A2rchitech (what you want)**
```

```

**Decision: Browser-first frontier = browser-use skill**
```
- **Canonical “BrowserSkill” for agents is browser-use-based**.
- A2rchitech should treat browser automation as **a tool-callable capability** surfaced via:
  - MCP (preferred for agent ecosystems)
  - CLI wrapper (fallback + local scripting)
```

### Determinism / enforcement lines
- - Multiple sources describe **browser-use running “under the hood” on Playwright** (i.e., Playwright may still be a dependency even if you never author Playwright code).  [oai_citation:2‡Bright Data](https://brightdata.com/blog/ai/browse...
- 5) **Enforce “no Playwright code”**: lint/policy gate in /agent/POLICY.md (A2rchitech repo law layer).

### Bullets
- - The **Playwright framework** remains actively released and maintained (official release notes continue to publish versions).  [oai_citation:0‡Playwright](https://playwright.dev/docs/release-notes?utm_source=chatgpt....
- - What *is* being retired is **Microsoft Playwright Testing** (Azure-hosted testing product), not the Playwright automation framework itself.  [oai_citation:1‡Microsoft Learn](https://learn.microsoft.com/en-us/rest/ap...
- - Multiple sources describe **browser-use running “under the hood” on Playwright** (i.e., Playwright may still be a dependency even if you never author Playwright code).  [oai_citation:2‡Bright Data](https://brightdat...
- - browser-use provides a hosted MCP endpoint: `https://api.browser-use.com/mcp`.  [oai_citation:3‡docs.cloud.browser-use.com](https://docs.cloud.browser-use.com/usage/mcp-server?utm_source=chatgpt.com)
- - It also documents a local stdio MCP mode via `uvx browser-use --mcp`.  [oai_citation:4‡docs.cloud.browser-use.com](https://docs.cloud.browser-use.com/usage/mcp-server?utm_source=chatgpt.com)
- - There are OSS MCP servers that wrap browser-use; some prefer HTTP transport to avoid stdio timeouts on long browser operations.  [oai_citation:5‡GitHub](https://github.com/Saik0s/mcp-browser-use?utm_source=chatgpt.com)
- - **Canonical “BrowserSkill” for agents is browser-use-based**.
- - A2rchitech should treat browser automation as **a tool-callable capability** surfaced via:
- - MCP (preferred for agent ecosystems)
- - CLI wrapper (fallback + local scripting)
- - **Do not build new first-class Playwright automation scripts** as the primary path.
- - If Playwright exists, it should be **an implementation detail**, not an API.
- - `browser.open(url, session?)`
- - `browser.state(session?)` → returns structured clickable targets
- - `browser.click(target, session?)`
- - `browser.type(target, text, session?)`
- - `browser.screenshot(session?)`
- - `browser.close(session?)`

---

## A2rchitech Session — Multimodal Modular Stack (Non‑Frontier)
**File:** `a2r-sessions/A2R_Session_Multimodal_Modular_Stack_2026-01-26.md`  
**Size:** 14,157 chars

### Headings
- 0) Session Intent
- 1) Capability → Model Map (Source of Truth)
- Vision / OCR
- Coding (cheap / throughput)
- Coding (high capability)
- Reasoning
- Writing
- General Purpose
- Image Generation
- Image Editing
- 2) Problem
- 3) Goals / Non‑Goals

### Key sections
**8) Phase 1 — Capability Router (MUST FIRST)**
```
1. **Define request classification schema**
   - inputs: modality, task_type, constraints
   - outputs: capability, tier, artifact_type

2. **Implement routing engine**
   - rules: static map + constraints solver
   - features: provider health checks + fallback

3. **Add cost governor**
   - hard caps: max_cost_usd, max_tokens
   - soft policy: choose cheaper provider when “good enough”

Deliverable:
- `packages/router/*` with unit tests
```

### Determinism / enforcement lines
- 1. Deterministic capability routing (with explicit fallbacks).
- - `capability` (required)
- "required": ["name", "version", "capability", "inputs", "outputs", "providers", "policy"],
- "required": ["name", "kind", "required"],
- "required": { "type": "boolean" }
- "required": ["type"],
- "required": ["id", "priority", "adapter", "runtime_modes"],
- "required": ["safety_level"],
- > Standard interface each provider adapter must implement.
- "required": ["id", "capabilities", "invoke"],
- "required": ["input", "context", "runtime"],
- "required": ["mode"],
- - Given `capability=heavy_code` and `privacy_mode=local_only`, the router must never select a `cloud` runtime.
- - Fix: deterministic rules first; allow LLM classification later as optional.
- required: true
- required: false

### Bullets
- - a2rchitech
- - multimodal-stack
- - skill-registry
- - model-routing
- - Orchestrator
- - Architect
- - Implementer
- - Security
- - "/spec/MultimodalStack.md"
- - "/spec/Contracts/SkillSchema.json"
- - "/spec/Contracts/ModelProviderAdapter.json"
- - "/spec/AcceptanceTests/MultimodalStack.acceptance.md"
- - "/tools/a2r/* (CLI wrappers)"
- - capability-first routing (OCR / coding / reasoning / writing / image gen / image edit)
- - hot-swappable providers
- - artifact-first outputs
- - CLI-first execution (local + remote + cloud)
- - clean contracts for skills + adapters + acceptance tests

---

## A2rchitech Session Summary — Skill Discovery (2026-01-26)
**File:** `a2r-sessions/A2R Session-Skill_Discovery_Session_2026-01-26.md`  
**Size:** 8,086 chars

### Headings
- What makes “one command install” work (first-principles)
- Telemetry (why it works)
- Cloudflare’s decentralized discovery (.well-known RFC)
- Cold recommendation: middleware adapter first, then selectively copy primitives
- What “middleware” means in A2rchitech
- What to copy (good engineering primitives)
- What not to copy early
- Dual discovery model (A2rchitech-aligned)
- A) Skill Package Contract
- Required files
- SKILL.md (required) — example frontmatter
- skill.json (optional) — example

### Key sections
**D) Installer invariants (MUST)**
```
1. Skill MUST contain `SKILL.md`.
2. Frontmatter MUST include: `id`, `name`, `version`, `description`.
3. If `skill.json` exists, `id/version` MUST match SKILL.md.
4. Hashes in `.well-known` index MUST match downloaded content (`sha256`).
5. Installer MUST refuse path traversal in declared files (`..`, absolute paths).
```

### Determinism / enforcement lines
- 1) **Single distribution surface + deterministic command**
- - **Minimal, strict skill spec** (frontmatter + required fields + versioning).
- 1. Skill MUST contain `SKILL.md`.
- 2. Frontmatter MUST include: `id`, `name`, `version`, `description`.
- 3. If `skill.json` exists, `id/version` MUST match SKILL.md.
- 4. Hashes in `.well-known` index MUST match downloaded content (`sha256`).
- 5. Installer MUST refuse path traversal in declared files (`..`, absolute paths).

### Bullets
- - `npx skills add <package>` gives “works anywhere Node exists” ergonomics, no preinstall friction. citeturn0search0turn0search1
- - A skill is a predictable artifact (e.g., `SKILL.md` + metadata). Once the contract is stable, install becomes a mechanical transform: fetch → place → register. citeturn0search0turn0search1
- - The installer detects common agent config paths and picks install destinations automatically (or prompts). Community notes confirm `add-skill` auto-detects many agent locations. citeturn0search9turn0search16
- - `skills.sh` is a directory/leaderboard that enables search/ranking and tracks installs/usage stats across the ecosystem. citeturn0search0turn0search1
- - Telemetry is enabled by default for leaderboard ranking; opt-out is explicit via environment variable (no personal/device info claimed in docs). citeturn0search1
- - **Vercel (centralized):** best global search/ranking/telemetry; value capture via the index network effects. citeturn0search0turn0search1
- - **Cloudflare (decentralized):** publisher-controlled discovery; no single registry gate; harder global ranking unless crawled/aggregated. citeturn0search2
- - **Agent autodetection + per-agent adapters** (no-config install pathing). citeturn0search9turn0search16
- - **Minimal, strict skill spec** (frontmatter + required fields + versioning).
- - **Telemetry with opt-out** to improve reliability + discovery ranking. citeturn0search1
- - A full centralized global directory with leaderboards/ranking as your first move (that’s a compounding product with distribution/network effects).
- - **Default:** decentralized `.well-known` ingestion citeturn0search2
- - **Optional:** curated index (your own), possibly ingesting external public references as sources
- - `central:<namespace>/<skill>`
- - `wellknown:<origin>/<skill-id>`
- - `git:<url>`
- - raw URL/path implies `git|local` based on scheme
- 1. Skill MUST contain `SKILL.md`.

---

## A2R Session-CrewAI.md
**File:** `a2r-sessions/A2R Session-CrewAI.md`  
**Size:** 10,093 chars

### Determinism / enforcement lines
- ✅ Deterministic execution
- •	Tasks must declare expected_output
- •	Output must be structured
- •	Steps must be auditable
- A2R systems must persist state. CrewAI gives you hooks — you add storage.

---

## A2rchitech Session Summary — Shell UI + Electron Browser Capsule + Miniapps
**File:** `a2r-sessions/A2R_SESSION_2026-01-26_shell-ui-browser-capsules.md`  
**Size:** 7,305 chars

### Headings
- 1) Current reality check (what we observed)
- 2) Architecture decisions we converged on
- 2.1 Intent signal (HUMAN vs AGENT)
- 2.2 Render routing ownership
- 3) Work done (what exists in repo, per the agent’s audits)
- 3.1 Host abstraction (Electron)
- 3.2 Windowing system (Shell UI)
- 3.3 Routing cutover
- 4) The persistent blockers (why UI still looks wrong)
- 4.1 Rendering pipeline drift
- 4.2 Electron BrowserView attach/bounds/IPC mismatch
- 4.3 UX not implemented as OS-like windowing

### Key sections
**2) Architecture decisions we converged on**
```

```

**Verification (must provide proof)**
```
- Screenshots: snapped window, minimized-to-dock+restore, tabbed+restore, miniapp floating.
- Console: confirm `window.a2Browser` present; attach/bounds calls succeed with non-zero area.
```

### Determinism / enforcement lines
- - Avoid circular deps: **apps/ui must not import from apps/shell**.
- - Intercept in shell for browser/miniappps; legacy `apps/ui` BrowserView must not render `browser_view`.

### Bullets
- - Electron launches and loads the Shell UI dev server (Vite) correctly.
- - The **browser capsule UI on screen is still the old/incorrect experience** relative to the intended design:
- - Not behaving like a windowed capsule (drag/snap/tab/dock behaviors missing or not wired to visible UI).
- - Browser content not reliably rendering/interactive (BrowserView attach/bounds/IPC issues were repeatedly suspected).
- - The visual chrome we designed (tabs, proper controls, capsule-grade layout) is not showing.
- - We needed an explicit navigation intent to route:
- - **User-initiated navigation → HUMAN** (Electron BrowserView)
- - **Agent-initiated navigation → AGENT** (Playwright stream)
- - Implemented concept: `NavIntent = "user" | "agent"` and action IDs separated.
- - **Do not import shell components into apps/ui** (avoids circular deps).
- - Correct approach: **intercept in shell** before `renderCanvas()` routes to legacy `apps/ui` BrowserView.
- - `apps/shell/src/host/electronBrowserHost.ts`: wrapper around `window.a2Browser` IPC API.
- - `apps/shell/src/host/browserActions.ts`: binds capsule actions to host calls.
- - `apps/shell/src/host/types.ts`: includes NavIntent type.
- - `apps/shell/src/host/electron.d.ts`: window typing.
- - `apps/shell/src/components/windowing/` includes:
- - `WindowManager.tsx`
- - `CapsuleWindowFrame.tsx`

---

## A2R Session- Multimodal Stack.md
**File:** `a2r-sessions/A2R Session- Multimodal Stack.md`  
**Size:** 5,515 chars

### Bullets
- 1.	Capability-first routing
- 2.	Stateless inference + stateful orchestration
- 3.	CLI-first deployment
- 4.	Artifact-first outputs
- 5.	Hot-swappable providers
- - ocr
- - vision_reasoning
- - cheap_code
- - heavy_code
- - reasoning
- - writing
- - general
- - image_gen
- - image_edit
- - low
- - medium
- - high
- - realtime

---

## Canonical Focus
**File:** `a2r-sessions/A2R_Session_Summary_2026-01-26_221919_BrowserSkill_Artifacts_Extensions.md`  
**Size:** 5,032 chars

### Headings
- Minimal API (v1)
- Reliability additions (required for real web variance)
- Standard tool result
- Foreground (interactive)
- Background (headless)
- Artifact (v1)
- Production rules
- Browser topics
- Artifact viewer topics
- Extension (v1)
- Enforcement at dispatch time

### Determinism / enforcement lines
- 3. **Presentation** — canvas + GenTabs + artifact viewer (never panes, empty-by-default)
- BrowserSkill must be executable with the **same contract** across:
- **Invariant:** the **executor changes**, not the tool contract.
- Canvas/GenTabs never render raw tool output; they render by artifact IDs.
- **Invariant:** If the canvas monitor is absent, events are ignored and execution must not fail.
- To deliver this slice, the minimum required units are:

### Bullets
- 1. **Execution** — local + background + parallel (including browser execution)
- 2. **Coordination** — sessions, task graphs, verification gates
- 3. **Presentation** — canvas + GenTabs + artifact viewer (never panes, empty-by-default)
- - `open(url)`
- - `click(selector)`
- - `type(selector, text)`
- - `screenshot()`
- - `waitFor(selector | timeoutMs)`
- - `extract(selector | script)` → DOM snapshot or extracted text
- - `url()` → current URL
- - optional: `html()` and later `networkLog()`
- - `ok` boolean
- - `step_id`
- - `url`
- - `screenshot_artifact_id?`
- - `dom_artifact_id?`
- - `extracted?`
- - `error?` (structured)

---

## A2R Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md
**File:** `a2r-sessions/A2R Session-ShellUI-Browsercapsule-openwork-cliorchestrator-uitars.md`  
**Size:** 7,286 chars

### Determinism / enforcement lines
- •	OpenWork must be integrated as a first-class Shell UI tab/view, not an iframe pointing at the shell Vite port.
- Correct: OpenWork must be a Shell tab/view at 5713, integrated as UI, not a server pointer.
- 3) Required end-state UX (what “done” looks like)
- Capsules must support:
- Browser capsule must include:
- •	Capsule icons must be custom SVG assets (vendor or generated), not emojis.
- 4.2 Display pipeline (must be consistent everywhere)
- 5) CLI “brains” PTY coverage (must include MORE than prior list)
- Each must be supported as:
- 7) Corrective directives that must be reflected in the agent’s execution
- 7.2 Windowing OS behaviors must be real, not stubbed
- 7.3 Icons must be SVG assets (no emojis)
- 7.4 UI-TARS must be executable loop, not “primitives only”
- 8) What “next agent” must do (high-level, ordered)

### Bullets
- 1.	Re-ground OpenWork: integrate local OpenWork code as Shell tab (no server pointer confusion).
- 2.	Finish OS windowing: minimize/tabbing/reopen/snap + state machine in window manager.
- 3.	Complete A2 CLI PTY brains: add PTY spawn/attach/stop/list for all target tools.
- 4.	UI-TARS loop: connect GUI tool execution to a propose/verify cycle.
- 5.	A2UI/AG-UI integration: schema-driven browser chrome + miniapp docking, with agent patch capability.
- 6.	Replace emojis: vendor SVG pipeline + capsule icon registry across shell UI.

---

## A2rchitech Session Summary — Dynamic Context, Retrieval, and Quantization
**File:** `a2r-sessions/A2R Session- Dynamic Context-Retrieval-Quantization.md`  
**Size:** 5,131 chars

### Headings
- 1. Session Goal
- 2. Core Architectural Principle (Agreed)
- 3. Dynamic Context Discovery (DCD)
- 3.1 ContextStore (Kernel Service)
- 3.2 ContextFiles
- 4. Progressive Disclosure Model
- 5. Chat Memory Model (Lossless)
- 6. Retrieval Architecture (Hard-Coded)
- 6.1 Unified Retrieval Gateway
- 7. Hot Retrieval Tier (Default)
- 7.1 Binary + int8 Two-Stage Retrieval
- 8. Cold Retrieval Tier (Optional / Future)

### Determinism / enforcement lines
- into a **single deterministic A2rchitech integration plan**.
- 1. **Raw log (never lost)**
- Summaries must include:
- Agents never choose profiles arbitrarily — policy decides.
- - Always include goals + latest summary + pointers
- - Never include full logs or large JSON
- - Recovery is always possible via files
- - Deterministic agent behavior enforced by policy
- All future A2rchitech research must **map to this structure** or explicitly extend it.

### Bullets
- - Long-lived agent context & memory
- - High-frequency semantic search
- - Large-scale retrieval without fp32 embeddings or GPUs
- - Dynamic Context Discovery (Cursor-style)
- - Binary + int8 scalar quantized retrieval
- - LEANN for extreme-scale, cold corpora
- - All agent-accessible information is stored as **ContextFiles**
- - No large artifact is injected into prompts by default
- - stable ID + URI
- - type (chat_raw, summary, tool_output, terminal_log, doc, skill)
- - size + token estimate
- - provenance (tool / agent / user)
- - tags for retrieval
- - ctx.list
- - ctx.search (lexical / semantic / hybrid)
- - ctx.peek / ctx.tail
- - ctx.read
- - ctx.grep

---

## A2rchitech Session Summary — CLI Agents as a Service + Skill Registry Augmentation
**File:** `a2r-sessions/a2r_session_2026-01-26_cli_agents_skills_registry.md`  
**Size:** 6,326 chars

### Headings
- 1) Objective
- 2) Definitions & Mental Models
- 2.1 “CLI agent as a service”
- 2.2 “Skills = invocable programs with contracts”
- 2.3 Bash tool as universal adapter (gated)
- 3) Architecture: Control Plane vs Data Plane
- 3.1 Control plane (LLM)
- 3.2 Data plane (Runner)
- 4) MCP & “No MCP in context window”
- 5) Augmentation via `vercel-labs/agent-browser`
- 5.1 Why it matters
- 5.2 What we planned to build

### Determinism / enforcement lines
- - Always-on runner (daemon/container/server)
- **Agent never constructs raw shell strings.** It calls named skills with typed args.
- - Skill calls must be typed and policy-gated.
- - Prefer deterministic outputs (JSON modes, adapters/parsers).
- - Default deny network; allowlists for browser domains where required.

### Bullets
- - Agents can run as **services** (job-based runners) rather than interactive, one-off terminal sessions.
- - The platform treats downloaded/installed CLI tools (and MCP-exposed tools) as **typed skills**.
- - The LLM remains a **planner**; execution happens in a **policy-gated runner**.
- - Browser automation is added as a first-class skill via a CLI operator, to augment development workflows (UI verification, scripted repros, evidence capture).
- - Always-on runner (daemon/container/server)
- - Accepts jobs via API / queue / cron
- - Executes tool-based workflows
- - Produces structured results + artifacts + logs/traces
- - Enforces policy constraints (allowed tools, sandbox, network, secrets)
- - CLI tools already provide stable interfaces (args/flags, exit codes).
- - Wrap each tool behind a **Skill Contract**:
- - `name`
- - invocation template
- - input schema
- - output schema (normalized, ideally JSON)
- - safety class (read-only / write / network / privileged)
- - timeouts + resource limits
- - sandbox requirements

---

## A2R Session-AG-UI.md
**File:** `a2r-sessions/A2R Session-AG-UI.md`  
**Size:** 4,998 chars

### Determinism / enforcement lines
- 6. Required A2rchitech Integration Points
- Agents must emit versioned UI definitions:
- Brain registry must include:

### Bullets
- 1. Context
- 2. What AG-UI Is (Extracted + Interpreted)
- 3. Core Properties Relevant to A2rchitech
- 4. AG-UI in the Standards Stack
- 5. Strategic Implications for A2rchitech
- 6. Required A2rchitech Integration Points
- 7. Persistence Rule Confirmed
- 8. Items to Merge into Canonical A2rchitech Buildout
- 9. Net-New Strategic Conclusion

---

## A2R Session- Agent Runtime Brainstorm.md
**File:** `a2r-sessions/A2R Session- Agent Runtime Brainstorm.md`  
**Size:** 3,305 chars

### Determinism / enforcement lines
- 🧠 First-Principles Definition: What an Agent Runtime Must Do
- An agent runtime must satisfy five irreducible functions:
- •	Deterministic replay
- •	Deterministic execution

### Bullets
- 1. Cognition Scheduling
- 2. Tool Execution
- 3. Orchestration
- 4. Isolation & Security
- 5. Observability

---

## A2rchitech Session Summary — Skills Discovery (2026-01-26)
**File:** `a2r-sessions/A2rchitech_Session_Summary__Skills_Discovery__2026-01-26.md`  
**Size:** 4,227 chars

### Headings
- Scope
- Key Concepts Locked In
- 1) “Skills” as portable procedural capability
- 2) Vercel `skills.sh` ecosystem
- 3) Context7 “skills”
- Commands & Artifacts Mentioned
- Context7 CLI usage (as referenced)
- skills.sh mention
- Redirected link: agent-toolkit
- Decisions / Takeaways for A2rchitech
- A) Discovery strategy
- B) Architecture implications

### Key sections
**Key Concepts Locked In**
```

```

**Decisions / Takeaways for A2rchitech**
```

```

**Open Items / Next Build Targets (Skills Discovery)**
```
1. **Provider adapters**
   - Adapter: skills.sh search + install
   - Adapter: Context7 search + fetch docs
   - Adapter: GitHub repo bundle import (SKILL.md discovery)
2. **Skill registry in A2rchitech**
   - local index + provenance + versions + tags
3. **UX**
   - search → preview → install → enable per agent/workspace
4. **Policy**
   - allowlists/denylists; signature or trust scoring; pin versions by default

---
```

### Bullets
- - A *skill* is a reusable, composable **procedure module** for agents (workflows, conventions, step lists, prompts, guardrails).
- - Skills differ from “docs grounding”: skills encode **how to do things** (process), not just information.
- - `skills.sh` is treated as a **centralized, searchable skill directory + install mechanism** (npm-like ergonomics for agent skills).
- - Installation pattern:
- - `npx skills add <owner/repo>` to import a repo of skills into an agent environment.
- - Skills typically live as `SKILL.md` files with structured metadata + instructions.
- - The intended value: fast discovery + one-command install + telemetry-driven ranking.
- - Context7 is positioned as **docs grounding** for agents: “retrieve correct, current docs/examples” to reduce outdated guidance.
- - In skills ecosystems, “Context7 skills” are wrappers that let an agent:
- 1. search for a library/topic,
- 2. pull relevant docs snippets,
- 3. feed them into planning/coding.
- - Important separation:
- - **Context7 = grounding substrate**
- - **skills.sh = procedural capability distribution + install UX**
- - Example pattern:
- - `npx ctx7 skills search "Better Auth"`
- - Claimed characteristics (as referenced):

---

## A2rchitech Session Summary — 2026-01-26
**File:** `a2r-sessions/A2R Session- Agent Runtime Positioning vs xpander.md`  
**Size:** 5,017 chars

### Headings
- 1. Session Focus
- 2. Core First-Principles Conclusion
- 3. Observed Industry Patterns (Extracted)
- 3.1 Context Scarcity
- 3.2 “Give Agents a Computer”
- 3.3 Collapsing Tool Explosion
- 3.4 Progressive Disclosure
- 3.5 Filesystem as External Memory
- 3.6 Prompt Caching as a Production Constraint
- 3.7 Context Isolation with Sub-Agents
- 3.8 Evolving Context Over Time
- 3.9 Learned Context Management

### Key sections
**5. Open Research Directions Logged**
```
- Learned retrieval vs manual compaction
- Offline “sleep-time compute”
- Recursive self-management
- Multi-agent conflict resolution protocols
- Standards for observability & debugging

---
```

### Determinism / enforcement lines
- - YAML header always loaded
- - Long-running agents must preserve prefix stability.
- All agents must operate primarily through:
- Prefix stability must be preserved.
- Context rewriting must be deliberate.
- Parallel work always uses:

### Bullets
- - Context as a scarce resource
- - OS-level agent control
- - Filesystem-based memory
- - Progressive disclosure of tools
- - Sub-agent isolation
- - Long-running orchestration loops
- - Learned / evolving agent memory
- - Minimizing token growth
- - Externalizing state
- - Delaying tokenization
- - Isolating interference
- - Amortizing cost through caching
- - Moving expressivity into OS primitives
- - Context windows degrade with size.
- - Tool schemas and traces overload attention budgets.
- - Long-running tasks are growing faster than usable context.
- - Live on a real or virtual OS
- - Use:

---

## Session Objective
**File:** `a2r-sessions/Framing/A2R Repo Documentation Bootstrap.md`  
**Size:** 11,201 chars

### Headings
- 1) Evidence-Backed Truth
- 2) CODEBASE.md as Canonical Retrieval Anchor
- 3) Parallelism with Context Isolation
- 4) Operational Utility > Narrative
- Target
- Global Rules (apply to all agents)
- Step 1: Launch all agents in parallel (single message)
- Agent 1 — Repo Structure & Entry Points
- Agent 2 — Docs Inventory & Gaps
- Agent 3 — Config & Build System
- Agent 4 — Runtime & Execution Model
- Agent 5 — Data Layer & State

### Key sections
**Repo Law / Architecture Principles Locked In**
```

```

**Agent 2 — Docs Inventory & Gaps**
```
@ explore Find all documentation and evaluate quality.
Deliver:
- doc list with paths + what each doc covers
- missing docs (install/run/test/deploy/architecture)
- any stale docs (mismatch vs code)
Include evidence.
```

### Determinism / enforcement lines
- title: "A2rchitech Session Summary — Architecture / Repo Law"
- topic: architecture-repo-law
- Define a **best-practice repo documentation spec** that reliably produces a canonical `CODEBASE.md` (and optional index/graphs), optimized for agent onboarding, repo navigation, and “repo law” style determinism: evidence-backed claims, s...
- All repo-map statements must be grounded in:
- No speculation; unknowns must be labeled with “next file to inspect”.
- Documentation must include:
- A valid CODEBASE must include:
- This spec becomes part of the “repo law” layer by defining:
- - deterministic doc generation behavior
- - operational + change-safety requirements that agents must satisfy
- •	Every claim must be backed by file references (paths) or direct snippets.
- - Every finding MUST include:
- - Output must be structured Markdown sections.
- - invariants (what must always be true)

### Bullets
- - Launches **10 parallel exploration agents**
- - Enforces **evidence + confidence + unknowns** reporting
- - Synthesizes results into a structured `CODEBASE.md`
- - Optionally emits `CODEBASE.index.md`, `CODEBASE.graph.md`, `DOCS_INDEX.md`
- - file paths (and ideally line ranges/snippets)
- - manifests/configs as “primary sources”
- - “Where is X implemented?”
- - “How does X work end-to-end?”
- - “How do I run/test/deploy?”
- - “What breaks if I change Y?”
- - structured output
- - evidence list
- - confidence rating
- - gaps/unknowns
- - minimal run recipe (2–5 commands)
- - request lifecycle walkthrough
- - interface inventory (API/CLI/UI)
- - deployment/runbook/debug flow

---

## A2rchitech Session Log – Unified AI, Relationship Infrastructure & Robotics Platform (Part 2)
**File:** `a2r-sessions/Framing/A2R Session- Ai Software company blue print.md`  
**Size:** 44,236 chars

### Headings
- 18. Future-Proofing Principle (First Law)
- 19. Multi-Model Routing & Intelligence Fabric
- Core Insight
- Model Routing Layer (MRL)
- Example Flow
- Supported Model Classes
- Strategic Rule
- 20. AI Infrastructure & Data Center Trends
- Observed Reality
- Platform Response
- 21. Edge AI as a First-Class Citizen
- Why Edge Matters

### Determinism / enforcement lines
- To build this comprehensive platform, we must consider all the major components and stakeholders that will make it viable and valuable:
- While developers care about openness, consumers and end-users care about simplicity and reliability. For widespread adoption, the unified platform must abstract away complexity and offer easy, possibly one-click setups and GUI-based mana...
- Any platform aiming to be a global standard for robotics integration must accommodate the full diversity of robotics hardware in the market. This includes industrial arms, mobile robots, drones, service robots, IoT sensors, and more – co...
- In summary, robotics manufacturers (whether in China or elsewhere) stand to gain because a unifying standard would enlarge their potential market (their machines could plug into any customer’s system if everyone speaks the same “language...
- While cloud computing is crucial, the platform must also embrace edge computing, especially for IoT and robotics tasks that require real-time performance or must run offline. Edge AI computing in IoT refers to running AI algorithms local...
- However, simply giving everything an IP isn’t a silver bullet – proper address planning and device management is needed to avoid chaos in large networks ￼ ￼. The platform should implement or integrate IoT device management practices: hie...
- AI is a fast-moving field, and “mainstream models are getting better” at an extraordinary pace. A future-proof platform must be architected with adaptability in mind, so that new paradigms in AI can be integrated with minimal disruption....
- •	Security and Governance: Becoming a standard means users trust the platform. Robust security (end-to-end encryption, authentication for devices/users, fine-grained access control) must be baked in. Additionally, governance mechanisms (...
- •	Continuous Evolution: A future-proof platform must not rest after version 1. It needs a roadmap for continuous improvement, informed by technological advances and user feedback. Regular updates (delivered over-the-air, as mentioned, id...
- Therefore the platform must be:
- The platform must never ask:
- It must instead ask:
- The platform must:
- Law:
- Therefore memory must be:
- The name must:

### Bullets
- * Model-agnostic
- * Hardware-agnostic
- * Cloud-agnostic
- * OS-agnostic
- * Region-agnostic
- * Task decomposition
- * Model capability matching
- * Cost / latency optimization
- * Redundancy & fallback
- * Ensemble execution
- 1. User / Agent submits intent
- 2. Intent decomposed into sub-tasks
- 3. Each sub-task routed to optimal model
- 4. Outputs merged
- 5. Result written back into Relational State
- * Frontier proprietary models (OpenAI, Anthropic, Google)
- * Open models (DeepSeek, LLaMA-class, others)
- * On-device models (edge inference)

---

## node
**File:** `a2r-sessions/Framing/Branding/Brand-A2rchitech.md`  
**Size:** 3,324 chars

### Determinism / enforcement lines
- These are first-class surfaces and must always follow the grammar.
- All marks must obey:
- The // must visually imply 2 without breaking URI grammar.
- Never mix serif fonts into system branding.
- The sigil must always exist in monochrome first before accented versions.
- The identity system must always reinforce:

### Bullets
- 1. Core Identity
- 2. Semantic Model
- 3. Reserved System Namespaces
- 4. Logo Usage Rules
- 5. Geometry Constraints
- 6. Typography System
- 7. Color System
- 8. Motion Grammar
- 9. Symbolic Primitive Layer (Optional UI System)
- *	agent
- 10. Brand Positioning Summary
- 11. Lock Statement

---

## PROJECT_LAW
**File:** `a2r-sessions/Framing/_Repo Framework/PROJECT_LAW copy.md`  
**Size:** 4,850 chars

### Headings
- Canonical Project Law for Monorepo & Agentic Systems
- PREAMBLE — WHAT THIS DOCUMENT IS
- DEFINITIONS (GLOBAL)
- ARTICLE I — GUARDRAILS (LAW-GRD)
- LAW-GRD-001 (HARD) — No Silent Assumptions
- LAW-GRD-002 (HARD) — No Silent State Mutation
- LAW-GRD-003 (HARD) — No Backwards Compatibility by Default
- LAW-GRD-004 (HARD) — Plan ≠ Execute
- LAW-GRD-005 (HARD) — No “Just Make It Work”
- ARTICLE II — PROJECT ORGANIZATION LAW (LAW-ORG)
- LAW-ORG-001 (HARD) — PRD-First Development
- LAW-ORG-002 (HARD) — Command-ify Everything

### Determinism / enforcement lines
- **Change Control:** Append-only via ADR; breaking changes allowed but must be explicit
- This document defines the **constitutional law** of the project.
- - Project Organization Law (PRD-first, command-ified work)
- - **SOFT** — default expectation; deviation must be justified
- - **OPTIONAL** — allowed, not required
- All assumptions must be explicitly stated or derived from a spec.
- Backwards compatibility must be explicitly justified.
- Every meaningful unit of work must begin with a spec or PRD.
- All work must be reducible to explicit commands: inputs, outputs, side effects.
- Context must be discoverable, reloadable, reconstructible.
- Failures must produce rules/tests/specs, not tribal knowledge.
- There must exist a Baseline and explicit Deltas. No mutation of baseline without a delta.
- Every system must declare exactly one SOT. Duplicated truth is a defect.
- Agents and tools must load:
- All actions must be attributable, reproducible, explainable. If it cannot be audited, it cannot run.
- Rewrites must preserve history, intent, and traceability.
- - Writing code → LAW-ORG-001..003
- - Building agents → LAW-META-001..005

### Bullets
- - **How work is allowed to happen**
- - **How agents behave**
- - **How projects are structured**
- - **How systems evolve over time**
- - Guardrails (anti-entropy, anti-silent compromise)
- - Project Organization Law (PRD-first, command-ified work)
- - Meta-Orchestrated Spec-Driven Agentic Framework
- - **HARD** — mandatory; violation invalidates output
- - **SOFT** — default expectation; deviation must be justified
- - **OPTIONAL** — allowed, not required
- - **Agent** — any automated or semi-automated actor
- - **Human** — any contributor or operator
- - **Spec** — a document that defines intent before execution
- - **SOT** — single source of truth for a system
- - **ADR** — architecture decision record
- 1. `PROJECT_LAW.md`
- 2. `SOT.md`
- 3. Relevant specs

---

## a2rchitech Guardrails & Templates
**File:** `a2r-sessions/Framing/_Repo Framework/Guardrails.md`  
**Size:** 3,785 chars

### Headings
- Extracted from Vibe Kanban – Deterministic Agent Design Rules
- 0. Purpose
- 1. Core Philosophy (Non-Negotiable)
- 1.1 No Backwards Compatibility Bias
- 2. Mandatory Planning Guardrail
- RULE: Plan Before Action
- Required Plan Template
- 3. Separation of Phases (Hard Boundary)
- RULE: Planning ≠ Execution
- 4. Simplicity Over Legacy Rule
- RULE: Simplest Correct Shape Wins
- 5. Static Safety Guardrails

### Determinism / enforcement lines
- - Tests Required
- Agents must **not**:
- Agents must choose the **cleaner abstraction**.
- If an exception is required, agents must emit:
- Agents must not introduce:
- All styling and config must map to:
- Every change must result in one of:
- Agents must assume:

### Bullets
- - Eliminate agent drift
- - Prevent incremental entropy
- - Enforce architectural clarity
- - Bias agents toward **clean breaks over legacy debt**
- - Make agent behavior **predictable and auditable**
- - Explicitly mandated by compliance
- - Explicitly specified in task constraints
- - Simplify
- - Rename
- - Delete
- - Restructure
- - Goal (1–2 sentences)
- - Non-Goals
- - Constraints
- - Affected Modules / Files
- - Structural Changes
- - Breaking Changes (Yes/No)
- - Tests Required

---

## APPENDIX A — PROJECT ORGANIZATION LAW
**File:** `a2r-sessions/Framing/_Repo Framework/RepoLaw.md`  
**Size:** 2,456 chars

### Headings
- Agentic Engineering Techniques (Formalized)
- A1. PRD-FIRST DEVELOPMENT (INTENT ANCHOR)
- A2. MODULAR RULES ARCHITECTURE (CONTEXT ISOLATION)
- A3. COMMAND-IFY EVERYTHING (DETERMINISM LAYER)
- A4. CONTEXT RESET (SESSION BOUNDARY LAW)
- A5. SYSTEM EVOLUTION MINDSET (COMPOUNDING LAW)
- A6. UNIFIED INVARIANT
- A7. ENFORCEMENT SUMMARY

### Determinism / enforcement lines
- This appendix operationalizes five agentic engineering techniques as non-negotiable system law.
- Law:
- Required Location:
- - All tasks must reference PRD sections.
- - Brownfield projects must maintain a reverse-PRD.
- Context must be explicitly loaded, never ambient.
- Required Structure:
- - Agents must declare loaded context.
- - Instructions repeated twice must be formalized.
- - Commands are deterministic.
- Planning and execution must not share degraded context.
- Every failure must upgrade the system.
- Required Outcome:
- One of the following must be updated:

### Bullets
- - All tasks must reference PRD sections.
- - Brownfield projects must maintain a reverse-PRD.
- - Agents must declare loaded context.
- - Irrelevant context halts execution.
- - Instructions repeated twice must be formalized.
- - Commands are deterministic.
- - Execution agents only consume written artifacts.
- - /agent/*
- - /references/*
- - /tools/*
- - /spec/Deltas/*
- - Acceptance tests
- - PRD missing
- - Context not declared
- - Commands repeated manually
- - No context reset
- - Failures not converted into system updates

---

## Project_Law.md
**File:** `a2r-sessions/Framing/_Repo Framework/Project_Law.md`  
**Size:** 6,003 chars

### Determinism / enforcement lines
- Canonical Project Law for Monorepo & Agentic Systems
- Change Control: Append-only via ADR; breaking changes allowed but must be explicit
- This document defines the constitutional law of the project.
- This file supersedes the following source frameworks, which are now considered canonicalized into this law:
- •    Project Organization Law (PRD-first, command-ified work)
- •    SOFT — default expectation; deviation must be justified
- •    OPTIONAL — allowed, not required
- ARTICLE I — GUARDRAILS (LAW-GRD)
- LAW-GRD-001 (HARD) — No Silent Assumptions
- All assumptions must be explicitly stated or derived from a spec.
- LAW-GRD-002 (HARD) — No Silent State Mutation
- LAW-GRD-003 (HARD) — No Backwards Compatibility by Default
- Backwards compatibility must be explicitly justified, never assumed.
- LAW-GRD-004 (HARD) — Plan ≠ Execute
- LAW-GRD-005 (HARD) — No “Just Make It Work”
- ARTICLE II — PROJECT ORGANIZATION LAW (LAW-ORG)
- LAW-ORG-001 (HARD) — PRD-First Development
- Every meaningful unit of work must begin with a spec or PRD.

### Bullets
- 1.    PROJECT_LAW.md
- 2.    SOT.md
- 3.    Relevant Specs

---

## Purpose
**File:** `a2r-sessions/Framing/onboarding/A2R_SESSION_Onboarding_Login_Fun.md`  
**Size:** 1,510 chars

### Headings
- Concept v1 — Full scene
- Concept v2 — Simplified
- Concept v3 — Dark + logo depth (target)

### Determinism / enforcement lines
- - Auth form always usable.

### Bullets
- - Auth form always usable.
- - Ambient attract mode by default.
- - One-input control.
- - Mobile-safe performance.
- - Dark background, logo-only scenery with parallax depth.
- - refreshRandom
- - sessionSticky (default)
- - daily

