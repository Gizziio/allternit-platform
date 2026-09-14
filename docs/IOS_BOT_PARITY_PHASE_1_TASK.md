# Phase 1 Task: Clean and rebase iOS Bot Parity / CUA Driver branch

**Worktree:** `~/Desktop/allternit-workspace/allternit-session-ios-bot-parity`  
**Branch:** `session/ios-bot-parity`  
**Do NOT start Phase 2.**

## Scope

1. Inspect the current branch state and the WIP commit at HEAD.
2. Determine whether the WIP commit contains real work or only consolidation noise.
3. If it is only noise, drop it. If it contains real work, split it into one or more coherent commits with descriptive messages.
4. Fetch `origin/main` and merge it into the branch.
5. Resolve all merge conflicts, preferring the branch's feature work over unrelated main changes.
6. Run a cheap syntax sanity check on changed TS/TSX/Rust files (do not run full builds or dev servers).
7. Push the cleaned branch to `origin/session/ios-bot-parity`.

## Constraints

- Stay in the provided worktree.
- Do not run builds, typechecks, or dev servers.
- Do not modify feature logic; this phase is cleanup/rebase only.
- Preserve all real feature work from the branch.
- Match existing repo conventions (imports, naming, etc.).

## Deliverable

When finished, write `docs/IOS_BOT_PARITY_PHASE_1_NOTES.md` with this exact YAML frontmatter:

```yaml
---
status: done|blocked
files_changed:
  - path/to/file1
  - path/to/file2
deviations:
  - "what changed and why"
remaining:
  - "anything left for Phase 2"
---
```

Then add prose notes summarizing what you did, conflicts resolved, and the current branch state.
