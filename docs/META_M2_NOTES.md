---
status: done
files_changed:
  - docs/pipeline/bin/learn-reflect.sh
  - docs/pipeline/bin/audit-proposal.sh
  - docs/pipeline/bin/proposals-test.sh
  - docs/pipeline/bin/learn-test.sh
  - docs/pipeline/learn/reflect-prompt.md
  - docs/pipeline/proposal-rubric.md
  - docs/pipeline/.gitignore
  - docs/pipeline/README.md
  - .steering/checkpoint.md
  - docs/META_M2_NOTES.md
tests_green: true
deviations:
  - "R1 same-kind counting is done on the rule's provenance refs (the `kind:` prefixes of `kind:refs@ts`), not by re-scanning events.jsonl — the provenance IS the distilled evidence, so counting it is deterministic and test-shimmable. Threshold: max same-kind count >= 3."
  - "Proposal fm `kind` (data|code) is COMPUTED from target_artifact (allowlist: .steering/prompt.md, docs/pipeline/playbook.md, docs/pipeline/*-rubric.md = data; everything else = code), never taken from the consult — a consult can steer the target via an optional `PROPOSAL | <target> | <summary>` line (+ fenced block) in the reflection answer, but it cannot reclassify it."
  - "Data-target application is APPEND-ONLY: the proposal's fenced Proposed-change block lands under an `<!-- adopted from proposal <slug> (<date>) -->` marker. Full-file rewrites and diff application are deliberately unsupported (reversibility + minimal blast radius; the marker doubles as the idempotency key)."
  - "REVISE re-audit is hash-gated: the verdict records the reviewed content's sha256 (findings appended BEFORE hashing, or the append itself would loop the re-audit), and a REVISE proposal is only re-audited after its content actually changes — the same pattern as the steering checkpoint hash."
  - "R4 outcome linkage is written directly to outcomes.jsonl as outcome `adopted` (not via record-outcome.sh, which validates merged|reverted|rejected|failed and would need a new outcome class + a memory-ingest decision for proposals)."
  - "proposals/*.md are committed (the audit trail; the adopt commit includes the proposal file); only proposals/verdicts.json is gitignored."
remaining:
  - "Nothing runs audit-proposal.sh automatically — like check-spec.sh it is invoked on demand; wiring it as a post-reflection offer is a candidate for a later phase."
  - "REVISE has no round cap (check-spec's MAX_ROUNDS=3 has no counterpart); a proposal oscillating ADOPT/REVISE across edits could accumulate findings indefinitely."
  - "Adopted data changes are never reverted by the system; rollback is a human git revert (the outcome linkage gives the commit to revert)."
---
# M2 — learned artifact proposals through audit: completion notes

## What was built (spec .steering/spec.md R1–R4, task docs/META_M2_TASK.md)

### R1 — repeated failures become a proposal (learn-reflect.sh)

- The reflection parser now counts each rule's provenance refs by kind
  (`kind:refs@ts` prefix); max same-kind count >= 3 marks the playbook line
  with `upgrade_candidate: true` and writes `docs/pipeline/proposals/<slug>.md`:
  frontmatter `schema_version`, `produced_by/at`, `status: pending`,
  `target_artifact`, `kind` (computed data|code), `evidence_kind`,
  `evidence_event_ids` (dashed list); body with an Evidence section and the
  proposed change as a fenced block.
- The reflect prompt (`docs/pipeline/learn/reflect-prompt.md`) documents an
  optional `PROPOSAL | <target> | <summary>` line (+ fenced block) paired
  with the preceding RULE so the consult can steer the target/content;
  default is target `docs/pipeline/playbook.md` with the rule text as the
  change.

### R2 — the audit (audit-proposal.sh + proposal-rubric.md)

- `docs/pipeline/proposal-rubric.md`: ADOPT/REVISE/REJECT instructions — evidence
  support, minimal scope, charter conflict, target fit, reversibility.
- `docs/pipeline/bin/audit-proposal.sh`: for each proposal without a final
  verdict, assembles rubric + charter + proposal, consults
  (`PROPOSAL_AUDIT_CMD` → `LEARN_CONSULT_CMD` → ao-consult), parses the first
  line bullet-tolerant/uppercase (check-spec convention), and records into
  `proposals/verdicts.json` with MERGE semantics (B3 lesson) plus the
  reviewed content's sha256. Empty/failed consult: logged, skipped, exit 0 —
  never wedges. REJECT ingests the rejection to taste memory (:3201,
  advisory, `trust_tier: failed`).

### R3 — adoption paths

- Data targets (computed allowlist): append the fenced change under the
  adoption marker (idempotent — an existing marker skips re-application),
  `git add` target + proposal, commit `learn: adopt proposal <slug>`.
- Code targets: emit `docs/pipeline/proposals/tasks/<slug>-TASK.md` (executor
  conventions header + full proposal) and commit it as
  `learn: adopt proposal <slug> (task spec)` — code changes never happen
  here; they go through the full build pipeline.
- Commit failure: logged, verdict NOT recorded (the next run retries).

### R4 — outcome linkage

- Every adoption appends `{ts, slug, outcome: "adopted", note: "commit
  <short-ref>"}` to `docs/pipeline/outcomes.jsonl`.

## Tests (all stubbed, no live calls)

- `learn-test.sh` (+13 checks, 79 total): 3-same-kind rule flagged + exactly
  one proposal with target/kind/3 evidence ids/Proposed-change section;
  mixed-kind rule NOT flagged; PROPOSAL-line steering (prompt target = data,
  fenced block lands); script target = code kind. All M1/M3 checks green.
- `proposals-test.sh` (28 checks, temp git fixture): ADOPT applies + marker
  + slug commit + outcomes linkage with resolvable ref (data AND code
  targets, task spec emitted, target untouched); REVISE records + findings
  appended + nothing applied; REJECT records + nothing applied + memory
  ingest captured; consult failure records nothing + logged + exit 0; merge
  semantics preserve pre-seeded keys; re-run makes no commits, no duplicate
  application, audits only the unfinished proposal.

Full suite green: learn-test (79), proposals-test (28), check-spec-test,
build-queue-test (66), contract-test, wiki-test, taste-test,
generate-spec-test, scout-test, worktree-guard-test.

## Constraints honored

- The audit is the ONLY self-modification path: prompts/rubrics/playbook are
  written solely by audit-proposal.sh's ADOPT branch, with the proposal slug
  in the commit message; code targets get task specs, never direct edits.
- bash + python3 only; consult failures skip and log, never wedge.
