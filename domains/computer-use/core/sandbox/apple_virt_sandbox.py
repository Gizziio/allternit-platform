from __future__ import annotations

import asyncio
import json
import platform
import shutil
import time
import uuid
from pathlib import Path
from typing import Any

from .base import BaseSandbox, SandboxConfig, SandboxResult
from .process_sandbox import ProcessSandbox

# Detect at import time so tests can monkey-patch.
APPLE_VIRT_AVAILABLE: bool = (
    platform.system() == "Darwin" and shutil.which("swift") is not None
)

_HELPER_PATH = Path(__file__).parent / "swift_helper" / "virt_helper"


class AppleVirtSandbox(BaseSandbox):
    """
    Sandbox using Apple Virtualization.framework.

    Communicates with a compiled Swift helper via JSON stdio. If the helper
    binary is absent or unavailable, falls back transparently to ProcessSandbox.

    JSON protocol:
      stdin  → {"action": "start"|"run"|"stop", ...args}
      stdout ← {"status": "ok"|"error", ...fields}
    """

    def __init__(self, config: SandboxConfig) -> None:
        super().__init__(config)
        self._sandbox_id: str = ""
        self._fallback: ProcessSandbox | None = None
        self._helper_proc: asyncio.subprocess.Process | None = None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _use_fallback(self) -> bool:
        return self._fallback is not None

    async def _send(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Send a JSON request to the Swift helper and read one JSON response."""
        assert self._helper_proc is not None
        assert self._helper_proc.stdin is not None
        assert self._helper_proc.stdout is not None

        line = json.dumps(payload) + "\n"
        self._helper_proc.stdin.write(line.encode())
        await self._helper_proc.stdin.drain()

        raw = await self._helper_proc.stdout.readline()
        return json.loads(raw.decode().strip())

    async def _start_helper(self) -> None:
        self._helper_proc = await asyncio.create_subprocess_exec(
            str(_HELPER_PATH),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

    async def _stop_helper(self) -> None:
        if self._helper_proc is None:
            return
        try:
            await self._send({"action": "stop"})
        except Exception:  # noqa: BLE001
            pass
        try:
            self._helper_proc.terminate()
        except Exception:  # noqa: BLE001
            pass
        self._helper_proc = None

    # ------------------------------------------------------------------
    # BaseSandbox interface
    # ------------------------------------------------------------------

    async def start(self) -> str:
        if not APPLE_VIRT_AVAILABLE or not _HELPER_PATH.exists():
            self._fallback = ProcessSandbox(self.config)
            return await self._fallback.start()

        await self._start_helper()

        response = await self._send(
            {
                "action": "start",
                "memory_mb": self.config.memory_mb,
                "vcpus": self.config.vcpus,
            }
        )

        if response.get("status") != "running":
            # Helper reported an error — fall back gracefully.
            await self._stop_helper()
            self._fallback = ProcessSandbox(self.config)
            return await self._fallback.start()

        self._sandbox_id = response.get("sandbox_id", str(uuid.uuid4())[:8])
        return self._sandbox_id

    async def run(
        self,
        command: list[str],
        env: dict[str, str] | None = None,
    ) -> SandboxResult:
        if self._use_fallback():
            assert self._fallback is not None
            return await self._fallback.run(command, env)

        t0 = time.monotonic()
        try:
            response = await self._send(
                {
                    "action": "run",
                    "command": command,
                    "env": env or {},
                }
            )
        except Exception as exc:  # noqa: BLE001
            duration_ms = (time.monotonic() - t0) * 1000
            return SandboxResult(
                success=False,
                exit_code=-1,
                stdout="",
                stderr=str(exc),
                duration_ms=duration_ms,
                sandbox_id=self._sandbox_id,
            )

        duration_ms = (time.monotonic() - t0) * 1000
        exit_code = int(response.get("exit_code", -1))
        return SandboxResult(
            success=exit_code == 0,
            exit_code=exit_code,
            stdout=response.get("stdout", ""),
            stderr=response.get("stderr", ""),
            duration_ms=duration_ms,
            sandbox_id=self._sandbox_id,
        )

    async def stop(self) -> None:
        if self._use_fallback():
            assert self._fallback is not None
            await self._fallback.stop()
            return

        await self._stop_helper()
