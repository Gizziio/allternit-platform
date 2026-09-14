---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/views/chat/ChatComposer.tsx
  - surfaces/ai.allternit.com/src/lib/agents/agent-mode-executor.ts
  - surfaces/ai.allternit.com/src/lib/agents/agent-mode-executor.test.ts
  - surfaces/ai.allternit.com/src/lib/agents/modes/image-generation.ts
  - surfaces/ai.allternit.com/src/lib/agents/modes/video-generation.ts
  - surfaces/ai.allternit.com/src/plugins/built-in/image/plugin.ts
  - surfaces/ai.allternit.com/src/plugins/built-in/video/plugin.ts
  - docs/IOS_LOCAL_MODELS_MARKETPLACE_PHASE_2_PLAN.md
  - docs/IOS_LOCAL_MODELS_MARKETPLACE_PHASE_2_NOTES.md
  - .steering/checkpoint.md
deviations:
  - "Restored only the creation-specific provider registry and plugin implementations from the original WIP commit because Phase 1 retained their settings consumers but discarded the matching producers during merge cleanup."
  - "Focused Vitest execution was attempted but could not start because the worktree's existing Vitest package link points to a missing vitest.mjs; no dependency installation, build, or typecheck was run."
  - "Deno formatter checks parsed all changed TS/TSX files and reported repository-style formatting differences; git diff --check passed."
remaining:
  - "Re-run the focused creation tests once the existing Vitest installation/link is repaired."
  - "Do not begin Phase 3 until separately authorized."
---

# Phase 2 integration notes

Phase 2 fixes the broken creation-surface handoff left by the Phase 1 merge.
`ChatComposer` no longer reads `selectedModeId` before initialization. Format
markers emitted from `ModeDock` are parsed by `agent-mode-executor`, converted
into concrete website, slides, image, and video options, and passed to the
selected plugin. Docs and Sheets now use the new deterministic DOCX/XLSX
creation engines.

The image and video settings panels were already registered in
`settings.config.ts` and rendered by `SettingsView.tsx`. Their auth hooks now
have matching provider registries and runtime consumers again. The plugins
read the stored provider preference and credentials, honor composer-selected
providers and dimensions/duration, preserve Bonsai local and WebGPU paths,
and report unavailable credentials by opening the correct settings section.

Focused executor coverage now exercises DOCX, XLSX, slides options, image and
video artifacts, website artifacts, provider selection, and missing-key
navigation. The requested focused Vitest command was attempted, but Node could
not load the existing workspace Vitest entry because its linked `vitest.mjs`
is missing. As permitted by the task, no install, build, typecheck, or dev
server was run. `deno fmt --check` parsed all seven changed TS/TSX files and
reported formatting-policy differences only; `git diff --check` is clean.
