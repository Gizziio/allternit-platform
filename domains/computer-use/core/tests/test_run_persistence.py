"""
Allternit Computer Use — Run persistence + canonical wiring tests

Covers:
  * RunPersistence unit behavior (upsert/get/list, recordings index,
    mark_interrupted).
  * Restart survival: runs finalized to SQLite are served by a FRESH RunStore
    backed by the same file (simulates gateway restart).
  * HTTP: GET /v1/computer-use/runs lists live + historical runs;
    GET /v1/computer-use/recordings/index reflects record start/stop;
    GET /runs/{id}/events for a historical run returns 404 (no queue).
  * Canonical emission: lifecycle/approval events are emitted through
    _emit_canonical (monkeypatched recorder) for direct, replay, and
    planning paths.
"""

import asyncio
import importlib
import json
import sys
import time
import uuid
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

import computer_use_router as router_module  # noqa: E402
from computer_use_router import RunState, RunStore  # noqa: E402
from run_persistence import RunPersistence  # noqa: E402


class StubResult:
    def __init__(self, status="completed", error=None):
        self.status = status
        self.error = error

    def to_dict(self):
        return {"status": self.status, "error": self.error}


class StubAdapter:
    async def execute(self, req):
        return StubResult()

    async def screenshot(self, session_id: str = "") -> bytes:
        return b""


def _state(run_id: str, status: str = "running", result=None, error=None) -> RunState:
    state = RunState(run_id, "sess-x", "direct", "browser")
    state.status = status
    state.result = result
    state.error = error
    return state


# ---------------------------------------------------------------------------
# Unit: RunPersistence
# ---------------------------------------------------------------------------

class TestRunPersistence:
    def test_upsert_and_get(self, tmp_path):
        store = RunPersistence(tmp_path / "runs.sqlite3")
        store.upsert_run(_state("run-1", "completed", {"summary": "ok"}))
        record = store.get_run("run-1")
        assert record["status"] == "completed"
        assert record["result"] == {"summary": "ok"}
        assert record["mode"] == "direct"
        store.close()

    def test_upsert_updates_in_place(self, tmp_path):
        store = RunPersistence(tmp_path / "runs.sqlite3")
        store.upsert_run(_state("run-1", "running"))
        store.upsert_run(_state("run-1", "failed", error="boom"))
        records = store.list_runs()
        assert len(records) == 1
        assert records[0]["status"] == "failed"
        assert records[0]["error"] == "boom"
        store.close()

    def test_mark_interrupted(self, tmp_path):
        store = RunPersistence(tmp_path / "runs.sqlite3")
        store.upsert_run(_state("run-live", "running"))
        store.upsert_run(_state("run-paused", "awaiting_approval"))
        store.upsert_run(_state("run-done", "completed"))
        interrupted = store.mark_interrupted()
        assert interrupted == 2
        assert store.get_run("run-live")["status"] == "interrupted"
        assert store.get_run("run-done")["status"] == "completed"
        store.close()

    def test_recordings_index_roundtrip(self, tmp_path):
        store = RunPersistence(tmp_path / "runs.sqlite3")
        store.upsert_recording({
            "recording_id": "rec-1", "task": "login", "session_id": "s1",
            "run_id": "r1", "status": "recording", "started_at": "2026-09-08T00:00:00Z",
            "path": "/tmp/rec-1.jsonl",
        })
        store.upsert_recording({
            "recording_id": "rec-1", "task": "login", "session_id": "s1",
            "run_id": "r1", "status": "completed", "started_at": "2026-09-08T00:00:00Z",
            "completed_at": "2026-09-08T00:01:00Z", "total_steps": 4,
            "path": "/tmp/rec-1.jsonl", "gif_path": "/tmp/rec-1.gif",
        })
        index = store.list_recordings_index()
        assert len(index) == 1
        assert index[0]["status"] == "completed"
        assert index[0]["total_steps"] == 4
        assert index[0]["gif_path"] == "/tmp/rec-1.gif"
        store.close()


# ---------------------------------------------------------------------------
# Restart survival: fresh RunStore, same SQLite file
# ---------------------------------------------------------------------------

class TestRestartSurvival:
    def test_historical_run_served_after_restart(self, tmp_path):
        db = tmp_path / "runs.sqlite3"
        store = RunStore()
        store.attach_persistence(RunPersistence(db))
        before = store.create("run-hist", "sess-x", "workflow", "browser")
        before.status = "completed"
        before.result = {"steps": [{"step_id": "s1", "status": "ok"}]}
        store.finalize("run-hist")

        # Fresh store — same file, as after a gateway restart
        restarted = RunStore()
        restarted.attach_persistence(RunPersistence(db))
        state = restarted.get("run-hist")
        assert state is not None
        assert state.status == "completed"
        assert state.result["steps"][0]["step_id"] == "s1"
        assert restarted.get("run-missing") is None

    def test_non_terminal_run_marked_interrupted_on_restart(self, tmp_path):
        db = tmp_path / "runs.sqlite3"
        store = RunStore()
        store.attach_persistence(RunPersistence(db))
        store.create("run-live", "sess-x", "direct", "browser")  # still running

        restarted = RunStore()
        restarted.attach_persistence(RunPersistence(db))
        assert restarted.get("run-live").status == "interrupted"

    def test_list_runs_merges_live_and_history(self, tmp_path):
        db = tmp_path / "runs.sqlite3"
        store = RunStore()
        store.attach_persistence(RunPersistence(db))
        old = store.create("run-old", "sess-x", "direct", "browser")
        old.status = "completed"
        store.finalize("run-old")
        store.runs.pop("run-old")  # aged out of memory; only in DB now
        store.create("run-new", "sess-x", "direct", "browser")
        ids = {r["run_id"] for r in store.list_runs()}
        assert {"run-old", "run-new"} <= ids


# ---------------------------------------------------------------------------
# HTTP surface
# ---------------------------------------------------------------------------

def _make_client(monkeypatch, tmp_path, adapter):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    monkeypatch.setattr(router_module, "_get_adapter_for_planning", lambda *a, **k: adapter)
    persistence = RunPersistence(tmp_path / "runs.sqlite3")
    fresh_store = RunStore()
    fresh_store.attach_persistence(persistence)
    monkeypatch.setattr(router_module, "_run_store", fresh_store)
    app = FastAPI()
    app.include_router(router_module.router)
    client = TestClient(app)
    client.__enter__()
    return client, fresh_store, persistence


class TestPersistenceHTTP:
    def test_runs_endpoint_lists_history_after_restart(self, monkeypatch, tmp_path):
        adapter = StubAdapter()
        client, store, persistence = _make_client(monkeypatch, tmp_path, adapter)
        try:
            run_id = f"cu-{uuid.uuid4().hex[:12]}"
            resp = client.post("/v1/computer-use/execute", json={
                "mode": "direct",
                "actions": [{"kind": "screenshot", "target": {"ref": "page"}}],
                "run_id": run_id,
                "session_id": "sess-persist",
            })
            assert resp.json()["status"] == "completed"

            # Simulate restart: brand-new RunStore over the same DB
            restarted = RunStore()
            restarted.attach_persistence(persistence)
            monkeypatch.setattr(router_module, "_run_store", restarted)

            poll = client.get(f"/v1/computer-use/runs/{run_id}")
            assert poll.status_code == 200
            assert poll.json()["status"] == "completed"
            assert poll.json()["mode"] == "direct"

            listed = client.get("/v1/computer-use/runs").json()["runs"]
            assert run_id in {r["run_id"] for r in listed}
        finally:
            client.__exit__(None, None, None)

    def test_historical_run_events_endpoint_404(self, monkeypatch, tmp_path):
        adapter = StubAdapter()
        client, store, persistence = _make_client(monkeypatch, tmp_path, adapter)
        try:
            run_id = f"cu-{uuid.uuid4().hex[:12]}"
            client.post("/v1/computer-use/execute", json={
                "mode": "direct",
                "actions": [{"kind": "screenshot"}],
                "run_id": run_id,
                "session_id": "sess-persist2",
            })
            restarted = RunStore()
            restarted.attach_persistence(persistence)
            monkeypatch.setattr(router_module, "_run_store", restarted)
            events = client.get(f"/v1/computer-use/runs/{run_id}/events")
            assert events.status_code == 404
        finally:
            client.__exit__(None, None, None)

    def test_recordings_index_endpoint(self, monkeypatch, tmp_path):
        adapter = StubAdapter()
        client, store, persistence = _make_client(monkeypatch, tmp_path, adapter)
        try:
            started = client.post("/v1/computer-use/record", json={
                "session_id": "sess-idx", "action": "start", "record_gif": False,
                "name": "indexed-recording",
            })
            recording_id = started.json()["recording_id"]
            client.post("/v1/computer-use/record", json={
                "session_id": "sess-idx", "action": "stop", "recording_id": recording_id,
            })
            index = client.get("/v1/computer-use/recordings/index").json()
            entry = next(r for r in index["recordings"] if r["recording_id"] == recording_id)
            assert entry["status"] == "completed"
            assert entry["task"] == "indexed-recording"
        finally:
            client.__exit__(None, None, None)


# ---------------------------------------------------------------------------
# Canonical event emission wiring
# ---------------------------------------------------------------------------

class TestCanonicalEmission:
    @pytest.fixture()
    def canonical_recorder(self, monkeypatch):
        calls = []
        monkeypatch.setattr(router_module, "_emit_canonical",
                            lambda event_type, **kw: calls.append((event_type, kw)))
        return calls

    def test_direct_path_emits_lifecycle(self, monkeypatch, tmp_path, canonical_recorder):
        adapter = StubAdapter()
        client, _store, _p = _make_client(monkeypatch, tmp_path, adapter)
        try:
            client.post("/v1/computer-use/execute", json={
                "mode": "direct",
                "actions": [{"kind": "screenshot"}],
                "session_id": "sess-canon",
            })
        finally:
            client.__exit__(None, None, None)
        event_types = [t for t, _ in canonical_recorder]
        assert "run.completed" in event_types
        assert all(kw.get("session_id") for _, kw in canonical_recorder)

    def test_replay_path_emits_lifecycle(self, monkeypatch, tmp_path, canonical_recorder):
        import core.action_recorder as action_recorder_module

        monkeypatch.setattr(action_recorder_module, "DEFAULT_RECORDINGS_DIR", tmp_path)
        adapter = StubAdapter()
        client, _store, _p = _make_client(monkeypatch, tmp_path, adapter)
        try:
            start = client.post("/v1/computer-use/record", json={
                "session_id": "sess-canon-replay", "action": "start", "record_gif": False,
            })
            recording_id = start.json()["recording_id"]
            client.post("/v1/computer-use/record", json={
                "session_id": "sess-canon-replay", "action": "append",
                "recording_id": recording_id,
                "frames": [{"step": 1, "action_type": "screenshot"}],
            })
            client.post("/v1/computer-use/record", json={
                "session_id": "sess-canon-replay", "action": "stop",
                "recording_id": recording_id,
            })
            client.post("/v1/computer-use/replay", json={
                "recording_id": recording_id,
                "deviation_threshold": None,
                "wait": True,
            })
        finally:
            client.__exit__(None, None, None)
        event_types = [t for t, _ in canonical_recorder]
        assert "replay.started" in event_types
        assert "replay.finished" in event_types
