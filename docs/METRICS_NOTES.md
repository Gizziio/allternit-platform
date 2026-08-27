---
status: done
files_changed:
  - docs/pipeline/bin/metrics.sh
  - docs/pipeline/bin/metrics-test.sh
  - docs/pipeline/.gitignore
  - docs/pipeline/README.md
  - .steering/checkpoint.md
  - docs/METRICS_NOTES.md
tests_green: true
deviations:
  - "No `nudge` event kind exists anywhere in M1 (actual kinds: gate, steering, outcome, dismissal, check-spec). Stall detection is therefore gap-based per the build map — gate STEER -> same-cmd APPROVE gap strictly > 10 min — with nudge counting wired in for when such events start appearing (kind match is case-insensitive substring on events.jsonl)."
  - "R1(c) lists REJECT in the verdict distribution, but the steering/gate scripts never emit REJECT (only APPROVE/STEER/CONSULT_FAILED). The distribution counts all four tokens; REJECT is reported as 0 on real data rather than the metric being dropped."
  - "Outcome linkage coverage (R1e) is measured as: adopted proposals = outcomes.jsonl entries with outcome=\"adopted\" (written by audit-proposal.sh record_linkage, M2-R4); linked = the same slug later has a real outcome (merged|reverted|rejected|failed from record-outcome.sh). verdicts.json could not be used — it is gitignored runtime state, not a durable log."
  - "First-pass rate attributes a gated commit to the ISO week of its FIRST gate attempt; a gated commit counts as resolved only when some attempt got APPROVE (a CONSULT_FAILED-only cmd fails open and is excluded from the denominator). Locked in by hand-computed fixture assertions."
  - "The repo currently has no runtime logs at all (.steering/state/consults.log, learn/events.jsonl, outcomes.jsonl are gitignored and absent), so the real run reports insufficient_data for every metric — the honest R3 result, not a bug. Fixture tests prove the math on data."
  - "Memory ingest reuses the record-outcome.sh pattern (POST :3201/api/ingest, trust_tier=trusted, source=pipeline-metrics, provenance_ref=docs/pipeline/metrics/latest.md); memory-down is logged to docs/pipeline/errors.log and never fails the run (tested via the discard port)."
remaining:
  - "If a nudge mechanism is ever added to the executor/hooks, it should emit kind=\"nudge\" via learn-event.sh — metrics.sh already counts those."
  - "outcome_linkage trend is always n/a (no meaningful per-week split for a cumulative coverage ratio); could become cumulative-per-week if wanted."
---
# M5 NOTES — learning metrics harness

## What was built

- `docs/pipeline/bin/metrics.sh` — read-only metrics harness. Parses
  `.steering/state/consults.log` (gate `cmd="..." verdict=V` lines + stop
  `hash=... verdict=V` lines), `docs/pipeline/learn/events.jsonl`,
  `docs/pipeline/outcomes.jsonl`, and git history; computes per ISO week:
  (a) first-pass rate, (b) gate block rate, (c) reviewer verdict
  distribution, (d) stall signals, (e) outcome linkage coverage. Writes
  `docs/pipeline/metrics/latest.json` + `latest.md` (one paragraph per metric
  with ↑/↓/→/· trend arrow), appends `docs/pipeline/metrics/history.jsonl`
  only on value change, and ingests the summary to memory as an insight
  (advisory). Test overrides: `METRICS_PIPELINE_DIR`,
  `METRICS_STEERING_DIR`, `METRICS_MEMORY_URL`, `METRICS_GIT_LOG_FILE`.
- `docs/pipeline/bin/metrics-test.sh` — 24 checks over three fixtures: rich
  (hand-computed rates per the acceptance scenario), thin (< 3 events →
  every metric insufficient_data, values null), and missing-logs; plus
  idempotency (history line count 1 → 2 on change → stays 2) and the
  memory-down advisory path. PASS/FAIL lines, non-zero on FAIL. All green.
- `docs/pipeline/.gitignore` — `metrics/latest.json`, `metrics/latest.md`,
  `metrics/history.jsonl`.
- `docs/pipeline/README.md` — "Learning metrics (M5)" section, testing entry,
  layout entries.

## Verification

- `bash docs/pipeline/bin/metrics-test.sh` → 24/24 PASS.
- `bash docs/pipeline/bin/metrics.sh` on the real repo → exit 0, all five
  metrics insufficient_data (no logs exist yet), latest.* written, history
  has exactly 1 line across repeated runs, memory-down logged to
  errors.log.
- `git status` confirms `metrics/` outputs are ignored; only the two bins,
  .gitignore, README, checkpoint, and this NOTES file are committed.
