# Steering spec — M5: learning metrics harness

<!-- "Better" must be measured, not felt. Computes the learning system's
     quality signals from existing logs; ingested to memory as insights. -->

## Requirements

- [ ] R1: WHEN `.pipeline/bin/metrics.sh` runs, THE SYSTEM SHALL compute from
  `.steering/state/consults.log`, `.pipeline/learn/events.jsonl`,
  `.pipeline/outcomes.jsonl`, and git history: (a) first-pass rate — % of
  gated commits approved on first attempt per week; (b) gate block rate
  trend; (c) reviewer verdict distribution (APPROVE/STEER/REJECT/
  CONSULT_FAILED); (d) executor stall signals (nudge events in events.jsonl
  or long gaps between checkpoint and commit); (e) outcome linkage coverage
  (% of adopted proposals with recorded outcomes).
- [ ] R2: WHEN metrics are computed, THE SYSTEM SHALL write
  `.pipeline/metrics/latest.json` (machine) + `latest.md` (human summary,
  one paragraph per metric with the trend arrow), and ingest the summary to
  memory as an insight (advisory — memory down = log + continue).
- [ ] R3: WHEN data is missing or thin (< 3 events), THE SYSTEM SHALL report
  `insufficient_data` for that metric rather than a fake number — a metric
  cannot pass by doing nothing.
- [ ] R4: WHEN run repeatedly, THE SYSTEM SHALL be idempotent (latest.*
  overwritten, history appended to `.pipeline/metrics/history.jsonl` only
  when values changed).

## Acceptance (Gherkin)

- Scenario: real numbers from real logs
  Given fixture consults.log + events.jsonl with known verdicts
  When metrics.sh runs
  Then latest.json matches the hand-computed rates, and latest.md renders
  each metric with its trend.
- Scenario: thin data is honest
  Given < 3 events
  When metrics.sh runs
  Then affected metrics report insufficient_data.
