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
import logging
import math
import os
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
DEFAULT_REVISION: Optional[str] = None
_REVISION_ENV_VAR = "SHADOW_HEAD_REVISION"

_MAX_TARGET_OPTIONS = 64


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
        self.revision = revision or DEFAULT_REVISION or env_revision or None
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
