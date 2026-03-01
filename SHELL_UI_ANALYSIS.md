# 6-ui/shell-ui/ Deep Analysis

**Date:** 2026-02-24  
**Finding:** This is NOT a duplicate - it's the Rust backend for native UI components

---

## THE REAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│  6-ui/a2r-platform/src/views/                                   │
│  ──────────────────────────────                                 │
│  REACT WRAPPERS (TypeScript/React)                              │
│  ├── runtime/BudgetDashboardView.tsx    ← Uses useBudget hook   │
│  ├── runtime/PrewarmManagerView.tsx                             │
│  ├── runtime/ReplayManagerView.tsx                              │
│  ├── workflow/WorkflowDesignerView.tsx  ← Placeholder UI        │
│  ├── workflow/WorkflowMonitorView.tsx                           │
│  └── dag/BrowserView.tsx                ← References Rust       │
│                                                                 │
│  STATUS: WRAPPERS EXIST BUT ARE STUBS/PLACEHOLDERS              │
│  They DON'T actually integrate with the Rust code yet!          │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ SHOULD INTEGRATE (NOT YET DONE)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6-ui/shell-ui/src/views/                                       │
│  ─────────────────────────                                      │
│  NATIVE RUST COMPONENTS                                         │
│  ├── browserview/               ← Native browser automation     │
│  │   ├── src/lib.rs            (Rust: 917 lines)                │
│  │   ├── src/playwright.rs     (Playwright integration)         │
│  │   ├── src/navigation.rs     (Navigation controller)          │
│  │   └── Cargo.toml            (Crate: a2r-shellui-browserview) │
│  │                                                              │
│  ├── runtime/                                                   │
│  │   ├── budget.rs             (BudgetDashboard - Rust)         │
│  │   ├── prewarm.rs            (PrewarmPoolManager - Rust)      │
│  │   ├── replay.rs             (ReplayManager - Rust)           │
│  │   ├── settings.rs           (RuntimeSettingsView - Rust)     │
│  │   └── mod.rs                (Exports all runtime views)      │
│  │                                                              │
│  ├── workflow/                                                  │
│  │   ├── designer.rs           (WorkflowDesigner - Rust)        │
│  │   ├── monitor.rs            (WorkflowMonitor - Rust)         │
│  │   └── mod.rs                                                 │
│  │                                                              │
│  └── openclaw/                                                  │
│      └── OpenClawControlUI.tsx (TypeScript - iframe embed)      │
│                                                                 │
│  STATUS: RUST CODE EXISTS BUT NOT CONNECTED TO REACT            │
│  Need FFI bindings or WASM compilation + TS bindings            │
└─────────────────────────────────────────────────────────────────┘
```

---

## THE PROBLEM

**You have TWO implementations that should be ONE integrated system:**

### Rust Backend (6-ui/shell-ui/)
Provides native capabilities that TypeScript can't do:
- **browserview/**: Native browser automation via Playwright
- **runtime/**: Budget metering, prewarm pools, replay capture
- **workflow/**: Workflow designer with native performance

### React Frontend (6-ui/a2r-platform/src/views/)
Has placeholder wrappers that DON'T use the Rust code:
- `BudgetDashboardView.tsx`: Uses `useBudget` hook (TypeScript-only)
- `BrowserView.tsx`: Just shows a card saying "Rust engine exists"
- `WorkflowDesignerView.tsx`: Has basic UI but no Rust integration

---

## EVIDENCE

### 1. BudgetDashboard - NOT Integrated

**Rust Backend (6-ui/shell-ui/src/views/runtime/budget.rs):**
```rust
pub struct BudgetDashboard {
    pub quotas: Vec<TenantQuota>,
    pub usage_summary: UsageSummary,
    pub recent_measurements: Vec<MeasurementEntry>,
    pub alerts: Vec<BudgetAlert>,
}
```

**React Frontend (6-ui/a2r-platform/src/views/runtime/BudgetDashboardView.tsx):**
```typescript
export function BudgetDashboardView() {
  const { quotas, usage, isLoading, error, refetch } = useBudget();
  // Uses useBudget() hook - NO Rust integration!
  // Just calls TypeScript hooks, not the Rust BudgetDashboard
```

### 2. BrowserView - NOT Integrated

**Rust Backend (6-ui/shell-ui/src/views/browserview/src/lib.rs):**
```rust
pub struct BrowserView {
    navigation: NavigationController,
    session: SessionManager,
    capture: CaptureManager,
    playwright: PlaywrightLauncher,
}
// 917 lines of Rust browser automation code!
```

**React Frontend (6-ui/a2r-platform/src/views/dag/BrowserView.tsx):**
```typescript
export function BrowserView() {
  return (
    <Card>
      <CardContent>
        <p>Backend: 6-ui/shell-ui/src/views/browserview/src/lib.rs</p>
        <p>Status: ✅ Rust engine (917 lines), React wrapper placeholder</p>
        <p>Note: Full React wrapper with FFI bindings needed</p>
      </CardContent>
    </Card>
  );
  // JUST A PLACEHOLDER! No actual Rust integration
}
```

### 3. Workflow Designer - NOT Integrated

**Rust Backend (6-ui/shell-ui/src/views/workflow/designer.rs):**
```rust
pub struct WorkflowDesigner {
    dag_definition: DagDefinition,
    node_palette: Vec<NodeTemplate>,
    canvas: CanvasState,
}
```

**React Frontend (6-ui/a2r-platform/src/views/workflow/WorkflowDesignerView.tsx):**
```typescript
export function WorkflowDesignerView() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: 'node-1', type: 'input', name: 'Start', x: 100, y: 200 },
    { id: 'node-2', type: 'process', name: 'Build', x: 300, y: 200 },
  ]);
  // Uses React state - NO Rust integration!
  // The Rust WorkflowDesigner is not used
```

---

## WHAT NEEDS TO HAPPEN

### Option A: WASM Compilation (Recommended)

Compile Rust to WASM, generate TypeScript bindings:

```
shell-ui Rust → wasm-pack → WASM + TypeScript bindings → a2r-platform
```

**Steps:**
1. Add `wasm-bindgen` to Rust crates
2. Compile with `wasm-pack`
3. Generate TypeScript definitions
4. Import in a2r-platform views
5. Replace placeholder implementations

### Option B: Native FFI via Electron

Keep Rust as native code, use Electron's native modules:

```
shell-ui Rust → compiled binary → Electron native module → a2r-platform
```

**Steps:**
1. Compile Rust to native library (.so/.dll/.dylib)
2. Create Node.js native addon (NAPI)
3. Call from Electron main process
4. Expose via IPC to renderer

### Option C: Merge Into Single Crate

Move all Rust code into one location with proper integration:

```
6-ui/a2r-platform/src/native/  ← Move Rust here
  ├── browserview/
  ├── runtime/
  └── workflow/
```

---

## VERDICT

### 6-ui/shell-ui/ is NOT a duplicate

**It's the Rust backend that SHOULD power the a2r-platform views.**

**Status:** 
- ✅ Rust code: EXISTS and is substantial (1000+ lines)
- ❌ Integration: MISSING - wrappers are stubs
- ❌ WASM build: NOT configured
- ❌ FFI bindings: NOT created

### What to do:

1. **KEEP** 6-ui/shell-ui/ - this is valuable native code
2. **DELETE** browserview/target/ - build artifacts (huge, shouldn't be in git)
3. **INTEGRATE** the Rust with React via WASM or FFI
4. **MOVE** OpenClawControlUI.tsx to a2r-platform (it's TS not Rust)

---

## FILE INVENTORY

### Rust Source Files (KEEP):
```
6-ui/shell-ui/src/views/
├── browserview/src/
│   ├── lib.rs           (917 lines - main BrowserView)
│   ├── playwright.rs    (Playwright integration)
│   ├── navigation.rs    (Navigation controller)
│   ├── session.rs       (Session management)
│   └── capture.rs       (Screenshot capture)
├── runtime/
│   ├── budget.rs        (BudgetDashboard)
│   ├── prewarm.rs       (PrewarmPoolManager)
│   ├── replay.rs        (ReplayManager)
│   └── settings.rs      (RuntimeSettings)
└── workflow/
    ├── designer.rs      (WorkflowDesigner)
    └── monitor.rs       (WorkflowMonitor)
```

### Build Artifacts (DELETE):
```
6-ui/shell-ui/src/views/browserview/target/
├── debug/               (HUGE - build artifacts)
└── Cargo.lock
```

### TypeScript (MOVE to a2r-platform):
```
6-ui/shell-ui/src/views/openclaw/OpenClawControlUI.tsx
```

---

## NEXT STEPS

1. **Add .gitignore** for target/ folder
2. **Choose integration approach** (WASM vs FFI)
3. **Configure wasm-pack** or native build
4. **Create TypeScript bindings**
5. **Replace placeholder views** with real integration

**This is a significant integration task, not a cleanup task.**
