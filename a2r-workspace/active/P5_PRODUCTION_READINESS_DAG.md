# P5 PRODUCTION READINESS - DAG TASK BREAKDOWN

**Date:** 2026-02-21
**Status:** NEW - Ready to Start
**Goal:** Transform P5 stub implementations into production-ready code
**Total Effort:** 6-8 weeks

---

## Overview

The P5 phase crates (Receipts Schema, Policy Tier Gating, ShellUI BrowserView, Security Hardening) are well-architected but contain simulation/stub code. This DAG task breakdown converts them to production-ready implementations with real integrations.

---

## P5.2.2: BrowserView Playwright Integration (3 weeks)

### P5.2.2.1: Playwright Rust Binding Setup
**Effort:** 3 days
**Dependencies:** None
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.2.2.1.1: Add playwright rust dependency (`playwright-rs-client` or `thirtyfour`)
- [ ] 5.2.2.1.2: Create Playwright browser launcher
- [ ] 5.2.2.1.3: Implement browser context management
- [ ] 5.2.2.1.4: Add Playwright connection pooling
- [ ] 5.2.2.1.5: Create error handling for Playwright failures

**Deliverables:**
- `6-ui/shell-ui/src/views/browserview/src/playwright/launcher.rs`
- `6-ui/shell-ui/src/views/browserview/src/playwright/context.rs`
- `6-ui/shell-ui/src/views/browserview/src/playwright/error.rs`

**Acceptance Criteria:**
- Can launch headless Chrome via Playwright
- Browser context created and destroyed properly
- Connection errors handled gracefully

---

### P5.2.2.2: Real Navigation Implementation
**Effort:** 4 days
**Dependencies:** P5.2.2.1
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.2.2.2.1: Replace simulated navigation with Playwright `page.goto()`
- [ ] 5.2.2.2.2: Implement real page load event handling
- [ ] 5.2.2.2.3: Add navigation timeout handling
- [ ] 5.2.2.2.4: Implement redirect chain tracking
- [ ] 5.2.2.2.5: Add page title extraction from real DOM
- [ ] 5.2.2.2.6: Implement stop loading functionality

**Deliverables:**
- Updated `6-ui/shell-ui/src/views/browserview/src/navigation.rs`
- New `6-ui/shell-ui/src/views/browserview/src/playwright/page.rs`

**Acceptance Criteria:**
- Navigation loads real web pages
- Page title extracted from actual DOM
- Redirect chain captured
- Timeout errors handled

---

### P5.2.2.3: Real DOM Operations
**Effort:** 5 days
**Dependencies:** P5.2.2.2
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.2.2.3.1: Implement real `click()` via Playwright
- [ ] 5.2.2.3.2: Implement real `type_text()` via Playwright
- [ ] 5.2.2.3.3: Implement real `extract()` with CSS selectors
- [ ] 5.2.2.3.4: Implement real `scroll()` functionality
- [ ] 5.2.2.3.5: Implement `wait_for()` with Playwright wait conditions
- [ ] 5.2.2.3.6: Implement JavaScript `evaluate()` with real execution

**Deliverables:**
- Updated `6-ui/shell-ui/src/views/browserview/src/navigation.rs`
- New `6-ui/shell-ui/src/views/browserview/src/playwright/dom.rs`

**Acceptance Criteria:**
- Click triggers real page events
- Text input works on real forms
- Content extraction returns actual DOM content
- JavaScript evaluation returns real results

---

### P5.2.2.4: Real Screenshot/Capture
**Effort:** 3 days
**Dependencies:** P5.2.2.2
**Priority:** HIGH

**Subtasks:**
- [ ] 5.2.2.4.1: Implement full-page screenshot via Playwright
- [ ] 5.2.2.4.2: Implement viewport screenshot
- [ ] 5.2.2.4.3: Add PNG/JPEG/WebP format support
- [ ] 5.2.2.4.4: Implement thumbnail generation
- [ ] 5.2.2.4.5: Add screenshot file persistence
- [ ] 5.2.2.4.6: Implement element-specific screenshots

**Deliverables:**
- Updated `6-ui/shell-ui/src/views/browserview/src/capture.rs`
- New `6-ui/shell-ui/src/views/browserview/src/playwright/screenshot.rs`

**Acceptance Criteria:**
- Screenshots saved as real image files
- Multiple formats supported
- Full-page and viewport modes work
- Thumbnails generated

---

### P5.2.2.5: Session/Cookie Management
**Effort:** 3 days
**Dependencies:** P5.2.2.2
**Priority:** HIGH

**Subtasks:**
- [ ] 5.2.2.5.1: Implement real cookie storage/retrieval
- [ ] 5.2.2.5.2: Add cookie persistence across sessions
- [ ] 5.2.2.5.3: Implement localStorage/sessionStorage
- [ ] 5.2.2.5.4: Add session export/import
- [ ] 5.2.2.5.5: Implement secure cookie handling

**Deliverables:**
- Updated `6-ui/shell-ui/src/views/browserview/src/session.rs`
- New `6-ui/shell-ui/src/views/browserview/src/playwright/storage.rs`

**Acceptance Criteria:**
- Cookies persist across page loads
- Session can be saved and restored
- LocalStorage accessible

---

### P5.2.2.6: Agent Renderer Integration
**Effort:** 3 days
**Dependencies:** P5.2.2.3
**Priority:** HIGH

**Subtasks:**
- [ ] 5.2.2.6.1: Implement AGENT renderer mode
- [ ] 5.2.2.6.2: Add agent action logging
- [ ] 5.2.2.6.3: Implement agent-specific timeouts
- [ ] 5.2.2.6.4: Add agent action receipts
- [ ] 5.2.2.6.5: Implement HUMAN vs AGENT separation enforcement

**Deliverables:**
- Updated `6-ui/shell-ui/src/views/browserview/src/lib.rs`
- New `6-ui/shell-ui/src/views/browserview/src/agent/renderer.rs`

**Acceptance Criteria:**
- Agent actions logged separately
- Receipts emitted for agent actions
- Renderer separation enforced

---

## P5.2.3: BrowserView Electron Integration (2 weeks)

### P5.2.3.1: Electron BrowserView Setup
**Effort:** 4 days
**Dependencies:** P5.2.2.1
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.2.3.1.1: Create Electron IPC bridge to Rust
- [ ] 5.2.3.1.2: Implement BrowserView creation/destruction
- [ ] 5.2.3.1.3: Add BrowserView event forwarding
- [ ] 5.2.3.1.4: Implement BrowserView sizing/positioning
- [ ] 5.2.3.1.5: Add multi-BrowserView support

**Deliverables:**
- `6-ui/shell-ui/src/views/browserview/src/electron/bridge.rs`
- `6-ui/shell-ui/src/views/browserview/src/electron/webview.rs`
- `7-apps/shell-electron/src/browser-view.ts` (TypeScript)

**Acceptance Criteria:**
- Rust can create Electron BrowserView
- Events forwarded between Rust and Electron
- Multiple BrowserViews supported

---

### P5.2.3.2: ShellUI Component Integration
**Effort:** 3 days
**Dependencies:** P5.2.3.1
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.2.3.2.1: Create React BrowserView component
- [ ] 5.2.3.2.2: Wire navigation controls to Rust backend
- [ ] 5.2.3.2.3: Implement URL bar with real navigation
- [ ] 5.2.3.2.4: Add back/forward/reload buttons
- [ ] 5.2.3.2.5: Implement loading indicator

**Deliverables:**
- `6-ui/a2r-platform/src/components/browser/BrowserView.tsx`
- `6-ui/a2r-platform/src/components/browser/BrowserToolbar.tsx`
- `6-ui/a2r-platform/src/components/browser/BrowserState.ts`

**Acceptance Criteria:**
- BrowserView renders in ShellUI
- Navigation controls functional
- State synchronized with Rust backend

---

### P5.2.3.3: Tab Management
**Effort:** 3 days
**Dependencies:** P5.2.3.2
**Priority:** MEDIUM

**Subtasks:**
- [ ] 5.2.3.3.1: Implement tab bar UI
- [ ] 5.2.3.3.2: Add tab creation/closing
- [ ] 5.2.3.3.3: Implement tab switching
- [ ] 5.2.3.3.4: Add tab favicon support
- [ ] 5.2.3.3.5: Implement tab persistence

**Deliverables:**
- `6-ui/a2r-platform/src/components/browser/TabBar.tsx`
- `6-ui/a2r-platform/src/components/browser/TabState.ts`

**Acceptance Criteria:**
- Multiple tabs can be opened
- Tab switching works
- Tabs persist across sessions

---

## P5.1.4: Receipts SYSTEM_LAW Integration (1 week)

### P5.1.4.1: Auto-Emission on Tool Execution
**Effort:** 3 days
**Dependencies:** None
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.1.4.1.1: Add receipt emission to tool executor
- [ ] 5.1.4.1.2: Implement pre-tool receipt (tool_call_pre)
- [ ] 5.1.4.1.3: Implement post-tool receipt (tool_call_post)
- [ ] 5.1.4.1.4: Add receipt correlation ID tracking
- [ ] 5.1.4.1.5: Implement receipt batching

**Deliverables:**
- `2-governance/evidence-management/receipts-schema/src/auto_emission.rs`
- Updated `1-kernel/execution/a2r-ops/src/tool_executor.rs`

**Acceptance Criteria:**
- Receipts automatically emitted on tool execution
- Pre and post receipts correlated
- No manual receipt creation needed

---

### P5.1.4.2: SYSTEM_LAW Logging Integration
**Effort:** 2 days
**Dependencies:** P5.1.4.1
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.1.4.2.1: Wire receipts to SYSTEM_LAW audit log
- [ ] 5.1.4.2.2: Implement receipt query from SYSTEM_LAW
- [ ] 5.1.4.2.3: Add receipt-based violation detection
- [ ] 5.1.4.2.4: Implement receipt retention policy

**Deliverables:**
- Updated `1-kernel/infrastructure/system-law/src/lib.rs`
- Updated `2-governance/evidence-management/receipts-schema/src/integration.rs`

**Acceptance Criteria:**
- All receipts logged to SYSTEM_LAW
- Can query receipts via SYSTEM_LAW
- Violations detected from receipt analysis

---

### P5.1.4.3: Ralph Loop Integration
**Effort:** 2 days
**Dependencies:** P5.1.4.2
**Priority:** HIGH

**Subtasks:**
- [ ] 5.1.4.3.1: Add receipt query to Ralph Loop
- [ ] 5.1.4.3.2: Implement duplicate detection via receipts
- [ ] 5.1.4.3.3: Add node completion check via receipts
- [ ] 5.1.4.3.4: Implement receipt-based retry logic

**Deliverables:**
- Updated `4-services/orchestration/node-registry/src/ralph_loop.rs`

**Acceptance Criteria:**
- Ralph Loop queries receipts before execution
- Duplicates detected and skipped
- Node completion determined from receipts

---

## P5.1.5: Policy Gating Tool Integration (1 week)

### P5.1.5.1: Tool Registry Tier Assignment
**Effort:** 3 days
**Dependencies:** None
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.1.5.1.1: Add tier assignment to tool registration
- [ ] 5.1.5.1.2: Implement automatic tier based on tool class
- [ ] 5.1.5.1.3: Add tier override capability
- [ ] 5.1.5.1.4: Implement tier persistence

**Deliverables:**
- Updated `1-kernel/control-plane/unified-registry/tool-registry/src/lib.rs`
- New `2-governance/identity-access-control/policy-tier-gating/src/tool_integration.rs`

**Acceptance Criteria:**
- Tools registered with tier assignments
- Automatic tier classification works
- Tier can be overridden

---

### P5.1.5.2: Gate Check at Tool Execution
**Effort:** 3 days
**Dependencies:** P5.1.5.1
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.1.5.2.1: Add gate check before tool execution
- [ ] 5.1.5.2.2: Implement tier violation handling
- [ ] 5.1.5.2.3: Add approval workflow integration
- [ ] 5.1.5.2.4: Implement escalation on tier mismatch
- [ ] 5.1.5.2.5: Add gate check receipts

**Deliverables:**
- Updated `1-kernel/execution/a2r-ops/src/tool_executor.rs`
- Updated `2-governance/identity-access-control/policy-tier-gating/src/executor_gate.rs`

**Acceptance Criteria:**
- Gate check runs before every tool execution
- Tier violations block execution
- Approvals obtained when required

---

### P5.1.5.3: Policy Dashboard
**Effort:** 2 days
**Dependencies:** P5.1.5.2
**Priority:** MEDIUM

**Subtasks:**
- [ ] 5.1.5.3.1: Create policy tier dashboard UI
- [ ] 5.1.5.3.2: Show tool tier assignments
- [ ] 5.1.5.3.3: Display approval queue
- [ ] 5.1.5.3.4: Add tier elevation requests

**Deliverables:**
- `6-ui/a2r-platform/src/views/policy/PolicyDashboard.tsx`
- `6-ui/a2r-platform/src/views/policy/TierAssignments.tsx`
- `6-ui/a2r-platform/src/views/policy/ApprovalQueue.tsx`

**Acceptance Criteria:**
- Dashboard shows all tier assignments
- Approval queue visible
- Can request tier elevation

---

## P5.5.1: Security Middleware Integration (1 week)

### P5.5.1.1: Axum App Integration
**Effort:** 2 days
**Dependencies:** None
**Priority:** CRITICAL

**Subtasks:**
- [ ] 5.5.1.1.1: Add security middleware to main Axum app
- [ ] 5.5.1.1.2: Configure security headers layer
- [ ] 5.5.1.1.3: Add rate limiting to API routes
- [ ] 5.5.1.1.4: Implement threat detection middleware
- [ ] 5.5.1.1.5: Add security event logging

**Deliverables:**
- Updated `7-apps/api/src/main.rs`
- New `7-apps/api/src/security/mod.rs`

**Acceptance Criteria:**
- All API routes protected by security middleware
- Security headers added to all responses
- Rate limiting enforced
- Threats detected and logged

---

### P5.5.1.2: Input Validation at API Boundaries
**Effort:** 2 days
**Dependencies:** P5.5.1.1
**Priority:** HIGH

**Subtasks:**
- [ ] 5.5.1.2.1: Add input validation to all API endpoints
- [ ] 5.5.1.2.2: Implement request body sanitization
- [ ] 5.5.1.2.3: Add path parameter validation
- [ ] 5.5.1.2.4: Implement query parameter validation
- [ ] 5.5.1.2.5: Add header validation

**Deliverables:**
- Updated `7-apps/api/src/routes/*.rs` (all route files)
- New `7-apps/api/src/security/validation.rs`

**Acceptance Criteria:**
- All inputs validated
- Invalid requests rejected with 400
- Sanitization applied

---

### P5.5.1.3: Security Configuration Management
**Effort:** 2 days
**Dependencies:** P5.5.1.1
**Priority:** MEDIUM

**Subtasks:**
- [ ] 5.5.1.3.1: Create security config file format
- [ ] 5.5.1.3.2: Implement config hot-reload
- [ ] 5.5.1.3.3: Add security audit endpoint
- [ ] 5.5.1.3.4: Implement security metrics

**Deliverables:**
- `7-apps/api/config/security.toml`
- `7-apps/api/src/security/config.rs`
- `7-apps/api/src/routes/security.rs`

**Acceptance Criteria:**
- Security config can be updated without restart
- Audit endpoint returns security events
- Metrics exposed for monitoring

---

### P5.5.1.4: Threat Intelligence Integration
**Effort:** 2 days
**Dependencies:** P5.5.1.1
**Priority:** MEDIUM

**Subtasks:**
- [ ] 5.5.1.4.1: Add threat intelligence feed loading
- [ ] 5.5.1.4.2: Implement IP blocklist updates
- [ ] 5.5.1.4.3: Add known bad domain checking
- [ ] 5.5.1.4.4: Implement threat sharing protocol

**Deliverables:**
- Updated `2-governance/security-network/security-hardening/src/threat_detection.rs`
- New `2-governance/security-network/security-hardening/src/threat_intel.rs`

**Acceptance Criteria:**
- Threat intelligence loaded from file
- Blocklist updated dynamically
- Known bad IPs/domains blocked

---

## Testing Requirements

### Unit Tests (All Tasks)
- [ ] All new code has 80%+ unit test coverage
- [ ] All error paths tested
- [ ] Edge cases covered

### Integration Tests
- [ ] Playwright integration tests with real browser
- [ ] Electron IPC tests
- [ ] Receipts end-to-end tests
- [ ] Policy gate end-to-end tests
- [ ] Security middleware tests

### End-to-End Tests
- [ ] Browser automation E2E test
- [ ] Tool execution with policy gating E2E
- [ ] Security threat detection E2E

---

## Acceptance Criteria (Overall)

### BrowserView Production Ready
- [ ] Real web pages load via Playwright
- [ ] DOM operations work on real pages
- [ ] Screenshots saved as real images
- [ ] Sessions persist cookies/storage
- [ ] Agent renderer tracked separately

### Receipts Production Ready
- [ ] Auto-emitted on all tool executions
- [ ] Logged to SYSTEM_LAW
- [ ] Ralph Loop uses receipts for decisions

### Policy Gating Production Ready
- [ ] All tools have tier assignments
- [ ] Gate check enforced at execution
- [ ] Approvals obtained when required

### Security Production Ready
- [ ] All API routes protected
- [ ] Input validation on all endpoints
- [ ] Threats detected and blocked
- [ ] Security events logged

---

## Effort Summary

| Phase | Task | Effort |
|-------|------|--------|
| P5.2.2 | Playwright Integration | 3 weeks |
| P5.2.3 | Electron Integration | 2 weeks |
| P5.1.4 | Receipts Integration | 1 week |
| P5.1.5 | Policy Gating Integration | 1 week |
| P5.5.1 | Security Integration | 1 week |
| **Total** | | **8 weeks** |

---

## Dependencies

```
P5.2.2.1 (Playwright Setup)
    └── P5.2.2.2 (Navigation)
            ├── P5.2.2.3 (DOM Operations)
            ├── P5.2.2.4 (Capture)
            └── P5.2.2.6 (Agent Renderer)
            └── P5.2.3.1 (Electron Setup)
                    └── P5.2.3.2 (ShellUI Component)
                            └── P5.2.3.3 (Tab Management)

P5.1.4.1 (Auto-Emission)
    └── P5.1.4.2 (SYSTEM_LAW)
            └── P5.1.4.3 (Ralph Loop)

P5.1.5.1 (Tool Registry)
    └── P5.1.5.2 (Gate Check)
            └── P5.1.5.3 (Dashboard)

P5.5.1.1 (Axum Integration)
    ├── P5.5.1.2 (Input Validation)
    └── P5.5.1.3 (Config Management)
    └── P5.5.1.4 (Threat Intel)
```

---

**End of DAG Task Breakdown**
