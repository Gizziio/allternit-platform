"""
Allternit Computer Use Observability - Replay

Build replay artifacts from recorded frames:
- GIF for quick visual review
- WebM/MP4 for smooth playback  
- Contact sheet for debugging
- Step timeline visualization
"""

from .builder import ReplayBuilder, ReplayConfig, ReplayFormat, MultiFormatBuilder, TimelineJSONBuilder
from .gif_builder import GIFBuilder
from .video_builder import VideoBuilder

__all__ = [
    "ReplayBuilder",
    "ReplayConfig",
    "ReplayFormat",
    "MultiFormatBuilder",
    "TimelineJSONBuilder",
    "GIFBuilder",
    "VideoBuilder",
]
