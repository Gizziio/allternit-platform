# P1 RE-ALIGNMENT PART 5: Action Previews & Governance Gates

**Target**: Implement the "Consent Gate" and "Action Preview" pattern from `UI/UTI.md` and `BACKLOG/Tool Registry.md`.
**Goal**: High-risk actions (write/exec) must show a confirmation preview before execution.

---

## 📋 PLAN OVERVIEW

| PR | Scope | Source | Goal |
|---|---|---|---|
| **PR #23: P1-P** | Action Preview UI | `UI/UTI.md` | Create `ActionPreview` component. |
| **PR #24: P1-Q** | Confirmation Loop | `BACKLOG/Tool Registry.md` | Intercept actions in Shell and require user consent. |
| **PR #25: P1-R** | Risk Indicators | `UI/CanvasProtocol.md` | Visually tag high-risk actions. |

---

## 📦 PR #23: P1-P — ACTION PREVIEW UI

**Purpose**: A dedicated UI for "Action Previews".

#### Task P1: Create ActionPreview Renderer
**Location**: `apps/ui/src/views/ActionPreview.ts`
**Details**:
- Renders: "Target Domain", "Action", "Proposed Changes", "Risk Level".
- Buttons: "Confirm", "Cancel".

#### Task P2: Register View
**Location**: `apps/ui/src/views/ViewRegistry.ts`

---

## 📦 PR #24: P1-Q — CONFIRMATION LOOP

**Purpose**: Stop silent execution.

#### Task Q1: Update Shell Action Handler
**Location**: `apps/shell/src/app.ts`
**Details**:
- If action requires confirmation (defined in spec), don't fetch immediately.
- Instead, render an overlay with `ActionPreview`.
- Proceed with `fetch` only after user clicks "Confirm".

---

## 📦 PR #25: P1-R — RISK INDICATORS

**Purpose**: Visual safety cues.

#### Task R1: Style Updates
**Location**: `apps/shell/src/styles.css`, `apps/ui/src/views/ListView.ts`
**Details**:
- Style buttons with `risk: "write"` as orange/red.
- Show "Action Preview" as a modal-like capsule.

---

## 🎯 ACCEPTANCE: SAFE ACTION DEMO

1. **User** clicks "Escalate".
2. **UI** doesn't execute immediately.
3. **Action Preview** appears: "This will modify the work order status. Proceed?"
4. **User** clicks "Confirm".
5. **Action** executes; Journal shows "Approval Granted".
