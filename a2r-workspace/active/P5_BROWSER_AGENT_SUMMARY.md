# P5: BROWSER AGENT SYSTEM - EXECUTIVE SUMMARY

**Date:** 2026-02-20  
**Source:** `/Users/macbook/Desktop/agenticbrowserext.md`, `/Users/macbook/Desktop/spec/BrowserAgent/`  
**Status:** DAG Tasks Created  
**Total Effort:** 17 weeks (including 2 weeks research)

---

## What Is The Browser Agent System?

A **deterministic, policy-gated browser automation system** integrated with A2R DAG/WIH workflows.

**Two Surfaces:**
1. **ShellUI Native Browser** - Primary sovereign agentic browser (Electron + Playwright)
2. **Chrome Extension MV3** - External high-permission surface (Side Panel + Content Script)

**Shared Infrastructure:**
- Action Contract (12 action types with JSON Schema)
- Receipts Schema (evidence, artifacts, trace events)
- Policy Tiers (Tier 0-4 risk model with ConfirmGate)
- Evidence Store (artifacts, receipts viewer)

---

## Why This Is Critical

**Current Gap:** A2R has NO browser automation capability.

**Impact:**
- Agents cannot interact with web applications
- No web-based data extraction
- No web-based workflow automation
- No browser-based evidence collection

**This is the single largest capability gap discovered.**

---

## DAG Tasks Created

**Full DAG:** `/docs/_active/P5_BROWSER_AGENT_DAG.md`

### P5.0: Research & Analysis (2 weeks) 🔴

**Research Required Before Implementation:**
- **P5.0.1:** ShellUI Browser Tab Research (4 days)
  - Audit existing ShellUI browser implementation
  - Document BrowserView capabilities
  - HUMAN vs AGENT renderer separation
- **P5.0.2:** MiniApp Capsules Research (4 days)
  - Audit existing capsule implementation
  - Browser capsule requirements
  - Integration approach
- **P5.0.3:** Playwright Integration Research (3 days)
  - Playwright browser automation capabilities
  - AGENT renderer requirements
  - Rust bindings approach
- **P5.0.4:** Evidence Store Research (3 days)
  - Audit existing evidence/receipts implementation
  - Browser-specific evidence requirements
  - Storage approach

**Deliverables:**
- `docs/research/SHELLUI_BROWSER_AUDIT.md`
- `docs/research/MINIAPP_CAPSULES_AUDIT.md`
- `docs/research/PLAYWRIGHT_INTEGRATION.md`
- `docs/research/EVIDENCE_STORE_AUDIT.md`

---

### P5.1: Browser Agent Core (4 weeks) 🔴

**Infrastructure:**
- Action Contract implementation (12 action types)
- Receipts Schema implementation
- Policy Tier gating (Tier 0-4)
- Page Sensor Layer (PageSnapshot generation)

---

### P5.2: ShellUI Native Browser (3 weeks) 🔴

**Implementation:**
- HUMAN BrowserView setup (tab container, session management)
- AGENT Playwright executor (action execution, sync)
- Evidence Store integration (artifact storage, receipts viewer)

---

### P5.3: Chrome Extension MV3 (3 weeks) 🟡

**Implementation:**
- Extension scaffold (MV3 manifest, permissions)
- Side Panel UI (chat, controls, receipts viewer)
- Content Script sensor/actuator
- Local transport (HTTP to A2R runtime)

---

### P5.4: DAG/WIH Integration (2 weeks) 🟡

**Integration:**
- DAG node browser actions
- WIH evidence attachment
- Evidence query API

---

### P5.5: Security Hardening (1 week) 🔴

**Security:**
- Prompt injection resistance
- Sensitive data redaction
- Default-deny enforcement

---

### P5.6: Site Adapters (Optional, 2 weeks) 🟢

**Optional:**
- Site adapter framework
- Initial adapters (brokerage, e-commerce, docs)

---

## Critical Path

**Minimum Viable Browser Agent (10 weeks):**
1. P5.0: Research (2 weeks)
2. P5.1: Core (4 weeks)
3. P5.2: ShellUI (3 weeks)
4. P5.5: Security (1 week)

**Full Implementation (17 weeks):**
- All phases complete
- Both surfaces (ShellUI + Extension)
- Site adapters optional

---

## Integration With Existing Systems

| System | Integration Point |
|--------|-------------------|
| **SYSTEM_LAW (P3.19)** | Policy Engine binding for browser actions |
| **Harness Engineering (P3.20)** | RiskPolicy integration, RiskTier mapping |
| **Memory Kernel (P4.10)** | Session state persistence |
| **Context Control (P4.8)** | Browser context bundles |
| **Autonomous Code Factory (P4.12)** | Site adapters as data (not code) |
| **Quality Score (P4.14)** | Browser automation quality metrics |

---

## Updated Overall Progress

**Previous:** 48/58 tasks (83%)  
**New P5 Tasks:** +22 tasks  
**New Total:** 48/80 tasks (60%)

| Phase | Tasks | Complete | Status |
|-------|-------|----------|--------|
| **P0** | 10 | 10 | ✅ 100% |
| **P1** | 13 | 13 | ✅ 100% |
| **P2** | 13 | 13 | ✅ 100% |
| **P3** | 7 | 7 | ✅ 100% |
| **P4** | 15 | 5 | 🔄 33% |
| **P5** | 22 | 0 | ⏳ 0% |
| **TOTAL** | **80** | **48** | **60%** |

---

## Next Steps

**Immediate:**
1. **Start P5.0 Research** (2 weeks)
   - ShellUI browser audit
   - MiniApp capsules audit
   - Playwright integration research
   - Evidence store research

**After Research:**
2. **P5.1 Core Implementation** (4 weeks)
3. **P5.2 ShellUI Implementation** (3 weeks)
4. **P5.5 Security Hardening** (1 week)

**Optional:**
5. **P5.3 Chrome Extension** (3 weeks)
6. **P5.4 DAG/WIH Integration** (2 weeks)
7. **P5.6 Site Adapters** (2 weeks)

---

## Recommendation

**Start P5.0 Research Immediately** because:
1. Research findings may change implementation approach
2. ShellUI/capsule audit may reveal existing capabilities
3. Playwright research may identify simpler integration
4. Evidence store audit may reduce duplication

**Do NOT start implementation before research complete.**

---

**End of Summary**
