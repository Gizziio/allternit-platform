# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made, before
     a risky change. Remove questions once they are answered. -->

## Goal

M3 (spec: .steering/spec.md R1–R4, task: docs/META_M3_TASK.md): learnings
persist in the second brain, then NOTES + sentinel + prescribed commit
`feat(pipeline): learnings persist in the second brain (M3)`.

## Just did

All R1–R4 implemented, every test green:
- .pipeline/bin/brain-resolve.sh: extracted the verbatim-duplicated
  resolve_brain from taste-ingest.sh + wiki-ingest.sh (both converted,
  BRAIN_RESOLVE override, script-relative default after the
  $PIPELINE_DIR/bin default broke temp-dir tests).
- learn-reflect.sh: brain_write_rule → learnings/<slug>.md (type: lesson,
  status, domain: pipeline, confidence, provenance_refs dashed list, added,
  last_confirmed; re-distilled pages keep original dates/status);
  brain_stale_sweep flips 90+-day-unconfirmed active pages to stale on every
  run (time-based, even no-new-events runs); brain_commit makes ONE learn:
  commit per run (slug / n rules (date) / stale flips (date)), add --
  learnings only, never push; no-brain runs log one skip note and the
  playbook still updates.
- learn-test.sh +24 checks (66 total): git-fixture brain — 2 valid lesson
  pages + single learn: commit touching only learnings/; stale flip visible
  with fresh rules staying active; no-brain skip noted once with playbook
  still updating; non-git brain still gets pages. Regression guard:
  TASTE_BRAIN exported unresolvable so tests never touch the real brain.
- Full suite green: learn-test (66), check-spec, build-queue (66), contract,
  wiki, taste, generate-spec, scout, worktree-guard.
- README M3 paragraph; docs/META_M3_NOTES.md (YAML frontmatter, deviations:
  script-relative helper default, brain-page-driven stale flip, commit
  message scheme) + sentinel written.

## Next

The prescribed commit:
`git add .pipeline .steering docs && git commit -m "feat(pipeline):
learnings persist in the second brain (M3)"`.
Fix and retry if the gate blocks.

## Open questions

- (none)
