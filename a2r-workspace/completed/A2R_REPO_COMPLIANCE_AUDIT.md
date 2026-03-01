# A2R Repo Compliance Audit (Code-Anchored)

Repo root audited: `/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech`
Date: 2026-01-27

## Scope + Files Opened
Required files (found):
- `dev/run.sh`
- `infra/gateway/nginx.conf`
- `services/kernel/src/main.rs`
- `services/python-gateway/main.py`

Other gateway boot scripts/configs found and opened:
- `launchd/com.a2rchitech.gateway.plist.template`
- `launchd/com.a2rchitech.agui-gateway.plist.template`
- `infra/docker-compose/development.yml`

Required law gate files (NOT FOUND):
- `/SOT.md` (repo root)
- `/CODEBASE.md` (repo root)
- `/spec/Contracts/*` (directory does not exist)
- `/spec/AcceptanceTests.md` (file does not exist)

Searched paths for missing law gate files:
- repo root: `/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/`
- `/spec/`
- `/docs/`

Related but non-compliant location:
- `tests/acceptance/phase0_acceptance_tests.md` (exists, but NOT `/spec/AcceptanceTests.md`)
- `spec/1_contracts/` (exists but is **not** the canonical path required by law; must be deprecated via ADR/Delta)

---

## Law Invariant Compliance Summary

| Law Invariant | Status | Evidence Path(s) |
|---|---|---|
| B0 deterministic boot gates (`/SOT.md`, `/CODEBASE.md`, `/spec/Contracts/*`, `/spec/AcceptanceTests.md`) | FAIL | `/SOT.md` not found, `/CODEBASE.md` not found, `/spec/Contracts` not found, `/spec/AcceptanceTests.md` not found |
| Contract root canonical path (`spec/Contracts/*` only; `spec/1_contracts/` legacy) | FAIL | `spec/Contracts/` missing; `spec/1_contracts/` exists (non-canonical) |
| WIH/Beads front matter on every DAG node | FAIL | `spec/finished/userland/workflows.yaml.schema.json`, `crates/orchestration/workflows/src/lib.rs` |
| Claude Tasks parity: blockedBy DAG enforcement | PARTIAL | `crates/orchestration/workflows/src/lib.rs` (edges exist, no blockedBy field) |
| Claude Tasks parity: `/install` presets | FAIL | `apps/cli/src/commands/project_template.rs` (placeholder install) |
| Claude Tasks parity: `/resume` deterministic continuation | FAIL | `services/kernel/src/brain/manager.rs` (resume only if process alive) |
| Claude Tasks parity: receipts | FAIL | No receipt schema contract (`/spec/Contracts/Receipt.schema.json` missing); `rg \"receipt\"` hits only docs/assets |
| PreToolUse gating before any tool execution | PARTIAL | `crates/kernel/tools-gateway/src/lib.rs` logs PreToolUse event but does not gate; `crates/orchestration/hooks/src/lib.rs` exists but not wired |
| Global output law (`/.a2r/` + WIH globs) | FAIL | `crates/capsule/src/store.rs` uses `.a2r/capsules` only; `crates/kernel/tools-gateway/src/lib.rs` executes local tools without path guard |
| Single gateway endpoint (no port sprawl) | FAIL | `dev/run.sh`, `infra/gateway/nginx.conf`, `infra/docker-compose/development.yml`, `launchd/*.plist.template` |
| No auth bypass for core endpoints | FAIL | `services/kernel/src/main.rs` (auth bypass for `/v1/brain`, `/v1/config`, `/v1/sessions`) |
| No unsandboxed exec | FAIL | `services/python-gateway/main.py` (exec), `crates/kernel/tools-gateway/src/lib.rs` (no sandbox) |

---

## Detailed Findings (per Law)

### 1) B0 Deterministic Boot Gates
**Requirement:** `/SOT.md`, `/CODEBASE.md`, `/spec/Contracts/*`, `/spec/AcceptanceTests.md` must exist and be enforced during boot.

**Observed:** None of the required files exist at mandated paths; no boot-time gate in `dev/run.sh`.

Evidence:
- `/SOT.md` NOT FOUND at repo root
- `/CODEBASE.md` NOT FOUND at repo root
- `/spec/Contracts/*` directory NOT FOUND
- `/spec/AcceptanceTests.md` NOT FOUND
- `tests/acceptance/phase0_acceptance_tests.md` exists but does not satisfy required path.
- `spec/1_contracts/` exists but is non-canonical under the law; requires explicit ADR/Delta deprecation.

`dev/run.sh` starts services immediately, with no gate:
```bash
# dev/run.sh
cargo build --release --bin a2rchitech ...
...
nohup uvicorn main:app --host 0.0.0.0 --port 8001 ...
nohup cargo run --release --bin webvm-service ...
nohup npm run dev ...
nohup cargo run --release --bin kernel ...
```

**Status:** FAIL

---

### 1b) Contract Root Canonical Path
**Requirement:** `spec/Contracts/*` is the only canonical contract root; any other contract trees are legacy.

**Observed:** `spec/Contracts/` is missing; `spec/1_contracts/` exists but is not canonical.

Evidence:
- `spec/Contracts/` NOT FOUND
- `spec/1_contracts/` EXISTS (legacy)

**Status:** FAIL

---
### 2) WIH/Beads Front Matter on Every DAG Node
**Requirement:** WIH/Beads front matter required on every DAG node.

**Observed:** Workflow schema and runtime node types do not include WIH/Beads fields.

Evidence (schema):
```json
// spec/finished/userland/workflows.yaml.schema.json
"workflow_node": {
  "properties": {
    "id", "name", "phase", "skill_id", "description", "inputs", "outputs",
    "tools", "constraints", "expected_output_schema"
  }
}
```
No `wih`, `beads`, or front matter fields present.

Evidence (runtime struct):
```rust
// crates/orchestration/workflows/src/lib.rs
pub struct WorkflowNode {
    pub id: String,
    pub name: String,
    pub phase: WorkflowPhase,
    pub skill_id: String,
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
    pub constraints: NodeConstraints,
}
```
No WIH/Beads fields.

**Status:** FAIL

---

### 3) Claude Tasks Parity
#### 3a) blockedBy DAG enforcement
**Observed:** DAG edges exist, but no `blockedBy` field on nodes. Enforcement is not explicit in schema.

Evidence:
```rust
// crates/orchestration/workflows/src/lib.rs
pub struct WorkflowEdge {
    pub from: String,
    pub to: String,
    pub condition: Option<String>,
}
```

**Status:** PARTIAL (edges exist, no explicit blockedBy or WIH binding)

#### 3b) `/install` presets
**Observed:** CLI installs are placeholders; no deterministic install registry.

Evidence:
```rust
// apps/cli/src/commands/project_template.rs
// In a real implementation, we would register ...
// For now, we'll just print that installation would happen
println!("✓ Project template ... would be installed ...");
```

**Status:** FAIL

#### 3c) `/resume` deterministic continuation
**Observed:** Sessions resume only if process is still alive; no deterministic continuation from receipts.

Evidence:
```rust
// services/kernel/src/brain/manager.rs
// For CLI sessions: resume only if process still alive
if let Some(pid) = session.pid { ... }
// TODO: Re-hydrate runtime if needed.
```

**Status:** FAIL

#### 3d) Receipts
**Observed:** No receipt contract schema (`/spec/Contracts/Receipt.schema.json`) and no receipts subsystem or `/.a2r/receipts` path found; `rg "receipt"` hits only docs/assets.

**Status:** FAIL

---

### 4) PreToolUse Gating Required Before Tool Execution
**Observed:** ToolGateway logs PreToolUse as a messaging event but does not gate execution via hook bus. Hook bus exists but is not wired into ToolGateway.

Evidence (ToolGateway logs event only):
```rust
// crates/kernel/tools-gateway/src/lib.rs
let pre_event = EventEnvelope { event_type: "PreToolUse".to_string(), ... };
// publish event (non-blocking)
tokio::spawn({ ... event_bus.publish(pre_event) ... });
```

Evidence (HookBus is capable of blocking but not used here):
```rust
// crates/orchestration/hooks/src/lib.rs
// Returns Err if the flow should be interrupted (e.g. PreToolUse security check fails).
async fn handle(&self, event: &HookEvent) -> anyhow::Result<()>;
```

**Status:** PARTIAL (event emitted, no gating)

---

### 5) Global Output Law (`/.a2r/` + WIH globs only)
**Observed:** `.a2r` used only for capsule storage; tool execution has no path enforcement. Local tools execute directly with a comment noting lack of sandboxing.

Evidence (capsule store only):
```rust
// crates/capsule/src/store.rs
storage_path: PathBuf::from(".a2r/capsules")
```

Evidence (local tool exec without sandbox/path guard):
```rust
// crates/kernel/tools-gateway/src/lib.rs
// ... in a real implementation, this would use proper sandboxing
let mut cmd = Command::new(&tool_def.command);
cmd.arg(input_file.path());
```

**Status:** FAIL

---

### 6) Single Gateway Endpoint (no port sprawl)
**Observed:** Multiple ports in dev, nginx, docker-compose, and launchd templates.

Evidence (dev run):
```bash
# dev/run.sh
PORT=8001   # voice
WEBVM port 8002
Shell UI 5173
Kernel 3000
```

Evidence (nginx):
```nginx
# infra/gateway/nginx.conf
# 3004 kernel, 3005 intent, 3006 capsule, 3007 presentation, 3008 ui-tars,
# 3009 memory, 3010 framework, 3011 io-daemon, 3012 observation, 3013 local-inference,
# 5173 shell-ui, 8001 voice, 8002 webvm
```

Evidence (docker-compose dev):
```yaml
# infra/docker-compose/development.yml
sms-gateway: ports: ["3000:3000"]
imessage-gateway: ports: ["3006:3006"]
appclip-gateway: ports: ["3007:3007"]
browser-gateway: ports: ["3008:3008"]
agent-router: ports: ["3001:3001"]
model-router: ports: ["3002:3002"]
policy-service: ports: ["3003:3003"]
```

Evidence (launchd):
```xml
<!-- launchd/com.a2rchitech.agui-gateway.plist.template -->
<key>PORT</key>
<string>8010</string>
```

**Status:** FAIL

---

### 7) No Auth Bypass for Core Endpoints
**Observed:** Security middleware bypasses auth for brain/config/sessions.

Evidence:
```rust
// services/kernel/src/main.rs
if path.starts_with("/v1/brain/") ||
   path.starts_with("/v1/config/") ||
   path.starts_with("/v1/sessions") {
    let response = next.run(request).await;
    return Ok(response);
}
```

**Status:** FAIL

---

### 8) No Unsandboxed Exec
**Observed:** python-gateway uses exec(); tool gateway local tools execute without sandbox.

Evidence (python-gateway):
```python
# services/python-gateway/main.py
"""... using exec() - NOT SANDBOXED."""
exec(request.code, globals_dict, locals_dict)
```

Evidence (tools-gateway):
```rust
// crates/kernel/tools-gateway/src/lib.rs
// In a real implementation, this would use proper sandboxing
cmd.output()
```

**Status:** FAIL

---

## Compliance Delta Summary
- Law layer required files are missing at mandated paths.
- Workflow schema/engine lack WIH/Beads front matter.
- Task parity missing install/resume/receipts; blockedBy only implicit via edges.
- PreToolUse exists as event emission only; not used to gate execution.
- Output law not enforced; tool execution can write anywhere.
- Gateway port sprawl exists across dev, nginx, docker-compose, and launchd.
- Kernel bypasses auth for core endpoints.
- Python gateway and local tools are unsandboxed.
