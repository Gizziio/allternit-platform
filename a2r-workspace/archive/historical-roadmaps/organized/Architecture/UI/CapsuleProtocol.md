Yes — we will still generate new MDs as we progress. Your uploaded MDs are inputs; the system also needs derived specs (protocols, schemas, contracts, acceptance tests) that don’t exist yet but are required to make the repo deterministic and unified. This is exactly implied by your own “next concrete deliverables” callout (e.g., Presentation Kernel spec)  ￼.

Below is /spec/presentation/CapsuleProtocol.md (integration-ready). It encodes your correction: capsules are agent-generated, sandboxed, tab-like, and a first-class layer, with runtime scope + provenance.

# Capsule Protocol
## Agent-Generated Capsule Mini-Apps (Tab-Like, Sandboxed, Provenance-Bound)

Status: HARD DEFAULT  
Layer Binding: L0 Interfaces, L1 Runtime, L3 Orchestration, L5 Context, L8 Embodiment

---

## 0. Purpose

Define "Capsule Mini-Apps" as a first-class runtime + UI primitive:
- Capsules are **agent-generated** via approved **frameworks**, not user-authored "UGC apps".
- Capsules are **tab-like** (browser-tab metaphor) but each tab is a **sandboxed mini-app instance** with bounded tools, bindings, and provenance.
- Capsules are a **projection** of canonical truth (Journal + repo snapshot + run state), not parallel state.

This protocol standardizes:
- Capsule identity and lifecycle
- Capsule sandboxing and permissions
- Capsule-to-Canvas relationship
- Capsule framework registry (how agents are allowed to spawn capsules)
- Provenance requirements (auditability, replay)

---

## 1. Definitions

### 1.1 Capsule
A Capsule is a **sandboxed task surface** that bundles:
- UI intent (CanvasSpec set)
- tool permissions (ToolScope)
- bindings to truth (Journal artifacts/events, repo snapshot, run_id)
- sandbox rules (SandboxPolicy)
- provenance links (how it was produced, by whom, from what input)

**Canonical Form**
Capsule = CanvasBundle + ToolScope + DataBindings + SandboxPolicy + ProvenanceLink

### 1.2 Capsule Framework
A Capsule Framework is a registered template that defines:
- when a capsule can be spawned (intent patterns)
- what capsule spec is produced (default CanvasBundle + rules)
- what tools are required (and risk class)
- what acceptance tests must pass

Agents may only spawn Capsules through registered frameworks.

### 1.3 Canvas
A Canvas is a renderer-agnostic declarative view request:
- diff review, run view, timeline, table, search lens, etc.
- interaction affordances (approve, rerun, filter, export)
- risk/provenance decoration rules

A Capsule may include 1..N canvases.

---

## 2. Non-Goals

- Capsules are not long-lived "apps" with arbitrary custom code by default.
- Capsules do not bypass Tool Registry permissions.
- Capsules do not create hidden state that diverges from the Journal.
- Capsules do not require a specific renderer (TUI/Web/Orb); renderers implement the same spec.

---

## 3. Core Invariants (MUST)

### 3.1 Journal-Truth Binding
Every capsule MUST bind to:
- `run_id` (or `session_id` if outside a run)
- at least one `journal_ref` (events/artifacts)
- optional `repo_snapshot_ref` (commit hash, workspace hash, or snapshot id)

### 3.2 Deterministic Permissions
Every capsule MUST declare a ToolScope:
- `read` tools (default)
- `write` tools (gated)
- `exec` tools (gated)
Scope must be enforced by runtime; renderer cannot widen scope.

### 3.3 Sandboxing
Every capsule MUST declare a SandboxPolicy controlling:
- filesystem mounts (read-only vs read-write paths)
- network policy (deny/allow-list)
- runtime limits (cpu, memory, timeouts)
- secret handling policy (redaction + vault references)

### 3.4 Provenance
Every capsule MUST include provenance sufficient to reconstruct:
- which framework spawned it
- which agent produced it
- which inputs were used (with redaction)
- which tools were called to generate/update it

### 3.5 Tab Semantics
Capsules MUST behave like tabs:
- stable `capsule_id`
- switch without losing state
- close/destroy lifecycle semantics are explicit
- "pin" and "export" are explicit operations (not implied persistence)

---

## 4. Data Contracts

### 4.1 CapsuleSpec (Schema)

```json
{
  "capsule_id": "cap_...",
  "title": "Diff Review",
  "icon": "diff",
  "category": "code|planning|research|ops|memory|browser|custom",
  "status": "ephemeral|session|pinned|archived",

  "run_ref": {
    "run_id": "run_...",
    "session_id": "sess_..."
  },

  "bindings": {
    "journal_refs": ["jrnl_evt_...", "jrnl_art_..."],
    "repo_snapshot_ref": "git:commit:abcd1234|ws:snapshot:...",
    "artifact_refs": ["art_diff_...", "art_report_..."]
  },

  "canvas_bundle": [
    {
      "canvas_id": "cnv_...",
      "view_type": "diff_review|run_view|test_lens|search_lens|timeline|table|form|dashboard|kanban",
      "bindings": { "journal_refs": ["..."], "artifact_refs": ["..."] },
      "interactions": [
        "approve_patch",
        "request_changes",
        "rerun_tests",
        "open_artifact",
        "pin",
        "export",
        "spawn_subcapsule"
      ],
      "risk": { "class": "read|write|exec", "reason": "..." },
      "provenance_ui": { "show_trail": true }
    }
  ],

  "tool_scope": {
    "allowed_tools": ["fs.read", "git.diff", "test.run"],
    "denied_tools": ["fs.rm", "net.open"],
    "requires_confirmation": ["fs.write", "git.commit", "exec.run"]
  },

  "sandbox_policy": {
    "fs_mounts": [
      { "path": "/", "mode": "deny" },
      { "path": "/workspace", "mode": "ro|rw" }
    ],
    "network": { "mode": "deny|allowlist", "allow": ["https://..."] },
    "limits": { "cpu_ms": 600000, "memory_mb": 2048, "timeout_ms": 600000 },
    "secrets": { "mode": "none|vault_refs_only", "redact_outputs": true }
  },

  "lifecycle": {
    "created_at": "ISO-8601",
    "updated_at": "ISO-8601",
    "expires_at": "ISO-8601|null",
    "close_behavior": "destroy|archive_to_journal",
    "exportable": true
  },

  "provenance": {
    "framework_id": "fwk_...",
    "framework_version": "semver",
    "agent_id": "agent_...",
    "model_id": "model_...",
    "inputs": [
      { "type": "user_message|doc_ref|artifact_ref", "ref": "...", "redacted": true }
    ],
    "tool_calls": ["jrnl_evt_toolcall_...", "jrnl_evt_toolresult_..."]
  }
}

4.2 CapsuleEvents (Journal)

The Journal MUST record:
    •    capsule.spawned (CapsuleSpec hash + provenance)
    •    capsule.updated (diff/patch against CapsuleSpec)
    •    capsule.closed
    •    capsule.pinned
    •    capsule.exported (what format, where stored)

⸻

5. Capsule Lifecycle

5.1 States
    •    ephemeral: exists only for current task; may auto-expire
    •    session: persists while session exists
    •    pinned: user explicitly pins
    •    archived: capsule instance no longer active, but its artifacts persist

5.2 Operations
    •    capsule.spawn(framework_id, intent_tokens, context_refs) -> capsule_id
    •    capsule.update(capsule_id, capsule_patch) -> ok
    •    capsule.switch(capsule_id) -> ok
    •    capsule.close(capsule_id, mode=destroy|archive_to_journal) -> ok
    •    capsule.pin(capsule_id) -> ok
    •    capsule.export(capsule_id, target=artifact|miniapp_package|share_link) -> export_ref

All operations MUST emit Journal events.

⸻

6. Capsule Framework Registry

Capsules are generated through frameworks. Frameworks are registered and versioned.

6.1 FrameworkSpec

{
  "framework_id": "fwk_diff_review",
  "version": "1.0.0",
  "intent_patterns": [
    { "verbs": ["review", "fix", "refactor"], "entities": ["repo", "file", "diff"] }
  ],
  "default_capsule": {
    "title": "Diff Review",
    "icon": "diff",
    "category": "code",
    "canvas_bundle": [{ "view_type": "diff_review" }, { "view_type": "test_lens" }]
  },
  "required_tools": ["git.diff", "fs.read", "test.run"],
  "risk_class": "read|write|exec",
  "sandbox_defaults": { "network": { "mode": "deny" }, "fs_mounts": [{ "path": "/workspace", "mode": "ro" }] },
  "acceptance_tests": ["AT-CAPSULE-001", "AT-CAPSULE-002"]
}

6.2 Registry Rules
    •    Agents may only call capsule.spawn with a framework present in registry.
    •    Framework updates are ADR-governed if they change:
    •    tool scope defaults
    •    sandbox defaults
    •    risk class
    •    required acceptance tests

⸻

7. Renderer Contracts (TUI/Web/Orb)

Renderers MUST:
    •    treat CapsuleSpec as authoritative
    •    never widen ToolScope
    •    display risk/provenance cues
    •    implement tab semantics (list/switch/close/pin)

Renderers MAY:
    •    apply embodied interaction (physics), as long as it encodes semantics, not decoration.

(Principle: motion/color encode meaning; provenance trails must be visible.)

⸻

8. Security & Governance Hooks

8.1 Permission Gating

Any capsule that enables write or exec tools MUST:
    •    surface explicit risk cues
    •    require confirmation policy (per ToolScope.requires_confirmation)
    •    record approval/denial in Journal

8.2 Data Redaction

Capsule outputs MUST support redaction:
    •    secrets never written into CapsuleSpec
    •    sensitive tool outputs must be stored as redacted artifacts with vault refs where necessary

8.3 Replay

Given capsule_id, the system SHOULD be able to replay:
    •    framework used
    •    inputs (redacted)
    •    tool call sequence
    •    produced artifacts

⸻

9. Acceptance Tests (minimum)
    •    AT-CAPSULE-001: Capsule spawn emits capsule.spawned event with valid provenance.
    •    AT-CAPSULE-002: Renderer cannot execute tools outside ToolScope.
    •    AT-CAPSULE-003: Capsule close with archive_to_journal persists artifact refs.
    •    AT-CAPSULE-004: Switching capsules preserves bindings and tab state.
    •    AT-CAPSULE-005: SandboxPolicy enforcement blocks denied filesystem/network access.

⸻

10. Integration Notes (Repo Placement)

Target locations:
    •    /spec/presentation/CapsuleProtocol.md (this file)
    •    /spec/presentation/CanvasProtocol.md (peer contract)
    •    /services/registry-apps OR new /services/registry-capsules
    •    /packages/runtime-core (sandbox enforcement hooks)
    •    /packages/ui-kit (tab shell + capsule chrome)
    •    /services/executor (tool-scope enforcement at invocation boundary)

### Why the generated MDs won’t spiral out of control
We’ll generate new MDs only when they are **required to make the system deterministic**. Your own MD already identifies that “dynamic experiences must be semantic,” and that you need a Presentation Kernel above the Journal and Canvas Protocol  [oai_citation:1‡*.md](sediment://file_000000006ee4722f8bc946c114cb3e97) — those *force* new specs. Same logic applies to CapsuleProtocol.

## Answer to your question: will we still generate our own MDs?
Yes — in three controlled categories:

1) **Derived Protocol Specs** (like this)  
   Needed to make runtime/UI contracts implementable.

2) **Patch Ledger Files** (`/spec/patches/PATCH-###.md`)  
   Append-only record of what changed each integration, so nothing gets “forgotten.”

3) **Acceptance Tests Specs** (`/spec/AcceptanceTests.md` additions)  
   So every new concept becomes enforceable, not vibes.

If you want, the next generated file should be **`/spec/presentation/CanvasProtocol.md`** or **`/spec/presentation/PresentationKernel.md`** (your earlier “next concrete deliverable” list).  [oai_citation:2‡*.md](sediment://file_000000006ee4722f8bc946c114cb3e97)
