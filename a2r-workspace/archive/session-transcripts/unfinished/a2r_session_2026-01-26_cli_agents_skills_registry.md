# A2rchitech Session Summary — CLI Agents as a Service + Skill Registry Augmentation
**Date:** 2026-01-26 (America/Chicago)  
**Scope:** A2rchitech platform architecture direction — running CLI agents as a service, abstracting CLI tools as agent skills, and augmenting the existing Skills Registry with a browser-operator CLI (`vercel-labs/agent-browser`).

---

## 1) Objective
Establish a production-grade pattern where:
- Agents can run as **services** (job-based runners) rather than interactive, one-off terminal sessions.
- The platform treats downloaded/installed CLI tools (and MCP-exposed tools) as **typed skills**.
- The LLM remains a **planner**; execution happens in a **policy-gated runner**.
- Browser automation is added as a first-class skill via a CLI operator, to augment development workflows (UI verification, scripted repros, evidence capture).

---

## 2) Definitions & Mental Models

### 2.1 “CLI agent as a service”
A CLI agent becomes infrastructure:
- Always-on runner (daemon/container/server)
- Accepts jobs via API / queue / cron
- Executes tool-based workflows
- Produces structured results + artifacts + logs/traces
- Enforces policy constraints (allowed tools, sandbox, network, secrets)

**Core benefit:** decouple agent planning from execution environment; enable repeatability, isolation, and scale.

### 2.2 “Skills = invocable programs with contracts”
A skill is any capability that can be invoked reliably:
- CLI tools already provide stable interfaces (args/flags, exit codes).
- Wrap each tool behind a **Skill Contract**:
  - `name`
  - invocation template
  - input schema
  - output schema (normalized, ideally JSON)
  - safety class (read-only / write / network / privileged)
  - timeouts + resource limits
  - sandbox requirements

**Agent never constructs raw shell strings.** It calls named skills with typed args.

### 2.3 Bash tool as universal adapter (gated)
Bash remains useful only as a controlled adapter layer:
- Allowlist binaries
- Structured arg passing only
- Sandbox isolation (container/microVM)
- Default deny network
- Capture stdout/stderr/exit codes
- Normalize outputs to structured formats

---

## 3) Architecture: Control Plane vs Data Plane

### 3.1 Control plane (LLM)
- Produces a structured plan referencing skill names + parameters
- Does NOT carry the full tool registry in its context window

### 3.2 Data plane (Runner)
- Resolves skill calls
- Validates policy
- Executes in sandbox
- Returns typed outputs + artifacts
- Records full audit trail (tool calls, logs, timestamps)

**Key principle agreed:** tool discovery + invocation should be **out-of-band** (runner-side), not token-side (prompt).

---

## 4) MCP & “No MCP in context window”
Session conclusion:
- It is desirable to keep the tool directory out of the context window.
- Even without embedding MCP catalogs in the prompt, a runner can:
  - discover tools/servers
  - invoke them
  - return results
- This produces smaller prompts, fewer hallucinated tools, and safer enforcement.

**Interpretation:** MCP becomes an execution fabric; the prompt carries stable skill names, not full capability docs.

---

## 5) Augmentation via `vercel-labs/agent-browser`

### 5.1 Why it matters
`agent-browser` is a browser operation CLI designed to be invoked as a discrete tool. This fits the skills approach:
- A single “browser operator” skill replaces ad-hoc Playwright scripts.
- It provides an agent-friendly workflow:
  - `snapshot` returns an accessibility-tree with element refs
  - actions reference those refs (click/fill/get-text/screenshot)
- This produces a stable intermediate representation the agent can reason about.

### 5.2 What we planned to build
Integrate `agent-browser` into the existing Skills Registry as a first-class, stateful skill:

**Skill family:** `browser.operator`

**Session-based interface (wrapper-level):**
- `browser.open(url) -> {session_id}`
- `browser.snapshot(session_id) -> {tree, refs}`
- `browser.click(session_id, ref)`
- `browser.fill(session_id, ref, value)`
- `browser.get_text(session_id, ref) -> {text}`
- `browser.screenshot(session_id) -> {artifact_path}`
- `browser.close(session_id)`

**Wrapper responsibilities:**
- session lifecycle management
- normalize outputs into canonical JSON
- store screenshots as artifacts
- enforce domain/network policy gates
- standardize error handling (timeouts, exit codes)

---

## 6) Immediate Implementation Plan (Minimal Path)
Deliver the smallest integration that compounds:

1. Add registry entry for `browser.operator` mapping to `agent-browser` executable.
2. Ensure `agent-browser` is installed in the sandbox image/environment used by the runner.
3. Implement an adapter that turns `snapshot` output into a canonical JSON structure with refs.
4. Implement wrapper session abstraction (`session_id`) even if the CLI is inherently stateless; store per-session profile/temp dir mappings.
5. Wire into the runner’s skill resolver and policy engine.
6. Enable artifact capture (screenshots) and log/tracing for each tool call.

---

## 7) Intended Dev Workflow Benefits
Once integrated, agents can:

- **UI verification**: open dev URL → snapshot → assert controls exist → click through flows → capture screenshots.
- **Repro evidence**: convert “steps to reproduce” into an executable plan with supporting artifacts.
- **Reduce context switching**: browsing and verification become callable skills with auditable outputs.

---

## 8) Non-negotiables / Constraints
- No free-form shell access in production path.
- Skill calls must be typed and policy-gated.
- Prefer deterministic outputs (JSON modes, adapters/parsers).
- Pin tool versions in images to avoid output drift.
- Default deny network; allowlists for browser domains where required.
- Full observability: store prompts/plans, tool calls, stdout/stderr, exit codes, artifacts.

---

## 9) Deliverable Produced In-Session
A paste-ready implementation Markdown spec was produced (the “Implementation Specification v1.0”) describing:
- CLI agent service model
- skills contracts
- gated bash executor
- out-of-band tool resolution
- `browser.operator` session-based wrapper interface
- minimal integration steps
- security + observability requirements

(If needed, merge this summary with that spec as a single canonical work item.)

---
