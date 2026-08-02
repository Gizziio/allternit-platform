# W2 TASK — gizzi-code native worktree-default setting

You are the executor. `.steering/spec.md` (R1–R4) is the source of truth.
This is a surgical settings/flag-resolution feature in cmd/gizzi-code — the
native worktree machinery already exists (`src/shared/utils/worktree.ts`,
`src/runtime/gizzi-core/setup.ts` worktreeEnabled path); you are adding a
settings-driven default, not touching creation logic.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] is authoritative.
2. Done → `docs/GIZZI_W2_NOTES.md` with YAML frontmatter, then
   `touch docs/GIZZI_W2_NOTES.sentinel`.
3. Then commit: `git add cmd/gizzi-code .steering docs && git commit -m "feat(gizzi-code): worktree.autoCreate setting + --no-worktree override (W2)"`.
   A gate reviews; fix and retry if blocked.

## Build guidance

1. Find where `--worktree` is parsed (CLI entrypoint) and where
   `worktreeEnabled` is resolved before setup.ts (`src/runtime/context/flag/flag.ts:86`
   area). Read `src/shared/utils/settings/types.ts` worktree config block.
2. Add `autoCreate: z.boolean().optional()` to the worktree settings object,
   documented like its neighbors (default false = current behavior).
3. Resolution: `worktreeEnabled = cliWorktree ? true : cliNoWorktree ? false : settings.worktree?.autoCreate ?? false`.
   Add `--no-worktree` to the CLI flags parser (find where --worktree is
   declared).
4. Unit tests per R4 (find the existing test convention for flag/settings
   resolution in cmd/gizzi-code — match it; check for *.test.ts near flag.ts
   or settings).
5. Run the gizzi-code test path that covers your files (check package.json /
   Makefile for the narrowest correct test command — record it and its output
   in NOTES; do NOT run repo-wide builds).

## Constraints

- No changes to worktree.ts creation logic, setup.ts beyond consuming the
  resolved flag, or any other CLI's hook files.
- Match the codebase's zod/settings/flag conventions exactly.
