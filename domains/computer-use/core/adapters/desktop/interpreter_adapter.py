"""
Allternit Computer Use — Interpreter Adapter
Executes Python and JavaScript code in a subprocess with timeout.
"""

from __future__ import annotations

import asyncio
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
    # Sandboxed by default: code runs inside AllternitSandboxBackend's VM
    # (Apple Virtualization / Firecracker), not as a bare host subprocess.
    # Set False only as an explicit, intentional opt-out.
    sandbox: bool = True


class InterpreterAdapter(BaseAdapter):
    """Executes Python and JavaScript code in a subprocess."""

    ADAPTER_ID = "code.interpreter"
    FAMILY = "desktop"

    def __init__(self, config: Optional[InterpreterConfig] = None) -> None:
        self._config = config or InterpreterConfig()
        # session_id -> environment_id, so each session reuses one provisioned
        # sandbox instead of booting a fresh VM per run_code call.
        self._sandbox_environments: dict[str, str] = {}

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
        if not self._sandbox_environments:
            return
        from core.environment_backends import default_environment_backend_service

        service = default_environment_backend_service()
        for environment_id in self._sandbox_environments.values():
            try:
                await service.stop(environment_id)
            except Exception:
                pass
        self._sandbox_environments.clear()

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
            result = await self._run_code(
                code=action.parameters.get("code", ""),
                language=action.parameters.get("language", "python"),
                timeout=self._config.timeout,
                session_id=session_id,
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

    async def _run_code(self, code: str, language: str, timeout: int, session_id: str) -> dict[str, Any]:
        """Run code and return a normalised result dict.

        Sandboxed by default (self._config.sandbox): executes inside the
        AllternitSandboxBackend VM instead of a bare host subprocess. Falling back
        to a local subprocess only happens when sandboxing is explicitly disabled
        via InterpreterConfig(sandbox=False) -- an unavailable sandbox backend is a
        failure result, not a silent downgrade to unsandboxed execution.
        """
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

        if self._config.sandbox:
            return await self._run_code_sandboxed(cmd, timeout, session_id)
        return self._run_code_local(cmd, timeout)

    async def _run_code_sandboxed(self, cmd: list[str], timeout: int, session_id: str) -> dict[str, Any]:
        from core.environment_backends import default_environment_authority, default_environment_backend_service

        authority = default_environment_authority()
        service = default_environment_backend_service()
        try:
            environment_id = self._sandbox_environments.get(session_id)
            if environment_id is None:
                record = authority.create_environment(
                    owner_id=f"interpreter-adapter:{session_id}",
                    provider_id="allternit.local-sandbox",
                    os="linux",
                    isolation="vm",
                    image_digest=None,
                    ttl_seconds=None,
                    metadata={"network_policy": "denied", "readonly_root": True},
                )
                await service.provision(record.environment_id)
                environment_id = record.environment_id
                self._sandbox_environments[session_id] = environment_id

            result = await asyncio.wait_for(service.execute(environment_id, cmd, {}), timeout=timeout)
            return {
                "success": bool(result.get("success")),
                "output": result.get("stdout", ""),
                "error": result.get("stderr") or None,
                "exit_code": result.get("exit_code", -1),
            }
        except asyncio.TimeoutError:
            return {
                "success": False,
                "output": "",
                "error": f"Execution timed out after {timeout}s",
                "exit_code": -1,
            }
        except Exception as exc:  # noqa: BLE001
            return {
                "success": False,
                "output": "",
                "error": f"Sandboxed execution unavailable: {exc}",
                "exit_code": -1,
            }

    def _run_code_local(self, cmd: list[str], timeout: int) -> dict[str, Any]:
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
