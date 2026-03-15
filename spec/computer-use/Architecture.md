# A2R Computer Use — Architecture

**Version:** v0.1 Foundation
**Last updated:** 2026-03-14

Architectural source of truth for the A2R Computer Use subsystem.

---

## Package Layout (v0.1 — what exists now)

```
a2rchitech/
  services/
    computer-use-operator/           # Runtime entrypoint (FastAPI, port 3010)
      run.py                         # Launch script
      src/
        main.py                      # 591 lines — all HTTP endpoints
        brain_adapter.py             # Session contexts, receipts, desktop control
        browser_use/manager.py       # A2RBrowserManager (3 modes)
        telemetry.py                 # Provider probing, snapshots
        plugin_engine.py             # QuickJS sandbox
        a2r_vision/action_parser.py  # ByteDance UI-TARS parser

  packages/
    computer-use/
      core/                          # BaseAdapter ABC, ActionRequest, ResultEnvelope,
                                     # Receipt, Artifact, PolicyDecision
      routing/                       # Router (20-entry matrix), AdapterRegistry
      policy/                        # PolicyEngine (7 rules), custom rule loader
      receipts/                      # ReceiptWriter — SHA-256 integrity, disk persistence
      sessions/                      # SessionManager — lifecycle, artifact isolation
      telemetry/                     # TelemetryCollector — events, metrics, listeners
      vision/                        # VisionParser, VisionInference (VLM client)
      conformance/                   # ConformanceRunner, 3 suites, 18 real test functions
      golden-paths/                  # 8 documented execution paths
      adapters/
        browser/
          playwright/                # PlaywrightAdapter — FULLY WORKING
          browser-use/               # BrowserUseAdapter — code complete, needs library
          cdp/                       # CDPAdapter — HTTP + WebSocket, needs running Chrome
        desktop/
          pyautogui/                 # PyAutoGUIAdapter — FULLY WORKING
      tests/
        test_e2e.py                  # 75 tests (all pass)
        test_real_adapters.py        # 45 tests (all pass)

  spec/
    computer-use/
      Vision.md                      # Product definition
      Architecture.md                # This file
      Guarantees.md                  # G1-G5
      RoutingPolicy.md               # Routing rules
      Requirements.md                # FR/NFR
      Conformance.md                 # Test suites
      ThreatModel.md                 # T1-T8
      Cookbooks.md                   # Golden path index
      MigrationMap.md                # Source→target mapping
      Contracts/                     # 6 JSON schemas
```

### Not in v0.1 (removed — were stubs)

These directories were deleted because they contained zero working code:
- `modes/` (7 empty dirs), `contracts/`, `cookbooks/`
- `adapters/browser/extension/`, `electron-web/`, `lightpanda/`, `puppeteer/`, `selenium/`
- `adapters/desktop/ui-tars/`, `os-native/`
- `adapters/retrieval/`, `adapters/hybrid/`

---

## Runtime Planes

- **Presentation plane:** shell, web, extension, operator console
- **Control plane:** computer-use-operator service (port 3010)
- **Execution plane:** Playwright browser, pyautogui desktop, CDP WebSocket (port 9222)

---

## v0.1 Family and Mode Model

**Families:** browser, desktop

**Modes:** execute, inspect, parallel, desktop

Every `(mode, family)` combination routes to a real adapter. Invalid combinations raise `RoutingError`.

---

## v0.2 Planned Expansion

**Families to add:** retrieval, hybrid

**Modes to add:** assist, crawl, hybrid

See Vision.md for details.

---

## Routing Flow

1. Validate family ∈ {browser, desktop}
2. Validate mode ∈ {execute, inspect, parallel, desktop}
3. Evaluate constraints (deterministic, visual_reasoning, user_present)
4. Lookup ADAPTER_MATRIX[(mode, family, deterministic)] → primary + fallbacks
5. Apply constraint overrides (visual reasoning swap)
6. Return RouteDecision, log to audit trail

---

## Adapter Model

- Every adapter declares an `adapter.manifest.json` with `capability_classes`, support flags, `risk_level`, `policy_profile`, `conformance_suite`.
- Every adapter implements `BaseAdapter` ABC: `initialize()`, `execute()`, `close()`
- Every adapter returns a `ResultEnvelope` (G1).
- Every adapter emits `Receipt` with integrity hash (G3).
- No UI may directly invoke an adapter — must go through router.

---

## Receipt Flow

```
goal → router → policy check → session create → adapter.execute()
     → receipt emission → integrity hash → disk persistence
     → telemetry event → session destroy
```

---

## Existing Operator Integration

| Operator Component | Package Equivalent | Status |
|---|---|---|
| main.py endpoints | Adapters called directly or via operator HTTP | Live |
| browser_use/manager.py | browser.playwright + browser.browser-use adapters | Live |
| brain_adapter.py | sessions/ + receipts/ + policy/ | Live |
| telemetry.py | telemetry/ | Live |
| plugin_engine.py | Not extracted | Operator only |
| a2r_vision/action_parser.py | vision/ (simplified parser) | Partial |
