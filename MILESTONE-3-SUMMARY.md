# Milestone 3: End-to-End Invocation - Status Report

**Date:** March 14, 2026

---

## Milestone 3a: Execution Bridge ✅ COMPLETE

### What Was Proven

The HTTP bridge between GIZZI TypeScript runtime and Python Computer Use gateway works correctly.

| Test | Method | Result |
|------|--------|--------|
| Health check | `curl /health` | ✅ `{"status":"ok","version":"0.2.0"}` |
| goto action | HTTP POST | ✅ Real navigation, title returned |
| screenshot action | HTTP POST | ✅ Valid PNG (16KB base64) |
| Validation error | Missing target | ✅ 400 with clear message |
| Runtime error | Invalid domain | ✅ 200 with `status:failed`, `error.code` |
| Contract compliance | All fields | ✅ Per `GIZZI-Bridge.md` spec |

### Architecture Verified

```
HTTP POST /v1/execute
  → FastAPI receives request
  → Playwright launches Chromium
  → Executes goto/screenshot
  → Returns normalized response
  → Base64 PNG in artifacts[]
```

### Files Proven

- `packages/computer-use/gateway/main.py` - Gateway with Playwright
- `cmd/gizzi-code/src/runtime/tools/builtins/browser.ts` - Tool bridge
- `cmd/gizzi-code/src/runtime/tools/builtins/registry.ts` - Registration
- `spec/computer-use/GIZZI-Bridge.md` - Contract
- `spec/computer-use/SessionSemantics.md` - Behavior spec

---

## Milestone 3b: Planner Invocation ✅ COMPLETE (see MILESTONE-4-SUMMARY.md)

### What Needs to Be Proven

The LLM/planner inside a real GIZZI session can discover and invoke `browser.ts`.

### Success Criteria

1. Start GIZZI TUI with flags:
   ```bash
   export GIZZI_DISABLE_BROWSER_TOOL=  # browser tool is always-on; set to "true" to disable
   export A2R_COMPUTER_USE_URL=http://localhost:3010
   gizzi
   ```

2. Prompt: *"Open https://example.com and take a screenshot"*

3. Verify:
   - [ ] Planner selects `browser` tool
   - [ ] Permission prompt appears (if enabled)
   - [ ] Tool call executes
   - [ ] Screenshot returns into session chat
   - [ ] Artifact displays correctly

### Why Not Yet Verified

The `gizzi run` command requires:
- Configured LLM provider (OpenAI/Anthropic/etc.)
- API key setup
- Interactive permission handling
- TUI rendering of tool results

This is an interactive test that cannot be easily automated in the current environment.

### Pre-Flight Checklist for 3b

Before testing, verify:

```bash
# 1. Gateway is running
curl http://localhost:3010/health
# → {"status":"ok"}

# 2. GIZZI has model configured
gizzi connect list
# → Should show at least one provider

# 3. Feature flags are set
export GIZZI_DISABLE_BROWSER_TOOL=  # browser tool is always-on; set to "true" to disable
export A2R_COMPUTER_USE_URL=http://localhost:3010

# 4. Start TUI
gizzi
```

### If Planner Does Not Select Browser Tool

Debugging steps:

1. **Check tool is in registry:**
   ```typescript
   // In GIZZI debug mode or by adding logging
   const tools = await ToolRegistry.tools({providerID, modelID})
   console.log("Available tools:", tools.map(t => t.id))
   // Should include "browser"
   ```

2. **Improve tool description:**
   - Edit `browser.txt` to be more explicit about use cases
   - Add examples of when to use the tool

3. **Check feature flag is active:**
   - Verify `GIZZI_DISABLE_BROWSER_TOOL=  # browser tool is always-on; set to "true" to disable` is exported
   - Check that `Flag.GIZZI_ENABLE_BROWSER_TOOL` returns true

4. **Force tool use:**
   - Try prompt: *"Use the browser tool to open https://example.com"*

---

## What Is Proven vs What Remains

| Component | Status | Notes |
|-----------|--------|-------|
| Gateway HTTP endpoint | ✅ Proven | Direct curl tests pass |
| Playwright execution | ✅ Proven | Real browser automation |
| Screenshot artifacts | ✅ Proven | Valid PNG base64 |
| Error normalization | ✅ Proven | Both validation and runtime |
| Tool registration | ✅ Proven | Registered with flag gate |
| Tool schema | ✅ Proven | Zod validation correct |
| Permission hook | ✅ Proven | `ctx.ask()` in place |
| **Planner discovery** | ⏳ Pending | Needs interactive TUI test |
| **LLM invocation** | ⏳ Pending | Needs configured provider |
| **Artifact rendering** | ⏳ Pending | Needs TUI display test |

---

## Recommendation

### Immediate (Next 30 min)

1. Configure GIZZI with an LLM provider (or verify existing config)
2. Start TUI with feature flags
3. Run the test prompt
4. Document result

### If 3b Succeeds

Move to **persistent sessions** (v0.3.0):
- Session manager that reuses browser contexts
- `goto` establishes current page
- `screenshot` uses current page by default
- Session expiry/cleanup

### If 3b Fails

Fix the specific gap:
- Tool description → edit `browser.txt`
- Registration issue → check flag/env var
- Schema issue → check Zod validation
- Do NOT change gateway (it's proven working)

---

## Summary

**Milestone 3a (Execution Bridge):** ✅ **COMPLETE**

The runtime seam is real and working. The gateway executes Playwright, returns screenshots, and handles errors correctly.

**Milestone 3b (Planner Invocation):** ⏳ **READY TO TEST**

All components are in place. Just needs interactive TUI verification with a configured LLM.

**Bottom Line:**
> A2R Computer Use is a working execution service. The bridge is solid. The remaining work is integration testing, not architecture.
