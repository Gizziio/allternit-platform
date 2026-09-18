---
status: done
files_changed: []
deviations: []
remaining: []
---

# Swarm C Phase 1 Notes

## What changed

- Extended `NativeWebTools` with Tavily, Perplexity, and Bing live-search adapters. Provider selection can be explicit or inferred from `TAVILY_API_KEY`, `PERPLEXITY_API_KEY`, and `BING_SEARCH_API_KEY`; DuckDuckGo remains the no-key fallback. All adapters use the existing injected `fetch` seam for offline tests.
- Added the Anthropic-compatible `str_replace_editor` Tool Belt tool, marked as `text_editor_20250124`. It supports `view`, `str_replace`, `create`, `insert`, and `undo` (`undo_edit` is also accepted for wire compatibility), confines paths to the active workspace, blocks symlink escapes, and retains per-file in-memory undo history.
- Aligned the active computer-use capability with `computer_20250124`: added enhanced mouse, scroll, hold, and wait actions; changed coordinates to absolute `[x, y]` pixels; exposed display metadata; made fetch injectable; and returns screenshots as Anthropic base64 image content blocks.
- Added offline unit coverage for all three search providers, editor operations/path confinement, Tool Belt registration, and computer screenshot/schema behavior.
- Removed a pre-existing committed merge marker from the mapped `tools/types.ts` file because it prevented the touched runtime types from parsing.

## Verification

- `git diff --check` passes.
- The targeted Vitest command could not start because this worktree has no installed `node_modules/.bin/vitest`. Dependencies were not installed because repository instructions prohibit broad setup/build activity and the test suite must remain offline.

## Blockers

No implementation blockers remain. Two environment limitations remain:

- The linked worktree cannot write its Git index under the canonical checkout's `.git/worktrees` directory, so `git add` fails while creating `index.lock` and the requested commit could not be created in this session.
- Local test dependencies are absent, so the targeted Vitest suite could not start.

## Phase 2

Phase 2 work was intentionally not started. Follow-up can add richer provider controls/telemetry, durable editor history or directory views, and gateway-side support/validation for every enhanced computer action if those items appear in the Phase 2 map.
