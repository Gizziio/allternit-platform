# M5 TASK — learning metrics harness

You are the executor. `.steering/spec.md` (R1–R4 + acceptance) is the source
of truth. Everything reads existing logs — no behavior changes to any script.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] authoritative.
2. Done → `docs/METRICS_NOTES.md` with YAML frontmatter, then
   `touch docs/METRICS_NOTES.sentinel`.
3. Then commit: `git add .pipeline .steering docs && git commit -m "feat(pipeline): learning metrics harness (M5)"`.
   A gate reviews; fix and retry if blocked.

## Build map

1. Read the actual formats first: `.steering/state/consults.log` lines,
   `.pipeline/learn/events.jsonl`, `.pipeline/outcomes.jsonl` (they exist in
   main from M1/M2/M3 — read the scripts that write them for exact fields).
2. `.pipeline/bin/metrics.sh` (bash + python3 like the other bins): compute
   R1's metrics per ISO week from those files; stall detection = gate STEER
   verdicts with a subsequent same-cmd APPROVE gap > 10 min OR nudge events
   if present in events.jsonl (check what M1 actually emits for kinds).
3. Outputs per R2 (latest.json + latest.md + memory ingest advisory) and
   R4 (history.jsonl append-on-change only).
4. `.pipeline/bin/metrics-test.sh`: fixture logs → hand-computed assertions
   (R1 metrics + insufficient_data honesty + idempotency). PASS/FAIL lines,
   non-zero on FAIL.
5. .pipeline/.gitignore: metrics/latest.*, metrics/history.jsonl.
   README section.

## Constraints

- Read-only over all logs; advisory memory; bash+python3 only.
- Metrics are honest: no smoothing, no fake numbers on thin data (R3).
