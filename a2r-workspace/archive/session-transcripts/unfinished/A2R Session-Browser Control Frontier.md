# A2rchitech Session Summary — Browser Control Frontier (browser-use vs Playwright)

**Date:** 2026-01-26  
**Topic:** Agent browser runtime strategy (MCP + CLI tool gateway)  
**Stance captured:** “browser-use is the new frontier; do not use Playwright directly.”

---

## 1) Core claim under discussion
You want A2rchitech’s browser capability to standardize on **browser-use as the primary browser skill**, invoked through a **tool gateway** (MCP and/or CLI-wrapped tools), and you want to **avoid Playwright** because you believe it is deprecated and slow.

---

## 2) What is factually true (important distinctions)

### 2.1 Playwright is not “deprecated” as a framework
- The **Playwright framework** remains actively released and maintained (official release notes continue to publish versions).  [oai_citation:0‡Playwright](https://playwright.dev/docs/release-notes?utm_source=chatgpt.com)
- What *is* being retired is **Microsoft Playwright Testing** (Azure-hosted testing product), not the Playwright automation framework itself.  [oai_citation:1‡Microsoft Learn](https://learn.microsoft.com/en-us/rest/api/playwright/includes/retirement-banner?utm_source=chatgpt.com)

### 2.2 browser-use is a strong agent-facing control layer, but often depends on Playwright
- Multiple sources describe **browser-use running “under the hood” on Playwright** (i.e., Playwright may still be a dependency even if you never author Playwright code).  [oai_citation:2‡Bright Data](https://brightdata.com/blog/ai/browser-use-with-scraping-browser?utm_source=chatgpt.com)

**Implication:** “Do not use Playwright” can mean two different things:
1) **Do not write Playwright code** (compatible with browser-use-first).  
2) **Do not include Playwright as any dependency** (may be incompatible if browser-use requires it in your chosen mode).

A2rchitech can satisfy (1) immediately. Satisfying (2) depends on browser-use’s backend options and your selected runtime mode.

---

## 3) browser-use integration surfaces that match A2rchitech’s tool gateway model

### 3.1 MCP server (cloud HTTP + local stdio)
- browser-use provides a hosted MCP endpoint: `https://api.browser-use.com/mcp`.  [oai_citation:3‡docs.cloud.browser-use.com](https://docs.cloud.browser-use.com/usage/mcp-server?utm_source=chatgpt.com)
- It also documents a local stdio MCP mode via `uvx browser-use --mcp`.  [oai_citation:4‡docs.cloud.browser-use.com](https://docs.cloud.browser-use.com/usage/mcp-server?utm_source=chatgpt.com)

### 3.2 Existing community MCP wrappers
- There are OSS MCP servers that wrap browser-use; some prefer HTTP transport to avoid stdio timeouts on long browser operations.  [oai_citation:5‡GitHub](https://github.com/Saik0s/mcp-browser-use?utm_source=chatgpt.com)

---

## 4) Platform decision recorded for A2rchitech (what you want)

### Decision: Browser-first frontier = browser-use skill
- **Canonical “BrowserSkill” for agents is browser-use-based**.
- A2rchitech should treat browser automation as **a tool-callable capability** surfaced via:
  - MCP (preferred for agent ecosystems)
  - CLI wrapper (fallback + local scripting)

### Non-goal (your directive)
- **Do not build new first-class Playwright automation scripts** as the primary path.
- If Playwright exists, it should be **an implementation detail**, not an API.

---

## 5) Implementation blueprint (gateway-level)

### 5.1 Tool contract (A2rchitech-facing)
Expose one stable interface regardless of backend:

- `browser.open(url, session?)`
- `browser.state(session?)` → returns structured clickable targets
- `browser.click(target, session?)`
- `browser.type(target, text, session?)`
- `browser.screenshot(session?)`
- `browser.close(session?)`

This maps cleanly onto browser-use’s documented action style and supports multi-session operation patterns. (CLI-style control is explicitly part of the ecosystem around browser-use + MCP wrappers.)  [oai_citation:6‡GitHub](https://github.com/Saik0s/mcp-browser-use?utm_source=chatgpt.com)

### 5.2 Two runtimes
1) **Local**: stdio MCP (`uvx ... --mcp`) for dev + Claude Desktop-style clients.  [oai_citation:7‡docs.browser-use.com](https://docs.browser-use.com/customize/integrations/mcp-server?utm_source=chatgpt.com)  
2) **Remote**: HTTP MCP (`https://api.browser-use.com/mcp`) for cloud agents, long-running tasks, and persistent daemon behavior.  [oai_citation:8‡docs.cloud.browser-use.com](https://docs.cloud.browser-use.com/usage/mcp-server?utm_source=chatgpt.com)

---

## 6) Risk register (explicit)

### R1 — “No Playwright at all” may be infeasible if browser-use depends on it
If browser-use requires Playwright, eliminating Playwright completely may require:
- a different backend,
- CDP-only workflows,
- or a browser grid provider.

For now, you can still achieve the practical goal: **no Playwright-authored code and no Playwright exposed to agents**, while tolerating it as a hidden dependency if needed.  [oai_citation:9‡Bright Data](https://brightdata.com/blog/ai/browser-use-with-scraping-browser?utm_source=chatgpt.com)

### R2 — Confusion from Microsoft product retirement
“Playwright is deprecated” is often a misread of “Microsoft Playwright Testing is retired.” The platform decision should not be based on that confusion; base it on A2rchitech’s desired abstraction (agent-friendly browsing).  [oai_citation:10‡Microsoft Learn](https://learn.microsoft.com/en-us/rest/api/playwright/includes/retirement-banner?utm_source=chatgpt.com)

---

## 7) Concrete next tasks (handoff-ready)

1) **Define `BrowserSkill` contract** in /spec/Contracts (tool schema + result schema).  
2) **Implement gateway adapters**:
   - Adapter A: local stdio MCP (`uvx browser-use --mcp`)  
   - Adapter B: remote HTTP MCP (`https://api.browser-use.com/mcp`)  
3) **Add session routing**: session-id keyed browser contexts; support concurrent agents.  
4) **Add timeout + retry policy** tuned for long browser ops (especially if using stdio).  [oai_citation:11‡GitHub](https://github.com/Saik0s/mcp-browser-use?utm_source=chatgpt.com)  
5) **Enforce “no Playwright code”**: lint/policy gate in /agent/POLICY.md (A2rchitech repo law layer).  
6) **Add observability hooks**: log tool calls + screenshots + state snapshots as first-class artifacts.

---

## 8) Final recorded position (verbatim intent, normalized)
A2rchitech’s browser automation should treat **browser-use** as the standard agent browser skill and the dominant “frontier” interface (MCP/CLI callable). Playwright is not a platform API and should not be the recommended integration surface, even if it remains a hidden underlying dependency in some modes.

---