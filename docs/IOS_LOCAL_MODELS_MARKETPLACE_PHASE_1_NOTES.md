---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/components/settings/ImageProvidersPanel.test.tsx
  - surfaces/ai.allternit.com/src/components/settings/ImageProvidersPanel.tsx
  - surfaces/ai.allternit.com/src/components/settings/VideoProvidersPanel.test.tsx
  - surfaces/ai.allternit.com/src/components/settings/VideoProvidersPanel.tsx
  - surfaces/ai.allternit.com/src/hooks/useImageProviderAuth.test.ts
  - surfaces/ai.allternit.com/src/hooks/useImageProviderAuth.ts
  - surfaces/ai.allternit.com/src/hooks/useVideoProviderAuth.test.ts
  - surfaces/ai.allternit.com/src/hooks/useVideoProviderAuth.ts
  - surfaces/ai.allternit.com/src/lib/agents/artifact-smoke.test.ts
  - surfaces/ai.allternit.com/src/lib/agents/creation-engines.ts
  - surfaces/ai.allternit.com/src/lib/agents/mode-session-store.ts
  - surfaces/ai.allternit.com/src/plugins/built-in/website/plugin.test.ts
  - surfaces/ai.allternit.com/src/views/chat/ChatComposer.tsx
  - surfaces/ai.allternit.com/src/views/chat/components/ModeDock.test.tsx
  - surfaces/ai.allternit.com/src/views/chat/components/ModeDock.tsx
  - surfaces/ai.allternit.com/src/views/create/FormatPicker.tsx
  - surfaces/ai.allternit.com/src/views/create/enrich-prompt.test.ts
  - surfaces/ai.allternit.com/src/views/create/enrich-prompt.ts
  - surfaces/ai.allternit.com/src/views/create/presets.ts
  - surfaces/ai.allternit.com/src/views/settings/SettingsView.tsx
  - surfaces/ai.allternit.com/src/views/settings/settings.config.ts
  - docs/IOS_LOCAL_MODELS_MARKETPLACE_PHASE_1_NOTES.md
deviations:
  - "Split the mixed WIP safety-net commit into two coherent creation-feature commits and discarded consolidation-only paths whose parent versions already matched origin/main."
  - "The syntax check used Deno's parser/formatter check; all files parsed, but Deno reported style differences, so no formatting changes were applied."
remaining:
  - "Phase 2 work remains intentionally untouched."
---

# Phase 1 notes

The mixed WIP commit `dc2c8a148` contained real feature work and consolidation
noise. I removed that commit, preserved the real work in two coherent commits,
and discarded the noise:

- `44cdf3d90` — `feat(create): add deterministic format presets`
- `8dfb37d4b` — `feat(create): add image and video provider support`

The discarded paths either made the WIP tree identical to `origin/main` or
reverted files whose pre-WIP versions already matched `origin/main`. This
included `cmd/allternit-api/src/library_routes.rs`, several agent-mode files,
and the built-in image, slides, video, and website plugin implementations.
No feature logic in the retained work was intentionally changed.

I fetched `origin/main` at `30739a95d` and merged it as `183cb0c35`. Three
files conflicted:

- `ChatComposer.tsx`: retained main's unified async message submission and
  model-picker/navigation changes, then applied creation-format enrichment in
  that shared send path.
- `ModeDock.tsx`: retained main's horizontal mode tabs and added the branch's
  creation-format picker beneath them.
- `settings.config.ts`: retained main's webhook navigation and added the
  branch's image/video provider navigation entries.

For the required cheap syntax sanity check, I ran `deno fmt --check` over all
21 TS/TSX files changed relative to the merged `origin/main`. Deno parsed every
file and reported only formatter differences. I did not reformat because this
phase is cleanup-only and the repository uses different formatting
conventions. There were no changed Rust files. No build, typecheck, test suite,
or dev server was run.

The branch is clean apart from the task/map/sentinel files that were already
untracked in the provided worktree and were deliberately left uncommitted.
Phase 2 was not started.
