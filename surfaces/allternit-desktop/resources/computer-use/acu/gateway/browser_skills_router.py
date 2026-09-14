"""
Allternit Computer Use — Browser Skills Router

/v1/browser-skills surface: run a compiled browser workflow spec.

POST /v1/browser-skills/run executes a BrowserWorkflowSpec (the JSON produced
by the chrome-stream ``compileBrowserTrajectoryToSkill`` compiler, either the
spec itself or the full ``{workflow, manifest}`` skill package) through the
adapter layer as a workflow run in the shared RunStore — pollable via
GET /v1/computer-use/runs/{run_id}, streamable via
GET /v1/computer-use/runs/{run_id}/events, and approval-pausable via
POST /v1/computer-use/runs/{run_id}/approve. This is the "run" link in the
record → replay → teach → run loop.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator

try:
    import sys as _sys

    _sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from core.workflow_runner import WorkflowRunner, WorkflowValidationError, load_workflow_spec
    from computer_use_router import (
        _get_adapter_for_planning,
        _push_approval_event,
        _run_store,
        _sse_line,
        _utcnow,
        _DIRECT_APPROVAL_TIMEOUT_SECONDS,
        zero_run_cost,
    )
    _workflow_available = True
except ImportError:  # pragma: no cover - import guard mirrors computer_use_router
    WorkflowRunner = None  # type: ignore[assignment,misc]
    WorkflowValidationError = ValueError  # type: ignore[assignment,misc]
    load_workflow_spec = None  # type: ignore[assignment]
    _workflow_available = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/browser-skills", tags=["browser-skills"])

_SKILLS_DIR = Path(
    os.environ.get("ALLTERNIT_BROWSER_SKILLS_DIR", "~/.allternit/browser-skills")
).expanduser()


class RunWorkflowBody(BaseModel):
    """Body for POST /v1/browser-skills/run."""
    workflow: Optional[Dict[str, Any]] = None
    skill_id: Optional[str] = None
    params: Dict[str, Any] = Field(default_factory=dict)
    session_id: str = Field(default_factory=lambda: f"sess-{uuid.uuid4().hex[:8]}")
    run_id: str = Field(default_factory=lambda: f"wf-{uuid.uuid4().hex[:12]}")
    target_scope: str = "browser"
    wait: bool = False
    # Operator-pinned page binding for a compiled batch's descriptor hash
    # (session-preservation contract §7). None = the runner observes the
    # adapter's current URL, else the batch binds origin+session only.
    batch_page_url: Optional[str] = None

    @model_validator(mode="after")
    def _require_workflow_or_skill_id(self) -> "RunWorkflowBody":
        if not self.workflow and not self.skill_id:
            raise ValueError("either 'workflow' or 'skill_id' is required")
        return self


def _resolve_skill_workflow(skill_id: str) -> Dict[str, Any]:
    """Load a compiled skill package from the on-disk skill store.

    Resolution order: ``<skills_dir>/<skill_id>.json`` then
    ``<skills_dir>/<skill_id>/workflow.json``.
    """
    candidates = [
        _SKILLS_DIR / f"{skill_id}.json",
        _SKILLS_DIR / skill_id / "workflow.json",
    ]
    for path in candidates:
        if path.is_file():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Invalid skill package at {path}: {exc}")
    raise HTTPException(
        status_code=404,
        detail=f"Skill {skill_id!r} not found (looked in {_SKILLS_DIR})",
    )


@router.post("/run")
async def run_workflow(
    body: RunWorkflowBody,
    wait: bool = Query(default=False),
    stream: bool = Query(default=False),
) -> Any:
    """Execute a browser workflow spec as a run in the shared RunStore.

    Returns immediately with the run_id (poll GET /v1/computer-use/runs/{run_id}
    or stream its events). With wait=true (query param or body field) blocks
    until the workflow finishes and returns the full result. With stream=true
    returns an SSE stream of workflow.* events.
    """
    if not _workflow_available:
        raise HTTPException(status_code=503, detail="workflow runner not available (import error)")

    wait = wait or body.wait

    if body.workflow is not None:
        spec_source = body.workflow
    else:
        spec_source = _resolve_skill_workflow(body.skill_id or "")

    try:
        load_workflow_spec(spec_source)
    except WorkflowValidationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid workflow spec: {exc}")

    run_state = _run_store.create(
        run_id=body.run_id,
        session_id=body.session_id,
        mode="workflow",
        target_scope=body.target_scope,
    )
    _run_store.update_status(body.run_id, "running")

    adapter = _get_adapter_for_planning(body.target_scope, None)

    # Pause (missing input / safety approval) → approval_future, same pattern
    # as the replay deviation pause in computer_use_router.
    async def workflow_approval_callback(pause: Any) -> bool:
        loop = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        run_state.approval_future = future
        _run_store.update_status(body.run_id, "awaiting_approval")
        pause_dict = pause.to_dict() if hasattr(pause, "to_dict") else dict(pause or {})
        await _push_approval_event(run_state, "approval.required", {
            "kind": pause_dict.get("kind", "workflow.pause"),
            "pause": pause_dict,
            "timeout_seconds": _DIRECT_APPROVAL_TIMEOUT_SECONDS,
        })
        approved = False
        timed_out = False
        try:
            decision_payload = await asyncio.wait_for(future, timeout=_DIRECT_APPROVAL_TIMEOUT_SECONDS)
            approved = decision_payload.get("decision") == "approve"
        except asyncio.TimeoutError:
            run_state.approval_timed_out = True
            timed_out = True
            logger.warning("Workflow approval timed out for run %s", body.run_id)
        finally:
            run_state.approval_future = None
            _run_store.update_status(body.run_id, "running")
            await _push_approval_event(run_state, "approval.resolved", {
                "kind": pause_dict.get("kind", "workflow.pause"),
                "pause": pause_dict,
                "approved": approved,
                "timed_out": timed_out,
            })
        return approved

    async def on_event(event: Dict[str, Any]) -> None:
        await _run_store.push_event(body.run_id, {
            "event_type": event.get("type", "workflow.event"),
            "run_id": body.run_id,
            "message": event.get("type", ""),
            "data": event,
        })
        _emit_canonical_workflow_event(body, event)

    async def run_workflow_impl() -> None:
        # Canonical ledger writer for run-scoped batch records
        # (batch.context.* per the session-preservation contract). Session/run
        # bound here so the runner stays testable with a plain collector.
        def ledger(event_type: str, payload: Dict[str, Any]) -> None:
            try:
                try:
                    from canonical_router import _events as events
                except ImportError:
                    from gateway.canonical_router import _events as events  # type: ignore
                events.append(
                    event_type,
                    session_id=body.session_id,
                    run_id=body.run_id,
                    payload=payload,
                )
            except Exception as exc:
                logger.debug("canonical batch ledger emission failed: %s", exc)

        runner = WorkflowRunner(
            adapter=adapter,
            session_id=body.session_id,
            approval_callback=workflow_approval_callback,
            on_event=on_event,
            cancel_event=run_state.cancel_event,
            params=body.params,
            ledger=ledger,
            batch_page_url=body.batch_page_url,
        )
        try:
            result = await runner.run(spec_source)
            run_state.status = result.status
            run_state.result = result.to_dict()
            # Cost accounting: the workflow path makes no LLM calls — honest zero.
            run_state.cost = zero_run_cost()
        except Exception as exc:
            logger.exception("Workflow run raised exception: %s", exc)
            run_state.status = "failed"
            run_state.error = str(exc)
        finally:
            run_state.updated_at = _utcnow()
            _run_store.finalize(body.run_id)
            await _run_store.push_event(body.run_id, {
                "event_type": "run.ended",
                "run_id": body.run_id,
                "message": run_state.status,
                "data": run_state.to_dict(),
            })
            await _run_store.push_sentinel(body.run_id)

    if stream:
        asyncio.create_task(run_workflow_impl())

        async def event_generator():
            q = _run_store.event_queues[body.run_id]
            while True:
                event = await q.get()
                if event is None:
                    yield _sse_line("run.ended", body.run_id, run_state.status, run_state.to_dict())
                    break
                yield _sse_line(
                    event.get("event_type", "unknown"),
                    body.run_id,
                    event.get("message", ""),
                    event.get("data", {}),
                )

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    task = asyncio.create_task(run_workflow_impl())
    if wait:
        await task
        return {
            "run_id": body.run_id,
            "session_id": body.session_id,
            "status": run_state.status,
            "result": run_state.result,
            "error": run_state.error,
        }

    return {
        "run_id": body.run_id,
        "session_id": body.session_id,
        "status": "running",
        "poll": f"/v1/computer-use/runs/{body.run_id}",
        "events": f"/v1/computer-use/runs/{body.run_id}/events",
    }


def _emit_canonical_workflow_event(body: RunWorkflowBody, event: Dict[str, Any]) -> None:
    """Forward lifecycle events to the canonical event ledger (no-op on failure)."""
    if event.get("type") not in ("workflow.started", "workflow.finished", "workflow.step"):
        return
    try:
        try:
            from canonical_router import _events as events
        except ImportError:
            from gateway.canonical_router import _events as events  # type: ignore
        events.append(
            event["type"],
            session_id=body.session_id,
            run_id=body.run_id,
            payload={k: v for k, v in event.items() if k != "type"},
        )
    except Exception as exc:
        logger.debug("canonical workflow event emission failed: %s", exc)
