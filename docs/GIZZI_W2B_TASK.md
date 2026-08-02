# W2B TASK — wire worktree.autoCreate into the live session path

You are the executor. `.steering/spec.md` (R1–R4) is the source of truth.
W2 (already in main, 890b06185) shipped the resolution module
`cmd/gizzi-code/src/shared/utils/worktreeModeEnabled.ts`, the settings
schema field, the --no-worktree commander flag, and tests — but on a path
the live binary doesn't reach (see docs/GIZZI_W2_NOTES.md "Findings").
Your job is narrow: wire the SAME resolution into the live path.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] is authoritative.
2. Done → `docs/GIZZI_W2B_NOTES.md` with YAML frontmatter, then
   `touch docs/GIZZI_W2B_NOTES.sentinel`.
3. Then commit: `git add cmd/gizzi-code .steering docs && git commit -m "feat(gizzi-code): wire worktree.autoCreate into live session path (W2b)"`.
   A gate reviews; fix and retry if blocked.

## Build guidance

1. Read docs/GIZZI_W2_NOTES.md (the Findings section names the live path:
   yargs $0 TuiThreadCommand in src/cli/ui/ink-app/thread.ts) and
   src/shared/utils/worktreeModeEnabled.ts + its test.
2. Trace how thread.ts starts a session and where a worktreeEnabled value
   would flow into the native worktree path (setup.ts). Add --worktree and
   --no-worktree options to the yargs command, call the W2 resolution with
   the parsed value + settings, and pass the result down the SAME way the
   commander path does.
3. If the live path's session startup differs structurally from the commander
   path (different setup call), document the mapping in NOTES — do not
   restructure the startup flow to force a match.
4. Tests per R3/R4 — match the existing test conventions near thread.ts /
   cli args handling; run the narrowest test command and record output.

## Constraints

- No changes to worktree creation internals or the W2 resolution module
  unless a genuine bug (fix + NOTES note).
- Surgical: thread.ts (+ its immediate arg/session wiring) and tests only.
