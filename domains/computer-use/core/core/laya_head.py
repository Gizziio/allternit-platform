"""
Allternit Computer Use — Laya shadow decision head

``LayaHead`` adapts Laya (https://github.com/NandhaKishorM/laya, PyPI
``laya>=0.3.3``, Apache-2.0; HF hub ``convaiinnovations/laya``) to the
``DecisionHead`` protocol, as a local-tier retrofit candidate measured
head-to-head against ``MlxDirectLogitHead``, ``SemIfHead`` and ``KimiCliHead``.

Laya is a ModernBERT-based RLCD "System 1" decision model: ONE batched,
non-autoregressive forward pass scores every typed question for a state:

- ``choice``: criteria dict ``{option: description}`` -> chosen key, full
  per-option probability distribution, and an entropy-derived confidence;
- ``noul``: statement -> P(true);
- ``score``: ordinal rubric (unused by this head — the planning loop asks
  only closed-set choice and boolean-gate questions).

Question mapping (mirrors what ``scripts/export_laya_finetune.py`` emits as
training questions, so fine-tuning and inference see identical prompts):

- ``operation`` / ``<op>_target`` -> ``choice`` questions whose criteria keys
  are the exact option strings (the canonical vocabulary / element-row
  indices). Per-option descriptions are brief and deterministic — the option
  strings themselves carry the decision signal, and the option head shares a
  ~192-token budget (see below).
- ``goal_satisfied`` / ``stuck`` -> ``noul`` questions; the returned P(true)
  becomes the "true"/"false" Choice distribution.

The >16-option design (load-bearing, not bolted on): Laya's published honest
limitation is that ``choice`` accuracy degrades past ~20 options because all
options share the head budget (``head_max_len``, 192 tokens in the base
checkpoints — ~48 option tokens each before the budget forces truncation;
their Banking77 number is 0.425 at 77 labels, and their recommendation is
two-step coarse-to-fine). Our ``<op>_target`` menus run to 64 row indices, so
menus with more than ``max_direct_options`` (default 16) options are decided
in TWO sequential passes:

1. a ``choice`` over consecutive index-range GROUPS (<= 16 groups), then
2. a ``choice`` over the options inside the winning group only.

Final per-option probabilities combine multiplicatively:
``p(option) = p(group(option)) * p(option | group)`` — every original option
keeps mass, options outside the winning group keep their group's mass (which
the group pass already spread across groups). Latency cost: exactly one extra
batched Laya forward pass per decide() that contains any oversized menu
(measured locally at roughly a 2x decide() latency versus an all-small-menu
step; every pass re-encodes the state per question, so the coarse pass costs
the same as any other question, not a fraction of it). Up to 64 options this
is 2 passes of <= 16 options each; the design generalizes to any menu size at
ceil(n/16) groups.

Laya is an OPTIONAL dependency (same contract as the mlx / SemIf heads):
importing this module never requires it; constructing the head without it
raises a clear, actionable ``ShadowHeadDependencyError``. Weights download
lazily from the public ungated HF repo (english checkpoint at the repo root;
``subfolder="multilingual"`` / ``subfolder="typed-decisions"`` select the
other checkpoints via ``allow_patterns`` — only the requested subfolder is
downloaded); after the one-time download inference is fully local. A local
fine-tuned checkpoint directory (as produced by the Kaggle notebook) loads
through the same ``model=`` param — ``laya.Agent`` accepts a local path
verbatim. No API keys, no network at inference beyond the one-time download.
"""

from __future__ import annotations

import importlib.util
import logging
import time
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from .decision_head import (
    Choice,
    Question,
    ShadowHeadDependencyError,
    ShadowHeadError,
    TypedDecision,
)

logger = logging.getLogger(__name__)

# Public, ungated, Apache-2.0 HF repo. The english checkpoint lives at the
# REPO ROOT (rl_agent_config.json + model.safetensors + tokenizer/ + encoder/);
# "multilingual" and "typed-decisions" are subfolders (verified against the
# hub API file listing — README phrasing differs, the listing is truth).
DEFAULT_MODEL = "convaiinnovations/laya"
DEFAULT_SUBFOLDER: Optional[str] = None

# Menus at or under this many options go to Laya as a single choice question;
# larger menus take the two-step coarse-to-fine path (see module docstring).
# 16 keeps every option comfortably inside the shared 192-token head budget
# AND leaves the two-step path only one extra pass for 17..64-option menus.
MAX_DIRECT_OPTIONS = 16

# Our question names that map to Laya's boolean noul type.
_GATE_QUESTIONS = frozenset({"goal_satisfied", "stuck"})

# Suffix separating the coarse group-picker key from the real question name
# in the batched pass-1 question dict (never a real question name character).
_GROUP_KEY_SUFFIX = "__laya_groups"

# Scorer call shape: (state, questions_dict) -> {"answers": {qid: answer}},
# exactly laya.Agent.system_one's contract. Injectable so tests exercise the
# mapping without weights (and so a fine-tuned runtime can be substituted).
Scorer = Callable[[Any, Dict[str, Dict[str, Any]]], Dict[str, Any]]


# ---------------------------------------------------------------------------
# Laya question construction (shared with scripts/export_laya_finetune.py —
# training and inference MUST emit identical question definitions)
# ---------------------------------------------------------------------------

def group_ranges(option_count: int, group_size: int = MAX_DIRECT_OPTIONS) -> List[Tuple[int, int]]:
    """Consecutive [start, end) index ranges covering ``option_count`` options
    in groups of at most ``group_size`` — the deterministic coarse-to-fine
    chunking. ``group_ranges(40)`` -> [(0, 16), (16, 32), (32, 40)]."""
    if option_count < 1:
        return []
    return [
        (start, min(start + group_size, option_count))
        for start in range(0, option_count, group_size)
    ]


def group_label(start: int, end: int) -> str:
    """The criteria key for one coarse group (row-index ranges, inclusive)."""
    return f"{start}-{end - 1}"


def laya_question_def(name: str, options: Sequence[str]) -> Dict[str, Any]:
    """Map one of our closed-set questions to a Laya typed question dict.

    Gates become ``noul`` statements; everything else becomes a ``choice``
    whose criteria keys are the exact option strings. This function is the
    single source of truth for the question format — the fine-tune exporter
    imports it so trained prompts and inference prompts are identical.
    """
    options = [str(o) for o in options]
    if name in _GATE_QUESTIONS:
        if name == "goal_satisfied":
            instructions = (
                "Given the task and the current observed browser state, is the "
                "task goal satisfied?"
            )
        else:
            instructions = (
                "Given the task and the recent state changes, is the "
                "automation loop stuck — the previous actions failed or the "
                "state is not progressing?"
            )
        return {"type": "noul", "instructions": instructions}
    if name == "operation":
        instructions = (
            "Given the task and the current observed browser elements, choose "
            "the next browser operation to perform."
        )
        criteria = {
            option: f"perform the '{option}' operation"
            for option in options
        }
    elif name.endswith("_target"):
        operation = name[: -len("_target")]
        instructions = (
            f"Choose the element table row index that the operation "
            f"'{operation}' should act on, given the current observed "
            f"elements."
        )
        criteria = {
            option: f"element table row {option}"
            for option in options
        }
    else:
        instructions = (
            f"Answer question '{name}' by choosing exactly one of the listed "
            f"options."
        )
        criteria = {option: f"option '{option}'" for option in options}
    return {"type": "choice", "instructions": instructions, "criteria": criteria}


def group_choice_def(options: Sequence[str]) -> Dict[str, Any]:
    """The pass-1 coarse question for an oversized menu: pick the row-index
    range that contains the target."""
    return {
        "type": "choice",
        "instructions": (
            "The element list is large. First choose the range of element "
            "table row indices that contains the row the operation should "
            "act on."
        ),
        "criteria": {
            group_label(s, e): f"element table row indices {s} through {e - 1}"
            for s, e in group_ranges(len(options))
        },
    }


# ---------------------------------------------------------------------------
# Answer conversion
# ---------------------------------------------------------------------------

def _normalized_distribution(
    raw: Dict[str, Any], options: Sequence[str]
) -> Dict[str, float]:
    """Laya rounds per-option probabilities to 4 decimals, so the returned
    mass can drift off 1.0 (enough to fail our Choice validator on 64-option
    menus). Fill any missing option with 0, clip, and renormalize."""
    dist: Dict[str, float] = {}
    total = 0.0
    for option in options:
        try:
            value = float(raw.get(str(option), 0.0))
        except (TypeError, ValueError):
            value = 0.0
        value = min(1.0, max(0.0, value))
        dist[str(option)] = value
        total += value
    if total <= 0.0:
        n = len(options)
        return {str(o): 1.0 / n for o in options}
    return {option: value / total for option, value in dist.items()}


def _choice_from_noul(question: Question, answer: Dict[str, Any]) -> Choice:
    """Boolean gate: Laya's noul value IS P(true)."""
    try:
        p_true = float(answer.get("noul", 0.5))
    except (TypeError, ValueError):
        p_true = 0.5
    p_true = min(1.0, max(0.0, p_true))
    probabilities = {"false": 1.0 - p_true, "true": p_true}
    confidence = answer.get("confidence")
    try:
        confidence = float(confidence)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        confidence = max(p_true, 1.0 - p_true)
    return Choice(
        question=question.name,
        chosen="true" if p_true >= 0.5 else "false",
        probabilities=probabilities,
        confidence=min(1.0, max(0.0, confidence)),
    )


def _choice_from_choice_answer(
    question: Question, answer: Dict[str, Any]
) -> Choice:
    """Direct (<= max_direct_options) choice: chosen = Laya's choice key,
    distribution = returned distribution renormalized, confidence = Laya's
    returned entropy-based confidence."""
    probabilities = _normalized_distribution(
        answer.get("probabilities", {}), question.options
    )
    chosen = str(answer.get("choice", question.options[0]))
    if chosen not in probabilities:
        logger.warning(
            "laya choice %r not in options for %r; falling back to argmax",
            chosen, question.name,
        )
        chosen = max(probabilities, key=probabilities.get)  # type: ignore[arg-type]
    confidence = answer.get("confidence")
    try:
        confidence = float(confidence)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        confidence = probabilities[chosen]
    return Choice(
        question=question.name,
        chosen=chosen,
        probabilities=probabilities,
        confidence=min(1.0, max(0.0, confidence)),
    )


# ---------------------------------------------------------------------------
# LayaHead
# ---------------------------------------------------------------------------

class LayaHead:
    """Laya (ModernBERT RLCD System 1) decision head behind DecisionHead.

    One ``decide()`` maps to one batched Laya forward pass over all questions
    when every menu is <= ``max_direct_options`` options, or TWO sequential
    passes when any menu is larger (coarse group pick, then in-group pick —
    see the module docstring for the latency cost and the probability math).

    ``scorer`` injects the (state, questions) -> answers call, defaulting to a
    lazily loaded ``laya.Agent.system_one``; tests pass a stub so no weights
    are needed. ``temperature`` overrides the checkpoint's per-qtype list
    after load (reserved for post-fine-tune calibration; None keeps the
    checkpoint values). ``model``/``subfolder`` select the checkpoint:
    defaults are the english checkpoint at the HF repo root; a local
    fine-tuned directory works verbatim (``laya.Agent`` accepts local paths).
    """

    def __init__(
        self,
        model: str = DEFAULT_MODEL,
        subfolder: Optional[str] = DEFAULT_SUBFOLDER,
        device: Optional[str] = None,
        max_direct_options: int = MAX_DIRECT_OPTIONS,
        temperature: Optional[float] = None,
        scorer: Optional[Scorer] = None,
    ) -> None:
        if max_direct_options < 2:
            raise ValueError(
                f"max_direct_options must be >= 2, got {max_direct_options}"
            )
        self.model = model
        self.subfolder = subfolder
        self.device = device
        self.max_direct_options = int(max_direct_options)
        self.temperature = temperature
        self._scorer = scorer
        self._agent: Any = None

    # ── loading ──────────────────────────────────────────────────────────

    def _require_laya(self) -> None:
        if importlib.util.find_spec("laya") is None:
            raise ShadowHeadDependencyError(
                "LayaHead needs the optional 'laya' dependency, which is not "
                "installed in this environment. Install it with:\n"
                '    uv pip install "laya>=0.3.3"\n'
                "(pulls torch + transformers; works on CPU and Apple-silicon "
                "MPS — no API keys, no gated weights. The english checkpoint "
                "downloads once from the public HF repo "
                "'convaiinnovations/laya' at the repo root; "
                "subfolder='multilingual' selects the multilingual one.)"
            )

    def _load(self) -> None:
        if self._scorer is not None or self._agent is not None:
            return
        self._require_laya()
        import laya  # lazy: optional dependency

        logger.info(
            "Loading laya agent from %s (subfolder=%s, device=%s) — first "
            "run downloads, then fully local",
            self.model, self.subfolder or "(root)", self.device or "auto",
        )
        try:
            self._agent = laya.load(
                self.model, device=self.device, subfolder=self.subfolder
            )
        except Exception as exc:
            raise ShadowHeadError(
                f"failed to load laya checkpoint from {self.model!r} "
                f"(subfolder={self.subfolder!r}): {exc}. The repo is public "
                "and ungated; check connectivity for the one-time download."
            ) from exc
        if self.temperature is not None:
            # Config-flag hook for post-fine-tune calibration: the checkpoint
            # carries a per-qtype list; a scalar override applies to all three.
            self._agent.temperature = [
                float(self.temperature),
                float(self.temperature),
                float(self.temperature),
            ]

    def _score(
        self, state_text: str, questions: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        self._load()
        if self._scorer is not None:
            return self._scorer(state_text, questions)
        result = self._agent.system_one(state_text, questions)
        return result.get("answers", {})

    # ── inference ────────────────────────────────────────────────────────

    def decide(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> TypedDecision:
        started = time.time()
        questions = list(questions)

        # Partition: single-option menus answer themselves; gates and small
        # menus go to pass 1 as-is; oversized menus contribute a coarse
        # group-picker to pass 1 and an in-group question to pass 2.
        pass1: Dict[str, Dict[str, Any]] = {}
        oversized: List[Tuple[Question, str]] = []  # (question, coarse key)
        choices: Dict[str, Choice] = {}
        for question in questions:
            options = [str(o) for o in question.options]
            if len(options) < 2:
                # Degenerate single-option menu: nothing to decide.
                choices[question.name] = Choice(
                    question=question.name,
                    chosen=options[0],
                    probabilities={options[0]: 1.0},
                    confidence=1.0,
                )
                continue
            if (
                question.name not in _GATE_QUESTIONS
                and len(options) > self.max_direct_options
            ):
                coarse_key = f"{question.name}{_GROUP_KEY_SUFFIX}"
                pass1[coarse_key] = group_choice_def(options)
                oversized.append((question, coarse_key))
            else:
                pass1[question.name] = laya_question_def(question.name, options)

        answers1 = self._score(state_text, pass1) if pass1 else {}

        oversized_names = {q.name for q, _ in oversized}
        for question in questions:
            if question.name in choices:
                continue
            answer = answers1.get(question.name)
            if question.name in _GATE_QUESTIONS:
                if not isinstance(answer, dict):
                    raise ShadowHeadError(
                        f"laya returned no noul answer for gate {question.name!r}"
                    )
                choices[question.name] = _choice_from_noul(question, answer)
            elif question.name not in oversized_names:
                if not isinstance(answer, dict):
                    raise ShadowHeadError(
                        f"laya returned no choice answer for {question.name!r}"
                    )
                choices[question.name] = _choice_from_choice_answer(
                    question, answer
                )

        # Pass 2 — one in-group choice per oversized menu, batched into a
        # single laya forward pass.
        if oversized:
            pass2: Dict[str, Dict[str, Any]] = {}
            for question, coarse_key in oversized:
                options = [str(o) for o in question.options]
                ranges = group_ranges(len(options))
                coarse = answers1.get(coarse_key)
                if not isinstance(coarse, dict):
                    raise ShadowHeadError(
                        f"laya returned no coarse answer for {question.name!r}"
                    )
                label = str(coarse.get("choice", ""))
                match = next(
                    (
                        (s, e)
                        for s, e in ranges
                        if group_label(s, e) == label
                    ),
                    None,
                )
                if match is None:
                    raise ShadowHeadError(
                        f"laya coarse answer {label!r} for {question.name!r} "
                        "is not one of the group labels"
                    )
                start, end = match
                in_group_key = f"{question.name}{_GROUP_KEY_SUFFIX}_in"
                pass2[in_group_key] = laya_question_def(
                    question.name, options[start:end]
                )
            answers2 = self._score(state_text, pass2)

            for question, coarse_key in oversized:
                options = [str(o) for o in question.options]
                ranges = group_ranges(len(options))
                coarse = answers1[coarse_key]
                in_group_key = f"{question.name}{_GROUP_KEY_SUFFIX}_in"
                fine = answers2.get(in_group_key)
                if not isinstance(fine, dict):
                    raise ShadowHeadError(
                        f"laya returned no in-group answer for {question.name!r}"
                    )

                group_dist = _normalized_distribution(
                    coarse.get("probabilities", {}),
                    [group_label(s, e) for s, e in ranges],
                )
                chosen_label = str(coarse.get("choice", ""))
                chosen_index = next(
                    (
                        i
                        for i, (s, e) in enumerate(ranges)
                        if group_label(s, e) == chosen_label
                    ),
                    0,
                )
                start, end = ranges[chosen_index]
                fine_dist = _normalized_distribution(
                    fine.get("probabilities", {}), options[start:end]
                )
                # Multiplicative combination: p(option) = p(group) * p(option
                # | group). The fine pass only covers the winning group;
                # losing groups spread their coarse mass uniformly across
                # their options (the coarse pass carries no within-group
                # detail). Already normalized by construction; renormalize
                # anyway (4-decimal rounding drifts the sum).
                combined: Dict[str, float] = {}
                for gi, (s, e) in enumerate(ranges):
                    for option in options[s:e]:
                        if gi == chosen_index:
                            combined[option] = (
                                group_dist[chosen_label] * fine_dist[option]
                            )
                        else:
                            combined[option] = group_dist[group_label(s, e)] / (e - s)
                total = sum(combined.values()) or 1.0
                probabilities = {
                    option: value / total for option, value in combined.items()
                }
                chosen = str(fine.get("choice", options[start]))
                if chosen not in probabilities:
                    chosen = max(probabilities, key=probabilities.get)  # type: ignore[arg-type]
                confidence = fine.get("confidence")
                try:
                    confidence = float(confidence)  # type: ignore[arg-type]
                except (TypeError, ValueError):
                    confidence = probabilities[chosen]
                choices[question.name] = Choice(
                    question=question.name,
                    chosen=chosen,
                    probabilities=probabilities,
                    confidence=min(1.0, max(0.0, confidence)),
                )

        decision = TypedDecision(
            choices=choices,
            latency_ms=(time.time() - started) * 1000.0,
            model_id=(
                f"laya:{self.model}"
                + (f"/{self.subfolder}" if self.subfolder else "")
                + (f":T{self.temperature:g}" if self.temperature is not None else "")
            ),
        )
        decision.validate()
        return decision
