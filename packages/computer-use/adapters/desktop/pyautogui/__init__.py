"""
A2R Computer Use — PyAutoGUI Desktop Adapter

Full desktop control adapter supporting all primitives:
  move_mouse, click, double_click, right_click, drag, scroll,
  type_text, hotkey, launch_app, focus_window, list_windows,
  capture_screen, capture_region, clipboard_read, clipboard_write, observe
"""

import io
import base64
import platform
import subprocess
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

from core import BaseAdapter, ActionRequest, ResultEnvelope, Artifact


# ---------------------------------------------------------------------------
# Optional dependency shims
# ---------------------------------------------------------------------------

def _import_pyautogui():
    try:
        import pyautogui
        return pyautogui
    except ImportError:
        return None


def _import_pyperclip():
    try:
        import pyperclip
        return pyperclip
    except ImportError:
        return None


def _import_pygetwindow():
    try:
        import pygetwindow as gw
        return gw
    except ImportError:
        return None


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class PyAutoGUIAdapter(BaseAdapter):
    """
    Native desktop automation via pyautogui.

    All primitives dispatch through execute() via action.action_type.
    Gracefully degrades when optional dependencies (pyautogui, pyperclip,
    pygetwindow) are not installed — returns descriptive errors rather than
    raising at import time.
    """

    adapter_id = "desktop.pyautogui"
    family = "desktop"

    def __init__(self):
        self._pag = None       # pyautogui
        self._perclip = None   # pyperclip
        self._gw = None        # pygetwindow

    # ------------------------------------------------------------------
    # BaseAdapter contract
    # ------------------------------------------------------------------

    @property
    def adapter_id(self) -> str:  # type: ignore[override]
        return "desktop.pyautogui"

    @property
    def family(self) -> str:  # type: ignore[override]
        return "desktop"

    async def initialize(self) -> None:
        pag = _import_pyautogui()
        if pag is None:
            raise RuntimeError(
                "pyautogui not installed. Run: pip install pyautogui"
            )
        # Disable pyautogui's fail-safe pause to avoid slowdowns in automation
        pag.PAUSE = 0.05
        self._pag = pag
        self._perclip = _import_pyperclip()
        self._gw = _import_pygetwindow()

    async def execute(
        self, action: ActionRequest, session_id: str, run_id: str
    ) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id, mode="desktop")

        # Lazy-init on first call
        if self._pag is None:
            try:
                await self.initialize()
            except RuntimeError as exc:
                envelope.status = "failed"
                envelope.error = {
                    "code": "DEPENDENCY_MISSING",
                    "message": str(exc),
                    "adapter_id": self.adapter_id,
                }
                envelope.completed_at = datetime.utcnow().isoformat()
                return envelope

        try:
            at = action.action_type
            p = action.parameters

            if at == "move_mouse":
                result_data = self._move_mouse(p)
            elif at == "click":
                result_data = self._click(p)
            elif at == "double_click":
                result_data = self._double_click(p)
            elif at == "right_click":
                result_data = self._right_click(p)
            elif at == "drag":
                result_data = self._drag(p)
            elif at == "scroll":
                result_data = self._scroll(p)
            elif at == "type_text":
                result_data = self._type_text(p)
            elif at == "hotkey":
                result_data = self._hotkey(p)
            elif at == "launch_app":
                result_data = self._launch_app(p)
            elif at == "focus_window":
                result_data = self._focus_window(p)
            elif at == "list_windows":
                result_data = self._list_windows()
            elif at == "capture_screen":
                result_data = self._capture_screen(envelope, run_id)
            elif at == "capture_region":
                result_data = self._capture_region(envelope, run_id, p)
            elif at == "clipboard_read":
                result_data = self._clipboard_read()
            elif at == "clipboard_write":
                result_data = self._clipboard_write(p)
            elif at == "observe":
                result_data = self._observe()
            # Legacy action types kept for backward compatibility
            elif at == "screenshot":
                result_data = self._capture_screen(envelope, run_id)
            elif at == "act":
                result_data = self._legacy_act(p)
            else:
                result_data = {
                    "note": f"Unknown action '{at}' — no handler registered",
                    "supported_actions": [
                        "move_mouse", "click", "double_click", "right_click",
                        "drag", "scroll", "type_text", "hotkey", "launch_app",
                        "focus_window", "list_windows", "capture_screen",
                        "capture_region", "clipboard_read", "clipboard_write",
                        "observe",
                    ],
                }

            envelope.extracted_content = result_data
            envelope.status = "completed"
            envelope.completed_at = datetime.utcnow().isoformat()
            self._emit_receipt(envelope, action, result_data)

        except Exception as exc:
            envelope.status = "failed"
            envelope.error = {
                "code": "PYAUTOGUI_ERROR",
                "message": str(exc),
                "adapter_id": self.adapter_id,
            }
            envelope.completed_at = datetime.utcnow().isoformat()

        return envelope

    async def close(self) -> None:
        # pyautogui is stateless; nothing to tear down
        self._pag = None

    # ------------------------------------------------------------------
    # Action implementations
    # ------------------------------------------------------------------

    def _move_mouse(self, p: Dict[str, Any]) -> Dict[str, Any]:
        x = int(p.get("x", 0))
        y = int(p.get("y", 0))
        duration = float(p.get("duration", 0.2))
        self._pag.moveTo(x, y, duration=duration)
        return {"action": "move_mouse", "x": x, "y": y, "duration": duration}

    def _click(self, p: Dict[str, Any]) -> Dict[str, Any]:
        x = int(p.get("x", 0))
        y = int(p.get("y", 0))
        button = str(p.get("button", "left")).lower()
        if button not in ("left", "right", "middle"):
            button = "left"
        self._pag.click(x, y, button=button)
        return {"action": "click", "x": x, "y": y, "button": button}

    def _double_click(self, p: Dict[str, Any]) -> Dict[str, Any]:
        x = int(p.get("x", 0))
        y = int(p.get("y", 0))
        self._pag.doubleClick(x, y)
        return {"action": "double_click", "x": x, "y": y}

    def _right_click(self, p: Dict[str, Any]) -> Dict[str, Any]:
        x = int(p.get("x", 0))
        y = int(p.get("y", 0))
        self._pag.rightClick(x, y)
        return {"action": "right_click", "x": x, "y": y}

    def _drag(self, p: Dict[str, Any]) -> Dict[str, Any]:
        from_x = int(p.get("from_x", 0))
        from_y = int(p.get("from_y", 0))
        to_x = int(p.get("to_x", 0))
        to_y = int(p.get("to_y", 0))
        duration = float(p.get("duration", 0.5))
        self._pag.moveTo(from_x, from_y)
        self._pag.dragTo(to_x, to_y, duration=duration, button="left")
        return {
            "action": "drag",
            "from_x": from_x, "from_y": from_y,
            "to_x": to_x, "to_y": to_y,
            "duration": duration,
        }

    def _scroll(self, p: Dict[str, Any]) -> Dict[str, Any]:
        x = int(p.get("x", 0))
        y = int(p.get("y", 0))
        clicks = int(p.get("clicks", 3))  # positive = up, negative = down
        self._pag.moveTo(x, y)
        self._pag.scroll(clicks)
        return {"action": "scroll", "x": x, "y": y, "clicks": clicks}

    def _type_text(self, p: Dict[str, Any]) -> Dict[str, Any]:
        text = str(p.get("text", ""))
        interval = float(p.get("interval", 0.02))
        # typewrite only handles ASCII; use pyautogui.write for simple text and
        # hotkey(ctrl+v) paste approach for unicode
        try:
            self._pag.write(text, interval=interval)
        except Exception:
            # Fallback for unicode: copy to clipboard and paste
            if self._perclip:
                self._perclip.copy(text)
                self._pag.hotkey("ctrl", "v")
            else:
                # Last resort — typewrite with direct keyboard
                self._pag.typewrite(text, interval=interval)
        return {"action": "type_text", "text": text, "interval": interval}

    def _hotkey(self, p: Dict[str, Any]) -> Dict[str, Any]:
        # Accept keys as a list parameter OR as positional "keys" parameter
        keys = p.get("keys")
        if keys is None:
            # Legacy: flat list of key strings passed directly
            keys = [v for k, v in sorted(p.items()) if k.startswith("key")]
        if isinstance(keys, str):
            keys = [k.strip() for k in keys.split(",")]
        if not keys:
            raise ValueError("hotkey: 'keys' parameter required (e.g. ['ctrl', 'c'])")
        self._pag.hotkey(*keys)
        return {"action": "hotkey", "keys": keys}

    def _launch_app(self, p: Dict[str, Any]) -> Dict[str, Any]:
        app = str(p.get("app_name") or p.get("path") or "")
        if not app:
            raise ValueError("launch_app: 'app_name' or 'path' parameter required")
        os_name = platform.system()
        if os_name == "Darwin":
            proc = subprocess.Popen(["open", app])
        elif os_name == "Linux":
            proc = subprocess.Popen([app])
        else:
            # Windows
            proc = subprocess.Popen(["start", app], shell=True)
        return {
            "action": "launch_app",
            "app": app,
            "pid": proc.pid,
            "platform": os_name,
        }

    def _focus_window(self, p: Dict[str, Any]) -> Dict[str, Any]:
        title_pattern = str(p.get("title_pattern") or p.get("title") or "")
        if not title_pattern:
            raise ValueError("focus_window: 'title_pattern' parameter required")

        if self._gw is not None:
            import fnmatch
            windows = self._gw.getAllWindows()
            matches = [
                w for w in windows
                if fnmatch.fnmatch(w.title.lower(), title_pattern.lower())
                or title_pattern.lower() in w.title.lower()
            ]
            if matches:
                win = matches[0]
                win.activate()
                return {
                    "action": "focus_window",
                    "title_pattern": title_pattern,
                    "matched": win.title,
                    "status": "focused",
                }
            return {
                "action": "focus_window",
                "title_pattern": title_pattern,
                "status": "no_match",
                "note": "No window matched the pattern",
            }

        # macOS AppleScript fallback
        if platform.system() == "Darwin":
            script = f'tell application "{title_pattern}" to activate'
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                return {
                    "action": "focus_window",
                    "title_pattern": title_pattern,
                    "status": "focused_via_osascript",
                }
            return {
                "action": "focus_window",
                "title_pattern": title_pattern,
                "status": "error",
                "note": result.stderr.strip(),
            }

        return {
            "action": "focus_window",
            "title_pattern": title_pattern,
            "status": "unavailable",
            "note": "pygetwindow not installed and osascript unavailable on this platform",
        }

    def _list_windows(self) -> Dict[str, Any]:
        windows: List[Dict[str, Any]] = []

        if self._gw is not None:
            try:
                for win in self._gw.getAllWindows():
                    try:
                        bounds = {
                            "x": win.left, "y": win.top,
                            "width": win.width, "height": win.height,
                        }
                    except Exception:
                        bounds = {}
                    windows.append({
                        "title": win.title,
                        "bounds": bounds,
                        "pid": getattr(win, "_hWnd", None),
                    })
                return {"action": "list_windows", "windows": windows, "source": "pygetwindow"}
            except Exception as exc:
                pass  # fall through to platform-specific

        if platform.system() == "Darwin":
            script = """
tell application "System Events"
    set winList to {}
    repeat with proc in (every process whose background only is false)
        try
            set procName to name of proc
            set procPID to unix id of proc
            repeat with win in windows of proc
                try
                    set winTitle to name of win
                    set winPos to position of win
                    set winSz to size of win
                    set end of winList to (procName & "|" & procPID & "|" & ¬
                        (item 1 of winPos) & "," & (item 2 of winPos) & "," & ¬
                        (item 1 of winSz) & "," & (item 2 of winSz) & "|" & winTitle)
                end try
            end repeat
        end try
    end repeat
    return winList
end tell
"""
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0 and result.stdout.strip():
                raw = result.stdout.strip()
                # osascript returns comma-separated items for lists
                for entry in raw.split(", "):
                    entry = entry.strip()
                    if "|" not in entry:
                        continue
                    parts = entry.split("|")
                    if len(parts) < 4:
                        continue
                    try:
                        coords = [int(float(v)) for v in parts[2].split(",")]
                        bounds = {
                            "x": coords[0], "y": coords[1],
                            "width": coords[2], "height": coords[3],
                        } if len(coords) == 4 else {}
                    except Exception:
                        bounds = {}
                    windows.append({
                        "title": parts[3],
                        "bounds": bounds,
                        "pid": parts[1].strip(),
                        "app": parts[0].strip(),
                    })
            return {"action": "list_windows", "windows": windows, "source": "osascript"}

        # Linux: use xdotool if available
        if platform.system() == "Linux":
            try:
                ids_result = subprocess.run(
                    ["xdotool", "search", "--onlyvisible", "--name", ""],
                    capture_output=True, text=True, timeout=5
                )
                for wid in ids_result.stdout.strip().splitlines():
                    wid = wid.strip()
                    if not wid:
                        continue
                    name_result = subprocess.run(
                        ["xdotool", "getwindowname", wid],
                        capture_output=True, text=True
                    )
                    pid_result = subprocess.run(
                        ["xdotool", "getwindowpid", wid],
                        capture_output=True, text=True
                    )
                    windows.append({
                        "title": name_result.stdout.strip(),
                        "bounds": {},
                        "pid": pid_result.stdout.strip(),
                    })
                return {"action": "list_windows", "windows": windows, "source": "xdotool"}
            except (FileNotFoundError, subprocess.TimeoutExpired):
                pass

        return {
            "action": "list_windows",
            "windows": [],
            "note": "No window enumeration backend available (install pygetwindow or xdotool)",
        }

    def _screenshot_to_b64_and_bytes(self) -> tuple:
        """Returns (png_bytes, b64_string)."""
        screenshot = self._pag.screenshot()
        buf = io.BytesIO()
        screenshot.save(buf, format="PNG")
        img_bytes = buf.getvalue()
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        return img_bytes, b64

    def _capture_screen(self, envelope: ResultEnvelope, run_id: str) -> Dict[str, Any]:
        img_bytes, b64 = self._screenshot_to_b64_and_bytes()
        artifact = Artifact(
            type="screenshot",
            path=f"screenshots/{run_id}.png",
            size_bytes=len(img_bytes),
            media_type="image/png",
        )
        envelope.artifacts.append(artifact)
        return {
            "action": "capture_screen",
            "size_bytes": len(img_bytes),
            "screenshot_b64": b64,
            "artifact_id": artifact.artifact_id,
        }

    def _capture_region(
        self, envelope: ResultEnvelope, run_id: str, p: Dict[str, Any]
    ) -> Dict[str, Any]:
        x = int(p.get("x", 0))
        y = int(p.get("y", 0))
        width = int(p.get("width", 100))
        height = int(p.get("height", 100))
        screenshot = self._pag.screenshot(region=(x, y, width, height))
        buf = io.BytesIO()
        screenshot.save(buf, format="PNG")
        img_bytes = buf.getvalue()
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        artifact = Artifact(
            type="screenshot",
            path=f"screenshots/{run_id}_region_{x}_{y}.png",
            size_bytes=len(img_bytes),
            media_type="image/png",
        )
        envelope.artifacts.append(artifact)
        return {
            "action": "capture_region",
            "x": x, "y": y, "width": width, "height": height,
            "size_bytes": len(img_bytes),
            "screenshot_b64": b64,
            "artifact_id": artifact.artifact_id,
        }

    def _clipboard_read(self) -> Dict[str, Any]:
        if self._perclip is not None:
            try:
                text = self._perclip.paste()
                return {"action": "clipboard_read", "text": text}
            except Exception as exc:
                return {
                    "action": "clipboard_read",
                    "text": "",
                    "note": f"pyperclip error: {exc}",
                }
        # macOS fallback via pbpaste
        if platform.system() == "Darwin":
            result = subprocess.run(
                ["pbpaste"], capture_output=True, text=True
            )
            return {"action": "clipboard_read", "text": result.stdout, "source": "pbpaste"}
        # Linux fallback via xclip
        if platform.system() == "Linux":
            try:
                result = subprocess.run(
                    ["xclip", "-selection", "clipboard", "-o"],
                    capture_output=True, text=True
                )
                return {"action": "clipboard_read", "text": result.stdout, "source": "xclip"}
            except FileNotFoundError:
                pass
        return {
            "action": "clipboard_read",
            "text": "",
            "note": "pyperclip not installed and no platform fallback available",
        }

    def _clipboard_write(self, p: Dict[str, Any]) -> Dict[str, Any]:
        text = str(p.get("text", ""))
        if self._perclip is not None:
            try:
                self._perclip.copy(text)
                return {"action": "clipboard_write", "text": text, "status": "ok"}
            except Exception as exc:
                return {
                    "action": "clipboard_write",
                    "text": text,
                    "status": "error",
                    "note": f"pyperclip error: {exc}",
                }
        # macOS fallback via pbcopy
        if platform.system() == "Darwin":
            proc = subprocess.run(
                ["pbcopy"], input=text.encode("utf-8"), capture_output=True
            )
            return {
                "action": "clipboard_write",
                "text": text,
                "status": "ok" if proc.returncode == 0 else "error",
                "source": "pbcopy",
            }
        # Linux fallback via xclip
        if platform.system() == "Linux":
            try:
                proc = subprocess.run(
                    ["xclip", "-selection", "clipboard"],
                    input=text.encode("utf-8"), capture_output=True
                )
                return {
                    "action": "clipboard_write",
                    "text": text,
                    "status": "ok" if proc.returncode == 0 else "error",
                    "source": "xclip",
                }
            except FileNotFoundError:
                pass
        return {
            "action": "clipboard_write",
            "text": text,
            "status": "unavailable",
            "note": "pyperclip not installed and no platform clipboard backend available",
        }

    def _observe(self) -> Dict[str, Any]:
        size = self._pag.size()
        pos = self._pag.position()
        active_window: Optional[Dict[str, Any]] = None
        if self._gw is not None:
            try:
                aw = self._gw.getActiveWindow()
                if aw:
                    active_window = {
                        "title": aw.title,
                        "bounds": {
                            "x": aw.left, "y": aw.top,
                            "width": aw.width, "height": aw.height,
                        },
                    }
            except Exception:
                pass
        if active_window is None and platform.system() == "Darwin":
            try:
                script = (
                    'tell application "System Events" to get name of first application'
                    ' process whose frontmost is true'
                )
                result = subprocess.run(
                    ["osascript", "-e", script],
                    capture_output=True, text=True, timeout=3
                )
                if result.returncode == 0:
                    active_window = {"title": result.stdout.strip(), "bounds": {}}
            except Exception:
                pass
        return {
            "action": "observe",
            "screen_size": {"width": size.width, "height": size.height},
            "mouse_position": {"x": pos.x, "y": pos.y},
            "active_window": active_window,
        }

    # ------------------------------------------------------------------
    # Legacy compat
    # ------------------------------------------------------------------

    def _legacy_act(self, p: Dict[str, Any]) -> Dict[str, Any]:
        """Handle the old 'act' action type for backward compatibility."""
        coords = p.get("coordinates")
        text = p.get("text")
        if coords:
            x, y = int(coords.get("x", 0)), int(coords.get("y", 0))
            self._pag.click(x, y)
            return {"action": "click", "x": x, "y": y}
        if text:
            self._pag.write(str(text), interval=0.02)
            return {"action": "type_text", "text": text}
        return {"action": "act", "note": "No coordinates or text provided"}
