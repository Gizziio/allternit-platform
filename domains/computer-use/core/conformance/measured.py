"""
Allternit Computer Use — Measured Conformance

Executes the real conformance suite cases against the adapters actually
available on this machine and writes adapter_grades.json with MEASURED
pass rates — replacing the manifest-declared grades that were assigned
without running anything.

What gets measured:
  * Suite A (browser-deterministic-v1) against browser.mock always, and
    against browser.cdp when a CDP endpoint is reachable (--network).
  * Suite F (routing-policy-v1) — adapter-free; always measured.
  * Suite D (desktop-v1) only with --desktop (env-dependent, pyautogui).

Honesty rules:
  * Grades are written under the adapter id that was actually executed.
    Mock results are labeled browser.mock and never upgrade a real
    adapter's grade.
  * Suites with no runnable implementation (B browser-adaptive,
    C retrieval, E hybrid) are written with grade/pass_rate null and
    measured=false — no invented numbers.

Run:  python -m conformance.measured [--network] [--desktop]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from conformance import ConformanceRunner, SuiteResult
from conformance.mock_browser_adapter import MockBrowserAdapter
from conformance.suites import build_suite_a, build_suite_d, build_suite_f

GRADES_PATH = Path(__file__).resolve().parent / "adapter_grades.json"

GRADING_SCALE = {
    "experimental": "< 50% pass rate",
    "beta": "50 - 89% pass rate",
    "production": ">= 90% pass rate",
}

# Suites with no runnable implementation stay honestly ungraded.
NOT_IMPLEMENTED: Dict[str, Dict[str, str]] = {
    "browser.browser-use": {
        "suite": "browser-adaptive-v1",
        "note": "Suite B (browser adaptive) not implemented — no measured grade available.",
    },
    "retrieval.playwright-crawler": {
        "suite": "retrieval-v1",
        "note": "Suite C (retrieval) not implemented — no measured grade available.",
    },
    "hybrid.orchestrator": {
        "suite": "hybrid-v1",
        "note": "Suite E (hybrid orchestrator) not implemented — no measured grade available.",
    },
}


async def discover_adapters(network: bool = False) -> Dict[str, Any]:
    """Adapters available right now: mock always; live browser adapters with network=True."""
    adapters: Dict[str, Any] = {"browser.mock": MockBrowserAdapter()}
    if network:
        # Headless Playwright — launches local Chromium, Suite A hits real sites.
        playwright_adapter = None
        try:
            from adapters.browser.playwright import PlaywrightAdapter

            candidate = PlaywrightAdapter()
            await candidate.initialize()
            if await candidate.health_check():
                playwright_adapter = candidate
            else:
                await candidate.close()
        except Exception:
            playwright_adapter = None
        if playwright_adapter is not None:
            adapters["browser.playwright"] = playwright_adapter
        # CDP against an already-running Chrome (ACU_CDP_PORT, default 9222).
        try:
            import os as _os
            import socket as _sock

            port = int(_os.environ.get("ACU_CDP_PORT", "9222"))
            with _sock.create_connection(("127.0.0.1", port), timeout=1.0):
                pass
            from adapters.browser.cdp_adapter import PlaywrightCDPAdapter

            cdp = PlaywrightCDPAdapter(port=port)
            if await cdp.health_check():
                adapters["browser.cdp"] = cdp
        except Exception:
            pass  # CDP unavailable — measured grades will reflect that
    return adapters


async def measure_adapters(
    adapters: Dict[str, Any],
    *,
    include_desktop: bool = False,
) -> Dict[str, List[SuiteResult]]:
    """Run suites against each adapter. Returns {adapter_id: [SuiteResult]}."""
    results: Dict[str, List[SuiteResult]] = {}
    runner = ConformanceRunner()

    suite_a = build_suite_a()
    suite_f = build_suite_f()
    runner.register_suite(suite_a)
    runner.register_suite(suite_f)
    if include_desktop:
        runner.register_suite(build_suite_d())

    for adapter_id, adapter in adapters.items():
        if adapter_id in ("desktop.pyautogui",):
            entry = [await runner.run_suite("desktop-v1", adapter)]
        else:
            entry = [await runner.run_suite("browser-deterministic-v1", adapter)]
        results[adapter_id] = entry

    # Suite F is adapter-free (policy/routing modules); run once under its
    # pseudo-adapter id.
    results["_routing_policy"] = [await runner.run_suite("routing-policy-v1", adapters["browser.mock"])]
    if include_desktop and "desktop.pyautogui" not in adapters:
        pass  # no desktop adapter available; Suite D stays unmeasured
    return results


def _suite_result_entry(result: SuiteResult, adapter_measured: str) -> Dict[str, Any]:
    return {
        "suite": result.suite_id,
        "tests_total": result.total,
        "tests_pass": result.passed,
        "tests_failed": result.failed + result.errors,
        "pass_rate": round(result.pass_rate, 1),
        "grade": result.grade if result.total > 0 else None,
        "measured": True,
        "measured_at": result.timestamp,
        "adapter_measured": adapter_measured,
        "note": f"Measured by executing {result.total} suite case(s) against {adapter_measured}.",
    }


def write_grades(
    results: Dict[str, List[SuiteResult]],
    path: Path = GRADES_PATH,
    *,
    cdp_available: bool = False,
) -> Dict[str, Any]:
    """Merge measured results into adapter_grades.json (real numbers only)."""
    now = datetime.now(timezone.utc).isoformat()
    document: Dict[str, Any] = {
        "_comment": (
            "Allternit Computer Use — Adapter Conformance Grades. "
            "pass_rate/grade values are MEASURED by conformance.measured "
            "executing suite cases; entries with measured=false have no "
            "runnable suite and are ungraded."
        ),
        "_last_updated": now,
        "_grading_scale": dict(GRADING_SCALE),
    }

    for adapter_id, suite_results in results.items():
        for result in suite_results:
            document[adapter_id] = _suite_result_entry(result, adapter_id)

    # Honest not-implemented entries — grade null, never invented.
    for adapter_id, info in NOT_IMPLEMENTED.items():
        document[adapter_id] = {
            "suite": info["suite"],
            "tests_total": None,
            "tests_pass": None,
            "pass_rate": None,
            "grade": None,
            "measured": False,
            "note": info["note"],
        }

    # browser.cdp: measured when available, honestly ungraded otherwise.
    if "browser.cdp" not in results:
        document["browser.cdp"] = {
            "suite": "browser-deterministic-v1",
            "tests_total": None,
            "tests_pass": None,
            "pass_rate": None,
            "grade": None,
            "measured": False,
            "note": (
                "CDP endpoint reachable at measurement time."
                if cdp_available
                else "CDP endpoint unavailable at measurement time — run: python -m conformance.measured --network"
            ),
        }

    # browser.playwright: measured when headless Chromium launched; otherwise
    # honestly ungraded.
    if "browser.playwright" not in results:
        document["browser.playwright"] = {
            "suite": "browser-deterministic-v1",
            "tests_total": 8,
            "tests_pass": None,
            "pass_rate": None,
            "grade": None,
            "measured": False,
            "note": "Headless Chromium unavailable at measurement time — run: python -m conformance.measured --network",
        }

    # Suite D stays ungraded unless --desktop measured it.
    if not any(r.suite_id == "desktop-v1" for rs in results.values() for r in rs):
        document["desktop.pyautogui"] = {
            "suite": "desktop-v1",
            "tests_total": 4,
            "tests_pass": None,
            "pass_rate": None,
            "grade": None,
            "measured": False,
            "note": "Suite D requires an interactive display. Run: python -m conformance.measured --desktop",
        }

    path.write_text(json.dumps(document, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    return document


async def run_measurement(
    *,
    network: bool = False,
    desktop: bool = False,
    grades_path: Path = GRADES_PATH,
) -> Dict[str, Any]:
    adapters = await discover_adapters(network=network)
    if desktop:
        try:
            from adapters.desktop.pyautogui.pyautogui_adapter import PyAutoGUIAdapter

            desktop_adapter = PyAutoGUIAdapter()
            if await desktop_adapter.health_check():
                adapters["desktop.pyautogui"] = desktop_adapter
        except Exception:
            pass
    results = await measure_adapters(adapters, include_desktop=desktop)
    return write_grades(results, grades_path, cdp_available="browser.cdp" in adapters)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Run measured conformance and rewrite adapter_grades.json")
    parser.add_argument("--network", action="store_true", help="also measure against a live CDP endpoint (Suite A hits real sites)")
    parser.add_argument("--desktop", action="store_true", help="also measure Suite D against pyautogui (needs a display)")
    parser.add_argument("--grades-path", type=Path, default=GRADES_PATH)
    args = parser.parse_args(argv)

    document = asyncio.run(run_measurement(
        network=args.network, desktop=args.desktop, grades_path=args.grades_path,
    ))
    for adapter_id, entry in document.items():
        if adapter_id.startswith("_"):
            continue
        if entry.get("measured"):
            print(f"{adapter_id:28s} {entry['grade'] or 'ungraded':12s} pass_rate={entry['pass_rate']}% ({entry['tests_pass']}/{entry['tests_total']})")
        else:
            print(f"{adapter_id:28s} unmeasured   {entry['note'][:70]}")
    print(f"\nWrote {args.grades_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
