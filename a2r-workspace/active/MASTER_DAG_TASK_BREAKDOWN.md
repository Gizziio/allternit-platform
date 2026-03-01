# A2R MASTER DAG TASK BREAKDOWN 2026
## Complete Buildout Implementation Plan

**Document Type:** Executable DAG Specification  
**Date:** 2026-02-20  
**Version:** 2.0 (Updated with Option B IO Service decision)  
**Source Documents:**
- BUILDOUT_VISION_2026.md
- COMPREHENSIVE_GAP_ANALYSIS.md
- CONSOLIDATED_BUILDOUT_PLANS.md
- IMPLEMENTATION_STATUS_REPORT.md
- All brainstorm session files
- Human Review Decisions (2026-02-20)

---

## DAG Overview

**Total Tasks:** 157 (+10 for IO Service extraction)  
**Critical Path Tasks:** 45 (+3)  
**Estimated Duration:** 25 weeks (6 months + 1 week) to MVP  
**Parallel Tracks:** 8

### Task Priority Levels

| Level | Description | Count |
|-------|-------------|-------|
| **P0** | Critical - This Week | 10 (+2) |
| **P1** | High - Next 2 Weeks | 20 (+2) |
| **P2** | Medium - Next Month | 38 (+3) |
| **P3** | Strategic - 2-6 Months | 89 (+3) |

---

## Strategic Decisions Log

### Decision P0.3-B: IO Service Extraction (Option B Phase 1)

**Date:** 2026-02-20  
**Decision:** Extract ToolGateway to separate IO Service (`4-services/io-service/`)

**Rationale:**
- ToolGateway already exists (2,122 lines in `1-kernel/a2r-kernel/tools-gateway/`)
- Provides true ontology compliance (SYSTEM_LAW.md LAW-ONT-002)
- Enables system-wide reusability (DAK, CLI, other services)
- Enables independent scaling (IO vs logic)
- Clear failure boundaries
- Future-proofs for WASM runtime

**Effort:** 3-4 days (not 2 weeks - mostly file moves + thin HTTP wrapper)

**Implementation Approach:**
1. Create `4-services/io-service/` directory
2. Move `tools-gateway` from `1-kernel/a2r-kernel/` to `4-services/io-service/`
3. Create thin HTTP wrapper (Axum, port 3510)
4. Update Kernel Service to call via HTTP (remove direct ToolGateway import)
5. Update startup scripts (`.a2r/services.json`)

**Files to Move:**
- `1-kernel/a2r-kernel/tools-gateway/src/` → `4-services/io-service/src/`
- `1-kernel/a2r-kernel/tools-gateway/Cargo.toml` → `4-services/io-service/Cargo.toml`

**Files to Create:**
- `4-services/io-service/src/main.rs` (HTTP wrapper)
- `4-services/io-service/README.md`

**Files to Update:**
- `4-services/orchestration/kernel-service/src/main.rs` (remove ToolGateway, add HTTP client)
- `.a2r/services.json` (add io-service)
- `ARCHITECTURE.md` (update service table)
- `SYSTEM_LAW.md` (add LAW-ENT-001: IO Service definition)

**Acceptance Criteria:**
- [ ] IO Service runs on port 3510
- [ ] Kernel Service calls IO Service via HTTP (no direct ToolGateway import)
- [ ] All tool execution flows through IO Service
- [ ] Policy enforcement happens in IO Service (before execution)
- [ ] IO capture and logging functional
- [ ] Tests pass

---

### Decision P0.4-A: DAK-Rails HTTP Contract (Adapter-First + 2 Endpoints)

**Date:** 2026-02-20  
**Decision:** Update DAK adapter to match Rails + add 2 truly missing endpoints

**Rationale:**
- DAK comparison table was partially inaccurate
- Rails has more endpoints than documented (`/v1/gates/*`, `/v1/context-packs/*`)
- Current DAK path is CLI adapter, not HTTP
- Two endpoints genuinely missing: `/v1/work/discover`, `/v1/leases/:id/renew`

**Implementation Approach:**
1. Audit actual Rails endpoints (verify all routes)
2. Update `rails_http.ts` to match actual Rails routes
3. Add contract tests to verify alignment
4. Add 2 missing endpoints to Rails

**Endpoints to Add:**
- `POST /v1/work/discover` (work discovery with capability matching)
- `POST /v1/leases/:lease_id/renew` (lease TTL extension)

**Files to Update:**
- `1-kernel/agent-systems/a2r-dak-runner/src/adapters/rails_http.ts`
- `0-substrate/a2r-agent-system-rails/src/service.rs` (add 2 endpoints)
- `1-kernel/agent-systems/a2r-dak-runner/tests/contract/rails-endpoints.test.ts` (NEW)

**Acceptance Criteria:**
- [ ] DAK adapter matches all Rails endpoints
- [ ] Contract tests pass
- [ ] `/v1/work/discover` endpoint functional
- [ ] `/v1/leases/:id/renew` endpoint functional
- [ ] DAK HTTP mode operational

---

## Phase 0: LAW Consolidation & Architecture Truth (Week 1)

### P0.1: LAW Document Consolidation
**Priority:** P0 - CRITICAL  
**Effort:** 2 days  
**Dependencies:** None  
**Owner:** Architecture Team  
**Status:** ✅ COMPLETE

**Subtasks:**
- [x] 0.1.1: Move PROJECT_LAW.md to repo root (`/PROJECT_LAW.md`)
- [x] 0.1.2: Copy ONTOLOGY_LAW.md to `/spec/ontology.md` (appendix to PROJECT_LAW)
- [x] 0.1.3: Update PROJECT_LAW.md references to include ONTOLOGY_LAW
- [x] 0.1.4: Add deprecation notices to archived LAW documents
- [x] 0.1.5: Update AGENTS.md to reference PROJECT_LAW as Tier-0 authority
- [x] 0.1.6: Create LAW compliance test (validate all agents load PROJECT_LAW)

**Acceptance Criteria:**
- ✅ PROJECT_LAW.md exists at repo root
- ✅ All LAW documents properly cross-referenced
- ✅ Archived LAW documents marked as deprecated
- ✅ LAW compliance test passes

---

### P0.2: ARCHITECTURE.md Truth-Telling
**Priority:** P0 - CRITICAL  
**Effort:** 1 day  
**Dependencies:** P0.1  
**Owner:** Architecture Team  
**Status:** ✅ COMPLETE

**Subtasks:**
- [x] 0.2.1: Audit all claimed services against actual implementations
- [x] 0.2.2: Remove Policy Service (port 3003) OR create implementation task
- [x] 0.2.3: Remove Task Executor (port 3510) OR create implementation task
- [x] 0.2.4: Add IO Binary specification section
- [x] 0.2.5: Add Presentation Kernel specification section
- [x] 0.2.6: Add Directive Compiler specification section
- [x] 0.2.7: Update all port assignments to verified values

**Acceptance Criteria:**
- ✅ ARCHITECTURE.md reflects only implemented services
- ✅ Missing services have corresponding implementation tasks
- ✅ Port registry is accurate

---

### P0.3: IO Service Extraction (Option B Phase 1)
**Priority:** P0 - CRITICAL  
**Effort:** 4 days  
**Dependencies:** P0.2  
**Owner:** Backend Team (Rust)  
**Status:** ⏳ READY TO START

**Strategic Decision:** Option B (Extract ToolGateway to IO Service) - See Strategic Decisions Log

**Subtasks:**
- [ ] 0.3.1: Create `4-services/io-service/` directory structure
- [ ] 0.3.2: Move `tools-gateway` from `1-kernel/a2r-kernel/` to `4-services/io-service/`
- [ ] 0.3.3: Create HTTP wrapper (`4-services/io-service/src/main.rs`)
- [ ] 0.3.4: Create IO Service README
- [ ] 0.3.5: Update Kernel Service to call IO Service via HTTP (remove ToolGateway import)
- [ ] 0.3.6: Update `.a2r/services.json` (add io-service on port 3510)
- [ ] 0.3.7: Update `ARCHITECTURE.md` service table
- [ ] 0.3.8: Add LAW-ENT-001 to SYSTEM_LAW.md (IO Service definition)
- [ ] 0.3.9: Test tool execution through IO Service
- [ ] 0.3.10: Verify policy enforcement in IO Service

**Acceptance Criteria:**
- [ ] IO Service runs on port 3510
- [ ] Kernel Service calls IO Service via HTTP (no direct ToolGateway import)
- [ ] All tool execution flows through IO Service
- [ ] Policy enforcement happens in IO Service (before execution)
- [ ] IO capture and logging functional
- [ ] Tests pass

**Files to Move:**
- `1-kernel/a2r-kernel/tools-gateway/src/` → `4-services/io-service/src/`
- `1-kernel/a2r-kernel/tools-gateway/Cargo.toml` → `4-services/io-service/Cargo.toml`

**Files to Create:**
- `4-services/io-service/src/main.rs` (HTTP wrapper)
- `4-services/io-service/README.md`

**Files to Update:**
- `4-services/orchestration/kernel-service/src/main.rs`
- `.a2r/services.json`
- `ARCHITECTURE.md`
- `SYSTEM_LAW.md`

---

### P0.4: DAK-Rails HTTP Contract Alignment
**Priority:** P0 - CRITICAL  
**Effort:** 2 days  
**Dependencies:** P0.3  
**Owner:** Backend Team (TypeScript + Rust)  
**Status:** ⏳ READY TO START

**Strategic Decision:** Adapter-first + 2 missing endpoints - See Strategic Decisions Log

**Subtasks:**
- [ ] 0.4.1: Audit actual Rails endpoints (verify all routes in `service.rs`)
- [ ] 0.4.2: Update `rails_http.ts` to match actual Rails routes
- [ ] 0.4.3: Add contract tests (`rails-endpoints.test.ts`)
- [ ] 0.4.4: Add `POST /v1/work/discover` endpoint to Rails
- [ ] 0.4.5: Add `POST /v1/leases/:lease_id/renew` endpoint to Rails
- [ ] 0.4.6: Test DAK HTTP mode end-to-end
- [ ] 0.4.7: Document endpoint alignment

**Acceptance Criteria:**
- [ ] DAK adapter matches all Rails endpoints
- [ ] Contract tests pass
- [ ] `/v1/work/discover` endpoint functional
- [ ] `/v1/leases/:id/renew` endpoint functional
- [ ] DAK HTTP mode operational

**Files to Update:**
- `1-kernel/agent-systems/a2r-dak-runner/src/adapters/rails_http.ts`
- `0-substrate/a2r-agent-system-rails/src/service.rs`
- `1-kernel/agent-systems/a2r-dak-runner/tests/contract/rails-endpoints.test.ts` (NEW)  
**Dependencies:** P0.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 0.4.1: Create `/harness/` directory structure
- [ ] 0.4.2: Create WIH JSON schema (`harness/schemas/wih.schema.json`)
- [ ] 0.4.3: Implement WIH parser (`harness/wih/parser.rs`)
- [ ] 0.4.4: Implement WIH validator (`harness/wih/validator.rs`)
- [ ] 0.4.5: Create risk tiers policy (`harness/policies/risk_tiers.yaml`)
- [ ] 0.4.6: Create role matrix (`harness/policies/role_matrix.yaml`)
- [ ] 0.4.7: Implement evidence emitter (`harness/evidence/emitter.rs`)
- [ ] 0.4.8: Create evidence JSON schema (`harness/schemas/evidence.schema.json`)

**Acceptance Criteria:**
- WIH schema validates all required fields
- WIH parser extracts all fields correctly
- Evidence emitter produces valid JSON
- Unit tests pass for all components

---

### P0.5: CI Harness Gates
**Priority:** P0 - CRITICAL  
**Effort:** 2 days  
**Dependencies:** P0.4  
**Owner:** Backend Team

**Subtasks:**
- [ ] 0.5.1: Create `a2r-validate-wih` script
- [ ] 0.5.2: Create `a2r-validate-boundaries` script
- [ ] 0.5.3: Create `a2r-validate-contracts` script
- [ ] 0.5.4: Create `a2r-emit-evidence` script
- [ ] 0.5.5: Create GitHub Actions workflow (`.github/workflows/a2r_harness.yml`)
- [ ] 0.5.6: Test CI gates on sample PR

**Acceptance Criteria:**
- CI fails on PR without WIH header
- CI fails on boundary violations
- Evidence artifact generated and validates
- All scripts executable and documented

---

### P0.6: Capsule Framework Registry Spec
**Priority:** P0 - CRITICAL  
**Effort:** 2 days  
**Dependencies:** P0.1  
**Owner:** Architecture Team

**Subtasks:**
- [ ] 0.6.1: Define FrameworkSpec schema
- [ ] 0.6.2: Define capsule spawn protocol
- [ ] 0.6.3: Define framework registry API
- [ ] 0.6.4: Define acceptance tests for frameworks
- [ ] 0.6.5: Create implementation task breakdown

**Acceptance Criteria:**
- FrameworkSpec schema complete
- Spawn protocol defined
- API contract documented
- Implementation tasks created

---

### P0.7: Swarm Runtime Spec Finalization
**Priority:** P0 - CRITICAL  
**Effort:** 1 day  
**Dependencies:** None  
**Owner:** Architecture Team

**Subtasks:**
- [ ] 0.7.1: Review `A2R_Swarm_Runtime_Kernel_Spec_v1`
- [ ] 0.7.2: Identify gaps vs current DAK Runner implementation
- [ ] 0.7.3: Create implementation task breakdown
- [ ] 0.7.4: Define MVP subset for Phase 1

**Acceptance Criteria:**
- Gap analysis complete
- Implementation tasks created
- MVP scope defined

---

### P0.8: Documentation Consolidation
**Priority:** P0 - CRITICAL  
**Effort:** 1 day  
**Dependencies:** P0.1-P0.7  
**Owner:** Documentation Team

**Subtasks:**
- [ ] 0.8.1: Update CONSOLIDATED_BUILDOUT_PLANS.md with BUILDOUT_VISION_2026
- [ ] 0.8.2: Update IMPLEMENTATION_STATUS_REPORT.md with current status
- [ ] 0.8.3: Create document cross-reference index
- [ ] 0.8.4: Archive superseded documents

**Acceptance Criteria:**
- All documents cross-referenced
- Superseded documents archived
- Single source of truth established

---

## Phase 1: Harness Layer & Core Services (Weeks 2-4)

### P1.1: Policy Engine Implementation
**Priority:** P1 - HIGH  
**Effort:** 2 weeks  
**Dependencies:** P0.4  
**Owner:** Backend Team

**Subtasks:**
- [ ] 1.1.1: Create policy engine crate (`harness/policies/engine.rs`)
- [ ] 1.1.2: Implement role isolation enforcement
- [ ] 1.1.3: Implement risk tier enforcement
- [ ] 1.1.4: Implement boundary validation
- [ ] 1.1.5: Implement allowlists/denylists
- [ ] 1.1.6: Create policy decision receipt format
- [ ] 1.1.7: Unit tests for all policy decisions

**Acceptance Criteria:**
- Policy engine enforces all rules
- Role violations blocked
- Risk tier mismatches detected
- All tests pass

---

### P1.2: Tool Wrapper System
**Priority:** P1 - HIGH  
**Effort:** 1 week  
**Dependencies:** P1.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 1.2.1: Create tool registry schema (`harness/tool/registry.rs`)
- [ ] 1.2.2: Implement tool wrapper with preconditions
- [ ] 1.2.3: Implement schema validation for tool calls
- [ ] 1.2.4: Implement safety level enforcement
- [ ] 1.2.5: Create typed wrappers for destructive tools
- [ ] 1.2.6: Implement tool call receipt emission

**Acceptance Criteria:**
- All tool calls pass through wrapper
- Schema validation enforced
- Safety levels respected
- Receipts emitted for all calls

---

### P1.3: Context Pack Builder
**Priority:** P1 - HIGH  
**Effort:** 1 week  
**Dependencies:** P0.4  
**Owner:** Backend Team

**Subtasks:**
- [ ] 1.3.1: Define context pack schema
- [ ] 1.3.2: Implement context pack builder (`harness/context_pack/builder.rs`)
- [ ] 1.3.3: Implement SOT snapshot
- [ ] 1.3.4: Implement architecture snapshot
- [ ] 1.3.5: Implement active deltas extraction
- [ ] 1.3.6: Implement contract extraction
- [ ] 1.3.7: Implement test harness summary
- [ ] 1.3.8: Write context packs to `/context_packs/`

**Acceptance Criteria:**
- Context packs generated deterministically
- All required sources included
- Packs validated against schema

---

### P1.4: A2A Review Protocol Implementation
**Priority:** P1 - HIGH  
**Effort:** 2 weeks  
**Dependencies:** P1.1, P1.2  
**Owner:** Backend Team

**Subtasks:**
- [ ] 1.4.1: Implement state machine (`harness/state/lifecycle.rs`)
- [ ] 1.4.2: Implement role-based transitions
- [ ] 1.4.3: Implement self-review stage
- [ ] 1.4.4: Implement structural validation stage
- [ ] 1.4.5: Implement test execution stage
- [ ] 1.4.6: Implement security scan stage
- [ ] 1.4.7: Implement policy evaluation stage
- [ ] 1.4.8: Implement escalation protocol

**Acceptance Criteria:**
- State machine transitions correctly
- Roles enforced at each stage
- Escalation works as specified

---

### P1.5: Observability Contract Implementation
**Priority:** P1 - HIGH  
**Effort:** 1 week  
**Dependencies:** P0.4  
**Owner:** Backend Team

**Subtasks:**
- [ ] 1.5.1: Define structured log schema
- [ ] 1.5.2: Implement correlation ID propagation
- [ ] 1.5.3: Create metrics schema
- [ ] 1.5.4: Create trace schema
- [ ] 1.5.5: Implement worktree isolation for observability
- [ ] 1.5.6: Create query interface specs

**Acceptance Criteria:**
- All logs structured JSON
- Correlation IDs present
- Metrics queryable
- Traces continuous

---

### P1.6: Garbage Collection Engine (Phase 1)
**Priority:** P1 - HIGH  
**Effort:** 1 week  
**Dependencies:** P1.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 1.6.1: Define golden principles (`agent/golden-principles.md`)
- [ ] 1.6.2: Create duplicate detector GC agent
- [ ] 1.6.3: Create boundary violation detector
- [ ] 1.6.4: Create missing observability detector
- [ ] 1.6.5: Create stale documentation detector
- [ ] 1.6.6: Implement entropy score calculation
- [ ] 1.6.7: Schedule daily GC runs

**Acceptance Criteria:**
- GC agents run daily
- Small PRs generated automatically
- Entropy score tracked

---

### P1.7: Evidence Store Implementation
**Priority:** P1 - HIGH  
**Effort:** 3 days  
**Dependencies:** P0.4  
**Owner:** Backend Team

**Subtasks:**
- [ ] 1.7.1: Create evidence store directory structure
- [ ] 1.7.2: Implement evidence emitter for runs
- [ ] 1.7.3: Implement evidence emitter for PRs
- [ ] 1.7.4: Implement drift report storage
- [ ] 1.7.5: Create evidence query interface

**Acceptance Criteria:**
- Evidence artifacts written correctly
- Schema validated
- Queryable

---

## Phase 2: Swarm Runtime & Worker System (Weeks 5-10)

### P2.1: Swarm Scheduler Core
**Priority:** P2 - MEDIUM  
**Effort:** 3 weeks  
**Dependencies:** P1.1, P1.4  
**Owner:** Backend Team

**Subtasks:**
- [ ] 2.1.1: Implement DAG validation
- [ ] 2.1.2: Implement topological sort
- [ ] 2.1.3: Implement READY queue management
- [ ] 2.1.4: Implement priority ordering
- [ ] 2.1.5: Implement worker allocation
- [ ] 2.1.6: Implement concurrency controls
- [ ] 2.1.7: Implement budget tracking
- [ ] 2.1.8: Implement admission control

**Acceptance Criteria:**
- DAGs validated correctly
- Execution order deterministic
- Budgets enforced
- Concurrency capped

---

### P2.2: Worker Supervisor
**Priority:** P2 - MEDIUM  
**Effort:** 2 weeks  
**Dependencies:** P2.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 2.2.1: Implement worker lifecycle management
- [ ] 2.2.2: Implement heartbeat protocol
- [ ] 2.2.3: Implement health monitoring
- [ ] 2.2.4: Implement worker registration
- [ ] 2.2.5: Implement capability advertising
- [ ] 2.2.6: Implement worker teardown

**Acceptance Criteria:**
- Workers registered correctly
- Heartbeats tracked
- Unhealthy workers replaced

---

### P2.3: Lease Management System
**Priority:** P2 - MEDIUM  
**Effort:** 1 week  
**Dependencies:** P2.2  
**Owner:** Backend Team

**Subtasks:**
- [ ] 2.3.1: Implement lease request protocol
- [ ] 2.3.2: Implement lease grant with TTL
- [ ] 2.3.3: Implement lease auto-renewal
- [ ] 2.3.4: Implement lease release
- [ ] 2.3.5: Implement path scoping for leases

**Acceptance Criteria:**
- Leases granted with correct scope
- Auto-renewal works
- Expired leases revoked

---

### P2.4: Receipt System
**Priority:** P2 - MEDIUM  
**Effort:** 1 week  
**Dependencies:** P1.2  
**Owner:** Backend Team

**Subtasks:**
- [ ] 2.4.1: Define receipt schema
- [ ] 2.4.2: Implement receipt emission for all tool calls
- [ ] 2.4.3: Implement receipt storage
- [ ] 2.4.4: Implement receipt query API
- [ ] 2.4.5: Implement receipt verification

**Acceptance Criteria:**
- All tool calls produce receipts
- Receipts queryable
- Verification works

---

### P2.5: Conflict Arbitration Engine
**Priority:** P2 - MEDIUM  
**Effort:** 1 week  
**Dependencies:** P2.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 2.5.1: Implement diff overlap detector
- [ ] 2.5.2: Implement priority-based arbitration
- [ ] 2.5.3: Implement evidence-based arbitration
- [ ] 2.5.4: Implement PR splitting for conflicts
- [ ] 2.5.5: Implement merge arbiter integration

**Acceptance Criteria:**
- Overlaps detected
- Arbitration deterministic
- PRs split correctly

---

### P2.6: Node Registry
**Priority:** P2 - MEDIUM  
**Effort:** 1 week  
**Dependencies:** P2.2  
**Owner:** Backend Team

**Subtasks:**
- [ ] 2.6.1: Implement node registration API
- [ ] 2.6.2: Implement capability tracking
- [ ] 2.6.3: Implement health monitoring
- [ ] 2.6.4: Implement routing metadata
- [ ] 2.6.5: Implement node discovery

**Acceptance Criteria:**
- Nodes registered
- Capabilities tracked
- Health visible

---

### P2.7: Event Bus Implementation
**Priority:** P2 - MEDIUM  
**Effort:** 1 week  
**Dependencies:** P2.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 2.7.1: Define event schema
- [ ] 2.7.2: Implement event bus
- [ ] 2.7.3: Implement event subscription
- [ ] 2.7.4: Implement event persistence
- [ ] 2.7.5: Implement event query

**Acceptance Criteria:**
- Events published correctly
- Subscriptions work
- Events persisted

---

### P2.8: BYOC Edge Runner
**Priority:** P2 - MEDIUM  
**Effort:** 2 weeks  
**Dependencies:** P2.2  
**Owner:** Backend Team

**Subtasks:**
- [ ] 2.8.1: Create edge runner binary
- [ ] 2.8.2: Implement secure tunnel to control plane
- [ ] 2.8.3: Implement worker manager
- [ ] 2.8.4: Implement heartbeat client
- [ ] 2.8.5: Implement tool execution layer
- [ ] 2.8.6: Create installation scripts

**Acceptance Criteria:**
- Edge runner installs on VPS
- Secure tunnel established
- Workers spawned

---

## Phase 3: UI Layer & Output Studio (Weeks 11-16)

### P3.1: Agent Studio Backend Wiring
**Priority:** P3 - MEDIUM  
**Effort:** 2 weeks  
**Dependencies:** P1.4  
**Owner:** Full Stack Team

**Subtasks:**
- [ ] 3.1.1: Wire voice settings to agent creation
- [ ] 3.1.2: Implement agent type differentiation UI
- [ ] 3.1.3: Wire Rails DAG execution pipeline
- [ ] 3.1.4: Implement prompt pack browser
- [ ] 3.1.5: Wire agent communication (Rails Mail)

**Acceptance Criteria:**
- Voice settings saved
- Agent types visible
- DAG execution works
- Prompt pack browsable

---

### P3.2: Output Studio Implementation
**Priority:** P3 - MEDIUM  
**Effort:** 4 weeks  
**Dependencies:** P1.7  
**Owner:** Full Stack Team

**Subtasks:**
- [ ] 3.2.1: Create Output Studio UI (`5-ui/a2r-platform/src/views/OutputStudio/`)
- [ ] 3.2.2: Implement asset library
- [ ] 3.2.3: Implement canvas editor
- [ ] 3.2.4: Implement timeline editor
- [ ] 3.2.5: Implement transform pipeline
- [ ] 3.2.6: Create plugin system
- [ ] 3.2.7: Implement render receipt generation
- [ ] 3.2.8: Create publishing connectors

**Acceptance Criteria:**
- Assets imported
- Canvas/timeline composition works
- Transforms apply
- Receipts generated

---

### P3.3: Marketplace Implementation
**Priority:** P3 - MEDIUM  
**Effort:** 3 weeks  
**Dependencies:** P3.2  
**Owner:** Full Stack Team

**Subtasks:**
- [ ] 3.3.1: Create marketplace UI
- [ ] 3.3.2: Implement plugin manifest schema
- [ ] 3.3.3: Implement capability indexing
- [ ] 3.3.4: Implement plugin installation
- [ ] 3.3.5: Implement compatibility filtering
- [ ] 3.3.6: Create discovery features

**Acceptance Criteria:**
- Plugins browsable
- Installation works
- Compatibility filtered

---

### P3.4: IVKGE Implementation (Phase 1)
**Priority:** P3 - MEDIUM  
**Effort:** 3 weeks  
**Dependencies:** P1.5  
**Owner:** Full Stack Team

**Subtasks:**
- [ ] 3.4.1: Create scene schema
- [ ] 3.4.2: Implement scene service API
- [ ] 3.4.3: Implement deterministic diagram ingestion
- [ ] 3.4.4: Implement entity/relation extraction for SVG
- [ ] 3.4.5: Implement click-to-explain
- [ ] 3.4.6: Implement evidence binding
- [ ] 3.4.7: Create artifact export

**Acceptance Criteria:**
- Diagrams ingested
- Entities clickable
- Explanations grounded
- Artifacts exportable

---

### P3.5: Canvas Protocol Enforcement
**Priority:** P3 - MEDIUM  
**Effort:** 1 week  
**Dependencies:** P1.1  
**Owner:** Frontend Team

**Subtasks:**
- [ ] 3.5.1: Implement CanvasSpec validation
- [ ] 3.5.2: Add risk encoding to interactions
- [ ] 3.5.3: Implement renderer contracts
- [ ] 3.5.4: Add missing canonical view types

**Acceptance Criteria:**
- CanvasSpec validated
- Risk declared
- Renderers constrained

---

## Phase 4: Advanced Features (Weeks 17-24)

### P4.1: Swarm Scheduler Advanced Features
**Priority:** P4 - STRATEGIC  
**Effort:** 2 weeks  
**Dependencies:** P2.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 4.1.1: Implement inter-agent message bus
- [ ] 4.1.2: Implement message typing
- [ ] 4.1.3: Implement message logging
- [ ] 4.1.4: Implement retry logic with backoff
- [ ] 4.1.5: Implement circuit breaker
- [ ] 4.1.6: Implement quarantine protocol

**Acceptance Criteria:**
- Messages typed and logged
- Retries work
- Circuit breaker trips
- Quarantine isolates

---

### P4.2: Policy Service Implementation
**Priority:** P4 - STRATEGIC  
**Effort:** 2 weeks  
**Dependencies:** P1.1  
**Owner:** Backend Team

**Decision Required:** Implement as separate service or keep in harness?

**Subtasks:**
- [ ] 4.2.1: Create policy service crate
- [ ] 4.2.2: Implement policy evaluation engine
- [ ] 4.2.3: Implement permission checks
- [ ] 4.2.4: Implement risk assessment
- [ ] 4.2.5: Implement confirmation requirements
- [ ] 4.2.6: Create policy service API

**Acceptance Criteria:**
- Policy decisions fast
- Permissions enforced
- Risk assessed correctly

---

### P4.3: Task Executor Implementation
**Priority:** P4 - STRATEGIC  
**Effort:** 2 weeks  
**Dependencies:** P2.2  
**Owner:** Backend Team

**Decision Required:** Implement as separate service or keep in kernel?

**Subtasks:**
- [ ] 4.3.1: Create task executor service
- [ ] 4.3.2: Implement sandboxed execution
- [ ] 4.3.3: Implement distributed compute coordination
- [ ] 4.3.4: Implement function/tool execution API
- [ ] 4.3.5: Implement resource management

**Acceptance Criteria:**
- Tasks execute in sandbox
- Distributed coordination works
- Resources managed

---

### P4.4: Presentation Kernel Implementation
**Priority:** P4 - STRATEGIC  
**Effort:** 1 week  
**Dependencies:** P3.5  
**Owner:** Frontend Team

**Subtasks:**
- [ ] 4.4.1: Implement situation resolver
- [ ] 4.4.2: Implement canvas selection
- [ ] 4.4.3: Implement capsule spawning mediator
- [ ] 4.4.4: Implement InteractionSpec producer

**Acceptance Criteria:**
- Situations resolved correctly
- Canvases selected appropriately
- Interactions defined

---

### P4.5: Directive Compiler Implementation
**Priority:** P4 - STRATEGIC  
**Effort:** 2 weeks  
**Dependencies:** P1.3  
**Owner:** Backend Team

**Subtasks:**
- [ ] 4.5.1: Implement intent parsing
- [ ] 4.5.2: Implement constraint compilation
- [ ] 4.5.3: Implement schema validation
- [ ] 4.5.4: Implement context budgeting
- [ ] 4.5.5: Implement explainable artifact emission

**Acceptance Criteria:**
- Intents parsed correctly
- Constraints compiled
- Artifacts explainable

---

### P4.6: IVKGE Advanced Features
**Priority:** P4 - STRATEGIC  
**Effort:** 2 weeks  
**Dependencies:** P3.4  
**Owner:** Full Stack Team

**Subtasks:**
- [ ] 4.6.1: Implement screenshot parsing
- [ ] 4.6.2: Implement OCR integration
- [ ] 4.6.3: Implement user correction tools
- [ ] 4.6.4: Implement natural image support
- [ ] 4.6.5: Implement ambiguity controls

**Acceptance Criteria:**
- Screenshots parsed
- Corrections work
- Ambiguity handled

---

### P4.7: VPS Partnership Integration
**Priority:** P4 - STRATEGIC  
**Effort:** 2 weeks  
**Dependencies:** P2.8  
**Owner:** DevOps Team

**Subtasks:**
- [ ] 4.7.1: Create DigitalOcean one-click install
- [ ] 4.7.2: Create Vultr one-click install
- [ ] 4.7.3: Create Hetzner one-click install
- [ ] 4.7.4: Implement affiliate tracking
- [ ] 4.7.5: Create partnership documentation

**Acceptance Criteria:**
- One-click installs work
- Affiliate tracking functional
- Documentation complete

---

## Critical Path Analysis

### Path 1: LAW → Harness → Swarm → Production
```
P0.1 LAW Consolidation (2d)
    ↓
P0.4 Harness Foundation (3d)
    ↓
P1.1 Policy Engine (2w)
    ↓
P2.1 Swarm Scheduler (3w)
    ↓
P2.2 Worker Supervisor (2w)
    ↓
P2.8 BYOC Edge Runner (2w)
    ↓
P4.1 Swarm Advanced (2w)
    ↓
MVP COMPLETE (Week 16)
```

### Path 2: UI Layer
```
P0.4 Harness Foundation (3d)
    ↓
P1.4 A2A Review Protocol (2w)
    ↓
P3.1 Agent Studio Wiring (2w)
    ↓
P3.2 Output Studio (4w)
    ↓
P3.3 Marketplace (3w)
    ↓
COMPLETE (Week 16)
```

### Path 3: Knowledge Graph
```
P1.5 Observability Contract (1w)
    ↓
P3.4 IVKGE Phase 1 (3w)
    ↓
P4.6 IVKGE Advanced (2w)
    ↓
COMPLETE (Week 10)
```

---

## Resource Allocation

### Week 1-4 (Phase 0-1)
- **Backend:** 4 engineers (Harness, Policy, Tools)
- **Frontend:** 1 engineer (CI gates)
- **Architecture:** 2 engineers (LAW, Specs)

### Week 5-10 (Phase 2)
- **Backend:** 6 engineers (Scheduler, Workers, Leases, Receipts)
- **DevOps:** 1 engineer (Edge Runner)
- **Architecture:** 1 engineer (Swarm spec)

### Week 11-16 (Phase 3)
- **Full Stack:** 4 engineers (Output Studio, Marketplace)
- **Frontend:** 2 engineers (Agent Studio, IVKGE)
- **Backend:** 2 engineers (Harness maintenance)

### Week 17-24 (Phase 4)
- **Backend:** 4 engineers (Advanced Swarm, Policy Service, Task Executor)
- **Frontend:** 2 engineers (Presentation Kernel, IVKGE)
- **DevOps:** 2 engineers (VPS Partnerships)

---

## Milestone Definitions

### Milestone 1: LAW Consolidated (End Week 1)
- PROJECT_LAW.md at repo root
- ARCHITECTURE.md accurate
- Harness foundation complete

### Milestone 2: Harness Gates Active (End Week 4)
- Policy engine enforcing
- Tool wrappers active
- A2A review working
- CI gates passing

### Milestone 3: Swarm MVP (End Week 10)
- DAG scheduler working
- Workers spawning
- Leases managed
- Receipts emitted

### Milestone 4: Output Studio Live (End Week 16)
- Asset library working
- Canvas/timeline composition
- Plugin system active
- Marketplace browsable

### Milestone 5: Production Ready (End Week 24)
- Advanced swarm features
- Policy service live
- IVKGE complete
- VPS partnerships active

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LAW consolidation delayed | Low | High | Architecture team dedicated |
| Harness too complex | Medium | High | MVP scope strictly enforced |
| Swarm scheduler bugs | Medium | High | Extensive testing, gradual rollout |
| UI/UX poor adoption | Medium | Medium | User testing early |
| VPS partnerships slow | High | Low | BYOC works regardless |
| Resource constraints | Medium | High | Prioritize critical path |

---

**End of Master DAG Task Breakdown**
