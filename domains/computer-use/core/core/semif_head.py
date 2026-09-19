"""
Allternit Computer Use — SemIf shadow decision head

``SemIfHead`` adapts SemIf — the community open-weights System One
reproduction (https://github.com/TheoLeeCJ/SemIf, formerly OpenJev, MIT) —
to the ``DecisionHead`` protocol, as the local-tier retrofit candidate
measured head-to-head against ``MlxDirectLogitHead`` and ``KimiCliHead``.

SemIf's readout is the same family as our mlx head (declared-option
first-token logits, softmax across options, no generated answer text), so
the mapping is close:

- our per-step ``state_text`` becomes SemIf's ``row["state"]`` (verbatim —
  the canonical [TASK]/[SINCE LAST STEP]/[OBSERVED ELEMENTS]/[OPTIONS]
  format is SemIf's "unstructured evidence");
- each of our ``Question`` objects becomes one SemIf row
  (``{id, state, question, options: [{id, description}]}``); options are
  letter-coded A–P by SemIf (a hard 2–16 cap — target menus truncate at 16,
  vs the mlx head's 64);
- ALL questions for one state are scored in ONE SemIf pass via
  ``mlx_backend.score_shared`` — one prefill of the shared state prefix,
  then a single batched forward over the per-question suffixes. This is
  SemIf's selling point (parallel shared-state decisions) and matches our
  one-pass ``decide()`` contract exactly;
- per-option probabilities come back aligned with the option list;
  ``chosen`` is the argmax and ``confidence`` uses the same
  ``entropy_confidence`` convention as ``MlxDirectLogitHead`` — SemIf
  returns no separate confidence and labels its scores "conditional option
  score; uncalibrated as decision confidence".

The mlx backend of SemIf supports ONLY native Qwen3.5 text checkpoints
(``model_type == "qwen3_5"``; its loader hard-rejects everything else) and
requires a pinned 40-hex revision. The reference pin is
``Qwen/Qwen3.5-4B@851bf6e8...`` (public, ungated; ~9 GB BF16 including the
vision tensors the text sanitizer drops). ``bits=4``/``8`` applies
deterministic in-memory affine quantization instead of downloading a
separate artifact. SemIf's README also names MiniCPM5-2B — that is the
web-demo (GGUF) ladder only; the mlx backend refuses that checkpoint.

SemIf is an OPTIONAL dependency (git install, see the ``semif`` extra in
pyproject.toml): importing this module never requires it, and constructing
the head without it raises a clear, actionable
``ShadowHeadDependencyError``.
"""

from __future__ import annotations

import importlib.util
import logging
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .decision_head import (
    Choice,
    DecisionValidationError,
    Question,
    ShadowHeadDependencyError,
    ShadowHeadError,
    TypedDecision,
    entropy_confidence,
)

logger = logging.getLogger(__name__)

# SemIf reference pin (its manifests/models.json "direct_option_logits"
# role). Public, ungated HF repo; plain anonymous download.
DEFAULT_MODEL_SOURCE = "Qwen/Qwen3.5-4B"
DEFAULT_REVISION = "851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a"

# SemIf letters A..P (core.LETTERS) — validate_row enforces 2..16 options.
_MAX_SEMIF_OPTIONS = 16


def _criterion(question: Question) -> str:
    """The SemIf row's 'question' field (its 'criterion' in the prompt)."""
    return (
        f"Answer question '{question.name}' for the observed browser state: "
        "choose exactly one of the listed options."
    )


def build_rows(
    questions: Sequence[Question],
    state_text: str,
    max_options: int = _MAX_SEMIF_OPTIONS,
) -> Tuple[List[Question], List[Dict[str, Any]]]:
    """Map our per-step questions to SemIf row dicts.

    Returns (scored_questions, rows): scored_questions parallels rows (a
    question whose menu exceeds ``max_options`` is truncated for scoring,
    same spirit as the mlx head's 64-cap but at SemIf's hard A–P limit).
    SemIf options carry string ids + descriptions; we use the option string
    for both so results map straight back onto our vocabulary. Raises
    ``DecisionValidationError`` for a question with fewer than two options —
    SemIf's validator requires 2..16 and a single-option menu is a caller
    bug, not a scoreable decision.
    """
    scored: List[Question] = []
    rows: List[Dict[str, Any]] = []
    for question in questions:
        options = list(question.options)
        if len(options) < 2:
            raise DecisionValidationError(
                f"question {question.name!r}: SemIf needs >= 2 options, "
                f"got {len(options)}"
            )
        if len(options) > max_options:
            logger.debug(
                "SemIf row %r: truncating %d options to %d (A–P cap)",
                question.name, len(options), max_options,
            )
            options = options[:max_options]
            question = Question(name=question.name, options=options)
        scored.append(question)
        rows.append({
            "id": question.name,
            "state": state_text,
            "question": _criterion(question),
            "options": [
                {"id": option, "description": option} for option in options
            ],
        })
    return scored, rows


def choices_from_results(
    rows: Sequence[Dict[str, Any]],
    results: Sequence[Dict[str, Any]],
) -> Dict[str, Choice]:
    """Build validated Choices from SemIf shared-mode results (by row id).

    ``results`` entries carry ``option_ids`` (aligned with the row's
    options) and ``probabilities`` (softmax over the letter-slot logits).
    SemIf returns no confidence scalar — confidence is our entropy-based
    convention, identical to ``MlxDirectLogitHead``.
    """
    by_id = {result["id"]: result for result in results}
    choices: Dict[str, Choice] = {}
    for row in rows:
        result = by_id.get(row["id"])
        if result is None:
            raise ShadowHeadError(
                f"SemIf returned no result for question {row['id']!r}"
            )
        option_ids = list(result.get("option_ids", []))
        probabilities = [float(p) for p in result.get("probabilities", [])]
        if len(option_ids) != len(probabilities) or not option_ids:
            raise ShadowHeadError(
                f"SemIf result for {row['id']!r}: {len(probabilities)} "
                f"probabilities for {len(option_ids)} options"
            )
        distribution = {
            option: probability
            for option, probability in zip(option_ids, probabilities)
        }
        chosen = max(distribution, key=distribution.get)
        choices[row["id"]] = Choice(
            question=row["id"],
            chosen=chosen,
            probabilities=distribution,
            confidence=entropy_confidence(list(distribution.values())),
        )
    return choices


class SemIfHead:
    """SemIf (community System One reproduction) behind DecisionHead.

    One ``decide()`` call = one SemIf ``score_shared`` pass: a single
    prefill of the state prefix plus one batched forward over all
    per-question suffixes, returning per-option distributions for every
    question together. Weights load lazily from the pinned public ungated
    HF checkpoint on first use; afterwards inference is fully local.
    SemIf is an optional git dependency — constructing without it raises an
    actionable ``ShadowHeadDependencyError``.
    """

    def __init__(
        self,
        model_source: str = DEFAULT_MODEL_SOURCE,
        revision: Optional[str] = DEFAULT_REVISION,
        bits: Optional[int] = None,
        max_options: int = _MAX_SEMIF_OPTIONS,
    ) -> None:
        if bits not in (None, 4, 8):
            raise ValueError("bits must be None (BF16 source) or 4/8 (in-memory affine quantization)")
        self.model_source = model_source
        self.revision = revision
        self.bits = bits
        self.max_options = max_options
        self._model: Any = None
        self._tokenizer: Any = None
        self._metadata: Optional[Dict[str, Any]] = None

    # ── loading ──────────────────────────────────────────────────────────

    def _require_semif(self) -> None:
        if importlib.util.find_spec("semif_phase1") is None:
            raise ShadowHeadDependencyError(
                "SemIfHead needs the optional 'semif' extra: install with "
                "`uv pip install -e '.[semif]'` (pulls SemIf from "
                "git+https://github.com/TheoLeeCJ/SemIf with its pinned "
                "mlx/mlx-lm runtime). Apple-silicon only; no hosted "
                "fallback exists by design."
            )

    def _load(self) -> None:
        if self._model is not None:
            return
        self._require_semif()
        from semif_phase1 import mlx_backend  # lazy: optional dependency

        logger.info(
            "Loading SemIf head weights from %s (revision=%s, bits=%s) — "
            "first run downloads ~9GB, then fully local",
            self.model_source, self.revision or "default", self.bits,
        )
        try:
            self._model, self._tokenizer, self._metadata = mlx_backend.load_model(
                self.model_source, self.revision or "", self.bits,
            )
        except Exception as exc:
            raise ShadowHeadError(
                f"failed to load SemIf weights from {self.model_source!r} "
                f"(revision={self.revision!r}): {exc}"
            ) from exc

    # ── DecisionHead protocol ────────────────────────────────────────────

    def decide(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> TypedDecision:
        self._load()  # raises ShadowHeadDependencyError before any import
        from semif_phase1 import mlx_backend  # lazy: optional dependency

        scored, rows = build_rows(questions, state_text, self.max_options)
        started = time.time()
        # One state prefill + one batched suffix forward for ALL questions —
        # SemIf's parallel shared-state mode; this is its selling point and
        # matches our single-pass decide() contract.
        results, _timing = mlx_backend.score_shared(
            self._model, self._tokenizer, rows, self._metadata,
        )
        latency_ms = (time.time() - started) * 1000.0

        choices = choices_from_results(rows, results)
        quant = f":q{self.bits}" if self.bits else ""
        decision = TypedDecision(
            choices=choices,
            latency_ms=latency_ms,
            model_id=(
                f"semif:{self.model_source}@{self.revision or 'default'}"
                f"{quant}:shared"
            ),
        )
        decision.validate()
        return decision
