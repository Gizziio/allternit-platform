"""
Frame storage backends - filesystem and memory.
"""

import os
import json
import shutil
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Optional

from .frame import ActionFrame, RunTimeline


class StorageBackend(ABC):
    """Abstract storage backend for frames."""
    
    @abstractmethod
    async def save_screenshot(self, run_id: str, frame_id: str, phase: str, data: bytes) -> str:
        """Save screenshot and return path/identifier."""
        pass
    
    @abstractmethod
    async def save_frame(self, frame: ActionFrame) -> None:
        """Save frame metadata."""
        pass
    
    @abstractmethod
    async def load_frame(self, frame_id: str) -> Optional[ActionFrame]:
        """Load frame by ID."""
        pass
    
    @abstractmethod
    async def save_timeline(self, timeline: RunTimeline) -> None:
        """Save complete timeline."""
        pass
    
    @abstractmethod
    async def load_timeline(self, run_id: str) -> Optional[RunTimeline]:
        """Load timeline by run ID."""
        pass
    
    @abstractmethod
    async def list_runs(self, limit: int = 100) -> list[str]:
        """List available run IDs."""
        pass


class FileSystemStorage(StorageBackend):
    """
    Filesystem storage for frames and screenshots.
    
    Structure:
        base_path/
            2026-03-14/
                run_abc123/
                    metadata.json
                    timeline.json
                    frames/
                        frame_001_before.png
                        frame_001_after.png
                        frame_002_before.png
                        ...
                    replays/
                        replay.gif
                        replay.webm
    """
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def _run_dir(self, run_id: str) -> Path:
        """Get directory for a run."""
        today = datetime.now().strftime("%Y-%m-%d")
        return self.base_path / today / run_id
    
    def _frame_path(self, run_id: str, frame_id: str, phase: str) -> Path:
        """Get path for a screenshot."""
        run_dir = self._run_dir(run_id)
        frames_dir = run_dir / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        return frames_dir / f"{frame_id}_{phase}.png"
    
    async def save_screenshot(self, run_id: str, frame_id: str, phase: str, data: bytes) -> str:
        """Save screenshot to filesystem."""
        path = self._frame_path(run_id, frame_id, phase)
        path.write_bytes(data)
        return str(path)
    
    async def save_frame(self, frame: ActionFrame) -> None:
        """Save frame metadata."""
        run_dir = self._run_dir(frame.run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        
        # Save individual frame
        frames_dir = run_dir / "frames"
        frames_dir.mkdir(exist_ok=True)
        
        frame_path = frames_dir / f"{frame.id}.json"
        frame_path.write_text(frame.model_dump_json(indent=2))
    
    async def load_frame(self, frame_id: str) -> Optional[ActionFrame]:
        """Load frame by ID (scans all runs)."""
        # Search through date directories
        for date_dir in self.base_path.iterdir():
            if not date_dir.is_dir():
                continue
            for run_dir in date_dir.iterdir():
                frame_path = run_dir / "frames" / f"{frame_id}.json"
                if frame_path.exists():
                    data = json.loads(frame_path.read_text())
                    return ActionFrame(**data)
        return None
    
    async def save_timeline(self, timeline: RunTimeline) -> None:
        """Save complete timeline."""
        run_dir = self._run_dir(timeline.run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        
        # Save timeline metadata
        timeline_path = run_dir / "timeline.json"
        timeline_path.write_text(timeline.model_dump_json(indent=2))
        
        # Save summary
        summary_path = run_dir / "summary.json"
        summary_path.write_text(json.dumps(timeline.to_summary(), indent=2))
    
    async def load_timeline(self, run_id: str) -> Optional[RunTimeline]:
        """Load timeline by run ID."""
        # Search through date directories
        for date_dir in self.base_path.iterdir():
            if not date_dir.is_dir():
                continue
            timeline_path = date_dir / run_id / "timeline.json"
            if timeline_path.exists():
                data = json.loads(timeline_path.read_text())
                return RunTimeline(**data)
        return None
    
    async def list_runs(self, limit: int = 100) -> list[str]:
        """List available run IDs."""
        runs = []
        for date_dir in sorted(self.base_path.iterdir(), reverse=True):
            if not date_dir.is_dir():
                continue
            for run_dir in date_dir.iterdir():
                if run_dir.is_dir():
                    runs.append(run_dir.name)
                    if len(runs) >= limit:
                        return runs
        return runs
    
    async def get_run_screenshots(self, run_id: str) -> list[tuple[str, str]]:
        """Get list of (frame_id, path) for all screenshots in run."""
        run_dir = self._run_dir(run_id)
        frames_dir = run_dir / "frames"
        
        if not frames_dir.exists():
            return []
        
        screenshots = []
        for f in sorted(frames_dir.iterdir()):
            if f.suffix == ".png":
                # Parse frame_id from filename (frame_uuid_before.png)
                frame_id = f.stem.rsplit("_", 1)[0]
                screenshots.append((frame_id, str(f)))
        
        return screenshots


class MemoryStorage(StorageBackend):
    """In-memory storage for testing."""
    
    def __init__(self):
        self.frames: dict[str, ActionFrame] = {}
        self.timelines: dict[str, RunTimeline] = {}
        self.screenshots: dict[str, bytes] = {}
    
    async def save_screenshot(self, run_id: str, frame_id: str, phase: str, data: bytes) -> str:
        key = f"{run_id}/{frame_id}/{phase}"
        self.screenshots[key] = data
        return f"memory://{key}"
    
    async def save_frame(self, frame: ActionFrame) -> None:
        self.frames[frame.id] = frame
    
    async def load_frame(self, frame_id: str) -> Optional[ActionFrame]:
        return self.frames.get(frame_id)
    
    async def save_timeline(self, timeline: RunTimeline) -> None:
        self.timelines[timeline.run_id] = timeline
    
    async def load_timeline(self, run_id: str) -> Optional[RunTimeline]:
        return self.timelines.get(run_id)
    
    async def list_runs(self, limit: int = 100) -> list[str]:
        return list(self.timelines.keys())[:limit]


# Convenience alias
FrameStorage = FileSystemStorage
