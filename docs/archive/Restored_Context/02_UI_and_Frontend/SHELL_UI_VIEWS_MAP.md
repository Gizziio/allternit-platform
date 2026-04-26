# Shell UI Views - Complete Architecture Map

## Overview
Full management views for the Allternit Platform Shell UI (TypeScript/React)

---

## 📁 Directory Structure

```
surfaces/allternit-platform/src/
├── shell/
│   └── ControlCenter.tsx              # Settings console (existing)
│
├── views/
│   ├── index.ts                       # View exports registry
│   │
│   ├── runtime/                       # N3-N16 Runtime Management
│   │   ├── index.ts
│   │   ├── RuntimeSettingsView.tsx    # Basic settings (from ControlCenter)
│   │   ├── BudgetDashboardView.tsx    # N11 - Full budget management
│   │   ├── ReplayManagerView.tsx      # N12 - Capture & replay
│   │   └── PrewarmManagerView.tsx     # N16 - Pool management
│   │
│   ├── workflow/                      # N7 Workflow Management
│   │   ├── index.ts
│   │   ├── WorkflowListView.tsx       # List all workflows
│   │   ├── WorkflowDesignerView.tsx   # Visual DAG builder
│   │   └── WorkflowMonitorView.tsx    # Execution monitoring
│   │
│   └── components/                    # Shared view components
│       ├── StatCard.tsx
│       ├── ProgressBar.tsx
│       ├── DataTable.tsx
│       └── StatusBadge.tsx
│
├── hooks/                             # API integration hooks
│   ├── useBudget.ts
│   ├── useReplay.ts
│   ├── usePrewarm.ts
│   └── useWorkflow.ts
│
└── services/                          # API client services
    └── runtimeService.ts
```

---

## 🎯 View Specifications

### 1. BudgetDashboardView (N11)
**Route:** `/runtime/budget`  
**Access:** Control Center → Runtime Environment → "Open Budget Dashboard" link

**Features:**
- Global stats cards (CPU hours, Memory GB-hours, Network, Workers)
- Active alerts panel
- Tenant quota cards with progress bars
- Consumption history chart
- Add/Edit quota modal
- Measurement table

**API Endpoints:**
- GET `/api/v1/budget/quotas`
- GET `/api/v1/budget/usage/:tenant_id`
- POST `/api/v1/budget/quotas`
- GET `/api/v1/budget/measurements`

---

### 2. ReplayManagerView (N12)
**Route:** `/runtime/replay`  
**Access:** Control Center → Runtime Environment → "Open Replay Manager" link

**Features:**
- Capture manifest list
- Filter by date/level/deterministic
- Replay execution button
- Manifest details panel
- Determinism check results
- Export/Import captures

**API Endpoints:**
- GET `/api/v1/replay/manifests`
- POST `/api/v1/replay/:run_id/replay`
- GET `/api/v1/replay/:run_id/manifest`

---

### 3. PrewarmManagerView (N16)
**Route:** `/runtime/prewarm`  
**Access:** Control Center → Runtime Environment → "Open Prewarm Manager" link

**Features:**
- Pool status cards
- Create pool modal
- Destroy pool button
- Manual warmup trigger
- Instance utilization chart
- Activity log

**API Endpoints:**
- GET `/api/v1/runtime/pools`
- POST `/api/v1/runtime/pools`
- POST `/api/v1/runtime/pools/:name/warmup`
- DELETE `/api/v1/runtime/pools/:name`

---

### 4. WorkflowListView (N7)
**Route:** `/workflows`  
**Access:** Shell Rail → Workflows icon

**Features:**
- Workflow cards grid
- Create workflow button
- Search/filter
- Version tags
- Quick execute button
- Delete workflow

**API Endpoints:**
- GET `/api/v1/workflows`
- POST `/api/v1/workflows`
- DELETE `/api/v1/workflows/:id`

---

### 5. WorkflowDesignerView (N7)
**Route:** `/workflows/:id/designer`  
**Access:** Workflow List → "Design" button OR Create New

**Features:**
- Canvas with drag-drop
- Node palette (sidebar)
- Property panel (sidebar)
- Edge connections
- Validation display
- Save/Deploy buttons
- Zoom controls

**API Endpoints:**
- GET `/api/v1/workflows/:id`
- PUT `/api/v1/workflows/:id`
- POST `/api/v1/workflows/:id/validate`

---

### 6. WorkflowMonitorView (N7)
**Route:** `/workflows/executions/:id`  
**Access:** Auto-open on execution OR Workflow List → "Monitor" tab

**Features:**
- Execution status header
- DAG visualization with node states
- Live log output
- Node details panel
- Stop/Restart buttons
- Timeline view

**API Endpoints:**
- GET `/api/v1/workflows/executions/:id`
- POST `/api/v1/workflows/executions/:id/stop`
- WebSocket for live updates

---

## 🔗 Navigation Integration

### Control Center Links
Add to `RuntimeEnvironmentSection` in ControlCenter.tsx:

```tsx
<div className="mt-4 flex gap-3">
  <LinkButton href="/runtime/budget" icon={DollarSign}>
    Budget Dashboard
  </LinkButton>
  <LinkButton href="/runtime/replay" icon={History}>
    Replay Manager
  </LinkButton>
  <LinkButton href="/runtime/prewarm" icon={RefreshCw}>
    Prewarm Manager
  </LinkButton>
</div>
```

### Shell Rail Items
Add to ShellRail.tsx:

```tsx
{ id: 'workflows', label: 'Workflows', icon: GitBranch, view: 'workflows' },
{ id: 'budget', label: 'Budget', icon: DollarSign, view: 'budget-dashboard' },
```

### View Registry
Add to views/index.ts:

```tsx
export { BudgetDashboardView } from './runtime/BudgetDashboardView';
export { ReplayManagerView } from './runtime/ReplayManagerView';
export { PrewarmManagerView } from './runtime/PrewarmManagerView';
export { WorkflowListView } from './workflow/WorkflowListView';
export { WorkflowDesignerView } from './workflow/WorkflowDesignerView';
export { WorkflowMonitorView } from './workflow/WorkflowMonitorView';
```

---

## 📊 Component Specifications

### Shared Components

#### StatCard
```tsx
interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}
```

#### ProgressBar
```tsx
interface ProgressBarProps {
  label: string;
  value: number; // 0-100
  color?: 'green' | 'yellow' | 'red' | 'blue';
  size?: 'sm' | 'md' | 'lg';
}
```

#### StatusBadge
```tsx
interface StatusBadgeProps {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  text?: string;
}
```

#### DataTable
```tsx
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  paginated?: boolean;
}
```

---

## 🎨 Design System Integration

All views use:
- **GlassSurface** for cards/panels
- **Lucide icons** for consistency
- **Tailwind classes** for styling
- **CSS variables** for theming (--accent, --border, etc.)

### Color Coding
- N3/N4 (Driver): Blue
- N5 (Environment): Purple
- N7 (Workflow): Green
- N11 (Budget): Amber/Orange
- N12 (Replay): Cyan
- N16 (Prewarm): Indigo

---

## 🔄 Data Flow

```
User Action → React Component → Custom Hook → API Service → Backend API
     ↑                                                              ↓
     └────────────────── State Update ←────────────────────────────┘
```

### Example: Budget Dashboard
1. Component mounts
2. `useBudget()` hook fetches quotas
3. `runtimeService.getQuotas()` calls API
4. Backend returns data
5. Hook updates state
6. Component re-renders with data

---

## ✅ Implementation Checklist

- [ ] Create view directory structure
- [ ] Create shared components
- [ ] Create API hooks
- [ ] Implement BudgetDashboardView
- [ ] Implement ReplayManagerView
- [ ] Implement PrewarmManagerView
- [ ] Implement WorkflowListView
- [ ] Implement WorkflowDesignerView
- [ ] Implement WorkflowMonitorView
- [ ] Update ControlCenter with links
- [ ] Add Shell Rail navigation
- [ ] Create view registry
- [ ] Test all views
