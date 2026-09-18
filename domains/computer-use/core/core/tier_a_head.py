"""
Allternit Computer Use — Tier A Trained Classifier Head

Tier A of the shadow policy head (docs/ACU_SHADOW_HEAD_MAP.md): a trained
151M-class classifier that scores every closed-set option against the state
and replaces the zero-shot prior-guessing of the mlx (0.227 agreement) and
kimi-cli (0.318) heads.

Architecture: ``answerdotai/ModernBERT-base`` (151M params, Apache-2.0,
ungated) as a row-structured (state, option) cross-scorer:

- the state prompt decomposes into a task line plus an indexed element
  table (that is the element-table shape, core/element_table.py);
- the task and each ROW are encoded separately (a row text is short and
  highly distinctive — "status: Searching…" as its own embedding shifts a
  sum of row embeddings far more than it shifts a token-level mean pool,
  which measured ~0.985 cosine between states that need separating);
- the state vector is ``[task_vec ; sum(row_vecs)]`` and each candidate
  option is a vector; state and option are projected to a common dim and
  combined by a bilinear MLP over ``[u; v; u*v]``; softmax across the menu;
  entropy of that distribution is the confidence;
- an explicit ``__abstain__`` pseudo-option is always present and is the
  trained answer for questions whose reference-policy answer is ambiguous
  or missing (speculative target menus for operations the recorded policy
  did not choose, unresolvable targets).

Target options arrive as bare element-table row indices (``"0"``, ``"1"``,
...) per the DecisionHead protocol, so the scorer renders each option as
``"<index> (<role>: <name>)"`` — a bare index carries no semantics to
condition on. The same rendering is used at training time; train and
inference inputs are identical by construction.

The head also VOLUNTEERS a target choice for the operation it picked when
the harness did not ask (its target menus need >= 2 candidate rows; with
exactly one candidate the target is forced, so the question is skipped as
uninteresting, not unanswerable). Without this, a correct ``fill`` proposal
on a single-field page scores target_agree=False purely because the
question was never asked — see docs/TIER_A_NOTES.md.

Runtime: lazy imports behind the optional ``tier-a`` extra (torch CPU +
transformers, no CUDA pins). One fused encoder forward per decision (task +
rows + menu options in a single batch); target < 100 ms/decision on CPU.
Zero network at inference once weights are cached — the one-time HF
download happens at TRAINING time; the trained bundle is saved locally and
loaded from there.

Persistence: the trained model + tokenizer + scorer + learned temperature
scalar live in a local dir (default ``~/.allternit/shadow-head/tier-a``,
override with ``SHADOW_HEAD_TIER_A_DIR``). Missing/untrained dirs raise a
clear, actionable error pointing at ``scripts/tier_a_train.py``.

Training: CE + Brier score over each question menu, AdamW, few epochs
(data is small), early stopping on a held-out val split, temperature scaling
(learned scalar) fit on the same val split, seed fixed. Default regime is a
FROZEN encoder with every unique task/row/option text encoded once into a
cache and only the scorer training — the standard small-data recipe and
minutes on CPU; ``--tune-encoder`` switches to end-to-end fine-tuning for
larger live-trace retraining (measured ~10s/optimizer step on CPU, i.e.
tens of minutes at this data size). CPU-only by design.
"""

from __future__ import annotations

import importlib.util
import json
import logging
import math
import os
import random
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .decision_head import (
    ABSTAIN_OPTION,
    Choice,
    Question,
    ShadowHeadDependencyError,
    ShadowHeadError,
    TypedDecision,
    choice_from_scores,
)

logger = logging.getLogger(__name__)

# Public, ungated, Apache-2.0 HF repo (ModernBERT-base, 151M params).
TIER_A_BASE_MODEL = "answerdotai/ModernBERT-base"

_TIER_A_DIR_ENV_VAR = "SHADOW_HEAD_TIER_A_DIR"
DEFAULT_TIER_A_DIR = Path.home() / ".allternit" / "shadow-head" / "tier-a"

_HEAD_STATE_FILE = "tier_a_head.pt"
_STUB_TOKENIZER_FILE = "tier_a_tokenizer_stub.json"
_MAX_STATE_TOKENS = 384
_MAX_OPTION_TOKENS = 32
_POOL_FACTOR = 2  # mean + max pooling concatenated per encoded text
_KIND_GATE = "gate"
_KIND_OPERATION = "operation"
_KIND_TARGET = "target"


def default_model_dir() -> Path:
    """The trained-weights dir: env override, else the default local dir."""
    override = os.environ.get(_TIER_A_DIR_ENV_VAR, "").strip()
    return Path(override) if override else DEFAULT_TIER_A_DIR


def _require_tier_a_deps() -> None:
    missing = [
        module for module in ("torch", "transformers")
        if importlib.util.find_spec(module) is None
    ]
    if missing:
        raise ShadowHeadDependencyError(
            "TierAClassifierHead needs the optional 'tier-a' extra "
            "(torch CPU + transformers): install with "
            "`uv pip install 'allternit-computer-use[tier-a]'` or "
            "`uv pip install torch transformers`. Missing: "
            f"{', '.join(missing)}. No hosted fallback exists by design."
        )


# ---------------------------------------------------------------------------
# State decomposition + option rendering (shared by training-data prep and
# inference — the two MUST produce byte-identical scorer inputs)
# ---------------------------------------------------------------------------

def observed_rows_from_state(state_text: str) -> Dict[str, Tuple[str, str]]:
    """Parse the ``[OBSERVED ELEMENTS]`` block into {index: (role, name)}.

    Lines render as ``[<id>] <role>: <name>`` (core/element_table.py
    ``to_prompt_text``); the table index is the depth-first position, so rows
    are keyed by position as well as by the literal id (which may be an
    ``@eN`` ref when the refmap assigned one — the DecisionHead target
    options are always plain indices, so the positional key is what the
    scorer looks up).
    """
    rows: Dict[str, Tuple[str, str]] = {}
    in_block = False
    position = 0
    for line in state_text.splitlines():
        stripped = line.strip()
        if stripped == "[OBSERVED ELEMENTS]":
            in_block = True
            continue
        if not in_block:
            continue
        if not (stripped.startswith("[") and "] " in stripped and ": " in stripped):
            # Anything that is not a row line ends the block ([OPTIONS]...).
            if stripped.startswith("["):
                in_block = False
            continue
        ident, rest = stripped[1:].split("] ", 1)
        role, name = rest.split(": ", 1)
        rows[str(position)] = (role.strip(), name.strip())
        if ident.strip().isdigit():
            rows[ident.strip()] = (role.strip(), name.strip())
        position += 1
    return rows


def state_task_text(state_text: str) -> str:
    """The task line out of the [TASK] block ("" when absent)."""
    lines = state_text.splitlines()
    for i, line in enumerate(lines):
        if line.strip() == "[TASK]" and i + 1 < len(lines):
            return lines[i + 1].strip()
    return ""


def row_texts(state_text: str) -> List[str]:
    """Each observed row rendered as its own short scoring text."""
    rows = observed_rows_from_state(state_text)
    return [
        f"[{index}] {rows[index][0]}: {rows[index][1] or '(unnamed)'}"
        for index in sorted(rows, key=lambda k: int(k))
    ]


def split_row_texts(state_text: str) -> Tuple[List[str], List[str]]:
    """Rows rendered as scoring texts, split by kind: (status, control).

    Control rows support closed-set operations (core/element_table
    ROLE_OPERATIONS); everything else — window chrome, static text, phase
    markers — is status. The split matters architecturally: "no status
    rows" becomes a ZERO block in the state vector (maximally separable)
    instead of a ~10% dilution of one summed embedding (measured ~0.994
    cosine between states that must be separated).
    """
    from .element_table import ROLE_OPERATIONS

    rows = observed_rows_from_state(state_text)
    status, control = [], []
    for index in sorted(rows, key=lambda k: int(k)):
        role, name = rows[index]
        text = f"[{index}] {role}: {name or '(unnamed)'}"
        (control if role in ROLE_OPERATIONS else status).append(text)
    return status, control


def option_label(question_name: str, option: str, rows: Dict[str, Tuple[str, str]]) -> str:
    """The exact text the scorer encodes for one menu option.

    Target options are row indices; without the row description the index is
    semantically empty, so it is rendered inline. Everything else (operation
    names, gate booleans) carries its own meaning; the question name prefixes
    every option so gate menus (``true``/``false``) are distinguishable.
    """
    if question_name.endswith("_target"):
        row = rows.get(str(option))
        detail = f"{row[0]}: {row[1]}" if row else "unknown row"
        return f"{question_name} | option {option} ({detail})"
    return f"{question_name} | {option}"


def question_kind(question_name: str) -> str:
    if question_name == "operation":
        return _KIND_OPERATION
    if question_name.endswith("_target"):
        return _KIND_TARGET
    return _KIND_GATE


# ---------------------------------------------------------------------------
# Offline tokenizer stub — test/smoke path only, no downloads anywhere
# ---------------------------------------------------------------------------

class TinyHashTokenizer:
    """Deterministic hashing tokenizer with the transformers call shape.

    Offline stand-in for tests and train/eval smoke runs: encodes text to
    stable token ids by hashing whitespace-delimited words, pads/truncates
    like a real fast tokenizer, and persists via ``save_pretrained`` (a stub
    marker json the loader recognizes). NEVER used in production — the real
    ModernBERT tokenizer is loaded from the trained bundle.
    """

    def __init__(self, vocab_size: int = 512, model_max_length: int = 512) -> None:
        self.vocab_size = int(vocab_size)
        self.model_max_length = int(model_max_length)

    def _encode_one(self, text: str, max_length: Optional[int]) -> List[int]:
        limit = max_length or self.model_max_length
        ids = [
            1 + (hash(word) % (self.vocab_size - 1))
            for word in str(text).split()
        ][:limit]
        return ids or [0]

    def __call__(
        self,
        texts: Any,
        truncation: bool = False,
        max_length: Optional[int] = None,
        padding: bool = True,
        return_tensors: Optional[str] = None,
    ) -> Dict[str, Any]:
        if isinstance(texts, str):
            texts = [texts]
        encoded = [self._encode_one(t, max_length if truncation else None) for t in texts]
        width = max(len(ids) for ids in encoded)
        input_ids, attention_mask = [], []
        for ids in encoded:
            pad = width - len(ids)
            input_ids.append(ids + [0] * pad)
            attention_mask.append([1] * len(ids) + [0] * pad)
        return {"input_ids": input_ids, "attention_mask": attention_mask}

    def save_pretrained(self, directory: str) -> None:
        Path(directory).mkdir(parents=True, exist_ok=True)
        (Path(directory) / _STUB_TOKENIZER_FILE).write_text(
            json.dumps({"vocab_size": self.vocab_size}), encoding="utf-8"
        )


def _load_tokenizer(model_dir: Path) -> Any:
    stub = model_dir / _STUB_TOKENIZER_FILE
    if stub.exists():
        return TinyHashTokenizer(vocab_size=json.loads(stub.read_text())["vocab_size"])
    from transformers import AutoTokenizer

    return AutoTokenizer.from_pretrained(str(model_dir))


# ---------------------------------------------------------------------------
# Torch pieces (all lazy — importing this module never requires torch)
# ---------------------------------------------------------------------------

def _encode(
    model: Any,
    tokenizer: Any,
    texts: Sequence[str],
    max_length: int,
    device: str,
    grad: bool = False,
) -> Any:
    """Mean+max pooling of the final hidden state, (B, 2H).

    Mean pooling washes out single salient tokens (a one-row phase signal
    measured ~0.985 cosine to every other state); max pooling surfaces
    them. ``grad=False`` runs under ``no_grad`` (inference/eval); training
    passes ``grad=True`` so the loss backpropagates through the encoder.
    """
    import torch

    enc = tokenizer(
        list(texts),
        truncation=True,
        max_length=max_length,
        padding=True,
        return_tensors="pt",
    )
    input_ids = torch.as_tensor(enc["input_ids"]).to(device)
    attention_mask = torch.as_tensor(enc["attention_mask"]).to(device)
    ctx = torch.enable_grad() if grad else torch.no_grad()
    with ctx:
        hidden = model(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
    mask = attention_mask.unsqueeze(-1).to(hidden.dtype)
    mean = (hidden * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1)
    neg = torch.finfo(hidden.dtype).min
    masked = hidden.masked_fill(attention_mask.unsqueeze(-1) == 0, neg)
    return torch.cat([mean, masked.max(dim=1).values], dim=-1)


def _make_scorer(u_dim: int, v_dim: int, device: str) -> Any:
    """Row-structured option scorer.

    State (u, u_dim) and option (v, v_dim) vectors are projected to a
    small common dim, then scored by an MLP over ``[u; v; u*v]`` — a
    bilinear interaction so the model can condition the option's semantics
    on the state's content. The inner dim is deliberately SMALL (256): the
    scorer sees a few hundred distinct training groups, and a wide inner
    layer (measured at 4608 -> a 63M-param fc1) both explodes CPU cost
    per step and overfits noise. ``abstain_bias`` is a learned scalar added
    to the abstain pseudo-option's score (always the LAST menu entry).
    """
    import torch
    from torch import nn

    class _Scorer(nn.Module):
        def __init__(self, u_in: int, v_in: int, dim: int = 256) -> None:
            super().__init__()
            self.u_proj = nn.Linear(u_in, dim)
            self.v_proj = nn.Linear(v_in, dim)
            self.fc1 = nn.Linear(dim * 3, dim)
            self.fc2 = nn.Linear(dim, 1)
            self.abstain_bias = nn.Parameter(torch.zeros(1))

        def forward(self, u: Any, v: Any) -> Any:
            up = torch.tanh(self.u_proj(u))
            vp = torch.tanh(self.v_proj(v))
            z = torch.cat([up, vp, up * vp], dim=-1)
            return self.fc2(torch.tanh(self.fc1(z))).squeeze(-1)

    return _Scorer(u_dim, v_dim).to(device)


def _score_menus(
    encode: Any,
    scorer: Any,
    tasks: Sequence[str],
    status_per_group: Sequence[Sequence[str]],
    control_per_group: Sequence[Sequence[str]],
    menus: Sequence[Sequence[str]],
    temperature: float,
) -> List[Any]:
    """Score every option of every menu; abstain bias on the LAST entry of
    each menu (the abstain pseudo-option is always appended last). Returns
    one score tensor per menu.

    ``encode`` maps (texts, max_length) -> (B, 2H) — eager encoding
    (end-to-end training / inference) or the frozen-encoder cache. The
    state vector is ``[task_vec ; sum(status_vecs) ; sum(control_vecs)]``:
    the status block is ZERO at unmarked states and a distinctive clustered
    vector at phase-marked states, which keeps "no status rows" — a real
    decision signal — maximally separable (plain sum/mean pooling over all
    rows measured ~0.994 cosine between states that must be separated).
    """

    task_vecs = encode(list(tasks), _MAX_STATE_TOKENS)
    all_status = [row for rows in status_per_group for row in rows]
    all_control = [row for rows in control_per_group for row in rows]
    if all_status or all_control:
        status_vecs = encode(all_status, _MAX_OPTION_TOKENS) if all_status else None
        control_vecs = encode(all_control, _MAX_OPTION_TOKENS) if all_control else None
    else:
        status_vecs = control_vecs = None
    flat = [label for menu in menus for label in menu]
    option_vecs = encode(flat, _MAX_OPTION_TOKENS)

    result: List[Any] = []
    status_offset, control_offset, opt_offset = 0, 0, 0
    for i, menu in enumerate(menus):
        s_rows = status_per_group[i]
        c_rows = control_per_group[i]
        status_block = (
            status_vecs[status_offset : status_offset + len(s_rows)].sum(dim=0, keepdim=True)
            if s_rows else torch_zeros_like(task_vecs[i].unsqueeze(0))
        )
        control_block = (
            control_vecs[control_offset : control_offset + len(c_rows)].sum(dim=0, keepdim=True)
            if c_rows else torch_zeros_like(task_vecs[i].unsqueeze(0))
        )
        status_offset += len(s_rows)
        control_offset += len(c_rows)
        u = torch_cat_dim(
            torch_cat_dim(task_vecs[i].unsqueeze(0), status_block, dim=1),
            control_block, dim=1,
        )
        group_options = option_vecs[opt_offset : opt_offset + len(menu)]
        opt_offset += len(menu)
        pair = scorer(u.expand(len(menu), -1), group_options).squeeze(-1) / temperature
        stacked = torch_cat_keep_grad(pair[:-1], pair[-1:] + scorer.abstain_bias)
        result.append(stacked)
    return result


class _EncoderCache:
    """Encodes each unique text exactly once (frozen-encoder training path).

    Tasks, rows, and option labels repeat heavily across groups; a 151M
    encoder forward on CPU is the bottleneck, so cache (text, max_length)
    -> vector and serve repeats from memory. Encoding is deterministic
    (model in eval mode, no dropout) so caching is exact.
    """

    def __init__(self, model: Any, tokenizer: Any, device: str) -> None:
        self._model = model
        self._tokenizer = tokenizer
        self._device = device
        self._cache: Dict[Any, Any] = {}

    def __call__(self, texts: Sequence[str], max_length: int) -> Any:
        import torch

        missing = [t for t in dict.fromkeys(texts) if (t, max_length) not in self._cache]
        if missing:
            vectors = _encode(
                self._model, self._tokenizer, missing, max_length, self._device,
            )
            for text, row in zip(missing, vectors):
                self._cache[(text, max_length)] = row
        return torch.stack([self._cache[(t, max_length)] for t in texts])


# ---------------------------------------------------------------------------
# Training data groups
# ---------------------------------------------------------------------------

def groups_from_traces(traces: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Flatten trace records into per-question scoring groups.

    One group = (task text, status rows, control rows, menu of rendered
    option labels with the abstain pseudo-option appended last, gold index
    into that menu). Gold comes from the trace's ``gold`` map; a question
    missing from the map (speculative target menus the recorded policy never
    answered) trains as abstain. All rendered inputs derive from the
    recorded raw state, the same input decide() sees at inference.
    """
    groups: List[Dict[str, Any]] = []
    for record in traces:
        raw_state = record["state_text"]
        rows = observed_rows_from_state(raw_state)
        task = state_task_text(raw_state)
        status_rows, control_rows = split_row_texts(raw_state)
        gold_map = record.get("gold", {})
        for question in record["questions"]:
            name = question["name"]
            options = [str(o) for o in question["options"]]
            menu = [option_label(name, o, rows) for o in options]
            menu.append(option_label(name, ABSTAIN_OPTION, rows))
            gold_answer = gold_map.get(name, ABSTAIN_OPTION)
            if gold_answer in options:
                gold_index = options.index(gold_answer)
            else:
                gold_index = len(options)  # abstain
            groups.append({
                "task_text": task,
                "status_rows": status_rows,
                "control_rows": control_rows,
                "question": name,
                "kind": question_kind(name),
                "menu": menu,
                "gold_index": gold_index,
            })
    return groups


def _dedupe_groups(groups: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Collapse identical groups into one entry with a frequency weight.
    Variant traces repeat each distinct state many times (3 phases per
    cycle) — deduping cuts optimizer work ~8x with an identical weighted
    objective."""
    seen: Dict[Any, Dict[str, Any]] = {}
    for group in groups:
        key = (
            group["task_text"], tuple(group["status_rows"]),
            tuple(group["control_rows"]), tuple(group["menu"]), group["gold_index"],
        )
        if key in seen:
            seen[key]["weight"] += 1
        else:
            entry = dict(group)
            entry["weight"] = 1
            seen[key] = entry
    return list(seen.values())


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def _group_fields(
    groups: Sequence[Dict[str, Any]],
) -> Tuple[List[str], List[List[str]], List[List[str]], List[List[str]]]:
    return (
        [g["task_text"] for g in groups],
        [list(g["status_rows"]) for g in groups],
        [list(g["control_rows"]) for g in groups],
        [list(g["menu"]) for g in groups],
    )


def _batch_loss(
    encode: Any,
    scorer: Any,
    batch: Sequence[Dict[str, Any]],
    device: str,
    brier_weight: float,
) -> Any:
    """Frequency-weighted CE + brier_weight * Brier over each group's menu."""
    import torch

    tasks, status_rows, control_rows, menus = _group_fields(batch)
    scores = _score_menus(
        encode, scorer, tasks, status_rows, control_rows, menus, temperature=1.0,
    )
    ce_terms, brier_terms, weights = [], [], []
    for group, raw in zip(batch, scores):
        log_probs = torch.log_softmax(raw, dim=-1)
        gold = torch.tensor(group["gold_index"], device=device)
        ce_terms.append(-log_probs[gold])
        probs = torch.softmax(raw, dim=-1)
        one_hot = torch.zeros_like(probs).scatter(0, gold.view(1), 1.0)
        brier_terms.append(((probs - one_hot) ** 2).sum() / raw.numel())
        weights.append(float(group.get("weight", 1)))
    weight_t = torch.tensor(weights, device=device)
    ce = (torch.stack(ce_terms) * weight_t).sum() / weight_t.sum()
    brier = (torch.stack(brier_terms) * weight_t).sum() / weight_t.sum()
    return ce + brier_weight * brier


def _eval_groups(
    encode: Any,
    scorer: Any,
    groups: Sequence[Dict[str, Any]],
    device: str,
    temperature: float = 1.0,
) -> Dict[str, Any]:
    """Val metrics: CE, Brier, accuracy overall + per question kind."""
    import torch

    total_ce, total_brier, correct = 0.0, 0.0, 0
    total_weight = 0.0
    by_kind: Dict[str, Dict[str, Any]] = {}
    abstains = 0
    for start in range(0, len(groups), 32):
        chunk = groups[start : start + 32]
        tasks, status_rows, control_rows, menus = _group_fields(chunk)
        all_scores = _score_menus(
            encode, scorer, tasks, status_rows, control_rows, menus, temperature,
        )
        for group, raw in zip(chunk, all_scores):
            weight = float(group.get("weight", 1))
            total_weight += weight
            scores_t = raw.detach()
            log_probs = torch.log_softmax(scores_t, dim=-1)
            probs = torch.softmax(scores_t, dim=-1)
            gold = torch.tensor(group["gold_index"], device=device)
            total_ce += weight * float(-log_probs[gold])
            one_hot = torch.zeros_like(probs).scatter(0, gold.view(1), 1.0)
            total_brier += weight * float(((probs - one_hot) ** 2).sum() / raw.numel())
            predicted = int(torch.argmax(probs).item())
            if predicted == group["gold_index"]:
                correct += weight
            if predicted == raw.numel() - 1:
                abstains += weight
            stats = by_kind.setdefault(
                group["kind"], {"n": 0.0, "correct": 0.0}
            )
            stats["n"] += weight
            stats["correct"] += weight * int(predicted == group["gold_index"])
    n = max(1e-9, total_weight)
    return {
        "ce": total_ce / n,
        "brier": total_brier / n,
        "accuracy": correct / n,
        "abstain_rate": abstains / n,
        "per_kind": {
            kind: {"n": round(s["n"], 1), "accuracy": s["correct"] / s["n"]}
            for kind, s in by_kind.items()
        },
    }


def _fit_temperature(
    encode: Any,
    scorer: Any,
    groups: Sequence[Dict[str, Any]],
    device: str,
) -> float:
    """Learned scalar temperature on the val split (scores fixed, NLL only)."""
    import torch

    tasks, status_rows, control_rows, menus = _group_fields(groups)
    raw_scores = _score_menus(
        encode, scorer, tasks, status_rows, control_rows, menus, temperature=1.0,
    )
    log_t = torch.zeros(1, device=device, requires_grad=True)
    opt = torch.optim.Adam([log_t], lr=0.05)
    total_weight = sum(float(g.get("weight", 1)) for g in groups)
    for _ in range(200):
        opt.zero_grad()
        loss = 0.0
        for group, raw in zip(groups, raw_scores):
            scaled = raw.detach() / torch.exp(log_t)
            loss = loss + float(group.get("weight", 1)) * torch.nn.functional.nll_loss(
                torch.log_softmax(scaled.unsqueeze(0), dim=-1),
                torch.tensor([group["gold_index"]], device=device),
            )
        (loss / max(1e-9, total_weight)).backward()
        opt.step()
    learned = float(torch.exp(log_t).item())
    return min(10.0, max(0.05, learned))


def train_tier_a(
    traces: Sequence[Dict[str, Any]],
    out_dir: Path,
    base_model: str = TIER_A_BASE_MODEL,
    epochs: int = 12,
    scorer_lr: float = 1e-3,
    encoder_lr: float = 2e-5,
    batch_groups: int = 32,
    brier_weight: float = 0.5,
    seed: int = 42,
    patience: int = 3,
    device: str = "cpu",
    tune_encoder: bool = False,
    log: Any = logger.info,
    _model: Any = None,
    _tokenizer: Any = None,
) -> Dict[str, Any]:
    """Train the Tier A cross-scorer and persist the bundle to ``out_dir``.

    Two regimes:

    - ``tune_encoder=False`` (default): the ModernBERT encoder is FROZEN and
      every unique task/row/option text is encoded once into a cache; only
      the scorer trains. The right recipe for small data (~hundreds of
      distinct states) — minutes on CPU instead of an hour, and the frozen
      encoder cannot overfit surface strings it has already memorized.
    - ``tune_encoder=True``: end-to-end fine-tune of encoder + scorer
      (frequency-weighted CE + Brier over deduped groups). Use for larger
      live-trace retraining where the extra capacity is worth the CPU cost.

    Both regimes: early stopping on val CE, then temperature scaling on val.
    ``_model``/``_tokenizer`` allow tests to inject a tiny randomly
    initialized model and the hashing stub (no downloads in the test path).
    Returns the metrics dict (also written to ``out_dir/metrics.json``).
    """
    _require_tier_a_deps()
    import torch

    random.seed(seed)
    torch.manual_seed(seed)

    train_traces = [t for t in traces if t.get("split") == "train"]
    val_traces = [t for t in traces if t.get("split") == "val"]
    if not train_traces:
        raise ValueError("no traces with split == 'train'")
    if not val_traces:
        raise ValueError("no traces with split == 'val' — temperature scaling and early stopping need a held-out val split")

    train_groups = _dedupe_groups(groups_from_traces(train_traces))
    val_groups = _dedupe_groups(groups_from_traces(val_traces))
    if _model is not None:
        model, tokenizer = _model, _tokenizer
    else:
        from transformers import AutoModel, AutoTokenizer

        log("Loading base model %s (one-time download, then fully local)", base_model)
        model = AutoModel.from_pretrained(base_model)
        tokenizer = AutoTokenizer.from_pretrained(base_model)
    model.to(device)

    pooled_dim = int(model.config.hidden_size) * _POOL_FACTOR
    u_dim = pooled_dim * 3  # [task_vec ; status_sum ; control_sum]
    scorer = _make_scorer(u_dim, pooled_dim, device)

    if tune_encoder:
        def encode(texts: Sequence[str], max_length: int, grad: bool = True) -> Any:
            return _encode(model, tokenizer, texts, max_length, device, grad=grad)

        eval_encode = lambda texts, max_length: encode(texts, max_length, grad=False)  # noqa: E731
        # Two LR groups: a fresh MLP head wants ~1e-3; an encoder being
        # fine-tuned wants ~2e-5. Applying encoder LRs to the scorer leaves
        # it effectively untrained (measured: val op accuracy 0.54).
        optimizer_params: List[Any] = [
            {"params": list(model.parameters()), "lr": encoder_lr},
            {"params": list(scorer.parameters()), "lr": scorer_lr},
        ]
        parameters = [p for group in optimizer_params for p in group["params"]]
    else:
        model.eval()
        cache = _EncoderCache(model, tokenizer, device)
        log(
            "Encoding %d train + %d val unique groups (frozen encoder, cached once)",
            len(train_groups), len(val_groups),
        )
        encode = cache
        eval_encode = cache
        optimizer_params = list(scorer.parameters())
        parameters = optimizer_params
    optimizer = torch.optim.AdamW(optimizer_params, lr=scorer_lr)
    train_weights = [float(g["weight"]) for g in train_groups]

    best_val_ce = math.inf
    best_state: Optional[Any] = None
    bad_epochs = 0
    epochs_run = 0
    started = time.time()
    steps_per_epoch = max(1, (len(train_groups) * 8) // batch_groups)
    for _ in range(int(epochs)):
        scorer.train()
        for _step in range(steps_per_epoch):
            batch = random.choices(train_groups, weights=train_weights, k=batch_groups)
            optimizer.zero_grad()
            loss = _batch_loss(encode, scorer, batch, device, brier_weight)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(parameters, 1.0)
            optimizer.step()
        epochs_run += 1
        scorer.eval()
        val = _eval_groups(eval_encode, scorer, val_groups, device)
        log(
            "epoch %d: val_ce=%.4f val_brier=%.4f val_acc=%.4f",
            epochs_run, val["ce"], val["brier"], val["accuracy"],
        )
        if val["ce"] < best_val_ce - 1e-4:
            best_val_ce = val["ce"]
            best_state = (
                ({k: v.detach().clone() for k, v in model.state_dict().items()}
                 if tune_encoder else None),
                {k: v.detach().clone() for k, v in scorer.state_dict().items()},
            )
            bad_epochs = 0
        else:
            bad_epochs += 1
            if bad_epochs >= patience:
                break

    if best_state is None:
        raise ShadowHeadError("training produced no improvable epoch — check the trace data")
    if best_state[0] is not None:
        model.load_state_dict(best_state[0])
    scorer.load_state_dict(best_state[1])
    model.eval()
    scorer.eval()

    temperature = _fit_temperature(eval_encode, scorer, val_groups, device)
    val_final = _eval_groups(eval_encode, scorer, val_groups, device, temperature)
    wall_s = round(time.time() - started, 1)

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    torch.save(
        {
            "scorer_state_dict": {k: v.cpu() for k, v in scorer.state_dict().items()},
            "temperature": temperature,
            "meta": {
                "base_model": base_model,
                "max_state_tokens": _MAX_STATE_TOKENS,
                "seed": seed,
                "epochs_run": epochs_run,
                "device": device,
                "trained_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            },
        },
        out_dir / _HEAD_STATE_FILE,
    )

    metrics: Dict[str, Any] = {
        "base_model": base_model,
        "seed": seed,
        "device": device,
        "tune_encoder": tune_encoder,
        "epochs_run": epochs_run,
        "brier_weight": brier_weight,
        "scorer_lr": scorer_lr,
        "encoder_lr": encoder_lr if tune_encoder else None,
        "batch_groups": batch_groups,
        "train_groups": len(train_groups),
        "val_groups": len(val_groups),
        "train_steps": len(train_traces),
        "val_steps": len(val_traces),
        "best_val_ce": round(best_val_ce, 6),
        "temperature": round(temperature, 4),
        "val": {k: (round(v, 6) if isinstance(v, float) else v) for k, v in val_final.items()},
        "wall_time_s": wall_s,
    }
    (out_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    log("saved Tier A bundle to %s (%.1fs)", out_dir, wall_s)
    return metrics


# ---------------------------------------------------------------------------
# The head
# ---------------------------------------------------------------------------

class TierAClassifierHead:
    """Trained ModernBERT cross-scorer behind the DecisionHead protocol.

    Loads the bundle written by :func:`train_tier_a` from ``model_dir``
    (default ``~/.allternit/shadow-head/tier-a``, override with
    ``SHADOW_HEAD_TIER_A_DIR``). A missing or untrained dir raises a clear,
    actionable error — this head never downloads at inference time.
    """

    # Operations whose proposal is only complete with a target. Mirrors
    # core/shadow_eval._TARGET_OPS: agreement on these requires a target
    # match, so a head that proposes one of them should always say WHICH
    # element — even when the harness could not ask (its target menu needs
    # >= 2 candidate rows; with exactly one candidate the target is forced
    # and the question is skipped as uninteresting, not unanswerable).
    _TARGET_OPS = frozenset({
        "click", "fill", "selectOptionFromDropdown", "hover", "doubleClick",
    })

    def __init__(
        self,
        model_dir: Optional[Path] = None,
        max_target_options: int = 64,
        device: str = "cpu",
        _model: Any = None,
        _tokenizer: Any = None,
        _scorer: Any = None,
        _temperature: float = 1.0,
    ) -> None:
        self.model_dir = Path(model_dir) if model_dir else default_model_dir()
        self.max_target_options = int(max_target_options)
        self.device = device
        self.max_state_tokens = _MAX_STATE_TOKENS
        self._model = _model
        self._tokenizer = _tokenizer
        self._scorer = _scorer
        self._temperature = float(_temperature)
        self._model_id = "tier-a:unloaded"
        # State encodings keyed by raw state_text. The encoding is a pure
        # function of the state, and the shadow harness re-presents the same
        # state text on every step of a static task — caching the task/status/
        # control blocks turns steps 2..N into scoring-only (~5 ms). Bounded
        # to a few entries; only the state's own vectors are cached, never
        # the decision (menus vary per pass).
        self._state_encode_cache: Dict[str, Tuple[Any, Any, Any]] = {}
        # Option-label encodings (bounded LRU-ish): operation/gate labels
        # repeat across tasks, target labels within a task.
        self._option_encode_cache: Dict[str, Any] = {}

    def _load(self) -> None:
        if self._model is not None:
            return
        _require_tier_a_deps()
        state_file = self.model_dir / _HEAD_STATE_FILE
        if not state_file.exists():
            raise ShadowHeadError(
                f"Tier A weights not found at {self.model_dir} (looked for "
                f"{_HEAD_STATE_FILE}). Train them first:\n"
                "    uv run --frozen --no-sync --extra dev python "
                "scripts/tier_a_train.py\n"
                f"(set {_TIER_A_DIR_ENV_VAR} to use a different dir)."
            )
        import torch
        from transformers import AutoModel

        bundle = torch.load(str(state_file), map_location=self.device, weights_only=False)
        meta = bundle.get("meta", {})
        self.max_state_tokens = int(meta.get("max_state_tokens", _MAX_STATE_TOKENS))
        self._temperature = float(bundle.get("temperature", 1.0))
        self._model = AutoModel.from_pretrained(str(self.model_dir)).to(self.device)
        self._model.eval()
        self._tokenizer = _load_tokenizer(self.model_dir)
        pooled_dim = int(self._model.config.hidden_size) * _POOL_FACTOR
        self._scorer = _make_scorer(pooled_dim * 3, pooled_dim, self.device)
        self._scorer.load_state_dict(bundle["scorer_state_dict"])
        self._scorer.eval()
        self._model_id = f"tier-a:{meta.get('base_model', TIER_A_BASE_MODEL)}"

    def _with_forced_targets(
        self,
        choices: Dict[str, Choice],
        rows: Dict[str, Tuple[str, str]],
    ) -> Dict[str, Choice]:
        """Volunteer a target choice for the chosen operation when the
        harness did not ask (single-candidate target menus are skipped by
        the loop's >= 2 rule). With exactly one row supporting the op there
        is no decision left to make — the choice is forced at probability
        1.0. Without this, a correct ``fill`` proposal on a single-field
        page scores target_agree=False purely because the question was never
        asked (harness asymmetry, documented in docs/TIER_A_NOTES.md)."""
        from .element_table import ROLE_OPERATIONS

        op_choice = choices.get("operation")
        if op_choice is None or op_choice.chosen not in self._TARGET_OPS:
            return choices
        target_name = f"{op_choice.chosen}_target"
        if target_name in choices:
            return choices
        candidates = [
            index for index, (role, _name) in rows.items()
            if op_choice.chosen in ROLE_OPERATIONS.get(role, ())
        ]
        if len(candidates) != 1:
            return choices
        target = candidates[0]
        choices[target_name] = Choice(
            question=target_name,
            chosen=target,
            probabilities={target: 1.0, ABSTAIN_OPTION: 0.0},
            confidence=1.0,
        )
        return choices

    def decide(
        self,
        state_text: str,
        questions: Sequence[Question],
    ) -> TypedDecision:
        self._load()
        started = time.time()
        rows = observed_rows_from_state(state_text)
        menus: List[List[str]] = []
        option_sets: List[List[str]] = []
        for question in questions:
            options = [str(o) for o in question.options]
            if question.name.endswith("_target") and len(options) > self.max_target_options:
                options = options[: self.max_target_options]
            menu = [option_label(question.name, o, rows) for o in options]
            menu.append(option_label(question.name, ABSTAIN_OPTION, rows))
            option_sets.append(options + [ABSTAIN_OPTION])
            menus.append(menu)

        # One fused encoder forward per decision: the task line, every
        # element row (status + control), and every menu option in a single
        # batch (per-call launch overhead dominates small CPU batches). The
        # state blocks are cached by state_text — the harness re-presents
        # the same state on every step of a static task, and the encoding
        # is a pure function of the state.
        cached = self._state_encode_cache.get(state_text)
        if cached is None:
            task = state_task_text(state_text)
            status_rows, control_rows = split_row_texts(state_text)
            vectors = _encode(
                self._model,
                self._tokenizer,
                [task] + status_rows + control_rows,
                self.max_state_tokens,
                self.device,
            )
            s1 = 1 + len(status_rows)
            s2 = s1 + len(control_rows)
            task_vec = vectors[0:1]
            status_block = (
                vectors[1:s1].sum(dim=0, keepdim=True) if status_rows
                else torch_zeros_like(task_vec)
            )
            control_block = (
                vectors[s1:s2].sum(dim=0, keepdim=True) if control_rows
                else torch_zeros_like(task_vec)
            )
            if len(self._state_encode_cache) >= 8:
                self._state_encode_cache.clear()
            self._state_encode_cache[state_text] = (task_vec, status_block, control_block)
        else:
            task_vec, status_block, control_block = cached
        u = torch_cat_dim(
            torch_cat_dim(task_vec, status_block, dim=1), control_block, dim=1,
        )
        flat = [label for menu in menus for label in menu]
        missing = [t for t in dict.fromkeys(flat) if t not in self._option_encode_cache]
        if missing:
            fresh = _encode(
                self._model, self._tokenizer, missing, _MAX_OPTION_TOKENS, self.device,
            )
            if len(self._option_encode_cache) > 512:
                self._option_encode_cache.clear()
            for text, vec in zip(missing, fresh):
                self._option_encode_cache[text] = vec
        v = torch_stack([self._option_encode_cache[t] for t in flat])

        scores_per_menu = []
        offset = 0
        for menu in menus:
            n = len(menu)
            pair = self._scorer(u.expand(n, -1), v[offset : offset + n]).squeeze(-1)
            offset += n
            pair = pair / self._temperature
            scores_per_menu.append(
                torch_cat_keep_grad(pair[:-1], pair[-1:] + self._scorer.abstain_bias)
            )
        choices: Dict[str, Choice] = {}
        for question, options, scores in zip(questions, option_sets, scores_per_menu):
            choices[question.name] = choice_from_scores(
                question.name, options, [float(s) for s in scores.detach()]
            )
        choices = self._with_forced_targets(choices, rows)

        latency_ms = (time.time() - started) * 1000.0
        decision = TypedDecision(
            choices=choices,
            latency_ms=latency_ms,
            model_id=self._model_id,
        )
        decision.validate()
        return decision


def torch_cat_keep_grad(a: Any, b: Any) -> Any:
    import torch

    return torch.cat([a, b])


def torch_stack(items: Sequence[Any]) -> Any:
    import torch

    return torch.stack(list(items))


def torch_cat_dim(a: Any, b: Any, dim: int) -> Any:
    import torch

    return torch.cat([a, b], dim=dim)


def torch_zeros_like(a: Any) -> Any:
    import torch

    return torch.zeros_like(a)
