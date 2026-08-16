# Computer Use Harness Integration — Phase 1 Task

**Agent:** kimi  
**Worktree:** /Users/joe/Desktop/allternit-workspace/allternit  
**Goal:** Research the listed computer-use / browser-use / mobile harness projects and produce a concrete integration plan plus the highest-priority implementation: promote the existing Page Agent into a shared service and wire HAR-derived API capture into ACI.

## Projects to research

1. **lahfir/agent-desktop** — native desktop automation CLI using OS accessibility trees. Determine if it can become the macOS backend for Allternit computer-use. Do not fork; identify API surface and adapter shape.
2. **minghinmatthewlam/computer-use-mcp** — gap analysis against Allternit computer use. List features to adopt or fork.
3. **alibaba/page-agent** — already integrated in the Allternit browser extension. Research how to promote it into a shared service used by all surfaces (desktop, browser/ACI, mobile). Identify the extension code paths.
4. **droidrun/mobile-harness** — deep research and framework plan for native mobile OS integration into Allternit Compute OS.
5. **ShawnPana/phone-harness** — deep research and framework plan; determine if it should complement or replace mobile-harness.
6. **apitap.io** — research the HAR-derived static API product and plan integration into Allternit computer use / ACI. The user specifically wants the Hermes skill `official/web-development/har-derived-api-client` capability: capture API calls from a website and create a static API for agents/scripts.
7. **browse.sh** — research the CLI and how it implements browser automation; plan fork/integration.

## Deliverables

1. Write `docs/agent-tasks/COMPUTER_USE_HARNESS_MAP.md` with:
   - One-paragraph summary of each project
   - License and reuse risk
   - Adopt / extract / fork / reference / reject decision
   - Capability gap against current Allternit computer use
   - Concrete adapter/interface needed

2. Implement in this phase (production quality, full implementation, no stubs):
   - Promote the existing Page Agent from the browser extension into a reusable shared service under `packages/` or `surfaces/ai.allternit.com/src/services/page-agent/` (whichever matches repo conventions). Update the browser extension to consume the shared module.
   - Wire the new HAR-derived API capture (`/api/har-derived-api/*`) into the ACI browser surface so that while ACI is active, the user can open a "Capture API" action that ingests the current page's network requests via the existing HAR route and lands the derived contract in the Site APIs view.
   - Add a "Site APIs" rail item if missing and ensure the view is reachable from ACI.

3. When finished, write `docs/agent-tasks/COMPUTER_USE_HARNESS_PHASE_1_NOTES.md` with YAML frontmatter:
   ```yaml
   status: done
   files_changed: []
   deviations: []
   remaining: []
   ```
   Then prose notes summarizing what was done and what remains for phase 2.

## Constraints

- Do NOT run git commits, pushes, or upstream code imports.
- Match repo idiom: React + TypeScript, Tailwind CSS, Phosphor or Lucide icons, Zustand stores, axum Rust backend when touching API.
- Do NOT start phase 2.
- Append milestones to `.allternit/shared-context.md` if it exists.
