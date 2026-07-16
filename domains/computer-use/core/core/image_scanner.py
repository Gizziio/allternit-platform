"""Optional local image scanner transport. Never downloads scanners or images."""

from __future__ import annotations

import asyncio
import json
import shutil
from dataclasses import dataclass
from typing import Any, Dict


@dataclass(frozen=True)
class ImageScanResult:
    status: str
    scanner: str
    summary: Dict[str, Any]


async def scan_image(source: str, *, timeout_seconds: int = 300) -> ImageScanResult:
    executable = shutil.which("trivy")
    if executable is None:
        return ImageScanResult("unavailable", "trivy", {"reason": "scanner_not_installed"})
    process = await asyncio.create_subprocess_exec(
        executable, "image", "--format", "json", "--quiet", source,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        return ImageScanResult("failed", "trivy", {"reason": "timeout"})
    if process.returncode != 0:
        return ImageScanResult("failed", "trivy", {
            "reason": "scanner_error", "returncode": process.returncode,
            "stderr": stderr.decode("utf-8", "replace")[:2000],
        })
    try:
        report = json.loads(stdout)
    except json.JSONDecodeError:
        return ImageScanResult("failed", "trivy", {"reason": "invalid_scanner_output"})
    severities: Dict[str, int] = {}
    for target in report.get("Results", []) if isinstance(report, dict) else []:
        for vulnerability in target.get("Vulnerabilities") or []:
            severity = str(vulnerability.get("Severity", "UNKNOWN")).upper()
            severities[severity] = severities.get(severity, 0) + 1
    blocking = severities.get("CRITICAL", 0) + severities.get("HIGH", 0)
    return ImageScanResult(
        "clean" if blocking == 0 else "failed", "trivy",
        {"severity_counts": severities, "blocking_high_or_critical": blocking},
    )
