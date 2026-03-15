# A2R Computer Use — Final Status

**Date:** March 15, 2026
**Status:** ✅ MILESTONE 4 COMPLETE — Live planner UX proven end-to-end

---

## Test Results

| Suite | Tests | Passed | Status |
|-------|-------|--------|--------|
| Conformance (March 14) | 10 | 10 | ✅ |
| Comprehensive Agent (March 14) | 21 | 21 | ✅ |
| Observability E2E (March 14) | 2 | 2 | ✅ |
| Analyzer Tuning (March 14) | 6 | 6 | ✅ |
| **Milestone 4 Smoke Test (March 15)** | **20** | **20** | **✅** |
| **Live GIZZI + Kimi E2E (March 15)** | **1** | **1** | **✅** |
| **TOTAL** | **60** | **60** | **✅** |

---

## Current Architecture

```
GIZZI CLI / TUI
  │  kimi-for-coding/kimi-k2-thinking
  │  api.kimi.com/coding/v1  (@ai-sdk/anthropic)
  ▼
BrowserTool (browser.ts)
  │  Always-on. Auto-starts operator if unreachable.
  │  POST http://localhost:3010/v1/execute
  ▼
Computer Use Operator  (services/computer-use-operator/, port 3010)
  │
  ├─ goto / click / fill / extract / inspect  →  PlaywrightAdapter (deterministic)
  ├─ screenshot                               →  PlaywrightAdapter (or PyAutoGUI if desktop)
  ├─ execute + browser-use preference         →  A2RBrowserManager (fallback: Playwright)
  └─ execute + no preference                  →  PlaywrightAdapter + VisionLoop
       └─ if A2R_VISION_INFERENCE_BASE set    →  VLM-guided decisions
          else                               →  heuristic fallback
  ▼
Session store: .a2r/sessions/sessions.json (persists across restarts)
```

---

## Proven Actions

| Action | Adapter | Proven |
|--------|---------|--------|
| goto | Playwright | ✅ |
| screenshot (inline base64) | Playwright | ✅ |
| click | Playwright | ✅ |
| fill | Playwright | ✅ |
| extract (text/html/json) | Playwright | ✅ |
| inspect | Playwright | ✅ |
| execute (goal, heuristic) | Playwright VisionLoop | ✅ |
| execute (goal, VLM) | VisionLoop + VisionInference | ⏳ M5: needs VLM endpoint |
| execute (browser-use) | A2RBrowserManager | ✅ wired, ⏳ M5: integration test |
| screenshot (desktop) | PyAutoGUI | ✅ wired |

---

## Provider Configuration (Current)

**kimi-for-coding** is in the models.dev catalog. Do NOT override `npm` or `baseURL`
in gizzi config — that fights the catalog and causes silent routing failures.

```json
{
  "provider": {
    "kimi-for-coding": {
      "options": {
        "apiKey": "sk-kimi-..."
      }
    }
  },
  "model": "kimi-for-coding/kimi-k2-thinking"
}
```

The catalog already provides:
- `npm: "@ai-sdk/anthropic"`
- `api: "https://api.kimi.com/coding/v1"`

---

## Operator Reference

```
Port:    3010   (not 8080 — the old gateway is retired)
Health:  GET  http://localhost:3010/health
Execute: POST http://localhost:3010/v1/execute
Sessions:
  list    GET    http://localhost:3010/v1/sessions
  close   DELETE http://localhost:3010/v1/sessions/{session_id}
```

```bash
# Start operator
cd services/computer-use-operator
A2R_COMPUTER_USE_PATH=../../packages/computer-use \
  python3 -m uvicorn src.main:app --host 127.0.0.1 --port 3010
```

---

## Browser Tool Flags

| Env Var | Effect |
|---------|--------|
| `GIZZI_DISABLE_BROWSER_TOOL=true` | Turn off browser tool (default: on) |
| `A2R_COMPUTER_USE_URL` | Override operator URL (default: http://localhost:3010) |
| `A2R_VISION_INFERENCE_BASE` | VLM endpoint for vision loop |
| `A2R_VISION_INFERENCE_KEY` | VLM API key |
| `A2R_VISION_MODEL_NAME` | VLM model name |
| `A2R_VISION_MAX_STEPS` | Max vision loop steps (default: 10) |

---

## Known Gaps / Milestone 5 Work

| Item | Priority | Notes |
|------|----------|-------|
| VLM vision loop validation | High | Wire works; needs real VLM endpoint |
| browser-use execute path integration test | Medium | Wired; needs BrowserTask completion test |
| Tool selection: browser vs webfetch | Low | LLM-determined; correct split by design |
| Permission prompt UX in TUI | Low | ctx.ask() fires; TUI rendering untested |
| Artifact display in TUI conversation | Low | Attachment returned; TUI rendering untested |
| Session TTL / cleanup policy | Low | Idle cleanup implemented in SessionStore |

---

## Documents

| File | Purpose |
|------|---------|
| `MILESTONE-4-SUMMARY.md` | Detailed M4 proof, bug log, config reference |
| `MILESTONE-3-SUMMARY.md` | M3 execution bridge proof |
| `CU-001-STATUS.md` | Planner invocation — COMPLETE |
| `CU-003-STATUS.md` | Persistent sessions — COMPLETE |
| `services/computer-use-operator/smoke_test.py` | 20-check smoke test |

---

## Bottom Line

The A2R Computer Use system is live and agent-ready at Milestone 4:

- GIZZI selects the browser tool autonomously when relevant
- The operator executes real Playwright browser actions
- Screenshots return as inline base64 artifacts the LLM can process
- Sessions persist across operator restarts
- Adapter routing is deterministic for all concrete actions
- browser-use and VLM vision are wired but need M5 integration testing

**Tag this commit:** `a2r-computer-use-m4-proven`
