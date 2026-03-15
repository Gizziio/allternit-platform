# A2R Computer Use — Requirements

**Version:** v0.1 Foundation
**Last updated:** 2026-03-14

---

## v0.1 Functional Requirements (Implemented)

### FR-01: Unified Result Envelope
All adapters return results conforming to the ResultEnvelope dataclass with: run_id, session_id, adapter_id, family, mode, action, target, status, extracted_content, artifacts, receipts, policy_decisions, trace_id, fallbacks_used, started_at, completed_at.
**Status:** Done. All 4 adapters emit ResultEnvelope.

### FR-02: Deterministic Routing
The router classifies tasks by mode → family → constraints and selects adapters deterministically from a 20-entry matrix. Invalid family/mode raises RoutingError.
**Status:** Done. 75 e2e tests verify routing.

### FR-03: Policy Enforcement
Every execution passes 7 policy rules (P-001 through P-007) before adapter invocation. Policy can deny, require approval, force headed mode, or block experimental adapters.
**Status:** Done. Tested with destructive gates, session isolation, experimental blocking.

### FR-04: Receipt Emission
Every action emits a receipt with SHA-256 integrity hash, persisted to `~/.a2r/receipts/`. Route decisions also emit receipts.
**Status:** Done. Verified with real disk persistence and hash verification.

### FR-05: Session Lifecycle
Sessions support: create, activate, record_action, checkpoint, restore, destroy. Each session has isolated artifact_root. Session state persisted to disk.
**Status:** Done.

### FR-06: Browser Automation
Playwright adapter supports: goto, extract, screenshot, act (click/type), eval, observe. Browser-use adapter supports goal-based LLM automation. CDP adapter supports inspect, screenshot, eval, goto via WebSocket.
**Status:** Done for playwright + pyautogui (45 real tests). browser-use needs library install. CDP needs running Chrome.

### FR-07: Desktop Automation
pyautogui adapter supports: screenshot (full screen PNG), observe (screen size + mouse position), act:click, act:type.
**Status:** Done. 45 real tests pass including ~900KB desktop screenshots.

### FR-10: Parallel Execution
Router routes parallel mode to browser.playwright. Multi-context orchestration is router-ready but no fan-out coordinator yet.
**Status:** Routing done. Orchestrator not yet built.

### FR-11: Conformance Testing
3 suites with 18 real test functions. Suite A (8 browser tests), Suite D (4 desktop tests), Suite F (6 routing/policy tests). Grading: experimental (<50%), beta (50-89%), production (≥90%).
**Status:** Done. Suite F passes at production grade (6/6).

### FR-12: Adapter Manifests
4 adapters publish adapter.manifest.json with: adapter_id, family, capability_classes, supports, risk_level, policy_profile, conformance_suite.
**Status:** Done. Registry loads and validates all 4 manifests.

### FR-13: Fallback Chains
Routing assigns ordered fallback chains. Router tries opposite deterministic flag before falling back to catch-all.
**Status:** Done.

### FR-14: Golden Paths
8 golden paths documented: browser execute (det + adaptive), browser inspect, browser parallel, desktop execute, desktop inspect, cross-family, policy enforcement.
**Status:** Done.

---

## v0.2 Functional Requirements (Planned)

### FR-08: Retrieval (Not Yet Implemented)
Support non-interactive crawl/extraction via a real crawler adapter. Original spec called for cloudflare-crawl; will implement as Playwright-based crawler instead.
**Status:** Not started.

### FR-09: Hybrid Workflows (Not Yet Implemented)
Support cross-family workflows: browser downloads file → desktop processes it → browser uploads result. Requires an orchestrator that coordinates two sessions.
**Status:** Not started.

### FR-06b: Assist Mode (Not Yet Implemented)
Extension adapter for user-present workflows where agent suggests actions and human confirms.
**Status:** Not started. Requires browser extension bridge.

---

## Non-Functional Requirements

### NFR-01: Backward Compatibility
The existing A2R Operator continues to function. All endpoints verified working via test_real_adapters.py (45/45 pass on operator HTTP tests).
**Status:** Done.

### NFR-02: Incremental Migration
Migration is phased. v0.1 wraps existing code without breaking it.
**Status:** Done.

### NFR-03: No Speculative Rewrites
Existing operator code preserved. Adapters wrap real libraries, not reimplementations.
**Status:** Done.

### NFR-04: Operator Uptime
computer-use-operator service starts and serves all endpoints during testing.
**Status:** Done.

### NFR-05: Explicit File Paths
All file locations documented in Architecture.md file map.
**Status:** Done.

### NFR-06: Documented Decisions
Specs, golden paths, and this document serve as decision record.
**Status:** Done.

---

## Compatibility Constraints

- Existing FastAPI endpoints (/v1/browser/*, /v1/vision/*, /v1/sessions/*, /v1/parallel/*) remain functional
- Receipt format backward-compatible with .a2r/receipts/ storage
- CDP port 9222 convention preserved
- Operator port 3010 convention preserved
