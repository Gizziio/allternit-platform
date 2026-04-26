# P1 RE-ALIGNMENT PART 3: Navigation & Detail Views

**Target**: Complete the Navigation loop defined in `UI/MiniAppRuntime.md`.
**Goal**: Enable clicking a row in a Table View to open a Detail/Form View for that record.

---

## 📋 PLAN OVERVIEW

| PR | Scope | Source | Goal |
|---|---|---|---|
| **PR #13: P1-I** | Navigation Logic | `UI/PresentationKernel.md` | `ListView` emits nav event -> Shell updates state. |
| **PR #14: P1-J** | Detail Framework | `UI/MiniAppRuntime.md` | Framework Service serves `/frameworks/fwk_workorder/views/{id}`. |

---

## 📦 PR #13: P1-I — NAVIGATION LOGIC

**Purpose**: Make rows clickable.

#### Task I1: Update ListView
**Location**: `apps/ui/src/views/ListView.ts`
**Details**:
- Add click handler to rows.
- Dispatch `ax-navigate` event with `{ target: "view", viewId: "workorder.detail", context: { id: "WO-101" } }`.

#### Task I2: Update Shell App
**Location**: `apps/shell/src/app.ts`
**Details**:
- Listen for `ax-navigate`.
- Call `GET /api/frameworks/{fwk}/views/{viewId}?context={...}` (Need to define this endpoint).
- Update `activeCanvas` with the new ViewSpec.

---

## 📦 PR #14: P1-J — DETAIL FRAMEWORK ENDPOINT

**Purpose**: Serve the Detail View dynamically.

#### Task J1: Add View Endpoint
**Location**: `services/framework/src/main.rs`
**Details**:
- `GET /frameworks/:fwk_id/views/:view_id`
- Returns `CanvasSpec` (or `ViewSpec`) for the detail view.

#### Task J2: Implement WorkOrder Detail Template
**Location**: `services/framework/src/templates.rs`
**Details**:
- `create_workorder_detail_view(context)` -> Returns `form_view` with fields populated.

---

## 🎯 ACCEPTANCE: NAVIGATION DEMO

1. **User** clicks "WO-101" row.
2. **Shell** requests detail view.
3. **Framework Service** returns Form View for WO-101.
4. **Shell** renders Form View.
5. **User** edits and clicks "Save" -> Action Dispatch.

