# Allternit ShellUI — Native Agentic Browser Engine Spec

## Goal
The ShellUI browser tab is the **primary agentic browsing surface** for Allternit.
It enables deterministic, policy-gated browser automation integrated with DAG/WIH workflows.

---

## Renderer Separation (HUMAN vs AGENT)
- **HUMAN**: Electron BrowserView (interactive user browsing)
- **AGENT**: Playwright-controlled browser context/page (automation executor)

Both surfaces share:
- policy engine
- action contract
- receipts store
- host allowlists

---

## Core Subsystems

### 1) Session Manager
- Creates and manages browser sessions per workspace
- Tracks tabs, navigation history, and session-scoped allowlists
- Handles rehydration after restart

### 2) Page Sensor Layer
Produces `PageSnapshot`:
- url, title
- bounded DOM extraction (redacted)
- domHash (SHA256)
- screenshot optional
- structured extracts optional (tables/forms/entities)

### 3) Action Engine
Executes `BrowserAction` objects:
- resolves selectors using preferred strategies (aria/role/text)
- executes with retries/timeouts
- evaluates pre/post assertions
- emits receipts

### 4) Policy Engine (Law Layer binding)
Evaluates every proposed action:
- host/path/element allowlists
- risk tier gates (Tier 0–4)
- confirm requirements
- evidence requirements
- produces a signed decision record

### 5) Evidence Store
Writes artifacts in a deterministic layout:
- `/evidence/browser/<runId>/actions/<actionId>/...`
- `receipt.json`
- screenshots (png/webp)
- dom_snippet.txt (redacted)
- extracts.json
- downloaded files + hashes

---

## Execution Model

### DAG Integration
A DAG node may request a browser run:
- Create ContextPack from current tab
- Request a plan that produces a list of BrowserActions
- Execute actions step-by-step with receipts
- Attach evidence to WIH as immutable references

### Step/Time Budgets
- Default step budget: 25 actions
- Default time budget: 5 minutes
Budgets must be overridable by workspace policy.

### Suspend / Resume
Persist checkpoints:
- current url
- step index
- last domHash
- last receipt hash
- session identifiers
On resume, the engine must re-assert expected state (URL/title/element existence) before continuing.

---

## UX Requirements
- Visible “Agent Acting” indicator when executing
- Controls: Start / Pause / Stop / Confirm
- Confirm prompts must show:
  - action summary
  - risk tier
  - target host/path
  - evidence captured
  - what irreversible change may occur

---

## Security Requirements

### Default Deny
- No host allowed by default.
- Hosts must be allowlisted per workspace.

### Prompt Injection Hard Rule
Page content cannot directly trigger tool execution.
Only structured BrowserActions may execute after policy checks.

### Sensitive Data Redaction
- Mask selectors marked sensitive (password fields, cc fields, OTP)
- Never store plaintext secrets in evidence store
- Prefer hashes for DOM snapshots; store bounded redacted snippets only when required

---

## Minimum v1 Implementation
- HUMAN BrowserView tab
- AGENT Playwright executor
- ActionContract + Receipts schema enforcement
- Host allowlist + Tier gating
- Context capture (page/selection/screenshot)
- Core actions: navigate/click/type/wait/assert/extract table
- Evidence store + receipts viewer
