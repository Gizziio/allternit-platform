# Allternit Computer Use — Vision

**Status:** v0.1 Foundation
**Owner:** Eoj
**Last updated:** 2026-03-14

---

## Problem

Browser automation, desktop automation, retrieval, and hybrid workflows exist as disconnected implementations across the allternit codebase. There is no unified product surface, no consistent contracts, no deterministic routing, and no conformance testing. Each adapter speaks its own dialect, emits its own result shape, and is tested (if at all) in isolation. This fragmentation blocks reliable agent orchestration and makes it impossible to reason about automation capabilities as a coherent system.

## Product Surface

**Allternit Computer Use** is a single product that unifies all automation capabilities under one routing layer, one contract set, and one conformance standard.

## Foundation

The existing Allternit Operator service (`services/computer-use-operator/`) is the foundation — a 591-line FastAPI service that already supports browser-use, playwright, computer-use vision, and desktop-use. The packages/computer-use/ layer wraps and extends this with formal routing, policy, sessions, receipts, telemetry, and conformance.

---

## v0.1 — Implemented Now

### Families

| Family | Scope | Status |
|---|---|---|
| **browser** | Web page interaction — deterministic (Playwright), adaptive (browser-use), inspect (CDP) | **Live** |
| **desktop** | Native OS surfaces — screenshot, click, type, observe | **Live** |

### Modes

| Mode | Description | Status |
|---|---|---|
| `execute` | Scripted or goal-driven task execution | **Live** |
| `inspect` | Read-only observation — DOM, network, devtools, desktop screenshot | **Live** |
| `parallel` | Concurrent multi-context browser execution | **Live** (router routes, no orchestrator yet) |
| `desktop` | Native OS automation via pyautogui | **Live** |

### Adapters

| Adapter | Family | Actions | Grade | Tested |
|---|---|---|---|---|
| `browser.playwright` | browser | goto, extract, screenshot, act, eval, observe | beta | 45 real tests pass |
| `browser.browser-use` | browser | Goal-based LLM automation | beta | Code complete, needs library install |
| `browser.cdp` | browser | inspect, screenshot, eval, goto (via WebSocket CDP) | experimental | Code complete, needs running Chrome |
| `desktop.pyautogui` | desktop | screenshot, observe, act (click/type) | beta | 45 real tests pass |

---

## v0.2 — Planned Next

### Families to Add

| Family | Scope | Prerequisite |
|---|---|---|
| **retrieval** | Content extraction, crawling, structured data capture | Real crawl adapter |
| **hybrid** | Cross-family workflows chaining browser + desktop steps | Orchestrator implementation |

### Modes to Add

| Mode | Description | Prerequisite |
|---|---|---|
| `assist` | Agent suggests actions, human confirms | Extension adapter |
| `crawl` | Systematic multi-page retrieval and extraction | Retrieval family |
| `hybrid` | Cross-family chained workflows | Hybrid family |

### Adapters to Add

| Adapter | Family | Prerequisite |
|---|---|---|
| `retrieval.playwright-crawler` | retrieval | Playwright-based crawl implementation |
| `hybrid.browser-desktop-handoff` | hybrid | Orchestrator that coordinates two sessions |
| `browser.extension` | browser | Thin-client extension bridge |

---

## Capability Classes (Evaluation Lens)

1. **Deterministic web** — Playwright scripts with known selectors and predictable outcomes
2. **Adaptive web** — LLM-driven browser-use agents that handle dynamic or unknown pages
3. **Visual computer use** — Screenshot-based desktop interaction via coordinate models

Planned:
4. Embedded surfaces — iframes, shadow DOM, browser extensions, webviews
5. Fleet / session infra — Multi-session management, parallel orchestration

---

## Goals

- **Unified routing** — one deterministic router selects the correct adapter for every request
- **Standardized contracts** — all adapters accept a normalized request envelope and emit a normalized result envelope
- **Receipt integrity** — every execution produces a signed, auditable receipt
- **Conformance suites** — each capability class has a pass/fail test suite that production adapters must clear
- **Golden paths** — documented, executable end-to-end workflows for common automation scenarios
- **Reusable adapters** — adapters are standalone, composable, and testable outside the operator
- **Backward compatibility** — existing callers of the operator service continue to work without modification

## Non-Goals

- Rewriting the operator service from scratch
- Building a custom browser engine
- Replacing Playwright or browser-use internals
- Inventing new automation primitives where existing tools suffice
