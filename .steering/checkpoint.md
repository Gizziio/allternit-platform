# Steering Checkpoint — Allternit Tagging Subsystem P1

**Goal:** Scaffold and integrate a first-class tagging/annotation layer across Allternit surfaces.

**Important audit correction:** A parallel agent audit of `CopilotKit/OpenTag` confirmed that OpenTag is **not** a composer tagging UI. It is an open-source knowledge-work agent for Slack and Microsoft Teams built on CopilotKit Channels. The user's "tag agents in the composer" requirement therefore cannot be satisfied by forking OpenTag. The work below implements the tagging requirement directly in Allternit surfaces and is no longer framed as an OpenTag integration.

**Just did:**
- Wrote comprehensive research roadmap at `research/external-integration-roadmap-2026-08.md` covering all 29 requested external repos/products with priority matrix, gap analysis, and phased implementation plan. The roadmap now reflects the corrected OpenTag analysis.
- Created session worktree `allternit-session-opentag-p1-D5262E14` on branch `session/opentag-p1-D5262E14`.
- Implemented core tag subsystem:
  - `src/lib/tags/tag.types.ts` — Tag, TagScope, Tagging, color styles.
  - `src/lib/tags/tag.store.ts` — Zustand store with persist, CRUD, filtering, default seed tags.
  - `src/components/tagging/{Tag,TagCloud,TagFilter,TagPicker}.tsx` — reusable UI components.
  - `src/views/tags/TagManagerView.tsx` — full tag management page.
- Wired into platform shell:
  - Added `tag-manager` ViewType in `src/nav/nav.types.ts`.
  - Added spawn policy in `src/nav/nav.policy.ts`.
  - Registered lazy-loaded view in `src/shell/ViewRegistry.tsx`.
  - Added "Tags" tab to Agent Hub (`AgentHub.constants.ts`, `AgentHubContent.tsx`).
- Integrated tags into Agent Studio:
  - `AgentGalleryCard.tsx` displays an agent's tags.
  - `AgentGalleryGrid.tsx` supports tag-based filtering via `TagFilter`.
  - `AgentDetailView.tsx` includes a `TagPicker` to add/remove tags on an agent.
- Phase 1 surface integration completed per `docs/agent-tasks/TAGGING_TS_INTEGRATION_TASK.md`:
  - Created `src/lib/tags/useTags.ts` lifecycle hook that loads tags/taggings once on mount.
  - Wired `useTags()` into `TagPicker`, `TagManagerView`, and `AgentGalleryGrid`.
  - Made all store action callers async-aware with `await`, local `isSubmitting` flags, and disabled buttons while actions are in flight.
  - Surfaced store `error` state in `TagPicker` and `TagManagerView`.
  - Verified with `bun typecheck`: no new errors in touched files (pre-existing errors remain in unrelated modules).
  - Wrote completion sentinel at `docs/agent-tasks/TAGGING_TS_INTEGRATION_NOTES.md`.

**Next:**
1. Steering review of this scaffold and integration.
2. If approved, commit the work.
3. Extend tagging to other scopes:
   - Wire `TagPicker` into tool/skill/plugin registry views.
   - Add tag support to composer sessions and artifacts.
4. Continue with next P1: agent-desktop, droidrun/phone-harness, or Unsloth backend.

**Open questions:**
- Should tags be scoped per-tenant/team or per-user? Current implementation is local per-user.
- Do we want a dedicated rail item for Tag Manager, or keep it inside Agent Hub for now?
- Should the default seed tags (SEO, SDR, Media Buyer, etc.) be hardcoded or loaded from a persona/template registry?
- Do we want to fork OpenTag separately as a Slack/Teams agent bridge (P3), or leave it out of scope?
