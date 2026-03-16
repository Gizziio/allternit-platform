# Rails/DAK UI Unification - Quick Start

## 📋 Task Checklist

### Phase 1: Analysis (Week 1)
- [ ] n_0001: Audit existing views (AgentView, RailsView, RunnerView)
- [ ] n_0002: Design system specification
- [ ] n_0003: API endpoint verification
- [ ] n_0004: Audit console drawer views

### Phase 2: Store (Week 1-2)
- [ ] n_0101: Create unified store
- [ ] n_0102: Migrate RailsView
- [ ] n_0103: Migrate RunnerView

### Phase 3: Components (Week 2-4)
- [ ] n_0201: Tab navigation bar
- [ ] n_0202: Plan tab
- [ ] n_0203: Work tab
- [ ] n_0204: Status tab
- [ ] n_0205: Mail tab
- [ ] n_0206: Tools tab
- [ ] n_0207: Audit tab

### Phase 4: Context (Week 4-5)
- [ ] n_0301: Context state management
- [ ] n_0302: Smart defaults

### Phase 5: Cleanup (Week 5)
- [ ] n_0401: Remove old views
- [ ] n_0402: Update navigation
- [ ] n_0403: Error handling

### Phase 6: Testing (Week 6)
- [ ] n_0501: End-to-end testing
- [ ] n_0502: Documentation

### Phase 7: Drawer (Week 6-7)
- [ ] n_0601: Wire Kanban
- [ ] n_0602: Replace Runs view
- [ ] n_0603: Wire Orchestration
- [ ] n_0604: Align Scheduler
- [ ] n_0605: Extend Logs
- [ ] n_0606: Add Context tab
- [ ] n_0607: Drawer/main sync

### Phase 8: Rail (Week 7)
- [ ] n_0701: Unified rail entry
- [ ] n_0702: Update code mode rail
- [ ] n_0703: Remove deprecated entries
- [ ] n_0704: Update view registry

---

## 🏗️ Implementation Order

```
Week 1: Foundation
├── Day 1-2: Audit existing code (n_0001, n_0004)
├── Day 3-4: Design spec + API verification (n_0002, n_0003)
└── Day 5: Create unified store skeleton (n_0101 start)

Week 2: Store + Tab Bar
├── Day 1-2: Complete unified store (n_0101)
├── Day 3: Migrate RailsView (n_0102)
├── Day 4: Migrate RunnerView (n_0103)
└── Day 5: Tab navigation bar (n_0201)

Week 3: Core Tabs
├── Day 1-2: Plan tab (n_0202)
├── Day 3-4: Work tab (n_0203)
└── Day 5: Status tab (n_0204)

Week 4: Remaining Tabs
├── Day 1-2: Mail tab (n_0205)
├── Day 3: Tools tab (n_0206)
└── Day 4-5: Audit tab (n_0207)

Week 5: Context + Cleanup
├── Day 1-2: Context state (n_0301)
├── Day 3: Smart defaults (n_0302)
├── Day 4: Remove old views (n_0401)
└── Day 5: Navigation + errors (n_0402, n_0403)

Week 6: Testing + Drawer Start
├── Day 1-2: E2E testing (n_0501)
├── Day 3: Documentation (n_0502)
├── Day 4: Kanban wiring (n_0601)
└── Day 5: Runs view (n_0602)

Week 7: Drawer Complete + Rail
├── Day 1: Orchestration + Scheduler (n_0603, n_0604)
├── Day 2: Logs + Context tab (n_0605, n_0606)
├── Day 3: Drawer sync (n_0607)
├── Day 4: Rail consolidation (n_0701, n_0702)
└── Day 5: Cleanup + final testing (n_0703, n_0704)
```

---

## 🎯 Critical Path

```
n_0003 (API verification)
    │
    ▼
n_0101 (Unified store) ◄── REQUIRED BY ──┐
    │                                      │
    ├──► n_0102 (Migrate RailsView)       │
    │       │                             │
    │       ▼                             │
    │   n_0201 (Tab bar)                  │
    │       │                             │
    │       ├──► n_0202 (Plan)            │
    │       ├──► n_0203 (Work)            │
    │       ├──► n_0204 (Status)          │
    │       ├──► n_0205 (Mail)            │
    │       ├──► n_0206 (Tools)           │
    │       └──► n_0207 (Audit)           │
    │               │                     │
    │               ▼                     │
    │           n_0301 (Context) ◄────────┤
    │               │                     │
    │               ▼                     │
    │           n_0302 (Smart defaults)   │
    │               │                     │
    │               ▼                     │
    │           n_0606 (Context tab) ◄────┘
    │               │
    │               ▼
    │           n_0607 (Drawer sync)
    │
    └──► n_0601 (Kanban) ──► n_0607
    └──► n_0602 (Runs) ────► n_0607
    └──► n_0603 (Agents) ──► n_0607
    └──► n_0604 (Scheduler) ──► n_0607

n_0302 ──► n_0401 ──► n_0402 ──► n_0701 ──► n_0702 ──► n_0703 ──► n_0704
```

---

## 🎨 Design Tokens

```typescript
// Color tokens for contexts
const contextColors = {
  planning:    { bg: '#6366f1', text: '#ffffff' }, // Indigo
  working:     { bg: '#10b981', text: '#ffffff' }, // Emerald
  executing:   { bg: '#f59e0b', text: '#ffffff' }, // Amber
  monitoring:  { bg: '#06b6d4', text: '#ffffff' }, // Cyan
  reviewing:   { bg: '#ec4899', text: '#ffffff' }, // Pink
  idle:        { bg: '#6b7280', text: '#ffffff' }, // Gray
};

// Tab icons (Lucide)
const tabIcons = {
  plan:   'GitBranch',
  work:   'ClipboardList',
  status: 'Activity',
  mail:   'Mail',
  tools:  'Settings2',
  audit:  'History',
};

// Drawer tab icons (Phosphor)
const drawerIcons = {
  queue:      'Kanban',
  terminal:   'Terminal',
  logs:       'Scroll',
  executions: 'ClockCounterClockwise',
  agents:     'Robot',
  scheduler:  'Clock',
  context:    'Target',
};
```

---

## 🔌 API Quick Reference

```typescript
// Essential Rails API endpoints
const railsApi = {
  // DAG Planning
  'GET  /v1/plans':           'List all DAGs',
  'POST /v1/plan':            'Create new DAG from description',
  'POST /v1/plan/refine':     'Refine existing DAG',
  'POST /v1/dags/:id/execute':'Execute a DAG',
  'POST /v1/runs/:id/cancel': 'Cancel a running execution',
  
  // Work Items (WIH)
  'POST /v1/wihs':            'List WIHs with filters',
  'POST /v1/wihs/pickup':     'Pickup a WIH',
  'POST /v1/wihs/:id/close':  'Close a WIH',
  
  // Leases
  'GET  /v1/leases':          'List active leases',
  'POST /v1/leases':          'Request a lease',
  'POST /v1/leases/:id/renew':'Renew a lease',
  'DELETE /v1/leases/:id':    'Release a lease',
  
  // Mail
  'GET  /v1/mail/inbox':      'Get inbox messages',
  'POST /v1/mail/threads':    'List threads',
  'POST /v1/mail/send':       'Send a message',
  'POST /v1/mail/review':     'Request review',
  'POST /v1/mail/decide':     'Approve/reject review',
  
  // Ledger
  'POST /v1/ledger/tail':     'Get recent events',
  'POST /v1/ledger/trace':    'Trace execution',
};
```

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] Unified store actions
- [ ] Tab component rendering
- [ ] Context state transitions
- [ ] API error handling

### Integration Tests
- [ ] Plan → Execute flow
- [ ] WIH pickup → Complete flow
- [ ] Lease request → Renew → Release
- [ ] Mail send → Review → Approve
- [ ] Drawer/main view sync

### E2E Tests
- [ ] Full workflow: Create plan → Execute → Pickup WIH → Complete
- [ ] Context switching persists across tabs
- [ ] Rail navigation works in all modes
- [ ] Drawer updates reflect main view changes
- [ ] Mobile responsive behavior

---

## 📁 Key Files

### New Files to Create
```
src/
├── views/
│   └── AgentSystemView/
│       ├── index.tsx
│       ├── TabBar.tsx
│       ├── tabs/
│       │   ├── PlanTab.tsx
│       │   ├── WorkTab.tsx
│       │   ├── StatusTab.tsx
│       │   ├── MailTab.tsx
│       │   ├── ToolsTab.tsx
│       │   └── AuditTab.tsx
│       └── hooks/
│           └── useAgentSystem.ts
│
└── lib/agents/
    └── unified.store.ts
```

### Files to Modify
```
src/
├── shell/
│   ├── ShellApp.tsx              # View registry, remove runner
│   └── rail/
│       ├── rail.config.ts        # Consolidate entries
│       └── code.config.ts        # Update execution section
│
├── views/
│   ├── code/
│   │   ├── KanbanBoard.tsx       # Use unified store
│   │   ├── RunsView.tsx          # Use unified store
│   │   ├── OrchestrationView.tsx # Use unified store
│   │   └── ConsoleDrawer/
│   │       ├── DrawerRoot.tsx    # Add Context tab
│   │       └── DrawerTabs.tsx    # New tab definitions
│   │
│   ├── RailsView.tsx             # Migrate or deprecate
│   └── RunnerView.tsx            # Migrate or deprecate
│
└── lib/agents/
    └── dak.store.ts              # Merge into unified
```

### Files to Delete (after migration)
```
src/
├── views/
│   ├── RailsView.tsx             # After n_0401
│   ├── RunnerView.tsx            # After n_0401
│   └── GlobalLeaseCenter.tsx     # If exists (mock data)
│
└── lib/agents/
    └── agent.store.ts            # After n_0102 (if not needed elsewhere)
```

---

## 🚨 Common Pitfalls

1. **Don't forget drawer integration** - It's not just main view; the drawer needs wiring too
2. **Test API endpoints first** - Verify Rails backend before building UI
3. **Keep AgentView separate** - It's for agent configuration, not part of unification
4. **Migrate gradually** - Don't delete old views until new ones are fully tested
5. **Context sync is critical** - Users expect drawer and main view to stay in sync
6. **Mobile matters** - Console drawer becomes bottom sheet on mobile

---

## 💡 Tips

- Use `useUnifiedStore.getState()` for actions outside React components
- Subscribe to store changes in drawer for real-time sync
- Use React Query or SWR for server state if preferred over Zustand
- Add React DevTools integration for easier debugging
- Consider feature flags for gradual rollout

---

## 📞 Need Help?

See full documentation:
- `CONSOLE_DRAWER_INTEGRATION.md` - Detailed drawer analysis
- `UI_ARCHITECTURE_DIAGRAM.md` - Visual architecture
- `dag_ui_rails_dak_unification.yaml` - Complete task DAG
