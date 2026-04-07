# A2R Native: Context Engineering Workflow

This document defines the **A2R Native** workflow for A2rchitech Brain Runtimes. 
It is a spec-driven, state-tracked development methodology designed for high-autonomy agents.

## Core Philosophy

1.  **Research First**: Never implement without mapping the codebase and validating assumptions.
2.  **Plan Backward**: Define success criteria (must-haves, artifacts) before writing a single line of code.
3.  **State is Truth**: Maintain `.a2r/STATE.md` as the living memory of the project.
4.  **Atomic Execution**: Break work into "Plans" (waves) that are verifiable and discrete.

## Standard Artifacts

All A2R Native projects must maintain these files in `.a2r/`:

-   `PROJECT.md`: High-level intent, core value, and requirements.
-   `ROADMAP.md`: Milestone breakdown and requirement mapping.
-   `STATE.md`: Current position, velocity, and session continuity.
-   `PLAN.md`: Executable task list for the current wave.

## Workflow Phases

### Phase 1: Initialize (Research & Discovery)
1.  **Map**: Use `grep_search` and `glob` to understand the current state.
2.  **Define**: Create `PROJECT.md` based on user intent and current codebase.
3.  **Breakdown**: Create `ROADMAP.md` with clear milestones.
4.  **Initialize**: Create `STATE.md` to track progress.

### Phase 2: Plan (Task Engineering)
1.  **Select Milestone**: Pick the next active requirement from `ROADMAP.md`.
2.  **Draft Plan**: Use the `PLAN.md` template to define specific tasks.
3.  **Validate Plan**: Ensure every task has a clear `verify` command and `done` criteria.

### Phase 3: Execute (Action & Validation)
1.  **Iterate**: Execute tasks in the `PLAN.md` wave.
2.  **Verify**: Run the verification commands after each task.
3.  **Update State**: Upon plan completion, update `.a2r/STATE.md` and mark requirements as "Validated" in `PROJECT.md` if shipped.

## Agent Instructions

When operating in **A2R Native** mode:
-   **Read STATE.md first** in every session.
-   **Propose changes** to `PROJECT.md` if requirements drift.
-   **Never skip verification**. A task is only "done" when the verification command passes.
-   **Maintain clean diffs**. Follow the `ChangeSet` protocol defined in the `BrainRuntime`.

---
*A2R Native: Powered by A2rchitech Kernel*
