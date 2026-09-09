"""
Allternit Computer Use — Deterministic Replay Engine

Re-executes a recorded JSONL trajectory against the adapter layer and, after
each action, compares the live screen state with the recorded
``after_screenshot_b64``. When the deviation score exceeds the configured
threshold the replay PAUSES and asks the caller (via an approval callback)
whether to resume or abandon — the protocol documented in
plugins/allternit-computer-use/skills/workflow-recording.md ("Replay Protocol").
"""

from __future__ import annotations

import asyncio
import base64
import logging
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence

from core.action_recorder import ActionRecorder, RecordedFrame, RecordingManifest

logger = logging.getLogger(__name__)

# Approval callback signature: receives a ReplayDeviation, returns True to
# resume the replay or False to abandon it.
ApprovalCallback = Callable[["ReplayDeviation"], Any]
# Event callback signature: receives a dict event (pushed to SSE streams).
EventCallback = Callable[[Dict[str, Any]], Any]
# Screenshot capture override: receives (adapter, session_id), returns PNG bytes.
ScreenshotCapture = Callable[[Any, str], Any]

DEFAULT_DEVIATION_THRESHOLD = 0.05


# ---------------------------------------------------------------------------
# Screenshot comparison
# ---------------------------------------------------------------------------

def screenshot_diff_score(recorded_b64: str, live_png: bytes) -> Optional[float]:
    """Mean per-pixel absolute difference ratio in [0, 1].

    0.0 = identical, 1.0 = maximally different. Returns None when the
    comparison is not possible (missing/invalid image data, no Pillow).
    Images are resized to the recorded frame's size and downscaled to at most
    256 px on the long edge before comparison, so scores are resolution-robust.
    """
    if not recorded_b64 or not live_png:
        return None
    try:
        import io

        from PIL import Image, ImageChops, ImageStat

        recorded = Image.open(io.BytesIO(base64.b64decode(recorded_b64))).convert("RGB")
        live = Image.open(io.BytesIO(live_png)).convert("RGB")
    except Exception as exc:
        logger.warning("[replay] screenshot decode failed: %s", exc)
        return None

    try:
        if live.size != recorded.size:
            live = live.resize(recorded.size)
        max_dim = 256
        if max(recorded.size) > max_dim:
            ratio = max_dim / max(recorded.size)
            recorded = recorded.resize(
                (max(1, int(recorded.size[0] * ratio)), max(1, int(recorded.size[1] * ratio)))
            )
            live = live.resize(recorded.size)
        diff = ImageChops.difference(recorded, live)
        stat = ImageStat.Stat(diff)
        score = sum(stat.mean) / (3 * 255.0)
        return min(1.0, max(0.0, score))
    except Exception as exc:
        logger.warning("[replay] screenshot diff failed: %s", exc)
        return None


def _bytes_to_b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


# ---------------------------------------------------------------------------
# Screenshot capture (mirrors PlanningLoop._capture_screenshot)
# ---------------------------------------------------------------------------

async def capture_screenshot(
    adapter: Any,
    session_id: str,
    secrets: Optional[Sequence[str]] = None,
) -> bytes:
    """Capture the current screen as PNG bytes.

    Order: direct adapter.screenshot() for plain adapters, then a screenshot
    action through the adapter/executor, then the host display (macOS
    screencapture) as a last resort. Returns b"" when nothing worked.

    `secrets`: optional credential values (run sandbox_env) used only to
    scrub exception text in this module's warning logs — an adapter failure
    that echoes its own environment must not write credential values to
    the log stream.
    """
    # Plain (non-executor) adapters may expose a direct screenshot method.
    if adapter is not None and hasattr(adapter, "screenshot") and not hasattr(adapter, "registered_adapters"):
        try:
            png = await adapter.screenshot(session_id)
            if png:
                return png
        except Exception as exc:
            logger.warning(
                "[replay] adapter.screenshot failed: %s",
                _scrub(str(exc), secrets),
            )

    # Executor / duck-typed adapter: run a "screenshot" action and unpack the
    # result envelope (data_url in extracted_content, or a screenshot artifact).
    if adapter is not None:
        png = await _capture_via_action(adapter, session_id, secrets)
        if png:
            return png

    return _capture_host()


async def _capture_via_action(
    adapter: Any,
    session_id: str,
    secrets: Optional[Sequence[str]] = None,
) -> bytes:
    try:
        req = _make_request("screenshot", "", {})
        if hasattr(adapter, "registered_adapters"):
            result = await adapter.execute(req, session_id=session_id, run_id=str(uuid.uuid4()))
        else:
            result = await adapter.execute(req)
        if result is None:
            return b""

        ec = getattr(result, "extracted_content", None) or {}
        if isinstance(ec, dict):
            data_url = ec.get("data_url", "")
            if isinstance(data_url, str) and data_url.startswith("data:"):
                return base64.b64decode(data_url.split(",", 1)[-1])

        artifacts = getattr(result, "artifacts", []) or []
        for art in artifacts:
            art_type = art.type if hasattr(art, "type") else art.get("type", "")
            if art_type != "screenshot":
                continue
            content = art.content if hasattr(art, "content") else art.get("content")
            if content:
                return base64.b64decode(content)
            path = art.path if hasattr(art, "path") else art.get("path")
            if path:
                with open(path, "rb") as handle:
                    return handle.read()
        return b""
    except Exception as exc:
        logger.warning(
            "[replay] screenshot action failed: %s",
            _scrub(str(exc), secrets),
        )
        return b""


def _scrub(text: str, secrets: Optional[Sequence[str]]) -> str:
    """Replace any run credential value in log-bound exception text."""
    if not secrets:
        return text
    for secret in secrets:
        if secret and secret in text:
            text = text.replace(secret, "***")
    return text


def _capture_host() -> bytes:
    """Last-resort capture of the actual computer screen (macOS only)."""
    if sys.platform != "darwin":
        return b""
    import os
    import subprocess
    import tempfile

    fd, path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        subprocess.run(
            ["screencapture", "-x", path],
            check=True,
            timeout=8,
            capture_output=True,
        )
        with open(path, "rb") as handle:
            data = handle.read()
        return data if len(data) > 32 else b""
    except Exception as exc:
        logger.warning("[replay] host screenshot capture failed: %s", exc)
        return b""
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _make_request(action_type: str, target: str, parameters: Dict[str, Any]) -> Any:
    """Build an ActionRequest, falling back to a duck-typed equivalent."""
    try:
        from core.base_adapter import ActionRequest

        return ActionRequest(action_type=action_type, target=target, parameters=parameters)
    except Exception:
        return type("ActionRequest", (), {
            "action_type": action_type,
            "target": target,
            "parameters": parameters,
        })()


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class ReplayDeviation:
    """A detected divergence between the recorded and live after-state."""
    step: int
    action_type: str
    score: float
    threshold: float
    recorded_after_b64: str = ""
    live_after_b64: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step": self.step,
            "action_type": self.action_type,
            "score": round(self.score, 4),
            "threshold": self.threshold,
            "recorded_after_b64": self.recorded_after_b64,
            "live_after_b64": self.live_after_b64,
        }


@dataclass
class ReplayStepResult:
    step: int
    action_type: str
    status: str  # "ok" | "error"
    error: Optional[str] = None
    deviation_score: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "step": self.step,
            "action_type": self.action_type,
            "status": self.status,
            "error": self.error,
            "deviation_score": round(self.deviation_score, 4) if self.deviation_score is not None else None,
        }


@dataclass
class ReplayResult:
    recording_id: str
    task: str
    status: str  # "completed" | "abandoned" | "deviated" | "cancelled" | "failed"
    steps: List[ReplayStepResult] = field(default_factory=list)
    deviations: List[ReplayDeviation] = field(default_factory=list)
    total_steps: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "recording_id": self.recording_id,
            "task": self.task,
            "status": self.status,
            "replayed_steps": len(self.steps),
            "total_steps": self.total_steps,
            "steps": [s.to_dict() for s in self.steps],
            "deviations": [d.to_dict() for d in self.deviations],
        }


# ---------------------------------------------------------------------------
# Replay engine
# ---------------------------------------------------------------------------

class ReplayEngine:
    """Re-execute a recording deterministically with deviation pauses.

    Args:
        adapter: Executor (waterfall dispatch) or a plain adapter with
            execute(req). None means every step fails with "no adapter".
        session_id: Session to replay against.
        deviation_threshold: Score above which a deviation pause triggers.
            None disables the after-screenshot check entirely.
        approval_callback: Called with a ReplayDeviation on deviation.
            Return True to resume, False to abandon. When omitted, the first
            deviation ends the replay with status "deviated".
        on_event: Optional async/sync callback for replay.* events.
        cancel_event: When set, the replay stops with status "cancelled".
        screenshot_capture: Optional override for screenshot capture;
            defaults to capture_screenshot().
    """

    def __init__(
        self,
        adapter: Any = None,
        session_id: str = "",
        deviation_threshold: Optional[float] = DEFAULT_DEVIATION_THRESHOLD,
        approval_callback: Optional[ApprovalCallback] = None,
        on_event: Optional[EventCallback] = None,
        cancel_event: Optional[asyncio.Event] = None,
        screenshot_capture: Optional[ScreenshotCapture] = None,
    ) -> None:
        self.adapter = adapter
        self.session_id = session_id
        self.deviation_threshold = deviation_threshold
        self.approval_callback = approval_callback
        self.on_event = on_event
        self.cancel_event = cancel_event
        self._screenshot_capture = screenshot_capture or capture_screenshot

    async def replay(self, recording_path: Path) -> ReplayResult:
        """Replay the recording at ``recording_path`` frame by frame."""
        manifest, frames = ActionRecorder.load(Path(recording_path))
        steps: List[ReplayStepResult] = []
        deviations: List[ReplayDeviation] = []
        status = "completed"

        await self._emit({
            "type": "replay.started",
            "recording_id": manifest.recording_id,
            "task": manifest.task,
            "total_steps": len(frames),
        })

        for frame in frames:
            if self.cancel_event is not None and self.cancel_event.is_set():
                status = "cancelled"
                break

            step_status, error = await self._execute_frame(frame)

            deviation_score: Optional[float] = None
            if self.deviation_threshold is not None and frame.after_screenshot_b64:
                live_png = await self._capture()
                if live_png:
                    deviation_score = screenshot_diff_score(frame.after_screenshot_b64, live_png)
                    if deviation_score is not None and deviation_score > self.deviation_threshold:
                        deviation = ReplayDeviation(
                            step=frame.step,
                            action_type=frame.action_type,
                            score=deviation_score,
                            threshold=self.deviation_threshold,
                            recorded_after_b64=frame.after_screenshot_b64,
                            live_after_b64=_bytes_to_b64(live_png),
                        )
                        deviations.append(deviation)
                        await self._emit({
                            "type": "replay.deviation",
                            "recording_id": manifest.recording_id,
                            "step": frame.step,
                            "score": round(deviation_score, 4),
                            "threshold": self.deviation_threshold,
                            "action_type": frame.action_type,
                        })
                        if self.approval_callback is None:
                            status = "deviated"
                            steps.append(ReplayStepResult(
                                step=frame.step, action_type=frame.action_type,
                                status=step_status, error=error, deviation_score=deviation_score,
                            ))
                            break
                        resume = await self._ask_approval(deviation)
                        if not resume:
                            status = "abandoned"
                            steps.append(ReplayStepResult(
                                step=frame.step, action_type=frame.action_type,
                                status=step_status, error=error, deviation_score=deviation_score,
                            ))
                            break
                        await self._emit({
                            "type": "replay.resumed",
                            "recording_id": manifest.recording_id,
                            "step": frame.step,
                        })

            steps.append(ReplayStepResult(
                step=frame.step, action_type=frame.action_type,
                status=step_status, error=error, deviation_score=deviation_score,
            ))
            await self._emit({
                "type": "replay.step",
                "recording_id": manifest.recording_id,
                "step": frame.step,
                "action_type": frame.action_type,
                "status": step_status,
                "deviation_score": round(deviation_score, 4) if deviation_score is not None else None,
            })

        result = ReplayResult(
            recording_id=manifest.recording_id,
            task=manifest.task,
            status=status,
            steps=steps,
            deviations=deviations,
            total_steps=len(frames),
        )
        await self._emit({
            "type": "replay.finished",
            "recording_id": manifest.recording_id,
            "status": status,
            "replayed_steps": len(steps),
            "deviations": len(deviations),
        })
        return result

    # ── internals ────────────────────────────────────────────────────────────

    async def _execute_frame(self, frame: RecordedFrame) -> tuple:
        """Execute one recorded action. Returns (status, error)."""
        if self.adapter is None:
            return "error", "no adapter available for replay"
        req = _make_request(frame.action_type, frame.action_target, dict(frame.action_params or {}))
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
            logger.warning("[replay] step %s failed: %s", frame.step, exc)
            return "error", str(exc)

    async def _capture(self) -> bytes:
        try:
            result = self._screenshot_capture(self.adapter, self.session_id)
            if asyncio.iscoroutine(result):
                result = await result
            return result or b""
        except Exception as exc:
            logger.warning("[replay] screenshot capture failed: %s", exc)
            return b""

    async def _ask_approval(self, deviation: ReplayDeviation) -> bool:
        try:
            decision = self.approval_callback(deviation)
            if asyncio.iscoroutine(decision):
                decision = await decision
            return bool(decision)
        except Exception as exc:
            logger.warning("[replay] approval callback failed, abandoning: %s", exc)
            return False

    async def _emit(self, event: Dict[str, Any]) -> None:
        if self.on_event is None:
            return
        try:
            result = self.on_event(event)
            if asyncio.iscoroutine(result):
                await result
        except Exception as exc:
            logger.warning("[replay] event callback failed: %s", exc)
