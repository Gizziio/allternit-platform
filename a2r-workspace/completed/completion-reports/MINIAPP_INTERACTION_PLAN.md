# P1 RE-ALIGNMENT PART 2: Interactive Mini-Apps (Actions & Forms)

**Target**: Complete the Mini-App interaction loop defined in `UI/MiniAppRuntime.md`.
**Goal**: Make the "Escalate" button work (Action Dispatch) and add a Form View for editing (Canonical UI).

---

## 📋 PLAN OVERVIEW

| PR | Scope | Source | Goal |
|---|---|---|---|
| **PR #11: P1-G** | Action Dispatch | `UI/MiniAppRuntime.md` | `POST /v1/actions/dispatch` to handle UI events. |
| **PR #12: P1-H** | Form Protocol | `UI/CanvasProtocol.md` | Implement `form_view` renderer in Shell. |
| **PR #13: P1-I** | Navigation | `UI/PresentationKernel.md` | Enable Row Click -> Detail View navigation. |

---

## 📦 PR #11: P1-G — ACTION DISPATCH

**Purpose**: Close the loop on the "Escalate" button.

#### Task G1: Define Action Contract
**Location**: `apps/shared/contracts.ts`, `services/kernel/src/types.rs`
**Details**:
- `ActionRequest`: `{ actionId, context: { capsuleId, viewId, data } }`
- `ActionResponse`: `{ success, journalEvents[], stateUpdates? }`

#### Task G2: Implement Kernel Endpoint
**Location**: `services/kernel/src/main.rs`, `services/kernel/src/action_handler.rs`
**Details**:
- Route `POST /v1/actions/dispatch`
- Log `decision` event to Journal (as per `UI/Journal.md`)
- Mock state update (e.g., return a toast message "Work Order Escalated")

#### Task G3: Wire Shell
**Location**: `apps/shell/src/app.ts`
**Details**:
- Replace console.log in `ax-action` listener with `fetch`.
- Handle response (show toast/notification).

---

## 📦 PR #12: P1-H — FORM VIEW

**Purpose**: Allow data entry (The "Form" in Ragic).

#### Task H1: Implement FormRenderer
**Location**: `apps/ui/src/views/FormView.ts`
**Details**:
- Render fields based on `ViewSpec.layout` and `ViewSpec.data`.
- Input types: text, select, date.
- "Save" button triggers Action Dispatch.

#### Task H2: Register View
**Location**: `apps/ui/src/views/ViewRegistry.ts`

---

## 🎯 ACCEPTANCE: INTERACTIVE DEMO

1. **User** clicks "Escalate".
2. **Shell** calls Kernel.
3. **Kernel** logs "Approval Requested" to Journal.
4. **Shell** shows success state.

