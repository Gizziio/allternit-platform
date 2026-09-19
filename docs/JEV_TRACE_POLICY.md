# JEV Trace Policy — live shadow-head trace accumulation (2026-09-18)

Session `trace-policy`, branch `session/trace-policy` (pushed, no PR per
owner directive). Lane: the calibration substrate for the shadow decision
head. The shadow head is only as trustworthy as its calibration, and
calibration thresholds must come from OUR OWN labeled traces — never
vendor/self-reported confidence. This lane ships the policy + recorder so
real/replay runs with `shadow_head_enabled=true` start accumulating labeled
traces: each `shadow.decision` event plus the executed LLM decision as the
reference label.

## What is recorded

One JSON object per line, one line per shadow decision, written by
`core/trace_recorder.py::TraceRecorder`. The record shape is a superset of
the Tier A synthetic trace schema (`core/tier_a_traces.py`) — every live
record validates against `validate_trace()` and is readable by
`core/kimi_fewshot.exemplar_from_trace()`, so live traces can serve as
future train-split exemplars and calibration data:

- `trace_id` — `f"{task_id}:{run_id}:{step}"` (run-scoped; the synthetic
  traces' `task_id:sN` shape has no run id).
- `task_id` — the planning loop's session id, with the eval harness's
  `shadow-` prefix stripped (same convention `KimiCliHead.begin_run`
  documents).
- `split` — see split rules below.
- `template` — `"live"` (unknown by construction; synthetic traces carry
  their generator template).
- `state_text` — the exact shadow-head prompt for the step, redacted.
- `questions` — name + options as asked (operation menu + speculative
  `<operation>_target` menus + goal/stuck gates).
- `gold` — the reference label: `operation` folded through the eval's
  transcript-op mapping (`shadow_eval._LLM_OP_MAP`) so it is always one of
  the head-menu options, plus `<operation>_target` as the resolved row index
  (`ElementTable.match_target` against the decision step's table) when it
  resolves into the target menu. Questions with no resolved reference answer
  are omitted (the few-shot consumer trains them as abstain, per the
  synthetic schema).
- `llm` — `{op, target, text, success}` of the executed step. `target` is an
  element name/ref, never a typed value; `text` is the typed value when the
  action carried one (redacted).
- Extensions over the synthetic shape: `run_id`, `effect`
  (`confirmed` / `suspected_noop` — the graft-B vocabulary, from
  `action_succeeded`), `head` (model_id, latency, per-question chosen +
  confidence + probabilities), `latency_ms`, `redacted`, `ts`.

Label alignment: the label for a step's head proposal is the LLM step
executed at the PREVIOUS step — the same source as graft B's `prior_step`
(the step whose effect is visible in this state's `[SINCE LAST STEP]`
block). Step 1 of a run has no prior executed step and records an empty
`gold`/`llm`/`effect: null`. This differs from the synthetic Tier A traces,
which label step N with transcript turn N (a label available offline because
the whole transcript is recorded up front); noted so no consumer assumes the
two files align step-for-step.

## Where

Default path: `domains/computer-use/core/evaluation/tier-a/live-traces.jsonl`
— a separate file from the synthetic `traces.jsonl` (synthetic is
regenerated deterministically from a seed; live is append-only operator
data; mixing them would make regeneration destructive). Enabled per run via
`PlanningLoopConfig.shadow_trace_path` (None = recording off,
byte-identical behavior). The eval harness exposes it as
`scripts/shadow_head_eval.py --trace-out PATH` / `shadow_eval.run_eval(
trace_path=...)`. The recorder appends and flushes per record; the planning
loop constructs one recorder per run and closes it at run end.

## Redaction rules (write-time, default ON)

Element VALUES are PII-sensitive — form fields carry emails, passwords, and
typed text. Names are not redacted: element names are the decision
vocabulary (design tension #1 — names under-report; the head conditions on
them, and `match_target` resolves labels through them). Concretely:

- Every CHANGED row in the `[SINCE LAST STEP]` block has both its current
  value and its `(was ...)` value replaced with `"[redacted]"` at write
  time. This is where typed values leak into the state text (a filled
  password renders as `~ [eN] AXTextField: Password = "..."` one step
  later). Covered by tests with the nasty case: a password value must not
  appear in the written file.
- The executed step's typed text (`action_params["text"]`) is free text and
  is redacted in `llm.text`.
- The executed step's `target` is an element name/ref (resolved via
  `table.match_target`), not a value — kept.
- Every record carries a `redacted: true|false` field.
- `TraceRecorder(path, redact_values=False)` turns redaction off (debug
  lanes only — never for operator data).

## Retention

JSONL append-only; the operator rotates (archive/delete) the file. No
retention automation ships in v1 — the file is local operator data, like the
scratchpad. Deletion is safe: nothing is derived until a training/calibration
consumer is pointed at the file explicitly.

## Split rules

- Live/replay records default to `split="train"`.
- A record whose `task_id` is one of the three held-out synthetic eval tasks
  (`search-flow`, `form-fill`, `settings-toggle`, per
  `kimi_fewshot.HELD_OUT_TASK_IDS`) is labeled `split="heldout"` — so an
  eval-harness run with `--trace-out` can never contaminate the train pool.
  This is labeling only, never an assert: a misconfigured harness degrades
  to correctly-labeled data, not a crashed live run.
- The `kimi_fewshot` leak invariant therefore still holds for live records:
  `exemplar_from_trace()` returns None for any held-out record, and
  `select_few_shot_examples()` asserts after filtering.

## Labeling caveat (accepted for v1)

The reference label is the EXECUTED LLM DECISION — the reference policy, not
ground truth. Live retraining or threshold calibration against these traces
inherits LLM mistakes (and, at one step's remove, prior-step labels: the
step-5 record's label is the step-4 action). For calibration this is the
honest choice — the question is "when does the head disagree with the policy
it would replace", and the policy it would replace is the LLM. It is NOT a
quality oracle. Accepted for v1 and recorded here so no future consumer
treats `gold` as verified truth.

## Failure discipline

Recording failures degrade to a warning and disable recording for the rest
of the run — never a step failure, the same discipline as the shadow head
itself. Trace recording is instrumentation; it must never change what the
loop executes (verified: recorder-off runs emit no file and identical
executed actions).
