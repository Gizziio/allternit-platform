# Milestone 4: Live Planner UX — Complete

**Date:** March 15, 2026
**Status:** ✅ PROVEN END-TO-END

---

## What Was Proven

Live GIZZI session with Kimi K2 model (real API, not a stub) selected the
`browser` tool without prompting, called the Computer Use operator, received
a Playwright screenshot artifact, and produced a correct natural-language answer.

```
$ bun run ./src/cli/main.ts run \
    --model kimi-for-coding/kimi-k2-thinking \
    "Use the browser tool to navigate to example.com, take a screenshot, and tell me the page title"

> build · kimi-k2-thinking
⚙ browser  Browser execute completed via browser.playwright
⚙ browser  Browser execute completed via browser.playwright
Page title: **Example Domain**
Screenshot captured showing the example.com page with the heading "Example Domain"
and descriptive text about the domain's use for documentation examples.
```

Smoke test (20/20 checks): goto → screenshot → extract → session metadata → close session.

---

## Stack Proven

```
Kimi K2 (api.kimi.com/coding/v1, @ai-sdk/anthropic SDK)
  │  selects browser tool autonomously
  ▼
BrowserTool (browser.ts) — always-on, auto-starts operator
  │  POST localhost:3010/v1/execute
  ▼
Computer Use Operator (port 3010)
  │  adapter routing table (see below)
  ▼
PlaywrightAdapter → Chromium
  │  screenshot bytes → base64 data URI artifact
  ▼
Kimi processes tool result + image → answer
```

### Adapter Routing Table (as of Milestone 4)

| action | adapter_preference | adapter used |
|--------|-------------------|--------------|
| goto, click, fill, extract, inspect | any | PlaywrightAdapter |
| screenshot | desktop | PyAutoGUIAdapter |
| screenshot | any other | PlaywrightAdapter |
| execute | browser-use | A2RBrowserManager (with Playwright fallback) |
| execute | desktop | PyAutoGUIAdapter + VisionLoop |
| execute | no preference / playwright | PlaywrightAdapter + VisionLoop |

---

## Runtime Gaps Closed This Session

### Gap 1: Auto-start operator from browser tool
- BrowserTool calls `waitForGateway()` on each invocation
- If operator unreachable, `autoStartOperator()` spawns uvicorn detached
- Retry once after 3s; fails with clean error if still down
- No manual startup required

### Gap 2: Session persistence across operator restarts
- `SessionStore` (file-backed JSON at `.a2r/sessions/sessions.json`)
- On adapter create, checks persisted `last_url` and navigates back
- Sessions visible via `GET /v1/sessions`; deletable via `DELETE /v1/sessions/{id}`

### Gap 3: Vision loop routing for execute goals
- `execute` action → VisionLoop(adapter, vision_inference=VisionInference(...))
- VisionInference reads `A2R_VISION_INFERENCE_BASE` / `A2R_VISION_INFERENCE_KEY` / `A2R_VISION_MODEL_NAME`
- Heuristic fallback when VLM not configured

### Gap 4 (new): adapter_preference routing
- `browser-use` preference → A2RBrowserManager (falls back to Playwright if unavailable)
- `desktop` preference → PyAutoGUIAdapter
- All concrete actions (goto/click/fill/extract/inspect/screenshot) → always Playwright

---

## Bugs Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Kimi API 401 | api.moonshot.cn/v1 doesn't accept sk-kimi-* keys | api.kimi.com/coding/v1 + @ai-sdk/anthropic |
| Three config files with old baseURL | ~/.config/gizzi/, ~/.config/gizzi-code/, gizzi.json all had api.moonshot.cn | Cleaned all three |
| Zod v4 crash tool load | z.record(z.any()) has no ._zod in Zod 4.3.6 | z.record(z.string(), z.unknown()) |
| Screenshot file path not data | PlaywrightAdapter doesn't write disk | Post-process: adapter._page.screenshot() → base64 data URI |
| 500 on execute (receipts) | envelope.receipts contains string IDs | isinstance(r, str) branch in converter |
| Kimi 400 "text content is empty" | null summary → empty string → empty Anthropic text block | Fallback to "Browser {mode} {status}" |
| ComputerUseResponse Zod error | null fields fail .optional() in Zod v4 | Changed to .nullish() |
| Port mismatch | browser.ts defaulted to :8080, operator runs on :3010 | Fixed default GATEWAY_URL |
| browser-use never called | gateway_execute always used Playwright | Wired browser-use path before Playwright fallback |

---

## Configuration Reference

### Operator
```
Port:    3010
Binary:  services/computer-use-operator/src/main.py
Start:   uvicorn src.main:app --host 127.0.0.1 --port 3010
Health:  GET http://localhost:3010/health
Gateway: POST http://localhost:3010/v1/execute
```

### GIZZI Provider
```
Provider ID:  kimi-for-coding
Model:        kimi-for-coding/kimi-k2-thinking
Base URL:     https://api.kimi.com/coding/v1
SDK:          @ai-sdk/anthropic (in models.dev catalog)
Key:          auth.json → kimi-for-coding.key (sk-kimi-* format)
Config:       Only set options.apiKey in gizzi config; don't override npm or baseURL
```

### Feature Flags
```
Browser tool:  Always on. Disable with GIZZI_DISABLE_BROWSER_TOOL=true
Vision LLM:    A2R_VISION_INFERENCE_BASE, A2R_VISION_INFERENCE_KEY, A2R_VISION_MODEL_NAME
Vision steps:  A2R_VISION_MAX_STEPS (default 10)
```

---

## Files Changed This Session

| File | Change |
|------|--------|
| `cmd/gizzi-code/src/runtime/tools/builtins/browser.ts` | auto-start, port 3010, z.record fix, .nullish(), empty output guard |
| `cmd/gizzi-code/src/runtime/context/flag/flag.ts` | GIZZI_ENABLE_BROWSER_TOOL → always-on, opt-out pattern |
| `services/computer-use-operator/src/main.py` | SessionStore, /v1/execute unified gateway, adapter routing, browser-use path, screenshot post-processing |
| `services/computer-use-operator/smoke_test.py` | New: Milestone 4 smoke test (20 checks) |
| `~/.config/gizzi-code/config.json` | Remove npm/baseURL override; only apiKey |
| `~/.config/gizzi/config.json` | Same |
| `gizzi-code/gizzi.json` | Same |

---

## What Remains: Milestone 5

VLM-backed vision decisions for the `execute` action.

**Status of wiring:** Complete. `VisionInference` is instantiated in the operator
when `A2R_VISION_INFERENCE_BASE` is set. `VisionLoop.run(goal=..., max_steps=10)`
drives the observe→decide→act→verify cycle.

**What's needed for M5:** A working VLM endpoint that accepts screenshots and
returns structured action decisions. Then validate the loop closes on a non-trivial
goal (e.g., "fill out the contact form on httpbin.org/forms/post").

**Tag:** `a2r-computer-use-m4-proven` on the commit where 20/20 smoke test passed.
