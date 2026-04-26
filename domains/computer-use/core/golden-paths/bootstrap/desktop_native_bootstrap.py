"""
Golden Path: Desktop Native Bootstrap (macOS / Windows / Linux)

Registers the PyAutoGUI adapter (coordinate-based desktop control) with
the ComputerUseExecutor. This is the fallback for pure desktop automation
when no browser/CDP session exists.

Supports Claude's 9 native action types via coordinate dispatch:
  screenshot, left_click, right_click, middle_click, double_click,
  left_click_drag, type, key, scroll, cursor_position

Platform-specific notes:
  macOS   — requires Accessibility permission (System Settings → Privacy)
  Windows — works out of the box; UAC elevation needed for some apps
  Linux   — requires DISPLAY or Wayland compat; xdotool may be needed for key()

Usage:
    from golden_paths.bootstrap.desktop_native_bootstrap import bootstrap_desktop_native
    executor = await bootstrap_desktop_native()
"""

from __future__ import annotations

import asyncio
import logging
import os
import platform
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class DesktopNativeConfig:
    screenshot_backend: str = "auto"  # "auto" | "pyautogui" | "pillow" | "scrot"
    pause_between_actions: float = 0.05  # seconds — reduces flakiness on slow machines
    failsafe: bool = True  # pyautogui failsafe: move mouse to corner to abort


# ---------------------------------------------------------------------------
# Platform checks
# ---------------------------------------------------------------------------

def check_platform_requirements() -> list[str]:
    """Return list of warnings about missing platform requirements."""
    warnings = []
    sys_platform = platform.system().lower()

    if sys_platform == "darwin":
        # Check Accessibility permission by attempting a pyautogui call
        try:
            import pyautogui
            pyautogui.position()
        except Exception as exc:
            if "not allowed" in str(exc).lower() or "accessibility" in str(exc).lower():
                warnings.append(
                    "macOS Accessibility permission not granted. "
                    "Grant it in System Settings → Privacy & Security → Accessibility."
                )

    if sys_platform == "linux":
        display = os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")
        if not display:
            warnings.append(
                "No DISPLAY or WAYLAND_DISPLAY set. "
                "PyAutoGUI requires a running X11 or Wayland session."
            )

    return warnings


# ---------------------------------------------------------------------------
# PyAutoGUI BaseAdapter wrapper
# ---------------------------------------------------------------------------

class PyAutoGUIAdapter:
    """
    desktop.pyautogui adapter — wraps PyAutoGUI for Claude's 9 native actions.
    Registered as "desktop.pyautogui" in the ComputerUseExecutor.
    """

    @property
    def adapter_id(self) -> str:
        return "desktop.pyautogui"

    @property
    def family(self) -> str:
        return "desktop"

    async def initialize(self) -> None:
        try:
            import pyautogui
            import pyautogui as _pag
            _pag.FAILSAFE = True
            _pag.PAUSE = 0.05
        except ImportError:
            raise RuntimeError("pyautogui not installed — run: pip install pyautogui pillow")

    async def close(self) -> None:
        pass

    async def health_check(self) -> bool:
        try:
            import pyautogui
            pyautogui.position()
            return True
        except Exception:
            return False

    async def capabilities(self):
        try:
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
            from core.base_adapter import AdapterCapabilities
            return AdapterCapabilities(
                adapter_id=self.adapter_id,
                family=self.family,
                dom_tree=False,
                vision_required=True,
                multi_tab=False,
                auth_flows=True,
                platform=platform.system().lower(),
            )
        except ImportError:
            return None

    async def execute(self, action, session_id: str, run_id: str):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
        from core.base_adapter import ResultEnvelope
        import pyautogui
        import base64
        import io

        env = ResultEnvelope(
            run_id=run_id,
            session_id=session_id,
            adapter_id=self.adapter_id,
            family=self.family,
            mode="execute",
            action=action.action_type,
            target=action.target,
            status="running",
            started_at=datetime.now(timezone.utc).isoformat(),
        )

        try:
            result_data = await self._dispatch(action, pyautogui)
            env.status = "completed"
            env.extracted_content = result_data
            env.completed_at = datetime.now(timezone.utc).isoformat()
        except Exception as exc:
            logger.warning("[desktop-native] %s error: %s", action.action_type, exc)
            env.status = "failed"
            env.error = {"code": "PYAUTOGUI_ERROR", "message": str(exc)}
            env.completed_at = datetime.now(timezone.utc).isoformat()

        return env

    async def _dispatch(self, action, pag) -> dict:
        p = action.parameters
        at = action.action_type

        if at == "screenshot":
            import io, base64
            from PIL import ImageGrab
            img = pag.screenshot()
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()
            return {"data_url": f"data:image/png;base64,{b64}"}

        if at == "cursor_position":
            x, y = pag.position()
            return {"x": x, "y": y}

        if at == "left_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                pag.click(int(x), int(y))
            return {}

        if at == "right_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                pag.rightClick(int(x), int(y))
            return {}

        if at == "middle_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                pag.middleClick(int(x), int(y))
            return {}

        if at == "double_click":
            x, y = p.get("x"), p.get("y")
            if x is not None and y is not None:
                pag.doubleClick(int(x), int(y))
            return {}

        if at == "left_click_drag":
            sx, sy = int(p.get("startX", 0)), int(p.get("startY", 0))
            ex, ey = int(p.get("endX", 0)), int(p.get("endY", 0))
            pag.moveTo(sx, sy)
            pag.dragTo(ex, ey, duration=0.3, button="left")
            return {}

        if at == "type":
            text = p.get("text", action.target or "")
            pag.typewrite(text, interval=0.02)
            return {"chars_typed": len(text)}

        if at == "key":
            key = p.get("key", action.target or "")
            # Normalize: "ctrl+c" → ["ctrl", "c"]
            if "+" in key:
                keys = [k.strip().lower() for k in key.split("+")]
                pag.hotkey(*keys)
            else:
                pag.press(key.lower())
            return {"key": key}

        if at == "scroll":
            x = int(p.get("x", 0))
            y = int(p.get("y", 0))
            dy = int(p.get("deltaY", p.get("delta", 0)))
            clicks = -(dy // 100) or (-1 if dy > 0 else 1)
            pag.moveTo(x, y)
            pag.scroll(clicks)
            return {"deltaY": dy}

        raise ValueError(f"Unsupported desktop action: {at!r}")


# ---------------------------------------------------------------------------
# Bootstrap entry point
# ---------------------------------------------------------------------------

async def bootstrap_desktop_native(
    cfg: Optional[DesktopNativeConfig] = None,
    warn_on_missing_permissions: bool = True,
) -> "ComputerUseExecutor":
    """
    Check platform → Initialize PyAutoGUI → Register → Return ready executor.

    Steps:
      1. Check platform requirements (Accessibility, DISPLAY, etc.)
      2. Initialize PyAutoGUIAdapter
      3. Register with ComputerUseExecutor as "desktop.pyautogui"
      4. Return executor
    """
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
    from core.computer_use_executor import ComputerUseExecutor

    cfg = cfg or DesktopNativeConfig()

    if warn_on_missing_permissions:
        warnings = check_platform_requirements()
        for w in warnings:
            logger.warning("[desktop-native] %s", w)

    adapter = PyAutoGUIAdapter()
    await adapter.initialize()

    if not await adapter.health_check():
        raise RuntimeError(
            "PyAutoGUI health check failed. "
            "Check Accessibility permissions (macOS) or DISPLAY env var (Linux)."
        )

    executor = ComputerUseExecutor()
    executor.register("desktop.pyautogui", adapter)
    logger.info("[desktop-native] ready — PyAutoGUI registered as desktop.pyautogui on %s", platform.system())
    return executor


async def _smoke_test():
    executor = await bootstrap_desktop_native()
    from core.base_adapter import ActionRequest
    result = await executor.execute(
        ActionRequest(action_type="screenshot"),
        session_id="smoke",
        run_id="smoke-001",
    )
    print(f"status={result.status}  adapter={result.adapter_id}")
    assert result.status == "completed"
    pos = await executor.execute(
        ActionRequest(action_type="cursor_position"),
        session_id="smoke",
        run_id="smoke-002",
    )
    print(f"cursor={pos.extracted_content}")
    print("[desktop-native] smoke test passed")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_smoke_test())
