# Structured DAG Tasks & Subtasks

**Date:** 2026-02-23  
**Purpose:** Actionable breakdown of all gap capabilities into tasks and subtasks  
**Scope:** P3.9 through P4.8 (HIGH + MEDIUM priority gaps)

---

## 📋 Task Overview

| Phase | Task ID | Capability | Status | Est. Weeks |
|-------|---------|-----------|--------|------------|
| P3 | P3.9 | MCP Apps / Interactive Capsules | 🔴 NOT STARTED | 3 |
| P3 | P3.10 | Chrome Extension / Browser Capsule | 🟡 PARTIAL | 4 |
| P3 | P3.11 | Avatar Engine / AVSP | 🔴 NOT STARTED | 2 |
| P3 | P3.12 | Browser-use / Operator Tools | 🟡 PARTIAL | 3 |
| P3 | P3.13 | JSON Render / UGI Integration | 🔴 NOT STARTED | 3 |
| P3 | P3.14 | Form Surfaces | 🔴 NOT STARTED | 2 |
| P4 | P4.7 | Evolution Layer Integration | ✅ IMPLEMENTED | 0 |
| P4 | P4.8 | Context Control Integration | ✅ IMPLEMENTED | 0 |

**Total Remaining Work:** 17 weeks (HIGH priority: 10 weeks)

---

## 🔴 P3.9: MCP Apps / Interactive Capsules (3 weeks)

**Objective:** Enable tools to return interactive UI surfaces (not just text/JSON) with bidirectional bridge between tool data and UI.

### Week 1: Core Protocol & Types

**P3.9.1: Define MCP Apps Protocol**
- [ ] Create `packages/mcp-apps/` directory structure
- [ ] Define `InteractiveCapsule` TypeScript interfaces
- [ ] Define `ToolUISurface` schema (JSON Schema)
- [ ] Create `MCPBridge` protocol types
- [ ] Document capsule lifecycle (mount → update → unmount)
- [ ] Define message format for tool ↔ UI communication

**P3.9.2: Runtime Bridge API (API Layer)**
- [ ] Add `McpAppsState` to `AppState` in API
- [ ] Create `POST /mcp-apps/capsules` - create capsule
- [ ] Create `GET /mcp-apps/capsules/:id` - get capsule state
- [ ] Create `POST /mcp-apps/capsules/:id/event` - UI → tool event
- [ ] Create `GET /mcp-apps/capsules/:id/stream` - SSE for tool → UI updates
- [ ] Create `DELETE /mcp-apps/capsules/:id` - cleanup

**P3.9.3: Capsule Registry**
- [ ] Implement in-memory capsule registry
- [ ] Add capsule state machine (pending → active → closed)
- [ ] Implement event queue per capsule
- [ ] Add cleanup/garbage collection for orphaned capsules

### Week 2: UI Integration & Sandboxing

**P3.9.4: Hardened Capsule Frame Component**
- [ ] Create `CapsuleFrame` React component in ShellUI
- [ ] Implement sandboxed iframe with strict CSP
- [ ] Add postMessage API for parent ↔ iframe communication
- [ ] Create message validation layer (reject invalid origins)
- [ ] Add loading/error states

**P3.9.5: Tool-to-UI Event Pipeline**
- [ ] Implement event routing from API to ShellUI
- [ ] Add Redux state slice for `mcpApps`
- [ ] Create `useCapsule()` hook for components
- [ ] Implement real-time updates via WebSocket/SSE
- [ ] Add event history/log per capsule

**P3.9.6: UI-to-Tool Invocation**
- [ ] Implement `window.allternit` injected API in capsule frame
- [ ] Add `allternit.invokeTool(toolName, params)` method
- [ ] Add `allternit.emitEvent(eventType, payload)` method
- [ ] Create permission validation (which tools can be invoked)
- [ ] Add receipt generation for tool invocations

### Week 3: Permission Model & Integration

**P3.9.7: Permission Model**
- [ ] Define `CapsulePermission` types
- [ ] Implement capability-based access control
- [ ] Add tool allowlist per capsule type
- [ ] Create `mcp-apps.policy.ts` with default policies
- [ ] Add audit logging for permission checks

**P3.9.8: Agent Studio Integration**
- [ ] Add "Interactive Capsule" tab in Agent Studio
- [ ] Implement capsule preview/debug view
- [ ] Add capsule template gallery
- [ ] Create capsule development tools

**P3.9.9: Testing & Documentation**
- [ ] Write unit tests for capsule registry
- [ ] Write integration tests for event pipeline
- [ ] Create security test suite (CSP, sandbox escape attempts)
- [ ] Document MCP Apps API
- [ ] Create example capsule implementations

---

## 🔴 P3.10: Chrome Extension / Browser Capsule (4 weeks)

**Objective:** Build MV3 Chrome extension as "Browser Capsule" edge executor with Allternit-native tool contracts.

### Week 1: Extension Architecture

**P3.10.1: MV3 Extension Foundation**
- [ ] Create `packages/chrome-extension/` directory
- [ ] Set up manifest.json (MV3)
- [ ] Create service worker skeleton
- [ ] Set up content script injection
- [ ] Create options page structure
- [ ] Set up build pipeline (webpack/vite)

**P3.10.2: Native Messaging Host**
- [ ] Implement native messaging host in Rust
- [ ] Add host manifest registration
- [ ] Create message protocol (extension ↔ native host)
- [ ] Implement heartbeat/ping mechanism
- [ ] Add connection state management

**P3.10.3: WebSocket Transport**
- [ ] Add WebSocket client in service worker
- [ ] Implement reconnection logic
- [ ] Add message queuing for offline state
- [ ] Create connection status indicator

### Week 2: Tool Contracts & CDP

**P3.10.4: BROWSER.* Tool Contracts**
- [ ] Define `BROWSER.GET_CONTEXT` tool
- [ ] Define `BROWSER.ACT` tool (click, type, scroll)
- [ ] Define `BROWSER.NAV` tool (navigate, back, forward)
- [ ] Define `BROWSER.EXTRACT` tool (DOM extraction)
- [ ] Define `BROWSER.SCREENSHOT` tool
- [ ] Define `BROWSER.WAIT` tool
- [ ] Create tool schema validation

**P3.10.5: CDP Integration**
- [ ] Integrate existing CDP bridge
- [ ] Add CDP session management per tab
- [ ] Implement DOM snapshot capture
- [ ] Add network monitoring
- [ ] Create accessibility tree extraction

**P3.10.6: Content Script Actions**
- [ ] Implement action executor in content script
- [ ] Add element resolution (selector, text, role, coordinates)
- [ ] Implement click action with visual feedback
- [ ] Implement type action with validation
- [ ] Add scroll action
- [ ] Create action queue system

### Week 3: Safety Model & UI

**P3.10.7: Safety Model Implementation**
- [ ] Implement host allowlist (default deny)
- [ ] Add human-in-loop gates for high-risk actions
- [ ] Create circuit breaker (action rate limiting)
- [ ] Add data minimization (block password/2FA fields)
- [ ] Implement visual confirmation overlays

**P3.10.8: Approval UI**
- [ ] Create approval popup component
- [ ] Design action preview (what will happen)
- [ ] Add "Allow once / Always / Deny" options
- [ ] Create action history view
- [ ] Add permission management UI

**P3.10.9: ShellUI Browser Capsule View**
- [ ] Add "Browser Capsule" view type
- [ ] Create browser session list
- [ ] Implement live browser view (screenshot stream)
- [ ] Add browser action panel
- [ ] Create browser timeline visualization

### Week 4: Receipts & Observability

**P3.10.10: Receipt Integration**
- [ ] Extend receipt schema for browser actions
- [ ] Create `BrowserActionReceipt` type
- [ ] Add before/after screenshot to receipts
- [ ] Implement DOM diff in receipts
- [ ] Add network log to receipts

**P3.10.11: Observability Timeline**
- [ ] Create browser event stream
- [ ] Add events: navigation, click, type, extract
- [ ] Implement timeline renderer in A2UI
- [ ] Add search/filter on browser events
- [ ] Create browser session replay

**P3.10.12: Testing & Distribution**
- [ ] Write unit tests for service worker
- [ ] Test content script on major sites
- [ ] Security audit (CSP, XSS prevention)
- [ ] Prepare Chrome Web Store package
- [ ] Create installation documentation

---

## 🟡 P3.11: Avatar Engine / AVSP (2 weeks)

**Objective:** Implement Allternit Visual State Protocol (AVSP) for agent mood/intensity/confidence visualization.

### Week 1: AVSP Core

**P3.11.1: AVSP Types & Schema**
- [ ] Create `packages/allternit-visual-state/` package
- [ ] Define `VisualState` interface (mood, intensity, confidence, reliability)
- [ ] Create AVSP JSON Schema
- [ ] Define `MoodTaxonomy` enum (focused, thinking, uncertain, celebrating, warning, error)
- [ ] Define `IntensityLevel` (1-10 scale)

**P3.11.2: Telemetry → Mood Mapping**
- [ ] Create telemetry ingestion pipeline
- [ ] Implement mood inference rules
- [ ] Add confidence calculation from task success rate
- [ ] Create reliability score from error rates
- [ ] Add mood transition smoothing

**P3.11.3: Core Avatar Component**
- [ ] Create `Avatar` React component
- [ ] Implement base avatar renderer (SVG/Canvas/WebGL)
- [ ] Add mood-based visual variations
- [ ] Implement intensity scaling (animation speed, glow)
- [ ] Create confidence indicator (subtle cues)

### Week 2: Integration & Adapters

**P3.11.4: Adapter Architecture**
- [ ] Create `AvatarAdapter` interface
- [ ] Implement `ClawdReactAdapter` for Clawd mascot
- [ ] Create `GenericEmojiAdapter` for emoji-based avatars
- [ ] Add `CustomSVGAdapter` for user-defined avatars
- [ ] Document adapter API

**P3.11.5: ShellUI Integration**
- [ ] Add avatar to Chat view header
- [ ] Integrate with Dashboard agent cards
- [ ] Add avatar to Swarm view (agent nodes)
- [ ] Implement avatar in Marketplace listings
- [ ] Create avatar settings panel

**P3.11.6: Testing & Polish**
- [ ] Write unit tests for mood mapping
- [ ] Test all mood states
- [ ] Performance test (60fps animation)
- [ ] Accessibility review (reduced motion)
- [ ] Create avatar customization guide

---

## 🟡 P3.12: Browser-use / Operator Tools (3 weeks)

**Objective:** Build unified `browser_control` tool family with unified event protocol.

### Week 1: Tool Family Foundation

**P3.12.1: Browser Control Tool Family**
- [ ] Define `browser_control.open(url, options)` tool
- [ ] Define `browser_control.click(target, options)` tool
- [ ] Define `browser_control.type(target, text, options)` tool
- [ ] Define `browser_control.extract(query, options)` tool
- [ ] Define `browser_control.wait(condition, timeout)` tool
- [ ] Define `browser_control.screenshot(options)` tool
- [ ] Define `browser_control.scroll(direction, amount)` tool
- [ ] Create tool implementations in `allternit-browser` package

**P3.12.2: Playwright Integration**
- [ ] Integrate existing Playwright utilities
- [ ] Create Playwright-based tool backend
- [ ] Add browser context pooling
- [ ] Implement session persistence
- [ ] Add browser download/upload handling

**P3.12.3: Unified Event Stream**
- [ ] Define `BrowserEvent` types (navigation, click, type, extract, screenshot)
- [ ] Create unified event emitter
- [ ] Add event buffering and batching
- [ ] Implement event filtering
- [ ] Create event subscription API

### Week 2: Safety & Gates

**P3.12.4: Safety Gates**
- [ ] Implement `sensitive_element` detection
- [ ] Add URL allowlist/denylist
- [ ] Create action rate limiting
- [ ] Add confirmation for destructive actions
- [ ] Implement sandbox mode (read-only)

**P3.12.5: Capability Gates**
- [ ] Define capability levels (read, interact, execute)
- [ ] Implement capability checking
- [ ] Add agent capability declaration
- [ ] Create capability escalation flow
- [ ] Add audit logging for capability usage

**P3.12.6: Receipt Schema Extension**
- [ ] Extend `ToolReceipt` for browser actions
- [ ] Add `BrowserActionReceipt` type
- [ ] Include DOM snapshots in receipts
- [ ] Add network log excerpt
- [ ] Create receipt visualization component

### Week 3: A2UI Timeline & Polish

**P3.12.7: A2UI Timeline Renderer**
- [ ] Create `BrowserTimeline` component
- [ ] Implement action step visualization
- [ ] Add before/after screenshots
- [ ] Create DOM diff highlighting
- [ ] Add action replay controls

**P3.12.8: ShellUI Integration**
- [ ] Add browser control panel
- [ ] Create live browser preview
- [ ] Implement action queue visualization
- [ ] Add browser session management
- [ ] Create browser tool settings

**P3.12.9: Testing & Documentation**
- [ ] Write integration tests for tool family
- [ ] Test on multiple sites (SPA, static, forms)
- [ ] Performance testing
- [ ] Security review
- [ ] Create operator tools guide

---

## 🔴 P3.13: JSON Render / UGI Integration (3 weeks)

**Objective:** Integrate Vercel Labs json-render for declarative UI execution with Allternit-IX kernel.

### Week 1: Allternit-IX Core

**P3.13.1: Allternit-IX UI IR Schema**
- [ ] Create `packages/allternit-ix/` package
- [ ] Define UI IR (Intermediate Representation) schema
- [ ] Create component catalog schema
- [ ] Define state binding schema
- [ ] Implement expression evaluation grammar
- [ ] Create action schema (events → handlers)

**P3.13.2: Catalog Registry**
- [ ] Implement versioned component catalog
- [ ] Create catalog registration API
- [ ] Add component validation
- [ ] Implement catalog versioning
- [ ] Create catalog discovery endpoint

**P3.13.3: State Store**
- [ ] Implement scoped state store (per capsule/agent/user)
- [ ] Add two-way binding system
- [ ] Create computed state support
- [ ] Implement state persistence
- [ ] Add state encryption for sensitive data

### Week 2: Patch Engine & Runtime

**P3.13.4: Patch Engine (RFC 6902)**
- [ ] Implement JSON Patch parser
- [ ] Add patch validation
- [ ] Create patch audit log
- [ ] Implement patch replay
- [ ] Add patch compression

**P3.13.5: Capsule Runtime Integration**
- [ ] Create IX capsule type
- [ ] Implement IR → React component mapping
- [ ] Add event handling pipeline
- [ ] Create action execution context
- [ ] Implement state synchronization

**P3.13.6: Policy Gate Integration**
- [ ] Add action permission checking
- [ ] Implement policy evaluation
- [ ] Create policy definition schema
- [ ] Add policy audit logging
- [ ] Create policy management UI

### Week 3: Catalog-Aware Prompting & Testing

**P3.13.7: Catalog-Aware Prompting**
- [ ] Create LLM prompt templates for UI generation
- [ ] Add catalog component descriptions to prompts
- [ ] Implement few-shot examples
- [ ] Create prompt optimization
- [ ] Add catalog update → prompt refresh

**P3.13.8: json-render Compatibility**
- [ ] Map json-render schema to Allternit-IX
- [ ] Create migration utilities
- [ ] Add json-render component adapters
- [ ] Test Vercel Labs examples
- [ ] Document differences

**P3.13.9: Testing & CI**
- [ ] Write schema conformance tests
- [ ] Create component rendering tests
- [ ] Add patch roundtrip tests
- [ ] Implement CI checks for schema
- [ ] Performance benchmarks

---

## 🔴 P3.14: Form Surfaces (2 weeks)

**Objective:** Implement forms as first-class agent communication surface with dynamic schema and Answer Store.

### Week 1: Core Form System

**P3.14.1: Surface Protocol**
- [ ] Extend surface protocol with `FormSurface` type
- [ ] Define `surface.render(form)` message format
- [ ] Create form request/response flow
- [ ] Add form lifecycle (request → render → submit → validate)
- [ ] Implement form versioning

**P3.14.2: Form Schema & Renderer**
- [ ] Create `FormSchema` TypeScript definitions
- [ ] Implement field types (text, number, select, multi, file, etc.)
- [ ] Add validation rules schema
- [ ] Create conditional field logic
- [ ] Implement `FormRenderer` React component

**P3.14.3: Answer Store**
- [ ] Implement `AnswerStore` data layer
- [ ] Create answer CRUD operations
- [ ] Add answer versioning
- [ ] Implement answer locks (prevent agent override)
- [ ] Create answer export/import

### Week 2: Advanced Features & Integration

**P3.14.4: Invalidation Graph**
- [ ] Implement dependency tracking between fields
- [ ] Create invalidation rules engine
- [ ] Add selective re-ask logic
- [ ] Implement cascade invalidation
- [ ] Create invalidation visualization

**P3.14.5: Two-Mode UX**
- [ ] Implement "Guided Mode" (step-by-step wizard)
- [ ] Implement "Advanced Mode" (all fields visible)
- [ ] Add mode toggle
- [ ] Create mode persistence per form
- [ ] Implement mode-specific validation

**P3.14.6: Artifact Emitters**
- [ ] Create `/spec/Vision.md` emitter
- [ ] Create `/spec/Requirements.md` emitter
- [ ] Create `/spec/AcceptanceTests.md` emitter
- [ ] Add custom artifact template support
- [ ] Implement artifact preview

**P3.14.7: MVP: Project Spec Intake**
- [ ] Create "New Project" form template
- [ ] Design project specification schema
- [ ] Implement intake flow
- [ ] Add project generation from form
- [ ] Create demo video

---

## ✅ P4.7: Evolution Layer Integration (0 weeks - ALREADY DONE)

**Status:** ✅ **FULLY IMPLEMENTED** in `domains/kernel/infrastructure/evolution-layer/`

**Location:**
- `/domains/kernel/infrastructure/evolution-layer/src/lib.rs`
- 5 engines: MEE, SEE, CRL, OEE, TOE
- Full test suite included

**Integration Tasks (if needed):**
- [ ] Wire to API layer (expose endpoints)
- [ ] Add ShellUI views for evolution metrics
- [ ] Create evolution dashboard
- [ ] Document API for agent usage

---

## ✅ P4.8: Context Control Integration (0 weeks - ALREADY DONE)

**Status:** ✅ **FULLY IMPLEMENTED** in `domains/kernel/control-plane/context-control/`

**Location:**
- `/domains/kernel/control-plane/context-control/src/lib.rs`
- Git-like context operations
- Multi-resolution retrieval
- Context bundles

**Integration Tasks (if needed):**
- [ ] Wire to API layer (context endpoints)
- [ ] Add context browser to ShellUI
- [ ] Create context visualization
- [ ] Implement context sharing UI
- [ ] Document tool contracts

---

## 📊 Implementation Roadmap

### Phase 1: Core Differentiators (10 weeks) - START HERE

**Priority Order:**
1. **P3.9: MCP Apps** (3w) - Foundation for interactive tools
2. **P3.12: Browser-use Tools** (3w) - Leverage existing CDP/Playwright
3. **P3.10: Chrome Extension** (4w) - Browser edge executor

**Dependencies:**
- P3.12 → P3.10 (browser tools feed into extension)

### Phase 2: User Experience (4 weeks)

4. **P3.14: Form Surfaces** (2w) - Agent communication
5. **P3.11: Avatar Engine** (2w) - Visual polish

**Dependencies:**
- P3.14 → P3.9 (forms could use interactive capsules)

### Phase 3: Advanced Features (7 weeks)

6. **P3.6-3.8: Playground System** (4w) - Visual workflows
7. **P3.13: JSON Render/UGI** (3w) - Declarative UI

**Dependencies:**
- P3.13 → P3.9 (UGI could use capsule runtime)

### Optional: Integration Polish

8. **P4.7 & P4.8 Integration** (1-2w) - Wire up existing Rust implementations

---

## 🎯 Recommended Sprint Structure

### Sprint 1 (Weeks 1-2): Foundation
- P3.9.1 - MCP Apps Protocol
- P3.9.2 - Runtime Bridge API
- P3.12.1 - Browser Control Tool Family

### Sprint 2 (Weeks 3-4): UI Integration
- P3.9.4 - Hardened Capsule Frame
- P3.9.5 - Tool-to-UI Pipeline
- P3.12.3 - Unified Event Stream

### Sprint 3 (Weeks 5-6): Browser Infrastructure
- P3.10.1 - MV3 Extension Foundation
- P3.10.2 - Native Messaging Host
- P3.10.4 - BROWSER.* Tool Contracts

### Sprint 4 (Weeks 7-8): Safety & Polish
- P3.9.7 - Permission Model
- P3.10.7 - Safety Model
- P3.12.4 - Safety Gates

### Sprint 5 (Weeks 9-10): Completion & Testing
- P3.10.10 - Receipt Integration
- P3.9.9 - Testing & Documentation
- P3.12.9 - Testing & Documentation

---

## 📁 File Organization

```
docs/_active/
├── STRUCTURED_DAG_TASKS.md (this file)
├── P3.9_MCP_APPS_TASKS.md (extract if needed)
├── P3.10_CHROME_EXTENSION_TASKS.md (extract if needed)
├── P3.11_AVATAR_ENGINE_TASKS.md (extract if needed)
├── P3.12_BROWSER_TOOLS_TASKS.md (extract if needed)
├── P3.13_JSON_RENDER_TASKS.md (extract if needed)
└── P3.14_FORM_SURFACES_TASKS.md (extract if needed)
```

---

## ✅ Definition of Done

Each task is complete when:
1. Code is written and compiles
2. Unit tests pass (>80% coverage)
3. Integration tests pass
4. Documentation is updated
5. Security review completed (where applicable)
6. Code review approved
7. Merged to main branch

---

**End of Structured DAG Tasks**
