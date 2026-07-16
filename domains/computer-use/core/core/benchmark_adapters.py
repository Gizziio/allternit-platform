"""Optional external benchmark transports with validated measured output."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import shlex
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class BenchmarkAdapterStatus:
    suite_id: str
    available: bool
    command_source: str
    reason: Optional[str] = None


ENVIRONMENT_COMMANDS = {
    "cua-bench": "ALLTERNIT_CUA_BENCH_COMMAND",
    "osworld": "ALLTERNIT_OSWORLD_COMMAND",
    "screenspot": "ALLTERNIT_SCREENSPOT_COMMAND",
    "windows-arena": "ALLTERNIT_WINDOWS_ARENA_COMMAND",
    "allternit-safety": "ALLTERNIT_SAFETY_BENCH_COMMAND",
}


class ExternalBenchmarkAdapter:
    def __init__(self, suite_id: str) -> None:
        if suite_id not in ENVIRONMENT_COMMANDS:
            raise ValueError(f"Unknown benchmark suite {suite_id!r}")
        self.suite_id = suite_id

    def _argv(self) -> Optional[list[str]]:
        raw = os.environ.get(ENVIRONMENT_COMMANDS[self.suite_id], "").strip()
        return shlex.split(raw) if raw else None

    def status(self) -> BenchmarkAdapterStatus:
        argv = self._argv()
        return BenchmarkAdapterStatus(
            self.suite_id, bool(argv), ENVIRONMENT_COMMANDS[self.suite_id],
            None if argv else "explicit_runner_command_not_configured",
        )

    async def run(
        self, *, case_id: str, environment_id: str, output_dir: Path,
        timeout_seconds: int = 3600,
    ) -> Dict[str, Any]:
        argv = self._argv()
        if not argv:
            raise RuntimeError(f"No explicit runner is configured for {self.suite_id}")
        output_dir.mkdir(parents=True, exist_ok=True)
        output = output_dir / f"{self.suite_id}-{hashlib.sha256(case_id.encode()).hexdigest()[:16]}.json"
        inherited = {
            key: value for key, value in os.environ.items()
            if key in {"PATH", "LANG", "LC_ALL", "TMPDIR", "SYSTEMROOT", "WINDIR"}
        }
        process = await asyncio.create_subprocess_exec(
            *argv, "--case-id", case_id, "--environment-id", environment_id,
            "--output", str(output),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            env={
                **inherited, "ALLTERNIT_BENCHMARK_SUITE": self.suite_id,
                "ALLTERNIT_BENCHMARK_ENVIRONMENT_ID": environment_id,
            },
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise RuntimeError(f"Benchmark {self.suite_id} timed out")
        if process.returncode != 0:
            raise RuntimeError(
                f"Benchmark {self.suite_id} failed: {stderr.decode('utf-8', 'replace')[:2000]}"
            )
        if not output.is_file():
            raise RuntimeError("Benchmark runner did not produce its declared JSON evidence file")
        raw = output.read_bytes()
        result = json.loads(raw)
        if not isinstance(result, dict) or not isinstance(result.get("score"), (int, float)):
            raise RuntimeError("Benchmark evidence lacks a numeric score")
        score = float(result["score"])
        if not 0 <= score <= 1:
            raise RuntimeError("Benchmark score is outside [0, 1]")
        return {
            "passed": bool(result.get("passed", False)), "score": score,
            "evidence_sha256": hashlib.sha256(raw).hexdigest(),
            "evidence_path": str(output),
            "stdout": stdout.decode("utf-8", "replace")[:2000],
            "metadata": result.get("metadata", {}),
        }


def benchmark_adapter_statuses() -> list[Dict[str, Any]]:
    return [asdict(ExternalBenchmarkAdapter(suite).status()) for suite in ENVIRONMENT_COMMANDS]
