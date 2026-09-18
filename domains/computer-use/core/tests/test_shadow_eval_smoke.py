"""Smoke test for the shadow eval harness (core/shadow_eval.py)."""

from __future__ import annotations

import json

from core import shadow_eval


def test_eval_runs_three_tasks_with_twenty_plus_steps():
    report = shadow_eval.run_eval(steps_per_task=22)
    agg = report["aggregate"]

    assert agg["tasks"] == 3
    assert agg["min_decide_steps_per_task"] >= 20, (
        "acceptance criteria: >= 20 decide steps per task"
    )
    assert agg["total_decide_steps"] == 66

    for rate_key in (
        "agreement_rate",
        "agreement_given_llm_success",
        "agreement_given_llm_failure",
    ):
        value = agg[rate_key]
        assert value is not None and 0.0 <= value <= 1.0, rate_key

    assert agg["mean_llm_latency_ms"] and agg["mean_llm_latency_ms"] > 0
    assert agg["mean_head_latency_ms"] is not None


def test_executed_actions_match_recorded_transcript():
    """The shadow harness must never change the executed action sequence."""
    report = shadow_eval.run_eval(steps_per_task=22)
    tasks = {t.task_id: t for t in shadow_eval.default_tasks(22)}
    for task_report in report["tasks"]:
        task = tasks[task_report["task_id"]]
        expected = [(turn.action_type, turn.target) for turn in task.turns]
        assert task_report["executed_actions"] == expected


def test_failure_conditioning_present():
    """Scripted adapter failures must appear so success/failure split works."""
    report = shadow_eval.run_eval(steps_per_task=22)
    total_failures = sum(t["llm_failure_steps"] for t in report["tasks"])
    assert total_failures > 0
    assert report["aggregate"]["agreement_given_llm_failure"] is not None


def test_goal_stuck_gates_in_every_step():
    """The head is asked goal_satisfied + stuck each step; the scripted head
    says stuck=true exactly on the steps the adapter fails."""
    report = shadow_eval.run_eval(steps_per_task=22)
    for task_report in report["tasks"]:
        for step in task_report["steps"]:
            assert step["goal_satisfied"] in ("true", "false")
            assert step["stuck"] in ("true", "false")
            for gate in ("goal_satisfied", "stuck"):
                assert 0.0 <= step[f"{gate}_true_probability"] <= 1.0
        # Scripted calibration: stuck fires iff the LLM step failed.
        assert task_report["stuck_true_rate_given_llm_failure"] == 1.0
        assert task_report["stuck_true_rate_given_llm_success"] == 0.0
        # goal_satisfied fires on exactly the final action step.
        assert task_report["goal_satisfied_true_rate"] == round(1 / 22, 4)

    agg = report["aggregate"]
    assert agg["stuck_true_rate_given_llm_failure"] == 1.0
    assert agg["stuck_true_rate_given_llm_success"] == 0.0
    assert "Stuck=true rate (all steps)" in shadow_eval.render_markdown(report)


def test_reports_written(tmp_path):
    report = shadow_eval.run_eval(steps_per_task=20)
    json_path, md_path = shadow_eval.write_reports(report, tmp_path)

    loaded = json.loads(json_path.read_text(encoding="utf-8"))
    assert loaded["aggregate"]["total_decide_steps"] == 60

    markdown = md_path.read_text(encoding="utf-8")
    assert "# Shadow Head Eval Report" in markdown
    assert "Agreement rate" in markdown
    for task_id in ("search-flow", "form-fill", "settings-toggle"):
        assert task_id in markdown


def _load_eval_script():
    import importlib.util
    from pathlib import Path

    script = (
        Path(shadow_eval.__file__).resolve().parents[1]
        / "scripts" / "shadow_head_eval.py"
    )
    spec = importlib.util.spec_from_file_location("shadow_head_eval", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_head_flag_parsing():
    """--head accepts only mock|mlx|kimi (default mock); mlx needs the extra."""
    script = _load_eval_script()

    head, suffix = script.build_head("mock")
    assert head is None and suffix == ""

    try:
        script.main(["--head", "bogus"])
    except SystemExit as exc:
        assert exc.code == 2  # argparse: invalid choice
    else:
        raise AssertionError("invalid --head value must exit 2")


def test_kimi_head_flag_parsing(monkeypatch):
    """--head kimi builds a KimiCliHead; --questioning/--trajectory shape the
    report stem (-deltas is the post-state-delta default; -traj with
    --trajectory on)."""
    script = _load_eval_script()
    monkeypatch.setattr("shutil.which", lambda _bin: "/fake/bin/kimi")

    from core.decision_head import KimiCliHead

    head, suffix = script.build_head("kimi")
    assert isinstance(head, KimiCliHead) and head.questioning == "batched"
    assert not head.trajectory_enabled
    assert suffix == "-kimi-deltas"

    head, suffix = script.build_head("kimi", questioning="sequential")
    assert head.questioning == "sequential"
    assert suffix == "-kimi-sequential-deltas"

    head, suffix = script.build_head("kimi", trajectory=True)
    assert head.trajectory_enabled
    assert suffix == "-kimi-traj"

    try:
        script.main(["--questioning", "sideways"])
    except SystemExit as exc:
        assert exc.code == 2
    else:
        raise AssertionError("invalid --questioning value must exit 2")

    try:
        script.main(["--trajectory", "sideways"])
    except SystemExit as exc:
        assert exc.code == 2
    else:
        raise AssertionError("invalid --trajectory value must exit 2")
