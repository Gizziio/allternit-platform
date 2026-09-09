"""sandbox_env credential-injection channel — delivery and leak tests.

Covers the Python-side consumption of the ACI server-side credential vault
(cmd/allternit-api aci_credentials.rs, PR #177): the top-level sandbox_env
map on POST /v1/computer-use/execute must

  (a) reach the run's child-process environment (adapters launched inside
      the run observe the variables in os.environ, restored afterwards), and
  (b) never leak credential values into model context, log records, SSE
      stream frames, persisted run records, or any response body — even
      when an adapter echoes its own environment back (the scrub boundary).

Canary value: ACI_CANARY_SECRET_ZZ9.
"""

import json
import logging
import os
import sys
import time
import uuid
from pathlib import Path

import pytest

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(DOMAIN_CORE_ROOT / "gateway"))
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

_existing_core = sys.modules.get("core")
if _existing_core is not None:
    _existing_file = getattr(_existing_core, "__file__", "") or ""
    if Path(_existing_file).parent != DOMAIN_CORE_ROOT / "core":
        for _name in [
            m for m in list(sys.modules)
            if (m == "core" or m.startswith("core."))
            and not m.startswith(("core.tests", "core.gateway"))
        ]:
            del sys.modules[_name]

import computer_use_router as router_module  # noqa: E402
from core.sandbox_env import (  # noqa: E402
    sandbox_env_context,
    scrub_secrets,
    validate_sandbox_env,
)

CANARY = "ACI_CANARY_SECRET_ZZ9"
ENV_KEY = "ACI_CRED_GITHUB_TOKEN"


class _Result:
    def __init__(self, payload):
        self._payload = payload

    def to_dict(self):
        return dict(self._payload)


class EchoEnvAdapter:
    """Adapter that records the process env and echoes credential material
    back the way a real sandbox would (env dump in the action result)."""

    def __init__(self, echo_in_result=True):
        self.env_seen = None
        self.echo_in_result = echo_in_result

    async def execute(self, req, **kwargs):
        self.env_seen = dict(os.environ)
        if self.echo_in_result:
            return _Result({"env_echo": {ENV_KEY: CANARY}, "note": f"token={CANARY}"})
        return _Result({"ok": True})

    async def screenshot(self, session_id: str = "") -> bytes:
        return b""


class RaisingEchoAdapter(EchoEnvAdapter):
    """Adapter whose failure message echoes the credential (error-path leak
    vector: exception text reaches results, events, and logs)."""

    async def execute(self, req, **kwargs):
        self.env_seen = dict(os.environ)
        raise RuntimeError(f"sandbox rejected token {CANARY}")


def _make_client(request, monkeypatch, adapter):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    monkeypatch.setattr(router_module, "_get_adapter_for_planning", lambda *a, **k: adapter)

    app = FastAPI()
    app.include_router(router_module.router)
    client = TestClient(app)
    # Portal context keeps background asyncio tasks (stream=true runs) alive.
    client.__enter__()
    request.addfinalizer(lambda: client.__exit__(None, None, None))
    return client


def _attach_persistence(monkeypatch, tmp_path):
    from gateway.run_persistence import RunPersistence

    persistence = RunPersistence(tmp_path / "runs.sqlite3")
    monkeypatch.setattr(router_module._run_store, "_persistence", persistence)
    return persistence


def _wait_for_run(run_id: str, timeout=30.0):
    deadline = time.time() + timeout
    state = None
    while time.time() < deadline:
        state = router_module._run_store.get(run_id)
        if state is not None and state.status in (
            "completed", "failed", "cancelled", "abandoned",
        ):
            return state
        time.sleep(0.05)
    raise AssertionError(
        f"run {run_id} never finished; last={state.to_dict() if state else None}"
    )


# ---------------------------------------------------------------------------
# Unit: validation, context manager, scrubbing, repr
# ---------------------------------------------------------------------------

class TestValidateSandboxEnv:
    def test_accepts_valid_map(self):
        assert validate_sandbox_env({ENV_KEY: CANARY}) == {ENV_KEY: CANARY}

    def test_rejects_bad_key_names_without_echoing_value(self):
        for bad_key in ("1ABC", "HAS SPACE", "has-dash", "", "A" * 200):
            with pytest.raises(ValueError) as excinfo:
                validate_sandbox_env({bad_key: CANARY})
            assert CANARY not in str(excinfo.value)

    def test_rejects_empty_and_oversized_values_by_key_only(self):
        with pytest.raises(ValueError) as excinfo:
            validate_sandbox_env({ENV_KEY: ""})
        assert ENV_KEY in str(excinfo.value)
        oversized = "x" * (16 * 1024 + 1)
        with pytest.raises(ValueError) as excinfo:
            validate_sandbox_env({ENV_KEY: oversized})
        assert ENV_KEY in str(excinfo.value)
        assert oversized not in str(excinfo.value)


class TestSandboxEnvContext:
    def test_sets_and_restores(self, monkeypatch):
        monkeypatch.delenv("ACI_CTX_NEW", raising=False)
        monkeypatch.setenv("ACI_CTX_EXISTING", "before")
        with sandbox_env_context({"ACI_CTX_NEW": "added", "ACI_CTX_EXISTING": "during"}):
            assert os.environ["ACI_CTX_NEW"] == "added"
            assert os.environ["ACI_CTX_EXISTING"] == "during"
        assert "ACI_CTX_NEW" not in os.environ
        assert os.environ["ACI_CTX_EXISTING"] == "before"

    def test_empty_map_is_noop(self):
        before = dict(os.environ)
        with sandbox_env_context({}):
            assert os.environ == before
        assert os.environ == before


class TestScrubSecrets:
    def test_nested_structures(self):
        value = {
            "frames": [
                {"text": f"prefix {CANARY} suffix"},
                {"list": [CANARY, "clean", 3, None]},
            ],
            "clean": True,
        }
        scrubbed = scrub_secrets(value, [CANARY])
        assert CANARY not in json.dumps(scrubbed)
        assert scrubbed["frames"][0]["text"] == "prefix *** suffix"
        assert scrubbed["frames"][1]["list"][1] == "clean"
        # Original untouched (returns a copy).
        assert value["frames"][0]["text"] == f"prefix {CANARY} suffix"

    def test_no_secrets_is_identity(self):
        value = {"a": [1, 2]}
        assert scrub_secrets(value, []) is value


class TestRequestReprMasking:
    def test_repr_masks_values(self):
        body = router_module.ExecuteBody(
            task="click submit",
            sandbox_env={ENV_KEY: CANARY},
        )
        rendered = repr(body) + str(body)
        assert CANARY not in rendered
        assert ENV_KEY in rendered

    def test_default_sandbox_env_empty(self):
        body = router_module.ExecuteBody(task="click submit")
        assert body.sandbox_env == {}


# ---------------------------------------------------------------------------
# (a) Delivery: sandbox_env reaches the adapter's process environment
# ---------------------------------------------------------------------------

class TestSandboxEnvDelivery:
    def test_direct_mode_adapter_sees_vars_and_env_restored(
        self, request, monkeypatch
    ):
        monkeypatch.delenv(ENV_KEY, raising=False)
        adapter = EchoEnvAdapter(echo_in_result=False)
        client = _make_client(request, monkeypatch, adapter)

        run_id = f"cu-sbx-{uuid.uuid4().hex[:8]}"
        r = client.post("/v1/computer-use/execute", json={
            "mode": "direct",
            "run_id": run_id,
            "session_id": "sess-sbx-direct",
            "sandbox_env": {ENV_KEY: CANARY},
            "actions": [{"kind": "click", "target": {"coordinates": [1, 2]}}],
        })
        assert r.status_code == 200, r.text

        # The adapter ran inside the run: the variable was live in the
        # process environment (and therefore in any child process it would
        # have launched).
        assert adapter.env_seen is not None
        assert adapter.env_seen.get(ENV_KEY) == CANARY
        # The gateway process env is restored after the run.
        assert ENV_KEY not in os.environ

    def test_no_sandbox_env_leaves_env_untouched(self, request, monkeypatch):
        monkeypatch.delenv(ENV_KEY, raising=False)
        adapter = EchoEnvAdapter(echo_in_result=False)
        client = _make_client(request, monkeypatch, adapter)
        r = client.post("/v1/computer-use/execute", json={
            "mode": "direct",
            "actions": [{"kind": "click"}],
        })
        assert r.status_code == 200, r.text
        assert adapter.env_seen is not None
        assert ENV_KEY not in adapter.env_seen

    def test_invalid_variable_name_is_400_without_value(self, request, monkeypatch):
        adapter = EchoEnvAdapter(echo_in_result=False)
        client = _make_client(request, monkeypatch, adapter)
        r = client.post("/v1/computer-use/execute", json={
            "mode": "direct",
            "sandbox_env": {"BAD KEY": CANARY},
            "actions": [{"kind": "click"}],
        })
        assert r.status_code == 400
        assert CANARY not in r.text


# ---------------------------------------------------------------------------
# (b) Leak check: full execute path, intent mode + mock vision provider
# ---------------------------------------------------------------------------

_INTENT_OPTIONS = {
    "vision_provider": "mock",
    "record": False,
    "max_steps": 2,
    "approval_policy": "never",
}


def _assert_canary_absent(label: str, text: str):
    assert CANARY not in text, f"canary leaked into {label}:\n{text[:2000]}"


class TestSandboxEnvLeakCheck:
    """The echo adapter puts the canary value into the adapter result and
    (separately) exception text would carry it into errors. Every run-facing
    surface — response bodies, SSE frames, event queues, persisted records,
    logs — must be clean."""

    def test_intent_full_run_no_leak(self, request, monkeypatch, tmp_path, caplog):
        if not router_module._planning_available:
            pytest.skip("planning loop not importable in this environment")
        monkeypatch.delenv(ENV_KEY, raising=False)
        adapter = EchoEnvAdapter(echo_in_result=True)
        client = _make_client(request, monkeypatch, adapter)
        persistence = _attach_persistence(monkeypatch, tmp_path)

        run_id = f"cu-leak-{uuid.uuid4().hex[:8]}"
        with caplog.at_level(logging.DEBUG):
            r = client.post("/v1/computer-use/execute", json={
                "mode": "intent",
                "task": "click the submit button",
                "run_id": run_id,
                "session_id": "sess-leak",
                "sandbox_env": {ENV_KEY: CANARY},
                "options": dict(_INTENT_OPTIONS),
            })
        assert r.status_code == 200, r.text
        state = _wait_for_run(run_id)

        # The value really was live in the run environment.
        assert adapter.env_seen is not None
        assert adapter.env_seen.get(ENV_KEY) == CANARY

        # 1. Non-streaming response body.
        _assert_canary_absent("execute response body", r.text)

        # 2. Run state + GET /runs/{id} response body.
        _assert_canary_absent("run_state.result", json.dumps(state.result))
        run_resp = client.get(f"/v1/computer-use/runs/{run_id}")
        _assert_canary_absent("GET /runs/{id}", run_resp.text)
        list_resp = client.get("/v1/computer-use/runs")
        _assert_canary_absent("GET /runs", list_resp.text)

        # 3. Event queue (stream frames at the source).
        q = router_module._run_store.event_queues.get(run_id)
        events = []
        while q is not None and not q.empty():
            item = q.get_nowait()
            if item is not None:
                events.append(item)
        assert events, "expected planning-loop events"
        _assert_canary_absent("run event queue", json.dumps(events))

        # 4. Persisted run record (SQLite receipt surface).
        record = persistence.get_run(run_id)
        assert record is not None
        _assert_canary_absent("persisted run record", json.dumps(record, default=str))

        # 5. Captured log output (all loggers).
        _assert_canary_absent("captured logs", caplog.text)

        # 6. The model context never carried the value: task stays as given.
        assert state.result is None or "task" not in state.result or \
            CANARY not in json.dumps(state.result.get("task"))

    def test_intent_stream_frames_no_leak(self, request, monkeypatch, tmp_path):
        if not router_module._planning_available:
            pytest.skip("planning loop not importable in this environment")
        monkeypatch.delenv(ENV_KEY, raising=False)
        adapter = EchoEnvAdapter(echo_in_result=True)
        client = _make_client(request, monkeypatch, adapter)
        persistence = _attach_persistence(monkeypatch, tmp_path)

        run_id = f"cu-leak-sse-{uuid.uuid4().hex[:8]}"
        r = client.post("/v1/computer-use/execute?stream=true", json={
            "mode": "intent",
            "task": "click the submit button",
            "run_id": run_id,
            "session_id": "sess-leak-sse",
            "sandbox_env": {ENV_KEY: CANARY},
            "options": dict(_INTENT_OPTIONS),
        })
        assert r.status_code == 200, r.text
        # The full SSE stream, including the terminal run.ended frame whose
        # data is the run record itself.
        _assert_canary_absent("SSE stream frames", r.text)
        assert "run.ended" in r.text

        state = _wait_for_run(run_id)
        assert state.status in ("completed", "failed")
        record = persistence.get_run(run_id)
        assert record is not None
        _assert_canary_absent("persisted run record (stream)", json.dumps(record, default=str))

    def test_direct_mode_error_echo_scrubbed(self, request, monkeypatch, tmp_path, caplog):
        """Exception text echoing the credential (adapter failure) must be
        scrubbed from results, events, responses, and router logs."""
        monkeypatch.delenv(ENV_KEY, raising=False)
        adapter = RaisingEchoAdapter()
        client = _make_client(request, monkeypatch, adapter)
        persistence = _attach_persistence(monkeypatch, tmp_path)

        run_id = f"cu-leak-err-{uuid.uuid4().hex[:8]}"
        with caplog.at_level(logging.DEBUG, logger="computer_use_router"):
            r = client.post("/v1/computer-use/execute", json={
                "mode": "direct",
                "run_id": run_id,
                "session_id": "sess-leak-err",
                "sandbox_env": {ENV_KEY: CANARY},
                "actions": [{"kind": "click"}],
            })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "failed"

        _assert_canary_absent("direct error response body", r.text)
        assert "***" in json.dumps(body["result"]["actions"][0]["error"])

        # SSE/stream source: the action.completed event carries the error.
        q = router_module._run_store.event_queues.get(run_id)
        events = []
        while q is not None and not q.empty():
            item = q.get_nowait()
            if item is not None:
                events.append(item)
        _assert_canary_absent("direct event queue", json.dumps(events))

        # Persisted record.
        record = persistence.get_run(run_id)
        _assert_canary_absent("persisted direct run record", json.dumps(record, default=str))

        # Router logs: the warning line is scrubbed.
        _assert_canary_absent("router logs", caplog.text)
