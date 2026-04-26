Design 1 — Allternit ShellUI Native Agentic Browser Engine

1) Objective

Make the ShellUI browser tab the primary agentic browsing environment: deterministic, resumable, policy-gated, receipt-producing, DAG-driven.

This is not “a chatbot in a browser.” It is a controlled execution substrate that can (a) observe pages, (b) propose plans, (c) execute bounded steps, and (d) emit verifiable receipts.

⸻

2) Runtime topology (must match your HUMAN vs AGENT split)

Two renderers; one contract.
	•	HUMAN renderer: Electron BrowserView (interactive, user-driven)
	•	AGENT renderer: Playwright-controlled page (headless or hidden view) for automation runs
	•	Coordinator: Allternit runtime / orchestrator (DAG runner + policy engine + tool registry)

Core rule: agent actions execute only through the Action Contract below, never “ad hoc DOM poking.”

⸻

3) Core components

A) Browser Capsule (ShellUI)
	•	Tab container + navigation + session management
	•	Holds references to:
	•	HumanView (BrowserView)
	•	AgentView (Playwright context/page)
	•	SessionState (tabs, auth state, allowlists, per-site drivers, receipts)

B) Page Sensor Layer
Produces PageSnapshot objects:
	•	URL, title
	•	DOM text (bounded + hashed)
	•	semantic chunks (optional)
	•	screenshot (optional)
	•	structured extractions (tables, forms, key entities)
	•	risk signals (detected payment UI, login forms, destructive actions)

C) Action Engine
Executes BrowserAction steps with:
	•	preconditions + assertions
	•	retry rules
	•	timeouts
	•	deterministic selectors
	•	receipt output

D) Policy Engine (Law Layer binding)
Evaluates each proposed action:
	•	allow/deny/require-confirm
	•	scope checks (host allowlist, element allowlist, risk tier)
	•	tool permission tier mapping

E) Receipts + Replay Store
Every run emits:
	•	action log
	•	screenshots (optional)
	•	DOM diff (bounded)
	•	extracted artifacts
	•	final state summary
	•	cryptographic hashes for integrity (at minimum SHA256 on snapshots/artifacts)

⸻

4) Capability model (what it can do)

Capabilities are not “features.” They’re primitives.

Observation primitives
	•	capture.page() → PageSnapshot
	•	capture.selection() → SelectionSnapshot
	•	extract.table(selector|heuristic) → JSON
	•	extract.form(schema|heuristic) → JSON
	•	capture.screenshot(region|full) → image

Action primitives
	•	navigate(url)
	•	click(selector)
	•	type(selector, value)
	•	select(selector, option)
	•	scroll(target)
	•	waitFor(selector|networkIdle|textPresent)
	•	assert(condition) (DOM presence, text, url match, value match)
	•	download(expectation) (file name/type + hash)

Governance primitives (agent supervision)
	•	requireConfirm(reason, riskTier, summary) → user/owner gate
	•	pause() / stop() / rollback() (rollback limited to navigation + form resets; never promise full undo)

⸻

5) Action Contract (the heart of determinism)

All agent actions use one schema so you can validate, log, replay.

BrowserAction
	•	id: string
	•	type: enum (Navigate|Click|Type|Select|Scroll|Wait|Assert|Extract|Screenshot|Download|ConfirmGate)
	•	target: selector object
	•	strategy: css|xpath|text|aria|role|semantic
	•	value: string
	•	fallbacks: array of selectors
	•	stability: score / hints (optional)
	•	inputs: object (text value, select value, etc.)
	•	preconditions: array of assertions
	•	postconditions: array of assertions
	•	riskTier: 0–4 (see below)
	•	timeoutMs
	•	retries
	•	evidence: what to capture (screenshot, dom snippet, table extract)
	•	policyTags: e.g. money_movement, account_change, publish, purchase

Receipt
	•	actionId
	•	status: success|fail|blocked|needs_confirm
	•	startedAt, endedAt
	•	observations: url/title before+after, selector resolved, element attributes hash
	•	artifacts: screenshot hashes, extracted JSON hashes, downloaded file hashes
	•	error: structured failure reason
	•	trace: minimal execution trace

⸻

6) Risk tiers (non-negotiable)

This is what prevents Perplexity-style legal/trust blowups and makes automation defensible.
	•	Tier 0: Read-only (capture/extract/screenshot)
	•	Tier 1: Low-impact UI (navigate, scroll, open panels)
	•	Tier 2: Form fill without submission (type/select) — no final commit
	•	Tier 3: Submission/publish/purchase/place-order/transfer — requires explicit confirm
	•	Tier 4: Credential changes, payment methods, irreversible account ops — confirm + secondary guard (typed “CONFIRM”) or similar

Tie these tiers directly into your Law Layer and WIH.

⸻

7) Site scope model

Default-deny is the only scalable posture.
	•	Host allowlist per project/workspace
	•	Optional path allowlist (e.g., only /trade, /orders)
	•	Optional element allowlist for high-risk sites (only interact with elements under known containers)
	•	Driver packs (“site adapters”) are explicitly versioned and signed/hashed

⸻

8) Execution model: DAG-first, step-bounded
	•	A DAG node can request browser actions via the Action Contract
	•	The engine executes with a step budget and time budget
	•	Suspends/resumes by persisting:
	•	current URL
	•	action pointer
	•	snapshots + receipts
	•	session tokens (where allowed) or requires re-auth

⸻

9) Outputs (how this integrates with Allternit artifacts)

Native browser agent can trigger:
	•	generate PDF
	•	generate XLSX
	•	generate PPTX
	•	export extracted tables → CSV/JSON
	•	attach receipts to WIH evidence folder

The browser is a sensor/actuator; file generation remains in your Allternit runtime toolchain.

⸻

10) Minimum v1 build checklist
	•	Browser tab with HUMAN view
	•	AgentView Playwright context attached to same session domain (or parallel login)
	•	Action Contract + receipts store
	•	Policy gates + host allowlist
	•	Side panel “Run / Pause / Stop / Confirm” controls
	•	Context capture (page/selection/screenshot)
	•	5–8 core actions (navigate/click/type/wait/assert/extract table)

⸻

⸻

Design 2 — High-Permission Chrome Extension (External Agent Surface)

1) Objective

Deliver Claude-in-Chrome class functionality:
	•	persistent side panel
	•	auto-context from current tab
	•	guided, policy-gated action execution
	•	receipts streamed back to Allternit

This is the compatibility bridge when the user is not inside the Allternit ShellUI browser tab.

⸻

2) Architecture

MV3 extension with three planes:

A) Side Panel UI (control plane)
	•	chat/run UI
	•	context stack
	•	approvals
	•	receipts viewer

B) Service Worker (router + state)
	•	session management
	•	message bus between UI and content scripts
	•	storage, retries, alarms
	•	transport to Allternit runtime (local or remote)

C) Content Script (page sensor + actuator)
	•	reads DOM, selection, forms
	•	executes BrowserAction steps (same contract as native browser)
	•	captures receipts (screenshots require extension API + permissions)

⸻

3) Permissions strategy (high-permission, but controlled)

You will need broad powers; the trick is minimizing perceived risk and maximizing control.

Likely required
	•	sidePanel
	•	tabs
	•	scripting
	•	activeTab
	•	storage
	•	downloads (optional)
	•	clipboardRead / clipboardWrite (optional, be careful)
	•	Host permissions: either <all_urls> or dynamically granted per-site

Recommended posture
	•	Ask for broad permission only if you accept lower install conversion.
	•	Prefer optional_host_permissions + “Enable on this site” onboarding.
	•	Enforce host allowlists from Allternit policy regardless of Chrome permissions.

⸻

4) Same Action Contract, same Receipts

Do not fork logic between native browser and extension.
	•	Extension executes BrowserAction steps
	•	Receipts are identical format
	•	Allternit runtime can replay/verify logic regardless of surface

⸻

5) Transport: extension ↔ Allternit runtime

Two viable modes:

Mode A: Local-first (preferred)
	•	Extension calls http://127.0.0.1:<port> to Allternit runtime
	•	Pros: no API keys, sovereignty, fast
	•	Cons: install requires local runtime running; CORS and auth must be handled

Mode B: Remote relay
	•	Extension talks to Allternit cloud relay
	•	Pros: works anywhere
	•	Cons: cost, keys, security surface

Hybrid: local when available, else remote.

⸻

6) Security model (must-have)

High-permission extension is a high-value target. You need hard controls:
	•	Signed policy bundles from Allternit runtime (host allowlist, risk gates, tool tiers)
	•	No arbitrary code execution in content scripts beyond your shipped logic
	•	Content Security Policy strict (no remote eval)
	•	Action tier gating identical to native browser
	•	Prompt injection resistance: never let page text directly become tool calls; always go through:
	•	parse → classify → propose actions → policy check → execute

⸻

7) Agent loop behavior in extension (MV3 realities)

MV3 service workers can suspend. Therefore:
	•	Keep long runs primarily in content script (which stays alive while the tab is open)
	•	Persist state frequently:
	•	current step index
	•	last snapshot hash
	•	last receipt
	•	Use chrome.alarms to rehydrate if needed
	•	Step budgets + user-visible run state (never “silent background automation”)

⸻

8) UX affordances (copy Claude, improve safety)
	•	Side panel with:
	•	“Observe” (Tier 0)
	•	“Assist” (Tier 1–2)
	•	“Act” (Tier 3–4 gated)
	•	Inline overlays:
	•	highlight element to be clicked/typed into
	•	show “Agent intends to click X”
	•	Confirm gates:
	•	show summary (“You are about to submit an order: …”)
	•	require explicit click in panel (and optionally the actual site button click must be user-driven for Tier 3+)

⸻

9) Site adapters (optional but inevitable)

If you want reliability on complex sites (brokerage, e-commerce, docs), you will need adapters.

Adapter format:
	•	versioned package
	•	selectors + heuristics
	•	extraction templates
	•	risk annotations (what is “submit”, “buy”, “sell”, “transfer”)

Adapters are loaded from Allternit as data, not code (no remote JS). The content script interprets them.

⸻

10) Minimum v1 build checklist
	•	MV3 extension with side panel
	•	Content script capture: url/title/selection/dom chunk
	•	Content script actions: click/type/wait/assert
	•	Receipts: screenshots + DOM snippet hashes
	•	Local runtime transport
	•	Allowlist + tier gating enforcement
	•	Manual confirm for Tier 3+

⸻

⸻

The lock-in decision in one line
	•	ShellUI native browser tab = primary sovereign agentic browser (full control, best reliability).
	•	Chrome extension = high-permission external surface using the exact same action/receipt/policy contract.
