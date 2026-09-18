"""
Allternit Computer Use — Shadow Decision Head

Head-agnostic typed-decision interface plus a fully-local direct-logit
implementation (Tier B of the shadow policy head, per
docs/ACU_SHADOW_HEAD_MAP.md).

Pattern (ported from jev-ultrafast, MIT — design reference only): ONE
decision pass asks an operation Choice plus speculative ``<operation>_target``
Choices; every option is a closed-set string; the head returns per-option
probabilities plus an entropy-based confidence. Model output never becomes
selectors, coordinates, or JS — target options are element indices supplied
by the caller (core/element_table.py).

Heads implement the ``DecisionHead`` protocol, so consumers (the planning
loop shadow hook, the eval harness) never change when a head is swapped
(Qwen variant, trained classifier, later even Jev itself).

Tier B head (``MlxDirectLogitHead``): one prefill of the state text with
mlx-lm, a per-option first-token logit readout at the final prompt position,
softmax across options, entropy-derived confidence. No network calls at
inference — weights load once, locally, behind an optional dependency extra
(``shadow-head`` in pyproject.toml). ``MockHead`` is the deterministic
stand-in for tests and offline evals.
"""

from __future__ import annotations

import importlib.util
import json
import logging
import math
import os
import shutil
import subprocess
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol, Sequence, Tuple, runtime_checkable

logger = logging.getLogger(__name__)

# Public, ungated, Apache-2.0 HF repo (Qwen3.5-4B class per the MAP). The
# mlx-community conversion is a 4-bit MLX build of Qwen/Qwen3-4B-Instruct-2507.
# No gated weights, no signup wall — plain anonymous HF download.
DEFAULT_MODEL_REPO = "mlx-community/Qwen3-4B-Instruct-2507-4bit"

# Concrete commit pin. Resolved against the repo after the first verified
# download and recorded here (and overridable via SHADOW_HEAD_REVISION) — a
# guessed hash is worse than none, so until then None tracks the repo's
# default branch.
DEFAULT_REVISION: Optional[str] = "50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b"
_REVISION_ENV_VAR = "SHADOW_HEAD_REVISION"

_MAX_TARGET_OPTIONS = 64

# The 11-action whitelist (mirrors WHITELIST_OPERATIONS in
# core/element_table.py; Rust BATCH_ACTION_WHITELIST is authoritative). A
# menu that mixes naming conventions across runtimes collapses the head to
# prior-guessing — the canonical vocabulary IS the architecture.
CANONICAL_OPERATIONS: Tuple[str, ...] = (
    "click", "fill", "type", "press", "scrollTo", "nextChunk", "prevChunk",
    "selectOptionFromDropdown", "hover", "doubleClick", "dragAndDrop",
)

# Legacy aliases from other runtimes' action vocabularies, folded to
# canonical in BOTH the options block and the answer parsing. Anything not
# canonical (and not foldable) is logged as a vocab miss.
_OPERATION_ALIASES: Dict[str, str] = {
    "input": "type",
    "type_text": "type",
    "enter": "press",
    "key": "press",
    "keypress": "press",
    "keyboard": "press",
    "scroll": "scrollTo",
    "scroll_to": "scrollTo",
    "select": "selectOptionFromDropdown",
    "select_option": "selectOptionFromDropdown",
    "dropdown": "selectOptionFromDropdown",
    "double_click": "doubleClick",
    "doubleclick": "doubleClick",
    "dblclick": "doubleClick",
    "drag": "dragAndDrop",
    "drag_and_drop": "dragAndDrop",
    "dragdrop": "dragAndDrop",
}

# Pseudo-option for "the reference policy does not answer this question"
# (e.g. speculative target menus for operations the recorded policy did not
# choose). Used by labelled-trace consumers (core/tier_a_traces.py) to mark
# gold abstention without colliding with any real option string.
ABSTAIN_OPTION = "__abstain__"

# Boolean gate aliases (goal_satisfied / stuck questions).
_GATE_ALIASES: Dict[str, str] = {
    "yes": "true", "true": "true", "1": "true",
    "no": "false", "false": "false", "0": "false",
}


def canonical_operation(answer: str) -> str:
    """Fold a raw operation answer to the canonical whitelist name (identity
    when already canonical or unknown — unknowns are caught downstream as
    out-of-vocab misses, not silently remapped)."""
    text = str(answer).strip()
    if text in CANONICAL_OPERATIONS:
        return text
    return _OPERATION_ALIASES.get(text.lower(), text)


def _canonicalize_answer(question: Question, raw: Any) -> Tuple[str, Optional[str]]:
    """Normalize one raw answer for a question.

    Returns (answer, miss_kind): miss_kind is None when the answer is already
    an exact option, "alias" when a legacy alias was folded to a canonical
    option, or "out_of_vocab" when it matches nothing (caller falls back)."""
    text = str(raw).strip()
    if question.name == "operation":
        if text in question.options:
            return text, None
        folded = canonical_operation(text)
        if folded in question.options:
            return folded, "alias"
        return text, "out_of_vocab"
    if question.name in ("goal_satisfied", "stuck"):
        folded = _GATE_ALIASES.get(text.lower())
        if folded is not None and folded in question.options:
            return folded, None if folded == text else "alias"
        return text, "out_of_vocab"
    # <operation>_target: options are row-index strings; ints coerce to str.
    if text in question.options:
        return text, None
    return text, "out_of_vocab"


class ShadowHeadError(Exception):
    """Base error for shadow decision-head failures."""


class ShadowHeadDependencyError(ShadowHeadError):
    """The optional mlx-lm extra is not installed."""


class DecisionValidationError(ShadowHeadError):
    """A head produced an invalid decision (bad probabilities, bad bounds)."""


# ---------------------------------------------------------------------------
# Typed decision surface
# ---------------------------------------------------------------------------

@dataclass
class Question:
    """One closed-set question: a name plus its allowed option strings."""
    name: str
    options: List[str]

    def __post_init__(self) -> None:
        seen: List[str] = []
        for option in self.options:
            option = str(option)
            if option not in seen:
                seen.append(option)
        if not seen:
            raise ValueError(f"Question {self.name!r} needs at least one option")
        self.options = seen


@dataclass
class Choice:
    """The head's answer to one question: chosen option + full distribution."""
    question: str
    chosen: str
    probabilities: Dict[str, float]
    confidence: float  # 1 - H/log(n), bounded [0, 1]

    def validate(self) -> None:
        if self.chosen not in self.probabilities:
            raise DecisionValidationError(
                f"chosen option {self.chosen!r} missing from probabilities"
            )
        total = sum(self.probabilities.values())
        if not math.isclose(total, 1.0, rel_tol=1e-3, abs_tol=1e-3):
            raise DecisionValidationError(
                f"probabilities for {self.question!r} sum to {total:.6f}, not 1"
            )
        for value in self.probabilities.values():
            if value < -1e-9 or value > 1.0 + 1e-9 or math.isnan(value):
                raise DecisionValidationError(
                    f"probability out of bounds in {self.question!r}: {value}"
                )
        if not (0.0 - 1e-9 <= self.confidence <= 1.0 + 1e-9):
            raise DecisionValidationError(
                f"confidence {self.confidence} out of bounds [0, 1]"
            )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "question": self.question,
            "chosen": self.chosen,
            "probabilities": dict(self.probabilities),
            "confidence": self.confidence,
        }


@dataclass
class TypedDecision:
    """All answers from one decision pass, plus latency and head identity."""
    choices: Dict[str, Choice]
    latency_ms: float = 0.0
    model_id: str = ""

    def validate(self) -> None:
        if not self.choices:
            raise DecisionValidationError("decision carries no choices")
        for choice in self.choices.values():
            choice.validate()

    def confidence_of(self, question: str) -> float:
        choice = self.choices.get(question)
        return choice.confidence if choice else 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_id": self.model_id,
            "latency_ms": self.latency_ms,
            "choices": {name: c.to_dict() for name, c in self.choices.items()},
        }


@runtime_checkable
class DecisionHead(Protocol):
    """Head-agnostic typed-decision interface.

    ``state_text`` is the full observation+task state; ``questions`` are the
    closed-set questions for this pass (operation choice plus speculative
    per-operation target choices). Implementations must be pure with respect
    to the caller: no mutation of inputs, no side effects beyond inference.
    """

    def decide(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> TypedDecision:
        ...


# ---------------------------------------------------------------------------
# Shared math
# ---------------------------------------------------------------------------

def softmax(scores: Sequence[float]) -> List[float]:
    """Numerically stable softmax over a score sequence."""
    if not scores:
        return []
    peak = max(scores)
    exps = [math.exp(s - peak) for s in scores]
    total = sum(exps)
    return [e / total for e in exps]


def entropy_confidence(probabilities: Sequence[float]) -> float:
    """1 - H/log(n): 0 for a uniform distribution, ~1 for a peaked one.

    Zero-shot heads are over-confident on judgment calls — this is a shape
    signal only; real thresholds come from our own eval data.
    """
    probs = [p for p in probabilities if p > 0.0]
    n = len(probs)
    if n <= 1:
        return 1.0
    entropy = -sum(p * math.log(p) for p in probs)
    confidence = 1.0 - entropy / math.log(n)
    return min(1.0, max(0.0, confidence))


def choice_from_scores(
    question: str,
    options: Sequence[str],
    scores: Sequence[float],
) -> Choice:
    """Build a validated Choice from raw per-option scores (logits)."""
    if len(options) != len(scores) or not options:
        raise DecisionValidationError(
            f"question {question!r}: {len(scores)} scores for {len(options)} options"
        )
    probabilities = softmax(scores)
    chosen_index = max(range(len(options)), key=lambda i: probabilities[i])
    return Choice(
        question=question,
        chosen=options[chosen_index],
        probabilities={options[i]: probabilities[i] for i in range(len(options))},
        confidence=entropy_confidence(probabilities),
    )


# ---------------------------------------------------------------------------
# MockHead — deterministic stand-in for tests and offline evals
# ---------------------------------------------------------------------------

class MockHead:
    """Deterministic head: scripted answers or a chooser callback.

    ``decisions`` maps question name → chosen option (falling back to the
    first option). ``chooser`` overrides everything:
    ``chooser(question, state_text) -> option``. ``latency_ms`` is reported
    verbatim so harnesses can exercise latency accounting without sleeping.
    """

    def __init__(
        self,
        decisions: Optional[Dict[str, str]] = None,
        chooser: Optional[Callable[[Question, str], str]] = None,
        latency_ms: float = 0.0,
        confidence: float = 1.0,
        model_id: str = "mock-head",
    ) -> None:
        self._decisions = dict(decisions or {})
        self._chooser = chooser
        self._latency_ms = float(latency_ms)
        self._confidence = float(confidence)
        self._model_id = model_id

    def decide(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> TypedDecision:
        started = time.time()
        choices: Dict[str, Choice] = {}
        for question in questions:
            if self._chooser is not None:
                chosen = str(self._chooser(question, state_text))
            else:
                chosen = self._decisions.get(question.name, question.options[0])
            if chosen not in question.options:
                raise DecisionValidationError(
                    f"MockHead chose {chosen!r}, not in options for {question.name!r}"
                )
            probabilities = {option: 0.0 for option in question.options}
            probabilities[chosen] = 1.0
            choices[question.name] = Choice(
                question=question.name,
                chosen=chosen,
                probabilities=probabilities,
                confidence=self._confidence,
            )
        measured = (time.time() - started) * 1000.0
        return TypedDecision(
            choices=choices,
            latency_ms=max(measured, self._latency_ms),
            model_id=self._model_id,
        )


# ---------------------------------------------------------------------------
# Tier B: mlx-lm direct-logit head
# ---------------------------------------------------------------------------

class MlxDirectLogitHead:
    """Fully-local direct-logit decision head on mlx-lm (Qwen3.5-4B class).

    One prefill of the state text; per-option first-token logit readout at
    the final prompt position; softmax across options; entropy confidence.
    Weights download lazily from a public ungated Apache-2.0 HF repo and
    cache locally — zero network calls per decision afterwards (airplane
    mode passes). mlx-lm is an OPTIONAL dependency: constructing the head
    without it raises a clear, actionable error; importing this module never
    requires it.
    """

    def __init__(
        self,
        model_repo: str = DEFAULT_MODEL_REPO,
        revision: Optional[str] = None,
        max_target_options: int = _MAX_TARGET_OPTIONS,
    ) -> None:
        self.model_repo = model_repo
        env_revision = os.environ.get(_REVISION_ENV_VAR, "").strip()
        # Explicit args win, then the env override, then the verified pin.
        self.revision = revision or env_revision or DEFAULT_REVISION
        self.max_target_options = max_target_options
        self._model: Any = None
        self._tokenizer: Any = None

    # ── loading ──────────────────────────────────────────────────────────

    def _require_mlx(self) -> None:
        if importlib.util.find_spec("mlx_lm") is None:
            raise ShadowHeadDependencyError(
                "MlxDirectLogitHead needs the optional 'shadow-head' extra: "
                "install with `uv pip install 'allternit-computer-use[shadow-head]'` "
                "or `uv pip install mlx-lm`. No hosted fallback exists by design."
            )

    def _load(self) -> None:
        if self._model is not None:
            return
        self._require_mlx()
        from mlx_lm import load  # lazy: optional dependency

        logger.info(
            "Loading shadow head weights from %s (revision=%s) — first run downloads, then fully local",
            self.model_repo,
            self.revision or "default",
        )
        load_kwargs: Dict[str, Any] = {}
        if self.revision:
            load_kwargs["revision"] = self.revision
        try:
            self._model, self._tokenizer = load(self.model_repo, **load_kwargs)
        except Exception as exc:
            raise ShadowHeadError(
                f"failed to load shadow head weights from {self.model_repo!r} "
                f"(revision={self.revision!r}): {exc}. The repo is public and "
                "ungated; check connectivity for the one-time download or set "
                f"{_REVISION_ENV_VAR} to a pinned commit."
            ) from exc

    # ── inference ────────────────────────────────────────────────────────

    def _option_token_ids(self, options: Sequence[str]) -> List[Optional[int]]:
        """First-token id per option; None when the tokeniser cannot map it."""
        ids: List[Optional[int]] = []
        vocab_size = int(getattr(self._tokenizer, "vocab_size", 0) or 0)
        for option in options:
            try:
                encoded = self._tokenizer.encode(option, add_special_tokens=False)
            except Exception:
                encoded = []
            token_id = encoded[0] if encoded else None
            if token_id is None or (vocab_size and token_id >= vocab_size):
                token_id = None
            ids.append(token_id)
        return ids

    def decide(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> TypedDecision:
        self._load()  # raises ShadowHeadDependencyError before any mlx import
        import mlx.core as mx  # lazy: optional dependency

        started = time.time()

        prompt_ids = self._tokenizer.encode(state_text, add_special_tokens=True)
        # One prefill of the state; the final-position logit column is all
        # each option's first-token score needs.
        logits = self._model(mx.array([prompt_ids]))[0, -1, :].tolist()  # (vocab,)

        choices: Dict[str, Choice] = {}
        for question in questions:
            options = list(question.options)
            if question.name.endswith("_target") and len(options) > self.max_target_options:
                options = options[: self.max_target_options]
            token_ids = self._option_token_ids(options)
            scores: List[float] = []
            for option, token_id in zip(options, token_ids):
                if token_id is None:
                    scores.append(float("-inf"))
                else:
                    scores.append(float(logits[token_id]))
            choices[question.name] = choice_from_scores(question.name, options, scores)

        latency_ms = (time.time() - started) * 1000.0
        decision = TypedDecision(
            choices=choices,
            latency_ms=latency_ms,
            model_id=f"mlx-direct-logit:{self.model_repo}@{self.revision or 'default'}",
        )
        decision.validate()
        return decision


def build_default_head() -> DecisionHead:
    """The production shadow head (mlx-lm direct-logit, Qwen3.5-4B class)."""
    return MlxDirectLogitHead()


# ---------------------------------------------------------------------------
# Tier C: kimi CLI subprocess head (cloud-iteration tier)
# ---------------------------------------------------------------------------

_KIMI_BIN_ENV_VAR = "SHADOW_HEAD_KIMI_BIN"


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    """Pull the first JSON object out of CLI output that may carry banners,
    bullet prefixes, thinking markers, and a resume-session footer."""
    start = text.find("{")
    while start != -1:
        try:
            obj, _ = json.JSONDecoder().raw_decode(text[start:])
        except json.JSONDecodeError:
            start = text.find("{", start + 1)
            continue
        if isinstance(obj, dict):
            return obj
        start = text.find("{", start + 1)
    return None


class KimiCliHead:
    """Cloud-iteration decision head: one ``kimi -p "<prompt>"`` subprocess
    per decision pass, exactly how gizzi's kimi-cli provider drives the CLI.

    Auth/OAuth/token refresh stays entirely inside the CLI — this head never
    touches credentials and adds no package dependency (``kimi`` is a CLI on
    PATH, verified with ``shutil.which`` at construction).

    kimi returns one confidence scalar, not a per-option distribution: the
    chosen option gets ``confidence``, the rest split the remainder uniformly.
    Per-option distributions are an mlx/local-tier property; this shape is
    documented as a cloud-tier trade-off.

    Two questioning modes, both behind the same DecisionHead protocol:

    - ``batched``: all questions (operation + speculative per-operation
      targets + goal_satisfied + stuck) in one subprocess call per step.
    - ``sequential``: pass 1 asks the operation choice plus the boolean
      gates (small menus), pass 2 asks only the chosen operation's target
      menu — 2 subprocess calls per step, smaller menus per pass.

    Live-trajectory retrieval (``trajectory=True``): the head additionally
    implements two duck-typed run-lifecycle hooks the planning loop calls
    when present — ``begin_run(task_id)`` at run start (per-task reset; the
    head instance is shared across tasks in the eval) and
    ``note_prior_step(step_num, summary)`` after each shadow decision. Its
    own prior proposals for the current run are rendered as an [ACTIONS SO
    FAR THIS RUN] block inside [STATE], explicitly labeled as shadow-mode
    proposals that were NEVER EXECUTED, each with a one-line delta summary
    ([SINCE LAST STEP] counts). History is capped at the last
    ``_TRAJECTORY_HISTORY_CAP`` steps. Inference-only: no training, no
    weights, still one ``kimi -p`` subprocess per pass. The reported
    model_id gains a ``:traj`` suffix while the trajectory has content.

    ``few_shot_block`` optionally carries a pre-rendered exemplar block
    (selected from train-split Tier A traces, never the held-out eval tasks)
    injected before ``[STATE]`` — prompt-space distillation; the JSON answer
    contract is unchanged.

    Answers follow a strict JSON contract (question-id -> {answer,
    confidence}); parse failures retry once with a repair prompt, then the
    question records a miss and falls back to a uniform choice — the eval
    never crashes on a bad answer. Non-canonical operation answers (legacy
    aliases like ``input``/``enter``/``key``/``scroll``/``select``) are
    folded to the canonical whitelist name and logged in ``vocab_misses``.
    """

    def __init__(
        self,
        binary: Optional[str] = None,
        questioning: str = "batched",
        timeout_s: float = 240.0,
        max_repair_retries: int = 1,
        model_id: str = "kimi-cli",
        few_shot_block: Optional[str] = None,
        trajectory: bool = False,
    ) -> None:
        self.binary = binary or os.environ.get(_KIMI_BIN_ENV_VAR, "") or "kimi"
        resolved = shutil.which(self.binary)
        if resolved is None:
            raise ShadowHeadDependencyError(
                f"KimiCliHead needs the `kimi` CLI on PATH (or set "
                f"{_KIMI_BIN_ENV_VAR}); looked for {self.binary!r}. Install "
                "Kimi Code CLI and re-authenticate — the head drives "
                "`kimi -p <prompt>` subprocesses and never handles credentials "
                "itself."
            )
        self.binary = resolved
        if questioning not in ("batched", "sequential"):
            raise ValueError(f"questioning must be 'batched' or 'sequential', got {questioning!r}")
        self.questioning = questioning
        self.timeout_s = float(timeout_s)
        self.max_repair_retries = int(max_repair_retries)
        self.model_id = model_id + (f":{questioning}" if questioning != "batched" else "")
        # Optional pre-rendered few-shot exemplar block (prompt-space
        # distillation from train-split traces; core/kimi_fewshot.py renders
        # it). Injected before [STATE]; None keeps the zero-shot prompt.
        self.few_shot_block = few_shot_block
        if few_shot_block:
            self.model_id += ":fewshot"
        # Base id — the reported model_id is derived per decision pass so the
        # :traj suffix reflects whether the trajectory block has content.
        self._base_model_id = self.model_id
        # Live-trajectory retrieval: accumulate this run's own prior
        # proposals (via the duck-typed begin_run / note_prior_step hooks the
        # planning loop calls when present) and render them into the prompt.
        self.trajectory_enabled = bool(trajectory)
        self._run_steps: List[Dict[str, Any]] = []
        self._run_label: str = ""
        # Every non-canonical / out-of-vocab answer, for the vocab-miss metric.
        self.vocab_misses: List[Dict[str, Any]] = []

    # ── run lifecycle (duck-typed hooks; the DecisionHead protocol is
    # unchanged) ─────────────────────────────────────────────────────────

    def begin_run(self, task_id: str) -> None:
        """Planning-loop hook: a new run started. Per-task reset of the
        trajectory history — the head instance is shared across tasks in the
        eval, so proposals from a previous run must never leak into the
        next task's prompt. ``task_id`` is the loop's session identifier
        (carries the eval's task id, e.g. "shadow-search-flow")."""
        self._run_steps = []
        self._run_label = str(task_id)

    def note_prior_step(self, step_num: int, summary: Dict[str, Any]) -> None:
        """Planning-loop hook: one shadow decision was logged. ``summary``
        carries the head's own proposal (operation, target, gate answers)
        plus that step's element-delta summary. No-op unless trajectory mode
        is enabled — with trajectory off the head behaves exactly as before."""
        if not self.trajectory_enabled:
            return
        entry = dict(summary)
        entry["step"] = int(step_num)
        self._run_steps.append(entry)

    # ── subprocess ───────────────────────────────────────────────────────

    def _call_cli(self, prompt: str) -> Tuple[str, float]:
        """One `kimi -p` call; returns (stdout, elapsed_ms)."""
        started = time.time()
        try:
            result = subprocess.run(
                [self.binary, "-p", prompt],
                capture_output=True,
                text=True,
                timeout=self.timeout_s,
            )
        except subprocess.TimeoutExpired as exc:
            raise ShadowHeadError(
                f"kimi CLI timed out after {self.timeout_s:.0f}s"
            ) from exc
        elapsed_ms = (time.time() - started) * 1000.0
        if result.returncode != 0:
            raise ShadowHeadError(
                f"kimi CLI exited {result.returncode}: "
                f"{(result.stderr or result.stdout or '').strip()[:500]}"
            )
        return result.stdout or "", elapsed_ms

    # ── prompt ───────────────────────────────────────────────────────────

    # Cap on prior-step entries rendered into [ACTIONS SO FAR THIS RUN];
    # bounds prompt growth on long runs.
    _TRAJECTORY_HISTORY_CAP = 10

    @staticmethod
    def _questions_block(questions: Sequence[Question]) -> str:
        lines = []
        for q in questions:
            options = ", ".join(str(o) for o in q.options[:64])
            if len(q.options) > 64:
                options += ", …"
            lines.append(f"{q.name}: {options}")
        return "\n".join(lines)

    def _trajectory_block(self) -> str:
        """Render this run's own prior proposals for [ACTIONS SO FAR THIS
        RUN], or "" when the trajectory is empty/ disabled.

        Labeled explicitly as the head's OWN PRIOR PROPOSALS in shadow mode
        — they were logged, never executed, so the model must not treat them
        as things that happened on the page.
        """
        if not self.trajectory_enabled or not self._run_steps:
            return ""
        history = self._run_steps[-self._TRAJECTORY_HISTORY_CAP:]
        lines = [
            "[ACTIONS SO FAR THIS RUN]",
            "These are THIS DECISION HEAD'S OWN PRIOR PROPOSALS for earlier "
            "steps of this run. Shadow mode: they were LOGGED ONLY and NEVER "
            "EXECUTED — the page did not necessarily change the way they "
            "describe. Decide from the CURRENT observed elements and the "
            "change since the last step, not from assuming these happened.",
        ]
        for entry in history:
            operation = entry.get("operation") or "?"
            target = entry.get("target")
            target_text = f" target {target}" if target is not None else ""
            delta = entry.get("delta") or {}
            delta_text = delta.get("text") if isinstance(delta, dict) else None
            lines.append(
                f"step {entry['step']}: proposed {operation}{target_text}"
                f" — {delta_text or 'delta unreported'}"
            )
        omitted = len(self._run_steps) - len(history)
        if omitted > 0:
            lines.append(f"(... {omitted} earlier proposed steps omitted)")
        return "\n".join(lines)

    def _inject_trajectory(self, state_text: str) -> str:
        """Insert [ACTIONS SO FAR THIS RUN] between [TASK] and
        [SINCE LAST STEP] (the canonical shadow state layout)."""
        block = self._trajectory_block()
        if not block:
            return state_text
        marker = "\n\n[SINCE LAST STEP]"
        if marker in state_text:
            return state_text.replace(marker, f"\n\n{block}{marker}", 1)
        return state_text + f"\n\n{block}"

    def _prompt(
        self,
        state_text: str,
        questions: Sequence[Question],
        repair_of: Optional[str] = None,
    ) -> str:
        block = self._questions_block(questions)
        example_keys = ", ".join(
            f'"{q.name}": {{"answer": "<one of: {q.options[0]}>", "confidence": 0.8}}'
            for q in questions[:2]
        )
        repair = (
            "\nYour previous answer failed to parse. This time return ONLY the "
            "JSON object — no prose, no markdown fences, no explanation.\n"
            if repair_of is not None else ""
        )
        few_shot = (
            f"{self.few_shot_block}\n\n"
            if self.few_shot_block else ""
        )
        return (
            "You are the shadow decision head for a browser automation loop.\n"
            f"{repair}"
            f"{few_shot}"
            "[STATE]\n"
            f"{self._inject_trajectory(state_text)}\n\n"
            "Answer the closed-set questions below. Each answer must be the "
            "EXACT option string from that question's list — never invent "
            "names, synonyms, or new options.\n\n"
            f"[QUESTIONS]\n{block}\n\n"
            "Respond with a single JSON object only. It MUST contain exactly "
            "one key for EVERY question id listed above — no omissions, no "
            "extra keys — each mapping to an object with \"answer\" (one of "
            "the exact option strings for that question) and \"confidence\" "
            "(a number between 0 and 1). Shape:\n"
            f"{{{example_keys}}}\n\n"
            "The JSON object only — no prose, no markdown fences.\n"
        )

    # ── answer handling ──────────────────────────────────────────────────

    def _choice_from_answer(
        self,
        question: Question,
        raw_answer: Any,
        raw_confidence: Any,
    ) -> Choice:
        answer, miss_kind = _canonicalize_answer(question, raw_answer)
        if miss_kind is not None:
            self.vocab_misses.append({
                "question": question.name,
                "raw": str(raw_answer).strip(),
                "kind": miss_kind,
            })
            logger.warning(
                "vocab miss (%s) on %r: %r",
                miss_kind,
                question.name,
                str(raw_answer).strip(),
            )
        if answer not in question.options:
            # Out-of-vocab (or unrepaired): uniform fallback — never crash.
            n = len(question.options)
            return Choice(
                question=question.name,
                chosen=question.options[0],
                probabilities={option: 1.0 / n for option in question.options},
                confidence=0.0,
            )
        try:
            confidence = min(1.0, max(0.0, float(raw_confidence)))
        except (TypeError, ValueError):
            confidence = 0.5
        remainder = 1.0 - confidence
        others = [o for o in question.options if o != answer]
        per_other = remainder / len(others) if others else 0.0
        return Choice(
            question=question.name,
            chosen=answer,
            probabilities={option: (confidence if option == answer else per_other)
                           for option in question.options},
            confidence=confidence,
        )

    def _ask(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> Tuple[Dict[str, Choice], float]:
        """One questioning pass: prompt the CLI, parse the JSON contract,
        repair-retry once on failure, fall back to uniform on a dead answer."""
        latency_ms = 0.0
        prompt = self._prompt(state_text, questions)
        parsed: Optional[Dict[str, Any]] = None
        last_output = ""
        for attempt in range(self.max_repair_retries + 1):
            output, elapsed = self._call_cli(prompt if attempt == 0 else self._prompt(state_text, questions, repair_of=last_output))
            latency_ms += elapsed
            last_output = output
            parsed = _extract_json_object(output)
            if parsed is not None:
                break
            logger.warning(
                "kimi answer failed to parse (attempt %d/%d)",
                attempt + 1,
                self.max_repair_retries + 1,
            )
        choices: Dict[str, Choice] = {}
        for question in questions:
            entry = parsed.get(question.name) if parsed else None
            if not isinstance(entry, dict) or "answer" not in entry:
                # Missing/unparseable question: uniform fallback, counted as a
                # parse miss so the metric reflects dead answers.
                self.vocab_misses.append({
                    "question": question.name,
                    "raw": None,
                    "kind": "parse_miss",
                })
                n = len(question.options)
                choices[question.name] = Choice(
                    question=question.name,
                    chosen=question.options[0],
                    probabilities={option: 1.0 / n for option in question.options},
                    confidence=0.0,
                )
                continue
            choices[question.name] = self._choice_from_answer(
                question, entry.get("answer"), entry.get("confidence"),
            )
        return choices, latency_ms

    # ── DecisionHead protocol ────────────────────────────────────────────

    def decide(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> TypedDecision:
        started = time.time()
        questions = list(questions)
        if self.questioning == "sequential":
            choices = self._decide_sequential(state_text, questions)
        else:
            choices, _ = self._ask(state_text, questions)
        latency_ms = (time.time() - started) * 1000.0
        # :traj suffix while the run's trajectory has content, so report
        # stems and shadow.decision events distinguish trajectory runs.
        model_id = self._base_model_id + (":traj" if self._run_steps else "")
        decision = TypedDecision(
            choices=choices,
            latency_ms=latency_ms,
            model_id=model_id,
        )
        decision.validate()
        return decision

    def _decide_sequential(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> Dict[str, Choice]:
        """Category first: the operation choice + boolean gates in pass 1,
        then only the chosen operation's target menu in pass 2 (2 calls/step).
        Speculative target questions for the non-chosen operations are not
        asked (and not fabricated) — the harness only consumes the chosen
        operation's target anyway."""
        by_name = {q.name: q for q in questions}
        op_question = by_name.get("operation")
        if op_question is None:
            # No operation question — degrade to a single batched pass.
            choices, _ = self._ask(state_text, questions)
            return choices
        pass1 = [op_question] + [
            q for q in questions if q.name in ("goal_satisfied", "stuck")
        ]
        choices, _ = self._ask(state_text, pass1)
        chosen_op = choices[op_question.name].chosen
        target_question = by_name.get(f"{chosen_op}_target")
        if target_question is not None:
            target_choices, _ = self._ask(state_text, [target_question])
            choices.update(target_choices)
        return choices
