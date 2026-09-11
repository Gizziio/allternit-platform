from __future__ import annotations

import asyncio
import os
import platform
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import TYPE_CHECKING

from .base import BaseSandbox, SandboxConfig, SandboxResult

if TYPE_CHECKING:
    pass


def _make_preexec(memory_mb: int):
    """Return a preexec_fn that applies resource limits (Linux only)."""
    if platform.system() != "Linux":
        return None

    def _set_limits() -> None:
        try:
            import resource  # noqa: PLC0415

            limit_bytes = memory_mb * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (limit_bytes, limit_bytes))
        except Exception:
            # Best-effort — never crash the subprocess setup.
            pass

    return _set_limits


class ProcessSandbox(BaseSandbox):
    """
    Sandbox using subprocess isolation with resource limits.

    This is the universal fallback that works on any OS. It provides
    working-directory isolation and optional memory limits on Linux via
    RLIMIT_AS. macOS ignores the memory cap silently.
    """

    def __init__(self, config: SandboxConfig) -> None:
        super().__init__(config)
        self._sandbox_id: str = ""
        self._workdir: tempfile.TemporaryDirectory | None = None  # type: ignore[type-arg]
        self._workdir_path: Path = Path()

    async def start(self) -> str:
        self._sandbox_id = str(uuid.uuid4())
        self._workdir = tempfile.TemporaryDirectory(
            prefix=f"allternit-sandbox-{self._sandbox_id[:8]}-"
        )
        self._workdir_path = Path(self._workdir.name)
        return self._sandbox_id

    async def run(
        self,
        command: list[str],
        env: dict[str, str] | None = None,
    ) -> SandboxResult:
        if not self._sandbox_id:
            raise RuntimeError("Sandbox not started — call start() first.")

        merged_env = {**os.environ, **(env or {})}
        timeout_s = self.config.timeout_ms / 1000.0
        preexec_fn = _make_preexec(self.config.memory_mb)

        t0 = time.monotonic()
        try:
            proc = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(self._workdir_path),
                env=merged_env,
                **({} if preexec_fn is None else {"preexec_fn": preexec_fn}),
            )
            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout_s
                )
                exit_code = proc.returncode if proc.returncode is not None else -1
            except asyncio.TimeoutError:
                proc.kill()
                stdout_b, stderr_b = await proc.communicate()
                exit_code = -1
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
        return SandboxResult(
            success=exit_code == 0,
            exit_code=exit_code,
            stdout=stdout_b.decode(errors="replace"),
            stderr=stderr_b.decode(errors="replace"),
            duration_ms=duration_ms,
            sandbox_id=self._sandbox_id,
        )

    async def stop(self) -> None:
        if self._workdir is not None:
            try:
                self._workdir.cleanup()
            except Exception:  # noqa: BLE001
                pass
            self._workdir = None
