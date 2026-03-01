# A2R Patch Plan (Law Layer Implementation)

Repo root: `/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech`

This plan is concrete, per-file, and scoped to the stated invariants. It avoids speculative features.

---

## 1) New Files to Add (Law Gate Artifacts)

### 1.1 `/SOT.md`
- **Purpose:** Canonical source-of-truth required by B0 gate.
- **Content:** High-level law layer statement + links to `/spec/Contracts/*` and `/spec/AcceptanceTests.md`.

### 1.2 `/CODEBASE.md`
- **Purpose:** Canonical index of architecture + directory intent required by B0 gate.
- **Content:** Repo tree map, boot sequence, and invariants references.

### 1.3 `/spec/Contracts/` (CANONICAL)
- **Purpose:** Single canonical contract root required by B0.
- **Rule:** `spec/Contracts/*` is the only canonical contract namespace. `spec/1_contracts/` becomes legacy and must not be referenced by runtime/CI.

Suggested files:
- `/spec/Contracts/README.md` (index)
- `/spec/Contracts/WIH.schema.json`
- `/spec/Contracts/Receipt.schema.json`

### 1.4 `/spec/AcceptanceTests.md`
- **Purpose:** Required by B0 gate.
- **Content:** Index of acceptance tests with canonical references; can link to `tests/acceptance/phase0_acceptance_tests.md` while migrating.

### 1.5 `/spec/Contracts/WIH.schema.json`
- **Purpose:** Formal WIH/Beads schema bound to workflow nodes and task receipts.
- **Includes:** `id`, `title`, `blocked_by`, `tools_allowlist`, `write_scope`, `inputs`, `outputs`, `acceptance_tests`, `receipts_required`.

### 1.6 `/spec/Contracts/Receipt.schema.json`
- **Purpose:** Receipts must be *proofs*, not logs.
- **Required fields (minimum):**
  - `receipt_id`, `created_at`, `run_id`, `workflow_id`, `node_id`, `wih_id`
  - `tool_id`, `tool_def_hash`, `policy_decision_hash`, `pretool_event_hash`
  - `input_hashes`, `output_hashes`
  - `artifact_manifest[]` (path, hash, size, media_type)
  - `write_scope_proof` (declared vs actual paths)
  - `execution` (exit_code, stderr_hash, stdout_hash, duration_ms)
  - `idempotency_key`, `retry_count`, `trace_id`
  - `environment_hash` (tool version, runtime signature)

### 1.7 `/spec/Deltas/Delta-0004.md` (or ADR)
- **Purpose:** Contract-root canon declaration + security boot-gates.
- **Must state:**
  - `spec/Contracts/` is canonical.
  - `spec/1_contracts/` is legacy and non-authoritative.
  - Security gates (auth bypass + python exec) are B0 failures.

---

## 2) Per‑File Diff Plan

### 2.1 `dev/run.sh`
**Problems:** starts services directly; multi‑port sprawl; no B0 gate. (See audit)

**Diff Plan:**
1) Add boot gate checks before any service starts:
   - verify `/SOT.md`, `/CODEBASE.md`, `/spec/Contracts/`, `/spec/AcceptanceTests.md` exist
   - if missing, exit non‑zero with explicit error
2) Start **gateway only** as the public entrypoint.
3) Bind internal services to loopback only and remove explicit public port messaging.
4) Route UI through gateway (no direct 5173 public endpoint).

---

### 2.2 `infra/gateway/nginx.conf`
**Problems:** explicit port sprawl (3004–3013, 5173, 8001, 8002). (See audit)

**Diff Plan:**
1) Keep a single public listener (e.g., `listen 3000;`).
2) Convert upstreams to **name‑based** internal routes (service discovery or localhost‑only).
3) Remove public exposure of dev UI port.
4) Add explicit allowlist routes and deny all else.

---

### 2.3 `infra/docker-compose/development.yml`
**Problems:** exposes multiple ports for internal services and multiple gateway services. (See audit)

**Diff Plan:**
1) Expose **only** the gateway service to host (`3000:3000` or chosen port).
2) Remove host port mappings from all internal services.
3) Ensure internal services communicate via Docker network/service names.

---

### 2.4 `launchd/com.a2rchitech.gateway*.plist.template` and `launchd/com.a2rchitech.agui-gateway.plist.template`
**Problems:** multiple gateways/ports (8010) violate single endpoint law.

**Diff Plan:**
1) Consolidate to single gateway launchd entry.
2) Remove or mark agui-gateway as internal (no host port) or remove until re‑integrated behind single gateway.

---

### 2.5 `services/kernel/src/main.rs`
**Problems:** auth bypass for `/v1/brain`, `/v1/config`, `/v1/sessions`.

**Diff Plan:**
1) Remove bypass conditions from `security_middleware` **(B0 security gate)**.
2) Add boot gate in `main` before router init:
   - call `enforce_boot_contracts()` (new module), fail fast if missing.
3) For tool execution endpoints: require WIH metadata in request payloads (schema enforcement at boundary).

---

### 2.6 `services/python-gateway/main.py`
**Problems:** `exec()` unsandboxed; no tool registry or WIH enforcement.

**Diff Plan (mandatory):**
- Remove `exec()` path entirely or gate it behind ToolGateway + WIH + sandbox.
- Default behavior must be *deny raw code execution*.

---

### 2.7 `crates/kernel/tools-gateway/src/lib.rs`
**Problems:** PreToolUse only emits event; no hook gating; no global output law enforcement; no sandbox.

**Diff Plan:**
1) Inject `HookBus` into `ToolGateway` and call `HookBus.emit(PreToolUse)` **before** execution; if handler fails, abort.
2) Enforce write scope:
   - Extend `ToolExecutionRequest` with `write_scope` and `wih_id`.
   - Validate requested filesystem paths against `.a2r/**` + WIH globs before execution.
3) Enforce strict filesystem access: disallow `ReadWrite` outside `.a2r`.
4) Emit receipts validated against `/spec/Contracts/Receipt.schema.json`.

---

### 2.8 `crates/orchestration/workflows/src/lib.rs` + compiler/validator
**Problems:** WIH/Beads absent from node definition; blockedBy not explicit; receipts missing.

**Diff Plan:**
1) Add `wih` (or `wih_ref`) to `WorkflowNode` and schema to bind WIH front matter to every node.
2) Update YAML compiler/validator to require WIH for each node.
3) Add receipt creation on node completion and persist to `/.a2r/receipts/`.
4) Validate receipts against `/spec/Contracts/Receipt.schema.json`.

---

## 3) Acceptance Tests to Add / Gate in CI

Add tests under `tests/acceptance/` and reference from `/spec/AcceptanceTests.md`.

1) **B0 Boot Gate**
   - Assert kernel exits when `/SOT.md` or `/CODEBASE.md` missing.
2) **Contract Root Canon**
   - Fail if runtime/CI references `spec/1_contracts/` as canonical.
3) **Auth Bypass Forbidden (static + runtime)**
   - Fail CI if `services/kernel/src/main.rs` contains bypass list for `/v1/brain`, `/v1/config`, `/v1/sessions`.
4) **Python exec forbidden (static)**
   - Fail CI if `services/python-gateway/main.py` contains `exec(` in request path.
5) **PreToolUse Gate**
   - Tool execution fails when PreToolUse handler denies.
6) **Output Law**
   - Tool execution attempting write outside `.a2r/` is blocked.
7) **WIH Required on Nodes**
   - Workflow compile fails if any node missing WIH/Beads front matter.
8) **Receipts**
   - Workflow run produces receipt under `/.a2r/receipts/<run>/<node>.json` validated by `Receipt.schema.json`.
9) **Single Gateway Endpoint**
   - Only gateway port exposed in dev (no direct host port for internal services).

10) **Capsule Runtime + MCP Host (Delta‑0005)**
   - **AT-CAP-0001** Capsule UI sandbox cannot directly access FS/network; only via host bridge.
   - **AT-CAP-0002** Capsule → tool action must include WIH identifiers and pass tool registry.
   - **AT-CAP-0003** Capsule artifacts are written only under `/.a2r/` and appear in receipts.
   - **AT-CAP-0004** Approval-required actions cannot execute without explicit user approval state.
   - **AT-CAP-0005** Browser capsule emits replayable receipts (URL + DOM/screenshot hashes).

---

## 4) Minimal Dependency Order (for implementation)
1) Add `/SOT.md`, `/CODEBASE.md`, `/spec/Contracts/`, `/spec/AcceptanceTests.md`
2) Add contract-root canon ADR/Delta (spec/Contracts canonical; spec/1_contracts legacy)
3) **Security boot gates:** remove kernel auth bypass + remove python exec (CI fail until done)
4) Add WIH schema + validator wiring
5) PreToolUse gating + output law enforcement in ToolGateway
6) Receipt schema + enforcement
7) Consolidate gateway ports and dev boot scripts
8) **Delta‑0005 Capsule Runtime + Shell Overlay (MCP Apps host)**
9) Deterministic /install + /resume semantics

---

## 5) Files to Touch (Quick Checklist)
- `dev/run.sh`
- `infra/gateway/nginx.conf`
- `infra/docker-compose/development.yml`
- `launchd/com.a2rchitech.gateway.plist.template`
- `launchd/com.a2rchitech.agui-gateway.plist.template`
- `services/kernel/src/main.rs`
- `services/python-gateway/main.py`
- `crates/kernel/tools-gateway/src/lib.rs`
- `crates/orchestration/workflows/src/lib.rs`
- `crates/orchestration/workflows/src/engine/compiler.rs`
- `crates/orchestration/workflows/src/engine/validator.rs`
- `tests/acceptance/*.md` or `.sh`
- `/SOT.md`
- `/CODEBASE.md`
- `/spec/Contracts/*`
- `/spec/Contracts/Receipt.schema.json`
- `/spec/AcceptanceTests.md`
- `/spec/Deltas/Delta-0004.md`
- `/spec/Deltas/0005-capsule-runtime-mcp-host.md`
- `/spec/Contracts/CapsuleManifest.schema.json`
- `/spec/Contracts/MCPAppDescriptor.schema.json`
- `/spec/Contracts/CapsuleBridgeEvent.schema.json`
