# P1: Phone Harness / iOS Integration (Phase 1)

## Goal
Research `ShawnPana/phone-harness` and design the Allternit iOS device-control adapter that integrates mobile OS control into the desktop compute framework.

## Reference
- Upstream: https://github.com/ShawnPana/phone-harness
- Allternit surface: desktop computer-use surfaces and any iOS-related code under `surfaces/` or `platform/`.

## Tasks
1. Clone or fetch the upstream repo into a temporary directory.
2. Audit its architecture:
   - How it talks to iOS devices (WebDriverAgent, XCTest, usbmuxd, etc.).
   - Action protocol (tap, swipe, type, launch, screenshot).
   - License and dependencies.
3. Gap analysis against Allternit computer use and the Allternit iOS app surface.
4. Scaffold a new Allternit module, e.g. `platform/phone-harness/` or `cmd/allternit-phone-harness/`.
5. Implement a minimal adapter (Python or Swift/Rust) that:
   - Detects connected iOS devices.
   - Exposes `/health` and `/devices` endpoints.
   - Can execute a single action and return a screenshot or status.
6. Add `README.md`, requirements, and a smoke test script.
7. Document prerequisites (e.g., Xcode, WebDriverAgent, usbmuxd).

## Constraints
- Do not import upstream code without a recognized license.
- Keep the adapter isolated from unrelated Allternit surfaces in this phase.
- No git operations, no commits, no pushes.

## Deliverable Sentinel
Write `docs/agent-tasks/PHONE_HARNESS_INTEGRATION_NOTES.md` with YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Include: audit summary, gap analysis, adapter design, test status, and next-phase work.
