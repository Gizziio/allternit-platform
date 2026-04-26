"""Allternit Computer Use Adapters."""

ADAPTER_REGISTRY: dict[str, type] = {}

try:
    from .browser.playwright_adapter import PlaywrightAdapter
    ADAPTER_REGISTRY["browser.playwright"] = PlaywrightAdapter
except ImportError:
    pass

try:
    from .browser.dom_mcp_adapter import DomMcpAdapter
    ADAPTER_REGISTRY["browser.dom_mcp"] = DomMcpAdapter
except ImportError:
    pass

try:
    from .browser.skyvern_adapter import SkyvernAdapter
    ADAPTER_REGISTRY["browser.skyvern"] = SkyvernAdapter
except ImportError:
    pass

try:
    from .desktop.pyautogui.pyautogui_adapter import PyAutoGUIAdapter
    ADAPTER_REGISTRY["desktop.pyautogui"] = PyAutoGUIAdapter
except ImportError:
    pass

try:
    from .desktop.accessibility_adapter import AccessibilityAdapter
    ADAPTER_REGISTRY["desktop.accessibility"] = AccessibilityAdapter
except ImportError:
    pass

try:
    from .desktop.interpreter_adapter import InterpreterAdapter
    ADAPTER_REGISTRY["code.interpreter"] = InterpreterAdapter
except ImportError:
    pass

try:
    from .mobile.appagent_adapter import AppAgentAdapter
    ADAPTER_REGISTRY["mobile.appagent"] = AppAgentAdapter
except ImportError:
    pass

__all__ = ["ADAPTER_REGISTRY"]
