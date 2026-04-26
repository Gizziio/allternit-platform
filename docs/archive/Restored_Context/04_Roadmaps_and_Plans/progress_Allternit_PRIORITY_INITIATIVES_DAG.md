# Allternit Priority Initiatives DAG

> **Execution Plan for Post-Moltis-Analysis Priorities**
> Version: 2026-02-13
> Status: Ready for WIH Pickup

---

## Overview

This DAG tracks the 4 priority initiatives identified from the Moltis analysis:

1. **MCP Ecosystem Integration** (Highest Priority)
2. **OpenClaw Skill Compatibility Completion**
3. **Documentation & Developer Experience**
4. **Single-Binary Distribution**

---

## DAG Structure

```
Phase 1: Foundation (Weeks 1-2)
├── N00: Audit existing MCP TypeScript implementation
├── N01: Design Rust MCP client architecture
├── N02: Audit OpenClaw parity status (N4-N12 remaining)
├── N03: Design single-binary distribution strategy
└── N04: Create documentation improvement plan

Phase 2: MCP Integration (Weeks 3-6)
├── N10: Implement MCP JSON-RPC 2.0 transport (stdio)
├── N11: Implement MCP HTTP/SSE transport
├── N12: Implement MCP tool bridge for tools-gateway
├── N13: Add MCP server registry persistence
├── N14: Build MCP health monitoring & auto-restart
└── N15: Integrate MCP with Allternit policy engine

Phase 3: OpenClaw Parity Completion (Weeks 4-8)
├── N20: Native chat + stream + abort + inject (N5)
├── N21: Native channels + QR + config patch (N6)
├── N22: Native sessions + instances + cron (N7)
├── N23: Native skills + nodes + exec approvals (N8)
├── N24: Native config get/set/apply + schema (N9)
├── N25: Native debug + logs + update/restart (N10)
├── N26: A/B parity harness and rollout gate (N11)
└── N27: Gradual cutover by tab (N12)

Phase 4: Distribution & Docs (Weeks 6-10)
├── N30: Implement single-binary build pipeline
├── N31: Create static asset embedding system
├── N32: Build self-extracting installer
├── N33: Write crate-level documentation
├── N34: Create API reference documentation
├── N35: Build developer onboarding guide
└── N36: Create architecture decision records

Phase 5: Integration & Release (Weeks 9-12)
├── N40: Integration testing (MCP + Parity + Single-binary)
├── N41: Performance benchmarking
├── N42: Security audit
├── N43: Beta release
└── N44: Production rollout
```

---

## Node Definitions

### Phase 1: Foundation

#### N00: Audit existing MCP TypeScript implementation
- **Type**: Research
- **Assignee**: TBD
- **Estimate**: 1 day
- **Dependencies**: None
- **Outputs**:
  - Document of current MCP client capabilities
  - Gap analysis vs moltis-mcp
  - API surface mapping
- **Acceptance**:
  - [ ] List all MCP features in `surfaces/allternit-platform/src/lib/ai/mcp/`
  - [ ] Compare with moltis-mcp crate
  - [ ] Identify missing transport types
  - [ ] Document OAuth implementation status

#### N01: Design Rust MCP client architecture
- **Type**: Design
- **Assignee**: TBD
- **Estimate**: 2 days
- **Dependencies**: N00
- **Outputs**:
  - Architecture RFC
  - Crate structure proposal
  - Integration plan with tools-gateway
- **Acceptance**:
  - [ ] Design doc in `docs/rfcs/mcp-client-architecture.md`
  - [ ] Define trait boundaries
  - [ ] Plan integration with existing tool registry
  - [ ] Review with team

#### N02: Audit OpenClaw parity status
- **Type**: Research
- **Assignee**: TBD
- **Estimate**: 1 day
- **Dependencies**: None
- **Outputs**:
  - Current status of N4-N12
  - Blocker identification
  - Completion estimates
- **Acceptance**:
  - [ ] Review `allternit-openclaw-host/src/native_*.rs` files
  - [ ] Document completion status for each N4-N12
  - [ ] Identify dependencies between nodes
  - [ ] Update PARITY_PLAN.md

#### N03: Design single-binary distribution strategy
- **Type**: Design
- **Assignee**: TBD
- **Estimate**: 2 days
- **Dependencies**: None
- **Outputs**:
  - Distribution strategy RFC
  - Build pipeline design
  - Asset embedding approach
- **Acceptance**:
  - [ ] Research Moltis distribution approach
  - [ ] Design static asset embedding
  - [ ] Plan cross-platform builds
  - [ ] Define release artifact structure

#### N04: Create documentation improvement plan
- **Type**: Planning
- **Assignee**: TBD
- **Estimate**: 1 day
- **Dependencies**: None
- **Outputs**:
  - Documentation audit
  - Priority list for crate docs
  - Developer experience roadmap
- **Acceptance**:
  - [ ] Audit all 80+ crates for documentation
  - [ ] Identify critical public APIs needing docs
  - [ ] Create documentation style guide
  - [ ] Plan doc.rs integration

---

### Phase 2: MCP Integration

#### N10: Implement MCP JSON-RPC 2.0 transport (stdio)
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 3 days
- **Dependencies**: N01
- **Outputs**:
  - `mcp-transport-stdio` crate
  - Unit tests
  - Example usage
- **Acceptance**:
  - [ ] Spawn MCP server process
  - [ ] Bidirectional JSON-RPC over stdin/stdout
  - [ ] Handle server lifecycle (start/stop/crash)
  - [ ] Test with reference MCP servers

#### N11: Implement MCP HTTP/SSE transport
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 3 days
- **Dependencies**: N01
- **Outputs**:
  - `mcp-transport-sse` crate
  - Unit tests
  - OAuth integration
- **Acceptance**:
  - [ ] HTTP POST for JSON-RPC
  - [ ] SSE for server→client messages
  - [ ] Reconnection handling
  - [ ] OAuth token management

#### N12: Implement MCP tool bridge for tools-gateway
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 5 days
- **Dependencies**: N10, N11
- **Outputs**:
  - Integration in `tools-gateway`
  - MCP tool → Allternit tool adapter
  - Configuration schema
- **Acceptance**:
  - [ ] MCP tools appear in Allternit registry
  - [ ] Tool execution flows through policy engine
  - [ ] Result sanitization applied
  - [ ] Error handling aligned with Allternit patterns

#### N13: Add MCP server registry persistence
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 2 days
- **Dependencies**: N12
- **Outputs**:
  - SQLite schema for MCP servers
  - CRUD operations
  - Health status tracking
- **Acceptance**:
  - [ ] Store server configurations
  - [ ] Track connection health
  - [ ] Persist OAuth tokens securely
  - [ ] Migration from TypeScript config

#### N14: Build MCP health monitoring & auto-restart
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 3 days
- **Dependencies**: N13
- **Outputs**:
  - Health check polling
  - Exponential backoff restart
  - Event logging
- **Acceptance**:
  - [ ] Periodic health checks
  - [ ] Auto-restart on crash
  - [ ] Circuit breaker pattern
  - [ ] Metrics emission

#### N15: Integrate MCP with Allternit policy engine
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 3 days
- **Dependencies**: N12
- **Outputs**:
  - Policy hooks for MCP operations
  - Safety tier classification
  - Audit logging
- **Acceptance**:
  - [ ] MCP tool calls pass policy check
  - [ ] Server registration requires approval
  - [ ] All MCP operations logged to ledger
  - [ ] Configurable per-server policies

---

### Phase 3: OpenClaw Parity Completion

#### N20: Native chat + stream + abort + inject (N5)
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 5 days
- **Dependencies**: N02
- **WIH Context**:
  - Completes parity node N5
  - Replaces quarantine iframe for chat
- **Acceptance**:
  - [ ] Native chat UI in Allternit platform
  - [ ] Token streaming
  - [ ] Abort/cancel operation
  - [ ] Message injection capability

#### N21: Native channels + QR + config patch (N6)
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 4 days
- **Dependencies**: N20
- **WIH Context**:
  - Completes parity node N6
  - Telegram/channel integration
- **Acceptance**:
  - [ ] Channel configuration UI
  - [ ] QR code display for pairing
  - [ ] Config patch application
  - [ ] Channel status monitoring

#### N22: Native sessions + instances + cron (N7)
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 5 days
- **Dependencies**: N21
- **WIH Context**:
  - Completes parity node N7
  - Session management UI
- **Acceptance**:
  - [ ] Session list view
  - [ ] Instance management
  - [ ] Cron job configuration
  - [ ] Schedule visualization

#### N23: Native skills + nodes + exec approvals (N8)
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 6 days
- **Dependencies**: N22
- **WIH Context**:
  - Completes parity node N8
  - Skill marketplace integration
- **Acceptance**:
  - [ ] Skill browser/installer
  - [ ] Node management UI
  - [ ] Execution approval flows
  - [ ] Skill verification display

#### N24: Native config get/set/apply + schema (N9)
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 4 days
- **Dependencies**: N23
- **WIH Context**:
  - Completes parity node N9
  - Configuration management
- **Acceptance**:
  - [ ] Config editor with schema validation
  - [ ] Get/set operations
  - [ ] Apply with dry-run
  - [ ] Base-hash guard implementation

#### N25: Native debug + logs + update/restart (N10)
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 4 days
- **Dependencies**: N24
- **WIH Context**:
  - Completes parity node N10
  - Operational UI
- **Acceptance**:
  - [ ] Log viewer with filtering
  - [ ] Debug information display
  - [ ] Update check UI
  - [ ] Graceful restart control

#### N26: A/B parity harness and rollout gate (N11)
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 5 days
- **Dependencies**: N25
- **WIH Context**:
  - Completes parity node N11
  - Feature flag integration
- **Acceptance**:
  - [ ] A/B test framework
  - [ ] Parity metrics collection
  - [ ] Rollout gate controls
  - [ ] Fallback mechanism

#### N27: Gradual cutover by tab (N12)
- **Type**: Implementation
- **Assignee**: TBD
  - **Estimate**: 3 days
- **Dependencies**: N26
- **WIH Context**:
  - Completes parity node N12
  - Remove quarantine iframe
- **Acceptance**:
  - [ ] Per-tab migration
  - [ ] Remove iframe fallback
  - [ ] Cleanup quarantine code
  - [ ] Final verification

---

### Phase 4: Distribution & Documentation

#### N30: Implement single-binary build pipeline
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 5 days
- **Dependencies**: N03
- **Outputs**:
  - GitHub Actions workflow
  - Cross-platform builds
  - Release automation
- **Acceptance**:
  - [ ] Linux x86_64, arm64 builds
  - [ ] macOS x86_64, arm64 builds
  - [ ] Windows x86_64 builds
  - [ ] Automated releases

#### N31: Create static asset embedding system
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 4 days
- **Dependencies**: N30
- **Outputs**:
  - `rust-embed` integration
  - Asset compression
  - Hot-reload for dev
- **Acceptance**:
  - [ ] Web UI assets embedded
  - [ ] WASM capsules embedded
  - [ ] Configuration templates embedded
  - [ ] Runtime asset extraction

#### N32: Build self-extracting installer
- **Type**: Implementation
- **Assignee**: TBD
- **Estimate**: 3 days
- **Dependencies**: N31
- **Outputs**:
  - Install script
  - First-run setup
  - Update mechanism
- **Acceptance**:
  - [ ] One-liner install (curl | sh)
  - [ ] Homebrew formula
  - [ ] Windows installer
  - [ ] Auto-update check

#### N33: Write crate-level documentation
- **Type**: Documentation
- **Assignee**: TBD
- **Estimate**: 10 days
- **Dependencies**: N04
- **Outputs**:
  - rustdoc for all public APIs
  - Module-level documentation
  - Example code
- **Acceptance**:
  - [ ] 80+ crates have docs
  - [ ] All public traits documented
  - [ ] Architecture invariants documented
  - [ ] Examples compile and run

#### N34: Create API reference documentation
- **Type**: Documentation
- **Assignee**: TBD
- **Estimate**: 5 days
- **Dependencies**: N33
- **Outputs**:
  - OpenAPI spec completion
  - API guide
  - Authentication docs
- **Acceptance**:
  - [ ] All endpoints documented
  - [ ] Request/response examples
  - [ ] Error codes documented
  - [ ] Postman collection

#### N35: Build developer onboarding guide
- **Type**: Documentation
- **Assignee**: TBD
- **Estimate**: 5 days
- **Dependencies**: N33
- **Outputs**:
  - CONTRIBUTING.md
  - Architecture guide
  - Debugging guide
- **Acceptance**:
  - [ ] New dev can build in < 30 min
  - [ ] Architecture diagrams
  - [ ] Troubleshooting guide
  - [ ] Video walkthroughs

#### N36: Create architecture decision records
- **Type**: Documentation
- **Assignee**: TBD
- **Estimate**: 3 days
- **Dependencies**: None
- **Outputs**:
  - ADR directory
  - Key decision records
- **Acceptance**:
  - [ ] 10+ ADRs written
  - [ ] Layer architecture explained
  - [ ] Technology choices documented
  - [ ] Migration paths described

---

### Phase 5: Integration & Release

#### N40: Integration testing
- **Type**: Testing
- **Assignee**: TBD
- **Estimate**: 5 days
- **Dependencies**: N15, N27, N32
- **Acceptance**:
  - [ ] End-to-end MCP tests
  - [ ] Parity smoke tests pass
  - [ ] Single-binary works on all platforms
  - [ ] Performance regression tests

#### N41: Performance benchmarking
- **Type**: Testing
- **Assignee**: TBD
- **Estimate**: 3 days
- **Dependencies**: N40
- **Acceptance**:
  - [ ] Baseline metrics established
  - [ ] MCP overhead measured
  - [ ] Memory usage profiled
  - [ ] Benchmarks in CI

#### N42: Security audit
- **Type**: Security
- **Assignee**: TBD
- **Estimate**: 5 days
- **Dependencies**: N40
- **Acceptance**:
  - [ ] Dependency audit
  - [ ] MCP security review
  - [ ] Secret handling audit
  - [ ] Sandbox escape testing

#### N43: Beta release
- **Type**: Release
- **Assignee**: TBD
- **Estimate**: 2 days
- **Dependencies**: N41, N42
- **Acceptance**:
  - [ ] Beta tagged
  - [ ] Release notes
  - [ ] Migration guide
  - [ ] Community announcement

#### N44: Production rollout
- **Type**: Release
- **Assignee**: TBD
- **Estimate**: 3 days
- **Dependencies**: N43
- **Acceptance**:
  - [ ] Gradual rollout
  - [ ] Monitoring dashboards
  - [ ] Rollback plan
  - [ ] Post-mortem scheduled

---

## Critical Path

```
N00 → N01 → N10 → N11 → N12 → N15 ───────────────────────────────┐
                                                                   ▼
N02 → N20 → N21 → N22 → N23 → N24 → N25 → N26 → N27 ───────────→ N40
                                                                   ▼
N03 → N30 → N31 → N32 ───────────────────────────────────────────→ N41
                                                                   ▼
N04 → N33 → N34 → N35 → N36 ─────────────────────────────────────→ N43
```

**Critical path length**: ~12 weeks

---

## Resource Allocation

| Phase | Duration | Parallel Tracks | Team Size |
|-------|----------|-----------------|-----------|
| Foundation | 2 weeks | 4 | 2-3 |
| MCP Integration | 4 weeks | 3 | 2-3 |
| OpenClaw Parity | 5 weeks | 2 | 2-3 |
| Distribution & Docs | 5 weeks | 3 | 2-3 |
| Integration & Release | 4 weeks | All converge | 3-4 |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MCP spec changes | Medium | High | Monitor spec repo, design for extensibility |
| OpenClaw API drift | Medium | High | Automated parity tests, version pinning |
| Single-binary size | High | Medium | Feature flags, optional components |
| Doc writing delays | High | Low | Parallel tracks, tech writer support |

---

## Success Metrics

1. **MCP**: 10+ MCP servers usable from Allternit
2. **Parity**: 100% feature parity with OpenClaw
3. **Distribution**: Install time < 2 minutes
4. **Documentation**: doc.rs coverage > 80%

---

## Next Actions

1. Create WIHs for N00-N04 (Foundation phase)
2. Assign owners for each node
3. Schedule kickoff meeting
4. Set up tracking dashboard

---

*Generated from Moltis analysis recommendations*
*Last updated: 2026-02-13*
