"""
Record→teach→batch workflow compilation tests (stagehand-batch-fork deferral A).

Covers:
  * core/batch_dispatch.workflow_steps_to_batch_steps: workflow-kind mapping,
    selector-only targets, requiresApprovalFor veto, MIN_BATCH_STEPS.
  * core.batch_dispatch.observe_adapter_page_url: get_url() surfaces,
    non-browser adapters, raising adapters.
  * WorkflowRunner batch mode: one grant-bound dispatch for a fully mappable
    spec, ledger opened/closed with model_turns_saved, per-step opt-out
    (flag + env), declined grant → per-step fallback, halted batch → resume
    at the failed step without re-running completed steps, missing params →
    no compilation (per-step pause contract preserved).
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

from core.batch_dispatch import (  # noqa: E402
    BatchDispatchResult,
    observe_adapter_page_url,
    workflow_step_to_batch_step,
    workflow_steps_to_batch_steps,
)
from core.workflow_runner import WorkflowRunner  # noqa: E402


def _step(step_id, kind, ref, input_=None):
    return {
        "id": step_id,
        "kind": kind,
        "target": {"ref": ref},
        "input": input_ or {},
    }


def _batchable_workflow(steps=None, safety=None):
    return {
        "schemaVersion": "1.0",
        "workflowId": f"wf-batch-{uuid.uuid4().hex[:8]}",
        "title": "Batchable workflow",
        "sourceRunId": "run-source",
        "inputs": [],
        "steps": steps if steps is not None else [
            _step("s1", "click", "#open"),
            _step("s2", "type", "#name", {"text": "Eoj"}),
            _step("s3", "press", "#name", {"key": "Enter"}),
        ],
        "safety": safety or {"requiresApprovalFor": [], "redactions": []},
    }


class _Result:
    def __init__(self, status="completed", error=None):
        self.status = status
        self.error = error


class _RecordingAdapter:
    """Plain adapter recording per-step dispatch (the per-step path)."""

    def __init__(self):
        self.executed = []

    async def execute(self, req):
        self.executed.append(req.action_type)
        return _Result()


class _FakeBatchClient:
    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    async def execute_batch(self, *, steps, mode, origin="aci.batch", session=None,
                            page_url=None, approval_id=None, step_approval_ids=None,
                            headless=True):
        self.calls.append({
            "steps": steps, "mode": mode, "origin": origin, "session": session,
            "page_url": page_url, "approval_id": approval_id,
            "step_approval_ids": step_approval_ids, "headless": headless,
        })
        result = self._results.pop(0)
        if callable(result):
            result = result(self.calls[-1])
        return result


def _receipt(status, outcomes, halted_at=None):
    return {"status": status, "halted_at": halted_at, "steps": outcomes}


def _completed_receipt(n, receipt_id=None):
    return BatchDispatchResult(
        executed=True, descriptor_hash="dhash", receipt_id=receipt_id or "rcpt-1",
        enforcement="one_grant",
        receipt=_receipt("completed", [{"index": i, "status": "completed"} for i in range(n)]),
    )


# ── Compilation discipline ───────────────────────────────────────────────────

class TestWorkflowCompilation:
    def test_batchable_kinds_map_to_whitelist(self):
        steps = workflow_steps_to_batch_steps([
            _step("a", "click", "#go"),
            _step("b", "type", "#name", {"text": "Eoj"}),
            _step("c", "press", "#name", {"key": "Enter"}),
            _step("d", "scroll", "main"),
            _step("e", "select", "#country", {"value": "US"}),
            _step("f", "hover", ".menu"),
        ])
        assert [s["method"] for s in steps] == [
            "click", "fill", "press", "scrollTo", "selectOptionFromDropdown", "hover",
        ]
        assert steps[1]["arguments"] == ["Eoj"]
        assert steps[2]["arguments"] == ["Enter"]
        assert steps[4]["arguments"] == ["US"]

    def test_single_step_is_not_compiled(self):
        assert workflow_steps_to_batch_steps([_step("a", "click", "#go")]) is None

    def test_out_of_vocabulary_kinds_are_not_compiled(self):
        for kind in ("navigate", "wait", "extract", "screenshot", "download"):
            steps = [_step("a", "click", "#go"), _step("b", kind, "#x", {"url": "https://x/"})]
            assert workflow_steps_to_batch_steps(steps) is None, kind

    def test_non_selector_targets_are_not_compiled(self):
        steps = [_step("a", "click", "#go"), _step("b", "click", "submit button")]
        assert workflow_steps_to_batch_steps(steps) is None

    def test_requires_approval_kind_vetoes_compilation(self):
        steps = [_step("a", "click", "#go"), _step("b", "type", "#n", {"text": "x"})]
        assert workflow_steps_to_batch_steps(steps, {"type"}) is None
        assert workflow_steps_to_batch_steps(steps, {"click"}) is None
        assert workflow_steps_to_batch_steps(steps, set()) is not None

    def test_step_mapping_is_none_for_unbatchable_step(self):
        assert workflow_step_to_batch_step(_step("a", "navigate", "https://x/")) is None
        assert workflow_step_to_batch_step(_step("a", "click", "")) is None


class TestObserveAdapterPageUrl:
    @pytest.mark.asyncio
    async def test_get_url_is_awaited(self):
        class _Adapter:
            async def get_url(self):
                return "https://example.com/page"

        assert await observe_adapter_page_url(_Adapter()) == "https://example.com/page"

    @pytest.mark.asyncio
    async def test_sync_get_url_and_blank(self):
        class _Adapter:
            def get_url(self):
                return "https://example.com/"

        assert await observe_adapter_page_url(_Adapter()) == "https://example.com/"
        assert await observe_adapter_page_url(_Adapter(), ) is not None

    @pytest.mark.asyncio
    async def test_no_get_url_or_raising_yields_none(self):
        assert await observe_adapter_page_url(object()) is None
        assert await observe_adapter_page_url(None) is None

        class _Broken:
            def get_url(self):
                raise RuntimeError("no page")

        assert await observe_adapter_page_url(_Broken()) is None


# ── Runner batch consumption ─────────────────────────────────────────────────

class TestWorkflowRunnerBatch:
    @pytest.mark.asyncio
    async def test_fully_batchable_spec_dispatches_one_batch(self):
        events = []
        ledger = []
        adapter = _RecordingAdapter()
        client = _FakeBatchClient([_completed_receipt(3)])
        runner = WorkflowRunner(
            adapter=adapter, session_id="s-1",
            on_event=lambda e: events.append(e),
            ledger=lambda et, payload: ledger.append((et, payload)),
            batch_client=client,
        )

        result = await runner.run(_batchable_workflow())

        assert result.status == "completed"
        assert adapter.executed == []           # no per-step dispatch
        assert len(client.calls) == 1           # ONE transport call
        assert client.calls[0]["origin"] == "aci.workflow"
        assert [s["method"] for s in client.calls[0]["steps"]] == ["click", "fill", "press"]
        assert [s.status for s in result.steps] == ["ok", "ok", "ok"]
        # Ledger: opened before, closed with outcome + turns saved.
        kinds = [e[0] for e in ledger]
        assert kinds == ["batch.context.opened", "batch.context.closed"]
        assert ledger[0][1]["origin"] == "aci.workflow"
        assert ledger[1][1]["batch_id"] == "dhash"
        assert ledger[1][1]["model_turns_saved"] == 2
        assert ledger[1][1]["steps_completed"] == 3
        # Events: started, batch compiled, per-step via batch, batch executed, finished.
        types = [e["type"] for e in events]
        assert types[0] == "workflow.started"
        assert types[-1] == "workflow.finished"
        assert "workflow.batch" in types
        assert sum(1 for e in events if e["type"] == "workflow.step") == 3

    @pytest.mark.asyncio
    async def test_batch_flag_opt_out_keeps_per_step_path(self):
        adapter = _RecordingAdapter()
        client = _FakeBatchClient([_completed_receipt(3)])
        runner = WorkflowRunner(
            adapter=adapter, batch_client=client, batch_enabled=False,
        )

        result = await runner.run(_batchable_workflow())

        assert client.calls == []
        assert adapter.executed == ["click", "type_text", "press"]
        assert [s.status for s in result.steps] == ["ok", "ok", "ok"]

    @pytest.mark.asyncio
    async def test_batch_env_opt_out_keeps_per_step_path(self, monkeypatch):
        monkeypatch.setenv("ALLTERNIT_WORKFLOW_BATCH", "0")
        adapter = _RecordingAdapter()
        client = _FakeBatchClient([_completed_receipt(3)])
        runner = WorkflowRunner(adapter=adapter, batch_client=client)

        result = await runner.run(_batchable_workflow())

        assert client.calls == []
        assert adapter.executed == ["click", "type_text", "press"]
        assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_unbatchable_spec_keeps_per_step_path(self):
        events = []
        adapter = _RecordingAdapter()
        client = _FakeBatchClient([])
        spec = _batchable_workflow(steps=[
            _step("s1", "navigate", "https://example.com", {"url": "https://example.com"}),
            _step("s2", "extract", "body", {"selector": "body"}),
            _step("s3", "click", "#go"),
        ])
        runner = WorkflowRunner(adapter=adapter, batch_client=client,
                                on_event=lambda e: events.append(e))

        result = await runner.run(spec)

        assert client.calls == []
        assert adapter.executed == ["goto", "extract", "click"]
        assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_missing_param_skips_compilation_and_pauses_per_step(self):
        # {{who}} unresolved → no compilation; the per-step input pause stays
        # the contract.
        spec = _batchable_workflow(steps=[
            _step("s1", "click", "#open"),
            _step("s2", "type", "#name", {"text": "{{who}}"}),
            _step("s3", "press", "#name", {"key": "Enter"}),
        ])
        adapter = _RecordingAdapter()
        client = _FakeBatchClient([])
        pauses = []
        runner = WorkflowRunner(
            adapter=adapter, batch_client=client, params={},
            approval_callback=lambda p: pauses.append(p) or True,
        )

        result = await runner.run(spec)

        assert client.calls == []
        assert len(pauses) == 1
        assert pauses[0].kind == "workflow.input_required"
        assert pauses[0].missing_params == ["who"]
        # Approved with the param blanked → all three steps run per-step.
        assert adapter.executed == ["click", "type_text", "press"]
        assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_declined_grant_falls_back_to_per_step(self):
        ledger = []
        adapter = _RecordingAdapter()
        client = _FakeBatchClient([
            BatchDispatchResult(executed=False, confirmation_required=True,
                                approval_id="ap-1", action_hash="dhash"),
        ])
        pauses = []
        runner = WorkflowRunner(
            adapter=adapter, batch_client=client,
            approval_callback=lambda p: pauses.append(p) or False,  # decline
            ledger=lambda et, payload: ledger.append((et, payload)),
        )

        result = await runner.run(_batchable_workflow())

        assert len(client.calls) == 1          # no retry after decline
        assert adapter.executed == ["click", "type_text", "press"]
        assert [p.kind for p in pauses] == ["workflow.batch_grant"]
        closed = [e for e in ledger if e[0] == "batch.context.closed"][0][1]
        assert closed["status"] == "denied"
        assert closed["model_turns_saved"] == 0
        assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_approved_grant_retries_once_and_completes(self):
        adapter = _RecordingAdapter()
        client = _FakeBatchClient([
            BatchDispatchResult(executed=False, confirmation_required=True,
                                approval_id="ap-9", action_hash="dhash"),
            _completed_receipt(3, receipt_id="rcpt-g"),
        ])
        pauses = []
        runner = WorkflowRunner(
            adapter=adapter, batch_client=client,
            approval_callback=lambda p: pauses.append(p) or True,
        )

        result = await runner.run(_batchable_workflow())

        assert len(client.calls) == 2
        assert client.calls[1]["approval_id"] == "ap-9"
        assert adapter.executed == []
        assert [s.status for s in result.steps] == ["ok", "ok", "ok"]
        assert pauses[0].kind == "workflow.batch_grant"

    @pytest.mark.asyncio
    async def test_halted_batch_resumes_at_failed_step_only(self):
        ledger = []
        adapter = _RecordingAdapter()
        receipt = _receipt("completed_halted", [
            {"index": 0, "status": "completed"},
            {"index": 1, "status": "failed", "error": "element detached"},
            # index 2 absent → tail after halt
        ], halted_at=1)
        client = _FakeBatchClient([
            BatchDispatchResult(executed=True, descriptor_hash="dhash",
                                receipt=receipt, receipt_id="rcpt-h",
                                enforcement="one_grant"),
        ])
        runner = WorkflowRunner(
            adapter=adapter, batch_client=client,
            ledger=lambda et, payload: ledger.append((et, payload)),
        )

        result = await runner.run(_batchable_workflow())

        # Completed step 0 never re-ran; steps 1 (failed) and 2 (skipped) ran per-step.
        assert adapter.executed == ["type_text", "press"]
        assert [s.status for s in result.steps] == ["ok", "ok", "ok"]
        closed = [e for e in ledger if e[0] == "batch.context.closed"][0][1]
        assert closed["status"] == "completed_halted"
        assert closed["halted_at"] == 1
        assert closed["steps_completed"] == 1

    @pytest.mark.asyncio
    async def test_transport_failure_falls_back_to_per_step(self):
        adapter = _RecordingAdapter()
        client = _FakeBatchClient([
            BatchDispatchResult(executed=False, error="transport: boom"),
        ])
        runner = WorkflowRunner(adapter=adapter, batch_client=client)

        result = await runner.run(_batchable_workflow())

        assert adapter.executed == ["click", "type_text", "press"]
        assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_operator_page_url_is_pinned_into_the_descriptor(self):
        adapter = _RecordingAdapter()
        client = _FakeBatchClient([_completed_receipt(3)])
        runner = WorkflowRunner(
            adapter=adapter, batch_client=client, session_id="s-1",
            batch_page_url="https://operator.example/pinned",
        )

        await runner.run(_batchable_workflow())

        assert client.calls[0]["page_url"] == "https://operator.example/pinned"
