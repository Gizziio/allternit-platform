"""
Browser automation adapters for allternit-computer-use.

This package provides browser automation capabilities through:
- Playwright: Full browser automation (Chromium, Firefox, WebKit)
- CDP: Chrome DevTools Protocol for Chrome/Edge automation
"""

from .playwright_adapter import (
    PlaywrightAdapter,
    SyncPlaywrightAdapter,
    BrowserConfig,
    BrowserType,
    Viewport,
)

from .cdp_adapter import (
    CDPAdapter,
    CDPConfig,
    CDPError,
    CDPConnectionError,
    CDPCommandError,
    PlaywrightCDPAdapter,
)

try:
    from .dom_mcp_adapter import DomMcpAdapter
except ImportError:
    DomMcpAdapter = None  # type: ignore

try:
    from .skyvern_adapter import SkyvernAdapter
except ImportError:
    SkyvernAdapter = None  # type: ignore

from .setup import (
    setup_browsers,
    install_playwright_browsers,
    ensure_browser_available,
    detect_chrome_executable,
    get_playwright_browsers_status,
    is_playwright_installed,
)

__all__ = [
    # Playwright
    "PlaywrightAdapter",
    "SyncPlaywrightAdapter",
    "BrowserConfig",
    "BrowserType",
    "Viewport",
    
    # CDP
    "CDPAdapter",
    "CDPConfig",
    "CDPError",
    "CDPConnectionError",
    "CDPCommandError",
    "PlaywrightCDPAdapter",
    
    # Setup
    "setup_browsers",
    "install_playwright_browsers",
    "ensure_browser_available",
    "detect_chrome_executable",
    "get_playwright_browsers_status",
    "is_playwright_installed",

    # Optional adapters
    "DomMcpAdapter",
    "SkyvernAdapter",
]

__version__ = "0.1.0"
