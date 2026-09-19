"""
Allternit Computer Use — Live shadow-head trace recorder (JEV trace policy)

Appends one JSONL record per ``shadow.decision`` event when a planning-loop
run enables trace recording (``PlanningLoopConfig.shadow_trace_path``), so
real and replay runs with ``shadow_head_enabled=true`` accumulate OUR OWN
labeled traces: each head decision plus the EXECUTED LLM step as the
reference label. These traces are the calibration substrate for shadow-head
promotion thresholds — never vendor/self-reported confidence.

Record shape is a superset of the Tier A synthetic trace schema
(core/tier_a_traces.py): every live record is readable by
``core.kimi_fewshot.exemplar_from_trace()`` and ``load_traces()`` as-is, so
live traces can serve as future train-split exemplars and calibration data.
Extensions over the synthetic shape: run_id, effect (graft-B vocabulary),
head (chosen + confidence per question), latency_ms, redacted, ts.

Write-time redaction (default ON): element VALUES are PII-sensitive (form
fields: emails, passwords, typed text). The ``value`` of every CHANGED row
in the [SINCE LAST STEP] block is replaced with "[redacted]" — both the
current value and the "was" value. Element NAMES are kept: names are the
decision vocabulary (design tension #1 — names under-report, and the head
conditions on them). The executed step's ``target`` is an element name/ref
(resolved via ElementTable.match_target), never a typed value, so it is
kept; the executed step's typed ``text`` (when present in action_params) IS
a free-text value and is redacted. Every record carries a ``redacted`` flag.

Split discipline (mirror of core/kimi_fewshot.py): live records default to
split="train"; a record whose task_id is one of the three held-out synthetic
eval tasks is labeled split="heldout" — labeling only, never an assert, so a
misconfigured harness cannot crash a live run. The kimi_fewshot leak
invariant therefore still holds for live records.

Labeling caveat (documented in docs/JEV_TRACE_POLICY.md): the reference
label is the EXECUTED LLM decision — the reference policy, not ground
truth. Live retraining against it inherits LLM mistakes. Accepted for v1.
Also: the label for a step's head proposal is the LLM step executed at the
PREVIOUS step (the step whose effect is visible in this state's
[SINCE LAST STEP] block) — the same source as graft B's prior_step. Step 1
of a run has no prior executed step and records an empty gold.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, IO, List, Optional

from .kimi_fewshot import HELD_OUT_TASK_IDS
from .shadow_eval import _LLM_OP_MAP

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1
REDACTED = "[redacted]"

SPLIT_TRAIN = "train"
SPLIT_HELDOUT = "heldout"

# CHANGED delta row as rendered by core/element_table.render_delta_block:
#   ~ [<id>] <role>: <name> = "<current value>" (was "<previous value>")
# Values are matched non-greedily up to the first embedded quote; values
# containing '"' are pathological and covered by the write-time check that
# the raw line no longer appears verbatim (tests exercise the nasty case).
_CHANGED_ROW_RE = re.compile(
    r'^(?P<prefix>~\s+\[[^\]]*\]\s+.*?)\s*=\s*"(?P<current>[^"]*)"\s*'
    r'\(was\s*"(?P<previous>[^"]*)"\)\s*$'
)


def redact_state_text(state_text: str) -> str:
    """Replace the value of every CHANGED row in a shadow state text with
    "[redacted]" (both current and previous value). Element names, roles,
    refs, and table rows are untouched — names are the decision signal."""
    lines = []
    for line in (state_text or "").split("\n"):
        match = _CHANGED_ROW_RE.match(line.strip())
        if match:
            lines.append(
                f'{match.group("prefix")} = "{REDACTED}" (was "{REDACTED}")'
            )
        else:
            lines.append(line)
    return "\n".join(lines)


def _task_id_from_session(session_id: str) -> str:
    """The planning loop's session id carries the task identity; eval
    harnesses prefix it with "shadow-" (same convention KimiCliHead's
    begin_run documents). Strip the prefix so held-out labeling applies."""
    session_id = str(session_id or "")
    if session_id.startswith("shadow-"):
        return session_id[len("shadow-"):]
    return session_id


class TraceRecorder:
    """Append-only JSONL recorder for live shadow-head decision traces.

    ``record(event)`` normalizes one shadow-decision event into the trace
    schema, redacts values at write time when ``redact_values`` is True
    (the default), appends one JSON line, and returns the persisted record
    (or None when the recorder is closed). ``close()`` flushes and closes
    the handle; both methods never raise — recording failures degrade to a
    warning at the caller (same discipline as the shadow head itself).
    """

    def __init__(self, path: Path, redact_values: bool = True) -> None:
        self.path = Path(path)
        self.redact_values = bool(redact_values)
        self.records_written = 0
        self._closed = False
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._handle: IO[str] = self.path.open("a", encoding="utf-8")

    # ── lifecycle ────────────────────────────────────────────────────────

    def close(self) -> None:
        if not self._closed:
            self._closed = True
            try:
                self._handle.close()
            except Exception:  # pragma: no cover - defensive
                logger.warning("trace recorder close failed: %s", self.path)

    def __enter__(self) -> "TraceRecorder":
        return self

    def __exit__(self, *exc_info: Any) -> None:
        self.close()

    # ── record ───────────────────────────────────────────────────────────

    def record(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Append one trace record for a shadow decision event.

        ``event`` carries: task_id, run_id, step, state_text, questions
        ([{name, options}]), decision (TypedDecision.to_dict()), latency_ms,
        table (the decision step's ElementTable, for target resolution),
        prior_step (None or {action_type, action_target, text,
        action_succeeded} — the previously EXECUTED LLM step), ts.
        """
        if self._closed:
            return None
        record = self._build_record(event)
        self._handle.write(json.dumps(record) + "\n")
        self._handle.flush()
        self.records_written += 1
        return record

    def _build_record(self, event: Dict[str, Any]) -> Dict[str, Any]:
        task_id = str(event.get("task_id") or "unknown")
        run_id = str(event.get("run_id") or "")
        step = int(event.get("step") or 0)
        split = SPLIT_HELDOUT if task_id in HELD_OUT_TASK_IDS else SPLIT_TRAIN

        questions: List[Dict[str, Any]] = [
            {"name": q["name"], "options": [str(o) for o in q["options"]]}
            for q in (event.get("questions") or [])
        ]
        by_name = {q["name"]: q for q in questions}

        # Reference label: the previously EXECUTED LLM step (graft-B
        # prior_step source). Operation is folded through the eval's
        # transcript-op mapping so the gold is always a head-menu option.
        gold: Dict[str, str] = {}
        llm: Dict[str, Any] = {}
        effect: Optional[str] = None
        prior = event.get("prior_step")
        if prior:
            raw_op = str(prior.get("action_type") or "")
            llm_op = _LLM_OP_MAP.get(raw_op, raw_op)
            operation_options = by_name.get("operation", {}).get("options", [])
            if llm_op in operation_options:
                gold["operation"] = llm_op
            target = str(prior.get("action_target") or "")
            table = event.get("table")
            target_question = by_name.get(f"{llm_op}_target")
            if table is not None and target_question is not None and target:
                matched = table.match_target(target)
                if matched is not None and str(matched) in target_question["options"]:
                    gold[f"{llm_op}_target"] = str(matched)
            llm = {
                "op": llm_op,
                "target": target,
                "text": prior.get("text"),
                "success": bool(prior.get("action_succeeded")),
            }
            effect = "confirmed" if prior.get("action_succeeded") else "suspected_noop"

        state_text = str(event.get("state_text") or "")
        redacted = False
        if self.redact_values:
            state_text = redact_state_text(state_text)
            if llm.get("text"):
                llm["text"] = REDACTED
            redacted = True

        decision = event.get("decision") or {}
        record = {
            "schema_version": SCHEMA_VERSION,
            "trace_id": f"{task_id}:{run_id}:{step}",
            "task_id": task_id,
            "run_id": run_id,
            "step": step,
            "template": str(event.get("template") or "live"),
            "split": split,
            "state_text": state_text,
            "questions": questions,
            "gold": gold,
            "llm": llm,
            "effect": effect,
            "head": {
                "model_id": decision.get("model_id", ""),
                "latency_ms": decision.get("latency_ms", 0.0),
                "choices": {
                    name: {
                        "chosen": choice.get("chosen"),
                        "confidence": choice.get("confidence"),
                        "probabilities": choice.get("probabilities", {}),
                    }
                    for name, choice in (decision.get("choices") or {}).items()
                },
            },
            "latency_ms": float(event.get("latency_ms") or 0.0),
            "redacted": redacted,
            "ts": str(
                event.get("ts")
                or datetime.now(timezone.utc).isoformat()
            ),
        }
        return record


__all__ = [
    "SCHEMA_VERSION",
    "REDACTED",
    "SPLIT_TRAIN",
    "SPLIT_HELDOUT",
    "TraceRecorder",
    "redact_state_text",
    "_task_id_from_session",
]
