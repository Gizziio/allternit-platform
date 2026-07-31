# PHASE 1 TASK — steer-status.sh

You are the executor. This file is your complete task spec. Do not start anything
not listed here. You do not make product decisions — if something is ambiguous,
note it in the NOTES file and choose the simplest option.

## Workflow requirements (mandatory, in this order)

1. FIRST write `.steering/spec.md` in this repo with exactly the requirements in
   "Feature requirements" below (keep the file's existing template structure).
2. Work in small steps. At each meaningful checkpoint, update
   `.steering/checkpoint.md` (Goal / Just did / Next / Open questions). This file
   drives an automated review loop — keep it truthful.
3. If a `[steering]` message appears in your context, it comes from an independent
   reviewer. Treat it as authoritative: answer its questions, fix what it flags,
   then update `.steering/checkpoint.md` before ending your turn.
4. When everything is done and verified, write `docs/STEER_STATUS_PHASE_1_NOTES.md`
   starting with YAML frontmatter — `status: done|blocked`,
   `files_changed: [...]`, `deviations: [...]`, `remaining: [...]` — then prose.
   Then run: `touch docs/STEER_STATUS_PHASE_1_NOTES.sentinel`
5. THEN commit your work: `git add .steering docs && git commit -m "feat(steering): steer-status.sh ops tool"`.
   (An automated gate reviews commits — if it blocks, fix what it says and retry.)

## Feature requirements (put these into .steering/spec.md verbatim)

- R1: `.steering/bin/steer-status.sh` prints `steering: ENABLED` or
  `steering: DISABLED` based on the presence of `.steering/off`.
- R2: It prints the last 5 lines of `.steering/state/consults.log`, or the
  message `no consults recorded yet` when the log is missing or empty.
- R3: Exit code is 0 when steering is enabled, 1 when disabled.
- R4: It works when invoked from any subdirectory of the repo (resolve the repo
  root with `git rev-parse --show-toplevel`).
- R5: `.steering/README.md` documents the tool under "Controls" (one or two lines).

Out of scope: colors, log rotation, changes to any other steering script.

## Acceptance

- `bash .steering/bin/steer-status.sh` from the repo root prints ENABLED + verdict lines, exit 0.
- `cd .steering/bin && bash ./steer-status.sh` also works (R4).
- With `.steering/off` touched: prints DISABLED, exit 1 (remove the file afterwards).
- Record the exact commands and outputs in the NOTES file.

## Constraints

- Pure bash, match the style of `.steering/bin/steer-common.sh` (set -u, simple).
- chmod +x the new script.
- No builds, no test suites, no dev servers.
- No git operations except the single commit in step 5.
