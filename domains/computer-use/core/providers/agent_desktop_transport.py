"""Subprocess transport for the agent-desktop CLI."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional


class AgentDesktopUnavailableError(RuntimeError):
    pass


class AgentDesktopCallError(RuntimeError):
    def __init__(
        self,
        tool: str,
        message: str,
        *,
        exit_code: Optional[int] = None,
        code: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.tool = tool
        self.exit_code = exit_code
        self.code = code


def discover_agent_desktop(explicit_path: Optional[str] = None) -> Optional[str]:
    candidates = [
        explicit_path,
        os.environ.get("ALLTERNIT_AGENT_DESKTOP_PATH"),
        shutil.which("agent-desktop"),
        str(Path.home() / ".cargo" / "bin" / "agent-desktop"),
        str(Path.home() / ".local" / "bin" / "agent-desktop"),
        "/usr/local/bin/agent-desktop",
        "/opt/homebrew/bin/agent-desktop",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate).expanduser()
        if path.is_file() and os.access(path, os.X_OK):
            return str(path.resolve())
    return None


def _decode_json_output(stdout: bytes, command: str) -> Dict[str, Any]:
    text = stdout.decode("utf-8", errors="replace").strip()
    if not text:
        return {}
    try:
        value = json.loads(text)
    except json.JSONDecodeError as error:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        try:
            value = json.loads(lines[-1])
        except (IndexError, json.JSONDecodeError) as final_error:
            raise AgentDesktopCallError(
                command, f"agent-desktop returned non-JSON output: {error}"
            ) from final_error
    if not isinstance(value, dict):
        raise AgentDesktopCallError(command, "agent-desktop JSON response must be an object")
    return value


class AgentDesktopTransport:
    def __init__(self, executable: str, timeout_seconds: float = 30.0) -> None:
        path = Path(executable).expanduser()
        if not path.is_file() or not os.access(path, os.X_OK):
            raise AgentDesktopUnavailableError(f"agent-desktop executable is unavailable: {path}")
        self.executable = str(path.resolve())
        self.timeout_seconds = timeout_seconds

    @classmethod
    async def discover(
        cls,
        explicit_path: Optional[str] = None,
        timeout_seconds: float = 30.0,
    ) -> Optional["AgentDesktopTransport"]:
        executable = discover_agent_desktop(explicit_path)
        if executable is None:
            return None
        transport = cls(executable, timeout_seconds)
        await transport.version()
        return transport

    async def _run(
        self,
        *arguments: str,
        timeout_seconds: Optional[float] = None,
        env: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        merged_env = {**os.environ, "NO_COLOR": "1"}
        if env:
            merged_env.update(env)
        process = await asyncio.create_subprocess_exec(
            self.executable,
            *arguments,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=merged_env,
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout_seconds or self.timeout_seconds,
            )
        except asyncio.TimeoutError as error:
            process.kill()
            await process.communicate()
            raise AgentDesktopCallError(arguments[0], "agent-desktop command timed out") from error

        envelope = _decode_json_output(stdout, arguments[0])
        if process.returncode != 0 or not envelope.get("ok", True):
            error = envelope.get("error", {})
            message = error.get("message") or stderr.decode("utf-8", errors="replace").strip()
            raise AgentDesktopCallError(
                arguments[0],
                message or f"agent-desktop exited with {process.returncode}",
                exit_code=process.returncode,
                code=error.get("code"),
            )
        return envelope

    async def version(self) -> Dict[str, Any]:
        return await self._run("version")

    async def call(
        self,
        command: str,
        *arguments: str,
        session_id: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        env: Dict[str, str] = {}
        if session_id:
            env["AGENT_DESKTOP_SESSION"] = session_id
        return await self._run(
            command,
            *arguments,
            session_id=session_id,
            timeout_seconds=timeout_seconds,
            env=env,
        )
