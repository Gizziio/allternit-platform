"""
Allternit Computer Use — Workflow Runner + /v1/browser-skills/run tests

Covers:
  * Placeholder parameterization ({{input}} substitution, nested values).
  * load_workflow_spec validation (spec and skill-package shapes).
  * WorkflowRunner: plain-adapter and executor-signature dispatch, kind →
    action-type mapping, missing-param approval pause (approve/deny/no-callback),
    safety.requiresApprovalFor pauses, cancel event, workflow.* events.
  * Gateway route POST /v1/browser-skills/run: run created in the shared
    RunStore, pollable, wait=true returns full result, invalid spec 422,
    unknown skill_id 404, missing-param pause resolvable via
    POST /v1/computer-use/runs/{run_id}/approve.
"""

import asyncio
import sys
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

from core.workflow_runner import (  # noqa: E402
    WorkflowRunner,
    WorkflowValidationError,
    _substitute,
    load_workflow_spec,
)


class StubResult:
    def __init__(self, status="completed", error=None):
        self.status = status
        self.error = error


class StubAdapter:
    """Plain adapter: execute(req)."""

    def __init__(self, fail_kinds=None):
        self.executed = []
        self.fail_kinds = fail_kinds or set()

    async def execute(self, req):
        self.executed.append({
            "action_type": req.action_type,
            "target": req.target,
            "parameters": dict(req.parameters),
        })
        if req.action_type in self.fail_kinds:
            return StubResult(status="failed", error={"message": f"boom on {req.action_type}"})
        return StubResult()


class StubExecutor:
    """Executor-signature adapter: execute(req, session_id=, run_id=)."""

    def __init__(self):
        self.executed = []
        self.registered_adapters = lambda: ["browser.mock"]

    async def execute(self, req, session_id=None, run_id=None):
        self.executed.append({
            "action_type": req.action_type,
            "target": req.target,
            "parameters": dict(req.parameters),
            "session_id": session_id,
            "run_id": run_id,
        })
        return StubResult()


def make_workflow(steps=None, safety=None):
    return {
        "schemaVersion": "1.0",
        "workflowId": f"wf-test-{uuid.uuid4().hex[:8]}",
        "title": "Test workflow",
        "description": "Fixture workflow for unit tests",
        "sourceRunId": "run-source",
        "provider": "local-playwright",
        "inputs": [],
        "steps": steps if steps is not None else [
            {"id": "step-1", "kind": "navigate", "target": {"ref": "https://example.com"},
             "input": {"url": "https://example.com"}, "reason": "open the page"},
            {"id": "step-2", "kind": "extract", "target": {"ref": "body"},
             "input": {"selector": "body"}, "reason": "read the page"},
            {"id": "step-3", "kind": "screenshot", "input": {}, "reason": "evidence"},
        ],
        "safety": safety or {"requiresApprovalFor": [], "redactions": []},
        "createdAt": "2026-09-08T00:00:00Z",
    }


# ---------------------------------------------------------------------------
# Unit: spec loading + substitution
# ---------------------------------------------------------------------------

class TestSpecLoading:
    def test_accepts_spec_shape(self):
        spec = load_workflow_spec(make_workflow())
        assert spec["workflowId"].startswith("wf-test-")

    def test_accepts_skill_package_shape(self):
        package = {"workflow": make_workflow(), "manifest": {"skillId": "skill_x"}}
        spec = load_workflow_spec(package)
        assert "steps" in spec

    def test_rejects_non_dict(self):
        with pytest.raises(WorkflowValidationError):
            load_workflow_spec(["not", "a", "dict"])

    def test_rejects_missing_steps(self):
        with pytest.raises(WorkflowValidationError):
            load_workflow_spec({"workflowId": "x"})

    def test_rejects_step_without_id(self):
        workflow = make_workflow(steps=[{"kind": "click"}])
        with pytest.raises(WorkflowValidationError):
            load_workflow_spec(workflow)

    def test_rejects_step_without_kind(self):
        workflow = make_workflow(steps=[{"id": "s1"}])
        with pytest.raises(WorkflowValidationError):
            load_workflow_spec(workflow)


class TestSubstitution:
    def test_substitutes_scalar_and_nested(self):
        value, missing = _substitute(
            {"url": "https://{{host}}/login", "nested": {"user": "{{user}}", "n": 3}},
            {"host": "example.com", "user": "alice"},
        )
        assert value == {"url": "https://example.com/login", "nested": {"user": "alice", "n": 3}}
        assert missing == []

    def test_reports_missing_params(self):
        value, missing = _substitute("{{a}} and {{b}} and {{a}}", {"a": "1"})
        assert value == "1 and {{b}} and 1"
        assert sorted(missing) == ["b"]

    def test_list_values(self):
        value, missing = _substitute(["{{x}}", 5], {"x": "v"})
        assert value == ["v", 5]
        assert missing == []


# ---------------------------------------------------------------------------
# Unit: runner
# ---------------------------------------------------------------------------

class TestWorkflowRunner:
    @pytest.mark.asyncio
    async def test_three_step_run_plain_adapter(self):
        adapter = StubAdapter()
        events = []
        runner = WorkflowRunner(
            adapter=adapter, session_id="s1",
            on_event=lambda e: events.append(e),
        )
        result = await runner.run(make_workflow())
        assert result.status == "completed"
        assert [s.status for s in result.steps] == ["ok", "ok", "ok"]
        # plain-adapter vocabulary
        assert [a["action_type"] for a in adapter.executed] == ["goto", "extract", "screenshot"]
        assert adapter.executed[0]["target"] == "https://example.com"
        types = [e["type"] for e in events]
        assert types[0] == "workflow.started"
        assert "workflow.step" in types
        assert types[-1] == "workflow.finished"

    @pytest.mark.asyncio
    async def test_executor_signature_and_vocabulary(self):
        adapter = StubExecutor()
        runner = WorkflowRunner(adapter=adapter, session_id="s1")
        workflow = make_workflow(steps=[
            {"id": "s1", "kind": "click", "target": {"ref": "10,20"},
             "input": {"x": 10, "y": 20}, "reason": "press it"},
            {"id": "s2", "kind": "type", "input": {"text": "hi"}, "reason": "type"},
        ])
        result = await runner.run(workflow)
        assert result.status == "completed"
        assert adapter.executed[0]["action_type"] == "left_click"
        assert adapter.executed[1]["action_type"] == "type"
        assert adapter.executed[0]["session_id"] == "s1"
        assert adapter.executed[0]["run_id"]

    @pytest.mark.asyncio
    async def test_missing_param_pauses_and_approve_continues(self):
        adapter = StubAdapter()
        pauses = []
        events = []

        async def approve(pause):
            pauses.append(pause)
            return True

        workflow = make_workflow(steps=[
            {"id": "s1", "kind": "navigate", "input": {"url": "https://{{host}}"}, "reason": "go"},
        ])
        runner = WorkflowRunner(
            adapter=adapter, session_id="s1", params={},
            approval_callback=approve, on_event=lambda e: events.append(e),
        )
        result = await runner.run(workflow)
        assert result.status == "completed"
        assert len(pauses) == 1
        assert pauses[0].kind == "workflow.input_required"
        assert pauses[0].missing_params == ["host"]
        # approved → placeholder blanked, step executed
        assert adapter.executed[0]["parameters"]["url"] == "https://"
        assert result.steps[0].status == "ok"
        approval_events = [e for e in events if e["type"].startswith("approval.")]
        assert [e["type"] for e in approval_events] == ["approval.required", "approval.resolved"]

    @pytest.mark.asyncio
    async def test_missing_param_deny_abandons(self):
        adapter = StubAdapter()
        runner = WorkflowRunner(
            adapter=adapter, session_id="s1", params={},
            approval_callback=lambda pause: False,
        )
        workflow = make_workflow(steps=[
            {"id": "s1", "kind": "navigate", "input": {"url": "https://{{host}}"}, "reason": "go"},
        ])
        result = await runner.run(workflow)
        assert result.status == "abandoned"
        assert result.steps[0].status == "skipped"
        assert adapter.executed == []

    @pytest.mark.asyncio
    async def test_missing_param_without_callback_abandons(self):
        runner = WorkflowRunner(adapter=StubAdapter(), session_id="s1", params={})
        workflow = make_workflow(steps=[
            {"id": "s1", "kind": "navigate", "input": {"url": "https://{{host}}"}, "reason": "go"},
        ])
        result = await runner.run(workflow)
        assert result.status == "abandoned"

    @pytest.mark.asyncio
    async def test_param_provided_no_pause(self):
        adapter = StubAdapter()
        runner = WorkflowRunner(adapter=adapter, session_id="s1", params={"host": "example.com"})
        workflow = make_workflow(steps=[
            {"id": "s1", "kind": "navigate", "input": {"url": "https://{{host}}"}, "reason": "go"},
        ])
        result = await runner.run(workflow)
        assert result.status == "completed"
        assert result.pauses == []
        assert adapter.executed[0]["parameters"]["url"] == "https://example.com"

    @pytest.mark.asyncio
    async def test_safety_requires_approval_pauses(self):
        adapter = StubAdapter()
        workflow = make_workflow(steps=[
            {"id": "s1", "kind": "click", "target": {"ref": "#buy"}, "input": {}, "reason": "buy"},
        ], safety={"requiresApprovalFor": ["click"], "redactions": []})
        runner = WorkflowRunner(
            adapter=adapter, session_id="s1",
            approval_callback=lambda pause: pause.kind == "workflow.step_approval",
        )
        result = await runner.run(workflow)
        assert result.status == "completed"
        assert adapter.executed[0]["action_type"] == "click"
        assert result.pauses[0].kind == "workflow.step_approval"

    @pytest.mark.asyncio
    async def test_cancel_event_stops_run(self):
        adapter = StubAdapter()
        cancel = asyncio.Event()
        cancel.set()
        runner = WorkflowRunner(
            adapter=adapter, session_id="s1", cancel_event=cancel,
        )
        result = await runner.run(make_workflow())
        assert result.status == "cancelled"
        assert adapter.executed == []

    @pytest.mark.asyncio
    async def test_step_error_recorded_and_run_continues(self):
        adapter = StubAdapter(fail_kinds={"extract"})
        runner = WorkflowRunner(adapter=adapter, session_id="s1")
        result = await runner.run(make_workflow())
        assert result.status == "completed"
        assert result.steps[1].status == "error"
        assert "boom on extract" in result.steps[1].error


# ---------------------------------------------------------------------------
# HTTP: POST /v1/browser-skills/run
# ---------------------------------------------------------------------------

def _make_client(monkeypatch, adapter, request):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    import computer_use_router
    import browser_skills_router

    monkeypatch.setattr(computer_use_router, "_get_adapter_for_planning", lambda *a, **k: adapter)
    monkeypatch.setattr(browser_skills_router, "_get_adapter_for_planning", lambda *a, **k: adapter)

    app = FastAPI()
    app.include_router(computer_use_router.router)
    app.include_router(browser_skills_router.router)
    client = TestClient(app)
    # Enter the context so the portal loop persists across requests —
    # otherwise the per-request loop teardown cancels in-flight run tasks.
    client.__enter__()
    request.addfinalizer(lambda: client.__exit__(None, None, None))
    return client


@pytest.fixture
def client_adapter(monkeypatch):
    return StubAdapter()


class TestRunWorkflowEndpoint:
    def test_run_wait_returns_full_result(self, monkeypatch, tmp_path, request):
        adapter = StubAdapter()
        monkeypatch.setattr(
            browser_skills_router_module(), "_SKILLS_DIR", tmp_path / "skills")
        client = _make_client(monkeypatch, adapter, request)
        resp = client.post("/v1/browser-skills/run?wait=true", json={"workflow": make_workflow()})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert len(data["result"]["steps"]) == 3
        assert all(s["status"] == "ok" for s in data["result"]["steps"])
        assert len(adapter.executed) == 3

    def test_run_pollable_via_shared_run_store(self, monkeypatch, tmp_path, request):
        import computer_use_router

        adapter = StubAdapter()
        monkeypatch.setattr(
            browser_skills_router_module(), "_SKILLS_DIR", tmp_path / "skills")
        client = _make_client(monkeypatch, adapter, request)
        resp = client.post("/v1/browser-skills/run", json={"workflow": make_workflow()})
        assert resp.status_code == 200
        run_id = resp.json()["run_id"]
        # poll the shared run store endpoint
        for _ in range(100):
            poll = client.get(f"/v1/computer-use/runs/{run_id}")
            if poll.json()["status"] == "completed":
                break
            import time
            time.sleep(0.05)
        assert poll.json()["status"] == "completed"
        assert poll.json()["mode"] == "workflow"
        assert computer_use_router._run_store.get(run_id) is not None

    def test_run_with_skill_id(self, monkeypatch, tmp_path, request):
        skills_dir = tmp_path / "skills"
        skills_dir.mkdir(parents=True)
        (skills_dir / "skill_login.json").write_text(
            __import__("json").dumps({"workflow": make_workflow()}))
        monkeypatch.setattr(browser_skills_router_module(), "_SKILLS_DIR", skills_dir)
        adapter = StubAdapter()
        client = _make_client(monkeypatch, adapter, request)
        resp = client.post("/v1/browser-skills/run?wait=true", json={"skill_id": "skill_login"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    def test_run_unknown_skill_id_404(self, monkeypatch, tmp_path, request):
        monkeypatch.setattr(
            browser_skills_router_module(), "_SKILLS_DIR", tmp_path / "skills")
        client = _make_client(monkeypatch, StubAdapter(), request)
        resp = client.post("/v1/browser-skills/run", json={"skill_id": "nope"})
        assert resp.status_code == 404

    def test_run_invalid_spec_422(self, monkeypatch, tmp_path, request):
        monkeypatch.setattr(
            browser_skills_router_module(), "_SKILLS_DIR", tmp_path / "skills")
        client = _make_client(monkeypatch, StubAdapter(), request)
        resp = client.post("/v1/browser-skills/run", json={"workflow": {"workflowId": "x"}})
        assert resp.status_code == 400
        assert "detail" in resp.json()

    def test_run_needs_workflow_or_skill_id(self, monkeypatch, tmp_path, request):
        monkeypatch.setattr(
            browser_skills_router_module(), "_SKILLS_DIR", tmp_path / "skills")
        client = _make_client(monkeypatch, StubAdapter(), request)
        resp = client.post("/v1/browser-skills/run", json={"params": {}})
        assert resp.status_code == 422

    def test_missing_param_pause_and_approve_via_runs_endpoint(self, monkeypatch, tmp_path, request):
        monkeypatch.setattr(
            browser_skills_router_module(), "_SKILLS_DIR", tmp_path / "skills")
        adapter = StubAdapter()
        client = _make_client(monkeypatch, adapter, request)
        workflow = make_workflow(steps=[
            {"id": "s1", "kind": "navigate", "input": {"url": "https://{{host}}"}, "reason": "go"},
        ])
        resp = client.post("/v1/browser-skills/run", json={"workflow": workflow})
        run_id = resp.json()["run_id"]
        import time
        for _ in range(100):
            poll = client.get(f"/v1/computer-use/runs/{run_id}")
            if poll.json()["status"] == "awaiting_approval":
                break
            time.sleep(0.05)
        assert poll.json()["status"] == "awaiting_approval"
        approve = client.post(f"/v1/computer-use/runs/{run_id}/approve", json={"decision": "approve"})
        assert approve.status_code == 200
        for _ in range(100):
            poll = client.get(f"/v1/computer-use/runs/{run_id}")
            if poll.json()["status"] in ("completed", "abandoned", "failed"):
                break
            time.sleep(0.05)
        assert poll.json()["status"] == "completed"


def browser_skills_router_module():
    import browser_skills_router
    return browser_skills_router
