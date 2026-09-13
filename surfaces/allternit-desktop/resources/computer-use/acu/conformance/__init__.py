"""
Allternit Computer Use — Conformance Harness
G4 conformance guarantee: An adapter is only production-grade
if it passes the conformance suite for its declared capability class.

Grading:
  - experimental: <50% pass rate
  - beta: 50-89% pass rate
  - production: ≥90% pass rate
"""

from typing import Dict, List, Optional, Any, Callable, Awaitable
from dataclasses import dataclass, field
from datetime import datetime
import uuid


@dataclass
class ConformanceTest:
    """A single conformance test case."""
    test_id: str
    suite_id: str
    name: str
    description: str
    category: str  # e.g. "login", "upload", "navigation", "extraction"
    test_fn: Optional[Callable] = None  # async test function
    expected: str = "pass"  # pass, skip

    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_id": self.test_id,
            "suite_id": self.suite_id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "expected": self.expected,
        }


@dataclass
class TestResult:
    """Result of a single conformance test."""
    test_id: str
    status: str  # "pass", "fail", "skip", "error"
    duration_ms: int = 0
    error: Optional[str] = None
    evidence: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "test_id": self.test_id,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "error": self.error,
            "evidence": self.evidence,
        }


@dataclass
class SuiteResult:
    """Result of running a full conformance suite against an adapter."""
    suite_id: str
    adapter_id: str
    total: int = 0
    passed: int = 0
    failed: int = 0
    skipped: int = 0
    errors: int = 0
    pass_rate: float = 0.0
    grade: str = "experimental"
    results: List[TestResult] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def compute_grade(self) -> str:
        """Compute conformance grade from pass rate."""
        if self.total == 0:
            self.grade = "experimental"
        else:
            self.pass_rate = (self.passed / self.total) * 100
            if self.pass_rate >= 90:
                self.grade = "production"
            elif self.pass_rate >= 50:
                self.grade = "beta"
            else:
                self.grade = "experimental"
        return self.grade

    def to_dict(self) -> Dict[str, Any]:
        return {
            "suite_id": self.suite_id,
            "adapter_id": self.adapter_id,
            "total": self.total,
            "passed": self.passed,
            "failed": self.failed,
            "skipped": self.skipped,
            "errors": self.errors,
            "pass_rate": round(self.pass_rate, 1),
            "grade": self.grade,
            "results": [r.to_dict() for r in self.results],
            "timestamp": self.timestamp,
        }


class ConformanceSuite:
    """
    A conformance suite is a collection of tests for a capability class.
    Suites:
      A — Browser deterministic
      B — Browser adaptive
      C — Retrieval
      D — Desktop
      E — Hybrid
      F — Routing/policy
    """

    def __init__(self, suite_id: str, name: str, description: str):
        self.suite_id = suite_id
        self.name = name
        self.description = description
        self._tests: List[ConformanceTest] = []

    def add_test(self, test: ConformanceTest) -> None:
        """Register a test case."""
        self._tests.append(test)

    def list_tests(self) -> List[ConformanceTest]:
        """List all registered tests."""
        return list(self._tests)

    async def run(self, adapter: Any) -> SuiteResult:
        """Run all tests against an adapter and produce a graded result."""
        import time

        result = SuiteResult(
            suite_id=self.suite_id,
            adapter_id=getattr(adapter, "adapter_id", "unknown"),
            total=len(self._tests),
        )

        for test in self._tests:
            start = time.monotonic()
            try:
                if test.test_fn:
                    await test.test_fn(adapter)
                    tr = TestResult(test_id=test.test_id, status="pass")
                    result.passed += 1
                else:
                    tr = TestResult(test_id=test.test_id, status="skip")
                    result.skipped += 1
            except AssertionError as e:
                tr = TestResult(test_id=test.test_id, status="fail", error=str(e))
                result.failed += 1
            except Exception as e:
                tr = TestResult(test_id=test.test_id, status="error", error=str(e))
                result.errors += 1

            tr.duration_ms = int((time.monotonic() - start) * 1000)
            result.results.append(tr)

        result.compute_grade()
        return result


class ConformanceRunner:
    """
    Manages and runs conformance suites.
    Produces a production readiness matrix.
    """

    def __init__(self):
        self._suites: Dict[str, ConformanceSuite] = {}
        self._results: Dict[str, SuiteResult] = {}

    def register_suite(self, suite: ConformanceSuite) -> None:
        """Register a conformance suite."""
        self._suites[suite.suite_id] = suite

    def get_suite(self, suite_id: str) -> Optional[ConformanceSuite]:
        """Get a registered suite."""
        return self._suites.get(suite_id)

    async def run_suite(self, suite_id: str, adapter: Any) -> SuiteResult:
        """Run a suite against an adapter."""
        suite = self._suites.get(suite_id)
        if not suite:
            raise ValueError(f"Suite {suite_id} not found")

        result = await suite.run(adapter)
        key = f"{suite_id}:{result.adapter_id}"
        self._results[key] = result
        return result

    def get_result(self, suite_id: str, adapter_id: str) -> Optional[SuiteResult]:
        """Get the most recent result for a suite+adapter combination."""
        return self._results.get(f"{suite_id}:{adapter_id}")

    def production_readiness_matrix(self) -> List[Dict[str, Any]]:
        """Generate production readiness matrix for all tested adapters."""
        matrix = []
        for key, result in self._results.items():
            matrix.append({
                "adapter_id": result.adapter_id,
                "suite_id": result.suite_id,
                "grade": result.grade,
                "pass_rate": result.pass_rate,
                "total_tests": result.total,
                "passed": result.passed,
                "failed": result.failed,
                "timestamp": result.timestamp,
            })
        return matrix
