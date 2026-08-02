# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made, before
     a risky change. Remove questions once they are answered. -->

## Goal

M1 (spec: .steering/spec.md R1–R4, task: docs/META_M1_TASK.md): event-driven
learning capture + reflection playbook, then META_M1_NOTES + sentinel +
prescribed commit. Capture additive; no verdict/gate semantics change.

## Just did

All R1–R4 implemented, all tests green:
- New: .pipeline/bin/learn-event.sh (sanitized JSONL append,
  LEARN_PIPELINE_DIR override), learn-playbook.sh (4KB cap, [stale] at 90+
  days unconfirmed, non-mutating), learn-reflect.sh (watermark = line count,
  advances only on non-empty consult answer, LEARN_CONSULT_CMD override,
  advisory on failure), .pipeline/learn/reflect-prompt.md (RULE | text |
  confidence | provenance contract), learn-test.sh (42 checks).
- Hook points (one additive `|| true` call each): steer-common.sh gained
  steer_learn + playbook inclusion in steer_build_context; steer-stop.sh and
  steer-pre-commit-gate.sh capture verdicts; check-spec.sh captures
  READY/NEEDS-WORK/STALLED/REJECT, includes the playbook in the request,
  reflects at end of run; record-outcome.sh and dismiss.sh capture;
  build-queue.sh reflects at end of run.
- .pipeline/.gitignore: learn/events.jsonl + learn/watermark (playbook.md and
  reflect-prompt.md committed). README gained the M1 section + testing note.
- Notable fix during testing: reflect answer must reach the parser via argv —
  `printf | python3 - <<PY` is silently overridden by the heredoc.
- Tests: learn-test 42/42 PASS (R1–R4 + all three Gherkin scenarios:
  capture-on-gate-verdict with exit-2 semantics intact, reflect distillation
  + watermark idempotency + advisory failure, playbook inclusion + [stale]
  in both consult assemblies). Full existing suite green: check-spec,
  build-queue (66), contract, wiki, taste, generate-spec, scout,
  worktree-guard.
- Live confirmation: the real gate captured its first event into
  .pipeline/learn/events.jsonl during this session (gitignored).
- docs/META_M1_NOTES.md (YAML frontmatter, B3 style) + .sentinel written.

## Next

The prescribed commit:
`git add .pipeline .steering docs && git commit -m "feat(pipeline):
event-driven learning capture + reflection playbook (M1)"`.
Fix and retry if the gate blocks.

## Open questions

- (none)
