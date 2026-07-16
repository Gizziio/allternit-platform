"""Time-aligned MP4 replay from immutable canonical observations."""

from __future__ import annotations

import asyncio
import hashlib
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict


async def build_time_aligned_mp4(
    observations: tuple[Any, ...], *, artifact_dir: Path, output_path: Path,
) -> Dict[str, Any]:
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise RuntimeError("ffmpeg is unavailable; MP4 replay cannot be generated")
    managed = artifact_dir.resolve()
    frames = []
    for observation in observations:
        path_value = observation.metadata.get("artifact_path") if observation.image else None
        if not path_value:
            continue
        path = Path(path_value).resolve()
        if not path.is_relative_to(managed) or not path.is_file():
            continue
        frames.append((datetime.fromisoformat(observation.captured_at), path, observation.state_id))
    if not frames:
        raise ValueError("Session has no managed screenshot observations")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        concat = Path(temporary) / "frames.txt"
        lines = []
        timeline = []
        for index, (captured, path, state_id) in enumerate(frames):
            if index + 1 < len(frames):
                duration = max(0.05, min(10.0, (frames[index + 1][0] - captured).total_seconds()))
            else:
                duration = 1.0
            escaped = str(path).replace("'", "'\\''")
            lines.extend((f"file '{escaped}'", f"duration {duration:.6f}"))
            timeline.append({"state_id": state_id, "captured_at": captured.isoformat(), "duration_seconds": duration})
        escaped_last = str(frames[-1][1]).replace("'", "'\\''")
        lines.append(f"file '{escaped_last}'")
        concat.write_text("\n".join(lines) + "\n", encoding="utf-8")
        process = await asyncio.create_subprocess_exec(
            ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
            "-vf", "format=yuv420p", "-c:v", "libx264", "-movflags", "+faststart", str(output_path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {stderr.decode('utf-8', 'replace')[:1000]}")
    payload = output_path.read_bytes()
    return {
        "path": str(output_path), "media_type": "video/mp4", "frame_count": len(frames),
        "size_bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest(), "timeline": timeline,
    }
