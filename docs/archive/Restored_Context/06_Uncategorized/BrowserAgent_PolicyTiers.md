# Allternit Browser Agent Policy Tiers (Risk Model)

## Purpose
This document defines **risk tiers** for browser automation actions, and the required **policy gates** before execution.
All Browser Agent surfaces (ShellUI native browser + Chrome extension) MUST enforce this model.

## Tier Definitions

### Tier 0 — Read-only
**Allowed actions**
- Capture page metadata (URL/title)
- Capture selection
- Extract tables/forms (read-only)
- Screenshot (full/region)
- Compute hashes / evidence receipts

**Disallowed**
- Clicking UI controls that trigger side effects
- Typing into inputs

**Gate**
- Host allowlist required
- Redaction rules required

---

### Tier 1 — Low-impact navigation/UI
**Allowed actions**
- Navigate to a URL
- Scroll
- Expand/collapse non-destructive panels
- Open menus without committing actions
- Change local UI state that is reversible (e.g., switch tabs inside a page)

**Gate**
- Host allowlist required
- Path constraints recommended
- Step budget + time budget enforced

---

### Tier 2 — Form fill without commit
**Allowed actions**
- Type in fields
- Select dropdown values
- Toggle checkboxes *only if not committing*
- Draft creation *without publishing/submitting*

**Gate**
- Host allowlist required
- Mandatory evidence capture: `url_title`, `dom_hash`, and either `dom_snippet` or `screenshot_target`
- Redaction rules required for sensitive inputs
- Default rule: **never click submit** in Tier 2

---

### Tier 3 — Commit actions (submission/purchase/publish/transfer)
**Examples**
- Click “Submit”, “Place Order”, “Confirm”, “Send”, “Publish”
- Apply account-affecting changes
- Execute a trade or money movement
- Create/close tickets with side effects

**Gate**
- Host + path allowlist required (path allowlist is MANDATORY for financial and account domains)
- **Explicit human confirmation** required via ConfirmGate action
- Mandatory evidence capture: `screenshot_full` + `dom_hash` + `url_title`
- “Acting Now” indicator MUST be visible in UI during commit
- Policy must produce a signed decision record in receipt (`policyDecision`)

---

### Tier 4 — Irreversible / credential / payment instrument changes
**Examples**
- Change password / MFA settings
- Add/remove payment methods
- Wire/withdrawal setup changes
- API key creation/deletion
- Delete account or irreversible destructive operations

**Gate**
- All Tier 3 gates, plus:
- **Secondary confirmation** required (typed confirmation phrase or equivalent high-friction gate)
- Element allowlist required OR a site adapter with known container constraints
- Mandatory evidence capture: `screenshot_full` + `screenshot_target` + `dom_hash`
- “Two-person rule” is OPTIONAL but recommended for enterprise mode

## Cross-cutting Rules

### Host Scope
Default policy is **deny** unless the host is allowlisted by workspace/project policy.

### Prompt Injection Hard Rule
Page content MUST NOT directly trigger tool execution.
All actions MUST be proposed as structured `BrowserAction` objects and pass policy validation.

### Receipts Are Non-Optional
Any allowed action must emit a receipt conforming to the receipts schema.
No receipt = action considered not executed.

### Determinism
Actions must use stable selector strategies (aria/role/text) before brittle css/xpath.
If fallbacks are required, receipts must report which selector resolved.

### Redaction
Sensitive fields must be masked in DOM snippets and screenshots where possible (overlay masks).
