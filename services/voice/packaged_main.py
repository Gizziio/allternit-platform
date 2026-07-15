"""Entry point used to freeze the production voice sidecar."""

import os
import shutil
from pathlib import Path
import uvicorn
import imageio_ffmpeg

from api.main import app


if __name__ == "__main__":
    # Whisper invokes `ffmpeg` as a subprocess. imageio-ffmpeg supplies a
    # platform-specific executable so packaged users do not need Homebrew.
    ffmpeg_executable = Path(imageio_ffmpeg.get_ffmpeg_exe())
    runtime_bin = Path(os.getenv("AUDIO_OUTPUT_DIR", "/tmp/voice-service")) / "bin"
    runtime_bin.mkdir(parents=True, exist_ok=True)
    ffmpeg_name = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    packaged_ffmpeg = runtime_bin / ffmpeg_name
    if not packaged_ffmpeg.exists() or packaged_ffmpeg.stat().st_size != ffmpeg_executable.stat().st_size:
        shutil.copy2(ffmpeg_executable, packaged_ffmpeg)
        packaged_ffmpeg.chmod(0o755)
    os.environ["PATH"] = f"{runtime_bin}{os.pathsep}{os.environ.get('PATH', '')}"
    os.environ.setdefault("IMAGEIO_FFMPEG_EXE", str(packaged_ffmpeg))
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=int(os.getenv("PORT", "8001")),
        log_level="info",
    )
