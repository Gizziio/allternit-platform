# Steering checkpoint — session/trace-policy

**Goal:** Live trace accumulation — the policy + recorder so real/replay runs
with `shadow_head_enabled=true` persist labeled `shadow.decision` traces
(state text, head decisions, executed-LLM reference decision + effect) for
calibration thresholds. Instrumentation only: no cloud eval, no local training.

**Just did:** Full lane landed on `session/trace-policy`:
`core/trace_recorder.py` (JSONL recorder, write-time value redaction, Tier A
schema superset, held-out split labeling), wiring in
`core/planning_loop.py` (`shadow_trace_path` config flag, record at the
`shadow.decision` emission point with graft-B prior_step as reference label,
close at run end, warn-and-disable on failure), `--trace-out` plumbing in
`core/shadow_eval.py` + `scripts/shadow_head_eval.py`, policy doc
`docs/JEV_TRACE_POLICY.md`, tests `tests/test_trace_recorder.py` (19 tests).
Verified: required test list 115 passed + 1 skipped; mock-head eval with
`--trace-out` produced 66 redacted records, gold labels verified against the
transcript, `operator@eval.local`/`hunter2` absent from the file.

**Next:** commit + push `session/trace-policy` (no merge, no PR per owner
directive). Owner reviews.

**Open questions:** none — scope frozen.
