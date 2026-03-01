# SHELLUI INTEGRATION - DAG TASK LIST

**Date:** 2026-02-22
**Goal:** Complete ShellUI integration for all P4 DAG features
**Total Tasks:** 15 tasks across 4 phases
**Estimated Effort:** 5-7 hours

---

## PHASE 1: Navigation & Routing (1 hour)

### DAG-UI.1: Add DAG Menu Item to Side-Nav
**Effort:** 15 minutes
**Dependencies:** None
**File:** `6-ui/a2r-platform/src/a2r-usage/ui/components/side-nav.tsx`

**Subtasks:**
- [ ] Add `"dag-integration"` to `ActiveView` type
- [ ] Import icon component (GaugeIcon or custom)
- [ ] Add NavButton for DAG Integration
- [ ] Test navigation click

**Acceptance Criteria:**
- Menu item appears in sidebar
- Click changes active view
- Active state highlights correctly

---

### DAG-UI.2: Add Route Handler in App.tsx
**Effort:** 15 minutes
**Dependencies:** DAG-UI.1
**File:** `6-ui/a2r-platform/src/a2r-usage/ui/App.tsx`

**Subtasks:**
- [ ] Import `DagIntegrationPage` component
- [ ] Add render condition for `"dag-integration"` view
- [ ] Test page renders

**Acceptance Criteria:**
- DagIntegrationPage renders when selected
- No console errors
- Navigation works bidirectionally

---

### DAG-UI.3: Verify Navigation Flow
**Effort:** 30 minutes
**Dependencies:** DAG-UI.1, DAG-UI.2

**Subtasks:**
- [ ] Start dev server
- [ ] Click through all tabs in DagIntegrationPage
- [ ] Verify all 4 views render
- [ ] Test back/forth navigation

**Acceptance Criteria:**
- All 4 views accessible
- No errors in console
- Smooth navigation

---

## PHASE 2: API Connection (1 hour)

### DAG-API.1: Configure API Base URL
**Effort:** 15 minutes
**Dependencies:** None
**Files:** All 4 DAG view components

**Subtasks:**
- [ ] Create `.env` file with `VITE_API_BASE_URL`
- [ ] Update API_BASE constant in all components
- [ ] Add environment variable to package.json

**Acceptance Criteria:**
- All components use env variable
- API URL configurable
- No hardcoded URLs

---

### DAG-API.2: Test Swarm API Endpoints
**Effort:** 15 minutes
**Dependencies:** DAG-API.1
**File:** `SwarmDashboard.tsx`

**Subtasks:**
- [ ] Start API server
- [ ] Test circuit breaker endpoints
- [ ] Test quarantine endpoints
- [ ] Test message stats endpoints

**Acceptance Criteria:**
- All endpoints respond
- Data displays in UI
- Error handling works

---

### DAG-API.3: Test IVKGE API Endpoints
**Effort:** 15 minutes
**Dependencies:** DAG-API.1
**File:** `IVKGEPanel.tsx`

**Subtasks:**
- [ ] Test upload endpoint
- [ ] Test extraction endpoints
- [ ] Test correction endpoints

**Acceptance Criteria:**
- Image upload works
- Extraction returns data
- Corrections apply

---

### DAG-API.4: Test Multimodal API Endpoints
**Effort:** 15 minutes
**Dependencies:** DAG-API.1
**File:** `MultimodalInput.tsx`

**Subtasks:**
- [ ] Test stream management endpoints
- [ ] Test WebSocket connections
- [ ] Test stream control

**Acceptance Criteria:**
- Streams list correctly
- WebSocket connects
- Start/stop works

---

### DAG-API.5: Test Tambo API Endpoints
**Effort:** 15 minutes
**Dependencies:** DAG-API.1
**File:** `TamboStudio.tsx`

**Subtasks:**
- [ ] Test spec endpoints
- [ ] Test generation endpoint
- [ ] Test component library endpoints

**Acceptance Criteria:**
- Specs CRUD works
- Generation produces code
- Components list correctly

---

## PHASE 3: BrowserView Integration (4-6 hours)

### DAG-BV.1: Create Tauri FFI Bindings
**Effort:** 2 hours
**Dependencies:** None
**Files:**
- `6-ui/shell-ui/src/views/browserview/src/lib.rs` (add FFI exports)
- `6-ui/shell-ui/src/views/browserview/bindings.ts` (create TypeScript bindings)

**Subtasks:**
- [ ] Add `#[tauri::command]` attributes to BrowserView methods
- [ ] Register commands in Tauri app
- [ ] Create TypeScript type definitions
- [ ] Create invoke wrappers

**Acceptance Criteria:**
- Rust methods callable from TypeScript
- Type safety maintained
- Error handling works

---

### DAG-BV.2: Create BrowserView React Component
**Effort:** 2 hours
**Dependencies:** DAG-BV.1
**File:** `6-ui/shell-ui/src/views/browserview/BrowserView.tsx`

**Subtasks:**
- [ ] Create React component structure
- [ ] Add viewport rendering
- [ ] Add navigation controls (back, forward, reload)
- [ ] Add URL bar
- [ ] Wire FFI calls

**Acceptance Criteria:**
- Browser viewport renders
- Navigation controls work
- URLs load correctly

---

### DAG-BV.3: Add BrowserView to ShellUI Navigation
**Effort:** 30 minutes
**Dependencies:** DAG-BV.2
**File:** `6-ui/shell-ui/src/App.tsx` (or equivalent)

**Subtasks:**
- [ ] Import BrowserView component
- [ ] Add route/menu item
- [ ] Test navigation

**Acceptance Criteria:**
- BrowserView accessible from menu
- Loads without errors

---

### DAG-BV.4: Implement Agent Mode Features
**Effort:** 1.5 hours
**Dependencies:** DAG-BV.2
**Files:**
- `BrowserView.tsx`
- `bindings.ts`

**Subtasks:**
- [ ] Add renderer toggle (HUMAN/AGENT)
- [ ] Add A2UI action buttons
- [ ] Wire agent mode FFI calls
- [ ] Add receipt display

**Acceptance Criteria:**
- Renderer toggle works
- A2UI actions execute
- Receipts display

---

## PHASE 4: Polish & Testing (2 hours)

### DAG-TEST.1: End-to-End Testing
**Effort:** 1 hour
**Dependencies:** All previous phases

**Subtasks:**
- [ ] Test full Swarm flow
- [ ] Test full IVKGE flow
- [ ] Test full Multimodal flow
- [ ] Test full Tambo flow
- [ ] Test BrowserView flow

**Acceptance Criteria:**
- All features work end-to-end
- No console errors
- Good performance

---

### DAG-TEST.2: Error Handling
**Effort:** 30 minutes
**Dependencies:** DAG-TEST.1

**Subtasks:**
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Add retry logic
- [ ] Add user-friendly error messages

**Acceptance Criteria:**
- Graceful error handling
- Clear error messages
- Recovery options

---

### DAG-TEST.3: Visual Polish
**Effort:** 30 minutes
**Dependencies:** DAG-TEST.1

**Subtasks:**
- [ ] Match ShellUI design system
- [ ] Add transitions/animations
- [ ] Responsive design check
- [ ] Dark mode support

**Acceptance Criteria:**
- Consistent with ShellUI
- Smooth animations
- Works on all screen sizes

---

## PHASE 5: Documentation (1 hour)

### DAG-DOC.1: User Documentation
**Effort:** 30 minutes
**Dependencies:** All features complete

**Subtasks:**
- [ ] Create user guide for each feature
- [ ] Add screenshots
- [ ] Document keyboard shortcuts
- [ ] Create troubleshooting guide

**Acceptance Criteria:**
- Clear user instructions
- Visual examples
- Common issues covered

---

### DAG-DOC.2: Developer Documentation
**Effort:** 30 minutes
**Dependencies:** All features complete

**Subtasks:**
- [ ] Document architecture
- [ ] Document API endpoints
- [ ] Document FFI bindings
- [ ] Add code examples

**Acceptance Criteria:**
- Architecture clear
- API reference complete
- Examples working

---

## SUMMARY

| Phase | Tasks | Effort | Status |
|-------|-------|--------|--------|
| **Phase 1: Navigation** | 3 | 1 hour | ⏳ Pending |
| **Phase 2: API** | 5 | 1 hour | ⏳ Pending |
| **Phase 3: BrowserView** | 4 | 4-6 hours | ⏳ Pending |
| **Phase 4: Testing** | 3 | 2 hours | ⏳ Pending |
| **Phase 5: Docs** | 2 | 1 hour | ⏳ Pending |
| **TOTAL** | **15** | **8-10 hours** | ⏳ Pending |

---

## CRITICAL PATH

```
DAG-UI.1 (Nav) → DAG-UI.2 (Route) → DAG-UI.3 (Verify)
                                          ↓
DAG-API.1 (Config) → DAG-API.2-5 (Test APIs)
                                          ↓
DAG-BV.1 (FFI) → DAG-BV.2 (Component) → DAG-BV.3 (Nav) → DAG-BV.4 (Agent Mode)
                                          ↓
                                    DAG-TEST.1-3 → DAG-DOC.1-2
```

**Critical Path Duration:** 8-10 hours

---

## READY TO START

**Starting with DAG-UI.1: Add DAG Menu Item to Side-Nav**

---

**End of Task List**
