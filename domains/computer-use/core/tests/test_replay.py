"""
Allternit Computer Use — Deterministic Replay Tests

Covers: disk-backed recording load/list, ReplayEngine step re-execution
(plain-adapter and executor signatures), after-screenshot deviation
pause/resume/abandon, and the /record + /replay HTTP surface.
"""

import asyncio
import base64
import io
import sys
import time
import uuid
from pathlib import Path

import pytest

# Import root is domains/computer-use/core (contains the inner core/ and
# gateway/ packages). tests/ sits next to them, so parents[1] is the root.
DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DOMAIN_CORE_ROOT / "gateway"))
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

# pytest may already have imported the OUTER domains/computer-use/core package
# (via core/__init__.py re-exports) as `core` — drop it so the inner core
# package (the real import root) wins.
_existing_core = sys.modules.get("core")
if _existing_core is not None:
    _existing_file = getattr(_existing_core, "__file__", "") or ""
    if Path(_existing_file).parent != DOMAIN_CORE_ROOT / "core":
        for _name in [
            m for m in list(sys.modules)
            if (m == "core" or m.startswith("core.")) and not m.startswith("core.tests")
        ]:
            del sys.modules[_name]

from core.action_recorder import (  # noqa: E402
    ActionRecorder,
    RecordedFrame,
    list_recordings,
    load_recording,
)
from core.replay_engine import (  # noqa: E402
    ReplayEngine,
    ReplayDeviation,
    screenshot_diff_score,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _solid_png_b64(color: tuple, size: tuple = (64, 64)) -> str:
    from PIL import Image

    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _png_bytes(color: tuple, size: tuple = (64, 64)) -> bytes:
    from PIL import Image

    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _make_recording(tmp_path: Path, frames_data: list, recording_id: str = "rec-test123") -> Path:
    recorder = ActionRecorder(
        recording_id=recording_id,
        task="test task",
        session_id="sess-test",
        run_id="run-test",
        output_dir=tmp_path,
        record_gif=False,
    )
    await recorder.start()
    for i, data in enumerate(frames_data):
        frame = RecordedFrame(
            recording_id=recording_id,
            step=i + 1,
            action_type=data.get("action_type", "screenshot"),
            action_target=data.get("action_target", ""),
            action_params=data.get("action_params", {}),
            after_screenshot_b64=data.get("after_screenshot_b64", ""),
        )
        await recorder.record_frame(frame)
    await recorder.stop()
    return recorder.get_path()


class StubResult:
    def __init__(self, status="completed", error=None):
        self.status = status
        self.error = error


class StubAdapter:
    """Plain adapter: execute(req) + direct screenshot(session_id)."""

    def __init__(self, screenshot_png: bytes = b""):
        self.executed = []
        self.screenshot_png = screenshot_png

    async def execute(self, req):
        self.executed.append({
            "action_type": req.action_type,
            "target": req.target,
            "parameters": req.parameters,
        })
        return StubResult()

    async def screenshot(self, session_id: str = "") -> bytes:
        return self.screenshot_png


class StubExecutorAdapter:
    """Executor-shaped adapter: registered_adapters() + execute(req, session_id, run_id)."""

    def __init__(self):
        self.executed = []

    def registered_adapters(self):
        return ["stub"]

    async def execute(self, req, session_id=None, run_id=None):
        self.executed.append({
            "action_type": req.action_type,
            "session_id": session_id,
            "run_id": run_id,
        })
        return StubResult()


# ---------------------------------------------------------------------------
# Disk load / list
# ---------------------------------------------------------------------------

class TestDiskLoad:
    async def test_record_load_roundtrip(self, tmp_path):
        red_b64 = _solid_png_b64((200, 0, 0))
        path = await _make_recording(tmp_path, [
            {"action_type": "navigate", "action_target": "https://example.com", "after_screenshot_b64": red_b64},
            {"action_type": "click", "action_params": {"x": 1, "y": 2}, "after_screenshot_b64": red_b64},
            {"action_type": "type", "action_params": {"text": "hi"}},
        ])
        assert path.is_file()

        manifest, frames, loaded_path = load_recording("rec-test123", tmp_path)
        assert loaded_path == path
        assert manifest.recording_id == "rec-test123"
        assert manifest.status == "completed"
        assert manifest.total_steps == 3
        assert len(frames) == 3
        assert frames[0].action_type == "navigate"
        assert frames[1].action_params == {"x": 1, "y": 2}
        assert frames[0].after_screenshot_b64 == red_b64

    async def test_load_missing_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_recording("rec-nope", tmp_path)

    def test_list_recordings(self, tmp_path):
        assert list_recordings(tmp_path) == []

        async def go():
            await _make_recording(tmp_path, [{"action_type": "screenshot"}], "rec-a")
            await _make_recording(tmp_path, [{"action_type": "click"}], "rec-b")

        asyncio.run(go())
        listings = list_recordings(tmp_path)
        assert len(listings) == 2
        ids = {r["recording_id"] for r in listings}
        assert ids == {"rec-a", "rec-b"}
        for entry in listings:
            assert entry["status"] == "completed"
            assert entry["path"].endswith(".jsonl")


# ---------------------------------------------------------------------------
# Screenshot diff
# ---------------------------------------------------------------------------

class TestScreenshotDiff:
    def test_identical_images_zero(self):
        b64 = _solid_png_b64((10, 200, 30))
        score = screenshot_diff_score(b64, base64.b64decode(b64))
        assert score is not None
        assert score < 0.01

    def test_different_images_high(self):
        red = _solid_png_b64((255, 0, 0))
        blue_png = _png_bytes((0, 0, 255))
        score = screenshot_diff_score(red, blue_png)
        assert score is not None
        assert score > 0.5

    def test_invalid_data_returns_none(self):
        assert screenshot_diff_score("", b"x") is None
        assert screenshot_diff_score("not-base64!!", b"x") is None
        assert screenshot_diff_score(_solid_png_b64((0, 0, 0)), b"") is None


# ---------------------------------------------------------------------------
# ReplayEngine
# ---------------------------------------------------------------------------

class TestReplayEngine:
    async def test_replays_all_steps_in_order(self, tmp_path):
        path = await _make_recording(tmp_path, [
            {"action_type": "navigate", "action_target": "https://a.com"},
            {"action_type": "click", "action_params": {"x": 5, "y": 7}},
            {"action_type": "type", "action_params": {"text": "hello"}},
        ])
        adapter = StubAdapter()
        engine = ReplayEngine(adapter=adapter, session_id="sess-x", deviation_threshold=None)
        result = await engine.replay(path)

        assert result.status == "completed"
        assert [s.status for s in result.steps] == ["ok", "ok", "ok"]
        assert [a["action_type"] for a in adapter.executed] == ["navigate", "click", "type"]
        assert adapter.executed[1]["parameters"] == {"x": 5, "y": 7}
        assert result.total_steps == 3

    async def test_executor_signature_supported(self, tmp_path):
        path = await _make_recording(tmp_path, [{"action_type": "screenshot"}])
        adapter = StubExecutorAdapter()
        engine = ReplayEngine(adapter=adapter, session_id="sess-exec", deviation_threshold=None)
        result = await engine.replay(path)

        assert result.status == "completed"
        assert adapter.executed[0]["session_id"] == "sess-exec"
        assert adapter.executed[0]["run_id"]

    async def test_step_error_recorded_and_replay_continues(self, tmp_path):
        path = await _make_recording(tmp_path, [
            {"action_type": "click"},
            {"action_type": "type"},
        ])

        class FlakyAdapter(StubAdapter):
            async def execute(self, req):
                self.executed.append({"action_type": req.action_type})
                if req.action_type == "click":
                    return StubResult(status="failed", error={"message": "boom"})
                return StubResult()

        engine = ReplayEngine(adapter=FlakyAdapter(), deviation_threshold=None)
        result = await engine.replay(path)
        assert result.status == "completed"
        assert result.steps[0].status == "error"
        assert result.steps[0].error == "boom"
        assert result.steps[1].status == "ok"
        assert len(result.steps) == 2

    async def test_no_adapter_marks_steps_error(self, tmp_path):
        path = await _make_recording(tmp_path, [{"action_type": "click"}])
        engine = ReplayEngine(adapter=None, deviation_threshold=None)
        result = await engine.replay(path)
        assert result.status == "completed"
        assert result.steps[0].status == "error"
        assert "no adapter" in result.steps[0].error

    async def test_matching_screenshot_no_deviation(self, tmp_path):
        png = _png_bytes((3, 4, 5))
        b64 = base64.b64encode(png).decode("ascii")
        path = await _make_recording(tmp_path, [
            {"action_type": "screenshot", "after_screenshot_b64": b64},
            {"action_type": "screenshot", "after_screenshot_b64": b64},
        ])
        engine = ReplayEngine(
            adapter=StubAdapter(screenshot_png=png),
            deviation_threshold=0.05,
        )
        result = await engine.replay(path)
        assert result.status == "completed"
        assert result.deviations == []
        assert all(s.deviation_score is not None and s.deviation_score < 0.05 for s in result.steps)

    async def test_deviation_pauses_and_resumes(self, tmp_path):
        red_b64 = _solid_png_b64((255, 0, 0))
        blue_png = _png_bytes((0, 0, 255))
        path = await _make_recording(tmp_path, [
            {"action_type": "click", "after_screenshot_b64": red_b64},
            {"action_type": "type"},
        ])
        seen = []

        async def approve(deviation: ReplayDeviation) -> bool:
            seen.append(deviation)
            return True

        engine = ReplayEngine(
            adapter=StubAdapter(screenshot_png=blue_png),
            deviation_threshold=0.05,
            approval_callback=approve,
        )
        result = await engine.replay(path)
        assert result.status == "completed"
        assert len(seen) == 1
        assert seen[0].step == 1
        assert seen[0].score > 0.05
        assert len(result.steps) == 2  # resumed and finished

    async def test_deviation_abandons_on_deny(self, tmp_path):
        red_b64 = _solid_png_b64((255, 0, 0))
        blue_png = _png_bytes((0, 0, 255))
        path = await _make_recording(tmp_path, [
            {"action_type": "click", "after_screenshot_b64": red_b64},
            {"action_type": "type"},
        ])

        async def deny(deviation: ReplayDeviation) -> bool:
            return False

        engine = ReplayEngine(
            adapter=StubAdapter(screenshot_png=blue_png),
            deviation_threshold=0.05,
            approval_callback=deny,
        )
        result = await engine.replay(path)
        assert result.status == "abandoned"
        assert len(result.deviations) == 1
        assert len(result.steps) == 1  # stopped at the deviating step

    async def test_deviation_without_callback_stops_as_deviated(self, tmp_path):
        red_b64 = _solid_png_b64((255, 0, 0))
        blue_png = _png_bytes((0, 0, 255))
        path = await _make_recording(tmp_path, [
            {"action_type": "click", "after_screenshot_b64": red_b64},
        ])
        engine = ReplayEngine(
            adapter=StubAdapter(screenshot_png=blue_png),
            deviation_threshold=0.05,
        )
        result = await engine.replay(path)
        assert result.status == "deviated"
        assert len(result.deviations) == 1

    async def test_cancel_event_stops_replay(self, tmp_path):
        path = await _make_recording(tmp_path, [
            {"action_type": "click"},
            {"action_type": "click"},
        ])
        cancel = asyncio.Event()
        cancel.set()
        engine = ReplayEngine(adapter=StubAdapter(), deviation_threshold=None, cancel_event=cancel)
        result = await engine.replay(path)
        assert result.status == "cancelled"
        assert result.steps == []

    async def test_events_emitted(self, tmp_path):
        path = await _make_recording(tmp_path, [{"action_type": "click"}])
        events = []
        engine = ReplayEngine(
            adapter=StubAdapter(),
            deviation_threshold=None,
            on_event=lambda e: events.append(e),
        )
        await engine.replay(path)
        types = [e["type"] for e in events]
        assert types[0] == "replay.started"
        assert "replay.step" in types
        assert types[-1] == "replay.finished"

    async def test_action_recorder_replay_wrapper(self, tmp_path):
        path = await _make_recording(tmp_path, [
            {"action_type": "click"},
            {"action_type": "type"},
        ])
        adapter = StubAdapter()
        result = await ActionRecorder.replay(path, adapter, "sess-wrap")
        assert result["status"] == "completed"
        assert result["replayed_steps"] == 2
        assert len(adapter.executed) == 2


# ---------------------------------------------------------------------------
# HTTP surface (/record, /recordings, /replay)
# ---------------------------------------------------------------------------

def _write_router_recording(tmp_path: Path, frames: list, recording_id: str) -> None:
    async def go():
        await _make_recording(tmp_path, frames, recording_id)

    asyncio.new_event_loop().run_until_complete(go())


@pytest.fixture()
def router_client(tmp_path, monkeypatch):
    """FastAPI TestClient with the router, recordings redirected to tmp_path."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    import core.action_recorder as action_recorder_module
    import computer_use_router as router_module

    state = {"adapter": None}
    monkeypatch.setattr(action_recorder_module, "DEFAULT_RECORDINGS_DIR", tmp_path)
    monkeypatch.setattr(router_module, "_get_adapter_for_planning", lambda *a, **k: state["adapter"])

    app = FastAPI()
    app.include_router(router_module.router)
    with TestClient(app) as client:
        client._stub_adapter = StubAdapter(screenshot_png=_png_bytes((9, 9, 9)))
        state["adapter"] = client._stub_adapter
        yield client


class TestRecordingsHTTP:
    def test_record_append_stop_and_list(self, router_client):
        r = router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-http",
            "action": "start",
            "name": "http-test",
            "record_gif": False,
        })
        assert r.status_code == 200
        recording_id = r.json()["recording_id"]

        shot = _solid_png_b64((9, 9, 9))
        r = router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-http",
            "action": "append",
            "recording_id": recording_id,
            "frames": [
                {"step": 1, "action_type": "navigate", "action_target": "https://example.com", "after_screenshot_b64": shot},
                {"step": 2, "action_type": "click", "action_params": {"x": 3, "y": 4}, "after_screenshot_b64": shot},
                {"step": 3, "action_type": "type", "action_params": {"text": "done"}},
            ],
        })
        assert r.status_code == 200
        assert r.json()["appended"] == 3

        r = router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-http",
            "action": "stop",
            "recording_id": recording_id,
        })
        assert r.status_code == 200
        assert r.json()["frames"] == 3
        assert r.json()["status"] == "stopped"

        # Recorder has been popped — disk listing must still see it.
        r = router_client.get("/v1/computer-use/recordings")
        assert r.status_code == 200
        entries = [e for e in r.json()["recordings"] if e["recording_id"] == recording_id]
        assert len(entries) == 1
        assert entries[0]["status"] == "completed"
        assert entries[0]["total_steps"] == 3

    def test_replay_unknown_recording_404s(self, router_client):
        r = router_client.post("/v1/computer-use/replay", json={"recording_id": "rec-missing"})
        assert r.status_code == 404


class TestReplayHTTP:
    def test_replay_from_disk_after_stop(self, router_client):
        shot = _solid_png_b64((9, 9, 9))
        start = router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-replay", "action": "start", "record_gif": False,
        })
        recording_id = start.json()["recording_id"]
        router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-replay", "action": "append", "recording_id": recording_id,
            "frames": [
                {"step": 1, "action_type": "screenshot", "after_screenshot_b64": shot},
                {"step": 2, "action_type": "screenshot", "after_screenshot_b64": shot},
                {"step": 3, "action_type": "screenshot"},
            ],
        })
        router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-replay", "action": "stop", "recording_id": recording_id,
        })

        r = router_client.post("/v1/computer-use/replay", json={
            "recording_id": recording_id,
            "deviation_threshold": 0.05,
            "wait": True,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "completed"
        assert body["result"]["replayed_steps"] == 3
        assert body["result"]["deviations"] == []
        executed = router_client._stub_adapter.executed
        assert [a["action_type"] for a in executed] == ["screenshot", "screenshot", "screenshot"]

    def test_replay_deviation_pauses_for_approval(self, router_client):
        recorded = _solid_png_b64((255, 0, 0))  # recorded red, live is (9,9,9) → deviation
        start = router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-dev", "action": "start", "record_gif": False,
        })
        recording_id = start.json()["recording_id"]
        router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-dev", "action": "append", "recording_id": recording_id,
            "frames": [
                {"step": 1, "action_type": "screenshot", "after_screenshot_b64": recorded},
                {"step": 2, "action_type": "screenshot", "after_screenshot_b64": recorded},
            ],
        })
        router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-dev", "action": "stop", "recording_id": recording_id,
        })

        r = router_client.post("/v1/computer-use/replay", json={
            "recording_id": recording_id,
            "deviation_threshold": 0.05,
        })
        assert r.status_code == 200
        run_id = r.json()["run_id"]

        # The replay should park in awaiting_approval at the first deviating step.
        deadline = time.time() + 10
        state = {}
        while time.time() < deadline:
            state = router_client.get(f"/v1/computer-use/runs/{run_id}").json()
            if state.get("status") == "awaiting_approval":
                break
            time.sleep(0.1)
        assert state.get("status") == "awaiting_approval", f"never paused: {state}"

        # Deny → replay abandons.
        r = router_client.post(f"/v1/computer-use/runs/{run_id}/approve", json={"decision": "deny"})
        assert r.status_code == 200

        deadline = time.time() + 10
        while time.time() < deadline:
            state = router_client.get(f"/v1/computer-use/runs/{run_id}").json()
            if state.get("status") in ("abandoned", "completed", "deviated"):
                break
            time.sleep(0.1)
        assert state.get("status") == "abandoned"
        assert len(state["result"]["deviations"]) == 1

    def test_replay_deviation_approve_resumes(self, router_client):
        recorded = _solid_png_b64((255, 0, 0))
        matching = _solid_png_b64((9, 9, 9))  # stub adapter's live screenshot
        start = router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-dev2", "action": "start", "record_gif": False,
        })
        recording_id = start.json()["recording_id"]
        router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-dev2", "action": "append", "recording_id": recording_id,
            "frames": [
                {"step": 1, "action_type": "screenshot", "after_screenshot_b64": recorded},
                {"step": 2, "action_type": "screenshot", "after_screenshot_b64": matching},
            ],
        })
        router_client.post("/v1/computer-use/record", json={
            "session_id": "sess-dev2", "action": "stop", "recording_id": recording_id,
        })

        r = router_client.post("/v1/computer-use/replay", json={
            "recording_id": recording_id,
            "deviation_threshold": 0.05,
        })
        run_id = r.json()["run_id"]

        deadline = time.time() + 10
        state = {}
        while time.time() < deadline:
            state = router_client.get(f"/v1/computer-use/runs/{run_id}").json()
            if state.get("status") == "awaiting_approval":
                break
            time.sleep(0.1)
        assert state.get("status") == "awaiting_approval"

        router_client.post(f"/v1/computer-use/runs/{run_id}/approve", json={"decision": "approve"})

        deadline = time.time() + 10
        while time.time() < deadline:
            state = router_client.get(f"/v1/computer-use/runs/{run_id}").json()
            if state.get("status") in ("abandoned", "completed", "deviated"):
                break
            time.sleep(0.1)
        assert state.get("status") == "completed"
        assert state["result"]["replayed_steps"] == 2
