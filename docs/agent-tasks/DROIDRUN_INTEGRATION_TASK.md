# P1: DroidRun / Mobile Harness Integration (Phase 1)

## Goal
Research `droidrun/mobile-harness` and build the Allternit Android mobile-harness adapter that can control Android devices from the desktop surface.

## Reference
- Upstream: https://github.com/droidrun/mobile-harness
- Allternit surface: desktop/web computer-use surfaces under `surfaces/ai.allternit.com/src/capsules/` and `src/lib/page-agent/`.

## Tasks
1. Clone or fetch the upstream repo into a temporary directory.
2. Audit its architecture:
   - How it discovers and connects to Android devices (ADB, accessibility, screenshots).
   - Action protocol (tap, swipe, type, launch, assertions).
   - License and dependencies.
3. Gap analysis against Allternit computer use: what can be reused, what must be wrapped.
4. Scaffold a new Allternit module, e.g. `platform/mobile-harness/` or `cmd/allternit-mobile-harness/`.
5. Implement a minimal Python or Rust adapter that:
   - Detects connected Android devices via ADB.
   - Exposes `/health` and `/devices` endpoints.
   - Can execute a single action (e.g., tap by coordinates) and return a screenshot.
6. Add `README.md`, requirements, and a smoke test script.
7. Run the smoke test against an emulator if available; otherwise document prerequisites.

## Constraints
- Do not import upstream code without a recognized license.
- Keep the adapter isolated from unrelated Allternit surfaces in this phase.
- No git operations, no commits, no pushes.

## Deliverable Sentinel
Write `docs/agent-tasks/DROIDRUN_INTEGRATION_NOTES.md` with YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Include: audit summary, gap analysis, adapter design, test status, and next-phase work.
