# M2 TASK — learned artifacts, audited before adoption

You are the executor continuing in this session. M1 (capture/reflect) and
M3 (brain persistence) are reviewed, approved, merged — your previous work.
`.steering/spec.md` (R1–R4 + acceptance) is the source of truth. Same
workflow: checkpoints, [steering] authoritative, NOTES + sentinel, then
`git add .pipeline .steering docs && git commit -m "feat(pipeline): learned artifact proposals through audit (M2)"`.

## Build map

1. learn-reflect.sh: provenance counting per rule (events.jsonl kinds) —
   3+ same-kind events → upgrade_candidate flag + proposal file. Proposal
   format: frontmatter (target_artifact, kind, evidence_event_ids) + body
   (proposed change as a fenced diff or full replacement section).
2. `.pipeline/proposal-rubric.md` + `.pipeline/bin/audit-proposal.sh`:
   consult via LEARN_CONSULT_CMD/ao-consult; verdicts ADOPT/REVISE/REJECT
   (first line, bullet-tolerant like steer_verdict); verdicts.json with
   MERGE semantics (B3 lesson).
3. Adopt path: data-file targets (.steering/prompt.md, .pipeline/*-rubric.md,
   playbook.md) applied by the script with the proposal slug in the commit
   message; code targets emit a task spec file to .pipeline/proposals/
   tasks/ for a future executor (no auto-code-changes).
4. outcomes.jsonl linkage on adopt.
5. Tests (extend learn-test.sh or proposals-test.sh): same-kind counting
   threshold, proposal content shape, ADOPT applies + references slug,
   REJECT no-ops + precedent ingest, REVISE records without applying,
   outcome linkage. Shim the consult; no live calls.
6. Keep all M1/M3 tests green.

## Constraints

- The audit is the ONLY path for self-modification; no direct writes to
  prompts/rubrics outside adopted proposals.
- bash + python3; consult failures skip the proposal (logged), never wedge.
