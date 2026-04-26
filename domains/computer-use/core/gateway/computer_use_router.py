"""
Allternit Computer Use — REST API Router

/v1/computer-use/ surface: execute, runs, sessions, adapters, record, health.

Execution model:
  Claude (native computer tool) → gateway /v1/execute → ACU executor directly
  Non-Claude models (GPT-4o, Gemini, Qwen, etc.) → /execute → PlanningLoop → executor

PlanningLoop is the non-Claude fallback path. When _planning_available=False the
/execute endpoint returns a failed status immediately so Claude is never blocked.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Adapter imports — all wrapped so the router loads even if deps are missing
# ---------------------------------------------------------------------------

try:
    import sys as _sys
    import os as _os
    _sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), ".."))
    from core.planning_loop import (
        PlanningLoop,
        PlanningLoopConfig,
        PlanningLoopResult,
        StopReason,
    )
    from core.vision_providers import VisionProviderFactory
    from core.computer_use_executor import get_executor as _get_executor
    _planning_available = True
except ImportError:
    PlanningLoop = None  # type: ignore[assignment,misc]
    PlanningLoopConfig = None  # type: ignore[assignment,misc]
    PlanningLoopResult = None  # type: ignore[assignment,misc]
    StopReason = None  # type: ignore[assignment,misc]
    VisionProviderFactory = None  # type: ignore[assignment,misc]
    _get_executor = None  # type: ignore[assignment]
    _planning_available = False

# Playwright-based adapter (inline stub that delegates to session_manager)
try:
    from session_manager import session_manager
    _session_manager_available = True
except ImportError:
    session_manager = None  # type: ignore[assignment]
    _session_manager_available = False

try:
    import sys as _sys2, os as _os2
    _sys2.path.insert(0, _os2.path.join(_os2.path.dirname(__file__), ".."))
    from adapters.browser.gateway_proxy_adapter import GatewayProxyAdapter
    _proxy_adapter_available = True
except ImportError:
    GatewayProxyAdapter = None  # type: ignore[assignment,misc]
    _proxy_adapter_available = False

try:
    from core.action_recorder import ActionRecorder
    _recorder_available = True
except ImportError:
    ActionRecorder = None  # type: ignore[assignment,misc]
    _recorder_available = False

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/v1/computer-use", tags=["computer-use"])


def _get_adapter_for_planning(target_scope: str, adapter_preference: Optional[str]) -> Any:
    """
    Return the adapter to pass to PlanningLoop.

    Preferred: ComputerUseExecutor singleton — gives the full waterfall
    (extension → CDP → playwright → desktop) for non-Claude paths.
    Fallback: GatewayProxyAdapter directly (if executor unavailable).
    """
    if _get_executor is not None:
        try:
            executor = _get_executor()
            if executor.registered_adapters():
                return executor
        except Exception:
            pass

    # Executor unavailable — fall back to a direct GatewayProxyAdapter
    if _proxy_adapter_available and GatewayProxyAdapter is not None:
        return GatewayProxyAdapter()
    return None


# ---------------------------------------------------------------------------
# Run store
# ---------------------------------------------------------------------------

class RunState:
    def __init__(
        self,
        run_id: str,
        session_id: str,
        mode: str,
        target_scope: str,
    ) -> None:
        self.run_id = run_id
        self.session_id = session_id
        self.status: str = "pending"
        self.mode = mode
        self.target_scope = target_scope
        self.created_at: str = _utcnow()
        self.updated_at: str = _utcnow()
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.approval_future: Optional[asyncio.Future] = None
        self.approval_timed_out: bool = False
        self.cancel_event: asyncio.Event = asyncio.Event()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "session_id": self.session_id,
            "status": self.status,
            "mode": self.mode,
            "target_scope": self.target_scope,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "result": self.result,
            "error": self.error,
            "approval_timed_out": self.approval_timed_out,
        }


_RUN_TTL_SECONDS = 3600  # purge completed/failed runs after 1 hour


class RunStore:
    def __init__(self) -> None:
        self.runs: Dict[str, RunState] = {}
        self.event_queues: Dict[str, asyncio.Queue] = {}

    def create(self, run_id: str, session_id: str, mode: str, target_scope: str) -> RunState:
        state = RunState(run_id, session_id, mode, target_scope)
        self.runs[run_id] = state
        self.event_queues[run_id] = asyncio.Queue()
        return state

    def get(self, run_id: str) -> Optional[RunState]:
        return self.runs.get(run_id)

    async def push_event(self, run_id: str, event: Dict[str, Any]) -> None:
        q = self.event_queues.get(run_id)
        if q:
            await q.put(event)

    async def push_sentinel(self, run_id: str) -> None:
        q = self.event_queues.get(run_id)
        if q:
            await q.put(None)

    def update_status(self, run_id: str, status: str) -> None:
        state = self.runs.get(run_id)
        if state:
            state.status = status
            state.updated_at = _utcnow()

    def purge_expired(self) -> int:
        """Remove completed/failed/cancelled runs older than _RUN_TTL_SECONDS."""
        terminal = {"completed", "failed", "cancelled"}
        now = datetime.now(timezone.utc)
        expired = [
            run_id for run_id, state in self.runs.items()
            if state.status in terminal
            and (now - datetime.fromisoformat(state.updated_at)).total_seconds() > _RUN_TTL_SECONDS
        ]
        for run_id in expired:
            self.runs.pop(run_id, None)
            self.event_queues.pop(run_id, None)
        return len(expired)


_run_store = RunStore()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sse_line(event_type: str, run_id: str, message: str, data: Dict[str, Any]) -> str:
    payload = json.dumps({
        "event_type": event_type,
        "run_id": run_id,
        "message": message,
        "data": data,
    })
    return f"data: {payload}\n\n"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ExecuteBody(BaseModel):
    mode: Literal["intent", "direct", "assist"] = "intent"
    task: str
    session_id: str = Field(default_factory=lambda: f"sess-{uuid.uuid4().hex[:8]}")
    run_id: str = Field(default_factory=lambda: f"cu-{uuid.uuid4().hex[:12]}")
    target_scope: Literal["browser", "desktop", "hybrid", "auto"] = "browser"
    options: Dict[str, Any] = Field(default_factory=dict)
    context: Dict[str, Any] = Field(default_factory=dict)


class ApproveBody(BaseModel):
    decision: Literal["approve", "deny", "cancel"] = "approve"
    comment: str = ""


class RecordBody(BaseModel):
    session_id: str
    action: Literal["start", "stop"] = "start"
    recording_id: Optional[str] = None
    name: Optional[str] = None
    record_gif: bool = True


class ReplayBody(BaseModel):
    recording_id: str
    export_gif: bool = False


class ExecutionResult(BaseModel):
    run_id: str
    session_id: str
    status: str
    mode: str
    target_scope: str
    summary: str = ""
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Core: run a planning loop and pipe events into the run store
# ---------------------------------------------------------------------------

async def _execute_non_claude_path(
    body: ExecuteBody,
    run_state: RunState,
) -> None:
    """Non-Claude model path: runs the PlanningLoop and pushes events to RunStore.

    Claude's native computer tool bypasses this entirely — it calls /v1/execute
    in the gateway directly, which routes to the ACU executor.
    """
    if not _planning_available:
        run_state.status = "failed"
        run_state.error = "planning_loop not available (import error)"
        run_state.updated_at = _utcnow()
        await _run_store.push_event(run_state.run_id, {
            "event_type": "run.failed",
            "run_id": run_state.run_id,
            "message": run_state.error,
            "data": {},
        })
        await _run_store.push_sentinel(run_state.run_id)
        return

    _run_store.update_status(run_state.run_id, "running")

    loop_config = PlanningLoopConfig(
        max_steps=body.options.get("max_steps", 20),
        max_cost_usd=body.options.get("max_cost_usd", 1.0),
        timeout_ms=body.options.get("timeout_ms", 120_000),
        approval_policy=body.options.get("approval_policy", "on-risk"),
        record=body.options.get("record", True),
        vision_provider=body.options.get("vision_provider"),
    )

    vp_override = body.options.get("vision_provider") or loop_config.vision_provider
    if vp_override:
        try:
            vision_provider = VisionProviderFactory.create(vp_override)
        except Exception as vp_err:
            logger.warning("vision_provider override %r failed (%s), falling back to env", vp_override, vp_err)
            vision_provider = VisionProviderFactory.create_from_env()
    else:
        vision_provider = VisionProviderFactory.create_from_env()
    # Use the executor waterfall (extension → CDP → playwright → desktop).
    # Falls back to raw GatewayProxyAdapter only if the executor is unavailable.
    adapter = _get_adapter_for_planning(body.target_scope, body.options.get("adapter_preference"))

    # Approval callback wired through RunState.approval_future
    async def approval_callback(step) -> bool:
        loop = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        run_state.approval_future = future
        try:
            decision_payload = await asyncio.wait_for(future, timeout=120.0)
        except asyncio.TimeoutError:
            run_state.approval_future = None
            run_state.approval_timed_out = True
            logger.warning("Approval timed out for run %s step %s", run_state.run_id, getattr(step, "step", "?"))
            return False
        run_state.approval_future = None
        return decision_payload.get("decision") == "approve"

    # Cancel check — wire cancel_event into the planning loop
    def event_callback(event: Dict[str, Any]) -> None:
        asyncio.create_task(_run_store.push_event(run_state.run_id, {
            "event_type": event.get("type", "unknown"),
            "run_id": run_state.run_id,
            "message": event.get("type", ""),
            "data": event,
        }))

    # Build recorder (always on by default; GIF enabled when record_gif=true)
    recorder = None
    if _recorder_available and ActionRecorder is not None and loop_config.record:
        record_gif = body.options.get("record_gif", True)
        recorder = ActionRecorder(
            task=body.task,
            session_id=body.session_id,
            run_id=body.run_id,
            vision_provider=body.options.get("vision_provider", ""),
            record_gif=record_gif,
            gif_fps=body.options.get("gif_fps", 2),
            gif_scale=body.options.get("gif_scale", 0.5),
        )
        await recorder.start()

    planning_loop = PlanningLoop(
        vision_provider=vision_provider,
        adapter=adapter,
        config=loop_config,
        recorder=recorder,
        event_callback=event_callback,
        approval_callback=approval_callback if loop_config.approval_policy != "never" else None,
    )

    # Hook cancel_event into the loop
    async def _cancel_watcher() -> None:
        await run_state.cancel_event.wait()
        planning_loop.cancel()

    cancel_task = asyncio.create_task(_cancel_watcher())

    try:
        result = await planning_loop.run(
            task=body.task,
            session_id=body.session_id,
            run_id=body.run_id,
        )
        # Finalize recorder and attach gif_path to result
        if recorder is not None:
            await recorder.stop()
            gif_path = recorder.get_gif_path()
            if gif_path:
                result.gif_path = str(gif_path)
        run_state.status = result.status
        run_state.result = result.to_dict()
    except Exception as exc:
        logger.exception("Planning loop raised exception: %s", exc)
        run_state.status = "failed"
        run_state.error = str(exc)
        if recorder is not None:
            try:
                await recorder.stop()
            except Exception:
                pass
    finally:
        cancel_task.cancel()
        run_state.updated_at = _utcnow()
        await _run_store.push_sentinel(run_state.run_id)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/execute", response_model=ExecutionResult)
async def execute(
    body: ExecuteBody,
    stream: bool = Query(default=False),
) -> Any:
    """Start a planning loop run. stream=true returns SSE."""
    _run_store.purge_expired()
    run_state = _run_store.create(
        run_id=body.run_id,
        session_id=body.session_id,
        mode=body.mode,
        target_scope=body.target_scope,
    )

    if stream:
        # SSE path: launch background task, stream events
        asyncio.create_task(_execute_non_claude_path(body, run_state))

        async def event_generator():
            q = _run_store.event_queues[body.run_id]
            while True:
                event = await q.get()
                if event is None:
                    # Send final status event then close
                    yield _sse_line(
                        "run.ended",
                        body.run_id,
                        run_state.status,
                        run_state.to_dict(),
                    )
                    break
                yield _sse_line(
                    event.get("event_type", "unknown"),
                    body.run_id,
                    event.get("message", ""),
                    event.get("data", {}),
                )

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    # Non-streaming path: wait for completion
    await _execute_non_claude_path(body, run_state)

    return ExecutionResult(
        run_id=run_state.run_id,
        session_id=run_state.session_id,
        status=run_state.status,
        mode=run_state.mode,
        target_scope=run_state.target_scope,
        summary=run_state.result.get("summary", "") if run_state.result else "",
        result=run_state.result,
        error=run_state.error,
    )


@router.get("/runs/{run_id}")
async def get_run(run_id: str) -> Dict[str, Any]:
    """Return current state of a run."""
    state = _run_store.get(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return state.to_dict()


@router.get("/runs/{run_id}/events")
async def stream_run_events(run_id: str) -> StreamingResponse:
    """SSE stream of events for an existing run."""
    state = _run_store.get(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    async def event_generator():
        q = _run_store.event_queues[run_id]
        while True:
            event = await q.get()
            if event is None:
                yield _sse_line("run.ended", run_id, state.status, state.to_dict())
                break
            yield _sse_line(
                event.get("event_type", "unknown"),
                run_id,
                event.get("message", ""),
                event.get("data", {}),
            )

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/runs/{run_id}/approve")
async def approve_run(run_id: str, body: ApproveBody) -> Dict[str, Any]:
    """Resolve a pending approval gate for a run."""
    state = _run_store.get(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    if body.decision == "cancel":
        state.cancel_event.set()
        return {"run_id": run_id, "action": "cancelled"}

    future = state.approval_future
    if future is None:
        raise HTTPException(status_code=409, detail="No pending approval for this run")

    if future.done():
        raise HTTPException(status_code=409, detail="Approval already resolved")

    future.set_result({"decision": body.decision, "comment": body.comment})
    return {"run_id": run_id, "decision": body.decision, "acknowledged": True}


@router.post("/runs/{run_id}/cancel")
async def cancel_run(run_id: str) -> Dict[str, Any]:
    """Cancel a running loop."""
    state = _run_store.get(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    state.cancel_event.set()
    _run_store.update_status(run_id, "cancelled")
    return {"run_id": run_id, "status": "cancelled"}


@router.get("/sessions")
async def list_sessions() -> Dict[str, Any]:
    """List all active browser sessions."""
    if not _session_manager_available or session_manager is None:
        return {"sessions": [], "error": "session_manager not available"}
    try:
        stats = await session_manager.get_session_stats()
        sessions_raw = getattr(session_manager, "_sessions", {})
        session_list = [
            {
                "session_id": sid,
                "action_count": s.action_count,
                "idle_seconds": round(s.idle_time, 1),
                "age_seconds": round(s.age, 1),
            }
            for sid, s in sessions_raw.items()
        ]
        return {"sessions": session_list, "stats": stats}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/sessions")
async def create_session() -> Dict[str, Any]:
    """Create a new browser session and return its session_id."""
    if not _session_manager_available or session_manager is None:
        raise HTTPException(status_code=503, detail="session_manager not available")
    session_id = f"sess-{uuid.uuid4().hex[:8]}"
    try:
        await session_manager.get_or_create_session(session_id)
        return {"session_id": session_id, "status": "created"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str) -> Dict[str, Any]:
    """Close and remove a browser session."""
    if not _session_manager_available or session_manager is None:
        raise HTTPException(status_code=503, detail="session_manager not available")
    try:
        closed = await session_manager.close_session(session_id)
        if not closed:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        return {"session_id": session_id, "status": "closed"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/adapters")
async def list_adapters() -> Dict[str, Any]:
    """Return registered adapters and their capability summary from the executor's live registry."""
    adapters = []

    if _get_executor is not None:
        try:
            executor = _get_executor()
            for adapter_id in executor.registered_adapters():
                instance = executor._adapters[adapter_id]
                entry: Dict[str, Any] = {"adapter_id": adapter_id, "available": True}
                try:
                    caps_raw = await instance.capabilities()
                    caps = vars(caps_raw) if hasattr(caps_raw, "__dataclass_fields__") else (caps_raw if isinstance(caps_raw, dict) else {})
                    entry["capabilities"] = {
                        "dom_tree": caps.get("dom_tree"),
                        "vision_required": caps.get("vision_required"),
                        "multi_tab": caps.get("multi_tab"),
                        "auth_flows": caps.get("auth_flows"),
                        "platform": caps.get("platform"),
                        "family": caps.get("family"),
                    }
                    entry["healthy"] = await instance.health_check()
                except Exception as exc:
                    entry["capabilities"] = None
                    entry["error"] = str(exc)
                adapters.append(entry)
        except Exception:
            pass

    return {"adapters": adapters, "count": len(adapters)}


# In-router recording registry (recording_id -> ActionRecorder)
_router_recordings: Dict[str, Any] = {}


@router.post("/record")
async def record(body: RecordBody) -> Dict[str, Any]:
    """
    Start or stop an action recording for a session.

    action="start": creates a new ActionRecorder and returns a recording_id.
    action="stop":  finalizes the recording and returns frame count + paths.
    """
    if not _recorder_available or ActionRecorder is None:
        raise HTTPException(status_code=503, detail="ActionRecorder not available")

    if body.action == "start":
        recording_id = f"rec-{uuid.uuid4().hex[:12]}"
        recorder = ActionRecorder(
            recording_id=recording_id,
            task=body.name or f"session-{body.session_id}",
            session_id=body.session_id,
            run_id=str(uuid.uuid4()),
            record_gif=body.record_gif,
        )
        await recorder.start()
        _router_recordings[recording_id] = recorder
        return {
            "recording_id": recording_id,
            "path": str(recorder.get_path()),
            "status": "recording",
        }

    # action == "stop"
    if not body.recording_id:
        raise HTTPException(status_code=400, detail="recording_id required to stop")
    recorder = _router_recordings.pop(body.recording_id, None)
    if recorder is None:
        raise HTTPException(status_code=404, detail=f"Recording {body.recording_id} not found")
    await recorder.stop()
    gif_path = str(recorder.get_gif_path()) if recorder.get_gif_path() else None
    return {
        "recording_id": body.recording_id,
        "frames": getattr(recorder, "_frame_count", 0),
        "path": str(recorder.get_path()),
        "gif_path": gif_path,
        "status": "stopped",
    }


@router.post("/replay")
async def replay(body: ReplayBody) -> Dict[str, Any]:
    """
    Replay a completed recording or export its GIF.

    Looks up the recorder by recording_id. If export_gif=true and a GIF
    was already generated, returns its path; otherwise returns the JSONL path.
    """
    if not _recorder_available or ActionRecorder is None:
        raise HTTPException(status_code=503, detail="ActionRecorder not available")

    recorder = _router_recordings.get(body.recording_id)
    if recorder is None:
        raise HTTPException(
            status_code=404,
            detail=f"Recording {body.recording_id} not found (already stopped or unknown)",
        )

    path = str(recorder.get_path())
    gif_path = str(recorder.get_gif_path()) if recorder.get_gif_path() else None

    if body.export_gif and gif_path is None:
        # Attempt to build the GIF from existing frames
        try:
            await recorder._flush_gif()
            gif_path = str(recorder.get_gif_path()) if recorder.get_gif_path() else None
        except Exception as exc:
            logger.warning("GIF export failed: %s", exc)

    return {
        "recording_id": body.recording_id,
        "path": path,
        "gif_path": gif_path,
        "frames": getattr(recorder, "_frame_count", 0),
    }


@router.get("/health")
async def health() -> Dict[str, Any]:
    """Health check for the computer-use subsystem."""
    if _session_manager_available and session_manager is not None:
        try:
            stats = await session_manager.get_session_stats()
            session_count = stats.get("active_sessions", 0)
        except Exception:
            session_count = -1
    else:
        session_count = 0

    adapter_count = 0
    if _get_executor is not None:
        try:
            adapter_count = len(_get_executor().registered_adapters())
        except Exception:
            pass

    return {
        "status": "ok",
        "adapters": adapter_count,
        "sessions": session_count,
        "version": "0.1.0",
        "planning_available": _planning_available,
    }
