# Routing Policy — A2R Computer Use

**Version:** v0.1 Foundation
**Last updated:** 2026-03-14

Route by: **mode → family → adapter**. This order is non-negotiable.

---

## v0.1 — Live Routing

### Step 1: Classify Task Family

| Signal | Family |
|--------|--------|
| URL target, DOM interaction, web page | browser |
| Native app, file picker, desktop GUI, OS dialog | desktop |

### Step 2: Classify Execution Mode

| Signal | Mode |
|--------|------|
| Scripted or goal-driven task execution | execute |
| Debug, inspect DOM, network traffic, devtools | inspect |
| Multiple variants/sessions simultaneously | parallel |
| Native desktop GUI workflow | desktop |

### Step 3: Evaluate Constraints

| Constraint | Values | Effect |
|-----------|--------|--------|
| deterministic | true/false | If true, prefer playwright over browser-use |
| visual_reasoning | true/false | If true + not deterministic, prefer browser-use |
| user_present | true/false | Noted in decision reason; all adapters support headed |
| headless_allowed | true/false | If false, exclude headless-only adapters |
| destructive_action | true/false | If true, policy engine must approve before execution |

### Step 4: Select Adapter

Lookup `ADAPTER_MATRIX[(mode, family, deterministic)]`:

| Mode + Family | Deterministic | Primary Adapter | Fallback Chain | Fail Mode |
|---|---|---|---|---|
| execute + browser | True | browser.playwright | [browser.browser-use] | fail closed |
| execute + browser | False | browser.browser-use | [browser.playwright] | fail closed |
| inspect + browser | True/False | browser.cdp | [browser.playwright] | fail open |
| parallel + browser | True/False | browser.playwright | [browser.browser-use] | reduce parallelism |
| desktop + browser | True/False | browser.playwright | [] | fail closed |
| execute + desktop | True/False | desktop.pyautogui | [] | fail closed |
| inspect + desktop | True/False | desktop.pyautogui | [] | fail open |
| parallel + desktop | True/False | desktop.pyautogui | [] | fail closed |
| desktop + desktop | True/False | desktop.pyautogui | [] | fail closed |

All 4 adapters are reachable as primary for at least one route:
- `browser.playwright` — execute(det), parallel, desktop×browser
- `browser.browser-use` — execute(adaptive)
- `browser.cdp` — inspect×browser
- `desktop.pyautogui` — all desktop routes

### Step 5: Error Handling

- Unknown family → `RoutingError`
- Unknown mode → `RoutingError`
- No silent fallthrough to `.unknown` adapters

### Step 6: Assign Fallback Chain

Every routing decision includes an ordered fallback chain:
- Maximum 3 fallback attempts
- Each fallback attempt emits a receipt
- If primary and all fallbacks fail, fail closed
- Experimental adapters never appear as fallback for production routes

---

## Policy Overrides

The policy engine can override any routing decision:
- Force headed mode (override headless)
- Deny adapter (block specific adapter for domain/risk)
- Require approval (pause execution until user confirms)
- Force alternate adapter (override primary selection)

---

## Architecture Rules

1. No UI component may invoke an adapter directly
2. All requests must pass through the router
3. Router must consult policy engine before adapter selection
4. Every routing decision is logged as a receipt
5. Routing decisions are deterministic — same inputs produce same outputs
6. Experimental adapters must be explicitly opted into

---

## v0.2 Planned Expansion

The following will be added when real adapters are implemented:

| Mode + Family | Primary Adapter | Status |
|---|---|---|
| crawl + retrieval | retrieval.playwright-crawler | Not started |
| assist + browser | browser.extension | Not started |
| hybrid + hybrid | hybrid.browser-desktop-handoff | Not started |

This is the routing source of truth.
