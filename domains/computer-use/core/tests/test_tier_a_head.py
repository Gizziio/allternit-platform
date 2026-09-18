"""Unit tests for the Tier A trained classifier head + trace pipeline.

No downloads anywhere in this file: every model-dependent test injects a
tiny randomly-initialized ModernBERT built from an in-code config and the
hashing tokenizer stub (core/tier_a_head.TinyHashTokenizer). Tests skip
cleanly when torch/transformers are not installed.
"""

# ruff: noqa: E402  — pytest.importorskip must run before the torch/transformers imports.

from __future__ import annotations

import json

import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("transformers")

from transformers import AutoModel, ModernBertConfig

from core.decision_head import (
    ABSTAIN_OPTION,
    DecisionHead,
    Question,
    ShadowHeadError,
)
from core.shadow_eval import build_shadow_state_text, default_tasks
from core.tier_a_head import (
    _POOL_FACTOR,
    TinyHashTokenizer,
    TierAClassifierHead,
    _make_scorer,
    groups_from_traces,
    observed_rows_from_state,
    option_label,
    train_tier_a,
)
from core.tier_a_traces import (
    canonical_names,
    make_variant_tasks,
    task_traces,
    validate_trace,
)


def _tiny_model():
    """Randomly-initialized tiny ModernBERT + hashing stub (offline)."""
    config = ModernBertConfig(
        hidden_size=64,
        num_hidden_layers=2,
        num_attention_heads=4,
        intermediate_size=128,
        vocab_size=512,
        max_position_embeddings=512,
        pad_token_id=0,
    )
    return AutoModel.from_config(config), TinyHashTokenizer(vocab_size=512)


def _injected_head(tmp_path=None):
    model, tokenizer = _tiny_model()
    pooled = int(model.config.hidden_size) * _POOL_FACTOR
    scorer = _make_scorer(pooled * 3, pooled, "cpu")
    return TierAClassifierHead(
        model_dir=tmp_path,
        _model=model,
        _tokenizer=tokenizer,
        _scorer=scorer,
        _temperature=1.0,
    )


_SAMPLE_STATE = (
    "[TASK]\nFind things\n\n"
    "[OBSERVED ELEMENTS]\n"
    "[0] AXWindow: EvalBrowser\n"
    "[1] AXTextField: Query box\n"
    "[2] AXButton: Go\n\n"
    "[OPTIONS]\noperation: click, fill\n\n"
    "[INSTRUCTIONS]\nChoose.\n\nThe next browser operation is:"
)

_SAMPLE_QUESTIONS = [
    Question("operation", ["click", "fill"]),
    Question("fill_target", ["1"]),
    Question("goal_satisfied", ["true", "false"]),
]


class TestOptionRendering:
    def test_rows_parse_by_position_and_ref(self):
        rows = observed_rows_from_state(_SAMPLE_STATE)
        assert rows["1"] == ("AXTextField", "Query box")
        assert rows["2"] == ("AXButton", "Go")

    def test_ref_ids_still_resolve_positionally(self):
        state = _SAMPLE_STATE.replace("[1] AXTextField", "[@e7] AXTextField")
        rows = observed_rows_from_state(state)
        # Target options are plain indices even when the display id is a ref.
        assert rows["1"] == ("AXTextField", "Query box")

    def test_target_label_carries_row_semantics(self):
        rows = observed_rows_from_state(_SAMPLE_STATE)
        label = option_label("fill_target", "1", rows)
        assert "fill_target" in label and "1" in label
        assert "AXTextField: Query box" in label

    def test_target_label_falls_back_when_row_unknown(self):
        label = option_label("click_target", "9", {})
        assert "unknown row" in label

    def test_operation_and_gate_labels(self):
        assert option_label("operation", "click", {}) == "operation | click"
        assert option_label("stuck", "true", {}) == "stuck | true"


class TestStateDecomposition:
    def test_task_and_row_texts(self):
        from core.tier_a_head import row_texts, state_task_text

        assert state_task_text(_SAMPLE_STATE) == "Find things"
        assert row_texts(_SAMPLE_STATE) == [
            "[0] AXWindow: EvalBrowser",
            "[1] AXTextField: Query box",
            "[2] AXButton: Go",
        ]
        assert state_task_text("no blocks") == ""
        assert row_texts("no blocks") == []


class TestTierAHead:
    def test_implements_protocol(self):
        assert isinstance(_injected_head(), DecisionHead)

    def test_decide_validates_and_sums(self):
        head = _injected_head()
        decision = head.decide(_SAMPLE_STATE, _SAMPLE_QUESTIONS)
        decision.validate()
        assert decision.latency_ms > 0
        for choice in decision.choices.values():
            total = sum(choice.probabilities.values())
            assert abs(total - 1.0) < 1e-3
            assert ABSTAIN_OPTION in choice.probabilities

    def test_abstain_pseudo_option_always_present(self):
        head = _injected_head()
        decision = head.decide(_SAMPLE_STATE, _SAMPLE_QUESTIONS)
        op = decision.choices["operation"]
        assert ABSTAIN_OPTION in op.probabilities
        assert op.chosen in op.probabilities

    def test_forced_abstain_bias_selects_abstain(self):
        head = _injected_head()
        with torch.no_grad():
            head._scorer.abstain_bias.fill_(1e6)
        decision = head.decide(_SAMPLE_STATE, _SAMPLE_QUESTIONS)
        for choice in decision.choices.values():
            assert choice.chosen == ABSTAIN_OPTION

    def test_missing_weights_raise_actionable_error(self, tmp_path):
        head = TierAClassifierHead(model_dir=tmp_path / "nope")
        with pytest.raises(ShadowHeadError) as excinfo:
            head.decide(_SAMPLE_STATE, _SAMPLE_QUESTIONS)
        assert "tier_a_train.py" in str(excinfo.value)

    def test_model_dir_env_override(self, monkeypatch, tmp_path):
        from core.tier_a_head import default_model_dir

        monkeypatch.setenv("SHADOW_HEAD_TIER_A_DIR", str(tmp_path))
        assert default_model_dir() == tmp_path


class TestGroupsFromTraces:
    def _trace(self, gold):
        return [{
            "schema_version": 1,
            "trace_id": "t:s1",
            "task_id": "t",
            "template": "search",
            "split": "train",
            "step": 1,
            "state_text": _SAMPLE_STATE,
            "questions": [
                {"name": "operation", "options": ["click", "fill"]},
                {"name": "fill_target", "options": ["1"]},
                {"name": "click_target", "options": ["2"]},
            ],
            "gold": gold,
            "llm": {"op": "fill", "target": "Query box", "text": "x", "success": True},
        }]

    def test_resolved_gold_maps_to_option_index(self):
        groups = groups_from_traces(self._trace({"operation": "fill", "fill_target": "1"}))
        by_question = {g["question"]: g for g in groups}
        op = by_question["operation"]
        assert op["gold_index"] == op["menu"].index("operation | fill")
        target = by_question["fill_target"]
        assert target["gold_index"] == target["menu"].index(
            option_label("fill_target", "1", observed_rows_from_state(_SAMPLE_STATE))
        )

    def test_missing_gold_trains_as_abstain(self):
        groups = groups_from_traces(self._trace({"operation": "fill"}))
        speculative = next(g for g in groups if g["question"] == "click_target")
        assert speculative["gold_index"] == len(speculative["menu"]) - 1

    def test_abstain_appended_last_and_kinds_tagged(self):
        groups = groups_from_traces(self._trace({"operation": "fill"}))
        kinds = {g["question"]: g["kind"] for g in groups}
        assert kinds["operation"] == "operation"
        assert kinds["fill_target"] == "target"
        for group in groups:
            assert ABSTAIN_OPTION in group["menu"][-1]


class TestTraceSchema:
    def _record(self, **overrides):
        record = {
            "schema_version": 1,
            "trace_id": "t:s1",
            "task_id": "t",
            "template": "search",
            "split": "train",
            "step": 1,
            "state_text": _SAMPLE_STATE,
            "questions": [{"name": "operation", "options": ["click", "fill"]}],
            "gold": {"operation": "click"},
            "llm": {"op": "click", "target": "Go", "text": None, "success": True},
        }
        record.update(overrides)
        return record

    def test_valid_record_passes(self):
        validate_trace(self._record())

    @pytest.mark.parametrize("overrides", [
        {"split": "nope"},
        {"state_text": "no block here"},
        {"questions": []},
        {"gold": {"operation": "navigate"}},
        {"gold": {"unknown_question": "click"}},
        {"schema_version": 99},
    ])
    def test_invalid_records_rejected(self, overrides):
        with pytest.raises(ValueError):
            validate_trace(self._record(**overrides))

    def test_gold_may_be_abstain(self):
        validate_trace(self._record(gold={"operation": ABSTAIN_OPTION}))


class TestVariantGeneration:
    def test_deterministic_and_split_sizes(self):
        train1, val1 = make_variant_tasks(seed=7, n_variants=10, n_val=3)
        train2, val2 = make_variant_tasks(seed=7, n_variants=10, n_val=3)
        assert [t.task_id for t in train1] == [t.task_id for t in train2]
        assert [t.task_id for t in val1] == [t.task_id for t in val2]
        assert len(train1) == 7 and len(val1) == 3
        assert not {t.task_id for t in train1} & {t.task_id for t in val1}

    def test_variant_names_disjoint_from_canonical(self):
        canonical = canonical_names()
        train, val = make_variant_tasks(seed=11)
        for task in train + val:
            def visit(node):
                # The browser window title is intentionally shared with the
                # canonical tasks — phase-0 variant states stay structurally
                # identical to the held-out states.
                if node.name and node.name != "EvalBrowser":
                    assert node.name not in canonical, node.name
                for child in node.children or []:
                    visit(child)
            visit(task.tree)
            for turn in task.turns:
                if turn.target:
                    assert turn.target not in canonical, turn.target

    def test_variants_have_dynamic_observations(self):
        train, _ = make_variant_tasks(seed=13)
        dynamic = [t for t in train if t.step_trees and
                   len({json.dumps(tr, default=str, sort_keys=True) for tr in t.step_trees}) > 1]
        assert dynamic, "variants must mutate their observations per step"

    def test_task_traces_labels_every_step(self):
        train, _ = make_variant_tasks(seed=17, n_variants=4, n_val=1)
        task = train[0]
        traces = task_traces(task, "train")
        assert len(traces) == len(task.turns) >= 20
        for record in traces:
            validate_trace(record)
            op_options = next(
                q["options"] for q in record["questions"] if q["name"] == "operation"
            )
            assert record["gold"]["operation"] in op_options
            # Gates are always labelled; speculative menus stay out of gold.
            assert "goal_satisfied" in record["gold"]
            assert "stuck" in record["gold"]
            target_keys = [k for k in record["gold"] if k.endswith("_target")]
            assert all(k == f"{record['llm']['op']}_target" for k in target_keys)

    def test_heldout_traces_are_canonical_tasks(self):
        heldout = []
        for task in default_tasks(4):
            heldout.extend(task_traces(task, "heldout"))
        assert {t["task_id"] for t in heldout} == {
            "search-flow", "form-fill", "settings-toggle"}
        for record in heldout:
            validate_trace(record)

    def test_recorded_state_matches_shared_prompt_builder(self):
        task = default_tasks(3)[0]
        traces = task_traces(task, "heldout")
        from core.tier_a_traces import _table_for_state
        from core.shadow_eval import build_shadow_questions

        step_trees = __import__(
            "core.shadow_eval", fromlist=["_step_trees"])._step_trees(task)
        table = _table_for_state(traces[0]["state_text"], step_trees)
        questions = build_shadow_questions(table)
        rebuilt = build_shadow_state_text(task.task, table, questions)
        # The loop's refmap renders @eN ids; ids are stripped for comparison
        # (row order — what the indices mean — is identical).
        from core.tier_a_traces import _strip_ids
        assert _strip_ids(rebuilt) == _strip_ids(traces[0]["state_text"])


class TestTrainSmoke:
    def test_train_eval_smoke_on_synthetic_rows(self, tmp_path):
        train_tasks, val_tasks = make_variant_tasks(seed=23, n_variants=2, n_val=1)
        traces = task_traces(train_tasks[0], "train") + task_traces(val_tasks[0], "val")
        assert len(traces) >= 8

        model, tokenizer = _tiny_model()
        out_dir = tmp_path / "bundle"
        metrics = train_tier_a(
            traces,
            out_dir,
            epochs=2,
            batch_groups=4,
            seed=5,
            _model=model,
            _tokenizer=tokenizer,
            log=lambda *a, **k: None,
        )
        assert metrics["train_groups"] > 0 and metrics["val_groups"] > 0
        assert 0.05 <= metrics["temperature"] <= 10.0
        assert metrics["epochs_run"] >= 1
        assert (out_dir / "tier_a_head.pt").exists()
        assert (out_dir / "metrics.json").exists()

        # Full offline load path: bundle -> head -> validated decision.
        head = TierAClassifierHead(model_dir=out_dir)
        decision = head.decide(_SAMPLE_STATE, _SAMPLE_QUESTIONS)
        decision.validate()
        assert head._temperature == pytest.approx(metrics["temperature"], rel=1e-3)
        loaded = json.loads((out_dir / "metrics.json").read_text())
        assert loaded["val_groups"] == metrics["val_groups"]

    def test_training_requires_val_split(self, tmp_path):
        train_tasks, _ = make_variant_tasks(seed=29, n_variants=2, n_val=1)
        traces = task_traces(train_tasks[0], "train")
        model, tokenizer = _tiny_model()
        with pytest.raises(ValueError, match="val"):
            train_tier_a(
                traces, tmp_path / "bundle", epochs=1,
                _model=model, _tokenizer=tokenizer,
                log=lambda *a, **k: None,
            )
