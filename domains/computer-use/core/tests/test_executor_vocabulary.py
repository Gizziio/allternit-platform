"""Per-step executor vocabulary tests (cu22 follow-up F2).

The real-model campaign found the per-step fallback executor rejected plan
types `click`/`select` (it was built for the narrower native taxonomy), so the
campaign shimmed click→left_click by hand. `PLAN_ACTION_MAP` in
core/computer_use_executor now aligns the accepted per-step vocabulary with
what batch dispatch accepts; these tests pin that alignment and the clean
refusal of unknown types.
"""

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

from core.base_adapter import ActionRequest, BaseAdapter, ResultEnvelope  # noqa: E402
from core.computer_use_executor import (  # noqa: E402
    ALL_SUPPORTED_ACTIONS,
    ComputerUseExecutor,
    PLAN_ACTION_MAP,
)


class _RecordingAdapter(BaseAdapter):
    """Records the native action types it was asked to execute."""

    def __init__(self, adapter_id="browser.playwright"):
        self._id = adapter_id
        self.calls = []

    @property
    def adapter_id(self):
        return self._id

    @property
    def family(self):
        return "browser" if self._id.startswith("browser.") else "desktop"

    async def initialize(self):
        pass

    async def close(self):
        pass

    async def health_check(self):
        return True

    async def execute(self, action, session_id, run_id):
        self.calls.append(action.action_type)
        env = self._make_envelope(action, session_id, run_id)
        env.status = "completed"
        return env


def _req(action_type, target="#a", parameters=None):
    return ActionRequest(
        action_type=action_type, target=target, parameters=parameters or {}
    )


class TestPlanVocabularyAlignment:
    """Every plan type batch dispatch accepts must execute per-step too."""

    @pytest.mark.asyncio
    async def test_mapped_plan_types_execute_as_native_actions(self):
        adapter = _RecordingAdapter()
        executor = ComputerUseExecutor()
        executor.register(adapter.adapter_id, adapter)

        # (plan type, expected native type the adapter must receive)
        cases = [
            ("click", "left_click"),
            ("doubleClick", "double_click"),
            ("press", "key"),
            ("select", "fill"),
            ("scrollTo", "scroll"),
        ]
        for plan_type, native in cases:
            result = await executor.execute(
                _req(plan_type), session_id="s-1", run_id="r-1"
            )
            assert result.status == "completed", f"{plan_type} refused/failed"
            assert adapter.calls[-1] == native, (
                f"{plan_type} should dispatch as {native}, got {adapter.calls[-1]}"
            )

    @pytest.mark.asyncio
    async def test_pass_through_plan_types_execute_unchanged(self):
        adapter = _RecordingAdapter()
        executor = ComputerUseExecutor()
        executor.register(adapter.adapter_id, adapter)

        for plan_type in ("fill", "type", "scroll", "key", "hover"):
            result = await executor.execute(
                _req(plan_type), session_id="s-1", run_id="r-1"
            )
            assert result.status == "completed", f"{plan_type} refused/failed"
            assert adapter.calls[-1] == plan_type

    @pytest.mark.asyncio
    async def test_unknown_type_still_refuses_cleanly(self):
        adapter = _RecordingAdapter()
        executor = ComputerUseExecutor()
        executor.register(adapter.adapter_id, adapter)

        result = await executor.execute(
            _req("detonate"), session_id="s-1", run_id="r-1"
        )
        assert result.status == "failed"
        assert result.error["code"] == "UNSUPPORTED_ACTION"
        assert adapter.calls == []  # never reached an adapter

    @pytest.mark.asyncio
    async def test_envelope_reports_the_executed_native_action(self):
        adapter = _RecordingAdapter()
        executor = ComputerUseExecutor()
        executor.register(adapter.adapter_id, adapter)

        result = await executor.execute(
            _req("select", target="#plan", parameters={"text": "pro"}),
            session_id="s-1", run_id="r-1",
        )
        assert result.status == "completed"
        assert result.action == "fill"

    def test_plan_map_targets_stay_in_native_vocabulary(self):
        # Guard against the map drifting back out of alignment: every mapped
        # target must be either a native executor action or another accepted
        # plan-vocabulary member (identity mappings like hover rely on
        # adapter-level support and the waterfall).
        for plan_type, native in PLAN_ACTION_MAP.items():
            assert native in ALL_SUPPORTED_ACTIONS or native in PLAN_ACTION_MAP, (
                f"PLAN_ACTION_MAP[{plan_type!r}] = {native!r} is not an "
                f"accepted executor action"
            )


class TestPlanningLoopIntegrationShape:
    """cu26 real-model campaign finding: planning_loop._execute_action builds
    a plain ActionRequest-like object (type(\"ActionRequest\", (), {...})()),
    not a dataclass — the F2 dataclasses.replace translation crashed on every
    mapped plan type (\"replace() should be called on dataclass instances\")
    and the per-step arm could not run at all. These tests pin the plain-object
    path (dataclass callers are covered above)."""

    @pytest.mark.asyncio
    async def test_mapped_plan_type_on_plain_object_translates(self):
        adapter = _RecordingAdapter()
        executor = ComputerUseExecutor()
        executor.register(adapter.adapter_id, adapter)

        req = type("ActionRequest", (), {
            "action_type": "click",
            "target": "#next",
            "parameters": {},
        })()
        result = await executor.execute(req, session_id="s-1", run_id="r-1")
        assert result.status == "completed"
        assert adapter.calls[-1] == "left_click"
        # The caller's object must not be mutated (the loop keeps it on the
        # step record).
        assert req.action_type == "click"

    @pytest.mark.asyncio
    async def test_mapped_select_on_plain_object_translates(self):
        adapter = _RecordingAdapter()
        executor = ComputerUseExecutor()
        executor.register(adapter.adapter_id, adapter)

        req = type("ActionRequest", (), {
            "action_type": "select",
            "target": "#plan",
            "parameters": {"text": "pro"},
        })()
        result = await executor.execute(req, session_id="s-1", run_id="r-1")
        assert result.status == "completed"
        assert adapter.calls[-1] == "fill"
