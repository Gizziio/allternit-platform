"""
Replay artifact builder - CU-032

Builds GIF, WebM, MP4, and other replay formats from recorded frames.
Runs asynchronously after session completion.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional, Callable
import asyncio
import logging

logger = logging.getLogger(__name__)


class ReplayFormat(str, Enum):
    """Available replay formats."""
    GIF = "gif"           # Lightweight, shareable
    WEBM = "webm"         # Good quality, small size
    MP4 = "mp4"           # Universal compatibility
    CONTACT_SHEET = "contact_sheet"  # Grid of screenshots
    TIMELINE_JSON = "timeline_json"  # Structured data


@dataclass
class ReplayConfig:
    """Configuration for replay generation."""
    
    # Output formats
    formats: list[ReplayFormat] = None
    
    # GIF settings
    gif_fps: int = 2  # Frames per second
    gif_quality: int = 80
    gif_loop: int = 0  # 0 = infinite loop
    gif_optimize: bool = True
    
    # Video settings
    video_fps: int = 10
    video_codec: str = "libvpx-vp9"  # For WebM
    video_quality: str = "good"  # ffmpeg preset
    video_crf: int = 23  # Quality (lower = better)
    
    # Contact sheet
    contact_sheet_cols: int = 4
    contact_sheet_width: int = 1200
    contact_sheet_label: bool = True
    
    # Processing
    max_dimension: int = 1920  # Resize if larger
    parallel_builds: bool = True
    cleanup_frames: bool = False  # Keep source frames
    
    def __post_init__(self):
        if self.formats is None:
            self.formats = [ReplayFormat.GIF, ReplayFormat.TIMELINE_JSON]


class ReplayBuilder(ABC):
    """Abstract base for replay builders."""
    
    def __init__(self, config: ReplayConfig):
        self.config = config
    
    @abstractmethod
    async def build(
        self,
        frame_paths: list[tuple[int, str]],  # (step_index, path)
        output_path: str,
        labels: Optional[list[str]] = None,
    ) -> str:
        """Build replay artifact and return path."""
        pass
    
    @abstractmethod
    def supported_formats(self) -> list[ReplayFormat]:
        """Return list of supported formats."""
        pass


class MultiFormatBuilder:
    """
    Builds multiple replay formats from a run's frames.
    
    Usage:
        builder = MultiFormatBuilder(ReplayConfig())
        artifacts = await builder.build_from_run(
            run_id="run_123",
            storage=frame_storage,
            output_dir="/tmp/replays"
        )
        # Returns: {"gif": "/path/to/run_123.gif", "webm": ...}
    """
    
    def __init__(self, config: Optional[ReplayConfig] = None):
        self.config = config or ReplayConfig()
        self._builders: dict[ReplayFormat, ReplayBuilder] = {}
        self._init_builders()
    
    def _init_builders(self):
        """Initialize format-specific builders."""
        # Import here to avoid dependency issues if optional libs not installed
        try:
            from .gif_builder import GIFBuilder
            self._builders[ReplayFormat.GIF] = GIFBuilder(self.config)
        except Exception as e:
            logger.warning(f"GIF builder not available: {e}")
        
        try:
            from .video_builder import VideoBuilder
            self._builders[ReplayFormat.WEBM] = VideoBuilder(self.config)
            self._builders[ReplayFormat.MP4] = VideoBuilder(self.config)
        except Exception as e:
            logger.warning(f"Video builder not available: {e}")
        
        # Contact sheet builder (PIL-based, usually available)
        try:
            from .contact_sheet_builder import ContactSheetBuilder
            self._builders[ReplayFormat.CONTACT_SHEET] = ContactSheetBuilder(self.config)
        except Exception:
            pass
    
    async def build_from_frames(
        self,
        frames: list[tuple[int, str, Optional[str]]],  # (step, screenshot_path, action_label)
        output_dir: str,
        run_id: str,
        progress_callback: Optional[Callable[[str, float], None]] = None,
    ) -> dict[str, str]:
        """
        Build all configured replay formats from frames.
        
        Args:
            frames: List of (step_index, screenshot_path, action_label)
            output_dir: Directory for output files
            run_id: Run identifier for filenames
            progress_callback: Called with (format, progress_0_to_1)
        
        Returns:
            Dict mapping format name to output path
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        artifacts = {}
        tasks = []
        
        for fmt in self.config.formats:
            if fmt in self._builders:
                builder = self._builders[fmt]
                task = self._build_format(
                    builder, fmt, frames, output_dir, run_id, progress_callback
                )
                tasks.append((fmt.value, task))
        
        # Build formats (parallel or sequential)
        if self.config.parallel_builds:
            results = await asyncio.gather(
                *[t[1] for t in tasks],
                return_exceptions=True
            )
            for (fmt, _), result in zip(tasks, results):
                if isinstance(result, Exception):
                    logger.error(f"Failed to build {fmt}: {result}")
                elif result:
                    artifacts[fmt] = result
        else:
            for fmt, task in tasks:
                try:
                    result = await task
                    if result:
                        artifacts[fmt] = result
                except Exception as e:
                    logger.error(f"Failed to build {fmt}: {e}")
        
        return artifacts
    
    async def _build_format(
        self,
        builder: ReplayBuilder,
        fmt: ReplayFormat,
        frames: list,
        output_dir: Path,
        run_id: str,
        progress_callback: Optional[Callable],
    ) -> Optional[str]:
        """Build a single format."""
        # Prepare frame paths and labels
        frame_paths = [(f[0], f[1]) for f in frames if f[1]]
        labels = [f[2] or f"Step {f[0]}" for f in frames if f[1]]
        
        if not frame_paths:
            logger.warning(f"No frames to build {fmt.value}")
            return None
        
        ext = fmt.value
        if fmt == ReplayFormat.CONTACT_SHEET:
            ext = "png"
        elif fmt == ReplayFormat.TIMELINE_JSON:
            ext = "json"
        
        output_path = str(output_dir / f"{run_id}.{ext}")
        
        try:
            result = await builder.build(frame_paths, output_path, labels)
            if progress_callback:
                progress_callback(fmt.value, 1.0)
            return result
        except Exception as e:
            logger.error(f"Error building {fmt.value}: {e}")
            if progress_callback:
                progress_callback(fmt.value, 0.0)
            raise


class TimelineJSONBuilder(ReplayBuilder):
    """Builds timeline JSON for structured replay."""
    
    def supported_formats(self) -> list[ReplayFormat]:
        return [ReplayFormat.TIMELINE_JSON]
    
    async def build(
        self,
        frame_paths: list[tuple[int, str]],
        output_path: str,
        labels: Optional[list[str]] = None,
    ) -> str:
        """Build timeline JSON."""
        import json
        
        timeline = {
            "format": "timeline_v1",
            "total_frames": len(frame_paths),
            "fps": self.config.gif_fps,
            "frames": [
                {
                    "step": step,
                    "screenshot": path,
                    "label": labels[i] if labels and i < len(labels) else f"Step {step}",
                }
                for i, (step, path) in enumerate(frame_paths)
            ]
        }
        
        with open(output_path, "w") as f:
            json.dump(timeline, f, indent=2)
        
        return output_path
