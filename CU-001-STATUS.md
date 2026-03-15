# CU-001: Planner Invocation — Status Report

**Date:** March 15, 2026
**Status:** ✅ COMPLETE — Live end-to-end proven

---

## What Was Proven

Live GIZZI session with Kimi K2 model selected the `browser` tool autonomously,
invoked the Computer Use operator, received a screenshot artifact, and produced a
correct natural-language answer.

```
bun run ./src/cli/main.ts run \
  --model kimi-for-coding/kimi-k2-thinking \
  "Use the browser tool to navigate to example.com, take a screenshot, and tell me the page title"

> build · kimi-k2-thinking
⚙ browser  Browser execute completed via browser.playwright
⚙ browser  Browser execute completed via browser.playwright
Page title: **Example Domain**
Screenshot captured showing the example.com page with the heading "Example Domain"...
```

Two operator round-trips (goto + screenshot), both via Playwright, both clean.

---

## Current Architecture

```
GIZZI CLI (kimi-for-coding/kimi-k2-thinking)
  │  tool call: browser { action: "goto", target: "https://example.com" }
  ▼
BrowserTool (browser.ts)
  │  POST http://localhost:3010/v1/execute
  ▼
Computer Use Operator (services/computer-use-operator/src/main.py, port 3010)
  │  adapter: Playwright
  ▼
PlaywrightAdapter → Chromium → page
  │  ResultEnvelope → GatewayExecuteResponse (screenshot as base64 data URI)
  ▼
BrowserTool normalizeResult → tool output + attachment
  ▼
Kimi K2 receives tool result + PNG → final answer
```

---

## Verified Checklist

| Item | Status |
|------|--------|
| Tool registered in ToolRegistry | ✅ |
| Tool always-on (opt-out: GIZZI_DISABLE_BROWSER_TOOL) | ✅ |
| Kimi provider auth (api.kimi.com/coding/v1, @ai-sdk/anthropic) | ✅ |
| Browser tool auto-starts operator if not running | ✅ |
| goto → screenshot round-trip | ✅ |
| Screenshot as inline base64 artifact | ✅ |
| Tool result non-empty (null-safe output) | ✅ |
| LLM processes screenshot and gives answer | ✅ |

---

## Configuration State

### Operator
- **Port:** 3010
- **Path:** `services/computer-use-operator/src/main.py`
- **Default adapter:** Playwright
- **Auto-start:** BrowserTool spawns uvicorn if unreachable

### GIZZI Provider
- **Provider:** `kimi-for-coding` → `api.kimi.com/coding/v1` → `@ai-sdk/anthropic`
- **Model:** `kimi-for-coding/kimi-k2-thinking`
- **Key:** In `~/.local/share/gizzi-code/auth.json` (sk-kimi-* format)
- **Config rule:** Only set `options.apiKey` in gizzi config. Never override `npm` or `baseURL` — those come from the models.dev catalog and overriding them causes silent misrouting.

---

## Bugs Fixed to Get Here

| Bug | Fix |
|-----|-----|
| Kimi auth 401 on api.moonshot.cn/v1 | Switched to api.kimi.com/coding/v1 + @ai-sdk/anthropic (catalog already correct) |
| Three config files had old OpenAI baseURL | Cleaned: ~/.config/gizzi-code/config.json, ~/.config/gizzi/config.json, gizzi.json |
| Zod v4 crash on z.record(z.any()) | z.record(z.string(), z.unknown()) |
| ComputerUseResponse rejects null fields | .optional() → .nullish() on summary, error, trace_id |
| Empty string output → Kimi 400 | Fallback to "Browser {mode} {status}" when summary is null |
| Screenshot not in artifact | Post-process: grab bytes from adapter._page, inject as data URI |
| envelope.receipts string IDs | isinstance(r, str) branch in _envelope_to_response |

---

## Next: Milestone 5

VLM-backed vision loop for the `execute` action.

- Set `A2R_VISION_INFERENCE_BASE` to a working VLM endpoint
- Validate the observe→decide→act→verify loop closes on a non-trivial goal
- `execute` + `adapter_preference: "browser-use"` → A2RBrowserManager is now wired
