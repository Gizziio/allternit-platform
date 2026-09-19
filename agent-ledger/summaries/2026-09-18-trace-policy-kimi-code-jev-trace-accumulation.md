# Attestation — session/trace-policy (live trace accumulation)

- **Session:** session/trace-policy (orchestrated; implementation delegated to a coder subagent, all gate claims re-run and verified by the main agent before landing)
- **Date:** 2026-09-18
- **Branch:** `session/trace-policy` → **PR #650, MERGED** (merge `a6d3ff91e`)
- **Follows:** PR #648 (System One grafts). Spec: `Allternit Brain/Research/specs/jev-policy-head.md`.

## What was done

Live trace accumulation — the mechanism that unblocks calibration work:

1. **`core/trace_recorder.py`** — `TraceRecorder(path, redact_values=True)`, JSONL append; records match the tier-a shape (`kimi_fewshot.exemplar_from_trace()` consumes them unchanged); HELD_OUT split labeling by construction (live = `train`, the 3 synthetic eval tasks = `heldout`, so the few-shot leak invariant keeps holding for live records).
2. **Write-time PII redaction (default on)** — every CHANGED-row value and executed typed-text value → `"[redacted]"` before disk; element names kept (decision vocabulary); `redacted: true` per record.
3. **Wiring** — `PlanningLoopConfig.shadow_trace_path` (None = byte-identical off); records at the `shadow.decision` emission point with the prior executed LLM step as reference label (`effect`: confirmed/suspected_noop); failures warn once and disable, never a step failure. `--trace-out PATH` on the eval CLI.
4. **Policy: `docs/JEV_TRACE_POLICY.md`** — what/where/redaction/retention/splits + the labeling caveat (executed-LLM decision = reference policy, not ground truth; v1 accepts inherited LLM mistakes — recorded).
5. 19 new tests (`tests/test_trace_recorder.py`).

## Verification (main agent re-run, not subagent claims)

- `pytest tests/{test_trace_recorder,test_shadow_hook,test_shadow_eval_smoke,test_element_table,test_decision_head,test_system_one_graft}.py -q` — **115 passed, 1 skipped**.
- Fresh independent mock eval with `--trace-out`: 66 records, all redacted, all heldout split, gold labels correct (form-fill step 3: `gold {operation: fill, fill_target: "2"}`, effect confirmed).
- Redaction proof on the reviewing agent's own run: `grep -c "operator@eval.local|hunter2"` → **0**.
- Recorder-off byte-identical (test-covered).

## Deferrals / caveats (honest)

- **Turning recording ON for live runs is owner-gated** — it persists (redacted) browser-session data; nothing records by default.
- Step-alignment caveat: live records label step S's proposal with the LLM step executed at S−1; synthetic Tier A traces label step N with turn N. Cross-file step alignment must not be assumed (documented in the policy).
- Calibration-threshold fitting still pending actual live-trace volume — this PR ships the pipe, not the water.
