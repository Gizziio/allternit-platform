"""
Allternit Computer Use — Action Recorder

Records all planning loop steps to JSONL for replay and fine-tuning.
Optionally co-runs a GIFRecorder to produce an animated session replay.
Inspired by OpenAdapt's trajectory recording approach.
"""

from __future__ import annotations

import asyncio
import json
import uuid
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from core.gif_recorder import GIFRecorder, is_available as _gif_available
except ImportError:
    try:
        from gif_recorder import GIFRecorder, is_available as _gif_available
    except ImportError:
        GIFRecorder = None  # type: ignore[assignment,misc]
        _gif_available = lambda: False  # type: ignore[assignment]

DEFAULT_RECORDINGS_DIR = Path.home() / ".allternit" / "recordings"


@dataclass
class RecordedFrame:
    """One captured step — written as a single JSONL line."""
    recording_id: str
    step: int
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    action_type: str = ""
    action_target: str = ""
    action_params: Dict[str, Any] = field(default_factory=dict)
    before_screenshot_b64: str = ""
    after_screenshot_b64: str = ""
    reasoning: str = ""
    reflection: str = ""
    action_succeeded: bool = True
    risk_level: str = "low"
    tokens_used: int = 0

    def to_dict(self) -> Dict:
        return {
            "recording_id": self.recording_id,
            "step": self.step,
            "timestamp": self.timestamp,
            "action_type": self.action_type,
            "action_target": self.action_target,
            "action_params": self.action_params,
            "before_screenshot_b64": self.before_screenshot_b64,
            "after_screenshot_b64": self.after_screenshot_b64,
            "reasoning": self.reasoning,
            "reflection": self.reflection,
            "action_succeeded": self.action_succeeded,
            "risk_level": self.risk_level,
            "tokens_used": self.tokens_used,
        }


@dataclass
class RecordingManifest:
    """Metadata written as the first line of a recording JSONL."""
    recording_id: str
    task: str
    session_id: str
    run_id: str
    vision_provider: str = ""
    adapter_id: str = ""
    started_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    total_steps: int = 0
    status: str = "recording"
    gif_path: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "_type": "manifest",
            "recording_id": self.recording_id,
            "task": self.task,
            "session_id": self.session_id,
            "run_id": self.run_id,
            "vision_provider": self.vision_provider,
            "adapter_id": self.adapter_id,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "total_steps": self.total_steps,
            "status": self.status,
            "gif_path": self.gif_path,
        }


class ActionRecorder:
    """
    Records planning loop steps to JSONL files.

    File format: one JSON object per line.
    Line 0: RecordingManifest (_type: "manifest")
    Lines 1+: RecordedFrame objects

    Usage:
        recorder = ActionRecorder(recording_id, task, session_id, run_id)
        await recorder.start()
        await recorder.record_frame(frame)
        await recorder.stop()
        path = recorder.get_path()
    """

    def __init__(
        self,
        recording_id: Optional[str] = None,
        task: str = "",
        session_id: str = "",
        run_id: str = "",
        output_dir: Optional[Path] = None,
        vision_provider: str = "",
        adapter_id: str = "",
        record_gif: bool = False,
        gif_fps: int = 2,
        gif_scale: float = 0.5,
        gif_annotate: bool = True,
    ):
        self.recording_id = recording_id or f"rec-{uuid.uuid4().hex[:12]}"
        self.output_dir = output_dir or DEFAULT_RECORDINGS_DIR
        self.manifest = RecordingManifest(
            recording_id=self.recording_id,
            task=task,
            session_id=session_id,
            run_id=run_id,
            vision_provider=vision_provider,
            adapter_id=adapter_id,
        )
        self._path = self.output_dir / f"{self.recording_id}.jsonl"
        self._file = None
        self._lock = asyncio.Lock()
        self._frame_count = 0

        # GIF recording
        self._gif_annotate = gif_annotate
        self._gif_recorder: Optional[Any] = None
        if record_gif and GIFRecorder is not None and _gif_available():
            self._gif_recorder = GIFRecorder(
                fps=gif_fps,
                scale=gif_scale,
                output_dir=str(self.output_dir),
            )

    def get_path(self) -> Path:
        return self._path

    def get_gif_path(self) -> Optional[Path]:
        """Return the GIF path if one was saved, else None."""
        if self.manifest.gif_path:
            return Path(self.manifest.gif_path)
        return None

    async def start(self) -> Path:
        """Open the recording file and write the manifest."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._file = open(self._path, "w", encoding="utf-8")
        await self._write_line(self.manifest.to_dict())
        if self._gif_recorder is not None:
            self._gif_recorder.start()
            logger.info("[Recorder] GIF recording started alongside JSONL")
        logger.info(f"[Recorder] Started recording {self.recording_id} at {self._path}")
        return self._path

    async def record_frame(self, frame: RecordedFrame) -> None:
        """Append one frame to the recording."""
        if self._file is None:
            await self.start()
        self._frame_count += 1
        await self._write_line(frame.to_dict())

    async def record_frame_from_step(self, step: Any) -> None:
        """Convenience: record from a LoopStep object."""
        frame = RecordedFrame(
            recording_id=self.recording_id,
            step=step.step,
            timestamp=step.timestamp,
            action_type=step.action_type,
            action_target=step.action_target,
            action_params=step.action_params,
            before_screenshot_b64=step.before_screenshot_b64,
            after_screenshot_b64=step.after_screenshot_b64,
            reasoning=step.reasoning,
            reflection=step.reflection,
            action_succeeded=step.action_succeeded,
            risk_level=step.risk_level,
            tokens_used=step.tokens_used,
        )
        await self.record_frame(frame)

        # Feed the after (or before) screenshot into the GIF recorder
        if self._gif_recorder is not None and self._gif_recorder.is_running():
            b64 = step.after_screenshot_b64 or step.before_screenshot_b64
            if b64:
                action_label = f"{step.action_type} on {step.action_target}"[:60]
                self._gif_recorder.add_frame_b64(b64, action_label=action_label, step=step.step)

    async def stop(self) -> Path:
        """Finalize the recording."""
        self.manifest.completed_at = datetime.now(timezone.utc).isoformat()
        self.manifest.total_steps = self._frame_count
        self.manifest.status = "completed"

        # Save GIF before closing JSONL so gif_path lands in the manifest
        if self._gif_recorder is not None and self._gif_recorder.is_running():
            self._gif_recorder.stop()
            gif_path = self._gif_recorder.save(
                run_id=self.manifest.run_id,
                annotate=self._gif_annotate,
            )
            if gif_path:
                self.manifest.gif_path = str(gif_path)
                logger.info("[Recorder] GIF saved: %s (%d frames)", gif_path, self._gif_recorder.frame_count)

        if self._file:
            self._file.close()
            self._file = None
        # Rewrite manifest as first line (rewrite entire file)
        try:
            lines = self._path.read_text(encoding="utf-8").splitlines()
            if lines:
                lines[0] = json.dumps(self.manifest.to_dict())
                self._path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        except Exception as e:
            logger.warning(f"[Recorder] Could not update manifest: {e}")
        logger.info(f"[Recorder] Stopped recording {self.recording_id}, {self._frame_count} frames")
        return self._path

    async def _write_line(self, data: Dict) -> None:
        async with self._lock:
            if self._file:
                self._file.write(json.dumps(data) + "\n")
                self._file.flush()

    @staticmethod
    def load(recording_path: Path) -> tuple[RecordingManifest, List[RecordedFrame]]:
        """Load a recording from disk."""
        lines = recording_path.read_text(encoding="utf-8").splitlines()
        if not lines:
            raise ValueError(f"Empty recording: {recording_path}")
        manifest_data = json.loads(lines[0])
        manifest = RecordingManifest(
            recording_id=manifest_data.get("recording_id", ""),
            task=manifest_data.get("task", ""),
            session_id=manifest_data.get("session_id", ""),
            run_id=manifest_data.get("run_id", ""),
            vision_provider=manifest_data.get("vision_provider", ""),
            adapter_id=manifest_data.get("adapter_id", ""),
            started_at=manifest_data.get("started_at", ""),
            completed_at=manifest_data.get("completed_at"),
            total_steps=manifest_data.get("total_steps", 0),
            status=manifest_data.get("status", "unknown"),
        )
        frames = []
        for line in lines[1:]:
            if not line.strip():
                continue
            d = json.loads(line)
            frames.append(RecordedFrame(
                recording_id=d.get("recording_id", ""),
                step=d.get("step", 0),
                timestamp=d.get("timestamp", ""),
                action_type=d.get("action_type", ""),
                action_target=d.get("action_target", ""),
                action_params=d.get("action_params", {}),
                before_screenshot_b64=d.get("before_screenshot_b64", ""),
                after_screenshot_b64=d.get("after_screenshot_b64", ""),
                reasoning=d.get("reasoning", ""),
                reflection=d.get("reflection", ""),
                action_succeeded=d.get("action_succeeded", True),
                risk_level=d.get("risk_level", "low"),
                tokens_used=d.get("tokens_used", 0),
            ))
        return manifest, frames

    @staticmethod
    async def replay(recording_path: Path, adapter: Any, session_id: str) -> Dict:
        """Replay a recording deterministically through an adapter."""
        manifest, frames = ActionRecorder.load(recording_path)
        results = []
        for frame in frames:
            try:
                req = type("ActionRequest", (), {
                    "action_type": frame.action_type,
                    "target": frame.action_target,
                    "parameters": frame.action_params,
                    "session_id": session_id,
                    "timeout_ms": 10000,
                    "retry_count": 0,
                    "action_id": str(uuid.uuid4()),
                })()
                result = await adapter.execute(req)
                results.append({"step": frame.step, "status": "ok"})
            except Exception as e:
                results.append({"step": frame.step, "status": "error", "error": str(e)})
        return {
            "recording_id": manifest.recording_id,
            "task": manifest.task,
            "replayed_steps": len(frames),
            "results": results,
        }


def list_recordings(output_dir: Optional[Path] = None) -> List[Dict]:
    """List all recordings in the recordings directory."""
    recordings_dir = output_dir or DEFAULT_RECORDINGS_DIR
    if not recordings_dir.exists():
        return []
    result = []
    for path in recordings_dir.glob("*.jsonl"):
        try:
            first_line = path.read_text(encoding="utf-8").splitlines()[0]
            manifest_data = json.loads(first_line)
            result.append({
                "recording_id": manifest_data.get("recording_id", path.stem),
                "task": manifest_data.get("task", ""),
                "status": manifest_data.get("status", "unknown"),
                "started_at": manifest_data.get("started_at", ""),
                "total_steps": manifest_data.get("total_steps", 0),
                "path": str(path),
            })
        except Exception:
            continue
    return sorted(result, key=lambda x: x.get("started_at", ""), reverse=True)
