# agents/spec/WIH_SCHEMA.md
<WIHSchema>

## Purpose
Define the canonical Work Item Header (WIH) execution envelope used by the Agent Runner (DAK) and referenced by DAG nodes. The WIH is the unit-of-work contract: role, scope, inputs, outputs, acceptance, and stop/escalation rules.

## File format
- WIH is a Markdown file with **YAML front matter**.
- Body MAY contain human notes, but MUST NOT change semantics compared to the YAML.

---

## 1) Canonical WIH YAML shape

### 1.1 Required top-level fields
```yaml
wih_version: 1
work_item_id: "T1042"              # stable ID
title: "Short task title"
owner_role: "orchestrator"         # who owns the envelope itself
assigned_roles:
  builder: "agent.builder"
  validator: "agent.validator"
  reviewer: "agent.reviewer"       # optional
  security: "agent.security"       # optional

inputs:
  sot: "/SOT.md"                   # canonical truth doc
  requirements:                    # list of anchored refs
    - "/spec/Requirements.md#tooling"
  contracts:
    - "/spec/Contracts/tools.schema.json"
    - "/spec/Contracts/tool_registry.schema.json"
  context_packs:                   # optional: pre-built packs or docs
    - "/context/CODEBASE.md"
    - "/context/ARCHITECTURE.md"
  artifacts_from_deps:             # optional: receipt IDs or artifact refs
    - "receipt:R-abc123"

scope:
  allowed_paths:
    - "apps/shell/**"
    - "packages/kernel/**"
  forbidden_paths:
    - "spec/**"
    - ".git/**"
  allowed_tools:
    - "fs.read"
    - "fs.write"
    - "grep.search"
    - "tests.run"
  forbidden_tools:
    - "net.post"                   # optional explicit denylist
  execution_permission:
    mode: "read_only"              # read_only | write_leased | yolo
    flags: []                      # e.g. ["--dangerously-skip-permissions"] (rare)

outputs:
  required_artifacts:
    - "packages/kernel/tooling/contract_enforcer.ts"
    - "packages/kernel/tooling/tool_registry.ts"
    - "packages/kernel/tooling/__tests__/contract_enforcer.test.ts"
  required_reports:
    - "build_report.md"
    - "validator_report.md"
  artifact_root_policy:
    durable_outputs_via: "rails"   # rails | none
    local_workspace_root: ".a2r/out/{{run_id}}/"   # runner workspace allowed
    forbid_repo_writes_by_default: true

acceptance:
  tests:
    - "tests.run packages/kernel/tooling"
  invariants:
    - "Tool calls validate against tools.schema.json"
    - "No writes outside allowed_paths"
  evidence:
    - "validator_report.md"        # must exist and PASS

blockers:
  fail_on:
    - "schema_validation_error"
    - "test_failure"
    - "policy_violation"

stop_conditions:
  escalate_if:
    - "ambiguous_requirement"
    - "missing_contract_schema"
  max_iterations: 5


⸻

2) Semantics (authoritative rules)

2.1 Role rules
	•	builder MAY propose code/artifacts but MUST NOT declare completion.
	•	validator MUST NOT implement changes. Validator produces PASS/FAIL.
	•	reviewer MAY add review notes; cannot declare completion unless explicitly designated as a gate.
	•	security MAY run threat/policy checks; can veto completion via gates.

2.2 Scope rules (hard enforcement)
	•	allowed_paths is the only write scope.
	•	forbidden_paths MUST be denied even if also matched by allowed.
	•	If forbid_repo_writes_by_default=true, builder outputs MUST be either:
	•	patches/artifacts inside runner workspace, OR
	•	writes executed only through Rails lease+gate approval.

2.3 Tool rules (hard enforcement)
	•	allowed_tools defines the only tools callable for this WIH.
	•	forbidden_tools explicitly blocks tools even if globally allowed elsewhere.
	•	Tool calls MUST be validated by:
	1.	WIH allowlist
	2.	tool schema validation
	3.	policy engine decision
	4.	path/concurrency guard
	5.	Rails gate eventing (pre/post)

2.4 Execution permission
	•	read_only: no writes. Builder must output patch artifacts only.
	•	write_leased: writes allowed only with valid lease+gate approval.
	•	yolo: allowed only when explicitly set in WIH; still must emit events and receipts.

2.5 Outputs and reports
	•	required_artifacts are the deliverable files (or patch targets).
	•	required_reports are structured receipts/reports. At minimum:
	•	build_report.md (builder)
	•	validator_report.md (validator)
	•	Durable outputs must be recorded via Rails receipts/blobs when durable_outputs_via=rails.

2.6 Acceptance

A WIH is satisfied iff:
	•	all acceptance.tests are green (as declared)
	•	all acceptance.invariants hold
	•	all acceptance.evidence artifacts exist
	•	validator report is PASS (unless replaced by a different gate role in DAG)

2.7 Blockers + stop conditions
	•	blockers.fail_on defines immediate halt conditions (node becomes BLOCKED/FAILED).
	•	stop_conditions.max_iterations bounds Ralph loops.
	•	stop_conditions.escalate_if triggers PromptDeltaNeeded (user input) or requires approval.

⸻

3) Validator report schema (minimum)

Validator must output validator_report.md in YAML or JSON fenced block (choose one standard per repo). Minimum fields:

result: "PASS"    # PASS | FAIL
violations: []    # list of objects
required_fixes: []# bounded actionable list
evidence:
  - "tests.run output attached as receipt:R-..."


⸻

4) Example WIH file template (copy/paste)

---
wih_version: 1
work_item_id: "T0001"
title: "Describe task"
owner_role: orchestrator
assigned_roles:
  builder: agent.builder
  validator: agent.validator
inputs:
  sot: /SOT.md
  requirements: []
  contracts: []
  context_packs: []
scope:
  allowed_paths: []
  forbidden_paths: []
  allowed_tools: []
  forbidden_tools: []
  execution_permission:
    mode: read_only
    flags: []
outputs:
  required_artifacts: []
  required_reports: ["build_report.md","validator_report.md"]
  artifact_root_policy:
    durable_outputs_via: rails
    local_workspace_root: ".a2r/out/{{run_id}}/"
    forbid_repo_writes_by_default: true
acceptance:
  tests: []
  invariants: []
  evidence: ["validator_report.md"]
blockers:
  fail_on: ["policy_violation","test_failure"]
stop_conditions:
  escalate_if: ["ambiguous_requirement"]
  max_iterations: 3
---

# Task notes (optional)
Keep notes here. YAML above is authoritative.

</WIHSchema>
```



