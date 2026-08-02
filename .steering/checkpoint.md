# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made, before
     a risky change. Remove questions once they are answered. -->

## Goal

M5 (spec: .steering/spec.md R1–R4, task: docs/METRICS_TASK.md): learning
metrics harness — `.pipeline/bin/metrics.sh` computes the learning system's
quality signals from existing logs (read-only), `metrics-test.sh` proves them
against hand-computed fixtures, then NOTES + sentinel +
`git add .pipeline .steering docs && git commit -m "feat(pipeline): learning
metrics harness (M5)"`.

## Just did

- Read the actual writers for exact formats (no behavior changes anywhere):
  consults.log gate/stop line shapes (steer_log), events.jsonl {ts,kind,
  refs,summary} (M1 kinds: gate, steering, outcome, dismissal, check-spec —
  NO nudge kind yet), outcomes.jsonl incl. outcome="adopted" linkage rows
  from audit-proposal.sh (M2-R4).
- Wrote .pipeline/bin/metrics.sh (bash + python3, read-only): R1 metrics
  per ISO week — first-pass rate, gate block rate, verdict distribution,
  stall signals (STEER→same-cmd APPROVE gap > 10 min + nudge events),
  outcome linkage coverage. R2 outputs latest.json + latest.md (trend
  arrows) + advisory memory ingest; R3 insufficient_data under < 3 events;
  R4 history.jsonl append-on-change only.
- Wrote .pipeline/bin/metrics-test.sh — 24 checks (rich hand-computed
  fixture, thin-data honesty, missing logs, idempotency, memory-down
  advisory). ALL PASS. Real run on this repo: exit 0, all metrics honestly
  insufficient_data (no runtime logs exist yet), history stable at 1 line.
- .pipeline/.gitignore: metrics/latest.json, latest.md, history.jsonl.
  README: "Learning metrics (M5)" section + testing/layout entries.
- docs/METRICS_NOTES.md (YAML frontmatter, deviations documented) +
  docs/METRICS_NOTES.sentinel written.

## Next

The prescribed commit:
`git add .pipeline .steering docs && git commit -m "feat(pipeline): learning
metrics harness (M5)"`. Fix and retry if the gate blocks.

## Open questions

- (none)
