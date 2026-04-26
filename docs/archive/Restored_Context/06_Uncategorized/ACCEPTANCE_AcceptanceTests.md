# AcceptanceTests
## Architectural Invariants (System-Wide)

**Status:** ENFORCED (Tier-1)  
**Governed by:** `PROJECT_LAW.md` (Tier-0)

---

## Project Law

- AT-LAW-001: `PROJECT_LAW.md` is loaded before any plan or execution.
- AT-LAW-002: Any mutation of Tier-0 requires ADR + version bump.

---

## Journal Invariants

- AT-JRN-001: Journal is append-only.
- AT-JRN-002: Entries are immutable.
- AT-JRN-003: All actions have causal parents (no orphan events).
- AT-JRN-004: Replay reproduces identical CanvasSpec for a run_id.
- AT-JRN-005: Artifacts are immutable references; updates create new artifacts.

---

## Tool Invariants

- AT-TOOL-001: Unregistered tool invocation is rejected.
- AT-TOOL-002: ToolScope enforcement blocks escalation.
- AT-TOOL-003: Tool calls always emit tool_call + tool_result|tool_error events.
- AT-TOOL-004: Renderers cannot invoke tools.
- AT-TOOL-005: Policy violations emit policy_violation events.

---

## Capsule Invariants

- AT-CAP-001: Capsules spawn only via frameworks.
- AT-CAP-002: Capsule SandboxPolicy enforced (no bypass).
- AT-CAP-003: Capsule instances bind to run_id and session_id.
- AT-CAP-004: Capsule closure preserves provenance.
- AT-CAP-005: Capsule cannot widen ToolScope internally.

---

## Canvas Invariants

- AT-CNV-001: Canvas binds to journal refs (events/artifacts).
- AT-CNV-002: No tool execution from canvas.
- AT-CNV-003: Canonical view taxonomy enforced (no new primitives without ADR).
- AT-CNV-004: Renderer cannot add interactions not declared in InteractionSpec.
- AT-CNV-005: Risk escalation always visible in UI (or explicit capability downgrade).

---

## Presentation Kernel Invariants

- AT-PK-001: Same inputs + same journal state → same CanvasSpec.
- AT-PK-002: Kernel cannot bypass governance gates.
- AT-PK-003: Intent tokenization must be inspectable.
- AT-PK-004: Capsule spawn requires framework + provenance.
- AT-PK-005: Renderer adaptation uses declared RendererCapabilities only.

---

## Prompt / Directive Compiler Invariants

- AT-DC-001: No raw prompts are executed; directives must be compiled.
- AT-DC-002: Directives are typed and versioned; compilation emits artifacts.
- AT-DC-003: Model outputs must validate against an output schema.
- AT-DC-004: Context budgeting must be deterministic per directive type.

---

## Pattern System Invariants (MD-013)

- AT-PAT-001: Delivery track never degrades: learning produces proposals only.
- AT-PAT-002: Learning track cannot invoke write/exec tools.
- AT-PAT-003: Pattern promotion requires eval + approval + journaling.
- AT-PAT-004: Pattern selection is deterministic given (intent, state, env).
- AT-PAT-005: External recipes must be normalized into PatternSpec before use.

---

## UTI / Manifests Invariants (MD-011)

- AT-UTI-001: All state-changing actions require explicit consent (Action Preview).
- AT-UTI-002: Receipts are emitted as immutable artifacts.
- AT-UTI-003: Provider manifests must validate against schema before routing.
