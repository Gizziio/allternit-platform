"""Unit tests for core/laya_head.py — Laya head mapping layer + decide() paths.

The mapping layer (laya_question_def / group_ranges / group_label /
group_choice_def / answer conversion) is pure and always runs. All decide()
paths are exercised through an injected ``scorer`` callable that mimics
``laya.Agent.system_one``'s return shape, so no weights (and not even the
``laya`` package) are needed — mirroring how test_semif_head.py stubs the
SemIf backend. The live-weight path is covered by scripts/run_head_eval.py
(zero-shot measurement; see docs/JEV_LAYA_NOTES.md).
"""

from __future__ import annotations

import pytest

from core.decision_head import (
    Question,
    ShadowHeadDependencyError,
)
from core.laya_head import (
    DEFAULT_MODEL,
    MAX_DIRECT_OPTIONS,
    LayaHead,
    group_choice_def,
    group_label,
    group_ranges,
    laya_question_def,
)


# ---------------------------------------------------------------------------
# Scorer stub — mimics laya.Agent.system_one(state, questions)["answers"]
# ---------------------------------------------------------------------------

class ScriptedScorer:
    """Deterministic scorer: answers every question from a scripted dict
    keyed by the laya question key, or by matching the question's
    instructions/criteria when no exact key is set."""

    def __init__(self, scripted=None):
        self.scripted = dict(scripted or {})
        self.calls = []  # [(state, questions_dict)] in invocation order

    def __call__(self, state, questions):
        self.calls.append((state, dict(questions)))
        answers = {}
        for qid, qdef in questions.items():
            if qid in self.scripted:
                answers[qid] = self.scripted[qid]
                continue
            if qdef["type"] == "noul":
                answers[qid] = {"type": "noul", "noul": 0.5, "confidence": 0.5}
            else:
                keys = list(qdef["criteria"].keys())
                probs = {k: 0.0 for k in keys}
                probs[keys[0]] = 1.0
                answers[qid] = {
                    "type": "choice",
                    "choice": keys[0],
                    "probabilities": probs,
                    "confidence": 0.75,
                }
        return answers


def make_head(scorer=None, **kwargs):
    kwargs.setdefault("scorer", scorer if scorer is not None else ScriptedScorer())
    return LayaHead(**kwargs)


# ---------------------------------------------------------------------------
# Question mapping
# ---------------------------------------------------------------------------

class TestQuestionMapping:
    def test_operation_is_choice_with_option_keys(self):
        qdef = laya_question_def("operation", ["click", "fill", "press"])
        assert qdef["type"] == "choice"
        assert list(qdef["criteria"].keys()) == ["click", "fill", "press"]
        assert qdef["instructions"]

    def test_target_is_choice_with_row_index_keys(self):
        qdef = laya_question_def("click_target", ["3", "7", "12"])
        assert qdef["type"] == "choice"
        assert list(qdef["criteria"].keys()) == ["3", "7", "12"]

    def test_gates_are_noul(self):
        for name in ("goal_satisfied", "stuck"):
            qdef = laya_question_def(name, ["true", "false"])
            assert qdef["type"] == "noul"
            assert "criteria" not in qdef
            assert qdef["instructions"]

    def test_unknown_question_falls_back_to_generic_choice(self):
        qdef = laya_question_def("mood", ["calm", "loud"])
        assert qdef["type"] == "choice"
        assert list(qdef["criteria"].keys()) == ["calm", "loud"]

    def test_group_ranges_cover_consecutively(self):
        assert group_ranges(0) == []
        assert group_ranges(5) == [(0, 5)]
        assert group_ranges(16) == [(0, 16)]
        assert group_ranges(17) == [(0, 16), (16, 17)]
        assert group_ranges(40) == [(0, 16), (16, 32), (32, 40)]
        assert group_ranges(64) == [(0, 16), (16, 32), (32, 48), (48, 64)]

    def test_group_label_is_inclusive_range(self):
        assert group_label(0, 16) == "0-15"
        assert group_label(48, 64) == "48-63"

    def test_group_choice_def_has_one_criterion_per_group(self):
        options = [str(i) for i in range(40)]
        qdef = group_choice_def(options)
        assert qdef["type"] == "choice"
        assert list(qdef["criteria"].keys()) == ["0-15", "16-31", "32-39"]


# ---------------------------------------------------------------------------
# decide() — small menus (single pass)
# ---------------------------------------------------------------------------

class TestDirectPath:
    def test_single_pass_for_small_menus(self):
        scorer = ScriptedScorer({
            "operation": {
                "type": "choice",
                "choice": "fill",
                "probabilities": {"click": 0.1, "fill": 0.7, "press": 0.2},
                "confidence": 0.61,
            },
        })
        head = make_head(scorer)
        questions = [
            Question("operation", ["click", "fill", "press"]),
            Question("fill_target", ["0", "1"]),
            Question("goal_satisfied", ["true", "false"]),
            Question("stuck", ["true", "false"]),
        ]
        decision = head.decide("STATE", questions)
        assert len(scorer.calls) == 1  # one laya forward pass
        assert decision.choices["operation"].chosen == "fill"
        assert decision.choices["operation"].confidence == pytest.approx(0.61)
        # Distribution renormalized over the exact option set.
        probs = decision.choices["operation"].probabilities
        assert set(probs) == {"click", "fill", "press"}
        assert sum(probs.values()) == pytest.approx(1.0, abs=1e-9)
        # Gates become noul-derived true/false choices.
        assert decision.choices["goal_satisfied"].chosen in ("true", "false")
        assert decision.choices["stuck"].chosen in ("true", "false")
        decision.validate()

    def test_noul_maps_p_true_to_distribution(self):
        scorer = ScriptedScorer({
            "stuck": {"type": "noul", "noul": 0.8, "confidence": 0.8},
        })
        head = make_head(scorer)
        decision = head.decide("STATE", [Question("stuck", ["true", "false"])])
        choice = decision.choices["stuck"]
        assert choice.chosen == "true"
        assert choice.probabilities["true"] == pytest.approx(0.8)
        assert choice.probabilities["false"] == pytest.approx(0.2)
        assert choice.confidence == pytest.approx(0.8)

    def test_noul_below_half_picks_false(self):
        scorer = ScriptedScorer({
            "goal_satisfied": {"type": "noul", "noul": 0.3},
        })
        head = make_head(scorer)
        decision = head.decide("STATE", [Question("goal_satisfied", ["true", "false"])])
        assert decision.choices["goal_satisfied"].chosen == "false"

    def test_rounded_probabilities_are_renormalized(self):
        # Laya rounds per-option probabilities to 4 decimals; a full direct
        # menu (16 options) can drift off 1.0 by up to 8e-4 — inside our
        # validator's 1e-3 tolerance only if the head renormalizes.
        options = [str(i) for i in range(16)]
        raw = {o: 0.0625 for o in options}  # sums to exactly 1.0...
        raw["7"] = 0.0624                   # ...now sums to 0.9999
        scorer = ScriptedScorer({
            "click_target": {
                "type": "choice",
                "choice": "7",
                "probabilities": raw,
                "confidence": 0.5,
            },
        })
        head = make_head(scorer)
        decision = head.decide("STATE", [Question("click_target", options)])
        choice = decision.choices["click_target"]
        assert choice.chosen == "7"
        assert sum(choice.probabilities.values()) == pytest.approx(1.0, abs=1e-9)
        decision.validate()

    def test_single_option_menu_is_answered_directly(self):
        scorer = ScriptedScorer()
        head = make_head(scorer)
        decision = head.decide("STATE", [Question("click_target", ["4"])])
        assert decision.choices["click_target"].chosen == "4"
        assert decision.choices["click_target"].probabilities == {"4": 1.0}
        assert len(scorer.calls) == 0  # no laya pass needed

    def test_model_id_reflects_config(self):
        head = make_head()
        head._scorer = None
        assert "convaiinnovations/laya" in head.model
        head2 = LayaHead(subfolder="multilingual", temperature=1.2,
                         scorer=ScriptedScorer())
        assert head2.subfolder == "multilingual"
        decision = head2.decide("STATE", [Question("stuck", ["true", "false"])])
        assert decision.model_id.startswith("laya:convaiinnovations/laya/multilingual")
        assert ":T1.2" in decision.model_id


# ---------------------------------------------------------------------------
# decide() — oversized menus (two-step coarse-to-fine)
# ---------------------------------------------------------------------------

class TestTwoStepPath:
    def _questions(self, n=40):
        return [Question("click_target", [str(i) for i in range(n)])]

    def test_two_passes_for_oversized_menu(self):
        options = [str(i) for i in range(40)]
        scorer = ScriptedScorer({
            "click_target__laya_groups": {
                "type": "choice",
                "choice": "16-31",
                "probabilities": {"0-15": 0.2, "16-31": 0.6, "32-39": 0.2},
                "confidence": 0.5,
            },
            "click_target__laya_groups_in": {
                "type": "choice",
                "choice": "20",
                "probabilities": {o: 0.0 for o in options[16:32]} | {"20": 1.0},
                "confidence": 0.9,
            },
        })
        head = make_head(scorer)
        decision = head.decide("STATE", self._questions())

        assert len(scorer.calls) == 2  # coarse pass + in-group pass
        pass1_qids = list(scorer.calls[0][1])
        pass2_qids = list(scorer.calls[1][1])
        assert pass1_qids == ["click_target__laya_groups"]
        assert pass2_qids == ["click_target__laya_groups_in"]
        # The in-group pass asks only the winning group's options.
        in_group = scorer.calls[1][1]["click_target__laya_groups_in"]
        assert list(in_group["criteria"].keys()) == options[16:32]

        choice = decision.choices["click_target"]
        assert choice.chosen == "20"
        assert choice.confidence == pytest.approx(0.9)
        decision.validate()

    def test_combined_probabilities_are_multiplicative(self):
        options = [str(i) for i in range(40)]
        scorer = ScriptedScorer({
            "click_target__laya_groups": {
                "type": "choice",
                "choice": "0-15",
                "probabilities": {"0-15": 0.5, "16-31": 0.3, "32-39": 0.2},
                "confidence": 0.4,
            },
            "click_target__laya_groups_in": {
                "type": "choice",
                "choice": "3",
                "probabilities": {"3": 0.5, "4": 0.5},
                "confidence": 0.5,
            },
        })
        head = make_head(scorer)
        decision = head.decide("STATE", self._questions())
        probs = decision.choices["click_target"].probabilities
        # Winning group: p = p(group) * p(option|group). The scripted fine
        # pass gives "3"/"4" 0.5/0.5 — already normalized over the group.
        assert probs["3"] == pytest.approx(0.5 * 0.5)
        assert probs["4"] == pytest.approx(0.5 * 0.5)
        # Losing groups spread their coarse mass uniformly within the group.
        assert probs["16"] == pytest.approx(0.3 / 16)
        assert probs["35"] == pytest.approx(0.2 / 8)
        # Winning group's remaining options got zero fine mass.
        assert probs["0"] == pytest.approx(0.0)
        assert sum(probs.values()) == pytest.approx(1.0, abs=1e-9)
        # Every original option is present in the distribution.
        assert set(probs) == set(options)
        decision.validate()

    def test_64_option_menu_uses_four_groups(self):
        options = [str(i) for i in range(64)]
        scorer = ScriptedScorer({
            "click_target__laya_groups": {
                "type": "choice",
                "choice": "48-63",
                "probabilities": {
                    "0-15": 0.25, "16-31": 0.25, "32-47": 0.25, "48-63": 0.25
                },
                "confidence": 0.3,
            },
            "click_target__laya_groups_in": {
                "type": "choice",
                "choice": "60",
                "probabilities": {o: 0.0 for o in options[48:64]} | {"60": 1.0},
                "confidence": 0.8,
            },
        })
        head = make_head(scorer)
        decision = head.decide("STATE", self._questions(64))
        assert decision.choices["click_target"].chosen == "60"
        coarse = scorer.calls[0][1]["click_target__laya_groups"]
        assert len(coarse["criteria"]) == 4
        assert len(scorer.calls[1][1]["click_target__laya_groups_in"]["criteria"]) == 16
        decision.validate()

    def test_mixed_menus_keep_small_ones_in_pass1(self):
        # An oversized target menu forces pass 2, but the operation choice
        # and gates still resolve from pass 1.
        target_options = [str(i) for i in range(40)]
        scorer = ScriptedScorer({
            "operation": {
                "type": "choice",
                "choice": "click",
                "probabilities": {"click": 0.9, "fill": 0.1},
                "confidence": 0.9,
            },
            "click_target__laya_groups": {
                "type": "choice",
                "choice": "0-15",
                "probabilities": {
                    "0-15": 0.7, "16-31": 0.2, "32-39": 0.1
                },
                "confidence": 0.6,
            },
            "click_target__laya_groups_in": {
                "type": "choice",
                "choice": "5",
                "probabilities": {"5": 1.0},
                "confidence": 0.7,
            },
        })
        head = make_head(scorer)
        decision = head.decide("STATE", [
            Question("operation", ["click", "fill"]),
            Question("click_target", target_options),
            Question("stuck", ["true", "false"]),
        ])
        assert len(scorer.calls) == 2
        assert decision.choices["operation"].chosen == "click"
        assert decision.choices["click_target"].chosen == "5"
        assert decision.choices["stuck"].chosen == "true"  # default noul 0.5
        decision.validate()

    def test_boundary_16_is_direct_17_is_two_step(self):
        direct = make_head(ScriptedScorer())
        options16 = [str(i) for i in range(16)]
        direct.decide("STATE", [Question("click_target", options16)])
        assert len(direct._scorer.calls) == 1

        two_step = make_head(ScriptedScorer({
            "click_target__laya_groups": {
                "type": "choice", "choice": "0-15",
                "probabilities": {"0-15": 1.0}, "confidence": 0.5,
            },
            "click_target__laya_groups_in": {
                "type": "choice", "choice": "9",
                "probabilities": {"9": 1.0}, "confidence": 0.5,
            },
        }))
        two_step.decide("STATE", [Question("click_target", [str(i) for i in range(17)])])
        assert len(two_step._scorer.calls) == 2

    def test_unknown_coarse_answer_raises(self):
        scorer = ScriptedScorer({
            "click_target__laya_groups": {
                "type": "choice", "choice": "banana",
                "probabilities": {"0-15": 1.0}, "confidence": 0.5,
            },
        })
        head = make_head(scorer)
        from core.decision_head import ShadowHeadError
        with pytest.raises(ShadowHeadError):
            head.decide("STATE", self._questions())


# ---------------------------------------------------------------------------
# Dependency + constructor guards
# ---------------------------------------------------------------------------

class TestDependencyError:
    def test_missing_dependency_raises_with_install_hint(self, monkeypatch):
        import importlib.util as iu
        monkeypatch.setattr(iu, "find_spec", lambda name: None)
        head = LayaHead()  # no scorer -> will try to load laya
        with pytest.raises(ShadowHeadDependencyError) as excinfo:
            head.decide("STATE", [Question("stuck", ["true", "false"])])
        assert "uv pip install" in str(excinfo.value)
        assert "laya" in str(excinfo.value)

    def test_default_model_is_public_hub_repo(self):
        assert DEFAULT_MODEL == "convaiinnovations/laya"

    def test_max_direct_options_validation(self):
        with pytest.raises(ValueError):
            LayaHead(max_direct_options=1)
