# GIZZI_STATE_MODEL.md
**What Gizzi (Runner) Must Persist, What Can Be Recomputed, and Why**
_version 1.0 — identity law_

---

## 0. Purpose

This document defines the **identity boundary of Gizzi**.

It answers:
- What state *must* persist for Gizzi to remain the same entity
- What state *must not* persist to avoid corruption or drift
- How determinism, replay, and safety are preserved

If this document is violated, Gizzi loses identity.

---

## 1. Core Principle

> **Gizzi’s identity is defined by persisted state + versioned interpreters.**

Not by:
- prompts
- UI state
- transient caches
- model weights
- running processes alone

---

## 2. Categories of State

All system state falls into exactly one category:

1. **Authoritative Persisted State** (identity-critical)
2. **Derived Persistent State** (convenience)
3. **Ephemeral Runtime State** (never persisted)
4. **Recomputable State** (safe to discard)

Mixing these categories causes corruption.

---

## 3. Authoritative Persisted State (MUST persist)

These define Gizzi as a continuous executive entity.

### 3.1 Journal (Single Source of Truth)

**Role**
- Immutable record of what Gizzi did and why

**Properties**
- Append-only
- Time-ordered
- Content-addressed references

**Minimum fields**
- event_id
- timestamp
- run_id
- capsule_id
- actor (ui | cli | tui | system)
- event_type
- payload_hash
- interpreter_versions

**Storage**
- MVP: JSONL per run
- v1+: SQLite with append-only semantics

> If the journal is lost, Gizzi cannot explain itself.

---

### 3.2 Capsule Store

Capsules represent ongoing projects and intent continuity.

**Per capsule**
- capsule_id
- goal (canonical)
- evidence_ids[]
- current_data_model (structured JSON)
- latest_capsule_spec_hash
- provenance (run_ids, timestamps)

Capsule state is **authoritative**, not UI.

---

### 3.3 Evidence Store

Evidence is the factual substrate of reasoning.

**Per evidence item**
- evidence_id
- kind (web, doc, note, artifact, diff, log)
- source_uri or path
- snapshot_hash
- extracted_schema_summary
- metadata (size, mime, ts)

Evidence must be immutable once stored.

---

### 3.4 Artifact Store

Artifacts are outputs of execution.

**Examples**
- screenshots
- generated files
- command outputs
- intermediate results

**Rules**
- Content-addressed (sha256)
- Immutable
- Referenced by journal only

Artifacts are never edited in place.

---

### 3.5 Policy + Skill Registry Version

Gizzi must remember:
- which skills existed
- what their safety classes were
- what policies were active

This enables:
- forensic audit
- safe replay
- accountability

---

## 4. Derived Persistent State (MAY persist)

These may be stored for performance or UX, but are not identity-defining.

Examples:
- last-opened capsule
- UI layout preferences
- pagination cursors
- search indexes

Rules:
- Can be dropped at any time
- Must be reconstructible from authoritative state
- Must not affect execution decisions

---

## 5. Ephemeral Runtime State (MUST NOT persist)

These must never define identity.

Examples:
- in-memory caches
- active websocket connections
- process IDs
- temporary file handles
- live browser processes

Persisting these creates phantom state.

---

## 6. Recomputable State (SAFE TO DISCARD)

These are intentionally transient.

Examples:
- kernel plans
- compiled CapsuleSpecs
- UI patches
- reasoning summaries

Rules:
- Always reproducible from journal + capsule state
- May be cached, but never trusted

---

## 7. Hash Discipline (Non-Optional)

All large data must be:
- stored once
- referenced by hash

Journal entries store:
- hashes
- metadata
- never raw blobs

This prevents:
- silent mutation
- drift
- replay mismatch

---

## 8. Restart & Recovery Model

On restart, Gizzi:
1. Loads policy + registry version
2. Replays journal metadata
3. Rehydrates capsule store
4. Rebuilds indexes/caches
5. Resumes accepting intents

No execution resumes mid-step without journal confirmation.

---

## 9. Upgrade Safety Rule

> **State format upgrades require explicit migrators.**

- No in-place mutation
- Old state remains readable
- New interpreters handle old data

Identity continuity > feature velocity.

---

## 10. Non-Negotiable Invariants

- Journal is append-only
- Capsules are authoritative
- Evidence is immutable
- Artifacts are content-addressed
- Ephemeral state never defines behavior

If any invariant breaks, execution must halt.

---

## 11. Mental Model (One Line)

> Gizzi remembers *what happened*, not *what it was thinking*.

Thinking can be redone.  
Actions cannot.

---

### Status
This document is **Tier-0 identity law**.
