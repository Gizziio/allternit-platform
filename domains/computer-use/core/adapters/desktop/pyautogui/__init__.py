"""PyAutoGUI desktop automation adapter."""

from .pyautogui_adapter import (
    PyAutoGUIAdapter,
    Platform,
    Point,
    Size,
    ScreenshotResult,
    PermissionError,
    DesktopAutomationError,
    check_dependencies,
    check_permissions,
    get_platform,
    get_setup_instructions,
    setup,
)

__all__ = [
    "PyAutoGUIAdapter",
    "Platform",
    "Point",
    "Size",
    "ScreenshotResult",
    "PermissionError",
    "DesktopAutomationError",
    "check_dependencies",
    "check_permissions",
    "get_platform",
    "get_setup_instructions",
    "setup",
]
