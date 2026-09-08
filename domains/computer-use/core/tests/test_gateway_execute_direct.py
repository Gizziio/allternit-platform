"""
Allternit Computer Use — Gateway direct-execute, recorder GIF, and approval-event tests

Covers:
  * POST /v1/computer-use/execute mode='direct' — per-action results, screenshot
    artifact, adapter dispatch (no planning loop), request validation.
  * ActionRecorder.load() preserving gif_path (record → stop → load → export).
  * Machine-readable approval.required / approval.resolved SSE events carrying
    run status for both replay-deviation pauses and planning-loop pauses.
"""

import asyncio
import base64
import io
import sys
import time
import uuid
from pathlib import Path

import pytest
from pydantic import ValidationError

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

import computer_use_router as router_module  # noqa: E402
from core.action_recorder import ActionRecorder, load_recording  # noqa: E402


def _png_b64(color=(20, 40, 60), size=(32, 32)) -> str:
    from PIL import Image

    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


class StubResult:
    def __init__(self, status="completed", error=None):
        self.status = status
        self.error = error

    def to_dict(self):
        return {"status": self.status, "error": self.error}


class StubAdapter:
    """Plain adapter: execute(req) + direct screenshot(session_id)."""

    def __init__(self, screenshot_png: bytes = b"", fail_kinds=None):
        self.executed = []
        self.screenshot_png = screenshot_png
        self.fail_kinds = fail_kinds or set()

    async def execute(self, req):
        self.executed.append({
            "action_type": req.action_type,
            "target": req.target,
            "parameters": req.parameters,
        })
        if req.action_type in self.fail_kinds:
            raise RuntimeError(f"boom on {req.action_type}")
        return StubResult()

    async def screenshot(self, session_id: str = "") -> bytes:
        return self.screenshot_png


def _make_client(request, monkeypatch, tmp_path, adapter):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    import core.action_recorder as action_recorder_module

    monkeypatch.setattr(action_recorder_module, "DEFAULT_RECORDINGS_DIR", tmp_path)
    monkeypatch.setattr(router_module, "_get_adapter_for_planning", lambda *a, **k: adapter)

    app = FastAPI()
    app.include_router(router_module.router)
    client = TestClient(app)
    # Enter the portal context so background asyncio tasks (replay runs,
    # direct executes) keep running after individual requests return.
    client.__enter__()
    request.addfinalizer(lambda: client.__exit__(None, None, None))
    return client


def _drain_events(run_id: str):
    """Non-blocking drain of the run-store event queue (no SSE consumer in tests)."""
    q = router_module._run_store.event_queues.get(run_id)
    events = []
    if q is None:
        return events
    while not q.empty():
        item = q.get_nowait()
        if item is not None:
            events.append(item)
    return events


def _wait_for_status(run_id: str, wanted, timeout=15.0):
    deadline = time.time() + timeout
    state = {}
    while time.time() < deadline:
        state = router_module._run_store.get(run_id)
        if state is not None and state.status in wanted:
            return state
        time.sleep(0.05)
    raise AssertionError(f"run {run_id} never reached {wanted}; last={state.to_dict() if state else None}")


# ---------------------------------------------------------------------------
# ExecuteBody validation
# ---------------------------------------------------------------------------

class TestExecuteBodyValidation:
    def test_direct_requires_actions(self):
        with pytest.raises(ValidationError):
            router_module.ExecuteBody(mode="direct")

    def test_direct_with_empty_actions_rejected(self):
        with pytest.raises(ValidationError):
            router_module.ExecuteBody(mode="direct", actions=[])

    def test_non_direct_modes_require_task(self):
        with pytest.raises(ValidationError):
            router_module.ExecuteBody(mode="intent")
        with pytest.raises(ValidationError):
            router_module.ExecuteBody(mode="assist")

    def test_default_mode_with_task_ok(self):
        body = router_module.ExecuteBody(task="open the browser")
        assert body.mode == "intent"
        assert body.task == "open the browser"

    def test_direct_with_actions_ok(self):
        body = router_module.ExecuteBody(mode="direct", actions=[
            {"kind": "click", "target": {"selector": "#go"}, "input": {"x": 1}},
        ])
        assert body.actions[0].kind == "click"
        assert body.actions[0].target == {"selector": "#go"}


# ---------------------------------------------------------------------------
# POST /execute mode='direct'
# ---------------------------------------------------------------------------

class TestDirectExecuteHTTP:
    def test_direct_executes_actions_without_planning_loop(self, request, monkeypatch, tmp_path):
        png = base64.b64decode(_png_b64())
        adapter = StubAdapter(screenshot_png=png)
        client = _make_client(request, monkeypatch, tmp_path, adapter)

        r = client.post("/v1/computer-use/execute", json={
            "mode": "direct",
            "session_id": "sess-direct",
            "actions": [
                {"kind": "navigate", "target": {"url": "https://example.com"}, "input": {"timeout_ms": 5000}},
                {"kind": "click", "target": {"coordinates": [10, 20]}, "action_id": "click-go"},
                {"kind": "type", "target": {"selector": "#name"}, "input": {"text": "hello"}},
            ],
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mode"] == "direct"
        assert body["status"] == "completed"
        assert body["summary"] == "Executed 3/3 actions"

        # Per-action results in order.
        actions = body["result"]["actions"]
        assert [a["kind"] for a in actions] == ["navigate", "click", "type"]
        assert all(a["status"] == "ok" for a in actions)
        assert actions[1]["action_id"] == "click-go"
        assert actions[0]["result"] == {"status": "completed", "error": None}

        # Adapter dispatch mapping: kind→action_type, target→selector/coords, input→parameters.
        assert [a["action_type"] for a in adapter.executed] == ["navigate", "click", "type"]
        assert adapter.executed[0]["target"] == "https://example.com"
        assert adapter.executed[0]["parameters"] == {"timeout_ms": 5000}
        assert adapter.executed[1]["target"] == "10,20"
        assert adapter.executed[2]["target"] == "#name"
        assert adapter.executed[2]["parameters"] == {"text": "hello"}

        # Final screenshot artifact.
        assert body["result"]["screenshot_b64"] == _png_b64()
        assert body["artifacts"][0]["type"] == "screenshot"
        assert body["artifacts"][0]["mime"] == "image/png"

    def test_direct_records_per_action_errors(self, request, monkeypatch, tmp_path):
        adapter = StubAdapter(fail_kinds={"click"})
        client = _make_client(request, monkeypatch, tmp_path, adapter)

        r = client.post("/v1/computer-use/execute", json={
            "mode": "direct",
            "actions": [{"kind": "click"}, {"kind": "type"}],
        })
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "failed"
        actions = body["result"]["actions"]
        assert actions[0]["status"] == "error"
        assert "boom on click" in actions[0]["error"]
        assert actions[1]["status"] == "ok"
        assert body["result"]["succeeded"] == 1
        assert "1/2" in body["summary"]

    def test_direct_without_adapter_fails_per_action(self, request, monkeypatch, tmp_path):
        client = _make_client(request, monkeypatch, tmp_path, None)
        r = client.post("/v1/computer-use/execute", json={
            "mode": "direct",
            "actions": [{"kind": "click"}],
        })
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "failed"
        assert "no adapter" in body["result"]["actions"][0]["error"]

    def test_direct_streams_events(self, request, monkeypatch, tmp_path):
        adapter = StubAdapter(screenshot_png=base64.b64decode(_png_b64()))
        client = _make_client(request, monkeypatch, tmp_path, adapter)

        r = client.post("/v1/computer-use/execute?stream=true", json={
            "mode": "direct",
            "actions": [{"kind": "click"}, {"kind": "type"}],
        })
        assert r.status_code == 200
        text = r.text
        assert "action.started" in text
        assert "action.completed" in text
        assert "run.ended" in text

    def test_direct_mode_with_no_actions_is_422(self, request, monkeypatch, tmp_path):
        client = _make_client(request, monkeypatch, tmp_path, StubAdapter())
        r = client.post("/v1/computer-use/execute", json={"mode": "direct"})
        assert r.status_code == 422

    def test_intent_mode_without_task_is_422(self, request, monkeypatch, tmp_path):
        client = _make_client(request, monkeypatch, tmp_path, StubAdapter())
        r = client.post("/v1/computer-use/execute", json={"mode": "intent"})
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Recorder gif_path preservation (record → stop → load → export_gif)
# ---------------------------------------------------------------------------

class _FakeGIFRecorder:
    """Stand-in for core.gif_recorder.GIFRecorder (imageio not installed in venv)."""

    def __init__(self, fps=2, scale=0.5, max_frames=600, output_dir="/tmp"):
        self.output_dir = Path(output_dir)
        self.frames = []
        self._running = False

    def start(self):
        self._running = True

    def is_running(self):
        return self._running

    def add_frame_b64(self, b64, action_label="", step=0):
        self.frames.append(b64)

    def stop(self):
        self._running = False

    @property
    def frame_count(self):
        return len(self.frames)

    def save(self, path=None, run_id="", annotate=False):
        from PIL import Image

        if not self.frames:
            return None
        gif_path = self.output_dir / f"{run_id or 'recording'}.gif"
        img = Image.new("RGB", (8, 8), (1, 2, 3))
        img.save(gif_path, format="GIF")
        return gif_path


@pytest.fixture()
def fake_gif(monkeypatch):
    import core.action_recorder as action_recorder_module

    monkeypatch.setattr(action_recorder_module, "GIFRecorder", _FakeGIFRecorder)
    monkeypatch.setattr(action_recorder_module, "_gif_available", lambda: True)
    return _FakeGIFRecorder


class TestRecorderGifPath:
    async def test_load_preserves_gif_path(self, tmp_path, fake_gif):
        shot = _png_b64()
        recorder = ActionRecorder(
            recording_id="rec-gif1",
            task="gif task",
            session_id="sess-gif",
            run_id="run-gif",
            output_dir=tmp_path,
            record_gif=True,
        )
        await recorder.start()
        from core.action_recorder import RecordedFrame

        frame = RecordedFrame(
            recording_id="rec-gif1", step=1, action_type="click",
            after_screenshot_b64=shot,
        )
        await recorder.record_frame(frame)
        recorder.feed_gif_frame(frame)
        await recorder.stop()
        gif_path = recorder.get_gif_path()
        assert gif_path is not None and gif_path.exists()

        # The bug: load() reconstructed the manifest without gif_path.
        manifest, frames = ActionRecorder.load(recorder.get_path())
        assert manifest.gif_path == str(gif_path)
        assert manifest.status == "completed"
        assert manifest.completed_at

        _manifest, _frames, _path = load_recording("rec-gif1", tmp_path)
        assert manifest.gif_path == str(gif_path)

    def test_replay_export_gif_after_stop(self, fake_gif, monkeypatch, tmp_path):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        import core.action_recorder as action_recorder_module

        monkeypatch.setattr(action_recorder_module, "DEFAULT_RECORDINGS_DIR", tmp_path)
        app = FastAPI()
        app.include_router(router_module.router)
        client = TestClient(app)

        shot = _png_b64()
        start = client.post("/v1/computer-use/record", json={
            "session_id": "sess-gif-http", "action": "start", "record_gif": True,
        })
        assert start.status_code == 200, start.text
        recording_id = start.json()["recording_id"]

        client.post("/v1/computer-use/record", json={
            "session_id": "sess-gif-http", "action": "append", "recording_id": recording_id,
            "frames": [
                {"step": 1, "action_type": "click", "after_screenshot_b64": shot},
                {"step": 2, "action_type": "type", "after_screenshot_b64": shot},
            ],
        })
        stop = client.post("/v1/computer-use/record", json={
            "session_id": "sess-gif-http", "action": "stop", "recording_id": recording_id,
        })
        assert stop.status_code == 200
        gif_path = stop.json()["gif_path"]
        assert gif_path and Path(gif_path).exists()

        # Completed recording: in-flight registry no longer holds the recorder,
        # so export must resolve the GIF through the on-disk manifest.
        r = client.post("/v1/computer-use/replay", json={
            "recording_id": recording_id, "export_gif": True,
        })
        assert r.status_code == 200, r.text
        assert r.json()["gif_path"] == gif_path
        assert r.json()["status"] == "exported"

    def test_replay_export_gif_404_when_no_gif(self, monkeypatch, tmp_path):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        import core.action_recorder as action_recorder_module

        monkeypatch.setattr(action_recorder_module, "DEFAULT_RECORDINGS_DIR", tmp_path)
        app = FastAPI()
        app.include_router(router_module.router)
        client = TestClient(app)

        start = client.post("/v1/computer-use/record", json={
            "session_id": "sess-nogif", "action": "start", "record_gif": False,
        })
        recording_id = start.json()["recording_id"]
        client.post("/v1/computer-use/record", json={
            "session_id": "sess-nogif", "action": "append", "recording_id": recording_id,
            "frames": [{"step": 1, "action_type": "click"}],
        })
        client.post("/v1/computer-use/record", json={
            "session_id": "sess-nogif", "action": "stop", "recording_id": recording_id,
        })
        r = client.post("/v1/computer-use/replay", json={
            "recording_id": recording_id, "export_gif": True,
        })
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# Machine-readable approval events
# ---------------------------------------------------------------------------

def _record_and_start_deviating_replay(client, tmp_path):
    recorded = _png_b64((255, 0, 0))  # live stub screenshot differs → deviation
    start = client.post("/v1/computer-use/record", json={
        "session_id": "sess-appr", "action": "start", "record_gif": False,
    })
    recording_id = start.json()["recording_id"]
    client.post("/v1/computer-use/record", json={
        "session_id": "sess-appr", "action": "append", "recording_id": recording_id,
        "frames": [
            {"step": 1, "action_type": "screenshot", "after_screenshot_b64": recorded},
            {"step": 2, "action_type": "screenshot", "after_screenshot_b64": recorded},
        ],
    })
    client.post("/v1/computer-use/record", json={
        "session_id": "sess-appr", "action": "stop", "recording_id": recording_id,
    })
    r = client.post("/v1/computer-use/replay", json={
        "recording_id": recording_id, "deviation_threshold": 0.05,
    })
    assert r.status_code == 200
    return r.json()["run_id"]


class TestApprovalEvents:
    def test_replay_deviation_emits_machine_readable_events(self, request, monkeypatch, tmp_path):
        adapter = StubAdapter(screenshot_png=base64.b64decode(_png_b64()))
        client = _make_client(request, monkeypatch, tmp_path, adapter)
        run_id = _record_and_start_deviating_replay(client, tmp_path)

        state = _wait_for_status(run_id, {"awaiting_approval"})
        # GET /runs/{id} reflects the pause without polling ambiguity.
        run_dict = client.get(f"/v1/computer-use/runs/{run_id}").json()
        assert run_dict["status"] == "awaiting_approval"

        events = _drain_events(run_id)
        required = [e for e in events if e.get("event_type") == "approval.required"]
        assert len(required) == 1
        assert required[0]["data"]["status"] == "awaiting_approval"
        assert required[0]["data"]["kind"] == "replay.deviation"
        assert required[0]["data"]["deviation"]["step"] == 1
        assert required[0]["data"]["deviation"]["score"] > 0.05
        assert required[0]["data"]["timeout_seconds"] == 120.0

        # Deny → approval.resolved(approved=false), run abandons.
        client.post(f"/v1/computer-use/runs/{run_id}/approve", json={"decision": "deny"})
        _wait_for_status(run_id, {"abandoned"})
        resolved = [e for e in _drain_events(run_id) if e.get("event_type") == "approval.resolved"]
        assert len(resolved) == 1
        assert resolved[0]["data"]["approved"] is False
        assert resolved[0]["data"]["timed_out"] is False
        assert resolved[0]["data"]["status"] == "running"  # status after resolution

    def test_replay_deviation_approve_emits_resolved(self, request, monkeypatch, tmp_path):
        adapter = StubAdapter(screenshot_png=base64.b64decode(_png_b64((9, 9, 9))))
        client = _make_client(request, monkeypatch, tmp_path, adapter)
        run_id = _record_and_start_deviating_replay(client, tmp_path)

        _wait_for_status(run_id, {"awaiting_approval"})
        _drain_events(run_id)
        client.post(f"/v1/computer-use/runs/{run_id}/approve", json={"decision": "approve"})
        _wait_for_status(run_id, {"completed", "awaiting_approval"})
        state = router_module._run_store.get(run_id)
        if state.status == "awaiting_approval":
            # Second frame deviates too — resolve it as well.
            client.post(f"/v1/computer-use/runs/{run_id}/approve", json={"decision": "approve"})
            _wait_for_status(run_id, {"completed"})
        resolved = [e for e in _drain_events(run_id) if e.get("event_type") == "approval.resolved"]
        assert resolved and resolved[0]["data"]["approved"] is True

    async def test_planning_loop_approval_emits_machine_readable_events(self, monkeypatch, tmp_path):
        if not router_module._planning_available:
            pytest.skip("planning loop not importable in this environment")

        adapter = StubAdapter(screenshot_png=base64.b64decode(_png_b64()))
        monkeypatch.setattr(router_module, "_get_adapter_for_planning", lambda *a, **k: adapter)

        body = router_module.ExecuteBody(
            task="click submit",
            options={
                "vision_provider": "mock",
                "approval_policy": "always",
                "record": False,
                "max_steps": 5,
            },
        )
        run_state = router_module._run_store.create(
            run_id=f"cu-test-{uuid.uuid4().hex[:8]}",
            session_id=body.session_id,
            mode=body.mode,
            target_scope=body.target_scope,
        )

        async def wait_status(wanted, timeout=30.0):
            deadline = time.time() + timeout
            while time.time() < deadline:
                if run_state.status in wanted:
                    return
                await asyncio.sleep(0.05)
            raise AssertionError(
                f"run {run_state.run_id} never reached {wanted}; status={run_state.status}"
            )

        task = asyncio.create_task(router_module._execute_non_claude_path(body, run_state))
        try:
            await wait_status({"awaiting_approval", "failed", "completed"})
            assert run_state.status == "awaiting_approval"

            events = _drain_events(run_state.run_id)
            required = [e for e in events if e.get("event_type") == "approval.required"]
            assert len(required) == 1
            assert required[0]["data"]["status"] == "awaiting_approval"
            assert required[0]["data"]["kind"] == "planning_loop"
            assert required[0]["data"]["step"] == 1

            # Resolve the gate the same way POST /runs/{id}/approve does.
            future = run_state.approval_future
            assert future is not None and not future.done()
            future.set_result({"decision": "approve", "comment": ""})

            deadline = time.time() + 10
            resolved = []
            while time.time() < deadline:
                resolved = [
                    e for e in _drain_events(run_state.run_id)
                    if e.get("event_type") == "approval.resolved"
                ]
                if resolved:
                    break
                await asyncio.sleep(0.05)
            assert len(resolved) == 1
            assert resolved[0]["data"]["approved"] is True
            assert resolved[0]["data"]["timed_out"] is False
            assert resolved[0]["data"]["kind"] == "planning_loop"
            assert resolved[0]["data"]["step"] == 1
        finally:
            run_state.cancel_event.set()
            task.cancel()
            try:
                await task
            except BaseException:
                pass
