"""Bounded parallel benchmark orchestration with isolated environment leases."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Iterable

from core.evaluation_authority import EvaluationAuthority


@dataclass(frozen=True)
class BenchmarkCase:
    case_id: str
    suite_id: str
    capability_cell: str
    payload: Dict[str, Any]


@dataclass(frozen=True)
class MeasuredCaseResult:
    passed: bool
    score: float
    evidence_sha256: str
    metadata: Dict[str, Any]


class ParallelBenchmarkRunner:
    def __init__(self, authority: EvaluationAuthority, *, maximum_concurrency: int = 4) -> None:
        if maximum_concurrency < 1:
            raise ValueError("Benchmark concurrency must be positive")
        self._authority = authority
        self._semaphore = asyncio.Semaphore(maximum_concurrency)

    async def run(
        self, *, provider_id: str, cases: Iterable[BenchmarkCase], repetitions: int,
        allocate_environment: Callable[[BenchmarkCase], Awaitable[str]],
        release_environment: Callable[[str], Awaitable[None]],
        execute_case: Callable[[BenchmarkCase, str], Awaitable[MeasuredCaseResult]],
    ) -> tuple[Dict[str, Any], ...]:
        if repetitions < 1:
            raise ValueError("Benchmark repetitions must be positive")

        async def one(case: BenchmarkCase, repetition: int) -> Dict[str, Any]:
            async with self._semaphore:
                environment_id = await allocate_environment(case)
                try:
                    measured = await execute_case(case, environment_id)
                    record = self._authority.record(
                        suite_id=case.suite_id, provider_id=provider_id,
                        capability_cell=case.capability_cell, environment_id=environment_id,
                        passed=measured.passed, score=measured.score,
                        evidence_sha256=measured.evidence_sha256, source="measured",
                        metadata={**measured.metadata, "case_id": case.case_id, "repetition": repetition},
                    )
                    return {"result_id": record.result_id, "case_id": case.case_id, "repetition": repetition}
                finally:
                    await release_environment(environment_id)

        tasks = [one(case, repetition) for case in cases for repetition in range(repetitions)]
        return tuple(await asyncio.gather(*tasks))
