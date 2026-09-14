# P1: agent-desktop Provider Integration (Phase 1)

## Goal
Research `lahfir/agent-desktop` and produce a production-ready integration plan + scaffold for folding its native desktop automation capabilities into Allternit's computer-use tool.

## Reference
- Upstream: https://github.com/lahfir/agent-desktop
- Allternit computer use surface: `surfaces/ai.allternit.com/src/capsules/browser/` and related desktop-use routes.

## Tasks
1. Clone or fetch the upstream repo into a temporary directory (do not commit upstream code).
2. Audit its architecture:
   - OS accessibility-tree access (macOS AX / Windows UI Automation / Linux AT-SPI).
   - JSON protocol / structured element refs.
   - Deterministic element references.
   - License and provenance.
3. Map upstream capabilities against Allternit computer use gaps.
4. Create a new Allternit crate/module for the desktop provider, e.g. `cmd/allternit-desktop-provider/` or `platform/desktop-accessibility/`.
5. Implement the minimal adapter:
   - A Rust binary or library that exposes a small JSON-RPC/HTTP surface.
   - macOS-first implementation using `accessibility` crate or `objc`/`core-foundation`.
   - Health/check endpoint.
6. Add `Cargo.toml`, a `README.md` with build/run instructions, and unit tests where possible.
7. Run `cargo check` for the new crate and fix errors.

## Constraints
- Do not import upstream code with an unrecognized license.
- Keep the adapter isolated; do not modify unrelated Allternit surfaces in this phase.
- No git operations, no commits, no pushes.

## Deliverable Sentinel
Write `docs/agent-tasks/AGENT_DESKTOP_INTEGRATION_NOTES.md` with YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Include: audit summary, gap analysis, adapter design, build/test status, and next-phase work.
