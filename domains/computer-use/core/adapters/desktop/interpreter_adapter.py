"""
Allternit Computer Use — Interpreter Adapter
Executes Python and JavaScript code in a subprocess with timeout.
"""

from __future__ import annotations

import sys
import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

# Resolve core package from two levels up
_CORE_DIR = Path(__file__).parent.parent.parent / "core"
if str(_CORE_DIR) not in sys.path:
    sys.path.insert(0, str(_CORE_DIR))

from base_adapter import (  # noqa: E402
    BaseAdapter,
    ActionRequest,
    AdapterCapabilities,
    ResultEnvelope,
    Artifact,
)


@dataclass
class InterpreterConfig:
    timeout: int = 30
    sandbox: bool = False


class InterpreterAdapter(BaseAdapter):
    """Executes Python and JavaScript code in a subprocess."""

    ADAPTER_ID = "code.interpreter"
    FAMILY = "desktop"

    def __init__(self, config: Optional[InterpreterConfig] = None) -> None:
        self._config = config or InterpreterConfig()

    # ------------------------------------------------------------------
    # BaseAdapter interface
    # ------------------------------------------------------------------

    @property
    def adapter_id(self) -> str:
        return self.ADAPTER_ID

    @property
    def family(self) -> str:
        return self.FAMILY

    async def initialize(self) -> None:
        pass  # No persistent resources needed

    async def close(self) -> None:
        pass

    async def capabilities(self) -> AdapterCapabilities:
        return AdapterCapabilities(
            code_execution=True,
            file_access=not self._config.sandbox,
            network_isolation=self._config.sandbox,
            platform="any",
            adapter_id=self.ADAPTER_ID,
        )

    async def health_check(self) -> bool:
        try:
            result = subprocess.run(
                [sys.executable, "-c", "print('ok')"],
                capture_output=True,
                timeout=5,
                text=True,
            )
            return result.returncode == 0
        except Exception:
            return False

    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        envelope = self._make_envelope(action, session_id, run_id, mode="execute")

        if action.action_type == "run_code":
            result = self._run_code(
                code=action.parameters.get("code", ""),
                language=action.parameters.get("language", "python"),
                timeout=self._config.timeout,
            )
            envelope.extracted_content = result
            envelope.status = "completed" if result["success"] else "failed"
            if not result["success"]:
                envelope.error = {"message": result.get("error") or "", "exit_code": str(result["exit_code"])}

        elif action.action_type == "screenshot":
            screenshot = self._take_screenshot()
            if screenshot is not None:
                artifact = Artifact(
                    type="screenshot",
                    media_type="image/png",
                )
                artifact.path = screenshot if isinstance(screenshot, str) else ""
                envelope.artifacts.append(artifact)
                envelope.status = "completed"
            else:
                envelope.status = "completed"
                envelope.extracted_content = {"note": "screenshot unavailable (pyautogui/PIL not installed)"}

        else:
            envelope.status = "failed"
            envelope.error = {"message": f"Unsupported action_type: {action.action_type}"}

        envelope.completed_at = datetime.utcnow().isoformat()
        if envelope.started_at:
            start = datetime.fromisoformat(envelope.started_at)
            end = datetime.fromisoformat(envelope.completed_at)
            envelope.duration_ms = int((end - start).total_seconds() * 1000)

        self._emit_receipt(envelope, action, envelope.extracted_content or {})
        return envelope

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _run_code(self, code: str, language: str, timeout: int) -> dict[str, Any]:
        """Run code in a subprocess. Returns a normalised result dict."""
        if not code:
            return {"success": False, "output": "", "error": "No code provided", "exit_code": 1}

        if language in ("python", "py"):
            cmd = [sys.executable, "-c", code]
        elif language in ("javascript", "js", "node"):
            cmd = ["node", "-e", code]
        else:
            return {
                "success": False,
                "output": "",
                "error": f"Unsupported language: {language}",
                "exit_code": 1,
            }

        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                timeout=timeout,
                text=True,
            )
            return {
                "success": proc.returncode == 0,
                "output": proc.stdout,
                "error": proc.stderr if proc.stderr else None,
                "exit_code": proc.returncode,
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "output": "",
                "error": f"Execution timed out after {timeout}s",
                "exit_code": -1,
            }
        except FileNotFoundError as exc:
            return {
                "success": False,
                "output": "",
                "error": f"Interpreter not found: {exc}",
                "exit_code": -1,
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "success": False,
                "output": "",
                "error": str(exc),
                "exit_code": -1,
            }

    def _take_screenshot(self) -> Optional[str]:
        """Attempt a screenshot via pyautogui or PIL. Returns file path or None."""
        try:
            import pyautogui  # type: ignore
            import tempfile
            import os

            path = os.path.join(tempfile.gettempdir(), f"allternit_screenshot_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.png")
            pyautogui.screenshot(path)
            return path
        except ImportError:
            pass

        try:
            from PIL import ImageGrab  # type: ignore
            import tempfile
            import os

            path = os.path.join(tempfile.gettempdir(), f"allternit_screenshot_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.png")
            img = ImageGrab.grab()
            img.save(path)
            return path
        except ImportError:
            pass

        return None
