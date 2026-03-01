Proceeding. The next lock is the Tool Registry—this is the last core pillar required to make the system deterministic, governable, and safe.

Below is the hard-default, implementation-ready spec.

⸻


# Tool Registry
## Deterministic Tools, Permissions, and Governance

Status: HARD DEFAULT  
Layer Binding: L1 Runtime, L2 Governance, L3 Orchestration, L6 Providers

---

## 0. Purpose

The Tool Registry defines **what can act on the world**.

It is the sole authority for:
- tool identity
- permission scopes
- risk classification
- invocation contracts
- audit enforcement

> If a capability is not registered as a tool, it does not exist.

Tools are **not code snippets** or ad-hoc functions.  
They are **governed contracts**.

---

## 1. Core Invariants (Non-Negotiable)

1. All execution flows through registered tools
2. Tools declare **scope**, **risk**, and **side effects**
3. No tool executes without Journal emission
4. Renderers cannot invoke tools
5. Agents cannot bypass ToolScope
6. Write/exec tools require explicit policy + approval

---

## 2. Tool Model

### 2.1 Tool Definition (ToolSpec)

```json
{
  "tool_id": "git.diff",
  "version": "1.0.0",
  "category": "fs|git|build|runtime|browser|model|custom",
  "description": "Compute diff for repository paths",

  "inputs_schema": {
    "path": { "type": "string", "required": true }
  },

  "outputs_schema": {
    "artifact_ref": { "type": "string" }
  },

  "scope": "read|write|exec",

  "risk": {
    "class": "low|medium|high",
    "side_effects": ["filesystem", "network", "runtime"],
    "reversible": true
  },

  "execution": {
    "runtime": "local|container|sandbox",
    "timeout_ms": 60000,
    "resource_limits": {
      "cpu_ms": 600000,
      "memory_mb": 1024
    }
  },

  "journal_hooks": {
    "emit": ["tool_call", "tool_result", "tool_error"]
  }
}


⸻

3. Tool Scope & Permissions

3.1 Scope Classes

Scope    Meaning
read    Inspect state, no mutation
write    Mutates state, reversible
exec    Executes commands, potentially irreversible

Scope is declared, not inferred.

⸻

3.2 ToolScope (Capsule-Bound)

Each Capsule declares a ToolScope:

{
  "allowed_tools": ["git.diff", "fs.read"],
  "denied_tools": ["fs.rm"],
  "requires_confirmation": ["git.commit", "exec.run"]
}

Rules:
    •    Scope is enforced at runtime
    •    Renderers cannot widen scope
    •    Kernel cannot override scope
    •    Only governance can modify defaults

⸻

4. Tool Invocation Flow

Canvas interaction
 → Intent emitted
   → Presentation Kernel validates intent
     → Capsule ToolScope checked
       → Tool Registry validates tool + scope
         → Executor invokes tool
           → Journal records call + result

No shortcut paths exist.

⸻

5. Tool Categories (Canonical)

5.1 Filesystem
    •    fs.read
    •    fs.search
    •    fs.write
    •    fs.patch
    •    fs.rm (high risk)

5.2 Version Control
    •    git.status
    •    git.diff
    •    git.commit
    •    git.checkout

5.3 Build & Test
    •    build.run
    •    test.run
    •    lint.run
    •    coverage.report

5.4 Runtime & Infra
    •    docker.up
    •    docker.logs
    •    service.health

5.5 Browser Operator
    •    browser.open
    •    browser.click
    •    browser.type
    •    browser.extract
    •    browser.screenshot
    •    browser.record_session

5.6 Model & Evaluation
    •    model.run
    •    eval.run
    •    compare.runs
    •    trace.inspect

⸻

6. Risk & Governance

6.1 Risk Escalation Rules
    •    Any write or exec tool MUST:
    •    surface risk cues
    •    require confirmation
    •    emit decision entries

6.2 Policy Enforcement

Policies may:
    •    restrict tools by environment
    •    restrict tools by user role
    •    impose rate limits
    •    require dual approval

Violations MUST emit:
    •    policy_violation journal event

⸻

7. Tool Versioning & Deprecation
    •    Tools are versioned semantically
    •    Breaking changes require ADR
    •    Deprecated tools remain callable only if explicitly allowed
    •    Removal requires migration plan

⸻

8. Tool Discovery

The registry MUST expose:
    •    searchable catalog
    •    scope + risk metadata
    •    example invocations
    •    acceptance tests

This supports:
    •    agent planning
    •    human inspection
    •    safe discovery (no blind execution)

⸻

9. Acceptance Tests (Minimum)
    •    AT-TOOL-001: Unregistered tool invocation rejected
    •    AT-TOOL-002: ToolScope enforcement blocks escalation
    •    AT-TOOL-003: Tool calls always emit Journal events
    •    AT-TOOL-004: Renderer cannot invoke tools
    •    AT-TOOL-005: Policy violation emits audit event

⸻

10. Integration Notes (Repo Mapping)

Target locations:
    •    /spec/tools/ToolRegistry.md (this file)
    •    /services/executor (invocation + enforcement)
    •    /services/policy (governance)
    •    /services/history (journal emission)
    •    /packages/tools-gateway (adapter layer)

⸻

11. Final Constraint

Tools are power.
Power without governance is failure.

If it executes, it is a tool.
If it is a tool, it is governed.
If it is governed, it is auditable.

---

## Ledger Update

- **PATCH-006:** Tool Registry locked  
  (permissions, scopes, risk, governance)

---

### What’s left to unify the system

At this point, the **core system is fully defined**:
- Capsules
- Presentation Kernel
- Canvas Protocol + View Taxonomy
- Journal
- Tool Registry

The remaining work is **consolidation and enforcement**.
