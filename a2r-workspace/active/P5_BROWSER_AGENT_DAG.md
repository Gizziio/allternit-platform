# P5: BROWSER AGENT SYSTEM - DAG TASK BREAKDOWN

**Date:** 2026-02-20  
**Source:** `/Users/macbook/Desktop/agenticbrowserext.md`, `/Users/macbook/Desktop/spec/BrowserAgent/`  
**Total Effort:** ~14 weeks (including research)  
**Priority:** CRITICAL

---

## Phase Overview

The Browser Agent System enables **deterministic, policy-gated browser automation** integrated with A2R DAG/WIH workflows.

**Two Surfaces:**
1. **ShellUI Native Browser** - Primary sovereign agentic browser (Electron BrowserView + Playwright)
2. **Chrome Extension MV3** - External high-permission surface (Side Panel + Content Script)

**Shared Infrastructure:**
- Action Contract (JSON Schema - 12 action types)
- Receipts Schema (evidence, artifacts, trace events)
- Policy Tiers (Tier 0-4 risk model)
- Evidence Store (artifacts, receipts viewer)

---

## P5.0: Research & Analysis (2 weeks) 🔴 CRITICAL

### P5.0.1: ShellUI Browser Tab Research
**Effort:** 4 days  
**Dependencies:** None  
**Owner:** Research Team

**Subtasks:**
- [ ] 5.0.1.1: Audit existing ShellUI browser implementation
  - Location: `6-ui/shell-ui/`, `7-apps/shell-electron/`
  - Document current BrowserView setup
  - Identify gaps for agentic browsing
- [ ] 5.0.1.2: Research Electron BrowserView capabilities
  - Session management
  - Navigation controls
  - Screenshot/capture APIs
  - Security considerations
- [ ] 5.0.1.3: Document HUMAN vs AGENT renderer separation
  - Current state
  - Required changes
  - Integration points with Playwright
- [ ] 5.0.1.4: Create ShellUI architecture diagram
  - Component relationships
  - Data flow
  - Security boundaries

**Deliverables:**
- `docs/research/SHELLUI_BROWSER_AUDIT.md`
- `docs/research/SHELLUI_ARCHITECTURE.md`
- `docs/spec/BrowserAgent/ShellUI-Implementation-Plan.md`

**Acceptance Criteria:**
- Existing ShellUI capabilities documented
- Gap analysis complete
- Implementation plan approved

---

### P5.0.2: MiniApp Capsules Research
**Effort:** 4 days  
**Dependencies:** None  
**Owner:** Research Team

**Subtasks:**
- [ ] 5.0.2.1: Audit existing capsule implementation
  - Location: `1-kernel/capsule-system/`
  - Review a2r-capsule-sdk
  - Review capsule compiler/runtime
- [ ] 5.0.2.2: Research capsule-browser integration patterns
  - How capsules render in browser context
  - Session state management
  - Security isolation
- [ ] 5.0.2.3: Document Browser Capsule requirements
  - Session manager needs
  - Page sensor integration
  - Action engine integration
- [ ] 5.0.2.4: Create Browser Capsule spec
  - Capsule interface definition
  - State persistence model
  - Receipt integration

**Deliverables:**
- `docs/research/MINIAPP_CAPSULES_AUDIT.md`
- `docs/spec/BrowserAgent/Browser-Capsule-Spec.md`

**Acceptance Criteria:**
- Existing capsule capabilities documented
- Browser capsule requirements defined
- Integration approach approved

---

### P5.0.3: Playwright Integration Research
**Effort:** 3 days  
**Dependencies:** P5.0.1  
**Owner:** Research Team

**Subtasks:**
- [ ] 5.0.3.1: Research Playwright browser automation
  - Browser context management
  - Page control APIs
  - Selector strategies (aria/role/text/css/xpath)
  - Screenshot/capture APIs
- [ ] 5.0.3.2: Document AGENT renderer requirements
  - Headless vs hidden BrowserView
  - Session synchronization with HUMAN view
  - Authentication state sharing
- [ ] 5.0.3.3: Create Playwright integration plan
  - Rust bindings (playwright-rust)
  - Session management
  - Action execution pipeline

**Deliverables:**
- `docs/research/PLAYWRIGHT_INTEGRATION.md`
- `docs/spec/BrowserAgent/AGENT-Renderer-Spec.md`

**Acceptance Criteria:**
- Playwright capabilities documented
- Integration approach validated
- Security model approved

---

### P5.0.4: Evidence Store Research
**Effort:** 3 days  
**Dependencies:** P5.0.2  
**Owner:** Research Team

**Subtasks:**
- [ ] 5.0.4.1: Audit existing evidence/receipts implementation
  - Location: `2-governance/evidence-management/`
  - Review core-evidence crate
  - Review receipts store in Rails
- [ ] 5.0.4.2: Research browser-specific evidence requirements
  - Screenshot storage (PNG/WebP)
  - DOM snippet redaction
  - Download file hashing
  - Receipt viewer UI
- [ ] 5.0.4.3: Create Evidence Store spec
  - Directory structure
  - Artifact naming conventions
  - Hash verification
  - Receipts viewer API

**Deliverables:**
- `docs/research/EVIDENCE_STORE_AUDIT.md`
- `docs/spec/BrowserAgent/Evidence-Store-Spec.md`

**Acceptance Criteria:**
- Existing evidence capabilities documented
- Browser evidence requirements defined
- Storage approach approved

---

## P5.1: Browser Agent Core (4 weeks) 🔴 CRITICAL

### P5.1.1: Action Contract Implementation
**Effort:** 1.5 weeks  
**Dependencies:** P5.0 (Research complete)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.1.1.1: Create Action Contract JSON Schema crate
  - Location: `1-kernel/execution/browser-agent/action-contract/`
  - Implement BrowserAction schema validation
  - Implement 12 action types:
    - Navigate, Click, Type, Select, Scroll
    - Wait, Assert, Extract, Screenshot
    - Download, ConfirmGate, Noop
- [ ] 5.1.1.2: Implement selector strategies
  - CSS, XPath, Text, Aria, Role, Semantic
  - Fallback selector chains
  - Stability hints/scoring
- [ ] 5.1.1.3: Implement assertion types
  - UrlMatches, TitleContains, ElementExists
  - TextPresent, ValueEquals, NetworkIdle
  - Visible, NotVisible, AttributeEquals
  - CustomPredicate
- [ ] 5.1.1.4: Implement evidence requirements
  - Capture types (screenshot, DOM, extracts)
  - Redaction rules (maskSelectors, maskRegexes)
  - Budget enforcement (step/time)

**Deliverables:**
- `1-kernel/execution/browser-agent/action-contract/` crate
- Action Contract validation library
- Test suite with 50+ test cases

**Acceptance Criteria:**
- All 12 action types implemented
- Schema validation passes
- Selector resolution works
- Assertions evaluate correctly

---

### P5.1.2: Receipts Schema Implementation
**Effort:** 1 week  
**Dependencies:** P5.1.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.1.2.1: Create Receipts JSON Schema crate
  - Location: `1-kernel/execution/browser-agent/receipts/`
  - Implement Receipt schema validation
  - Implement PageState (before/after)
  - Implement Artifact schema
  - Implement TraceEvent schema
- [ ] 5.1.2.2: Implement receipt generation
  - Status tracking (success/fail/blocked/needs_confirm/skipped)
  - Policy decision recording
  - Before/after state capture
  - Resolved target fingerprinting
  - Artifact hashing (SHA256)
  - Trace event logging
- [ ] 5.1.2.3: Implement receipt storage
  - Evidence store integration
  - Receipt indexing
  - Query API

**Deliverables:**
- `1-kernel/execution/browser-agent/receipts/` crate
- Receipt generation library
- Receipt storage API

**Acceptance Criteria:**
- Receipt schema validates
- All fields populated correctly
- Receipts persist to evidence store
- Query API works

---

### P5.1.3: Policy Tier Gating
**Effort:** 1 week  
**Dependencies:** P5.1.1, P5.1.2  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.1.3.1: Implement Policy Tiers (Tier 0-4)
  - Location: `1-kernel/execution/browser-agent/policy/`
  - Tier 0: Read-only (capture/extract/screenshot)
  - Tier 1: Low-impact (navigate/scroll/UI)
  - Tier 2: Form fill (type/select, no submit)
  - Tier 3: Commit (submit/purchase/publish)
  - Tier 4: Irreversible (credentials/payment)
- [ ] 5.1.3.2: Integrate with Harness RiskPolicy
  - Map BrowserAction riskTier to Harness RiskTier
  - Policy evaluation before execution
  - Signed decision records
- [ ] 5.1.3.3: Implement ConfirmGate action
  - User confirmation prompt
  - Secondary confirmation for Tier 4
  - Confirmation receipt generation
- [ ] 5.1.3.4: Implement host/path/element allowlists
  - Default-deny posture
  - Per-workspace allowlists
  - Element-level constraints for high-risk sites

**Deliverables:**
- `1-kernel/execution/browser-agent/policy/` crate
- Policy tier enforcement
- ConfirmGate implementation
- Allowlist enforcement

**Acceptance Criteria:**
- All tiers enforced correctly
- ConfirmGate requires user confirmation
- Host allowlist enforced
- Default-deny works

---

### P5.1.4: Page Sensor Layer
**Effort:** 1 week  
**Dependencies:** P5.0.3 (Playwright research)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.1.4.1: Implement PageSnapshot generation
  - Location: `1-kernel/execution/browser-agent/sensors/`
  - URL/title capture
  - Bounded DOM extraction (redacted)
  - DOM hash (SHA256)
  - Screenshot (optional)
  - Selection capture
- [ ] 5.1.4.2: Implement structured extraction
  - Table extraction (heuristic + selector)
  - Form extraction (schema + heuristic)
  - Entity extraction (key-value pairs)
- [ ] 5.1.4.3: Implement risk signal detection
  - Payment UI detection
  - Login form detection
  - Destructive action detection
  - Risk tier auto-assignment

**Deliverables:**
- `1-kernel/execution/browser-agent/sensors/` crate
- PageSnapshot generation
- Structured extraction APIs
- Risk signal detection

**Acceptance Criteria:**
- PageSnapshot generates correctly
- DOM redaction works
- Table/form extraction works
- Risk signals detected

---

## P5.2: ShellUI Native Browser (3 weeks) 🔴 CRITICAL

### P5.2.1: HUMAN BrowserView Setup
**Effort:** 1 week  
**Dependencies:** P5.0.1 (ShellUI research), P5.1 (Core complete)  
**Owner:** Frontend Team

**Subtasks:**
- [ ] 5.2.1.1: Create Browser Capsule container
  - Location: `6-ui/shell-ui/src/browser-capsule/`
  - Tab container component
  - Navigation controls
  - Session management
- [ ] 5.2.1.2: Implement session state management
  - Tabs tracking
  - Navigation history
  - Per-site drivers
  - Allowlists per session
- [ ] 5.2.1.3: Implement "Agent Acting" indicator
  - Visible indicator when agent executing
  - Pause/Stop controls
  - Confirm prompt UI

**Deliverables:**
- Browser Capsule UI component
- Session state management
- Agent indicator UI

**Acceptance Criteria:**
- Browser tabs work
- Session persists
- Agent indicator visible
- Controls functional

---

### P5.2.2: AGENT Playwright Executor
**Effort:** 1.5 weeks  
**Dependencies:** P5.0.3 (Playwright research), P5.1 (Core complete)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.2.2.1: Create Playwright integration layer
  - Location: `1-kernel/execution/browser-agent/playwright-executor/`
  - Rust Playwright bindings
  - Browser context management
  - Page lifecycle management
- [ ] 5.2.2.2: Implement Action execution engine
  - Execute BrowserAction objects
  - Selector resolution with fallbacks
  - Retry logic with backoff
  - Timeout enforcement
  - Pre/post condition evaluation
- [ ] 5.2.2.3: Implement session synchronization
  - HUMAN view ↔ AGENT view sync
  - Authentication state sharing
  - URL/title synchronization
  - Scroll position sync (optional)

**Deliverables:**
- `1-kernel/execution/browser-agent/playwright-executor/` crate
- Action execution engine
- Session synchronization

**Acceptance Criteria:**
- All 12 actions execute
- Selector resolution works
- Retries work correctly
- HUMAN/AGENT sync works

---

### P5.2.3: Evidence Store Integration
**Effort:** 1 week  
**Dependencies:** P5.0.4 (Evidence research), P5.1.2 (Receipts)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.2.3.1: Create browser evidence store
  - Location: `1-kernel/execution/browser-agent/evidence-store/`
  - Directory structure: `/evidence/browser/<runId>/actions/<actionId>/`
  - Artifact storage (screenshots, DOM snippets, extracts)
  - Receipt storage (receipt.json)
- [ ] 5.2.3.2: Implement artifact hashing
  - Screenshot hashes (PNG/WebP)
  - DOM snippet hashes
  - Download file hashes
  - Integrity verification
- [ ] 5.2.3.3: Create receipts viewer UI
  - Location: `6-ui/shell-ui/src/receipts-viewer/`
  - Receipt list view
  - Receipt detail view
  - Artifact preview
  - Trace timeline

**Deliverables:**
- `1-kernel/execution/browser-agent/evidence-store/` crate
- Evidence storage API
- Receipts viewer UI

**Acceptance Criteria:**
- Artifacts store correctly
- Hashes verify
- Receipts viewer works
- Trace timeline displays

---

## P5.3: Chrome Extension MV3 (3 weeks) 🟡 HIGH

### P5.3.1: Extension Scaffold
**Effort:** 1 week  
**Dependencies:** P5.1 (Core complete)  
**Owner:** Frontend Team

**Subtasks:**
- [ ] 5.3.1.1: Create MV3 extension structure
  - Location: `3-adapters/browser-extension/`
  - manifest.json (MV3)
  - Side panel HTML/CSS/JS
  - Service worker setup
  - Content script setup
- [ ] 5.3.1.2: Implement permissions strategy
  - Required: sidePanel, tabs, scripting, activeTab, storage
  - Optional: downloads, clipboardRead, clipboardWrite
  - optional_host_permissions for granular control
- [ ] 5.3.1.3: Create build pipeline
  - Extension bundling
  - Source maps
  - Version management
  - Signing (optional)

**Deliverables:**
- `3-adapters/browser-extension/` directory
- MV3 extension scaffold
- Build pipeline

**Acceptance Criteria:**
- Extension loads in Chrome
- Side panel opens
- Content script injects
- Permissions work

---

### P5.3.2: Side Panel UI
**Effort:** 1 week  
**Dependencies:** P5.3.1  
**Owner:** Frontend Team

**Subtasks:**
- [ ] 5.3.2.1: Implement chat/commands UI
  - Chat interface
  - Command palette
  - Context stack display
- [ ] 5.3.2.2: Implement run controls
  - Start / Pause / Stop buttons
  - Confirm prompt UI
  - Progress indicator
- [ ] 5.3.2.3: Implement receipts viewer
  - Receipt list
  - Receipt detail
  - Artifact preview

**Deliverables:**
- Side Panel UI
- Run controls
- Receipts viewer

**Acceptance Criteria:**
- Chat works
- Controls functional
- Receipts display correctly

---

### P5.3.3: Content Script Sensor/Actuator
**Effort:** 1.5 weeks  
**Dependencies:** P5.1 (Core complete), P5.3.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.3.3.1: Implement page sensor
  - DOM extraction (bounded, redacted)
  - Selection capture
  - Table/form extraction
  - DOM hash generation
- [ ] 5.3.3.2: Implement page actuator
  - Execute BrowserAction steps
  - Click/Type/Select/Scroll
  - Wait/Assert
  - Screenshot capture (via extension API)
- [ ] 5.3.3.3: Implement receipt generation
  - Action receipts
  - Artifact capture
  - Streaming to A2R runtime

**Deliverables:**
- Content script sensor
- Content script actuator
- Receipt streaming

**Acceptance Criteria:**
- Page capture works
- Actions execute
- Receipts stream to runtime

---

### P5.3.4: Local Transport
**Effort:** 1 week  
**Dependencies:** P5.3.2, P5.3.3  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.3.4.1: Implement local-first transport
  - HTTP calls to `http://127.0.0.1:<port>`
  - Session token exchange (QR/code pairing)
  - CORS handling
  - Auth handling
- [ ] 5.3.4.2: Implement remote relay fallback
  - A2R cloud relay integration
  - Auth/token management
  - Rate limiting
- [ ] 5.3.4.3: Implement hybrid mode
  - Local when available
  - Fallback to remote
  - Seamless switching

**Deliverables:**
- Local transport layer
- Remote relay integration
- Hybrid mode

**Acceptance Criteria:**
- Local transport works
- Remote fallback works
- Hybrid switching works

---

## P5.4: DAG/WIH Integration (2 weeks) 🟡 HIGH

### P5.4.1: DAG Node Browser Actions
**Effort:** 1 week  
**Dependencies:** P5.1 (Core complete), P5.2 (ShellUI)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.4.1.1: Extend DAG node types
  - Add `browser_run` node type
  - Browser action list in node spec
  - Step/time budget configuration
- [ ] 5.4.1.2: Implement browser run execution
  - Create ContextPack from tab
  - Request plan with BrowserActions
  - Execute actions with receipts
  - Attach evidence to WIH
- [ ] 5.4.1.3: Implement suspend/resume
  - Checkpoint persistence (URL, step index, receipts)
  - Re-assertion on resume
  - Session token handling

**Deliverables:**
- DAG browser node type
- Browser run execution
- Suspend/resume

**Acceptance Criteria:**
- DAG nodes can request browser actions
- Browser runs execute
- Evidence attaches to WIH
- Suspend/resume works

---

### P5.4.2: WIH Evidence Integration
**Effort:** 1 week  
**Dependencies:** P5.1.2 (Receipts), P5.4.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.4.2.1: Implement evidence attachment
  - Receipt references in WIH
  - Artifact references in WIH
  - Immutable evidence binding
- [ ] 5.4.2.2: Implement evidence query API
  - Query receipts by WIH
  - Query artifacts by WIH
  - Evidence viewer API
- [ ] 5.4.2.3: Integrate with Harness merge gates
  - Browser evidence as merge eligibility
  - Receipt verification before merge

**Deliverables:**
- WIH evidence attachment
- Evidence query API
- Harness integration

**Acceptance Criteria:**
- Evidence attaches to WIH
- Query API works
- Merge gates use browser evidence

---

## P5.5: Security Hardening (1 week) 🔴 CRITICAL

### P5.5.1: Prompt Injection Resistance
**Effort:** 3 days  
**Dependencies:** P5.1 (Core complete)  
**Owner:** Security Team

**Subtasks:**
- [ ] 5.5.1.1: Implement structured action pipeline
  - Capture → Plan → Policy Check → Execute → Receipt
  - No page text → direct action conversion
  - All actions validated against schema
- [ ] 5.5.1.2: Implement policy validation
  - Host allowlist enforcement
  - Risk tier enforcement
  - Element allowlist for high-risk sites
- [ ] 5.5.1.3: Security audit
  - Penetration testing
  - Vulnerability scan
  - Security report

**Deliverables:**
- Structured action pipeline
- Policy validation
- Security audit report

**Acceptance Criteria:**
- Prompt injection blocked
- Policy enforced
- Security audit passes

---

### P5.5.2: Sensitive Data Redaction
**Effort:** 3 days  
**Dependencies:** P5.1.4 (Sensors), P5.2.3 (Evidence)  
**Owner:** Security Team

**Subtasks:**
- [ ] 5.2.2.1: Implement selector redaction
  - Password fields masked
  - Credit card fields masked
  - OTP fields masked
  - Custom sensitive selectors
- [ ] 5.2.2.2: Implement screenshot redaction
  - Overlay masks for sensitive areas
  - Configurable mask regions
- [ ] 5.2.2.3: Implement DOM snippet redaction
  - Sensitive value masking
  - Attribute redaction
  - Hash-only storage option

**Deliverables:**
- Selector redaction
- Screenshot redaction
- DOM redaction

**Acceptance Criteria:**
- Sensitive data masked
- Redaction configurable
- No plaintext secrets in evidence

---

### P5.5.3: Default-Deny Enforcement
**Effort:** 2 days  
**Dependencies:** P5.1.3 (Policy)  
**Owner:** Security Team

**Subtasks:**
- [ ] 5.5.3.1: Implement default-deny posture
  - No host allowed by default
  - Explicit allowlist required
  - Workspace-scoped allowlists
- [ ] 5.5.3.2: Implement allowlist management UI
  - Add/remove hosts
  - Add/remove paths
  - Add/remove elements
  - Import/export allowlists

**Deliverables:**
- Default-deny enforcement
- Allowlist management UI

**Acceptance Criteria:**
- Default-deny works
- Allowlist management works
- No unauthorized access

---

## P5.6: Site Adapters (Optional, 2 weeks) 🟢 LOW

### P5.6.1: Site Adapter Framework
**Effort:** 1 week  
**Dependencies:** P5.1 (Core complete)  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.6.1.1: Create site adapter format
  - Versioned package format
  - Selector definitions
  - Extraction templates
  - Risk annotations
- [ ] 5.6.1.2: Implement adapter loader
  - Load adapters as data (not code)
  - Version management
  - Signature verification
- [ ] 5.6.1.3: Create adapter registry
  - Adapter discovery
  - Adapter installation
  - Adapter updates

**Deliverables:**
- Site adapter format
- Adapter loader
- Adapter registry

**Acceptance Criteria:**
- Adapters load correctly
- Adapters are data-only
- Registry works

---

### P5.6.2: Initial Site Adapters
**Effort:** 1 week  
**Dependencies:** P5.6.1  
**Owner:** Backend Team

**Subtasks:**
- [ ] 5.6.2.1: Create brokerage adapter
  - Trade UI selectors
  - Account UI selectors
  - Risk annotations
- [ ] 5.6.2.2: Create e-commerce adapter
  - Product page selectors
  - Cart/checkout selectors
  - Risk annotations
- [ ] 5.6.2.3: Create docs adapter
  - Documentation site selectors
  - Search/extraction templates
  - Risk annotations

**Deliverables:**
- Brokerage adapter
- E-commerce adapter
- Docs adapter

**Acceptance Criteria:**
- Adapters work on target sites
- Selectors resolve correctly
- Extraction templates work

---

## Summary

| Phase | Tasks | Effort | Priority |
|-------|-------|--------|----------|
| **P5.0: Research** | 4 | 2 weeks | 🔴 CRITICAL |
| **P5.1: Core** | 4 | 4 weeks | 🔴 CRITICAL |
| **P5.2: ShellUI** | 3 | 3 weeks | 🔴 CRITICAL |
| **P5.3: Extension** | 4 | 3 weeks | 🟡 HIGH |
| **P5.4: DAG/WIH** | 2 | 2 weeks | 🟡 HIGH |
| **P5.5: Security** | 3 | 1 week | 🔴 CRITICAL |
| **P5.6: Adapters** | 2 | 2 weeks | 🟢 LOW |
| **TOTAL** | **22** | **17 weeks** | - |

---

## Critical Path

**Minimum Viable Browser Agent (10 weeks):**
1. P5.0: Research (2 weeks)
2. P5.1: Core (4 weeks)
3. P5.2: ShellUI (3 weeks)
4. P5.5: Security (1 week)

**Full Implementation (17 weeks):**
- All phases complete
- Both surfaces (ShellUI + Extension)
- Site adapters optional

---

**End of DAG Task Breakdown**
