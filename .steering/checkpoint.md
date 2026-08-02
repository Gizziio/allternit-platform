# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made, before
     a risky change. Remove questions once they are answered. -->

## Goal

M2 (spec: .steering/spec.md R1–R4, task: docs/META_M2_TASK.md): learned
artifact proposals through audit, then NOTES + sentinel + prescribed commit
`feat(pipeline): learned artifact proposals through audit (M2)`.

## Just did

All R1–R4 implemented, every test green:
- learn-reflect.sh: per-rule same-kind provenance counting (>=3 → playbook
  line gains `upgrade_candidate: true` + .pipeline/proposals/<slug>.md with
  target_artifact, COMPUTED kind (data allowlist), evidence_kind,
  evidence_event_ids + fenced Proposed change); reflect-prompt.md documents
  the optional PROPOSAL steering line.
- .pipeline/proposal-rubric.md (ADOPT/REVISE/REJECT: evidence, minimal
  scope, charter, target fit, reversibility) + audit-proposal.sh:
  PROPOSAL_AUDIT_CMD → LEARN_CONSULT_CMD → ao-consult; verdicts.json MERGE
  + content-sha (REVISE re-audits only after real revision — findings are
  appended BEFORE hashing, a bug the tests caught); ADOPT data = append
  under adoption marker + `learn: adopt proposal <slug>` commit; ADOPT code
  = proposals/tasks/<slug>-TASK.md, target untouched; commit failure =
  logged, verdict withheld; REJECT = final + taste-memory ingest; R4 slug →
  commit linkage in outcomes.jsonl (outcome `adopted`, written directly —
  record-outcome.sh's enum intentionally untouched).
- .gitignore: proposals/verdicts.json only (proposals are the committed
  audit trail). README M2 paragraph + testing/layout updates.
- Tests: learn-test.sh +13 (79 total: flag threshold, exactly-one proposal,
  fm shape, PROPOSAL steering, code kind); proposals-test.sh NEW (28:
  ADOPT/REVISE/REJECT/failure/idempotency/merge/linkage-ref-resolves).
  Full suite green: learn (79), proposals (28), check-spec, build-queue
  (66), contract, wiki, taste, generate-spec, scout, worktree-guard.
- docs/META_M2_NOTES.md (YAML frontmatter + deviations) + sentinel written.

## Next

The prescribed commit:
`git add .pipeline .steering docs && git commit -m "feat(pipeline): learned
artifact proposals through audit (M2)"`. Fix and retry if the gate blocks.

## Open questions

- (none)
