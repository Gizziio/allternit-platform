# P3-P4 DAG ADDENDUM - COMPREHENSIVE GAP FILL

**Date:** 2026-02-20  
**Status:** NEW TASKS ADDED  
**Source:** Legacy spec audit + brainstorm gap analysis + Ars Contexta integration  
**Total New Tasks:** 35 tasks across P3 and P4  
**Total New Effort:** 94 weeks (~22 months)

---

## Ars Contexta Integration (NEW)

**Source:** https://github.com/agenticnotetaking/arscontexta

**What It Is:**
- Claude Code plugin for personalized "second brain" knowledge systems
- **Derivation, not templating** - every structural decision traces to research claims
- Three-Space Architecture: `self/` (agent identity), `notes/` (knowledge graph), `ops/` (operational)
- Processing Pipeline: "6 Rs" - Record, Reduce, Reflect, Reweave, Verify, Rethink
- 249 research claims backing all decisions

**Integration Tasks:**

### P3.18: Ars Contexta Knowledge System (3 weeks)
**Dependencies:** P3.6 (Playground Core), P4.8 (Context Control)

**Subtasks:**
- [ ] 3.18.1: Three-Space Architecture implementation
  - `self/` - Agent persistent identity
  - `notes/` - Knowledge graph with wiki-links
  - `ops/` - Operational coordination
- [ ] 3.18.2: Processing Pipeline (6 Rs)
  - Record - Capture raw input
  - Reduce - Summarize + distill
  - Reflect - Generate insights
  - Reweave - Link to existing knowledge
  - Verify - Validate against research claims
  - Rethink - Periodic restructuring
- [ ] 3.18.3: Research Graph (249 claims)
  - Store as structured knowledge graph
  - Link decisions to research backing
  - Make queryable by agents
- [ ] 3.18.4: Generated Commands
  - `/reduce`, `/reflect`, `/reweave`, `/verify`
  - `/ralph`, `/pipeline`
  - 16 generated command templates
- [ ] 3.18.5: Automation Hooks
  - Session orient hook
  - Write validate hook
  - Auto-commit hook
  - Session capture hook
- [ ] 3.18.6: Maps of Content (MOCs)
  - Hub level
  - Domain level
  - Topic level

**Acceptance Criteria:**
- Conversational setup (6-phase, ~20 min)
- Plain markdown output (no database/lock-in)
- Every structural decision traceable to research
- Fresh context per pipeline phase

---

## P3 Phase: New Tasks (20 tasks, 54 weeks)

### P3.6: Playground Core Engine ✅ (Already tracked)
**Status:** IN PROGRESS  
**Effort:** 2 weeks

---

### P3.7: Foundational Playground Templates ✅ (Already tracked)
**Status:** IN PROGRESS  
**Effort:** 2 weeks

---

### P3.8: UX Playground Templates ✅ (Already tracked)
**Status:** PENDING  
**Effort:** 3 weeks

---

### P3.9: MCP Apps Integration (NEW)
**Dependencies:** P3.6 (Playground Core)  
**Effort:** 3 weeks

**Subtasks:**
- [ ] 9.1: Capsule UI contract definition
- [ ] 9.2: Runtime bridge API
- [ ] 9.3: Permission model
- [ ] 9.4: Event schema
- [ ] 9.5: Threat model
- [ ] 9.6: Review harness integration

**Acceptance Criteria:**
- Tools can return interactive UI surfaces
- Host renders sandboxed HTML
- Bidirectional bridge (tool data → UI, UI → tool)
- Stateful interactive capsules

---

### P3.10: Chrome Extension / Browser Capsule (NEW)
**Dependencies:** P2.4 (Receipt System)  
**Effort:** 4 weeks

**Subtasks:**
- [ ] 10.1: MV3 extension architecture
- [ ] 10.2: Native Messaging host
- [ ] 10.3: Tool contracts (BROWSER.*)
  - BROWSER.GET_CONTEXT
  - BROWSER.ACT
  - BROWSER.NAV
  - BROWSER.WAIT
  - BROWSER.SNAPSHOT
  - BROWSER.RECEIPT
- [ ] 10.4: Safety model implementation
  - Host allowlist
  - Human-in-loop gates
  - Circuit breakers
- [ ] 10.5: Receipt integration
- [ ] 10.6: Observability timeline

**Acceptance Criteria:**
- Chrome extension as "Browser Capsule" edge executor
- MV3 architecture (service worker + content script + approval UI)
- Tool contracts for browser automation
- Safety model with host allowlist + approval gates

---

### P3.11: Avatar Engine / AVSP (NEW)
**Dependencies:** P2.7 (Event Bus)  
**Effort:** 2 weeks

**Subtasks:**
- [ ] 11.1: AVSP types + JSON schema
- [ ] 11.2: Telemetry → mood mapping
  - idle, thinking, planning, executing
  - waiting_user, waiting_tool, reviewing
  - blocked_policy, error, complete
  - intensity: calm, normal, hot, overloaded
- [ ] 11.3: Core avatar component
- [ ] 11.4: Adapter architecture (clawd, etc.)
- [ ] 11.5: Integration with Chat, Dashboard, Marketplace

**Acceptance Criteria:**
- AgentVisualState protocol
- Deterministic mood mapping from telemetry
- Adapter architecture for external mascot kits
- Consistent avatar rendering across all surfaces

---

### P3.12: Browser-use / Operator Browser Tool (NEW)
**Dependencies:** P3.10 (Chrome Extension)  
**Effort:** 3 weeks

**Subtasks:**
- [ ] 12.1: browser_control tool family
  - browser_control.open(url)
  - browser_control.click(selector | text | role)
  - browser_control.type(selector, text)
  - browser_control.extract(selector | querySpec)
  - browser_control.wait(condition)
  - browser_control.screenshot()
- [ ] 12.2: Playwright/CDP integration
- [ ] 12.3: Unified event stream (desktop + browser)
- [ ] 12.4: Safety + capability gates
- [ ] 12.5: Receipt schema extension
- [ ] 12.6: A2UI timeline renderer

**Acceptance Criteria:**
- browser_control as sibling to desktop_control
- DOM-first browser automation
- Vision as fallback
- Unified Operator capsule interface

---

### P3.13: JSON Render / UGI Integration (NEW)
**Dependencies:** P3.6 (Playground Core)  
**Effort:** 3 weeks

**Subtasks:**
- [ ] 13.1: Allternit-IX UI IR schema
- [ ] 13.2: Catalog registry format
  - Component catalog (render-only primitives)
  - Action catalog (side-effect primitives)
- [ ] 13.3: Patch audit log + replay
  - RFC 6902 JSON Patch
  - Incremental updates
- [ ] 13.4: Capsule runtime integration
- [ ] 13.5: Policy gate integration
- [ ] 13.6: CI tests for schema conformance

**Acceptance Criteria:**
- Declarative UI execution engine
- JSON → UI components with stateful runtime
- Expression evaluation (sandboxed, pure, bounded)
- Two-way binding
- Event system
- Catalog-aware prompting

---

### P3.14: Form Surfaces (NEW)
**Dependencies:** P3.6 (Playground Core)  
**Effort:** 2 weeks

**Subtasks:**
- [ ] 14.1: surface.render(form) protocol
- [ ] 14.2: SurfaceHost + FormRenderer
  - Stepper navigation
  - Conditional sections
  - Validation + error display
- [ ] 14.3: Answer Store + schema registry
  - Structured answers with provenance
  - Answer locks (prevent agent override)
- [ ] 14.4: Invalidation graph
  - Selective re-ask
  - Dependency edges
- [ ] 14.5: Artifact emitters
  - /spec/Vision.md
  - /spec/Requirements.md
  - /spec/AcceptanceTests.md

**Acceptance Criteria:**
- Forms as first-class agent communication surface
- Dynamic schema with versioning + diffs
- Two-mode UX (guided vs advanced)
- Bridge messy edits safely

---

### P3.15: Agent Characterization Framework (NEW)
**Dependencies:** P2.1 (Scheduler)  
**Effort:** 2 weeks

**Subtasks:**
- [ ] 15.1: Operational Metrics
  - Reliability (mission success rate, retry rate)
  - Latency (time to first step, completion time)
  - Policy Compliance (ban triggers, escalation frequency)
  - Memory Depth (active memory count, confidence)
  - Coordination Quality (handoffs, conflicts)
- [ ] 15.2: Capability Maturity
  - Experimental / Stable / Hardened / Critical
  - Risk Tier: Low / Medium / High
  - Autonomy Tier: Advisory / Assisted / Delegated / Autonomous
  - Trust Index (computed)
- [ ] 15.3: Cognitive Bias Profiles
  - Analytical bias
  - Conservative bias
  - Speed bias
  - Adversarial bias
  - Compliance bias
  - Creative bias
- [ ] 15.4: Affinity Matrix
  - Handoff priority weighting
  - Conflict probability weighting
  - Reviewer pairing
  - Mentor routing
- [ ] 15.5: Runtime Drift Tracking
  - Risk-averse drift
  - Deployment confidence drift
  - Review strictness drift
  - Creativity drift

**Acceptance Criteria:**
- Agent Profile Panel in UI
- Behavioral compiler
- Telemetry-driven performance metrics
- No gamification (levels/XP)

---

### P3.16: Content Ingestion Kernel (NEW)
**Dependencies:** P2.4 (Receipt System)  
**Effort:** 2 weeks

**Subtasks:**
- [ ] 16.1: HTML Fetcher + Markdown Negotiator
  - Accept: text/markdown header
  - Fallback to HTML
- [ ] 16.2: Cleaner (Canonicalization Engine)
  - Strip nav/footer boilerplate
  - Remove CSS/script blocks
  - Collapse repeated sections
  - Deduplicate headings
  - Normalize links
- [ ] 16.3: Semantic Structurer
  - Markdown → Structured Agent Context Object
  - Title, sections, summaries, key points
  - Entities, links, metadata
- [ ] 16.4: Token Estimator
  - Raw token count
  - Clean token count
  - Structured token count
  - Compression ratio
- [ ] 16.5: Living File Writer
  - /living/web/{domain}/{hash}.md
  - /living/web/{domain}/{hash}.json
  - Source URL, timestamp, semantic signature
  - Relationship edges, version diffs
- [ ] 16.6: Graph Indexer
  - Vector DB entry
  - Knowledge graph entry

**Acceptance Criteria:**
- Agent-native content pipeline
- HTML → Markdown → Structured Context
- Token budget enforcement
- Living Files for web content

---

### P3.17: Session/Context Management (NEW)
**Dependencies:** P4.8 (Context Control)  
**Effort:** 2 weeks

**Subtasks:**
- [ ] 17.1: Context Registry
  - Session store
  - Drift detection (branch mismatch, file diffs)
- [ ] 17.2: Session Lifecycle
  - Create/select session
  - Fork/clone session context
  - Archive/resume sessions
- [ ] 17.3: Semantic Index
  - Full-text search
  - Embeddings over transcripts
  - Referenced files/paths
- [ ] 17.4: Navigation UI Binding
  - Jump between sessions
  - Restore bindings (workspace, files, tools)
- [ ] 17.5: Health + Drift Detection
  - Session health warnings
  - Workspace state divergence

**Acceptance Criteria:**
- Session dashboard
- Context health + drift detection
- Session navigation + search
- Native Allternit implementation (not vendor-locked)

---

### P3.19: SYSTEM_LAW Layer Implementation (CRITICAL - NEW)
**Dependencies:** None  
**Effort:** 6 weeks

**Subtasks:**
- [ ] 19.1: Ontology Registry (LAW-ONT-001, LAW-ONT-002, LAW-ONT-003)
  - Canonical entity definitions
  - Authority Law enforcement
  - Determinism Law enforcement
  - Validation engine
- [ ] 19.2: Entity Lifecycle Manager (LAW-ENT-001, LAW-ENT-002)
  - IO Service definition enforcement
  - Kernel Service definition enforcement
  - Entity creation/registration
  - Entity state transitions
  - Entity deletion/archival
- [ ] 19.3: Guardrail Enforcement Engine (LAW-GRD-001 through LAW-GRD-010)
  - No silent assumptions validation
  - No silent state mutation enforcement
  - Plan ≠ Execute state machine gates
  - No "just make it work" rejection
  - Harness-first enforcement
  - No commented-out code detection
  - Production-grade validation
  - No placeholders enforcement
  - No silent degradation detection
- [ ] 19.4: Autonomy Governance Framework (LAW-AUT-001 through LAW-AUT-005)
  - No-stop execution rule
  - Deterministic rehydration
  - Lease continuity
  - Evidence/receipts queryability
  - Prompt delta escape hatch
- [ ] 19.5: Swarm Coordination Contracts (LAW-SWM-001 through LAW-SWM-009)
  - Deterministic DAG execution
  - Parallelism without shared mutable state
  - Conflict arbitration (already implemented in P2.5)
  - Budget-aware scheduling (already implemented in P2.6)
  - Evidence-first outputs
  - Logical time & deterministic scheduling
  - Admission control & fairness
  - DAG-only execution
  - DAG + WIH coupling

**Acceptance Criteria:**
- All SYSTEM_LAW layers implemented
- LAW compliance validation
- Integration with Policy Engine
- LAW violations halt execution
- SYSTEM_LAW.md as Tier-0 authority enforced

---

### P3.20: Harness Engineering (CRITICAL - NEW)
**Dependencies:** P3.19 (SYSTEM_LAW Layer)  
**Effort:** 4 weeks

**Subtasks:**
- [ ] 20.1: RiskPolicy Contract (LAW-GRD-008, LAW-ENF-004)
  - Risk tier classification
  - Path classification rules
  - Required gates by tier
  - Required evidence (LAW-SWM-005)
  - Review requirements (LAW-META-006 A2A review)
  - Docs drift rules (LAW-CHG-003)
- [ ] 20.2: Preflight Risk Evaluation (Stage 0)
  - Load WIH (LAW-META-007)
  - Load RiskPolicy
  - Detect changed files
  - Compute risk tier
  - Resolve required gates
  - Validate docs drift rules
- [ ] 20.3: Deterministic Remediation Loop
  - Spawn RemediationAgent
  - Constraints (Implementer role only, spec locked)
  - Minimal patch application
  - Targeted validation
  - Retry until clean OR maxAttempts (LAW-OPS-003 retry semantics)
- [ ] 20.4: Evidence Validation (LAW-SWM-005, LAW-AUT-004)
  - Evidence manifest exists
  - SHA embedded in artifact metadata
  - Flow assertions passed
  - Artifacts timestamp recent
- [ ] 20.5: Merge Governance (LAW-ENF-003, LAW-CHG-001)
  - Risk-tiered auto-merge rules
  - Required receipts
  - Signatures (agent identity, optional human)
  - MergeEligibilityReceipt
- [ ] 20.6: Entropy Compression Engine (LAW-ENF-005, LAW-QLT-002)
  - Golden principles encoding
  - Daily GC agents
  - Entropy score calculation
  - Small PR automation

**Acceptance Criteria:**
- Autonomous Code Factory
- No merge without machine-verifiable truth
- Evidence-based merge decisions
- Deterministic remediation
- SYSTEM_LAW compliance (LAW-GRD, LAW-ENF, LAW-QLT)

---

### P3.21: Capsule System (CRITICAL - NEW)
**Dependencies:** P3.6 (Playground Core)  
**Effort:** 4 weeks

**Subtasks:**
- [ ] 21.1: Capsule SDK (Rust crate)
  - Capsule definition schema
  - Capsule lifecycle API
- [ ] 21.2: Capsule Protocol (IPC)
  - Capsule-to-capsule communication
  - Capsule-to-runtime communication
  - Message serialization
- [ ] 21.3: Capsule Shell (Electron renderer)
  - Tab-like capsule UI
  - Sandboxed mini-app instances
  - Provenance display
- [ ] 21.4: Capsule Registry
  - Runtime capsule discovery
  - Capability routing
  - Lifecycle management (spawn/suspend/resume/destroy)
- [ ] 21.5: Capsule Framework Registry
  - Registered templates for capsule generation
  - Intent patterns
  - Required tools + acceptance tests

**Acceptance Criteria:**
- Full capsule system per spec
- Agent-generated capsules
- Sandboxed, tab-like, provenance-bound
- Canvas bundle support

---

### P3.22: Canvas Protocol (CRITICAL - NEW)
**Dependencies:** P3.21 (Capsule System)  
**Effort:** 3 weeks

**Subtasks:**
- [ ] 22.1: Canvas Runtime (TypeScript)
  - CanvasSpec validation
  - Canvas instantiation
  - State management
- [ ] 22.2: Canvas Protocol (Serialization + Sync)
  - CanvasSpec serialization
  - State sync protocol
  - Update patches (RFC 6902)
- [ ] 22.3: Canvas UI Components (React)
  - 40+ canonical view types implemented
  - Diff review, run view, test lens, timeline, table, form, etc.
- [ ] 22.4: Canvas State Manager
  - Deterministic state sync
  - Provenance tracking
  - Interaction handling

**Acceptance Criteria:**
- Canvas Protocol per spec
- All canonical view types implemented
- Renderer-agnostic canvases
- Interaction safety enforced

---

### P3.23: Hooks System (NEW)
**Dependencies:** P3.19 (SYSTEM_LAW Layer)  
**Effort:** 3 weeks

**Subtasks:**
- [ ] 23.1: Kernel Hooks
  - Boot injection (LAW-ENF-001 mandatory load order)
  - Tool permission gates (LAW-TOOL-001, LAW-TOOL-002)
  - Policy enforcement (LAW-GRD guardrails)
- [ ] 23.2: Workspace Hooks
  - SYSTEM_LAW validation
  - Spec presence checks (LAW-META-001 baseline + deltas)
  - ADR enforcement (LAW-CHG change protocol)
  - Contract existence checks
- [ ] 23.3: Task Hooks
  - Output schema validation (LAW-ONT determinism)
  - Structured formatting
  - Deterministic verification (LAW-ONT-003)
- [ ] 23.4: Human Layer Hooks
  - Escalation gates (LAW-AUT autonomy rules)
  - Approval triggers (LAW-GRD-004 plan ≠ execute)
  - Destructive action review (LAW-GRD-005)
- [ ] 23.5: Habit Promotion Protocol
  - Determinism test
  - Failure-mode analysis
  - Promotion criteria (LAW-ENF-005 entropy compression)
  - Rollback mechanism
  - Audit logging (LAW-ENF-002)
  - Human override path

**Acceptance Criteria:**
- Full 4-layer hook system
- Event-triggered (not instruction-based)
- Synthetic habit system
- Determinism boundary enforced
- SYSTEM_LAW compliance at all hook points

---

### P3.24: Environment Standardization (NEW)
**Dependencies:** P2.3 (Lease Management)  
**Effort:** 3 weeks

**Subtasks:**
- [ ] 24.1: Normalized Environment Spec (NES)
  - Driver-agnostic environment contract
  - apiVersion: allternit.dev/v1
  - Toolchain, packages, services, tasks
- [ ] 24.2: Lifecycle Runner
  - Resolve → Provision → Bootstrap → Start → Ready → Run → Collect → Teardown
  - Triggers + dependencies + timeouts
- [ ] 24.3: Determinism Hashing
  - envHash (NES canonical JSON + base digests)
  - policyHash
  - inputsHash
  - codeHash
- [ ] 24.4: Secrets Model
  - Ephemeral credential binding
  - References only (no raw values)
  - TTL-based expiration
- [ ] 24.5: Compatibility Tiers
  - Tier 0: Local Dev (best effort)
  - Tier 1: Enterprise BYOC (strict reproducibility)
  - Tier 2: Marketplace Untrusted (strongest gates)

**Acceptance Criteria:**
- Environment Standardization Spec v1 implemented
- Reproducible, spawnable, portable environments
- Deterministic hash binding
- Secrets never in spec

---

### P3.25: Vendor Wrappers (NEW)
**Dependencies:** P3.6 (Playground Core)  
**Effort:** 2 weeks

**Subtasks:**
- [ ] 25.1: Create /packages/allternit-platform/src/vendor/
- [ ] 25.2: Implement wrappers for:
  - flexlayout-react → FlexLayoutHost
  - react-resizable-panels → AllternitPanelGroup
  - @tanstack/react-virtual → VirtualList
  - kbar/cmdk → CommandPalette
  - react-hotkeys-hook → useAllternitHotkeys
  - @radix-ui/* → Radix wrappers
  - monaco-editor → CodeEditor
  - xterm → TerminalView
  - tldraw → CanvasSurface
  - reactflow → GraphSurface
- [ ] 25.3: README for each wrapper
  - Upstream project + repo
  - Pinned version
  - Allternit wrapper exports
  - Usage example
- [ ] 25.4: Export from platform barrel

**Acceptance Criteria:**
- All vendor imports wrapped
- No vendor imports in apps/shell
- Single point of integration
- Version pinned

---

## P4 Phase: New Tasks (15 tasks, 40 weeks)

### P4.1: Swarm Scheduler Advanced Features ✅ (Already in DAG)
**Status:** PENDING  
**Effort:** 2 weeks

---

### P4.2: Agent Communication Layer ✅ (Already in DAG)
**Status:** PENDING  
**Effort:** 2 weeks

---

### P4.3: Advanced Conflict Resolution ✅ (Already in DAG)
**Status:** PENDING  
**Effort:** 2 weeks

---

### P4.4: Budget Optimization ✅ (Already in DAG)
**Status:** PENDING  
**Effort:** 2 weeks

---

### P4.5: Node Auto-Scaling ✅ (Already in DAG)
**Status:** PENDING  
**Effort:** 2 weeks

---

### P4.6: Multi-Region Deployment ✅ (Already in DAG)
**Status:** PENDING  
**Effort:** 3 weeks

---

### P4.7: Evolution Layer (CRITICAL - NEW)
**Dependencies:** P4.1 (Swarm Scheduler Advanced)  
**Effort:** 6 weeks

**Subtasks:**
- [ ] 7.1: Memory Evolution Engine (MEE) - ALMA-style
  - Schema competition + evaluation
  - Archive of memory schemas
  - Evaluator (retrieval precision, compression ratio, task success)
  - Schema runtime
- [ ] 7.2: Skill Evolution Engine (SEE) - SkillRL-style
  - Trajectory distillation → SkillBank
  - Skill extraction pipeline
  - Skill hierarchy
  - Skill scoring + retrieval
- [ ] 7.3: Confidence-Based Routing Layer (CRL) - AdaptEvolve-style
  - Small model → mid model → frontier model escalation
  - Uncertainty monitoring
  - Historical failure rate tracking
  - Task complexity signature
- [ ] 7.4: Organizational Evolution Engine (OEE) - Agyn-style
  - Role specialization (manager, researcher, engineer, reviewer, security, optimizer)
  - Dynamic workflow mutation
  - Manager decides iteration cycles
- [ ] 7.5: Trajectory Optimization Engine (TOE) - InftyThink-style
  - Iterative boundary controller
  - Summarizer
  - State tracker
  - Efficiency reward (accuracy - λ(token_cost))

**Acceptance Criteria:**
- All 5 evolution engines implemented
- Observability substrate
- Self-improving agent infrastructure
- Memory/skill/routing/workflow/trajectory evolution

---

### P4.8: Context Control Plane (CRITICAL - NEW)
**Dependencies:** P3.17 (Session Management)  
**Effort:** 4 weeks

**Subtasks:**
- [ ] 8.1: Context filesystem layout
  - /allternit/context/contexts/{context_id}/
  - context.md, state.json
  - branches/{branch_id}/summary.md
  - commits/{ts}-{hash}/commit.md, traces.ndjson, artifacts/, patchset/
  - index.json
  - share/bundles/{bundle_id}.tar.zst
- [ ] 8.2: Tool contracts
  - ctx.commit(context_id, branch_id, message, evidence_refs[])
  - ctx.branch(context_id, from_branch_id, new_branch_id, intent)
  - ctx.merge(context_id, source_branch_id, target_branch_id, strategy)
  - ctx.context(context_id, branch_id, query, resolution, time_range?)
- [ ] 8.3: Multi-resolution retrieval
  - summary → state → traces
  - Selective pull by query/time window
- [ ] 8.4: Share/export bundle system
  - Signed context bundles
  - BYO storage (S3/R2/etc.)
  - Link with locator + hash + optional decryption key
- [ ] 8.5: Garbage collection policy
  - Raw traces kept forever (compressed)
  - Summaries rewritten frequently
  - Projections recomputed incrementally
  - Derived artifacts pruned (embeddings, old projections)
- [ ] 8.6: UI context browser
  - Branches, commits, diffs
  - Replay traces

**Acceptance Criteria:**
- Git Context Controller (GCC) implementation
- Context as first-class object
- Versioned memory ops
- Shareable context bundles
- Multi-resolution retrieval

---

### P4.9: Multimodal Streaming (NEW)
**Dependencies:** P4.1 (Swarm Scheduler Advanced)  
**Effort:** 3 weeks

**Subtasks:**
- [ ] 9.1: OmniAgent Class
  - Vision ingestion
  - Audio ingestion
  - TTS streaming
  - Interruptible output
  - Continuous memory updates
- [ ] 9.2: Full-Duplex State Controller
  - Concurrent A/V channels
  - Non-blocking async channels
  - Priority interrupt routing
  - Speech interruption
  - Vision update injection
- [ ] 9.3: Streaming Kernel Extension
  - Session State Machine upgrade
  - Streaming Supervisor upgrade
  - Backpressure logic for continuous streaming
- [ ] 9.4: Event Bus Integration
  - Separate decode + encode pipelines
  - Interruptible output generation

**Acceptance Criteria:**
- Full-duplex multimodal agents
- MiniCPM-o 4.5 class model support
- Local deployment viable (10-11GB VRAM quantized)
- Continuous reactive graph execution

---

### P4.10: Memory Kernel (CRITICAL - NEW)
**Dependencies:** P4.8 (Context Control)  
**Effort:** 4 weeks

**Subtasks:**
- [ ] 10.1: Rust memory service (AMK)
  - Append-only memory ledger
  - Namespaced memory scopes (project/user/agent)
- [ ] 10.2: Three-Layer Memory System
  - Events layer (append-only timeline)
  - Entities layer (people/companies/projects with items.json + summary.md)
  - Edges layer (cross-entity relationships)
  - Summaries layer (weekly regeneration)
- [ ] 10.3: Embedding abstraction
  - Vector index
  - Semantic search
- [ ] 10.4: Graph layer
  - Relationship graph
  - Entity/edge queries
- [ ] 10.5: GC + dedup engine
  - Staleness scoring
  - Confidence weighting
  - Memory aging decay
  - Conflict detection
  - Duplicate merge rules
  - Execution trace compression
- [ ] 10.6: MCP adapter
  - MCP memory compliance
  - External agent query support

**Acceptance Criteria:**
- Allternit Memory Kernel v1
- Three-layer memory per spec
- Knowledge graph compounding
- GC engine for entropy compression

---

### P4.11: Tambo Integration (NEW)
**Dependencies:** P3.13 (JSON Render / UGI)  
**Effort:** 2 weeks

**Subtasks:**
- [ ] 11.1: ComponentContent event type
  - name + props + id + streamingState
- [ ] 11.2: Component Registry
  - WorkGraphView
  - RunLogViewer
  - PolicyGatePrompt
  - RepoNavigator
  - FileDiffViewer
  - ToolConsole
  - ErrorTriagePanel
- [ ] 11.3: Adapter layer
  - componentRegistry.ts
  - schema.ts (Zod → JSON Schema)
  - stream.ts (ComponentContent streaming)
  - thread.ts (Allternit thread binding)
  - mcp.ts (Allternit MCP transport)
- [ ] 11.4: Demo prompt integration
  - "Show my current run graph and last 200 log lines"

**Acceptance Criteria:**
- Generative UI components
- Component streaming from agent
- Interactive capsule UI
- Tambo React SDK patterns absorbed

---

### P4.12: Autonomous Code Factory (CRITICAL - NEW)
**Dependencies:** P3.20 (Harness Engineering)  
**Effort:** 3 weeks

**Subtasks:**
- [ ] 12.1: RiskPolicy.schema.json
  - Risk tiers (low/medium/high/critical)
  - Path classification rules
  - Required gates by tier
  - Required evidence
  - Review requirements
- [ ] 12.2: Preflight Stage in Runner
  - Load WIH + RiskPolicy
  - Detect changed files
  - Compute risk tier
  - Validate docs drift
- [ ] 12.3: ReviewAgentState
  - SHA-bound review tracking
  - prId, headSha, reviewRunId, status, findingsHash, timestamp
- [ ] 12.4: Deterministic Remediation Loop
  - Patch-only agent
  - Spec locked
  - Max attempts bounded
- [ ] 12.5: Evidence Manifest
  - SHA-embedded artifacts
  - /evidence/{sha}/flowName/
- [ ] 12.6: MergeEligibilityReceipt
  - Machine-verifiable merge state
  - headSha, timestamp, riskTier, evidenceHash, reviewRunId, acceptanceHash, policyVersion

**Acceptance Criteria:**
- Autonomous engineering cloud
- No merge without deterministic validation
- Evidence-based governance
- Spec → Plan → Implement → Verify → Release loop enforced

---

### P4.13: Garbage Collection Agents (NEW)
**Dependencies:** P4.7 (Evolution Layer)  
**Effort:** 2 weeks

**Subtasks:**
- [ ] 13.1: Golden Principles encoding
  - No unvalidated external data
  - Boundary parsing required
  - Shared utilities over duplication
  - Structured logging mandatory
  - No silent catch
  - Max file size threshold
  - Strict dependency direction
- [ ] 13.2: GC Agents (daily runs)
  - Detect duplicate utilities
  - Detect untyped boundary usage
  - Detect dependency violations
  - Detect missing observability
  - Detect stale documentation
  - Improve test coverage gaps
- [ ] 13.3: Entropy Score calculation
  - Rule violations
  - Drift rate
  - Test coverage delta
  - Documentation mismatch
  - Recorded in /quality/entropy-score.md
- [ ] 13.4: Small PR automation
  - Auto-merge if safe tier
  - Reviewable in under 1 minute

**Acceptance Criteria:**
- Daily entropy compression
- Golden principles enforced
- Entropy score visible
- Technical debt paid daily

---

### P4.14: Quality Score System (NEW)
**Dependencies:** P4.13 (Garbage Collection)  
**Effort:** 1 week

**Subtasks:**
- [ ] 14.1: Domain Grades (/quality/domain-grades.md)
  - Architecture adherence
  - Test coverage
  - Observability completeness
  - Boundary enforcement
  - Drift frequency
- [ ] 14.2: Agent-visible quality metrics
  - Agents optimize for grade
  - Quality dashboard in UI
- [ ] 14.3: Automated grade updates
  - GC agents update grades
  - Trend tracking

**Acceptance Criteria:**
- Quality score per domain
- Visible to agents
- Drives optimization behavior

---

### P4.15: Legacy Spec Audit (CRITICAL - NEW)
**Dependencies:** None  
**Effort:** 1 week

**Subtasks:**
- [ ] 15.1: Audit /docs/_archive/legacy-specs/organized/Architecture/LAW/
  - Move implementable specs to /spec/
  - Archive obsolete specs
- [ ] 15.2: Audit /docs/_archive/legacy-specs/organized/Architecture/UI/
  - CanvasProtocol.md → implement or archive
  - CapsuleProtocol.md → implement or archive
  - MiniAppRuntime.md → implement or archive
  - UTI.md → implement or archive
- [ ] 15.3: Audit /docs/_archive/legacy-specs/organized/Architecture/INTEGRATIONS/
  - Glide spec → implement or archive
  - Linear integration → implement or archive
- [ ] 15.4: Audit /docs/_archive/legacy-specs/organized/Architecture/UNIFIED/
  - COMPILER, CONTEXT, ***IR folders
- [ ] 15.5: Audit /docs/_completed/specifications/spec/
  - HooksSystem spec → move to implementation
  - ContextRouting_MemoryFabric spec → move to implementation
  - CanvasProtocol spec → move to implementation
  - Capsules spec → move to implementation
  - SkillsSystem spec → move to implementation

**Acceptance Criteria:**
- All legacy specs categorized
- Implementable specs in /spec/
- Obsolete specs archived
- Clear implementation roadmap

---

## Summary: Total New Work

### P3 Phase: 20 tasks, 54 weeks
- Already tracked: 3 tasks (P3.6-3.8)
- **NEW:** 17 tasks, 49 weeks

### P4 Phase: 15 tasks, 40 weeks
- Already tracked: 6 tasks (P4.1-4.6)
- **NEW:** 9 tasks, 34 weeks

### Grand Total: 35 tasks, 94 weeks (~22 months)

---

## Recommended Phasing

### Phase 1: Critical Foundation (10 weeks)
- P3.19: LAW Layer (6 weeks)
- P3.20: Harness Engineering (4 weeks)

### Phase 2: Core Infrastructure (14 weeks)
- P4.10: Memory Kernel (4 weeks)
- P4.8: Context Control (4 weeks)
- P4.7: Evolution Layer (6 weeks)

### Phase 3: Capsule + Canvas (7 weeks)
- P3.21: Capsule System (4 weeks)
- P3.22: Canvas Protocol (3 weeks)

### Phase 4: UI/UX Enhancements (15 weeks)
- P3.9: MCP Apps (3 weeks)
- P3.10: Chrome Extension (4 weeks)
- P3.11: Avatar Engine (2 weeks)
- P3.13: JSON Render (3 weeks)
- P3.14: Form Surfaces (2 weeks)
- P3.16: Content Ingestion (2 weeks)
- P3.18: Ars Contexta (3 weeks)

### Phase 5: Advanced Features (13 weeks)
- P3.12: Operator Browser (3 weeks)
- P3.15: Agent Characterization (2 weeks)
- P3.17: Session Management (2 weeks)
- P3.23: Hooks System (3 weeks)
- P3.24: Environment Standardization (3 weeks)
- P4.9: Multimodal Streaming (3 weeks)
- P4.11: Tambo Integration (2 weeks)

### Phase 6: Polish + Optimization (8 weeks)
- P3.25: Vendor Wrappers (2 weeks)
- P4.12: Autonomous Code Factory (3 weeks)
- P4.13: Garbage Collection (2 weeks)
- P4.14: Quality Score (1 week)
- P4.15: Legacy Spec Audit (1 week)

---

**This addendum should be merged into MASTER_DAG_TASK_BREAKDOWN.md**

---

**End of Addendum**
