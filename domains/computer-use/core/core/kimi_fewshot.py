"""
Allternit Computer Use — Few-shot exemplar selection + prompt assembly for the
KimiCliHead (prompt-space distillation from Tier A labelled traces).

Traces come from core/tier_a_traces.py (evaluation/tier-a/traces.jsonl): each
record carries the exact shadow-head state text, the question menus, and the
gold operation/target from the recorded-LLM transcript.

Hard invariant: exemplars are drawn from the TRAIN split ONLY, and never from
the three held-out canonical eval tasks (search-flow, form-fill,
settings-toggle). Selection filters and then asserts — a held-out record
slipping into the prompt would invalidate the eval, so this is checked in
code, not just in prose.
"""

from __future__ import annotations

import random
import re
from typing import Any, Dict, List, Optional, Sequence

from .decision_head import CANONICAL_OPERATIONS

HELD_OUT_TASK_IDS = frozenset({"search-flow", "form-fill", "settings-toggle"})

# How much of a trace's state text becomes an exemplar. Full states run
# 500-900 chars; the excerpt keeps the task line + observed-element rows,
# which is the signal a step decision conditions on.
DEFAULT_MAX_STATE_CHARS = 700

FRAMINGS = ("default", "task-neutral")

_DEFAULT_INTRO = (
    "[EXAMPLES — RECORDED DECISIONS ON OTHER SITES]\n"
    "Each example shows a site's state and the recorded correct next decision. "
    "The sites, names, and flows below DIFFER from yours; use them only as "
    "reasoning patterns for mapping a state to its decision."
)

_TASK_NEUTRAL_INTRO = (
    "[EXAMPLES — RECORDED DECISIONS ON OTHER SITES]\n"
    "CRITICAL: the site and flow vary from example to example and from your "
    "task. There is NO fixed per-site policy: the same site may need fill on "
    "one step and click on the next. Decide from the CURRENT state only — "
    "never from the task name, the site type, or what the previous step did. "
    "Each example shows a state and the recorded correct next decision."
)


def _extract_excerpt(state_text: str, max_chars: int) -> str:
    """Pull the task line + [OBSERVED ELEMENTS] block out of a full shadow
    state text; fall back to a head-truncation of the whole state."""
    task_match = re.search(r"^\[TASK\]\n(.+?)\n", state_text, re.MULTILINE)
    task_line = task_match.group(1) if task_match else ""
    elements_match = re.search(
        r"(\[OBSERVED ELEMENTS\]\n(?:.+\n)+?)\n\[OPTIONS\]", state_text,
    )
    elements = elements_match.group(1).rstrip() if elements_match else ""
    body = f"Site task: {task_line}\n{elements}".strip()
    if not body:
        body = state_text[:max_chars]
    if len(body) > max_chars:
        body = body[:max_chars].rstrip() + " …"
    return body


def exemplar_from_trace(
    record: Dict[str, Any],
    max_state_chars: int = DEFAULT_MAX_STATE_CHARS,
) -> Optional[Dict[str, Any]]:
    """Build one exemplar dict from a trace record.

    Returns None when the record cannot serve as an exemplar (no gold
    operation, operation outside the canonical vocabulary, or no usable state
    excerpt). The gold target is included only when the recorded operation's
    target menu was offered AND the reference target resolved to a row index.
    """
    if record.get("split") != "train":
        return None
    if record.get("task_id") in HELD_OUT_TASK_IDS:
        return None
    gold = record.get("gold") or {}
    operation = gold.get("operation")
    if operation not in CANONICAL_OPERATIONS:
        return None
    state_text = record.get("state_text") or ""
    if "[OBSERVED ELEMENTS]" not in state_text:
        return None

    target: Optional[Dict[str, str]] = None
    target_answer = gold.get(f"{operation}_target")
    if target_answer:
        question = next(
            (q for q in record.get("questions", []) if q.get("name") == f"{operation}_target"),
            None,
        )
        if question and target_answer in question.get("options", []):
            target = {
                "question": f"{operation}_target",
                "answer": str(target_answer),
                "element": str((record.get("llm") or {}).get("target") or ""),
            }

    return {
        "trace_id": record.get("trace_id", ""),
        "template": record.get("template", ""),
        "state_excerpt": _extract_excerpt(state_text, max_state_chars),
        "operation": operation,
        "target": target,
    }


def select_few_shot_examples(
    traces: Sequence[Dict[str, Any]],
    n: int,
    seed: int = 42,
    max_state_chars: int = DEFAULT_MAX_STATE_CHARS,
    order: str = "random",
) -> List[Dict[str, Any]]:
    """Select n exemplars from train-split traces, never from held-out tasks.

    ``order``: "random" shuffles the whole candidate pool with ``seed``;
    "interleaved" groups candidates by template and round-robins the groups so
    consecutive exemplars always come from different site types (fights
    per-task policy anchoring), then shuffles within that interleave.
    """
    if n <= 0:
        return []
    if order not in ("random", "interleaved"):
        raise ValueError(f"order must be 'random' or 'interleaved', got {order!r}")

    candidates: List[Dict[str, Any]] = []
    for record in traces:
        exemplar = exemplar_from_trace(record, max_state_chars=max_state_chars)
        if exemplar is not None:
            candidates.append(exemplar)

    # Hard invariant, asserted after filtering: no held-out surface anywhere.
    leaked = [
        e for e in candidates
        if e["trace_id"].split(":")[0] in HELD_OUT_TASK_IDS
    ]
    if leaked:
        raise ValueError(
            f"held-out tasks leaked into few-shot candidates: {leaked!r}"
        )

    rng = random.Random(seed)
    if order == "interleaved":
        by_template: Dict[str, List[Dict[str, Any]]] = {}
        for exemplar in candidates:
            by_template.setdefault(exemplar["template"], []).append(exemplar)
        for group in by_template.values():
            rng.shuffle(group)
        groups = [by_template[k] for k in sorted(by_template)]
        interleaved: List[Dict[str, Any]] = []
        while any(groups):
            for group in groups:
                if group:
                    interleaved.append(group.pop())
        # No final shuffle: it would break the no-adjacent-same-template
        # property the interleave exists to guarantee.
        return interleaved[:n]

    rng.shuffle(candidates)
    return candidates[:n]


def render_few_shot_block(
    examples: Sequence[Dict[str, Any]],
    framing: str = "default",
) -> str:
    """Render the exemplar list as prompt text injected before [STATE].

    ``framing``: "default" intro, or "task-neutral" — an explicit
    anti-collapse preamble stating the site/flow varies and the decision must
    come from the current state only.
    """
    if framing not in FRAMINGS:
        raise ValueError(f"framing must be one of {FRAMINGS}, got {framing!r}")
    if not examples:
        return ""
    intro = _TASK_NEUTRAL_INTRO if framing == "task-neutral" else _DEFAULT_INTRO
    lines = [intro, ""]
    for index, exemplar in enumerate(examples, start=1):
        lines.append(f"Example {index}:")
        lines.append(exemplar["state_excerpt"])
        decision = f'Correct decision: operation = "{exemplar["operation"]}"'
        target = exemplar.get("target")
        if target:
            element = f' (element: {target["element"]})' if target["element"] else ""
            decision += (
                f', {target["question"]} = "{target["answer"]}"{element}'
            )
        lines.append(decision)
        lines.append("")
    lines.append("[END OF EXAMPLES — your task's state follows]")
    return "\n".join(lines)
