"""
Video replay builder using ffmpeg

Creates WebM/MP4 videos from screenshot sequences.
Higher quality than GIF, better compression.
"""

import asyncio
import tempfile
from pathlib import Path
from typing import Optional

from .builder import ReplayBuilder, ReplayConfig, ReplayFormat


class VideoBuilder(ReplayBuilder):
    """Builds WebM/MP4 video from screenshot frames using ffmpeg."""
    
    def __init__(self, config: ReplayConfig):
        super().__init__(config)
        self._ffmpeg_available = self._check_ffmpeg()
    
    def _check_ffmpeg(self) -> bool:
        """Check if ffmpeg is available."""
        import shutil
        return shutil.which("ffmpeg") is not None
    
    def supported_formats(self) -> list[ReplayFormat]:
        return [ReplayFormat.WEBM, ReplayFormat.MP4]
    
    async def build(
        self,
        frame_paths: list[tuple[int, str]],  # (step_index, path)
        output_path: str,
        labels: Optional[list[str]] = None,
    ) -> str:
        """
        Build video from frames using ffmpeg.
        
        Args:
            frame_paths: Ordered list of (step_index, screenshot_path)
            output_path: Where to save the video (extension determines format)
            labels: Optional labels (not used in video, for interface compatibility)
        
        Returns:
            Path to generated video
        """
        if not self._ffmpeg_available:
            raise RuntimeError("ffmpeg is required for video building. Install: brew install ffmpeg")
        
        if not frame_paths:
            raise ValueError("No frames provided for video")
        
        output_path = Path(output_path)
        fmt = output_path.suffix.lower()
        
        # Determine format from extension
        if fmt == '.webm':
            codec = "libvpx-vp9"
            pix_fmt = "yuv420p"
        elif fmt == '.mp4':
            codec = "libx264"
            pix_fmt = "yuv420p"
        else:
            raise ValueError(f"Unsupported video format: {fmt}")
        
        # Create temporary directory for frame sequence
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            
            # Copy/rename frames to sequential numbers for ffmpeg
            frame_list = tmp_path / "frames.txt"
            with open(frame_list, "w") as f:
                for i, (step, src_path) in enumerate(frame_paths):
                    if not Path(src_path).exists():
                        continue
                    
                    # Create symlink or copy
                    dst_name = f"frame_{i:05d}.png"
                    dst_path = tmp_path / dst_name
                    
                    try:
                        dst_path.symlink_to(Path(src_path).resolve())
                    except OSError:
                        import shutil
                        shutil.copy2(src_path, dst_path)
                    
                    # Write concat demuxer entry with duration
                    duration = 1.0 / self.config.video_fps
                    f.write(f"file '{dst_name}'\n")
                    f.write(f"duration {duration}\n")
                
                # Last frame needs to be listed twice (ffmpeg quirk)
                if frame_paths:
                    f.write(f"file 'frame_{len(frame_paths)-1:05d}.png'\n")
            
            # Build ffmpeg command
            cmd = [
                "ffmpeg",
                "-y",  # Overwrite output
                "-f", "concat",
                "-safe", "0",
                "-i", str(frame_list),
                "-vf", f"fps={self.config.video_fps},format={pix_fmt}",
                "-c:v", codec,
                "-crf", str(self.config.video_crf),
                "-preset", self.config.video_quality,
                "-movflags", "+faststart",  # Web optimization for MP4
                str(output_path),
            ]
            
            # Run ffmpeg
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            
            stdout, stderr = await proc.communicate()
            
            if proc.returncode != 0:
                stderr_text = stderr.decode('utf-8', errors='ignore')
                raise RuntimeError(f"ffmpeg failed: {stderr_text[:500]}")
        
        return str(output_path)


class FrameSequenceBuilder:
    """
    Alternative video builder that creates frame sequence without ffmpeg dependency.
    Uses imageio-ffmpeg or similar if available.
    """
    
    def __init__(self, config: ReplayConfig):
        self.config = config
        self._imageio_available = self._check_imageio()
    
    def _check_imageio(self) -> bool:
        """Check if imageio is available."""
        try:
            import imageio
            import imageio_ffmpeg
            return True
        except ImportError:
            return False
    
    async def build(
        self,
        frame_paths: list[tuple[int, str]],
        output_path: str,
        labels: Optional[list[str]] = None,
    ) -> str:
        """Build video using imageio (Python-only, no ffmpeg CLI)."""
        if not self._imageio_available:
            raise RuntimeError("imageio and imageio-ffmpeg required. Install: pip install imageio imageio-ffmpeg")
        
        import imageio
        
        if not frame_paths:
            raise ValueError("No frames provided")
        
        output_path = Path(output_path)
        fmt = output_path.suffix.lower()
        
        # Determine codec
        if fmt == '.webm':
            codec = 'libvpx-vp9'
        elif fmt == '.mp4':
            codec = 'libx264'
        else:
            raise ValueError(f"Unsupported format: {fmt}")
        
        # Get frame dimensions from first image
        first_frame = imageio.imread(frame_paths[0][1])
        height, width = first_frame.shape[:2]
        
        # Create writer
        writer = imageio.get_writer(
            output_path,
            fps=self.config.video_fps,
            codec=codec,
            quality=self.config.video_crf,
        )
        
        # Write frames
        for i, (step, path) in enumerate(frame_paths):
            if not Path(path).exists():
                continue
            
            frame = imageio.imread(path)
            writer.append_data(frame)
        
        writer.close()
        
        return str(output_path)
