# Tagging Subsystem — Surface Integration (Phase 1)

## Goal
Wire the Allternit Tagging Subsystem into the ai.allternit.com surface so tags and taggings are persisted via the Rust API instead of localStorage.

## Context
- Rust backend routes exist in `cmd/allternit-api/src/tag_routes.rs` and are mounted at `/api/v1/tags` and `/api/v1/taggings`.
- Migration is at `cmd/allternit-api/migrations/V83__tags.sql`.
- Typed API client: `surfaces/ai.allternit.com/src/lib/tags/tag.api.ts`.
- Zustand store: `surfaces/ai.allternit.com/src/lib/tags/tag.store.ts` (already API-backed).
- Components: `surfaces/ai.allternit.com/src/components/tagging/{Tag,TagCloud,TagFilter,TagPicker}.tsx`.
- Manager view: `surfaces/ai.allternit.com/src/views/tags/TagManagerView.tsx`.
- Consumers: `surfaces/ai.allternit.com/src/views/agent-view/main/AgentGalleryGrid.tsx` and `AgentGalleryCard.tsx`.

## Required Changes
1. Make all store action callers async-aware:
   - `TagPicker`: `handleCreate`, `onRemove`, `onClick` for adding/removing taggings must `await`.
   - `TagManagerView`: `handleSave` and `deleteTag` must `await`.
   - Disable buttons while an action is in flight and surface errors via the store's `error` state.
2. Add lifecycle loading:
   - Create `surfaces/ai.allternit.com/src/lib/tags/useTags.ts` hook that calls `useTagStore.getState().loadTags()` once on mount and returns `{ tags, taggings, isLoading, error }`.
   - Use the hook in `TagManagerView` and `TagPicker` so data is fetched when the UI opens.
3. Ensure `getTagsForTarget` consumers (`AgentGalleryGrid`, `AgentGalleryCard`) still work after data loads.
4. Typecheck the surface:
   - Run `bun typecheck` (or `tsc --noEmit`) from `surfaces/ai.allternit.com` and fix any errors.
   - If the command does not exist, run the equivalent for the surface package.

## Constraints
- Do not change the Rust backend.
- Do not introduce new dependencies without checking `package.json` first.
- Match the existing Tailwind / CSS variable styling and Phosphor icons.
- Keep changes scoped to the tagging surface and its direct callers.
- No git operations, no builds of unrelated crates, no dev servers.

## Deliverable Sentinel
When finished, write `docs/agent-tasks/TAGGING_TS_INTEGRATION_NOTES.md` starting with YAML frontmatter:

```yaml
status: done
files_changed: []
deviations: []
remaining: []
```

Then add prose notes: what changed, typecheck result, and any remaining work.
