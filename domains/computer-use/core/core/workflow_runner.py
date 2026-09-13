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
  - Record→teach→batch (stagehand-batch-fork deferral A): when every step is
    batch-mappable (whitelist vocabulary, selector-like targets, no
    ``requiresApprovalFor`` kind), the whole spec compiles to ONE grant-bound
    batch dispatched through ``core/batch_dispatch.py`` at run start. A
    declined/failed grant or a halted batch falls back to the per-step runner
    mid-workflow (resuming at the failed step; completed steps are never
    silently retried). Set ``ALLTERNIT_WORKFLOW_BATCH=0`` (or pass
    ``batch_enabled=False``) to keep the per-step path byte-for-byte.
  - Each step is dispatched through the adapter layer exactly like
    ReplayEngine does (executor signature when the adapter has
    ``registered_adapters``, plain ``execute(req)`` otherwise).
  - Emits ``workflow.*`` events: started / step / batch / approval.* /
    finished.
"""

from __future__ import annotations

import asyncio
import logging
import os
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
        batch_client: Optional[Any] = None,      # AciBatchClient; default constructed lazily
        ledger: Optional[Callable[[str, Dict[str, Any]], None]] = None,  # canonical EventLedger writer
        batch_enabled: Optional[bool] = None,    # None → env ALLTERNIT_WORKFLOW_BATCH (default on)
        batch_mode: str = "batch",               # "batch" (one grant) | "per_step"
        batch_page_url: Optional[str] = None,    # operator-pinned page binding; else observed
        batch_headless: bool = True,
    ) -> None:
        self.adapter = adapter
        self.session_id = session_id
        self.approval_callback = approval_callback
        self.on_event = on_event
        self.cancel_event = cancel_event
        self.params = dict(params or {})
        self.batch_client = batch_client
        self.ledger = ledger
        self._batch_enabled_override = batch_enabled
        self.batch_mode = batch_mode
        self.batch_page_url = batch_page_url
        self.batch_headless = batch_headless

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

        # Record→teach→batch: a fully batch-mappable spec runs as ONE
        # grant-bound batch. Any non-committal outcome (no compile, declined
        # grant, failed dispatch) falls through to the unchanged per-step
        # path; a halted batch resumes per-step at the failed step only.
        resume_index = 0
        batch_finished = False
        if self._batch_enabled() and self.adapter is not None:
            batch_steps = self._compile_batch(spec, requires_approval_for)
            if batch_steps is not None:
                outcome, resume_at = await self._run_batch(
                    spec, batch_steps, workflow_id, run_id, steps_out, pauses
                )
                if outcome == "done":
                    batch_finished = True
                elif outcome == "resume":
                    # Drop the halted-step placeholder; the per-step runner
                    # re-attempts from that index. Completed steps stay out.
                    del steps_out[resume_at:]
                    resume_index = resume_at

        if not batch_finished:
            status = await self._run_steps(
                spec, resume_index, requires_approval_for,
                steps_out, pauses, workflow_id, run_id,
            )

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

    # ── batch compilation / dispatch (record→teach→batch) ────────────────

    def _batch_enabled(self) -> bool:
        if self._batch_enabled_override is not None:
            return self._batch_enabled_override
        return os.environ.get("ALLTERNIT_WORKFLOW_BATCH", "1").strip().lower() \
            not in ("0", "false", "off", "no")

    def _compile_batch(
        self,
        spec: Dict[str, Any],
        requires_approval_for: set,
    ) -> Optional[List[Dict[str, Any]]]:
        """Compile the spec's steps to one batch descriptor's step list.

        Returns ``None`` when any step cannot ride the batch (out-of-
        vocabulary kind, non-selector target, approval-required kind) or when
        a ``{{param}}`` is unresolved — in the latter case the per-step path
        must run first so its input pause stays the contract.
        """
        try:
            from .batch_dispatch import workflow_steps_to_batch_steps

            substituted: List[Dict[str, Any]] = []
            for step in spec["steps"]:
                input_data, missing = _substitute(dict(step.get("input") or {}), self.params)
                target = step.get("target") or {}
                ref, ref_missing = _substitute(
                    str(target.get("ref") or target.get("description") or ""), self.params
                )
                if missing or ref_missing:
                    return None
                substituted.append({
                    "kind": step.get("kind"),
                    "input": input_data,
                    "target": {"ref": ref},
                })
            return workflow_steps_to_batch_steps(substituted, requires_approval_for)
        except Exception as exc:
            logger.warning("[workflow] batch compilation skipped: %s", exc)
            return None

    async def _run_batch(
        self,
        spec: Dict[str, Any],
        batch_steps: List[Dict[str, Any]],
        workflow_id: str,
        run_id: str,
        steps_out: List[WorkflowStepResult],
        pauses: List[WorkflowPause],
    ) -> Tuple[str, int]:
        """Dispatch the compiled workflow as ONE grant-bound batch.

        Returns ``("done", 0)`` when every step completed, ``("resume", i)``
        when the batch halted (caller resumes the per-step runner at i), or
        ``("fallback", 0)`` when nothing executed through the batch path
        (declined grant / failed dispatch). ``steps_out`` receives one result
        per step from the receipt.
        """
        from .batch_context import (
            BatchContextRecord,
            close_batch_context,
            open_batch_context,
        )
        from .batch_dispatch import (
            AciBatchClient,
            observe_adapter_page_url,
            place_grant_for_retry,
        )

        # Page binding: operator pin wins; otherwise observe the adapter's
        # current URL (non-browser surfaces yield None → origin+session only).
        page_url = self.batch_page_url
        if not page_url:
            page_url = await observe_adapter_page_url(self.adapter)

        record = BatchContextRecord(
            run_id=run_id,
            session_id=self.session_id,
            step_count=len(batch_steps),
            step_methods=[s["method"] for s in batch_steps],
            origin="aci.workflow",
            page_url=page_url,
            batch_mode=self.batch_mode,
        )
        # Contract §4: opened BEFORE the batch RPC (audit-before-act).
        open_batch_context(self.ledger, record)

        client = self.batch_client
        if client is None:
            try:
                client = AciBatchClient()
            except Exception as exc:
                logger.warning("[workflow] batch client unavailable, per-step fallback: %s", exc)
                close_batch_context(self.ledger, record, status="failed", model_turns_saved=0)
                return ("fallback", 0)
            self.batch_client = client

        await self._emit({
            "type": "workflow.batch",
            "workflow_id": workflow_id,
            "run_id": run_id,
            "phase": "compiled",
            "step_count": len(batch_steps),
            "step_methods": list(record.step_methods),
            "page_url": page_url,
        })

        async def _try(approval_id=None, step_approval_ids=None):
            return await client.execute_batch(
                steps=batch_steps,
                mode=self.batch_mode,
                origin="aci.workflow",
                session=self.session_id or None,
                page_url=page_url,
                approval_id=approval_id,
                step_approval_ids=step_approval_ids,
                headless=self.batch_headless,
            )

        attempt = await _try()

        if attempt.confirmation_required:
            record.batch_id = record.descriptor_hash = attempt.action_hash or "pending"
            pause = WorkflowPause(
                kind="workflow.batch_grant",
                step=str(batch_steps[0].get("selector") or "batch"),
                step_index=0,
                reason=f"batch grant required (hash={attempt.action_hash})",
            )
            pauses.append(pause)
            await self._emit({
                "type": "approval.required",
                "kind": pause.kind,
                "workflow_id": workflow_id,
                "step": pause.step,
                "step_index": 0,
                "reason": pause.reason,
                # Operators redeem this through the Rust handoff surface
                # (POST /aci/handoff/:approval_id/approve) before resolving
                # the run-level approval.
                "approval_id": attempt.approval_id,
            })
            approved = False
            if self.approval_callback is not None:
                approved = await self._ask_approval(pause)
            await self._emit({
                "type": "approval.resolved",
                "kind": pause.kind,
                "workflow_id": workflow_id,
                "step": pause.step,
                "approved": approved,
                "approval_id": attempt.approval_id,
            })
            if not approved or not attempt.approval_id:
                close_batch_context(self.ledger, record, status="denied", model_turns_saved=0)
                logger.info("[workflow] batch grant declined — per-step fallback")
                return ("fallback", 0)
            retry_kwargs = place_grant_for_retry(
                self.batch_mode, attempt, attempt.approval_id, len(batch_steps)
            )
            attempt = await _try(**retry_kwargs)
            if not attempt.executed:
                close_batch_context(
                    self.ledger, record,
                    status="denied" if attempt.confirmation_required else "failed",
                    model_turns_saved=0,
                )
                logger.warning(
                    "[workflow] batch grant retry did not execute (%s) — per-step fallback",
                    attempt.error or "still confirmation_required",
                )
                return ("fallback", 0)

        if not attempt.executed:
            close_batch_context(self.ledger, record, status="failed", model_turns_saved=0)
            logger.warning("[workflow] batch dispatch failed (%s) — per-step fallback", attempt.error)
            return ("fallback", 0)

        receipt = attempt.receipt or {}
        receipt_status = receipt.get("status", "completed")
        halted_at = receipt.get("halted_at")
        outcomes: Dict[int, Dict[str, Any]] = {}
        for position, entry in enumerate(receipt.get("steps") or []):
            if isinstance(entry, dict):
                outcomes[int(entry.get("index", position))] = entry

        steps_completed = 0
        for index, step in enumerate(spec["steps"]):
            kind = str(step["kind"])
            method = batch_steps[index]["method"]
            entry = outcomes.get(index)
            if entry is None:
                result = WorkflowStepResult(
                    step_id=str(step["id"]), kind=kind, action_type=method,
                    status="skipped", error=f"batch halted before step {index}",
                )
            elif entry.get("status") == "completed":
                steps_completed += 1
                result = WorkflowStepResult(
                    step_id=str(step["id"]), kind=kind, action_type=method, status="ok",
                )
            else:
                detail = entry.get("error") or entry.get("detail") or "batch step failed"
                result = WorkflowStepResult(
                    step_id=str(step["id"]), kind=kind, action_type=method,
                    status="error", error=str(detail),
                )
            steps_out.append(result)
            await self._emit({
                "type": "workflow.step",
                "workflow_id": workflow_id,
                "step": str(step["id"]),
                "step_index": index,
                "kind": kind,
                "action_type": method,
                "status": result.status,
                "error": result.error,
                "via": "batch",
            })

        record.batch_id = record.descriptor_hash = attempt.descriptor_hash or "unknown"
        close_batch_context(
            self.ledger, record,
            status=receipt_status,
            halted_at=halted_at,
            steps_completed=steps_completed,
            receipt_id=attempt.receipt_id,
            model_turns_saved=max(len(batch_steps) - 1, 0),
        )
        await self._emit({
            "type": "workflow.batch",
            "workflow_id": workflow_id,
            "run_id": run_id,
            "phase": "executed",
            "status": receipt_status,
            "halted_at": halted_at,
            "descriptor_hash": attempt.descriptor_hash,
            "receipt_id": attempt.receipt_id,
        })

        if receipt_status == "completed" and halted_at is None:
            return ("done", 0)
        resume_at = halted_at if isinstance(halted_at, int) else steps_completed
        return ("resume", min(max(resume_at, 0), len(spec["steps"]) - 1))

    async def _run_steps(
        self,
        spec: Dict[str, Any],
        start_index: int,
        requires_approval_for: set,
        steps_out: List[WorkflowStepResult],
        pauses: List[WorkflowPause],
        workflow_id: str,
        run_id: str,
    ) -> str:
        """The per-step runner, unchanged from the pre-batch behavior.

        Starts at ``start_index`` so a halted batch resumes at the failed
        step without re-running completed ones.
        """
        status = "completed"

        for index, step in enumerate(spec["steps"]):
            if index < start_index:
                continue
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

        return status

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
