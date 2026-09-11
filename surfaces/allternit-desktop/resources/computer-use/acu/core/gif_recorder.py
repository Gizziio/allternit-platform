"""
Allternit Computer Use — GIF Recorder

Buffers screenshots during a session and renders them into an animated GIF.
Inspired by Anthropic's computer-use demo approach but extended with:
  - Frame annotation (step counter + elapsed time + action label)
  - Palette-optimized quantization (Pillow) for small file sizes
  - Configurable FPS, scale, and max-frame cap
  - Direct integration with ActionRecorder JSONL frames

Dependencies: Pillow, imageio
  pip install Pillow imageio
"""

from __future__ import annotations

import base64
import io
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

# Lazy imports — don't fail at module load if deps missing
_PIL_AVAILABLE = False
_IMAGEIO_AVAILABLE = False
_IMAGEIO_V3 = False

try:
    from PIL import Image, ImageDraw, ImageFont
    _PIL_AVAILABLE = True
except ImportError:
    pass

try:
    import imageio.v3 as imageio  # type: ignore[import]
    _IMAGEIO_AVAILABLE = True
    _IMAGEIO_V3 = True
except ImportError:
    try:
        import imageio  # type: ignore[import]
        _IMAGEIO_AVAILABLE = True
        _IMAGEIO_V3 = False
    except ImportError:
        pass


@dataclass
class GIFFrame:
    """One captured frame."""
    index: int
    timestamp_ms: float           # ms since recording start
    screenshot_b64: str           # base64-encoded PNG
    action_label: str = ""        # e.g. "click on Submit"
    step: int = 0


class GIFRecorder:
    """
    Buffers screenshots and renders an animated GIF.

    Usage:
        recorder = GIFRecorder(fps=2, scale=0.5, max_frames=600)
        recorder.start()

        # During automation:
        recorder.add_frame_b64(screenshot_b64, action_label="click Submit", step=3)

        # At the end:
        gif_bytes = recorder.render(annotate=True)
        recorder.save("/path/to/session.gif")
    """

    def __init__(
        self,
        fps: int = 2,
        scale: float = 0.5,
        max_frames: int = 600,
        output_dir: str = "/tmp/allternit-recordings",
    ):
        if fps < 1 or fps > 30:
            raise ValueError("fps must be between 1 and 30")
        if not 0.05 <= scale <= 1.0:
            raise ValueError("scale must be between 0.05 and 1.0")

        self.fps = fps
        self.scale = scale
        self.max_frames = max_frames
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self._frames: List[GIFFrame] = []
        self._start_ms: float = 0.0
        self._running: bool = False
        self._frame_duration_ms: int = int(1000 / fps)  # ms per GIF frame

    # ─────────────────────────────────────────────────────────────
    # Lifecycle
    # ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Begin a new recording session."""
        self._frames = []
        self._start_ms = time.time() * 1000
        self._running = True
        logger.info("GIFRecorder started (fps=%d, scale=%.1f, max_frames=%d)", self.fps, self.scale, self.max_frames)

    def stop(self) -> int:
        """Stop recording. Returns frame count."""
        self._running = False
        logger.info("GIFRecorder stopped — %d frames captured", len(self._frames))
        return len(self._frames)

    def is_running(self) -> bool:
        return self._running

    @property
    def frame_count(self) -> int:
        return len(self._frames)

    # ─────────────────────────────────────────────────────────────
    # Frame Capture
    # ─────────────────────────────────────────────────────────────

    def add_frame_bytes(self, png_bytes: bytes, action_label: str = "", step: int = 0) -> bool:
        """Add a raw PNG screenshot as a new frame."""
        if not self._running:
            return False
        if len(self._frames) >= self.max_frames:
            logger.debug("GIFRecorder: max_frames reached, dropping frame")
            return False
        b64 = base64.b64encode(png_bytes).decode()
        return self._add(b64, action_label, step)

    def add_frame_b64(self, screenshot_b64: str, action_label: str = "", step: int = 0) -> bool:
        """Add a base64-encoded PNG screenshot as a new frame."""
        if not self._running:
            return False
        if len(self._frames) >= self.max_frames:
            return False
        return self._add(screenshot_b64, action_label, step)

    def _add(self, b64: str, action_label: str, step: int) -> bool:
        elapsed = time.time() * 1000 - self._start_ms
        frame = GIFFrame(
            index=len(self._frames),
            timestamp_ms=elapsed,
            screenshot_b64=b64,
            action_label=action_label[:60],  # truncate long labels
            step=step,
        )
        self._frames.append(frame)
        return True

    # ─────────────────────────────────────────────────────────────
    # Rendering
    # ─────────────────────────────────────────────────────────────

    def render(self, annotate: bool = False) -> Optional[bytes]:
        """
        Render buffered frames into an animated GIF.

        Returns raw GIF bytes, or None if no frames / deps missing.
        """
        if not _PIL_AVAILABLE:
            logger.error("GIFRecorder.render(): Pillow not installed — pip install Pillow")
            return None
        if not _IMAGEIO_AVAILABLE:
            logger.error("GIFRecorder.render(): imageio not installed — pip install imageio")
            return None
        if not self._frames:
            logger.warning("GIFRecorder.render(): no frames to render")
            return None

        pil_frames: List[Image.Image] = []

        for frame in self._frames:
            try:
                img = _b64_to_pil(frame.screenshot_b64)
                img = _scale_image(img, self.scale)
                if annotate:
                    img = _annotate_frame(img, frame)
                # Convert to paletted (P mode) for GIF with optimized 256-color palette
                img = img.convert("RGB").quantize(colors=256, method=Image.Quantize.MEDIANCUT)
                pil_frames.append(img)
            except Exception as e:
                logger.warning("GIFRecorder: skipping frame %d due to error: %s", frame.index, e)
                continue

        if not pil_frames:
            return None

        buf = io.BytesIO()
        import numpy as np
        np_frames = [np.array(f.convert("RGB")) for f in pil_frames]

        if _IMAGEIO_V3:
            # imageio v3: duration in seconds, loop kwarg supported
            imageio.imwrite(
                buf,
                np_frames,
                format="gif",
                loop=0,
                duration=self._frame_duration_ms / 1000.0,
            )
        else:
            # imageio v2: duration in seconds per frame (same unit as v3 since v2.9+)
            # Use mimsave for multi-frame GIF
            imageio.mimsave(  # type: ignore[attr-defined]
                buf,
                np_frames,
                format="GIF",
                duration=self._frame_duration_ms / 1000.0,
                loop=0,
            )

        return buf.getvalue()

    def save(self, path: Optional[str] = None, run_id: str = "", annotate: bool = False) -> Optional[Path]:
        """
        Render and save the GIF to disk.

        Returns the saved Path, or None on failure.
        """
        gif_bytes = self.render(annotate=annotate)
        if gif_bytes is None:
            return None

        if path:
            out_path = Path(path)
        else:
            name = f"session-{run_id or 'unknown'}.gif"
            out_path = self.output_dir / name

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(gif_bytes)
        size_kb = len(gif_bytes) // 1024
        logger.info("GIF saved: %s (%d KB, %d frames)", out_path, size_kb, len(self._frames))
        return out_path

    # ─────────────────────────────────────────────────────────────
    # Integration: build from ActionRecorder JSONL frames
    # ─────────────────────────────────────────────────────────────

    @classmethod
    def from_jsonl_frames(
        cls,
        frames: list,  # list of ActionRecorder frame dicts
        fps: int = 2,
        scale: float = 0.5,
        annotate: bool = False,
    ) -> "GIFRecorder":
        """
        Build a GIFRecorder from stored JSONL frame dicts (no live session needed).
        Used by /cu:replay --export-gif.
        """
        recorder = cls(fps=fps, scale=scale)
        recorder._running = True  # allow add_frame_b64

        for f in frames:
            step = f.get("step", 0)
            action_type = f.get("action_type", "")
            action_target = f.get("action_target", "")
            label = f"{action_type} on {action_target}"[:60] if action_type else ""

            # Prefer after_screenshot for showing result of the action
            b64 = f.get("after_screenshot_b64") or f.get("before_screenshot_b64", "")
            if b64:
                recorder.add_frame_b64(b64, action_label=label, step=step)

        recorder._running = False
        return recorder

    # ─────────────────────────────────────────────────────────────
    # Stats
    # ─────────────────────────────────────────────────────────────

    def stats(self) -> dict:
        duration_ms = (self._frames[-1].timestamp_ms if self._frames else 0)
        return {
            "frame_count": len(self._frames),
            "duration_ms": int(duration_ms),
            "fps": self.fps,
            "scale": self.scale,
            "max_frames": self.max_frames,
            "running": self._running,
        }


# ─────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────

def _b64_to_pil(b64: str) -> "Image.Image":
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64)))


def _scale_image(img: "Image.Image", scale: float) -> "Image.Image":
    if scale == 1.0:
        return img
    w = max(1, int(img.width * scale))
    h = max(1, int(img.height * scale))
    return img.resize((w, h), Image.Resampling.LANCZOS)


def _annotate_frame(img: "Image.Image", frame: GIFFrame) -> "Image.Image":
    """Overlay step counter, elapsed time, and action label on the frame."""
    draw = ImageDraw.Draw(img.convert("RGBA"))

    # Use default bitmap font (no file dependency)
    try:
        font = ImageFont.load_default(size=12)
    except TypeError:
        font = ImageFont.load_default()

    # Elapsed time
    elapsed_s = int(frame.timestamp_ms / 1000)
    mm, ss = divmod(elapsed_s, 60)
    time_str = f"{mm:02d}:{ss:02d}"

    # Step label (top-left)
    step_str = f"Step {frame.step}"
    _draw_text_with_bg(draw, (4, 4), step_str, font)

    # Time (top-right)
    bbox = font.getbbox(time_str) if hasattr(font, "getbbox") else (0, 0, len(time_str) * 7, 14)
    text_w = bbox[2] - bbox[0]
    _draw_text_with_bg(draw, (img.width - text_w - 8, 4), time_str, font)

    # Action label (bottom-left)
    if frame.action_label:
        _draw_text_with_bg(draw, (4, img.height - 20), frame.action_label, font)

    return img.convert("RGB")


def _draw_text_with_bg(draw: "ImageDraw.Draw", xy: tuple, text: str, font) -> None:
    """Draw text with a semi-transparent black background for readability."""
    x, y = xy
    bbox = font.getbbox(text) if hasattr(font, "getbbox") else (0, 0, len(text) * 7, 14)
    w = bbox[2] - bbox[0] + 4
    h = bbox[3] - bbox[1] + 4
    draw.rectangle([x - 2, y - 2, x + w, y + h], fill=(0, 0, 0, 160))
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)


def is_available() -> bool:
    """Check if GIF recording dependencies are installed."""
    return _PIL_AVAILABLE and _IMAGEIO_AVAILABLE


def install_hint() -> str:
    missing = []
    if not _PIL_AVAILABLE:
        missing.append("Pillow")
    if not _IMAGEIO_AVAILABLE:
        missing.append("imageio")
    if missing:
        return f"pip install {' '.join(missing)}"
    return ""
