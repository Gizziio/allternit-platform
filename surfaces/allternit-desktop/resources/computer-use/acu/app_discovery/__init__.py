"""
Allternit App Discovery — Production-grade application detection for macOS/Windows/Linux

Provides robust detection of:
- Frontmost application (contextual awareness)
- Running applications (connector discovery)
- App metadata (bundle ID, window titles, process info)
- Screen capture for visual context

Used by:
- Thin Client: Shows "Add [App]" prompts
- Computer Use: Provides app context for automation
- Gateway: Routes actions to correct app
"""

from .detector import AppDiscovery, DiscoveredApp, AppContext
from .registry import AppRegistry

__all__ = [
    "AppDiscovery",
    "DiscoveredApp", 
    "AppContext",
    "AppRegistry",
]
