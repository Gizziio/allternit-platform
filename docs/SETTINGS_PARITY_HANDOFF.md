# Settings Parity Workstream — Session Handoff

Read this first if you have no context. Last updated: 2026-07-11 ~13:00 by the orchestrating Claude session.

## The goal
Bring the allternit platform's settings UI (`surfaces/ai.allternit.com/src/views/settings/`) on par with Claude Desktop's settings modal, using a screen recording of Claude Desktop as reference. Eoj's standing prefs: action over discussion, thorough cleanup not shortcuts, NEVER run builds/typechecks (they hog CPU), a2r- prefix is legacy (use allternit-).

## Key docs (all in this repo's docs/)
- `CLAUDE_DESKTOP_SETTINGS_PARITY_MAP.md` — the full spec: element-by-element mapping, section mapping, phases A–D.
- `SETTINGS_PARITY_PHASE_AB_TASK.md` / `_NOTES.md` — Phase A (modal shell, sidebar+search) + B (9 primitives in `src/components/settings/`). DONE, reviewed.
- `SETTINGS_PARITY_PHASE_C_TASK.md` / `_NOTES.md` — Phase C (all sections migrated to primitives, new Privacy/Skills/Connectors/Plugins sections, Account sessions table, usage bars). DONE, reviewed, no fixes needed.
- `SETTINGS_PARITY_PHASE_D_TASK.md` — Phase D (extract agent-ops/security dashboards from the SettingsView monolith, persist migrated state, idiom sweep on 4 external panels). RUNNING as of last update.

## Execution model
A Kimi CLI agent (window titled `KIMI-SETTINGS-PARITY d8bcad7a-189c` in Terminal.app, window id 5484, `kimi --yolo` TUI in this repo) executes each phase; the orchestrating Claude session writes the task specs, reviews every phase (verify footprint via `find src -newer docs/<TASK_FILE>`, verify claims in code, esbuild single-file parse check), fixes small bugs directly, and dispatches the next phase.

The reusable workflow is codified as a user-level skill: `~/.claude/skills/agent-orchestrator/SKILL.md`.
**Send prompts to the kimi tab focus-independently** (System Events keystrokes misfire): 
`osascript -e 'tell application "Terminal" to do script "<one-line prompt>" in tab 1 of window id 5484'` (text lands in input box), then `do script "" in tab 1 of window id 5484` to submit. Never send Ctrl-C to a kimi TUI.
Completion signal: each task spec requires kimi to write the phase `_NOTES.md`; poll for the file.

## Review state / known fixes
- Reviewer fix in Phase A (preserve): SettingsView content pane = non-scrolling `relative` wrapper holding the pinned `×` button + inner `h-full overflow-y-auto` scroller.
- Kimi fixed a real pre-existing crash: `import { useIsClient } from 'react'` → restored `useState/useEffect/useCallback`.
- Phase C verified clean: ToggleItem/DiagnosticRow deleted, 23 nav ids covered, sessions destructure correct (`usePlatformSessions()` returns `{ sessions }` object), connectors fetch guarded.
- Out of scope / do not touch: `ModelManagementView.tsx` (unrelated uncommitted changes), `views/code/*` (a second kimi session, Terminal window id 108, works there), `wizard-check.ts` (modified by another agent, flagged, left alone).
- After Phase D lands: review per the checklist in the agent-orchestrator skill (footprint → scope → claims → esbuild parse), fix small bugs inline, then report.

## Concurrent agents in this repo (be careful attributing changes)
Terminal windows as of last update: id 5484 kimi (settings parity), id 108 kimi (code views work), id 3540 codex, id 4165 agy, id 5414 claude (vendor-open-connector sidecar). Attribute working-tree changes by mtime vs task-file timestamps, not by assumption.
