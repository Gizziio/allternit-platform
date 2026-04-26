# Allternit Computer Use — Capability Matrix

**Version:** v0.2
**Last updated:** 2026-03-14

## Purpose

This document is the normative source for:
- adapter classification
- deterministic routing decisions
- promotion gate requirements
- conformance targets
- future adapter onboarding

---

## Core Model — Three Dimensions

### 1. Family — where work happens

| Family | Description |
|--------|-------------|
| `browser` | Interactive web automation |
| `retrieval` | Non-interactive crawl and extraction |
| `desktop` | Native OS and GUI automation |
| `hybrid` | Cross-family workflow orchestration |

### 2. Mode — how execution is run

| Mode | Description |
|------|-------------|
| `execute` | Run an action (goto, click, extract, act) |
| `inspect` | Read-only debug (DOM, console, network, devtools) |
| `parallel` | Fan-out across multiple instances |
| `desktop` | Native desktop interaction |
| `assist` | User-present: agent suggests, human confirms |
| `crawl` | Systematic multi-page traversal and extraction |
| `hybrid` | Orchestrated cross-family workflow |

### 3. Pattern — how automation is performed

| Pattern | Description |
|---------|-------------|
| `deterministic` | Stable, scripted, exact — selector-driven |
| `adaptive` | LLM-assisted, semantic, tolerates UI drift |
| `orchestrated-hybrid` | Multi-surface, cross-family, artifact-chained |

---

## Routing Principles

| ID | Rule |
|----|------|
| RP-1 | **Lowest-complexity first.** Prefer deterministic → adaptive → orchestrated-hybrid |
| RP-2 | **Production before experimental.** production → beta → experimental |
| RP-3 | **Single-family before hybrid.** Don't escalate to hybrid if task fits one family |
| RP-4 | **Policy before capability.** Any adapter rejected by policy is removed before ranking |
| RP-5 | **Deterministic for stable tasks.** Known selectors, repeatable workflows → deterministic |
| RP-6 | **Adaptive only when needed.** Selector drift, unknown structure, semantic extraction |
| RP-7 | **Hybrid only when boundaries are crossed.** browser + desktop + artifacts + approvals |

---

## Adapter Capability Matrix

| Adapter | Family | Pattern | Primary Modes | Status |
|---------|--------|---------|---------------|--------|
| `browser.playwright` | browser | deterministic | execute, inspect, parallel | production |
| `browser.browser-use` | browser | adaptive | execute | beta |
| `browser.cdp` | browser | deterministic | inspect | beta |
| `browser.extension` | browser | adaptive | assist | experimental |
| `retrieval.playwright-crawler` | retrieval | deterministic | crawl, execute, inspect | experimental |
| `desktop.pyautogui` | desktop | deterministic | desktop, execute, inspect | beta |
| `hybrid.orchestrator` | hybrid | orchestrated-hybrid | hybrid, execute | experimental |

### v0.3 Planned

| Adapter | Family | Pattern | Status |
|---------|--------|---------|--------|
| `browser.lightpanda` | browser | deterministic | planned — fast headless pool |
| `retrieval.cloudflare-crawl` | retrieval | deterministic | planned — managed crawl |
| `desktop.ui-tars` | desktop | adaptive | planned — VLM-driven desktop |
| `hybrid.download-upload-flow` | hybrid | orchestrated-hybrid | planned — artifact pipeline |

---

## Operational Traits

| Adapter | Headless | Headed | Parallel | Persist Session | Visual Reasoning | Low-Level Debug | Checkpointable |
|---------|:--------:|:------:|:--------:|:---------------:|:----------------:|:---------------:|:--------------:|
| `browser.playwright` | yes | yes | yes | yes | no | partial | partial |
| `browser.browser-use` | yes | yes | limited | yes | medium | low | partial |
| `browser.cdp` | yes | yes | limited | yes | no | high | low |
| `browser.extension` | no | yes | low | yes | low | low | low |
| `retrieval.playwright-crawler` | yes | no | high | no | no | low | high |
| `desktop.pyautogui` | no | yes | low | low | low | low | low |
| `hybrid.orchestrator` | mixed | mixed | medium | medium | mixed | medium | medium |

---

## Guarantee Grade Matrix

Grades: `A` strong · `B` acceptable · `C` weak · `X` unverified

| Adapter | G1 Semantic | G2 Policy | G3 Receipt | G4 Conformance | G5 Routing |
|---------|:-----------:|:---------:|:----------:|:--------------:|:----------:|
| `browser.playwright` | A | A | A | A | A |
| `browser.browser-use` | B | A | B | B | B |
| `browser.cdp` | B | A | B | B | B |
| `browser.extension` | B | B | B | C | B |
| `retrieval.playwright-crawler` | A | A | A | B | A |
| `desktop.pyautogui` | B | B | B | B | B |
| `hybrid.orchestrator` | B | A | A | B | A |

---

## Promotion Gates

### Experimental → Beta
- manifest complete (all required fields present)
- contract wrapper complete (BaseAdapter implemented)
- basic receipts emitted on every action
- basic tests pass (unit + integration)

### Beta → Production
- conformance suite passes ≥ 90% (production grade)
- policy behavior verified (all G2 rules enforced)
- golden path passes end-to-end
- telemetry normalized (all fields emitted)
- fallback behavior verified (triggers correctly, not silent)

---

## Default Mode Mapping

| Mode | Primary Family | Primary Adapter | Fallback |
|------|---------------|-----------------|----------|
| `execute` | browser | `browser.playwright` | `browser.browser-use` |
| `inspect` | browser | `browser.cdp` | `browser.playwright` |
| `parallel` | browser | `browser.playwright` | — |
| `desktop` | desktop | `desktop.pyautogui` | — |
| `assist` | browser | `browser.extension` | `browser.playwright` |
| `crawl` | retrieval | `retrieval.playwright-crawler` | — |
| `hybrid` | hybrid | `hybrid.orchestrator` | — |

---

## Pattern Selection Rules

**Use deterministic when:**
- workflow is stable and repeatable
- selectors are known and stable
- conformance and auditability matter
- speed matters

**Use adaptive when:**
- DOM drift or layout variance exists
- task is semi-structured or exploratory
- extraction requires semantic reasoning
- deterministic path failed

**Use orchestrated-hybrid when:**
- task requires browser + desktop + artifacts
- human approval checkpoints are needed
- task cannot complete within a single family

---

## Experimental Adapter Rules

Experimental adapters:
- are **never default** unless policy explicitly permits
- carry a routing penalty (fallback_rank ≥ 80)
- are **never auto-selected** over production/beta
- may only be chosen when:
  - policy permits via explicit opt-in
  - task explicitly requests adapter by ID
  - no stronger candidate exists in family

---

## Change Control

Every new adapter must update:
1. adapter manifest (`adapter.manifest.json`)
2. this capability matrix
3. conformance target (suite + test count)
4. routing selector (adapter-selector.py)
5. adapter-grades.json

No adapter is routable until all five are present.
