# Allternit Computer Use — Conformance Specification

**Version:** v0.1 Foundation
**Last updated:** 2026-03-14

---

## Purpose

Define the conformance testing framework that determines adapter production readiness.

## Grading Levels

| Grade | Pass Rate | Routing Status |
|-------|-----------|---------------|
| experimental | <50% | Not default-routable. Must be explicitly opted in. |
| beta | 50-89% | Default-routable with fallback chain required. |
| production | ≥90% | Default-routable. Can serve as primary adapter. |

---

## v0.1 — Implemented Suites (18 real test functions)

### Suite A — Browser Deterministic
**Applies to:** browser.playwright
**Tests:** 8 (all have real async test functions)

| ID | Category | Test | Status |
|----|----------|------|--------|
| A-01 | navigation | Navigate to URL, verify completed | Implemented |
| A-02 | extraction | Extract text, verify content | Implemented |
| A-03 | screenshot | Take screenshot, verify artifacts >1KB | Implemented |
| A-04 | eval | Evaluate JS, verify title returned | Implemented |
| A-05 | extraction | Extract HTML, verify structure | Implemented |
| A-06 | navigation | Navigate to second page | Implemented |
| A-07 | observe | Observe page state | Implemented |
| A-08 | envelope | G1 result envelope field verification | Implemented |

### Suite D — Desktop
**Applies to:** desktop.pyautogui
**Tests:** 4 (all have real async test functions)

| ID | Category | Test | Status |
|----|----------|------|--------|
| D-01 | screenshot | Desktop screenshot, verify artifacts | Implemented |
| D-02 | observe | Screen size + mouse position | Implemented |
| D-03 | envelope | G1 result envelope verification | Implemented |
| D-04 | receipt | G3 receipt emitted on action | Implemented |

### Suite F — Routing & Policy
**Applies to:** Router, PolicyEngine
**Tests:** 6 (all have real async test functions)

| ID | Category | Test | Status |
|----|----------|------|--------|
| F-01 | policy | Policy engine evaluates rules, returns structured decision | Implemented |
| F-02 | policy | Destructive action triggers approval gate | Implemented |
| F-03 | routing | Same inputs → same routing decision | Implemented |
| F-04 | routing | Unknown mode → RoutingError | Implemented |
| F-05 | policy | Policy decision has decision_id, rules_applied | Implemented |
| F-06 | routing | All 4 real adapters reachable through router | Implemented |

### Current Test Results

Suite F ran against mock adapter: **6/6 pass = production grade**

Suites A and D have test functions but have not yet been run through the ConformanceRunner against real adapters. They ARE tested individually in test_real_adapters.py (45/45 pass).

---

## v0.2 — Planned Suites

### Suite B — Browser Adaptive (planned)
**Applies to:** browser.browser-use
**Tests:** TBD — requires browser-use library installed

### Suite C — Retrieval (planned)
**Applies to:** retrieval adapter (not yet implemented)

### Suite E — Hybrid (planned)
**Applies to:** hybrid orchestrator (not yet implemented)

---

## Promotion Criteria

An adapter moves from experimental → beta when:
- ≥50% of declared suite tests pass
- No critical security tests fail (Suite F)

An adapter moves from beta → production when:
- ≥90% of declared suite tests pass
- All security tests pass
- No open blockers

## Running Conformance

```python
import sys
sys.path.insert(0, "packages/computer-use")

from conformance import ConformanceRunner
from conformance.suites import build_all_suites

runner = ConformanceRunner()
for suite in build_all_suites():
    runner.register_suite(suite)

# Run Suite F (routing/policy — no external deps needed)
result = await runner.run_suite("routing-policy-v1", any_adapter)
print(result.grade)  # "production"

# Run Suite A (browser — requires Playwright + Chromium)
from adapters.browser.playwright import PlaywrightAdapter
pw = PlaywrightAdapter()
result = await runner.run_suite("browser-deterministic-v1", pw)
print(result.grade)

print(runner.production_readiness_matrix())
```
