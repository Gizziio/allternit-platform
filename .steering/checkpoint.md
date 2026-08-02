# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase D1 (spec: .steering/spec.md D1-R1..R4, task: docs/BRAIN_D1_TASK.md):
`gizzi brain` command group in cmd/gizzi-code on the LIVE yargs path —
`init` (canonical brain layout + git init + first commit, refuse non-empty
unless --force), bare `brain`/`status` (path, remote?, uncommitted, unpushed),
`sync` (git pull --rebase + push, conflicts as plain instructions, no remote =
friendly exit 0), `remote <url>` (set origin manually), `--remote` flag calling
POST /api/v1/brains with D2-not-yet fallback message, `brain.path` settings
field, tests, NOTES + sentinel, then the prescribed commit.

## Just did

Steering gate round 1 BLOCKED on D1-R3 (brain default ~/brain vs ingest
scripts' default ~/Desktop/allternit-brain — nothing bridging, silent
non-ingestion). Fixed per the gate's recommendation:
- `.pipeline/bin/wiki-ingest.sh` + `.pipeline/bin/taste-ingest.sh`: new
  `resolve_brain()` — explicit $TASTE_BRAIN → gizzi settings `brain.path`
  (python3, already a taste-ingest dep) → existing ~/brain → legacy
  allternit-brain fallback (kept: Track D leaves allternit-brain as-is).
- Resolution verified against the extracted function for all 4 cases;
  `bash .pipeline/bin/wiki-test.sh` and `taste-test.sh` both green.
- NOTES updated (files_changed, R3 section, test evidence, gate-round
  finding, remaining list). bun suite still 11/11.

## Next

Retry the prescribed commit, now including .pipeline:
`git add cmd/gizzi-code .steering docs .pipeline && git commit -m
"feat(gizzi-code): gizzi brain init — second-brain creation (D1)"`.
Fix and retry if the gate blocks again.

## Open questions

- (none)
