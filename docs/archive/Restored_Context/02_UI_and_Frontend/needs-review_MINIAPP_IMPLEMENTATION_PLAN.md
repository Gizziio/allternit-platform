# P1 RE-ALIGNMENT: Mini-App Data System & Unified UI
## Recovering from Drift: Implementing the Ragic-Class Primitive

**Target**: Implement the **Data System Primitive** described in `Architecture/UI/MiniAppRuntime.md`.  
**Goal**: Enable the Shell to render data-driven Mini-Apps (Tables, Forms, Dashboards) defined by schemas, not just hardcoded React components.  
**Source**: `UI/MiniAppRuntime.md`, `UI/CanvasProtocol.md`.

---

## 📋 PLAN OVERVIEW

| PR | Scope | Source | Goal |
|---|---|---|---|
| **PR #8: P1-D** | Contract Upgrade | `UI/MiniAppRuntime.md` | Align `ViewSpec` with Ragic-class schema (Columns, Actions). |
| **PR #9: P1-E** | Data System Mock | `UI/MiniAppRuntime.md` | Create `miniapp-data-system` that serves a "Work Order" mini-app. |
| **PR #10: P1-F** | Shell Rendering | `UI/CanvasProtocol.md` | Upgrade `apps/ui` to render the new `ViewSpec` (Table, Actions). |

---

## 📦 PR #8: P1-D — CONTRACT UPGRADE

**Purpose**: Define the types required for a data-driven mini-app.

#### Task D1: Update ViewSpec
**Location**: `apps/shared/contracts.ts`
**Details**:
- Add `columns`: `{field, label, type}`
- Add `actions`: `{id, label, policy}`
- Add `layout`: `{sections, fields}` for forms.
- Add `query`: `{filter, sort}` definition.

#### Task D2: Define MiniAppManifest
**Location**: `apps/shared/contracts.ts`
**Details**:
- `MiniAppManifest`: data_models, views, actions.

---

## 📦 PR #9: P1-E — DATA SYSTEM PRIMITIVE (MOCK)

**Purpose**: Create the backend service that acts as the "Ragic" engine.

#### Task E1: Create Service
**Location**: `services/miniapp-system/` (New Service) or extend `services/framework`
**Details**:
- Implement `get_view(view_id)` -> returns `ViewSpec`.
- Implement `execute_action(action_id)` -> logs to Journal.
- **Scenario**: "Work Orders" app (as defined in `UI/MiniAppRuntime.md`).

---

## 📦 PR #10: P1-F — SHELL RENDERING

**Purpose**: Make the Shell actually render this rich metadata.

#### Task F1: Upgrade ListView
**Location**: `apps/ui/src/views/ListView.ts`
**Details**:
- Render columns dynamically based on spec.
- Render Action buttons.

#### Task F2: Action Handler
**Location**: `apps/shell/src/app.ts`
**Details**:
- Handle `action` clicks from Views.
- Dispatch to `v1/intent/dispatch` or `miniapp-system`.

---

## 🎯 ACCEPTANCE: WORK ORDER DEMO

**Scenario**: User types "open work orders".
1.  **Shell** spawns "Work Orders" Capsule.
2.  **MiniApp System** returns `ViewSpec` for `workorders.queue.default`.
3.  **Shell** renders a Table with "ID", "Site", "Priority".
4.  **User** clicks "Escalate" action on a row.
5.  **Shell** dispatches action; Journal records it.

