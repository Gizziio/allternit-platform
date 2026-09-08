"""
Allternit Computer Use — Measured conformance tests

Covers conformance.measured: real suite execution against the mock adapter,
honest grade computation, adapter_grades.json writing, and the
not-implemented honesty rules for suites B/C/E.
"""

import json
import sys
from pathlib import Path

import pytest

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DOMAIN_CORE_ROOT / "gateway"))
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

_existing_core = sys.modules.get("core")
if _existing_core is not None:
    _existing_file = getattr(_existing_core, "__file__", "") or ""
    if Path(_existing_file).parent != DOMAIN_CORE_ROOT / "core":
        for _name in [
            m for m in list(sys.modules)
            if (m == "core" or m.startswith("core.")) and not m.startswith("core.tests")
        ]:
            del sys.modules[_name]

from conformance import ConformanceRunner  # noqa: E402
from conformance.measured import (  # noqa: E402
    GRADING_SCALE,
    NOT_IMPLEMENTED,
    main,
    run_measurement,
    write_grades,
)
from conformance.mock_browser_adapter import MockBrowserAdapter  # noqa: E402
from conformance.suites import build_suite_a, build_suite_f  # noqa: E402


class TestMockAdapterMeasuresSuiteA:
    @pytest.mark.asyncio
    async def test_mock_passes_suite_a(self):
        runner = ConformanceRunner()
        runner.register_suite(build_suite_a())
        result = await runner.run_suite("browser-deterministic-v1", MockBrowserAdapter())
        assert result.total == 8
        assert result.passed == 8, [r.to_dict() for r in result.results if r.status != "pass"]
        assert result.pass_rate == 100.0
        assert result.grade == "production"

    @pytest.mark.asyncio
    async def test_mock_executes_all_action_kinds(self):
        adapter = MockBrowserAdapter()
        runner = ConformanceRunner()
        runner.register_suite(build_suite_a())
        await runner.run_suite("browser-deterministic-v1", adapter)
        # every suite A action type reached the adapter
        assert {"goto", "extract", "screenshot", "eval", "observe"} <= set(adapter.actions_executed)

    @pytest.mark.asyncio
    async def test_failing_adapter_produces_real_low_grade(self):
        """A partially-capable adapter must land a real (low) pass rate, not a declared one."""

        class BrokenAdapter(MockBrowserAdapter):
            async def execute(self, action, session_id: str = "", run_id: str = ""):
                if action.action_type == "eval":
                    raise RuntimeError("eval unsupported")
                return await super().execute(action, session_id, run_id)

        runner = ConformanceRunner()
        runner.register_suite(build_suite_a())
        result = await runner.run_suite("browser-deterministic-v1", BrokenAdapter())
        assert result.passed == 7
        assert result.pass_rate == 87.5
        assert result.grade == "beta"  # 50-89% band


class TestGradesWriting:
    @pytest.mark.asyncio
    async def test_write_grades_has_real_numbers(self, tmp_path):
        grades_path = tmp_path / "adapter_grades.json"
        document = await run_measurement(network=False, grades_path=grades_path)

        mock_entry = document["browser.mock"]
        assert mock_entry["measured"] is True
        assert mock_entry["pass_rate"] == 100.0
        assert mock_entry["grade"] == "production"
        assert mock_entry["tests_pass"] == 8

        routing = document["_routing_policy"]
        assert routing["measured"] is True
        assert routing["pass_rate"] == 100.0

        # Suites B/C/E honestly ungraded
        for adapter_id in NOT_IMPLEMENTED:
            entry = document[adapter_id]
            assert entry["measured"] is False
            assert entry["grade"] is None
            assert entry["pass_rate"] is None
            assert "not implemented" in entry["note"]

        # File on disk parses and matches
        loaded = json.loads(grades_path.read_text())
        assert loaded["browser.mock"]["pass_rate"] == 100.0
        assert loaded["_grading_scale"] == GRADING_SCALE

    @pytest.mark.asyncio
    async def test_unmeasured_browser_entries_are_honest(self, tmp_path):
        grades_path = tmp_path / "adapter_grades.json"
        document = await run_measurement(network=False, grades_path=grades_path)
        for adapter_id in ("browser.playwright", "browser.cdp", "desktop.pyautogui"):
            entry = document[adapter_id]
            assert entry["measured"] is False
            assert entry["grade"] is None
            assert entry["pass_rate"] is None

    def test_cli_writes_grades(self, tmp_path, capsys):
        exit_code = main(["--grades-path", str(tmp_path / "grades.json")])
        assert exit_code == 0
        out = capsys.readouterr().out
        assert "browser.mock" in out
        assert "pass_rate=100.0%" in out
        assert (tmp_path / "grades.json").is_file()
