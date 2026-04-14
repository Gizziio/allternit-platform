# /spec/layers/skills/FullSpec.md
# A2rchitech Skills System Specification
## Packages, Manifests, Workflows, Tools, Synthesis, RL Hooks

Status: Canonical  
Layer: L4 Skills System (Registry + Runtime + Contracts)  
Scope: Software skills + Robotics/IoT skills

---

## 1. Purpose

A Skill is the only permitted unit of **capability** in A2rchitech.

Skills are:
- installable
- versioned
- signed
- permission-scoped
- sandboxable
- composable (workflow DAGs)
- observable (full IO capture)
- improvable (meta/RL pipelines)

A2rchitech does not execute “tools” directly.
It executes **Skills**, and Skills may wrap tools.

---

## 2. Skill Package Structure

A Skill is a bundle with a canonical layout.

### 2.1 Required files (minimum)
```
<skill-root>/
  skill.yaml                 # manifest (required)
  SKILL.md                   # human routing + domain knowledge (required)
  schemas/                   # JSON Schema for inputs/outputs (required)
  workflows/                 # workflow definitions (required)
  tools/                     # implementations/adapters (required)
```

### 2.2 Optional files
```
  ui/                        # optional UI panels/resources (MCP Apps / HTML)
  policies/                  # extra policy hints (never overrides policy engine)
  evals/                     # tests, scenarios, benchmarks
  assets/                    # icons, diagrams
  datasets/                  # synthetic/sim data (if allowed)
  changelog.md               # per-skill change notes
  signatures/                # signed metadata artifacts
```

---

## 3. Manifest (skill.yaml) — Canonical Schema

### 3.1 Metadata
- `id` (global unique; reverse-DNS recommended)
- `name`
- `version` (semver)
- `description`
- `author`
- `license`
- `tags[]`
- `homepage` (optional)
- `repository` (optional)

### 3.2 Contract (Typed I/O)
- `inputs`:
  - `schema`: path/ref to JSON Schema
  - `examples`: optional example payloads
- `outputs`:
  - `schema`: path/ref to JSON Schema
  - `artifacts`: list of artifact types emitted

### 3.3 Execution Requirements
- `runtime`:
  - `mode`: `sandbox | host | container`
  - `timeouts`: per-step and total
  - `resources`: cpu/gpu/mem hints
- `environment`:
  - `allowed_envs`: `dev | stage | prod`
  - `network`: `none | domain-allowlist | unrestricted`
  - `filesystem`: allowlist paths, read/write boundaries

### 3.4 Side Effects (Declared)
- `side_effects[]`:
  - file_write
  - network_call
  - db_mutation
  - repo_patch
  - credential_use
  - device_actuation
  - otc_update (OTA)
  - external_purchase (if ever allowed)

Side effects must be explicit. Undeclared side effects invalidate execution.

### 3.5 Governance
- `risk_tier`: `T0 | T1 | T2 | T3 | T4`
- `required_permissions[]`: ACL labels
- `requires_policy_gate`: true (hard)
- `publisher`:
  - `publisher_id`
  - `public_key_id`
- `signature`:
  - `manifest_sig`
  - `bundle_hash`

---

## 4. SKILL.md — Human Routing + Domain Knowledge

SKILL.md is the human-readable spine. It must contain:
- what the skill does (plain language)
- when to use it / when not to use it
- constraints, hazards, failure modes
- examples
- workflow description (scientific loop alignment)

SKILL.md never grants permissions.
It is advisory to routing, not authority.

---

## 5. Workflows (scientific loop encoding)

### 5.1 Canonical loop requirement
Every skill workflow must map to:
OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN

Not all phases require separate agents, but the phases must exist as nodes or internal steps.

### 5.2 Workflow file format
Workflows are declarative DAGs:
- nodes
- edges
- per-node tool bindings
- per-node constraints
- artifact outputs

### 5.3 Checkpoints & artifacts
After each phase, emit:
- artifact pointer(s)
- hashes
- verification state

---

## 6. Tools (Implementations / Adapters)

Tools are the executable primitives. Skills wrap tools.

### 6.1 Tool types
- local executable (sandboxed)
- MCP tool
- HTTP tool
- SDK call tool
- robotics adapter tool (ROS2, MQTT, vendor SDK)

### 6.2 Tool requirements
Each tool must declare:
- input schema
- output schema
- side effects
- idempotency behavior
- retryability
- failure classification

Tools never bypass the Tool Gateway.

---

## 7. Output Synthesis

Skills that produce multiple candidate outputs must define synthesis policies.

### 7.1 Synthesis strategies
- `deterministic_rule`
- `best_of_n`
- `weighted_vote`
- `metric_ranked`
- `human_verified` (optional tiered mode)

### 7.2 Confidence scoring
Each skill may emit:
- confidence score
- evidence links (artifact pointers)
- verification results

Confidence never overrides VERIFY requirements.

---

## 8. RL / Learning Hooks (Complete Cycle)

Skills may be static or learnable.
Learnable skills must declare an RL/learning pipeline.

### 8.1 Observations
Define telemetry captured as observations:
- inputs/outputs
- environment state
- error traces
- device telemetry (if embodied)
- user feedback signals (if allowed)

### 8.2 Simulation requirement
For tier T3/T4, learning must occur in:
- simulator/gym first
- constrained sandbox second
- staged production last (policy gated)

### 8.3 Evaluation
Define evaluation harness:
- metrics (success rate, latency, safety violations)
- thresholds (pass/fail)
- regression tests
- adversarial tests (if applicable)

### 8.4 Delta Proposal
Define what can change:
- prompt templates
- routing rules
- parameters
- model choice
- heuristics
- weights (only if allowed, typically external)

### 8.5 Promotion
Promotion requires:
- evaluation pass
- policy approval
- canary deployment (for non-trivial deltas)
- rollback plan

### 8.6 Rollback
Rollback triggers:
- metric regression
- safety violation
- unexpected side effects
- audit failures

Rollback reverts:
- skill version (registry)
- config deltas
- routing rules
- persona overlays if involved

---

## 9. Robotics/IoT Skill Extensions

Robotics skills add mandatory declarations:
- `adapter`: ros2/mqtt/vendor_sdk/custom
- `targets`: device selectors
- `commands`: action schema
- `telemetry`: expected feedback schema
- `safety_envelope`: speed/torque/geofence limits
- `e_stop`: binding + verification
- `sim_scenarios`: required gym scenarios

Physical EXECUTE must pass dual validation (policy + environment).

---

## 10. Registry Lifecycle

Skill lifecycle:
Create → Sign → Publish → Index → Install → Enable → Execute → Observe → Improve → Deprecate/Remove

Registry requirements:
- immutable versions
- signature verification
- channel support (stable/beta/canary)
- dependency pinning
- offline install support

---

## 11. Acceptance Criteria

A valid skill must:
1) provide typed I/O schemas
2) declare side effects
3) execute only via Tool Gateway
4) be signed and versioned
5) emit artifacts and verification outputs
6) support rollback via registry
7) if learnable: declare full observe→eval→promote→rollback cycle

---

End of Skills System Specification
