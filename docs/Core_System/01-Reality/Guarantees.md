# Allternit Computer Use — Guarantees

**Version:** v0.1 Foundation
**Last updated:** 2026-03-14

Five guarantees. Each independently verifiable.

---

## G1 — Semantic Guarantee

Every adapter returns the same result envelope.

### v0.1 Required fields

| Field              | Type                              |
|--------------------|-----------------------------------|
| `run_id`           | string                            |
| `session_id`       | string                            |
| `adapter_id`       | string                            |
| `family`           | `browser \| desktop`              |
| `mode`             | `execute \| inspect \| parallel \| desktop` |
| `action`           | `goto \| observe \| act \| extract \| screenshot \| eval \| inspect` |
| `target`           | string                            |
| `status`           | `pending \| running \| completed \| failed \| cancelled` |
| `artifacts`        | list of artifact references       |
| `receipts`         | list of receipt IDs               |
| `policy_decisions` | list of policy decision records   |
| `trace_id`         | string                            |
| `fallbacks_used`   | list of adapter_ids attempted before success |

### v0.2 Planned additions

| Field    | Values to add |
|----------|---------------|
| `family` | `retrieval`, `hybrid` |
| `mode`   | `assist`, `crawl`, `hybrid` |
| `action` | `download`, `upload`, `handoff` |

### Testable

Every adapter's output can be deserialized into the result envelope schema without loss.

---

## G2 — Policy Guarantee

No adapter can bypass:

- **Domain restrictions** — denylist/allowlist enforced before any navigation or request.
- **Auth boundaries** — credential isolation; no adapter can access credentials outside its declared scope.
- **Destructive action approval gates** — explicit approval required for delete, submit, and payment actions.
- **Artifact/output location rules** — artifacts only written to declared paths.
- **Session isolation rules** — no cross-session data leakage.

### Testable

Conformance suite F (routing/policy) includes tests for each bypass scenario. All must be blocked.

---

## G3 — Receipt Guarantee

Every significant action emits a receipt containing:

| Field                 | Required | Description                              |
|-----------------------|----------|------------------------------------------|
| `receipt_id`          | yes      | Unique receipt identifier                |
| `timestamp`           | yes      | ISO-8601 timestamp                       |
| `action_type`         | yes      | The action performed                     |
| `adapter_id`          | yes      | Adapter that performed the action        |
| `target`              | yes      | Target of the action                     |
| `before_evidence`     | no       | DOM hash, screenshot hash before action  |
| `after_evidence`      | no       | DOM hash, screenshot hash after action   |
| `integrity_hash`      | yes      | SHA-256 of action + result               |
| `policy_decision_id`  | yes      | Link to the authorizing policy decision  |

### Testable

No golden path step completes without at least one receipt emitted. Receipt `integrity_hash` is independently verifiable.

---

## G4 — Conformance Guarantee

An adapter is only production-grade if it passes the Allternit conformance suite for its declared capability class.

### v0.1 Conformance suites (implemented)

| Suite | Scope              | Tests | Status |
|-------|--------------------|-------|--------|
| A     | Browser deterministic | 8   | Implemented |
| D     | Desktop            | 4     | Implemented |
| F     | Routing/policy     | 6     | Implemented, 6/6 pass |

### v0.2 Conformance suites (planned)

| Suite | Scope              | Status |
|-------|--------------------|--------|
| B     | Browser adaptive   | Planned |
| C     | Retrieval          | Planned |
| E     | Hybrid             | Planned |

### Grading

| Grade        | Pass rate |
|--------------|-----------|
| experimental | < 50%     |
| beta         | 50 – 89%  |
| production   | >= 90%    |

### Testable

Each adapter has a grading record. Only production-grade adapters are default-routable.

---

## G5 — Routing Guarantee

Routing is:

- **Deterministic** — same inputs produce the same adapter selection.
- **Explainable** — routing decision includes a human-readable reason.
- **Logged** — every route decision emitted as a receipt.
- **Policy-aware** — policy engine consulted before adapter selection.
- **Capability-aware** — only adapters with matching `capability_classes` are candidates.

### Route decision receipt fields

`family`, `mode`, `adapter_id`, `reason`, `fallback_chain`, `policy_decision_id`.

### Testable

Replay of identical inputs produces identical routing. No random model-only tool selection. No direct UI-to-adapter paths.
