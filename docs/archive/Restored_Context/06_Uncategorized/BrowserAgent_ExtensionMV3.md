# Allternit Browser Agent — Chrome Extension (Manifest V3) Spec

## Goal
Provide a **high-permission, agentic extension** with:
- Side Panel control surface
- Page context capture (no URL pasting)
- Structured action execution via Action Contract
- Policy gating via Allternit Law Layer
- Evidence receipts via Receipts schema

The extension is an **external surface**. It must not be the primary long-running autonomy engine.

---

## Architecture

### Components
1. **Side Panel UI**
   - Chat/commands
   - Context stack (page snapshots, selections, artifacts)
   - Run controls: Start / Pause / Stop / Confirm
   - Receipt viewer

2. **Service Worker (MV3)**
   - Session routing, state persistence
   - Message bus between side panel and content scripts
   - Transport to Allternit runtime (local-first, optional remote)
   - Alarm-based rehydration for suspended worker scenarios

3. **Content Script**
   - Page sensor: DOM extraction, selection capture, table/form extraction
   - Page actuator: executes BrowserAction steps
   - Evidence capture: DOM hashes/snippets; screenshots (via extension APIs where supported)

---

## Permissions Strategy

### Required capabilities
- Side panel: `sidePanel`
- Tab access: `tabs`
- Script injection: `scripting`
- Active tab: `activeTab`
- Storage: `storage`

### Optional capabilities (enable only if required)
- Downloads: `downloads`
- Clipboard: `clipboardRead`, `clipboardWrite`

### Host permissions
High-permission mode may require broad host access.
Recommended posture:
- Use `optional_host_permissions` and prompt “Enable on this site”.
- Maintain an **Allternit host allowlist** that is stricter than Chrome permissions.

---

## Transport to Allternit Runtime

### Mode A (preferred): local-first
- The extension calls `http://127.0.0.1:<port>` to a running Allternit runtime.
- Use a session token exchanged via a local pairing flow (QR or code).

### Mode B: remote relay
- The extension communicates with an Allternit relay for users without local runtime.
- Requires strong auth, rate limits, and enterprise policy options.

Hybrid is allowed: local when available, fallback to remote.

---

## Action Execution

### Single source of truth
Extension must execute actions using:
- `ActionContract.schema.json`
- `Receipts.schema.json`
- `PolicyTiers.md`

No ad hoc automation logic is permitted outside the contract.

### Run model
- Runs are **step-bounded** (step budget + time budget).
- Every step yields a receipt.
- Any Tier 3/4 step requires ConfirmGate and explicit user confirmation.

---

## Security Requirements

### CSP / Code Integrity
- Strict CSP. No remote code. No eval/new Function.
- Site adapters are **data-only**, never executable JS.
- Signed policy bundles (host allowlists, tier rules) are fetched from Allternit runtime.

### Prompt Injection Controls
- Never convert page text directly into actions.
- Pipeline is: capture → plan → policy check → execute → receipt.

### Redaction
- Mask sensitive inputs in:
  - DOM snippets
  - screenshots (overlay masks)
- Store only hashed DOM snapshots where feasible.

---

## Data Model

### Stored state (chrome.storage.local)
- paired runtime endpoint(s)
- host allowlist cache (signed)
- run checkpoints (tabId, stepIndex, lastReceiptHash)
- last N receipts per run (bounded)

---

## Minimum Viable Implementation (v1)
- Side panel UI
- Capture: URL/title/selection/DOM hash + bounded snippet
- Actions: navigate/click/type/wait/assert/extract table
- ConfirmGate for Tier 3+
- Receipts persisted and streamed to Allternit runtime
