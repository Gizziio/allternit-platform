"""
Allternit Computer Use — AppAgent Mobile Adapter

Vision-guided mobile automation adapter inspired by AppAgent.
Supports Android (via ADB) and iOS (via idb from Facebook/Meta).
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional

from ...core.base_adapter import (
    ActionRequest,
    AdapterCapabilities,
    BaseAdapter,
    ResultEnvelope,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# EngineAction shim
# The mobile adapter's execute() accepts an EngineAction-style dict or object
# that carries: kind (str), input (dict), target (str | None).
# ---------------------------------------------------------------------------

@dataclass
class EngineAction:
    """Lightweight EngineAction compatible with the engine contract."""
    kind: str
    input: Dict[str, Any] = field(default_factory=dict)
    target: Optional[str] = None
    action_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

@dataclass
class AppAgentConfig:
    """Configuration for the AppAgent mobile adapter."""
    platform: str = "auto"          # "android" | "ios" | "auto"
    device_id: Optional[str] = None
    adb_path: str = "adb"
    idb_path: str = "idb"


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class AppAgentAdapter(BaseAdapter):
    """
    Mobile automation adapter for Android and iOS.

    - Android: communicates via ADB (Android Debug Bridge)
    - iOS: communicates via idb (Facebook/Meta iOS Debug Bridge)

    Capabilities: click, type, screenshot, scroll — target_scope=mobile.
    """

    def __init__(self, config: Optional[AppAgentConfig] = None) -> None:
        self._config = config or AppAgentConfig()
        self._resolved_platform: Optional[str] = None

    # ------------------------------------------------------------------
    # BaseAdapter properties
    # ------------------------------------------------------------------

    @property
    def adapter_id(self) -> str:
        return "mobile.appagent"

    @property
    def family(self) -> str:
        return "mobile"

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Resolve target platform (android/ios) when set to 'auto'."""
        if self._config.platform == "auto":
            self._resolved_platform = await self._detect_platform()
        else:
            self._resolved_platform = self._config.platform
        logger.info(
            "AppAgentAdapter initialized: platform=%s device=%s",
            self._resolved_platform,
            self._config.device_id or "default",
        )

    async def close(self) -> None:
        """No persistent connections to clean up."""
        logger.info("AppAgentAdapter closed")

    async def capabilities(self) -> AdapterCapabilities:
        return AdapterCapabilities(
            dom_tree=True,       # uiautomator dump / idb ui-hierarchy
            vision_required=False,
            code_execution=False,
            file_access=False,
            network_isolation=False,
            multi_tab=False,
            auth_flows=False,
            mobile=True,
            platform="any",
            adapter_id=self.adapter_id,
        )

    async def health_check(self) -> bool:
        try:
            if self._resolved_platform == "ios":
                result = await self._run(self._config.idb_path, "list-targets")
            else:
                result = await self._run(self._config.adb_path, "devices")
            return result.returncode == 0
        except Exception:
            return False

    # ------------------------------------------------------------------
    # BaseAdapter.execute (ActionRequest-based)
    # ------------------------------------------------------------------

    async def execute(
        self, action: ActionRequest, session_id: str, run_id: str
    ) -> ResultEnvelope:
        """Route an ActionRequest through the mobile adapter."""
        envelope = self._make_envelope(action, session_id, run_id, mode="execute")
        try:
            result_data: Dict[str, Any] = {}

            if action.action_type == "screenshot":
                raw = await self.screenshot()
                result_data = {"screenshot_bytes": len(raw), "mime": "image/png"}

            elif action.action_type in ("click", "tap"):
                x = int(action.parameters.get("x", 0))
                y = int(action.parameters.get("y", 0))
                ok = await self.click(x, y)
                result_data = {"success": ok}

            elif action.action_type == "type":
                text = str(action.parameters.get("text", ""))
                ok = await self.type(text)
                result_data = {"success": ok}

            elif action.action_type in ("scroll", "swipe"):
                x1 = int(action.parameters.get("x1", 0))
                y1 = int(action.parameters.get("y1", 0))
                x2 = int(action.parameters.get("x2", 0))
                y2 = int(action.parameters.get("y2", 0))
                dur = int(action.parameters.get("duration_ms", 300))
                ok = await self.swipe(x1, y1, x2, y2, dur)
                result_data = {"success": ok}

            elif action.action_type == "key":
                key = action.parameters.get("key", 0)
                ok = await self.key_event(key)
                result_data = {"success": ok}

            elif action.action_type == "navigate":
                app = str(action.parameters.get("app", action.target or ""))
                ok = await self.launch_app(app)
                result_data = {"success": ok}

            elif action.action_type == "ui_tree":
                tree = await self.get_ui_tree()
                result_data = {"ui_tree": tree}

            else:
                raise ValueError(f"Unsupported action_type: {action.action_type!r}")

            envelope.status = "completed"
            envelope.extracted_content = result_data
            envelope.completed_at = datetime.utcnow().isoformat()

        except Exception as exc:
            envelope.status = "failed"
            envelope.error = {"code": "mobile_error", "message": str(exc)}
            envelope.completed_at = datetime.utcnow().isoformat()

        self._emit_receipt(envelope, action, result_data={})
        return envelope

    # ------------------------------------------------------------------
    # EngineAction-style execute (for direct mobile usage)
    # ------------------------------------------------------------------

    async def execute_action(self, action: EngineAction) -> Dict[str, Any]:
        """
        Route an EngineAction (kind-based) through the mobile adapter.

        Supported kinds:
          screenshot, click, type, scroll, key, navigate
        """
        kind = action.kind

        if kind == "screenshot":
            raw = await self.screenshot()
            return {"screenshot": raw, "mime": "image/png", "size": len(raw)}

        elif kind == "click":
            x = int(action.input.get("x", 0))
            y = int(action.input.get("y", 0))
            ok = await self.click(x, y)
            return {"success": ok}

        elif kind == "type":
            text = str(action.input.get("text", ""))
            ok = await self.type(text)
            return {"success": ok}

        elif kind == "scroll":
            # Derive swipe coords from scroll direction/amount
            start_x = int(action.input.get("x", 500))
            start_y = int(action.input.get("y", 500))
            direction = str(action.input.get("direction", "down"))
            amount = int(action.input.get("amount", 300))
            end_x, end_y = self._scroll_to_swipe(start_x, start_y, direction, amount)
            dur = int(action.input.get("duration_ms", 300))
            ok = await self.swipe(start_x, start_y, end_x, end_y, dur)
            return {"success": ok}

        elif kind == "key":
            key = action.input.get("key", 0)
            ok = await self.key_event(key)
            return {"success": ok}

        elif kind == "navigate":
            app = str(action.input.get("app", action.target or ""))
            ok = await self.launch_app(app)
            return {"success": ok}

        else:
            raise ValueError(f"AppAgentAdapter: unsupported action kind {kind!r}")

    # ------------------------------------------------------------------
    # Core mobile operations
    # ------------------------------------------------------------------

    async def screenshot(self) -> bytes:
        """
        Capture device screenshot.

        Android: adb exec-out screencap -p
        iOS:     idb screenshot --output /tmp/... then read bytes
        """
        if self._resolved_platform == "ios":
            import tempfile, os
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp_path = tmp.name
            try:
                args = self._idb_args("screenshot", "--output", tmp_path)
                proc = await self._run(*args)
                if proc.returncode != 0:
                    raise RuntimeError(
                        f"idb screenshot failed: {proc.stderr.decode()}"
                    )
                with open(tmp_path, "rb") as f:
                    return f.read()
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        else:
            args = self._adb_args("exec-out", "screencap", "-p")
            proc = await self._run(*args)
            if proc.returncode != 0:
                raise RuntimeError(
                    f"adb screencap failed: {proc.stderr.decode()}"
                )
            return proc.stdout

    async def click(self, x: int, y: int) -> bool:
        """Tap at (x, y) on the device screen."""
        if self._resolved_platform == "ios":
            args = self._idb_args("ui", "tap", str(x), str(y))
        else:
            args = self._adb_args("shell", "input", "tap", str(x), str(y))
        proc = await self._run(*args)
        return proc.returncode == 0

    async def type(self, text: str) -> bool:
        """Type text on the device. Spaces must be escaped for ADB."""
        if self._resolved_platform == "ios":
            args = self._idb_args("ui", "text", text)
            proc = await self._run(*args)
        else:
            # ADB input text requires spaces escaped as %s
            escaped = text.replace(" ", "%s")
            args = self._adb_args("shell", "input", "text", escaped)
            proc = await self._run(*args)
        return proc.returncode == 0

    async def swipe(
        self,
        x1: int,
        y1: int,
        x2: int,
        y2: int,
        duration_ms: int = 300,
    ) -> bool:
        """Swipe from (x1, y1) to (x2, y2) over duration_ms milliseconds."""
        if self._resolved_platform == "ios":
            args = self._idb_args(
                "ui", "swipe",
                str(x1), str(y1), str(x2), str(y2),
                "--duration", str(duration_ms / 1000.0),
            )
        else:
            args = self._adb_args(
                "shell", "input", "swipe",
                str(x1), str(y1), str(x2), str(y2), str(duration_ms),
            )
        proc = await self._run(*args)
        return proc.returncode == 0

    async def key_event(self, keycode: Any) -> bool:
        """
        Send a key event.

        keycode can be an integer (KEYCODE_BACK=4) or a string name.
        iOS: uses idb ui key-send (limited key support).
        """
        if self._resolved_platform == "ios":
            args = self._idb_args("ui", "key-send", str(keycode))
        else:
            args = self._adb_args("shell", "input", "keyevent", str(keycode))
        proc = await self._run(*args)
        return proc.returncode == 0

    async def launch_app(self, package: str) -> bool:
        """
        Launch an app by package name (Android) or bundle ID (iOS).

        Android: adb shell am start -n <package>
        iOS:     idb launch <bundle_id>
        """
        if not package:
            raise ValueError("launch_app: package/bundle ID must not be empty")
        if self._resolved_platform == "ios":
            args = self._idb_args("launch", package)
        else:
            args = self._adb_args("shell", "am", "start", "-n", package)
        proc = await self._run(*args)
        return proc.returncode == 0

    async def get_ui_tree(self) -> Dict[str, Any]:
        """
        Dump the UI accessibility tree.

        Android: adb shell uiautomator dump —  produces /sdcard/window_dump.xml, then pull
        iOS:     idb ui hierarchy —  produces JSON
        """
        if self._resolved_platform == "ios":
            args = self._idb_args("ui", "hierarchy")
            proc = await self._run(*args)
            if proc.returncode != 0:
                raise RuntimeError(
                    f"idb ui hierarchy failed: {proc.stderr.decode()}"
                )
            raw = proc.stdout.decode("utf-8", errors="replace")
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return {"raw": raw}
        else:
            dump_path = "/sdcard/window_dump.xml"
            # Step 1: dump
            dump_args = self._adb_args(
                "shell", "uiautomator", "dump", dump_path
            )
            proc = await self._run(*dump_args)
            if proc.returncode != 0:
                raise RuntimeError(
                    f"uiautomator dump failed: {proc.stderr.decode()}"
                )
            # Step 2: pull content
            pull_args = self._adb_args("shell", "cat", dump_path)
            proc2 = await self._run(*pull_args)
            if proc2.returncode != 0:
                raise RuntimeError("Failed to read uiautomator dump")
            xml_content = proc2.stdout.decode("utf-8", errors="replace")
            return {"format": "uiautomator_xml", "content": xml_content}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _adb_args(self, *args: str):
        """Build ADB command args with optional device selector."""
        base = [self._config.adb_path]
        if self._config.device_id:
            base += ["-s", self._config.device_id]
        return base + list(args)

    def _idb_args(self, *args: str):
        """Build idb command args with optional UDID selector."""
        base = [self._config.idb_path]
        if self._config.device_id:
            base += ["--udid", self._config.device_id]
        return base + list(args)

    async def _run(self, *cmd: str) -> asyncio.subprocess.Process:
        """Run a subprocess and capture stdout/stderr."""
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.wait()
        return proc  # type: ignore[return-value]

    async def _detect_platform(self) -> str:
        """Auto-detect connected device platform (android preferred)."""
        try:
            proc = await self._run(self._config.adb_path, "devices")
            output = proc.stdout.decode("utf-8", errors="replace")
            # If any device line besides the header appears, use android
            lines = [
                ln.strip()
                for ln in output.splitlines()
                if ln.strip() and not ln.startswith("List of devices")
            ]
            if lines:
                logger.debug("Auto-detected android via ADB")
                return "android"
        except Exception:
            pass

        try:
            proc = await self._run(self._config.idb_path, "list-targets")
            output = proc.stdout.decode("utf-8", errors="replace")
            if output.strip():
                logger.debug("Auto-detected ios via idb")
                return "ios"
        except Exception:
            pass

        logger.warning("Platform auto-detection failed; defaulting to android")
        return "android"

    @staticmethod
    def _scroll_to_swipe(
        x: int, y: int, direction: str, amount: int
    ) -> tuple:
        """Convert scroll direction + amount to swipe endpoint coordinates."""
        direction = direction.lower()
        if direction == "down":
            return x, y - amount
        elif direction == "up":
            return x, y + amount
        elif direction == "right":
            return x - amount, y
        elif direction == "left":
            return x + amount, y
        return x, y - amount  # default: scroll down
