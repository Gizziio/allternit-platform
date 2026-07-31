# Steering spec — steer-status.sh

<!-- The SOURCE OF TRUTH for what "done" means. Write this BEFORE or AT THE START
     of the work (whoever scopes the feature — you or the working agent), and keep
     it current as scope decisions change. The steering agent maps every
     requirement below to DONE / PARTIAL / MISSING with code evidence at each
     checkpoint. Vague requirements get vague verdicts: make each one checkable. -->

## Requirements

- [ ] R1: `.steering/bin/steer-status.sh` prints `steering: ENABLED` or
  `steering: DISABLED` based on the presence of `.steering/off`.
- [ ] R2: It prints the last 5 lines of `.steering/state/consults.log`, or the
  message `no consults recorded yet` when the log is missing or empty.
- [ ] R3: Exit code is 0 when steering is enabled, 1 when disabled.
- [ ] R4: It works when invoked from any subdirectory of the repo (resolve the repo
  root with `git rev-parse --show-toplevel`).
- [ ] R5: `.steering/README.md` documents the tool under "Controls" (one or two lines).

## Out of scope

- colors, log rotation, changes to any other steering script.

## Acceptance

- `bash .steering/bin/steer-status.sh` from the repo root prints ENABLED + verdict lines, exit 0.
- `cd .steering/bin && bash ./steer-status.sh` also works (R4).
- With `.steering/off` touched: prints DISABLED, exit 1 (remove the file afterwards).
- Record the exact commands and outputs in the NOTES file.
