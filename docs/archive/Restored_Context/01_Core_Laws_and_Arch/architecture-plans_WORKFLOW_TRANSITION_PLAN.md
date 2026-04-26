# P1 RE-ALIGNMENT PART 4: Workflow Runtime & Transition System

**Target**: Implement the `WorkflowSlideDeck` and transition semantics from `UI/glide_ui_runtime.md`.
**Goal**: Make UI changes (like navigation) feel like smooth transitions and fix reactivity issues.

---

## 📋 PLAN OVERVIEW

| PR | Scope | Source | Goal |
|---|---|---|---|
| **PR #20: P1-M** | WorkflowSlideDeck | `UI/glide_ui_runtime.md` | Create transition wrapper for Canvas Mount. |
| **PR #21: P1-N** | Action Lifecycle | `UI/glide_ui_runtime.md` | Add visual states (pending/success/error) to actions. |
| **PR #22: P1-O** | UI Hardening | User Feedback | Fix reactivity/caching bugs and connectivity. |

---

## 📦 PR #20: P1-M — WORKFLOW SLIDE DECK

**Purpose**: Transition between views instead of content swapping.

#### Task M1: Transition CSS
**Location**: `apps/shell/src/styles.css`
**Details**:
- Define `.ax-slide-enter`, `.ax-slide-exit` animations.
- Shared element transition placeholders.

#### Task M2: Workflow Manager
**Location**: `apps/shell/src/ui/workflow.ts`
**Details**:
- `TransitionProvider`: Handles `SharedElementPush` between views.
- Wraps `renderCanvas` to apply animations.

---

## 📦 PR #21: P1-N — ACTION LIFECYCLE

**Purpose**: Feedback for user actions.

#### Task N1: Toast System
**Location**: `apps/shell/src/ui/toast.ts`
**Details**:
- Simple notification overlay for Action Success/Error.

#### Task N2: Action States
**Location**: `apps/ui/src/views/ListView.ts`
**Details**:
- Add `disabled` state to buttons during `pending`.
- Show subtle spinner.

---

## 📦 PR #22: P1-O — UI HARDENING

**Purpose**: Fix the "Nothing changed / Must refresh" bug.

#### Task O1: Debug Reactivity
**Location**: `apps/shell/src/app.ts`
**Details**:
- Ensure `state` changes always trigger DOM updates.
- Verify `fetch` errors don't stall the UI.

#### Task O2: Connectivity Re-alignment
**Location**: `vite.config.ts`, `main.rs`
**Details**:
- Enforce `127.0.0.1` everywhere to avoid local DNS lag.

---

## 🎯 ACCEPTANCE: FLUID DEMO

1. **User** clicks a row.
2. **View** slides left (Push transition).
3. **Form** slides in.
4. **Action** "Escalate" shows a "Success" toast.
5. **No Refresh** required.

