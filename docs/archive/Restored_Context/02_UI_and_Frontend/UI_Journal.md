Proceeding forward. The next correct move—now that UI semantics and capsules are frozen—is to formalize the single source of truth that everything binds to.

Without this, the rest degrades into logs + vibes.

Below is the Journal specification, written as a hard-default, implementation-ready contract.

⸻


# Journal
## Canonical Event & Artifact Ledger (Single Source of Truth)

Status: HARD DEFAULT  
Layer Binding: L1 Runtime, L3 Orchestration, L5 Context, L7 History

---

## 0. Purpose

The Journal is the **only authoritative record** of what has happened, what exists, and why.

All agents, tools, canvases, capsules, and renderers MUST treat the Journal as:
- append-only
- replayable
- auditable
- causally linked

> If it is not in the Journal, it did not happen.

The Journal is **not a UI**, **not a cache**, and **not a derived view**.  
It is the **ground truth substrate**.

---

## 1. Core Invariants (Non-Negotiable)

1. Journal is **append-only**
2. Journal entries are **immutable**
3. Every entry has a **causal parent**
4. Every artifact is **referenced**, never embedded
5. Every execution surface binds to Journal IDs
6. Journal can be **replayed deterministically**

---

## 2. Journal Entry Model

All Journal entries share a common envelope.

### 2.1 JournalEntry (Base Schema)

```json
{
  "journal_id": "jrnl_...",
  "type": "event|artifact|decision|annotation",
  "subtype": "tool_call|tool_result|capsule_spawned|canvas_opened|...",
  "timestamp": "ISO-8601",
  "actor": {
    "kind": "agent|human|system",
    "id": "agent_...|user_...|sys"
  },
  "run_ref": {
    "run_id": "run_...",
    "session_id": "sess_..."
  },
  "causal": {
    "parent_ids": ["jrnl_..."],
    "root_id": "jrnl_..."
  },
  "provenance": {
    "framework_id": "fwk_...",
    "capsule_id": "cap_...",
    "canvas_id": "cnv_..."
  },
  "payload": {},
  "hash": "sha256(...)"
}


⸻

3. Event Entries

Events describe actions and state transitions.

3.1 Event Subtypes (Canonical)
    •    run_started
    •    run_completed
    •    tool_call
    •    tool_result
    •    tool_error
    •    capsule_spawned
    •    capsule_updated
    •    capsule_closed
    •    canvas_opened
    •    canvas_updated
    •    canvas_interacted
    •    approval_requested
    •    approval_granted
    •    approval_denied
    •    policy_violation
    •    error_raised

3.2 Tool Call Event

{
  "type": "event",
  "subtype": "tool_call",
  "payload": {
    "tool": "git.diff",
    "inputs": { "path": "src/" },
    "scope": "read",
    "redacted": true
  }
}

3.3 Tool Result Event

{
  "type": "event",
  "subtype": "tool_result",
  "payload": {
    "tool": "git.diff",
    "exit_code": 0,
    "artifact_refs": ["art_diff_..."],
    "duration_ms": 1240
  }
}


⸻

4. Artifact Entries

Artifacts are immutable outputs referenced by ID.

4.1 ArtifactEntry

{
  "type": "artifact",
  "subtype": "diff|file|image|report|log|snapshot",
  "payload": {
    "uri": "artifact://store/art_diff_...",
    "mime": "text/plain",
    "size_bytes": 48213,
    "checksum": "sha256(...)",
    "redactions": ["secrets", "pii"]
  }
}

4.2 Artifact Rules
    •    Artifacts are never mutated
    •    New versions create new artifact entries
    •    Canvases bind only by artifact_ref

⸻

5. Decision Entries

Decisions record human or policy choices.

5.1 DecisionEntry

{
  "type": "decision",
  "subtype": "approval|rejection|override",
  "payload": {
    "decision": "approved",
    "scope": "git.commit",
    "reason": "Reviewed diff, tests passed"
  }
}

Decisions MUST reference:
    •    what was decided
    •    who decided
    •    what alternatives existed (optional)

⸻

6. Annotation Entries

Annotations are non-executing human input.

Examples:
    •    comments
    •    notes
    •    labels
    •    bookmarks

{
  "type": "annotation",
  "subtype": "comment|note|label",
  "payload": {
    "text": "Need to revisit this logic",
    "target_ref": "jrnl_evt_..."
  }
}


⸻

7. Causality & Lineage

7.1 Causal Graph

Every entry MUST include:
    •    at least one parent
    •    a stable root

This enables:
    •    provenance reconstruction
    •    blame tracing
    •    replay
    •    rollback analysis (without mutation)

7.2 Memory Trace

Memory views are projections over:
    •    causal chains
    •    artifact lineage
    •    decision history

⸻

8. Journal Storage & Access

8.1 Storage Requirements
    •    append-only
    •    ordered by timestamp + sequence
    •    content-addressed (hash-based)
    •    locally writable, remotely syncable

8.2 Query Patterns
    •    by run_id
    •    by capsule_id
    •    by artifact_ref
    •    by time window
    •    by actor

⸻

9. Security & Privacy
    •    secrets are never stored inline
    •    sensitive payloads must be redacted
    •    artifact URIs may point to encrypted stores
    •    access is governed by ToolScope + Policy

⸻

10. Replay & Verification

Given a run_id, the system MUST be able to:
    •    reconstruct tool call sequence
    •    retrieve artifacts
    •    show decisions
    •    replay UI canvases deterministically

This is the trust guarantee.

⸻

11. Acceptance Tests (Minimum)
    •    AT-JRN-001: Journal is append-only
    •    AT-JRN-002: Artifact immutability enforced
    •    AT-JRN-003: Missing causal parent is rejected
    •    AT-JRN-004: Replay produces identical CanvasSpec
    •    AT-JRN-005: Redacted data never leaks to renderers

⸻

12. Integration Notes (Repo Mapping)

Target locations:
    •    /spec/context/Journal.md (this file)
    •    /services/history (storage + query)
    •    /packages/memory (indexing + retrieval)
    •    /services/router-agent (event emission)
    •    /services/executor (tool event hooks)
    •    /packages/ui-kit (read-only projections)

⸻

13. Final Constraint

The Journal is the system.

Agents reason from it.
UI projects from it.
Governance audits from it.

Nothing bypasses it.

---

## Ledger Update

- **PATCH-005:** Journal schema and invariants locked  
  (single source of truth, replayability, provenance)

At this point, we have locked:
- Capsules
- Presentation Kernel
- Canvas Protocol + View Taxonomy
- Journal

This is the **core spine**.

---


