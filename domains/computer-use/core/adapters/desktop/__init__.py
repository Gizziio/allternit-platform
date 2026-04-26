"""Desktop automation adapters."""

from .pyautogui.pyautogui_adapter import (
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

try:
    from .operator.operator_adapter import OperatorAdapter, OperatorConnectionError
except ImportError:
    OperatorAdapter = None  # type: ignore
    OperatorConnectionError = None  # type: ignore

try:
    from .accessibility_adapter import AccessibilityAdapter
except ImportError:
    AccessibilityAdapter = None  # type: ignore

try:
    from .interpreter_adapter import InterpreterAdapter, InterpreterConfig
except ImportError:
    InterpreterAdapter = None  # type: ignore
    InterpreterConfig = None  # type: ignore

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
    "OperatorAdapter",
    "OperatorConnectionError",
    "AccessibilityAdapter",
    "InterpreterAdapter",
    "InterpreterConfig",
]
