"""
Allternit Computer Use — Workflow Spec Runner

Executes a ``BrowserWorkflowSpec`` (packages/@allternit/computer-use-protocol)
or a skill package produced by the chrome-stream compiler (``{workflow,
manifest}`` — the same ``workflow`` JSON). This closes the
record → replay → teach → run loop: a recorded trajectory compiled to a
workflow spec can be parameterized and re-executed through the adapter layer.

Behavior:
  - ``{{input}}`` placeholders anywhere in a step's ``input`` values (and in
    the target ref) are substituted from the run ``params`` dict. A missing
    param PAUSES the run with an ``approval.required`` event (kind
    ``workflow.input_required``) — the same approval pattern the replay
    deviation pause uses. Approving continues with the placeholder replaced
    by an empty string; denying abandons the run.
  - Steps whose kind appears in ``safety.requiresApprovalFor`` pause for
    approval before executing.
  - Each step is dispatched through the adapter layer exactly like
    ReplayEngine does (executor signature when the adapter has
    ``registered_adapters``, plain ``execute(req)`` otherwise).
  - Emits ``workflow.*`` events: started / step / approval.* / finished.
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

ApprovalCallback = Callable[["WorkflowPause"], Any]
EventCallback = Callable[[Dict[str, Any]], Any]

_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")

# ActionKind → adapter action_type. The executor vocabulary is used when the
# adapter is a ComputerUseExecutor (has ``registered_adapters``); the plain
# map is used for plain adapters (playwright-style goto/extract/...). Kinds
# absent from both maps pass through unchanged so the adapter decides.
EXECUTOR_ACTION_MAP: Dict[str, str] = {
    "navigate": "navigate",
    "click": "left_click",
    "type": "type",
    "press": "key",
    "scroll": "scroll",
    "select": "fill",
    "wait": "wait",
    "extract": "extract",
    "screenshot": "screenshot",
    "download": "download",
}

PLAIN_ACTION_MAP: Dict[str, str] = {
    "navigate": "goto",
    "click": "click",
    "type": "type_text",
    "press": "press",
    "scroll": "scroll",
    "select": "select",
    "hover": "hover",
    "wait": "wait",
    "extract": "extract",
    "screenshot": "screenshot",
}


class WorkflowValidationError(ValueError):
    """Raised when a workflow spec is structurally invalid."""


@dataclass
class WorkflowPause:
    """A pause condition encountered mid-run (missing input or approval gate)."""
    kind: str  # "workflow.input_required" | "workflow.step_approval"
    step: str
    step_index: int
    reason: str
    missing_params: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "kind": self.kind,
            "step": self.step,
            "step_index": self.step_index,
            "reason": self.reason,
            "missing_params": self.missing_params,
        }


@dataclass
class WorkflowStepResult:
    step_id: str
    kind: str
    action_type: str
    status: str  # "ok" | "error" | "skipped"
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_id": self.step_id,
            "kind": self.kind,
            "action_type": self.action_type,
            "status": self.status,
            "error": self.error,
        }


@dataclass
class WorkflowRunResult:
    workflow_id: str
    title: str
    run_id: str
    session_id: str
    status: str  # "completed" | "abandoned" | "failed" | "cancelled"
    steps: List[WorkflowStepResult] = field(default_factory=list)
    pauses: List[WorkflowPause] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "workflow_id": self.workflow_id,
            "title": self.title,
            "run_id": self.run_id,
            "session_id": self.session_id,
            "status": self.status,
            "steps": [s.to_dict() for s in self.steps],
            "pauses": [p.to_dict() for p in self.pauses],
            "total_steps": len(self.steps),
        }


# ---------------------------------------------------------------------------
# Spec loading / validation
# ---------------------------------------------------------------------------

def load_workflow_spec(spec: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and normalize a BrowserWorkflowSpec (or skill package).

    Accepts either the spec itself or a chrome-stream skill package with a
    top-level ``workflow`` key. Returns the normalized spec dict.
    """
    if not isinstance(spec, dict):
        raise WorkflowValidationError("workflow spec must be a JSON object")
    if isinstance(spec.get("workflow"), dict):
        spec = spec["workflow"]
    missing = [k for k in ("workflowId", "steps") if not spec.get(k)]
    if missing:
        raise WorkflowValidationError(f"workflow spec missing required fields: {missing}")
    steps = spec["steps"]
    if not isinstance(steps, list) or not steps:
        raise WorkflowValidationError("workflow spec 'steps' must be a non-empty list")
    for index, step in enumerate(steps):
        if not isinstance(step, dict) or not step.get("id"):
            raise WorkflowValidationError(f"workflow step #{index} is missing 'id'")
        if not step.get("kind"):
            raise WorkflowValidationError(f"workflow step {step.get('id')!r} is missing 'kind'")
    return spec


def _substitute(value: Any, params: Dict[str, Any]) -> Tuple[Any, List[str]]:
    """Replace {{name}} placeholders recursively. Returns (value, missing)."""
    missing: List[str] = []

    def _sub(text: str) -> str:
        def _repl(match: "re.Match[str]") -> str:
            name = match.group(1)
            if name in params:
                return str(params[name])
            missing.append(name)
            return match.group(0)

        return _PLACEHOLDER_RE.sub(_repl, text)

    if isinstance(value, str):
        return _sub(value), missing
    if isinstance(value, list):
        out = []
        for item in value:
            replaced, item_missing = _substitute(item, params)
            missing.extend(item_missing)
            out.append(replaced)
        return out, missing
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            replaced, item_missing = _substitute(item, params)
            missing.extend(item_missing)
            out[key] = replaced
        return out, missing
    return value, missing


def _blank_placeholders(value: Any) -> Any:
    """Replace any remaining {{name}} placeholders with an empty string."""
    if isinstance(value, str):
        return _PLACEHOLDER_RE.sub("", value)
    if isinstance(value, list):
        return [_blank_placeholders(item) for item in value]
    if isinstance(value, dict):
        return {key: _blank_placeholders(item) for key, item in value.items()}
    return value


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

class WorkflowRunner:
    """Execute a BrowserWorkflowSpec through the adapter layer.

    Args mirror ReplayEngine: ``adapter`` (executor or plain adapter, None
    means every step errors), ``session_id``, ``approval_callback`` (called
    with a WorkflowPause; True resumes, False abandons), ``on_event`` for
    ``workflow.*`` events, and ``cancel_event``.
    """

    def __init__(
        self,
        adapter: Any = None,
        session_id: str = "",
        approval_callback: Optional[ApprovalCallback] = None,
        on_event: Optional[EventCallback] = None,
        cancel_event: Optional[asyncio.Event] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.adapter = adapter
        self.session_id = session_id
        self.approval_callback = approval_callback
        self.on_event = on_event
        self.cancel_event = cancel_event
        self.params = dict(params or {})

    async def run(self, spec: Dict[str, Any]) -> WorkflowRunResult:
        spec = load_workflow_spec(spec)
        workflow_id = str(spec.get("workflowId", ""))
        title = str(spec.get("title") or workflow_id)
        run_id = str(spec.get("sourceRunId") or f"wf-{uuid.uuid4().hex[:12]}")
        requires_approval_for = set(
            (spec.get("safety") or {}).get("requiresApprovalFor") or []
        )

        steps_out: List[WorkflowStepResult] = []
        pauses: List[WorkflowPause] = []
        status = "completed"

        await self._emit({
            "type": "workflow.started",
            "workflow_id": workflow_id,
            "title": title,
            "run_id": run_id,
            "session_id": self.session_id,
            "total_steps": len(spec["steps"]),
        })

        for index, step in enumerate(spec["steps"]):
            if self.cancel_event is not None and self.cancel_event.is_set():
                status = "cancelled"
                break

            step_id = str(step["id"])
            kind = str(step["kind"])
            input_data = dict(step.get("input") or {})
            target = step.get("target") or {}
            target_ref = target.get("ref") or target.get("description") or ""

            parameterized_input, missing = _substitute(input_data, self.params)
            parameterized_ref, ref_missing = _substitute(target_ref, self.params)
            missing = list(dict.fromkeys(missing + ref_missing))

            if missing:
                pause = WorkflowPause(
                    kind="workflow.input_required",
                    step=step_id,
                    step_index=index,
                    reason=f"missing required input parameter(s): {', '.join(missing)}",
                    missing_params=missing,
                )
                pauses.append(pause)
                await self._emit({
                    "type": "approval.required",
                    "kind": pause.kind,
                    "workflow_id": workflow_id,
                    "step": step_id,
                    "step_index": index,
                    "reason": pause.reason,
                    "missing_params": missing,
                })
                if self.approval_callback is None:
                    status = "abandoned"
                    steps_out.append(WorkflowStepResult(
                        step_id=step_id, kind=kind, action_type="",
                        status="skipped", error=pause.reason,
                    ))
                    break
                resume = await self._ask_approval(pause)
                if not resume:
                    status = "abandoned"
                    steps_out.append(WorkflowStepResult(
                        step_id=step_id, kind=kind, action_type="",
                        status="skipped", error=pause.reason,
                    ))
                    break
                await self._emit({
                    "type": "approval.resolved",
                    "kind": pause.kind,
                    "workflow_id": workflow_id,
                    "step": step_id,
                    "approved": True,
                })
                parameterized_input = _blank_placeholders(parameterized_input)
                parameterized_ref = _blank_placeholders(parameterized_ref)

            if kind in requires_approval_for:
                pause = WorkflowPause(
                    kind="workflow.step_approval",
                    step=step_id,
                    step_index=index,
                    reason=f"step kind {kind!r} requires approval per workflow safety policy",
                )
                pauses.append(pause)
                await self._emit({
                    "type": "approval.required",
                    "kind": pause.kind,
                    "workflow_id": workflow_id,
                    "step": step_id,
                    "step_index": index,
                    "reason": pause.reason,
                })
                if self.approval_callback is None:
                    status = "abandoned"
                    steps_out.append(WorkflowStepResult(
                        step_id=step_id, kind=kind, action_type="",
                        status="skipped", error=pause.reason,
                    ))
                    break
                resume = await self._ask_approval(pause)
                if not resume:
                    status = "abandoned"
                    steps_out.append(WorkflowStepResult(
                        step_id=step_id, kind=kind, action_type="",
                        status="skipped", error=pause.reason,
                    ))
                    break
                await self._emit({
                    "type": "approval.resolved",
                    "kind": pause.kind,
                    "workflow_id": workflow_id,
                    "step": step_id,
                    "approved": True,
                })

            action_type = self._map_action_type(kind)
            step_status, error = await self._execute_step(
                kind=kind,
                action_type=action_type,
                target=parameterized_ref,
                parameters=parameterized_input,
            )
            steps_out.append(WorkflowStepResult(
                step_id=step_id, kind=kind, action_type=action_type,
                status=step_status, error=error,
            ))
            await self._emit({
                "type": "workflow.step",
                "workflow_id": workflow_id,
                "step": step_id,
                "step_index": index,
                "kind": kind,
                "action_type": action_type,
                "status": step_status,
                "error": error,
            })

        result = WorkflowRunResult(
            workflow_id=workflow_id,
            title=title,
            run_id=run_id,
            session_id=self.session_id,
            status=status,
            steps=steps_out,
            pauses=pauses,
        )
        await self._emit({
            "type": "workflow.finished",
            "workflow_id": workflow_id,
            "run_id": run_id,
            "status": status,
            "completed_steps": sum(1 for s in steps_out if s.status == "ok"),
            "total_steps": len(spec["steps"]),
        })
        return result

    # ── internals ────────────────────────────────────────────────────────────

    def _map_action_type(self, kind: str) -> str:
        if self.adapter is not None and hasattr(self.adapter, "registered_adapters"):
            return EXECUTOR_ACTION_MAP.get(kind, kind)
        return PLAIN_ACTION_MAP.get(kind, kind)

    async def _execute_step(
        self,
        kind: str,
        action_type: str,
        target: str,
        parameters: Dict[str, Any],
    ) -> Tuple[str, Optional[str]]:
        if self.adapter is None:
            return "error", "no adapter available for workflow execution"
        params = dict(parameters or {})
        # navigate steps commonly carry the URL under input.url
        if kind == "navigate" and not target and params.get("url"):
            target = str(params["url"])
        try:
            from core.base_adapter import ActionRequest

            req = ActionRequest(action_type=action_type, target=target, parameters=params)
        except Exception:
            req = type("ActionRequest", (), {
                "action_type": action_type,
                "target": target,
                "parameters": params,
            })()
        try:
            if hasattr(self.adapter, "registered_adapters"):
                result = await self.adapter.execute(
                    req, session_id=self.session_id, run_id=str(uuid.uuid4())
                )
            else:
                result = await self.adapter.execute(req)
            if result is None:
                return "ok", None
            result_status = getattr(result, "status", "completed")
            error = getattr(result, "error", None)
            error_msg = None
            if isinstance(error, dict):
                error_msg = error.get("message") or error.get("code")
            elif error:
                error_msg = str(error)
            if error_msg or result_status in ("failed", "cancelled"):
                return "error", error_msg or f"action status: {result_status}"
            return "ok", None
        except Exception as exc:
            logger.warning("[workflow] step %s (%s) failed: %s", kind, action_type, exc)
            return "error", str(exc)

    async def _ask_approval(self, pause: WorkflowPause) -> bool:
        try:
            decision = self.approval_callback(pause)
            if asyncio.iscoroutine(decision):
                decision = await decision
            return bool(decision)
        except Exception as exc:
            logger.warning("[workflow] approval callback failed, abandoning: %s", exc)
            return False

    async def _emit(self, event: Dict[str, Any]) -> None:
        if self.on_event is None:
            return
        try:
            outcome = self.on_event(event)
            if asyncio.iscoroutine(outcome):
                await outcome
        except Exception as exc:
            logger.warning("[workflow] event callback failed: %s", exc)
