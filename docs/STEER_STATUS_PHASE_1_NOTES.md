---
status: done
files_changed:
  - .steering/spec.md
  - .steering/checkpoint.md
  - .steering/bin/steer-status.sh
  - .steering/README.md
deviations: []
remaining: []
---

# PHASE 1 NOTES — steer-status.sh

Implemented `.steering/bin/steer-status.sh` exactly per R1–R5. Pure bash,
`set -u`, matching the simple style of `.steering/bin/steer-common.sh`.
Repo root is resolved with `git rev-parse --show-toplevel` (R4). Script is
`chmod +x`. README documents it under "Controls" (R5). No colors, no log
rotation, no other steering script touched.

## Verification — exact commands and outputs

### 1. Repo root, steering enabled (acceptance case 1)

```
$ bash .steering/bin/steer-status.sh; echo "exit: $?"
steering: ENABLED
no consults recorded yet
exit: 0
```

(`.steering/state/consults.log` did not exist, so the fallback message
printed — R2 missing-log path.)

### 2. From a subdirectory (R4)

```
$ cd .steering/bin && bash ./steer-status.sh; echo "exit: $?"
steering: ENABLED
no consults recorded yet
exit: 0
```

### 3. With `.steering/off` present (R1/R3)

```
$ touch .steering/off
$ bash .steering/bin/steer-status.sh; echo "exit: $?"
steering: DISABLED
no consults recorded yet
exit: 1
$ rm .steering/off
```

The `off` file was removed afterwards, as required.

### 4. With a populated consults.log (R2 tail path)

Created `.steering/state/` and a 7-line `consults.log` temporarily:

```
$ for i in 1 2 3 4 5 6 7; do echo "2026-07-31T00:00:0${i}Z session=test entry${i}" >> .steering/state/consults.log; done
$ bash .steering/bin/steer-status.sh; echo "exit: $?"
steering: ENABLED
2026-07-31T00:00:03Z session=test entry3
2026-07-31T00:00:04Z session=test entry4
2026-07-31T00:00:05Z session=test entry5
2026-07-31T00:00:06Z session=test entry6
2026-07-31T00:00:07Z session=test entry7
exit: 0
```

Exactly the last 5 lines printed. The temporary state dir was removed
afterwards (`rm -rf .steering/state`), restoring the original state.

## Ambiguities noted

- "verdict lines" in the acceptance text is taken to mean the consult-log
  lines (R2) — no other verdict source exists.
- When not inside a git repository, the script prints an error to stderr and
  exits 1; not specified by the requirements, chosen as the simplest behavior.
