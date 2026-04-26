"""
Golden Path: Electron App Bootstrap (cross-platform)

Launches or attaches to an Electron app via CDP.
Electron apps embed Chromium — launch them with ELECTRON_RUN_AS_NODE=0
and the standard --remote-debugging-port flag, then attach with
PlaywrightCDPAdapter.

Usage:
    from golden_paths.bootstrap.electron_app_bootstrap import bootstrap_electron_app
    executor = await bootstrap_electron_app("/path/to/MyApp.app")
"""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import socket
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class ElectronAppConfig:
    app_path: str = ""
    port: int = field(default_factory=lambda: int(os.environ.get("ACU_CDP_PORT", "9223")))
    headless: bool = False
    window_width: int = 1280
    window_height: int = 900
    extra_env: dict = field(default_factory=dict)
    extra_args: list = field(default_factory=list)
    startup_timeout: float = 30.0


# ---------------------------------------------------------------------------
# Platform-specific app resolution
# ---------------------------------------------------------------------------

def resolve_electron_executable(app_path: str) -> str:
    """Resolve executable inside a macOS .app bundle or return as-is."""
    sys_platform = platform.system().lower()
    if sys_platform == "darwin" and app_path.endswith(".app"):
        # macOS bundle: find the executable inside Contents/MacOS/
        contents = os.path.join(app_path, "Contents", "MacOS")
        if os.path.isdir(contents):
            executables = [
                f for f in os.listdir(contents)
                if os.access(os.path.join(contents, f), os.X_OK)
            ]
            if executables:
                return os.path.join(contents, executables[0])
    return app_path


def is_cdp_reachable(port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout):
            return True
    except OSError:
        return False


def wait_for_cdp(port: int, timeout: float = 30.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if is_cdp_reachable(port):
            return True
        time.sleep(0.5)
    return False


# ---------------------------------------------------------------------------
# Launch
# ---------------------------------------------------------------------------

def launch_electron_app(cfg: ElectronAppConfig) -> subprocess.Popen:
    """
    Launch an Electron app with remote debugging.

    The app must support standard Electron remote debugging flags.
    If the app_path points to a macOS .app bundle, the executable is resolved
    automatically.
    """
    if not cfg.app_path:
        raise ValueError("ElectronAppConfig.app_path must be set")
    if not os.path.exists(cfg.app_path):
        raise FileNotFoundError(f"Electron app not found: {cfg.app_path}")

    exe = resolve_electron_executable(cfg.app_path)

    env = os.environ.copy()
    env.update(cfg.extra_env)
    # Prevent Electron from hijacking the remote-debugging-port
    env.setdefault("ELECTRON_ENABLE_LOGGING", "0")

    args = [
        exe,
        f"--remote-debugging-port={cfg.port}",
        f"--window-size={cfg.window_width},{cfg.window_height}",
    ]
    args.extend(cfg.extra_args)

    sys_platform = platform.system().lower()
    kwargs: dict = {
        "env": env,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if sys_platform != "windows" and hasattr(os, "setsid"):
        kwargs["preexec_fn"] = os.setsid
    elif sys_platform == "windows":
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP

    logger.info("[electron-bootstrap] launching: %s --remote-debugging-port=%d", exe, cfg.port)
    return subprocess.Popen(args, **kwargs)


# ---------------------------------------------------------------------------
# Bootstrap entry point
# ---------------------------------------------------------------------------

async def bootstrap_electron_app(
    app_path: str = "",
    cfg: Optional[ElectronAppConfig] = None,
) -> "ComputerUseExecutor":
    """
    Detect → Launch → Connect → Register → Return ready executor.

    Steps:
      1. Check if CDP port already reachable (app already running)
      2. If not, launch Electron app with --remote-debugging-port
      3. Wait for CDP port (up to cfg.startup_timeout seconds)
      4. Connect PlaywrightCDPAdapter
      5. Register with ComputerUseExecutor and return it

    If app_path is empty, assumes a running instance on the configured port.
    """
    import sys, os as _os
    sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "../.."))
    from core.computer_use_executor import ComputerUseExecutor
    from adapters.browser.cdp_adapter import PlaywrightCDPAdapter

    cfg = cfg or ElectronAppConfig(app_path=app_path)
    if app_path and not cfg.app_path:
        cfg.app_path = app_path

    executor = ComputerUseExecutor()

    if not is_cdp_reachable(cfg.port):
        if not cfg.app_path:
            raise RuntimeError(
                f"CDP port {cfg.port} not reachable and no app_path provided. "
                "Either launch the Electron app manually or provide app_path."
            )
        launch_electron_app(cfg)
        logger.info("[electron-bootstrap] waiting for CDP port %d...", cfg.port)
        if not wait_for_cdp(cfg.port, timeout=cfg.startup_timeout):
            raise RuntimeError(
                f"Electron app did not open CDP port {cfg.port} within {cfg.startup_timeout}s"
            )
    else:
        logger.info("[electron-bootstrap] CDP port %d already reachable", cfg.port)

    adapter = PlaywrightCDPAdapter(port=cfg.port)
    await adapter.initialize()
    executor.register("browser.cdp", adapter)
    logger.info("[electron-bootstrap] ready — Electron app attached via browser.cdp")
    return executor


async def _smoke_test(app_path: str = ""):
    executor = await bootstrap_electron_app(app_path=app_path)
    from core.base_adapter import ActionRequest
    result = await executor.execute(
        ActionRequest(action_type="screenshot"),
        session_id="smoke-test",
        run_id="smoke-001",
    )
    print(f"status={result.status}  adapter={result.adapter_id}")
    assert result.status == "completed"
    print("[electron-bootstrap] smoke test passed")


if __name__ == "__main__":
    import sys as _sys
    logging.basicConfig(level=logging.INFO)
    _app = _sys.argv[1] if len(_sys.argv) > 1 else ""
    asyncio.run(_smoke_test(_app))
