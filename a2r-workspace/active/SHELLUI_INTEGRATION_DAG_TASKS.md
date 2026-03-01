# SHELLUI INTEGRATION - DAG TASK BREAKDOWN

**Date:** 2026-02-23
**Status:** READY FOR IMPLEMENTATION
**Total Tasks:** 24 tasks across 4 phases
**Total Effort:** ~18-24 hours

---

## PHASE 1: BROWSER AGENT BAR & SESSION OBSERVABILITY (6-8 hours)

### P1.1: BrowserAgentEvent Stream Type
**Effort:** 30 minutes
**Dependencies:** None
**Owner:** Backend Team

**Subtasks:**
- [ ] Create `BrowserAgentEvent` type union
- [ ] Define ActionEvent schema
- [ ] Define ReceiptEvent schema
- [ ] Define TraceEvent schema (placeholder)
- [ ] Define ChatEvent schema (placeholder)
- [ ] Export from `browserAgent.types.ts`

**Acceptance Criteria:**
- Single event stream type (not multiple streams)
- All 4 event types defined
- 2 types fully implemented (Action, Receipt)
- 2 types placeholder (Trace, Chat)

**Files:**
- `src/capsules/browser/browserAgent.types.ts`

---

### P1.2: BrowserAgentBar Component
**Effort:** 2-3 hours
**Dependencies:** P1.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create BrowserAgentBar.tsx component
- [ ] Implement left section (Endpoint selector + status dot)
- [ ] Implement center section (Goal input + Run/Stop)
- [ ] Implement right section:
  - Mode toggle (Human/Assist/Agent)
  - Take Over / Hand Off buttons
  - Approve button (conditional on `requires_approval`)
  - Capture button
  - Session menu
  - Status pill (Idle/Running/Waiting/Blocked/Done)
  - Open Drawer button (auto-selects tab)
- [ ] Add top docking styles
- [ ] Wire to BrowserCapsuleEnhanced
- [ ] Add expand/collapse animation

**Acceptance Criteria:**
- Bar docks at TOP of BrowserView
- All 3 sections implemented (Left, Center, Right)
- Status pill shows 5 states
- Open Drawer button jumps to correct tab
- Approve button only shows when `requires_approval` state
- Bar state is ephemeral (not persisted)

**Files:**
- `src/capsules/browser/BrowserAgentBar.tsx`
- `src/capsules/browser/BrowserAgentBar.css` (or styled-components)

**NOT implementing yet:**
- ❌ Step list in bar
- ❌ Token/cost meters
- ❌ Command palette
- ❌ Advanced settings menus

---

### P1.3: BrowserAgentOverlay Component
**Effort:** 2-3 hours
**Dependencies:** P1.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create BrowserAgentOverlay.tsx component
- [ ] Implement element highlight overlay
- [ ] Implement action badge (Click/Type/Scroll/Read)
- [ ] Implement cursor ghost/pointer
- [ ] Subscribe to runtime events (targets, bounding boxes)
- [ ] Mount inside BrowserCapsuleEnhanced
- [ ] Position above web content, below bar
- [ ] Add ephemeral behavior (appears during action only)

**Acceptance Criteria:**
- Separate component (not coupled to bar)
- Highlights target elements during execution
- Shows action type badge
- Ephemeral (disappears after action completes)
- Does not interfere with page interaction

**Files:**
- `src/capsules/browser/BrowserAgentOverlay.tsx`

---

### P1.4: Console Drawer - DAG Graph Tab
**Effort:** 1-2 hours
**Dependencies:** P1.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create DagGraphView.tsx component
- [ ] Show current run DAG only (not definitions)
- [ ] Display node states (pending/running/completed/failed)
- [ ] Show progress indicator
- [ ] Auto-scroll to current node
- [ ] Add to DrawerTabs.tsx as "DAG Graph"
- [ ] Wire to DrawerRoot.tsx

**Acceptance Criteria:**
- Shows ONLY currently executing run
- Node states visible
- Progress indicator works
- Tab reserved in drawer (not hidden)

**Files:**
- `src/views/code/ConsoleDrawer/DagGraphView.tsx`
- Modify: `src/views/code/ConsoleDrawer/DrawerTabs.tsx`
- Modify: `src/views/code/ConsoleDrawer/DrawerRoot.tsx`

---

### P1.5: Console Drawer - Receipts Tab
**Effort:** 1-2 hours
**Dependencies:** P1.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create ReceiptsView.tsx component
- [ ] Stream tool calls for current run
- [ ] Show structured events (Action, Receipt)
- [ ] Display screenshots thumbnails
- [ ] Show DOM selector info
- [ ] Add export functionality (persistent storage)
- [ ] Add to DrawerTabs.tsx as "Receipts"
- [ ] Wire to DrawerRoot.tsx

**Acceptance Criteria:**
- Streams tool calls in real-time
- Receipts persistent per run
- Export functionality works
- Tab reserved in drawer

**Files:**
- `src/views/code/ConsoleDrawer/ReceiptsView.tsx`
- Modify: `src/views/code/ConsoleDrawer/DrawerTabs.tsx`
- Modify: `src/views/code/ConsoleDrawer/DrawerRoot.tsx`

---

### P1.6: Drawer Tab Placeholders (Trace + Browser Chat)
**Effort:** 30 minutes
**Dependencies:** P1.4, P1.5
**Owner:** Frontend Team

**Subtasks:**
- [ ] Add "Trace" tab to DrawerTabs.tsx (disabled, "Coming next")
- [ ] Add "Browser Chat" tab to DrawerTabs.tsx (disabled, "Coming next")
- [ ] Reserve tab slots in layout
- [ ] OR hide behind feature flag

**Acceptance Criteria:**
- Tabs visible but disabled OR hidden behind flag
- Layout doesn't change when enabled later
- Clear "Coming next" label

**Files:**
- Modify: `src/views/code/ConsoleDrawer/DrawerTabs.tsx`

---

## PHASE 2: CONTROL CENTER OVERLAY (4-6 hours)

### P2.1: ControlCenter Component Shell
**Effort:** 1 hour
**Dependencies:** None
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create ControlCenter.tsx component
- [ ] Add modal/slide panel behavior
- [ ] Add gear icon trigger in ShellHeader
- [ ] Implement close on outside click
- [ ] Add section navigation (left sidebar)
- [ ] Add content area (right panel)

**Acceptance Criteria:**
- Opens from gear icon in header
- Modal or slide panel (not rail item)
- Section navigation works
- Close behavior works

**Files:**
- `src/shell/ControlCenter.tsx`
- Modify: `src/shell/ShellHeader.tsx`

---

### P2.2: ControlCenter - Compute & Runtimes Section
**Effort:** 2-3 hours
**Dependencies:** P2.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create ComputeRuntimesSection.tsx
- [ ] Wire to 8-cloud crates (a2r-cloud-core)
- [ ] Show runtime target list (Cloud | BYOC VPS | Hybrid)
- [ ] Show worker pool status grid
- [ ] Show resource usage view
- [ ] Add health dashboard
- [ ] Add "Manage..." link behavior

**Acceptance Criteria:**
- Shows all runtime targets
- Worker health visible
- Pool status grid works
- Resource usage displayed
- Wired to existing 8-cloud crates

**Files:**
- `src/shell/ControlCenterSections/ComputeRuntimesSection.tsx`
- Wire to: `8-cloud/a2r-cloud-core/src/registry.rs`

---

### P2.3: ControlCenter - Secrets & Credentials Section
**Effort:** 1-2 hours
**Dependencies:** P2.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create SecretsCredentialsSection.tsx
- [ ] Show SSH key management
- [ ] Show API tokens (if any)
- [ ] Show Vault connectors
- [ ] Add credential rotation UI

**Acceptance Criteria:**
- SSH keys manageable
- Credentials secure
- Rotation workflow exists

**Files:**
- `src/shell/ControlCenterSections/SecretsCredentialsSection.tsx`
- Wire to: `8-cloud/a2r-cloud-ssh/src/key_manager.rs`

---

### P2.4: ControlCenter - SSH Connections Section
**Effort:** 1-2 hours
**Dependencies:** P2.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create SSHConnectionsSection.tsx
- [ ] Show SSH host list
- [ ] Show tunnel/port forwarding status
- [ ] Show known hosts/fingerprint management
- [ ] Add test connection button

**Acceptance Criteria:**
- SSH hosts manageable
- Tunnels visible
- Fingerprints verifiable
- Connection test works

**Files:**
- `src/shell/ControlCenterSections/SSHConnectionsSection.tsx`
- Wire to: `8-cloud/a2r-cloud-ssh/src/connection.rs`

---

### P2.5: ControlCenter - Browser Pairing Section
**Effort:** 1 hour
**Dependencies:** P2.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create BrowserPairingSection.tsx
- [ ] Show extension pairing status
- [ ] Show paired endpoints list
- [ ] Add pairing code/QR display
- [ ] Add unpair functionality

**Acceptance Criteria:**
- Extension pairing works
- Endpoints listed
- Unpair works

**Files:**
- `src/shell/ControlCenterSections/BrowserPairingSection.tsx`

---

### P2.6: ControlCenter - Policies Section
**Effort:** 1 hour
**Dependencies:** P2.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create PoliciesSection.tsx
- [ ] Show allowlists
- [ ] Show approval requirements
- [ ] Show tool safety levels

**Acceptance Criteria:**
- Policies visible
- Approval requirements clear

**Files:**
- `src/shell/ControlCenterSections/PoliciesSection.tsx`

---

### P2.7: ControlCenter - Dev Tools Section
**Effort:** 1 hour
**Dependencies:** P2.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create DevToolsSection.tsx
- [ ] Add Agentation toggle (dev mode only)
- [ ] NODE_ENV === 'development' gate
- [ ] Show dev-only features

**Acceptance Criteria:**
- Agentation toggle works (dev mode only)
- Not visible in production

**Files:**
- `src/shell/ControlCenterSections/DevToolsSection.tsx`

---

## PHASE 3: ENVIRONMENT SELECTOR (2-3 hours)

### P3.1: EnvironmentSelector Component
**Effort:** 1-2 hours
**Dependencies:** P2.2
**Owner:** Frontend Team

**Subtasks:**
- [ ] Create EnvironmentSelector.tsx component
- [ ] Add dropdown (Cloud | BYOC VPS | Hybrid)
- [ ] Show current runtime target
- [ ] Add "Manage..." link → Control Center
- [ ] Add to ShellHeader (top bar)
- [ ] Wire to a2r-cloud-core registry

**Acceptance Criteria:**
- Small dropdown in header
- Shows active target
- Switch only (not configuration)
- "Manage..." opens Control Center
- NOT a rail view, hub page, or wizard

**Files:**
- `src/shell/EnvironmentSelector.tsx`
- Modify: `src/shell/ShellHeader.tsx`
- Wire to: `8-cloud/a2r-cloud-core/src/registry.rs`

---

### P3.2: Environment State Management
**Effort:** 1 hour
**Dependencies:** P3.1
**Owner:** Backend Team

**Subtasks:**
- [ ] Create environment store/hook
- [ ] Persist active target selection
- [ ] Emit change events
- [ ] Wire to BrowserAgentBar endpoint selector

**Acceptance Criteria:**
- State persists across sessions
- Change events emitted
- BrowserAgentBar can read active target

**Files:**
- `src/shell/environment.store.ts`
- `src/hooks/useEnvironment.ts`

---

## PHASE 4: AGENTATION HYBRID ACCESS (2-3 hours)

### P4.1: Agentation Control Center Toggle
**Effort:** 1 hour
**Dependencies:** P2.7
**Owner:** Frontend Team

**Subtasks:**
- [ ] Add Agentation toggle to DevToolsSection
- [ ] NODE_ENV gate
- [ ] Enable/disable AgentationProvider
- [ ] Persist toggle state (session only)

**Acceptance Criteria:**
- Toggle in Control Center → Dev Tools
- Dev mode only
- Enables Agentation overlay

**Files:**
- Modify: `src/shell/ControlCenterSections/DevToolsSection.tsx`
- Modify: `src/dev/agentation/provider.tsx`

---

### P4.2: Agentation Browser Context Menu
**Effort:** 1 hour
**Dependencies:** P4.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Add context menu to BrowserView
- [ ] "Annotate with Agentation" option
- [ ] Opens Agentation panel
- [ ] Dev mode only

**Acceptance Criteria:**
- Context menu in BrowserView
- Agentation accessible from menu
- Dev mode only

**Files:**
- Modify: `src/capsules/browser/BrowserCapsuleEnhanced.tsx`

---

### P4.3: Agentation Keyboard Shortcut (Optional)
**Effort:** 30 minutes
**Dependencies:** P4.1
**Owner:** Frontend Team

**Subtasks:**
- [ ] Add Cmd+Shift+A shortcut (dev mode only)
- [ ] Toggle Agentation overlay
- [ ] Prevent in production

**Acceptance Criteria:**
- Shortcut works (dev mode)
- Does nothing in production

**Files:**
- Modify: `src/dev/agentation/provider.tsx`

**NOT implementing:**
- ❌ Binding to AgentInvokeBar

---

## DEPENDENCY GRAPH

```
P1.1 (Event Types)
├── P1.2 (BrowserAgentBar)
├── P1.3 (BrowserAgentOverlay)
├── P1.4 (DAG Graph Tab)
└── P1.5 (Receipts Tab)
    └── P1.6 (Tab Placeholders)

P2.1 (ControlCenter Shell)
├── P2.2 (Compute & Runtimes)
│   └── P3.1 (Environment Selector)
│       └── P3.2 (Environment State)
├── P2.3 (Secrets)
├── P2.4 (SSH)
├── P2.5 (Browser Pairing)
├── P2.6 (Policies)
└── P2.7 (Dev Tools)
    └── P4.1 (Agentation Toggle)
        ├── P4.2 (Context Menu)
        └── P4.3 (Keyboard Shortcut - Optional)
```

---

## IMPLEMENTATION ORDER

### Phase 1 (6-8 hours) - START HERE
1. P1.1: BrowserAgentEvent Stream Type (30 min)
2. P1.2: BrowserAgentBar Component (2-3 hours)
3. P1.3: BrowserAgentOverlay Component (2-3 hours)
4. P1.4: DAG Graph Tab (1-2 hours)
5. P1.5: Receipts Tab (1-2 hours)
6. P1.6: Tab Placeholders (30 min)

### Phase 2 (4-6 hours)
1. P2.1: ControlCenter Shell (1 hour)
2. P2.2: Compute & Runtimes (2-3 hours)
3. P2.3: Secrets & Credentials (1-2 hours)
4. P2.4: SSH Connections (1-2 hours)
5. P2.5: Browser Pairing (1 hour)
6. P2.6: Policies (1 hour)
7. P2.7: Dev Tools (1 hour)

### Phase 3 (2-3 hours)
1. P3.1: Environment Selector (1-2 hours)
2. P3.2: Environment State (1 hour)

### Phase 4 (2-3 hours)
1. P4.1: Agentation Toggle (1 hour)
2. P4.2: Context Menu (1 hour)
3. P4.3: Keyboard Shortcut (30 min - Optional)

---

## ACCEPTANCE CRITERIA SUMMARY

### Phase 1 Must-Haves:
- ✅ BrowserAgentBar docks at TOP
- ✅ BrowserAgentOverlay separate component
- ✅ Single BrowserAgentEvent stream type
- ✅ DAG Graph tab (current run only)
- ✅ Receipts tab (persistent, exportable)
- ✅ Tab placeholders for Trace + Browser Chat
- ✅ Approve button conditional on `requires_approval`
- ✅ Bar state ephemeral, Receipts persistent

### Phase 2 Must-Haves:
- ✅ ControlCenter opens from gear icon
- ✅ NOT in rail
- ✅ Compute & Runtimes section (wired to 8-cloud)
- ✅ Worker health dashboard
- ✅ All 7 sections implemented

### Phase 3 Must-Haves:
- ✅ EnvironmentSelector in header
- ✅ Small dropdown (not wizard)
- ✅ "Manage..." link to Control Center

### Phase 4 Must-Haves:
- ✅ Agentation toggle in Dev Tools
- ✅ Dev mode only (NODE_ENV gate)
- ✅ NOT bound to AgentInvokeBar

---

## FILES SUMMARY

### New Files to Create (24):
**Phase 1:**
- `src/capsules/browser/browserAgent.types.ts`
- `src/capsules/browser/BrowserAgentBar.tsx`
- `src/capsules/browser/BrowserAgentBar.css`
- `src/capsules/browser/BrowserAgentOverlay.tsx`
- `src/views/code/ConsoleDrawer/DagGraphView.tsx`
- `src/views/code/ConsoleDrawer/ReceiptsView.tsx`

**Phase 2:**
- `src/shell/ControlCenter.tsx`
- `src/shell/ControlCenterSections/ComputeRuntimesSection.tsx`
- `src/shell/ControlCenterSections/SecretsCredentialsSection.tsx`
- `src/shell/ControlCenterSections/SSHConnectionsSection.tsx`
- `src/shell/ControlCenterSections/BrowserPairingSection.tsx`
- `src/shell/ControlCenterSections/PoliciesSection.tsx`
- `src/shell/ControlCenterSections/DevToolsSection.tsx`

**Phase 3:**
- `src/shell/EnvironmentSelector.tsx`
- `src/shell/environment.store.ts`
- `src/hooks/useEnvironment.ts`

**Phase 4:**
- (No new files - modifications only)

### Files to Modify (10):
- `src/capsules/browser/BrowserCapsuleEnhanced.tsx`
- `src/views/code/ConsoleDrawer/DrawerTabs.tsx`
- `src/views/code/ConsoleDrawer/DrawerRoot.tsx`
- `src/shell/ShellHeader.tsx`
- `src/shell/ShellApp.tsx`
- `src/dev/agentation/provider.tsx`
- (Plus section files in Phase 2)

---

## READY TO BEGIN PHASE 1

**All 24 DAG tasks defined.**
**All dependencies mapped.**
**All acceptance criteria specified.**
**All files identified.**

**Awaiting confirmation to begin P1.1.**
