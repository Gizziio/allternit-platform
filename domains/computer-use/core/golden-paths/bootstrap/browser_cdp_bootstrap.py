"""
Golden Path: Browser CDP Bootstrap (cross-platform)

Detects whether Chrome/Chromium is running with --remote-debugging-port,
launches it if not, connects via PlaywrightCDPAdapter, and returns a
ready executor registered with "browser.cdp".

Usage:
    from golden_paths.bootstrap.browser_cdp_bootstrap import bootstrap_browser_cdp
    executor = await bootstrap_browser_cdp()
    # executor.execute(action, session_id="...", run_id="...")
"""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import shutil
import socket
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class BrowserCDPConfig:
    port: int = field(default_factory=lambda: int(os.environ.get("ACU_CDP_PORT", "9222")))
    headless: bool = field(default_factory=lambda: os.environ.get("ACU_HEADLESS", "0") == "1")
    window_width: int = 1280
    window_height: int = 900
    user_data_dir: Optional[str] = None
    extra_args: list = field(default_factory=list)


# ---------------------------------------------------------------------------
# Chrome detection (cross-platform)
# ---------------------------------------------------------------------------

_CHROME_CANDIDATES = {
    "darwin": [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ],
    "linux": [
        "google-chrome",
        "google-chrome-stable",
        "chromium-browser",
        "chromium",
        "brave-browser",
    ],
    "windows": [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Chromium\Application\chrome.exe",
    ],
}


def find_chrome() -> Optional[str]:
    """Return path to Chrome/Chromium executable, or None."""
    sys_platform = platform.system().lower()
    candidates = _CHROME_CANDIDATES.get(sys_platform, [])

    for candidate in candidates:
        if os.path.isabs(candidate):
            if os.path.exists(candidate):
                return candidate
        else:
            found = shutil.which(candidate)
            if found:
                return found
    return None


def is_cdp_reachable(port: int, host: str = "127.0.0.1", timeout: float = 1.0) -> bool:
    """Return True if something is listening on the CDP port."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Launch
# ---------------------------------------------------------------------------

def launch_chrome(cfg: BrowserCDPConfig) -> subprocess.Popen:
    """Launch Chrome with remote debugging. Returns the process."""
    chrome = find_chrome()
    if not chrome:
        raise RuntimeError(
            "Chrome/Chromium not found. Install Chrome or set ACU_CDP_PORT to an already-running instance."
        )

    user_data = cfg.user_data_dir or tempfile.mkdtemp(prefix="acu_cdp_")

    args = [
        chrome,
        f"--remote-debugging-port={cfg.port}",
        f"--window-size={cfg.window_width},{cfg.window_height}",
        f"--user-data-dir={user_data}",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions-except=",
    ]
    if cfg.headless:
        args.append("--headless=new")

    args.extend(cfg.extra_args)

    sys_platform = platform.system().lower()
    kwargs: dict = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if sys_platform != "windows" and hasattr(os, "setsid"):
        kwargs["preexec_fn"] = os.setsid
    elif sys_platform == "windows":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    logger.info("[cdp-bootstrap] launching Chrome: %s", chrome)
    return subprocess.Popen(args, **kwargs)


def wait_for_cdp(port: int, timeout: float = 20.0) -> bool:
    """Poll until CDP port is reachable or timeout."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if is_cdp_reachable(port):
            return True
        time.sleep(0.5)
    return False


# ---------------------------------------------------------------------------
# Bootstrap entry point
# ---------------------------------------------------------------------------

async def bootstrap_browser_cdp(
    cfg: Optional[BrowserCDPConfig] = None,
) -> "ComputerUseExecutor":
    """
    Detect → Launch → Connect → Register → Return ready executor.

    Steps:
      1. Check if CDP port is already listening (browser already open)
      2. If not, launch Chrome with --remote-debugging-port
      3. Wait for port to be reachable (up to 20s)
      4. Connect PlaywrightCDPAdapter
      5. Register with ComputerUseExecutor and return it
    """
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
    from core.computer_use_executor import ComputerUseExecutor
    from adapters.browser.cdp_adapter import PlaywrightCDPAdapter

    cfg = cfg or BrowserCDPConfig()
    executor = ComputerUseExecutor()

    if not is_cdp_reachable(cfg.port):
        logger.info("[cdp-bootstrap] CDP port %d not reachable — launching Chrome", cfg.port)
        launch_chrome(cfg)
        if not wait_for_cdp(cfg.port):
            raise RuntimeError(f"Chrome did not open CDP port {cfg.port} within 20s")
    else:
        logger.info("[cdp-bootstrap] CDP port %d already reachable", cfg.port)

    adapter = PlaywrightCDPAdapter(port=cfg.port)
    await adapter.initialize()
    executor.register("browser.cdp", adapter)
    logger.info("[cdp-bootstrap] ready — adapter registered as browser.cdp")
    return executor


# ---------------------------------------------------------------------------
# CLI smoke test
# ---------------------------------------------------------------------------

async def _smoke_test():
    executor = await bootstrap_browser_cdp()
    from core.base_adapter import ActionRequest
    result = await executor.execute(
        ActionRequest(action_type="screenshot"),
        session_id="smoke-test",
        run_id="smoke-001",
    )
    print(f"status={result.status}  adapter={result.adapter_id}")
    assert result.status == "completed", f"Expected completed, got: {result.status}"
    print("[cdp-bootstrap] smoke test passed")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_smoke_test())
