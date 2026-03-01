# P4-P5 MASTER DAG TASK LIST

**Date:** 2026-02-21  
**Status:** Updated with corrected Agentation approach + all remaining tasks  
**Total Tasks:** 23 tasks  
**Total Effort:** ~38 weeks (down from 50 weeks after P4.15 audit)

---

## P4: Advanced Features (Remaining)

### P4.16: Agentation Integration (CORRECTED) 🔴 CRITICAL
**Effort:** 1 week (fork + integrate, NOT API-based)  
**Dependencies:** None  
**Owner:** Frontend Team

**Subtasks:**
- [ ] 16.1: Fork agentation repo (benjitaylor/agentation, PolyForm Shield 1.0.0)
- [ ] 16.2: Review license for A2R compatibility
- [ ] 16.3: Absorb into codebase as `6-ui/a2r-platform/src/dev/agentation/`
- [ ] 16.4: Remove API key dependency, make fully local
- [ ] 16.5: Add NODE_ENV gate (dev-only)
- [ ] 16.6: Integrate with Storybook preview
- [ ] 16.7: Create A2R adapter (execution header wrapper)
- [ ] 16.8: Create CLI helper script
- [ ] 16.9: Document workflow

**Acceptance Criteria:**
- Agentation runs fully local (no external API)
- Dev-only (never in production builds)
- Storybook integration works
- A2R adapter produces DAG-ready output

---

### P4.17: Storybook Evidence Lane 🔴 CRITICAL
**Effort:** 2 weeks  
**Dependencies:** P4.16 (Agentation)  
**Owner:** Frontend Team

**Subtasks:**
- [ ] 17.1: Create UI DAG subgraph template
- [ ] 17.2: Add storybook:build step
- [ ] 17.3: Add storybook:test (interaction tests)
- [ ] 17.4: Add visual-regression (Chromatic or local)
- [ ] 17.5: Add evidence:emit step
- [ ] 17.6: Create /ui/STORIES.md contract
- [ ] 17.7: Enforce in CI (hard fail if missing)
- [ ] 17.8: Integrate with Harness validation

**Acceptance Criteria:**
- UI changes trigger DAG lane automatically
- Missing stories = hard fail
- Failed Storybook = hard fail
- Evidence artifacts emitted to WIH

---

### P4.18: UI Contracts + Agent Roles 🟡 HIGH
**Effort:** 1 week  
**Dependencies:** P4.17 (Storybook Lane)  
**Owner:** Frontend Team

**Subtasks:**
- [ ] 18.1: Create UI_ARCHITECT.agent.yaml manifest
- [ ] 18.2: Create UI_IMPLEMENTER.agent.yaml manifest
- [ ] 18.3: Create UI_TESTER.agent.yaml manifest
- [ ] 18.4: Create UI_REVIEWER.agent.yaml manifest
- [ ] 18.5: Enforce role separation in Agentation adapter
- [ ] 18.6: Add role-based permissions to Storybook

**Acceptance Criteria:**
- Each role has distinct permissions
- Reviewer cannot write code
- Implementer cannot modify specs
- Agentation respects role boundaries

---

### P4.19: Ontology Runtime Binding 🔴 CRITICAL
**Effort:** 2 weeks  
**Dependencies:** P3.19 (SYSTEM_LAW)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 19.1: Create domain registry schema
- [ ] 19.2: Implement typed object graph
- [ ] 19.3: Add relationship constraints
- [ ] 19.4: Bind tools to ontology types
- [ ] 19.5: Add reasoning constraints based on ontology
- [ ] 19.6: Create ontology injection rules
- [ ] 19.7: Integrate with Context Pack Builder

**Acceptance Criteria:**
- Domain objects are typed at runtime
- Tool usage constrained by ontology
- Reasoning bounded by domain model
- Ontology injected into agent context

---

### P4.20: Evaluation Harness 🔴 CRITICAL
**Effort:** 2 weeks  
**Dependencies:** P4.16 (Agentation), P4.19 (Ontology)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 20.1: Define evaluation metrics schema
- [ ] 20.2: Create drift detection system
- [ ] 20.3: Implement golden tests framework
- [ ] 20.4: Add auto-run evals per DAG completion
- [ ] 20.5: Add auto-run evals per PR
- [ ] 20.6: Create scoring dashboard
- [ ] 20.7: Integrate with CI gates

**Acceptance Criteria:**
- Standardized scoring for all executions
- Drift metrics tracked over time
- Golden tests run automatically
- Scores visible in dashboard

---

### P4.21: Checkpointing / Recovery 🟡 HIGH
**Effort:** 1 week  
**Dependencies:** P2.1 (Scheduler)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 21.1: Define checkpoint schema
- [ ] 21.2: Add intermediate DAG snapshots
- [ ] 21.3: Implement resume from checkpoint
- [ ] 21.4: Add retry from checkpoint
- [ ] 21.5: Create postmortem traceability
- [ ] 21.6: Integrate with Memory Kernel

**Acceptance Criteria:**
- DAG execution can resume from checkpoint
- Retries start from last valid checkpoint
- Postmortem shows execution trace
- Checkpoints persisted to Memory Kernel

---

### P4.22: Observability Dashboard 🟡 MEDIUM
**Effort:** 2 weeks  
**Dependencies:** P4.21 (Checkpointing)  
**Owner:** Full Stack Team

**Subtasks:**
- [ ] 22.1: Create trace graph visualization
- [ ] 22.2: Add tool-call telemetry
- [ ] 22.3: Add cost/latency tracking
- [ ] 22.4: Add cache hit rate metrics
- [ ] 22.5: Add failure mode analysis
- [ ] 22.6: Create dashboard UI
- [ ] 22.7: Add alerting rules

**Acceptance Criteria:**
- Trace graph shows full execution path
- Tool-call telemetry visible per agent
- Cost/latency tracked per WIH
- Dashboard shows real-time status

---

### P4.23: Purpose Binding 🔴 CRITICAL
**Effort:** 1 week  
**Dependencies:** P3.20 (Harness Engineering)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 23.1: Add purpose field to WIH
- [ ] 23.2: Require purpose for all tool calls
- [ ] 23.3: Add hard gate when purpose missing
- [ ] 23.4: Add scope check (purpose vs WIH scope)
- [ ] 23.5: Log purpose binding to receipts
- [ ] 23.6: Add purpose drift detection

**Acceptance Criteria:**
- Every tool call has explicit purpose
- Purpose checked against WIH scope
- Missing purpose = hard fail
- Purpose logged to receipts

---

### P4.1-P4.6: Swarm Advanced (DEFERRED)
**Effort:** 13 weeks  
**Dependencies:** All critical P4 tasks  
**Owner:** Backend Team

**Note:** Deferred until critical enforcement layers complete.

**Subtasks:**
- [ ] 1.1: Implement inter-agent message bus
- [ ] 1.2: Implement message typing
- [ ] 1.3: Implement message logging
- [ ] 1.4: Implement retry logic with backoff
- [ ] 1.5: Implement circuit breaker
- [ ] 1.6: Implement quarantine protocol
- [ ] 2.1-6.6: [Additional swarm tasks]

**Acceptance Criteria:**
- [Deferred]

---

### P4.9: Multimodal Streaming 🟡 MEDIUM
**Effort:** 3 weeks  
**Dependencies:** P4.10 (Memory Kernel)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 9.1: Vision streaming integration
- [ ] 9.2: Audio streaming integration
- [ ] 9.3: Multimodal context packs
- [ ] 9.4: Vision + audio receipts

**Acceptance Criteria:**
- Vision streaming works
- Audio streaming works
- Multimodal context packs generated

---

### P4.11: Tambo Integration 🟡 MEDIUM
**Effort:** 2 weeks  
**Dependencies:** P3.22 (Canvas Protocol)  
**Owner:** Full Stack Team

**Subtasks:**
- [ ] 11.1: Tambo UI generation integration
- [ ] 11.2: Canvas generation from prompts
- [ ] 11.3: Receipt emission for generated UI

**Acceptance Criteria:**
- Tambo generates UI from prompts
- Generated UI has receipts
- Canvas protocol enforced

---

### P4.13: Garbage Collection Agents 🟡 MEDIUM
**Effort:** 1 week  
**Dependencies:** P4.7 (Evolution Layer)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 13.1: Define GC agent manifests
- [ ] 13.2: Implement entropy detection
- [ ] 13.3: Implement automated cleanup
- [ ] 13.4: Add GC receipts

**Acceptance Criteria:**
- GC agents run on schedule
- Entropy detected and cleaned
- Cleanup logged to receipts

---

### P4.15: Legacy Spec Audit ✅ COMPLETE
**Effort:** 1 week ✅  
**Status:** COMPLETE  
**Finding:** Browser-runtime 80% exists, reduces P5 from 17→7 weeks

---

## P5: Browser Agent System (Revised)

### P5.1.2: Receipts Schema (browser-runtime) 🔴 CRITICAL
**Effort:** 1 week  
**Dependencies:** P4.15 (Audit complete)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 2.1: Add Receipts schema to browser-runtime
- [ ] 2.2: Generate receipts for all actions
- [ ] 2.3: Store receipts in Evidence Store
- [ ] 2.4: Query API for receipts

**Acceptance Criteria:**
- All browser actions emit receipts
- Receipts match Receipts.schema.json
- Receipts queryable by WIH

---

### P5.1.3: Policy Tier Gating (browser-runtime) 🔴 CRITICAL
**Effort:** 1 week  
**Dependencies:** P3.20 (Harness), P5.1.2 (Receipts)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 3.1: Add Policy Tiers (0-4) to browser-runtime
- [ ] 3.2: Implement host allowlist
- [ ] 3.3: Implement path allowlist
- [ ] 3.4: Implement element allowlist (high-risk)
- [ ] 3.5: Add ConfirmGate endpoint
- [ ] 3.6: Integrate with Harness RiskPolicy

**Acceptance Criteria:**
- All tiers enforced correctly
- ConfirmGate requires user confirmation
- Host/path/element allowlists work
- Default-deny posture

---

### P5.2.1: ShellUI BrowserView Integration 🔴 CRITICAL
**Effort:** 2 weeks  
**Dependencies:** P5.1.2, P5.1.3  
**Owner:** Frontend Team

**Subtasks:**
- [ ] 2.1: Fix ShellUI viewInstanceId stability (from recovery plan)
- [ ] 2.2: Integrate browser-runtime with ShellUI
- [ ] 2.3: Create Browser Capsule UI component
- [ ] 2.4: Implement HUMAN/AGENT renderer separation
- [ ] 2.5: Test session synchronization

**Acceptance Criteria:**
- Browser tabs don't spawn on repeat clicks
- HUMAN/AGENT renderers work
- Session persists across focus changes
- Browser Capsule UI functional

---

### P5.4: DAG/WIH Integration 🟡 HIGH
**Effort:** 2 weeks  
**Dependencies:** P5.2.1 (ShellUI)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 4.1: Add browser_run node type to DAG
- [ ] 4.2: Implement browser action list in node spec
- [ ] 4.3: Add step/time budget configuration
- [ ] 4.4: Implement evidence attachment to WIH
- [ ] 4.5: Create evidence query API
- [ ] 4.6: Integrate with Harness merge gates

**Acceptance Criteria:**
- DAG nodes can request browser actions
- Browser runs execute with receipts
- Evidence attaches to WIH
- Merge gates use browser evidence

---

### P5.5: Security Hardening 🔴 CRITICAL
**Effort:** 1 week  
**Dependencies:** P5.1.3 (Policy Tiers)  
**Owner:** Security Team

**Subtasks:**
- [ ] 5.1: Implement prompt injection resistance
- [ ] 5.2: Implement sensitive data redaction
- [ ] 5.3: Implement default-deny enforcement
- [ ] 5.4: Security audit + penetration test

**Acceptance Criteria:**
- Prompt injection blocked
- Sensitive data redacted
- Default-deny enforced
- Security audit passes

---

## Summary by Priority

### 🔴 CRITICAL (Must Do First - 13 weeks)
| Task | Effort | Why |
|------|--------|-----|
| P4.16: Agentation Integration | 1 week | Dev productivity, visual feedback |
| P4.17: Storybook Evidence Lane | 2 weeks | UI validation enforcement |
| P4.19: Ontology Runtime Binding | 2 weeks | Constrains reasoning |
| P4.20: Evaluation Harness | 2 weeks | Quality gates |
| P4.23: Purpose Binding | 1 week | Hard gates for tool calls |
| P5.1.2: Receipts Schema | 1 week | Evidence for browser actions |
| P5.1.3: Policy Tier Gating | 1 week | Browser automation safety |
| P5.2.1: ShellUI BrowserView | 2 weeks | Primary browsing surface |
| P5.5: Security Hardening | 1 week | Prompt injection resistance |

### 🟡 HIGH (Do Second - 6 weeks)
| Task | Effort | Why |
|------|--------|-----|
| P4.18: UI Contracts + Agent Roles | 1 week | Role separation |
| P4.21: Checkpointing / Recovery | 1 week | DAG resume/retry |
| P5.4: DAG/WIH Integration | 2 weeks | Browser in DAG workflows |
| P4.22: Observability Dashboard | 2 weeks | Trace/telemetry visibility |

### 🟡 MEDIUM (Do Later - 8 weeks)
| Task | Effort | Why |
|------|--------|-----|
| P4.9: Multimodal Streaming | 3 weeks | Vision + audio |
| P4.11: Tambo Integration | 2 weeks | UI generation |
| P4.13: GC Agents | 1 week | Entropy cleanup |
| P4.1-P4.6: Swarm Advanced | 13 weeks | Scaling features (DEFERRED) |

---

## Total Timeline

| Phase | Tasks | Critical | High | Medium | Deferred | Total |
|-------|-------|----------|------|--------|----------|-------|
| **P4** | 14 | 5 (7 wks) | 3 (4 wks) | 4 (6 wks) | 1 (13 wks) | 30 wks |
| **P5** | 5 | 4 (5 wks) | 1 (2 wks) | 0 | 0 | 7 wks |
| **TOTAL** | **19** | **9 (12 wks)** | **4 (6 wks)** | **4 (6 wks)** | **1 (13 wks)** | **37 wks** |

**Critical Path:** 12 weeks to MVP (all 🔴 tasks)

---

**End of Master DAG Task List**
