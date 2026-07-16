"""Evidence-derived benchmark results and release gates."""

from __future__ import annotations

import json
import math
import sqlite3
import threading
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4


@dataclass(frozen=True)
class BenchmarkSuite:
    suite_id: str
    upstream: str
    task_domain: str
    required_os: tuple[str, ...]
    license_review: str


SUITES = (
    BenchmarkSuite("cua-bench", "trycua/cua", "mixed_computer_use", ("linux", "macos", "windows"), "required_per_dataset"),
    BenchmarkSuite("osworld", "xlang-ai/OSWorld", "desktop", ("linux",), "required"),
    BenchmarkSuite("screenspot", "OSU-NLP-Group/ScreenSpot", "grounding", ("linux", "macos", "windows", "android"), "required"),
    BenchmarkSuite("windows-arena", "microsoft/WindowsAgentArena", "desktop", ("windows",), "required"),
    BenchmarkSuite("allternit-safety", "allternit", "governance", ("linux", "macos", "windows"), "internal"),
)


@dataclass(frozen=True)
class EvaluationResult:
    result_id: str
    suite_id: str
    provider_id: str
    capability_cell: str
    environment_id: str
    passed: bool
    score: float
    evidence_sha256: str
    source: str
    occurred_at: str
    metadata: Dict[str, Any]


class EvaluationAuthority:
    def __init__(self, path: str | Path) -> None:
        self._connection = sqlite3.connect(str(path), check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._connection:
            self._connection.execute(
                """CREATE TABLE IF NOT EXISTS canonical_evaluations (
                    result_id TEXT PRIMARY KEY, suite_id TEXT NOT NULL,
                    provider_id TEXT NOT NULL, capability_cell TEXT NOT NULL,
                    occurred_at TEXT NOT NULL, payload TEXT NOT NULL
                )"""
            )

    def record(
        self, *, suite_id: str, provider_id: str, capability_cell: str,
        environment_id: str, passed: bool, score: float, evidence_sha256: str,
        source: str, metadata: Optional[Dict[str, Any]] = None,
    ) -> EvaluationResult:
        if suite_id not in {suite.suite_id for suite in SUITES}:
            raise ValueError(f"Unknown benchmark suite {suite_id!r}")
        if source != "measured":
            raise ValueError("Production evaluation records must be measured, not mock-derived")
        if not (0 <= score <= 1):
            raise ValueError("Evaluation score must be between zero and one")
        if len(evidence_sha256) != 64:
            raise ValueError("Evaluation evidence requires a SHA-256 digest")
        int(evidence_sha256, 16)
        result = EvaluationResult(
            f"evaluation_{uuid4().hex}", suite_id, provider_id, capability_cell,
            environment_id, passed, score, evidence_sha256, source,
            datetime.now(timezone.utc).isoformat(), metadata or {},
        )
        with self._lock, self._connection:
            self._connection.execute(
                "INSERT INTO canonical_evaluations VALUES (?, ?, ?, ?, ?, ?)",
                (result.result_id, suite_id, provider_id, capability_cell,
                 result.occurred_at, json.dumps(asdict(result), sort_keys=True)),
            )
        return result

    def calibration(self, provider_id: str, capability_cell: str) -> Dict[str, Any]:
        rows = self._connection.execute(
            "SELECT payload FROM canonical_evaluations WHERE provider_id = ? AND capability_cell = ?",
            (provider_id, capability_cell),
        ).fetchall()
        results = [EvaluationResult(**json.loads(row["payload"])) for row in rows]
        n = len(results)
        if not n:
            return {"sample_count": 0, "mean_score": None, "pass_rate": None, "wilson_95": None}
        mean = sum(item.score for item in results) / n
        successes = sum(1 for item in results if item.passed)
        p = successes / n
        z = 1.96
        denominator = 1 + z * z / n
        center = (p + z * z / (2 * n)) / denominator
        margin = z * math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / denominator
        return {
            "sample_count": n, "mean_score": mean, "pass_rate": p,
            "wilson_95": [max(0, center - margin), min(1, center + margin)],
        }

    def release_gate(
        self, provider_id: str, capability_cell: str, *, minimum_samples: int = 3,
        minimum_score: float = 0.8, minimum_wilson_lower: float = 0.5,
    ) -> Dict[str, Any]:
        calibration = self.calibration(provider_id, capability_cell)
        interval = calibration["wilson_95"]
        passed = bool(
            calibration["sample_count"] >= minimum_samples
            and calibration["mean_score"] is not None
            and calibration["mean_score"] >= minimum_score
            and interval is not None and interval[0] >= minimum_wilson_lower
        )
        return {
            "provider_id": provider_id, "capability_cell": capability_cell,
            "passed": passed, "calibration": calibration,
            "requirements": {
                "minimum_samples": minimum_samples, "minimum_score": minimum_score,
                "minimum_wilson_lower": minimum_wilson_lower, "measured_evidence_only": True,
            },
        }

    def close(self) -> None:
        self._connection.close()
