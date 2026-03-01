# Kimi 2.5 Agent Swarm Prompt (Lead + Subagents) — A2rchitech Shell UI

You are running inside an agent harness that supports **multiple concurrent sessions**. Create a lead orchestrator and a small swarm. The objective is to complete Phase 1–3 of the Shell UI plan without creating files outside the repo root.

## Absolute constraints (must obey)
- REPO_ROOT is fixed: `/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/`
- NEVER use relative paths without prefixing REPO_ROOT.
- Do not create parallel “scratch projects” in `/Users/macbook/apps/*` or `/Users/macbook/aibos/*`.
- All file writes must be under:
  - `REPO_ROOT/apps/shell/` OR
  - `REPO_ROOT/vendor/` (only for quarantined imports) OR
  - `REPO_ROOT/spec/` (docs/specs)
- Every code change must reference the target file and exact function/reducer case being modified.
- If a subagent is unsure of the current working directory, it must first prove it by listing the repo root.

## Deliverable
A working shell where:
1) Browser rail clicks do NOT spawn new Electron tabs/windows (singleton focus)
2) Navigation doesn’t overlay views; back/forward works
3) Glass design system is applied to choke points (LeftRail, header, drawers, dock widget)

## Create this team (sessions_spawn)
1) LEAD_ORCH — Orchestrator, owns plan + merges decisions
2) NAV_SUBSTRATE — Fixes NavigationState semantics (stable IDs, focus vs open, stack)
3) BROWSER_CAPSULE — Fixes WindowedBrowserView lifecycle and Electron tab/window behavior
4) UI_POLISH — Applies glass tokens at choke points (no runtime rewrites)
5) QA_VALIDATOR — Writes/executes a smoke-test script and validates acceptance criteria

## Coordination rules
- LEAD_ORCH creates an execution queue and assigns tasks.
- Subagents work in parallel, but MUST:
  - open the target file
  - propose a diff plan
  - wait for LEAD_ORCH approval before writing
- QA_VALIDATOR runs after each merge and reports failures with file/line pointers.

## Phase 1 (Correctness) — Must finish before any UI polish
NAV_SUBSTRATE: Patch `apps/shell/src/runtime/NavigationState.tsx`
- SET_PRIMARY_VIEW: make viewInstanceId stable:
  - viewInstanceId = action.view.viewInstanceId ?? action.view.capsuleId ?? action.view.type
- OPEN_VIEW: capsuleId generated first; viewInstanceId = capsuleId
- FOCUS_VIEW:
  - select most recent matching view from stack (iterate from end)
  - never generate new IDs when focusing existing
  - never push stack on focus
- spawnOrFocus:
  - focusing existing must call navigateTo with pushToStack:false

BROWSER_CAPSULE: Patch `apps/shell/src/components/windowing/WindowedBrowserView.tsx`
- Ensure no new tab is created when focusing the same capsule (should be resolved by stable view key)
- Add proper cleanup policy:
  - detachStage always
  - closeTab + closeWindow ONLY on explicit capsule dispose (tie to unregister or close action), not on simple view switches

LEAD_ORCH + NAV_SUBSTRATE: Patch `apps/shell/src/services/capsule-factory/spawnIntegration.ts`
- For focus paths, navigate with pushToStack:false
- Ensure navigateTo includes viewInstanceId=capsuleId where appropriate

LEAD_ORCH + NAV_SUBSTRATE: Patch `apps/shell/src/components/LeftRail.tsx`
- await spawnBrowserIntegrated()
- lock clicks until the promise resolves (not a 300ms timeout)

QA_VALIDATOR:
- Create a deterministic smoke test:
  - click Browser 20x and assert Electron host has 1 tab
  - switch between 5 rail items and assert only 1 primary view mounted
  - verify back/forward changes active view
- Report results + logs.

## Phase 2 (Doors)
- Use DOOR_MAP.md as the checklist.
- Remove/disable obsolete rail items that point to broken/empty views.
- Add missing “Home” view if needed as the default.

## Phase 3 (Visual)
UI_POLISH:
- Apply `apps/shell/src/design/*` tokens/components to:
  - LeftRail container
  - header/top bar
  - ConsoleDrawer + InspectorDrawer wrappers
  - rebuild right-corner 3-mode widget as a Dock (Chat/Tasks/Logs) using GlassSurface

## Completion criteria
Stop only when QA_VALIDATOR signs off:
- Browser is singleton (no duplicate tabs on repeat focus)
- No view overlays / stuck drawers
- Navigation back/forward works
- Glass styling applied to choke points
