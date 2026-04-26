# UI Component Placement Guide

## Where Are the Execution Stack Components in the Allternit Platform Shell UI?

---

## 🎯 Main Entry Point: Control Center

**Location:** Gear icon (⚙️) in top-right of Shell Header  
**File:** `surfaces/allternit-platform/src/shell/ControlCenter.tsx`

### Current Structure:
```
Control Center (Modal Overlay)
├── Sidebar Navigation
│   ├── Browser Pairing
│   ├── Policies
│   ├── 🆕 Runtime Environment ← BASIC SETTINGS HERE
│   ├── Compute & Runtimes
│   ├── Secrets & Credentials
│   └── SSH Connections
│
└── Main Content Area
    ├── BrowserPairingSection
    ├── PolicySection
    ├── RuntimeEnvironmentSection ← N3-N16 SETTINGS
    ├── PlaceholderSection (Compute)
    └── PlaceholderSection (Secrets)
```

---

## 📍 Component Locations

### 1. Runtime Settings (Control Center)

**File:** `surfaces/allternit-platform/src/shell/ControlCenter.tsx`  
**Function:** `RuntimeEnvironmentSection()` (lines 788-1080)

**What's Already There:**
- ✅ Driver Selection (N3/N4) - Process/Container/MicroVM
- ✅ Resource Limits (N11) - CPU/Memory sliders
- ✅ Replay Capture (N12) - none/minimal/full dropdown
- ✅ Prewarm Toggle (N16) - enable/disable switch

**What's Missing:**
- ❌ Budget Dashboard (detailed view)
- ❌ Replay Manager (capture list)
- ❌ Prewarm Pool Manager (pool status)

---

### 2. Full Management Views (New)

These need to be created as separate views:

| View | File Path | Purpose | How to Access |
|------|-----------|---------|---------------|
| **Budget Dashboard** | `views/runtime/BudgetDashboardView.tsx` | Full quota management | Link from Control Center OR Shell Rail |
| **Replay Manager** | `views/runtime/ReplayManagerView.tsx` | Capture list & replay | Link from Control Center |
| **Prewarm Manager** | `views/runtime/PrewarmManagerView.tsx` | Pool management | Link from Control Center |
| **Workflow Designer** | `views/workflow/WorkflowDesignerView.tsx` | Visual DAG builder | Shell Rail → Workflows |
| **Workflow Monitor** | `views/workflow/WorkflowMonitorView.tsx` | Execution tracking | Auto-open on execution |

---

## 🔗 Navigation Integration

### Option 1: Expand Control Center Sections

Add tabs or sub-navigation within `RuntimeEnvironmentSection`:

```tsx
// In RuntimeEnvironmentSection
const [activeTab, setActiveTab] = useState<'settings' | 'budget' | 'replay' | 'prewarm'>('settings');

// Tabs:
// - Settings: Current driver/resource config
// - Budget: Link to full BudgetDashboardView
// - Replay: Link to full ReplayManagerView
// - Prewarm: Link to full PrewarmManagerView
```

### Option 2: Shell Rail Integration

Add dedicated rail items for full management views:

```tsx
// In ShellRail.tsx
{ id: 'budget', label: 'Budget', icon: DollarSign, view: 'budget-dashboard' },
{ id: 'replay', label: 'Replay', icon: History, view: 'replay-manager' },
{ id: 'workflows', label: 'Workflows', icon: GitBranch, view: 'workflow-designer' },
```

### Option 3: Quick Access Widgets

Add floating widgets to ShellOverlayLayer:

```tsx
// Floating budget widget showing current usage
// Click to open full BudgetDashboardView
```

---

## 📁 Actual File Locations

### Backend (Rust) - COMPLETE ✅
```
allternit/
├── domains/kernel/
│   ├── infrastructure/
│   │   ├── allternit-driver-interface/     # N3 - Driver trait
│   │   └── allternit-environment-spec/     # N5 - Environment spec
│   └── execution/
│       └── allternit-process-driver/       # N4 - Process driver
├── domains/governance/
│   └── allternit-replay/                   # N12 - Replay engine
├── services/
│   └── orchestration/
│       ├── allternit-budget-metering/ # N11 - Budget
│       └── allternit-prewarm/              # N16 - Prewarm
└── domains/kernel/control-plane/
    └── allternit-agent-orchestration/
        └── workflows/                # N7 - Workflow engine
```

### API Integration (Rust) - COMPLETE ✅
```
cmd/api/src/
├── tools_routes.rs      # Tool execution with budget/replay/prewarm
├── runtime_routes.rs    # Runtime settings API
└── workflow_routes.rs   # Workflow CRUD + execution API
```

### Shell UI (TypeScript/React) - PARTIAL ⚠️
```
surfaces/allternit-platform/src/
├── shell/
│   └── ControlCenter.tsx           # Has basic RuntimeEnvironmentSection
├── views/
│   ├── settings/                   # ModelManagementView only
│   └── runtime/                    # NEEDS CREATION
│       ├── BudgetDashboardView.tsx     # ⬅️ CREATE THIS
│       ├── ReplayManagerView.tsx       # ⬅️ CREATE THIS
│       └── PrewarmManagerView.tsx      # ⬅️ CREATE THIS
│   └── workflow/                   # NEEDS CREATION
│       ├── WorkflowDesignerView.tsx    # ⬅️ CREATE THIS
│       └── WorkflowMonitorView.tsx     # ⬅️ CREATE THIS
```

---

## 🎨 UI Component Hierarchy

### Control Center (Settings Console)
```
ControlCenter.tsx
└── RuntimeEnvironmentSection (lines 788-1080)
    ├── Driver Selection (N3/N4)
    │   ├── Process/Container/MicroVM cards
    │   └── Isolation level indicators
    ├── Resource Limits (N11)
    │   ├── CPU slider (100-8000 millicores)
    │   ├── Memory slider (64-32768 MiB)
    │   └── Preset buttons (Minimal/Standard/High Perf)
    ├── Replay & Determinism (N12)
    │   ├── Capture level dropdown
    │   └── Status indicator
    └── Prewarm Pools (N16)
        ├── Enable toggle
        └── Basic settings
```

### Full Management Views (Need Creation)
```
views/runtime/
├── BudgetDashboardView.tsx
│   ├── Global stats cards (CPU/Memory/Network/Workers)
│   ├── Active alerts section
│   ├── Tenant quota cards with progress bars
│   └── Recent measurements table
│
├── ReplayManagerView.tsx
│   ├── Capture manifest list
│   ├── Filter/search controls
│   ├── Replay execution button
│   └── Determinism check results
│
└── PrewarmManagerView.tsx
    ├── Pool status cards
    ├── Create/destroy pool buttons
    ├── Warmup trigger
    └── Instance utilization charts

views/workflow/
├── WorkflowDesignerView.tsx
│   ├── Canvas with drag-drop
│   ├── Node palette
│   ├── Property panel
│   └── Validation display
│
└── WorkflowMonitorView.tsx
    ├── Execution list
    ├── Live status cards
    ├── Node progress visualization
    └── Log output panel
```

---

## ✅ What's Wired In

### Backend → API ✅
- [x] `tools_routes.rs` uses budget_engine, replay_engine, pool_manager
- [x] `runtime_routes.rs` exposes all settings endpoints
- [x] `workflow_routes.rs` has DAG execution

### API → Shell UI (Basic) ✅
- [x] ControlCenter shows driver selection
- [x] ControlCenter shows resource sliders
- [x] ControlCenter shows replay toggle
- [x] ControlCenter shows prewarm toggle

### API → Shell UI (Full Views) ❌
- [ ] BudgetDashboardView needs creation
- [ ] ReplayManagerView needs creation
- [ ] PrewarmManagerView needs creation
- [ ] WorkflowDesignerView needs creation
- [ ] WorkflowMonitorView needs creation

---

## 🔧 How to Complete

### Step 1: Create Full Management Views
```bash
# Create files:
surfaces/allternit-platform/src/views/runtime/BudgetDashboardView.tsx
surfaces/allternit-platform/src/views/runtime/ReplayManagerView.tsx
surfaces/allternit-platform/src/views/runtime/PrewarmManagerView.tsx
surfaces/allternit-platform/src/views/workflow/WorkflowDesignerView.tsx
surfaces/allternit-platform/src/views/workflow/WorkflowMonitorView.tsx
```

### Step 2: Add to View Registry
```tsx
// In views/index.ts or similar
export { BudgetDashboardView } from './runtime/BudgetDashboardView';
export { ReplayManagerView } from './runtime/ReplayManagerView';
// ... etc
```

### Step 3: Add Navigation Links
```tsx
// In ControlCenter.tsx RuntimeEnvironmentSection
// Add buttons/links to open full views:
<button onClick={() => openView('budget-dashboard')}>
  Open Full Budget Dashboard →
</button>
```

### Step 4: Connect to API
```tsx
// In each view, fetch from API:
const { data: quotas } = useSWR('/api/v1/budget/quotas', fetcher);
const { data: executions } = useSWR('/api/v1/workflows/executions', fetcher);
```

---

## 📍 Summary

| Component | Location | Status |
|-----------|----------|--------|
| Driver Selection | Control Center → Runtime Environment | ✅ Complete |
| Resource Limits | Control Center → Runtime Environment | ✅ Complete |
| Replay Toggle | Control Center → Runtime Environment | ✅ Complete |
| Prewarm Toggle | Control Center → Runtime Environment | ✅ Complete |
| **Budget Dashboard** | views/runtime/BudgetDashboardView.tsx | ⬅️ **NEEDS CREATION** |
| **Replay Manager** | views/runtime/ReplayManagerView.tsx | ⬅️ **NEEDS CREATION** |
| **Prewarm Manager** | views/runtime/PrewarmManagerView.tsx | ⬅️ **NEEDS CREATION** |
| **Workflow Designer** | views/workflow/WorkflowDesignerView.tsx | ⬅️ **NEEDS CREATION** |
| **Workflow Monitor** | views/workflow/WorkflowMonitorView.tsx | ⬅️ **NEEDS CREATION** |

The backend integration is 100% complete. The UI has basic settings in Control Center but needs the full management views created as React components.
