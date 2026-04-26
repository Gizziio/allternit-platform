"""
Allternit Computer Use — Planning Loop (Non-Claude Model Path)

Plan → Act → Observe → Reflect loop for non-Claude LLM-driven computer automation.
Used when the active model is GPT-4o, Gemini, Qwen, or any model without native
computer-use tool support. Pairs with vision_providers.py for perception.

Claude's native computer tool bypasses this entirely — Claude calls the ACU executor
directly via the gateway without a planning loop.

Inspired by Agent S (72.6% OSWorld), ScreenAgent (IJCAI 2024).
"""

from __future__ import annotations

import asyncio
import time
import uuid
import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple, AsyncIterator
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class StopReason(Enum):
    DONE = "done"
    MAX_STEPS = "max_steps"
    MAX_COST = "max_cost"
    TIMEOUT = "timeout"
    ERROR = "error"
    APPROVAL_DENIED = "approval_denied"
    CANCELLED = "cancelled"


@dataclass
class LoopStep:
    """One complete Plan→Act→Observe→Reflect cycle."""
    step: int
    run_id: str
    session_id: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    # Plan phase
    reasoning: str = ""
    plan_steps: List[str] = field(default_factory=list)
    risk_level: str = "low"
    requires_approval: bool = False

    # Action
    action_type: str = ""
    action_target: str = ""
    action_params: Dict[str, Any] = field(default_factory=dict)

    # Observe phase
    before_screenshot_b64: str = ""
    after_screenshot_b64: str = ""

    # Reflect phase
    reflection: str = ""
    action_succeeded: bool = True

    # Verification
    verification_evidence: Optional[Dict] = None

    # AX tree context
    ax_tree_snapshot: Optional[Dict] = None
    element_refs: Optional[Dict] = None

    # Cost tracking
    tokens_used: int = 0
    cost_usd: float = 0.0

    # Result
    adapter_result: Optional[Dict] = None
    error: Optional[str] = None

    def to_dict(self, include_screenshots: bool = True) -> Dict:
        d = {
            "step": self.step,
            "run_id": self.run_id,
            "session_id": self.session_id,
            "timestamp": self.timestamp,
            "reasoning": self.reasoning,
            "plan_steps": self.plan_steps,
            "risk_level": self.risk_level,
            "requires_approval": self.requires_approval,
            "action_type": self.action_type,
            "action_target": self.action_target,
            "action_params": self.action_params,
            "reflection": self.reflection,
            "action_succeeded": self.action_succeeded,
            "tokens_used": self.tokens_used,
            "cost_usd": self.cost_usd,
            "error": self.error,
        }
        if include_screenshots:
            d["before_screenshot_b64"] = self.before_screenshot_b64
            d["after_screenshot_b64"] = self.after_screenshot_b64
        return d


@dataclass
class PlanningLoopConfig:
    """Configuration for a planning loop run."""
    max_steps: int = 20
    max_cost_usd: float = 1.0
    timeout_ms: int = 120_000
    reflect_after_each_step: bool = True
    approval_policy: str = "on-risk"   # never | on-risk | always
    record: bool = True
    vision_provider: Optional[str] = None  # override env


@dataclass
class PlanningLoopResult:
    """Final result of a planning loop run."""
    run_id: str
    session_id: str
    task: str
    status: str                          # completed | failed | needs_approval | cancelled | timeout
    stop_reason: StopReason
    steps: List[LoopStep] = field(default_factory=list)
    summary: str = ""
    total_cost_usd: float = 0.0
    total_tokens: int = 0
    duration_ms: int = 0
    final_screenshot_b64: str = ""
    error: Optional[str] = None
    gif_path: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "run_id": self.run_id,
            "session_id": self.session_id,
            "task": self.task,
            "status": self.status,
            "stop_reason": self.stop_reason.value,
            "steps": [s.to_dict() for s in self.steps],
            "summary": self.summary,
            "total_cost_usd": self.total_cost_usd,
            "total_tokens": self.total_tokens,
            "duration_ms": self.duration_ms,
            "error": self.error,
            "gif_path": self.gif_path,
        }


# Event types emitted during the loop — consumed by SSE streaming
LOOP_EVENTS = [
    "plan.created",
    "action.started",
    "screenshot.captured",
    "action.completed",
    "action.verified",
    "reflection.done",
    "approval.required",
    "approval.received",
    "ax_tree.captured",
    "coordinate.contract",
    "cursor.moved",
    "element.targeted",
    "window.discovered",
    "notification.received",
    "run.completed",
    "run.failed",
]


class PlanningLoop:
    """
    Core Plan→Act→Observe→Reflect execution engine.

    Usage:
        loop = PlanningLoop(vision_provider, adapter, config)
        result = await loop.run(task, session_id, run_id)

    With streaming:
        async for event in loop.run_streaming(task, session_id, run_id):
            yield f"event: {event['type']}\\ndata: {json.dumps(event)}\\n\\n"
    """

    def __init__(
        self,
        vision_provider,          # VisionProvider instance
        adapter,                  # BaseAdapter or ComputerUseExecutor
        config: Optional[PlanningLoopConfig] = None,
        recorder=None,            # Optional ActionRecorder
        event_callback: Optional[Callable[[Dict], None]] = None,
        approval_callback: Optional[Callable[[LoopStep], bool]] = None,
    ):
        self.vision_provider = vision_provider
        # Accept ComputerUseExecutor directly — it has the same execute() interface
        # as BaseAdapter, so no wrapping is needed.
        self.adapter = adapter
        self.config = config or PlanningLoopConfig()
        self.recorder = recorder
        self.event_callback = event_callback
        self.approval_callback = approval_callback
        self._cancelled = False

    def cancel(self) -> None:
        """Cancel a running loop."""
        self._cancelled = True

    async def run(self, task: str, session_id: str, run_id: Optional[str] = None) -> PlanningLoopResult:
        """Run the planning loop to completion."""
        run_id = run_id or f"cu-{uuid.uuid4().hex[:12]}"
        steps: List[LoopStep] = []
        start_ms = time.time() * 1000
        total_cost = 0.0
        total_tokens = 0
        history: List[Dict] = []
        current_screenshot: bytes = b""
        stop_reason = StopReason.ERROR
        error_msg: Optional[str] = None
        _consecutive_screenshots = 0

        # Inject scratchpad context — strategy + skills + lessons from prior runs
        try:
            from .scratchpad import get_scratchpad
            _scratchpad = get_scratchpad()
            sp_context = _scratchpad.build_context(task)
        except Exception:
            _scratchpad = None
            sp_context = ""

        # Prepend scratchpad context to task so the vision provider sees it
        augmented_task = (task + "\n\n" + sp_context) if sp_context else task
        if _ax_context:
            augmented_task = augmented_task + "\n\n[ACCESSIBILITY TREE (skeleton)]:\n" + _ax_context

        # AX inspector — init once, use throughout loop
        _inspector = None
        _ax_context = ""
        try:
            from .accessibility_inspector import AccessibilityInspector
            _inspector = AccessibilityInspector()
            if not await _inspector.is_available():
                _inspector = None
        except Exception:
            _inspector = None

        try:
            # Initial screenshot
            current_screenshot = await self._capture_screenshot(session_id)
            self._emit({"type": "screenshot.captured", "run_id": run_id, "step": 0, "phase": "initial",
                        "screenshot_b64": _bytes_to_b64(current_screenshot)})

            # Emit coordinate contract from initial screenshot dimensions
            if _inspector:
                try:
                    contract = await _inspector.get_coordinate_contract()
                    self._emit({"type": "coordinate.contract", "run_id": run_id, **contract.to_dict()})
                except Exception:
                    pass

            # Initial AX skeleton snapshot
            if _inspector:
                try:
                    ax_root = await _inspector.snapshot(skeleton=True)
                    if ax_root:
                        _ax_context = _inspector._to_tree_text(ax_root)
                        self._emit({"type": "ax_tree.captured", "run_id": run_id, "step": 0,
                                   "surface": "window", "skeleton": True,
                                   "tree": ax_root.to_dict(compact=True)})
                except Exception:
                    pass

            for step_num in range(1, self.config.max_steps + 1):
                if self._cancelled:
                    stop_reason = StopReason.CANCELLED
                    break

                elapsed = time.time() * 1000 - start_ms
                if elapsed > self.config.timeout_ms:
                    stop_reason = StopReason.TIMEOUT
                    break

                if total_cost >= self.config.max_cost_usd:
                    stop_reason = StopReason.MAX_COST
                    break

                step = LoopStep(step=step_num, run_id=run_id, session_id=session_id)
                step.before_screenshot_b64 = _bytes_to_b64(current_screenshot) if current_screenshot else ""

                # PLAN phase
                try:
                    b64_screenshot = _bytes_to_b64(current_screenshot) if current_screenshot else ""
                    # ground_and_reason expects screenshot_b64 (str), not screenshot_bytes
                    plan = await self.vision_provider.ground_and_reason(
                        screenshot_b64=b64_screenshot,
                        task=augmented_task,
                        history=[h.get("action", "") + ": " + h.get("observation", "") for h in history],
                    )
                except Exception as e:
                    # Fallback: use analyze_screenshot (async) to avoid event-loop conflict
                    logger.warning(f"ground_and_reason failed: {e}, falling back to analyze_screenshot")
                    from .vision_providers import ActionPlan, VisionAction
                    resp = await self.vision_provider.analyze_screenshot(b64_screenshot, augmented_task)
                    plan = ActionPlan(
                        reasoning=getattr(resp, "raw_response", "") or "",
                        plan_steps=[task],
                        immediate_action=resp.action or VisionAction(type="screenshot", target="screen", reason=""),
                        confidence=resp.confidence,
                    )

                step.reasoning = plan.reasoning
                step.plan_steps = plan.plan_steps
                step.risk_level = plan.risk_level
                step.requires_approval = plan.requires_approval
                step.action_type = plan.immediate_action.type
                step.action_target = plan.immediate_action.target
                step.action_params = {
                    "coordinates": plan.immediate_action.coordinates,
                    "text": getattr(plan.immediate_action, "text", None),
                }
                step.tokens_used = getattr(plan, "tokens_used", 0)
                step.cost_usd = getattr(plan, "cost_usd", 0.0)
                total_tokens += step.tokens_used
                total_cost += step.cost_usd

                self._emit({"type": "plan.created", "run_id": run_id, "step": step_num,
                           "reasoning": plan.reasoning, "action_type": plan.immediate_action.type,
                           "risk_level": plan.risk_level})

                # Stall detection: if vision keeps returning "screenshot" with no progress, fail fast
                if plan.immediate_action.type == "screenshot":
                    _consecutive_screenshots += 1
                    if _consecutive_screenshots >= 3:
                        error_msg = "Vision provider stalled: 3 consecutive screenshot-only responses with no real action"
                        logger.error(error_msg)
                        stop_reason = StopReason.ERROR
                        steps.append(step)
                        break
                else:
                    _consecutive_screenshots = 0

                if plan.done:
                    stop_reason = StopReason.DONE
                    if self.recorder:
                        await self.recorder.record_frame_from_step(step)
                    steps.append(step)
                    break

                # Approval gate
                needs_approval = (
                    self.config.approval_policy == "always" or
                    (self.config.approval_policy == "on-risk" and plan.requires_approval)
                )
                if needs_approval:
                    self._emit({"type": "approval.required", "run_id": run_id, "step": step_num,
                               "action_preview": step.to_dict(), "reason": f"risk={plan.risk_level}"})
                    approved = await self._request_approval(step)
                    if not approved:
                        stop_reason = StopReason.APPROVAL_DENIED
                        steps.append(step)
                        break
                    self._emit({"type": "approval.received", "run_id": run_id, "step": step_num, "approved": True})

                # Refresh AX skeleton before each action
                if _inspector:
                    try:
                        ax_root = await _inspector.snapshot(skeleton=True)
                        if ax_root:
                            from .element_refs import get_refmap
                            _refmap = get_refmap()
                            _refmap.apply_to_tree(ax_root)
                            step.ax_tree_snapshot = ax_root.to_dict(compact=True)
                            step.element_refs = _refmap.to_dict()
                            self._emit({"type": "ax_tree.captured", "run_id": run_id, "step": step_num,
                                       "surface": "window", "skeleton": True,
                                       "tree": step.ax_tree_snapshot,
                                       "ref_map": step.element_refs})
                    except Exception:
                        pass

                # ACT phase
                self._emit({"type": "action.started", "run_id": run_id, "step": step_num,
                           "action_type": step.action_type, "target": step.action_target})

                # Emit cursor position when coordinates available
                if plan.immediate_action.coordinates and len(plan.immediate_action.coordinates) >= 2:
                    cx, cy = plan.immediate_action.coordinates[0], plan.immediate_action.coordinates[1]
                    effect = "ripple" if plan.immediate_action.type in ("click", "double_click") else \
                             "glow" if plan.immediate_action.type == "hover" else "none"
                    self._emit({"type": "cursor.moved", "run_id": run_id, "step": step_num,
                               "x": cx, "y": cy, "agent_id": "primary", "effect": effect})

                try:
                    result = await self._execute_action(plan.immediate_action, session_id)
                    step.adapter_result = result
                    step.action_succeeded = True
                except Exception as act_err:
                    step.error = str(act_err)
                    step.action_succeeded = False
                    logger.warning(f"Action failed at step {step_num}: {act_err}")

                # OBSERVE phase
                new_screenshot = await self._capture_screenshot(session_id)
                step.after_screenshot_b64 = _bytes_to_b64(new_screenshot) if new_screenshot else ""
                self._emit({"type": "screenshot.captured", "run_id": run_id, "step": step_num, "phase": "after_action",
                            "screenshot_b64": step.after_screenshot_b64})
                self._emit({"type": "action.completed", "run_id": run_id, "step": step_num,
                           "success": step.action_succeeded})

                # STATE VERIFICATION
                try:
                    from .state_verification import StateVerifier, StateCapture
                    _verifier = StateVerifier(inspector=_inspector)
                    before_capture = StateCapture(
                        token=_verifier.make_token(current_screenshot, None),
                        screenshot_bytes=current_screenshot,
                        ax_tree=None,
                        captured_at=step.timestamp,
                    )
                    after_capture = StateCapture(
                        token=_verifier.make_token(new_screenshot, None),
                        screenshot_bytes=new_screenshot,
                        ax_tree=None,
                        captured_at=datetime.now(timezone.utc).isoformat(),
                    )
                    evidence = _verifier.verify(before_capture, after_capture, step.action_type)
                    step.verification_evidence = evidence.to_dict()
                    self._emit({"type": "action.verified", "run_id": run_id, "step": step_num,
                               "verified_success": evidence.verified_success,
                               "confidence": evidence.confidence,
                               "changed": evidence.changed,
                               "notes": evidence.notes})
                except Exception:
                    pass

                # REFLECT phase
                if self.config.reflect_after_each_step:
                    step.reflection = await self._reflect(
                        current_screenshot, new_screenshot, plan.immediate_action, step.action_succeeded
                    )
                    self._emit({"type": "reflection.done", "run_id": run_id, "step": step_num,
                               "reflection": step.reflection})

                current_screenshot = new_screenshot

                # Update history for next step (cap to last 8 to bound context growth)
                history.append({
                    "action": f"{step.action_type} on {step.action_target}",
                    "observation": step.reflection or ("succeeded" if step.action_succeeded else f"failed: {step.error}"),
                })
                if len(history) > 8:
                    history = history[-8:]

                # Record step
                if self.recorder:
                    await self.recorder.record_frame_from_step(step)

                steps.append(step)

            else:
                stop_reason = StopReason.MAX_STEPS

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Planning loop error: {e}", exc_info=True)
            stop_reason = StopReason.ERROR

        duration_ms = int(time.time() * 1000 - start_ms)
        status_map = {
            StopReason.DONE: "completed",
            StopReason.MAX_STEPS: "completed",
            StopReason.MAX_COST: "completed",
            StopReason.TIMEOUT: "failed",
            StopReason.ERROR: "failed",
            StopReason.APPROVAL_DENIED: "needs_approval",
            StopReason.CANCELLED: "cancelled",
        }
        status = status_map.get(stop_reason, "failed")

        result = PlanningLoopResult(
            run_id=run_id,
            session_id=session_id,
            task=task,
            status=status,
            stop_reason=stop_reason,
            steps=steps,
            summary=self._build_summary(steps, stop_reason),
            total_cost_usd=total_cost,
            total_tokens=total_tokens,
            duration_ms=duration_ms,
            final_screenshot_b64=_bytes_to_b64(current_screenshot) if current_screenshot else "",
            error=error_msg,
        )

        event_type = "run.completed" if status in ("completed",) else "run.failed"
        self._emit({"type": event_type, "run_id": run_id, "status": status,
                   "summary": result.summary, "duration_ms": duration_ms})

        # Post-run reflection — compound learnings across runs
        if _scratchpad is not None:
            try:
                sp_outcome = "success" if status == "completed" else ("failure" if status == "failed" else status)
                await _scratchpad.reflect(
                    task=task,
                    steps=steps,
                    outcome=sp_outcome,
                    session_id=session_id,
                    duration_s=duration_ms / 1000,
                    tokens_used=total_tokens,
                    error_summary=error_msg or "",
                )
            except Exception as sp_err:
                logger.warning("[planning-loop] scratchpad reflect failed: %s", sp_err)

        return result

    async def run_streaming(self, task: str, session_id: str, run_id: Optional[str] = None) -> AsyncIterator[Dict]:
        """Run with streaming — yields events as they happen."""
        events: asyncio.Queue[Optional[Dict]] = asyncio.Queue()

        original_callback = self.event_callback

        def collect_event(event: Dict) -> None:
            events.put_nowait(event)
            if original_callback:
                original_callback(event)

        self.event_callback = collect_event

        async def run_loop():
            result = await self.run(task, session_id, run_id)
            events.put_nowait(None)  # sentinel
            return result

        loop_task = asyncio.create_task(run_loop())

        while True:
            event = await events.get()
            if event is None:
                break
            yield event

        await loop_task
        self.event_callback = original_callback

    def _is_executor(self) -> bool:
        """True if self.adapter is a ComputerUseExecutor (has waterfall dispatch)."""
        return hasattr(self.adapter, "registered_adapters")

    async def _capture_screenshot(self, session_id: str) -> bytes:
        """Capture screenshot via adapter or executor."""
        import base64 as _b64
        try:
            # GatewayProxyAdapter convenience method
            if hasattr(self.adapter, "screenshot") and not self._is_executor():
                return await self.adapter.screenshot(session_id)

            run_id = str(uuid.uuid4())
            req = type("ActionRequest", (), {
                "action_type": "screenshot", "target": "", "parameters": {},
            })()

            if self._is_executor():
                result = await self.adapter.execute(req, session_id=session_id, run_id=run_id)
            else:
                result = await self.adapter.execute(req)

            if result is None:
                return b""

            ec = getattr(result, "extracted_content", None) or {}
            if isinstance(ec, dict):
                data_url = ec.get("data_url", "")
                if data_url.startswith("data:"):
                    return _b64.b64decode(data_url.split(",", 1)[-1])

            artifacts = getattr(result, "artifacts", []) or []
            for art in artifacts:
                art_type = art.type if hasattr(art, "type") else art.get("type", "")
                if art_type == "screenshot":
                    content = art.content if hasattr(art, "content") else art.get("content")
                    if content:
                        return _b64.b64decode(content)
                    path = art.path if hasattr(art, "path") else art.get("path")
                    if path:
                        with open(path, "rb") as f:
                            return f.read()
            return b""
        except Exception as e:
            logger.warning("Screenshot capture failed: %s", e)
            return b""

    async def _execute_action(self, action, session_id: str) -> Dict:
        """Execute a VisionAction through the adapter or executor."""
        params: Dict[str, Any] = {}
        if action.coordinates:
            if len(action.coordinates) >= 2:
                params["x"] = int(action.coordinates[0])
                params["y"] = int(action.coordinates[1])
        if hasattr(action, "text") and action.text:
            params["text"] = action.text

        run_id = str(uuid.uuid4())
        req = type("ActionRequest", (), {
            "action_type": action.type,
            "target": action.target or "",
            "parameters": params,
        })()

        if self._is_executor():
            result = await self.adapter.execute(req, session_id=session_id, run_id=run_id)
        else:
            result = await self.adapter.execute(req)
        return result.to_dict() if result else {}

    async def _reflect(self, before: bytes, after: bytes, action, succeeded: bool) -> str:
        """Ask the vision provider to reflect on what changed."""
        if not before or not after:
            return "succeeded" if succeeded else "failed (no screenshot)"
        try:
            if before == after:
                return "screen unchanged — action may not have had effect"
            prompt = f"The previous action was '{action.type}' on '{action.target}'. Did it succeed? What changed on screen? One sentence."
            response = await self.vision_provider.analyze_screenshot(_bytes_to_b64(after), prompt)
            return response.raw_response or ("succeeded" if succeeded else "failed")
        except Exception:
            return "succeeded" if succeeded else "failed"

    async def _request_approval(self, step: LoopStep) -> bool:
        """Request approval from callback or default allow."""
        if self.approval_callback:
            try:
                if asyncio.iscoroutinefunction(self.approval_callback):
                    coro = self.approval_callback(step)
                else:
                    loop = asyncio.get_event_loop()
                    coro = loop.run_in_executor(None, self.approval_callback, step)
                return await asyncio.wait_for(coro, timeout=300.0)
            except asyncio.TimeoutError:
                return False
        return True

    def _emit(self, event: Dict) -> None:
        if self.event_callback:
            try:
                self.event_callback(event)
            except Exception as e:
                logger.debug("Event callback error for %s: %s", event.get("type"), e)

    def _build_summary(self, steps: List[LoopStep], stop_reason: StopReason) -> str:
        if not steps:
            return f"No steps completed. Stopped: {stop_reason.value}"
        actions = [f"{s.action_type}({s.action_target[:20]})" for s in steps]
        return f"Completed {len(steps)} step(s): {', '.join(actions[:5])}{'...' if len(actions) > 5 else ''}. Stopped: {stop_reason.value}"


def _bytes_to_b64(data: bytes) -> str:
    import base64
    return base64.b64encode(data).decode("utf-8") if data else ""
