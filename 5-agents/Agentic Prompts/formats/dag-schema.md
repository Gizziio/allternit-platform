# agents/spec/DAG_SCHEMA.md
<DAGSchema>

## Purpose
Define the canonical DAG spec used by the Agent Runner (DAK) to execute work mechanically with explicit dependencies and gates. Each node references exactly one WIH.

## File format
- DAG is a YAML file.

---

## 1) Canonical DAG YAML shape

### 1.1 Required fields
```yaml
dag_version: 1
dag_id: "D2026-02-07-dak-kernel"
title: "DAK Kernel rollout"
sot: "/SOT.md"                       # optional pointer for provenance
defaults:
  gates:
    - "validator_pass"
  max_iterations: 5
  execution_permission:
    mode: "read_only"                # read_only | write_leased | yolo

nodes:
  - id: "N1"
    wih: "work_items/T1042.md"
    depends_on: []
    gates:
      - "validator_pass"
      - "tests_green"
    roles:
      orchestrator: "agent.orchestrator"
      builder: "agent.builder"
      validator: "agent.validator"
    loop:
      max_iterations: 5
      on_fail: "ralph"               # ralph | halt
    stop_conditions:
      escalate_if:
        - "missing_contract_schema"
    output:
      close_on_pass: true

  - id: "N2"
    wih: "work_items/T1043.md"
    depends_on: ["N1"]
    gates:
      - "validator_pass"
      - "lint_green"2) Semantics (authoritative rules)

2.1 Dependency execution
	•	Runner MUST topologically sort nodes.
	•	Runner MUST NOT execute a node until all depends_on are DONE.
	•	“DONE” is defined by gate success and recorded completion (via Rails event/receipt).

2.2 Node ownership
	•	Each node references exactly one WIH file.
	•	The WIH provides:
	•	allowed tools/paths, outputs, acceptance, blockers, stop conditions
	•	DAG MAY tighten constraints (add more gates), but MUST NOT loosen WIH constraints.

2.3 Gates

Gates are named checks that determine whether a node can advance.

Canonical gate names (recommended baseline)
	•	validator_pass (required by default)
	•	tests_green
	•	lint_green
	•	policy_pass (no policy violations in node event range)
	•	security_pass (if security role required)
	•	evidence_attached (required receipts present)
	•	plan_synced (plan artifacts hashes recorded and consistent)

Gate evaluation rule
	•	A gate is PASS iff the validator/evidence proves it.
	•	If any gate FAILS:
	•	follow node.loop policy (ralph loop) or halt.

2.4 Looping (Ralph loop)
	•	If on_fail: ralph, orchestrator must:
	1.	gather validator required_fixes
	2.	spawn builder with bounded fix request
	3.	re-run validator
	4.	repeat until PASS or max_iterations reached
	•	If max_iterations reached:
	•	node becomes BLOCKED and emits escalation.

2.5 Escalation
	•	stop_conditions.escalate_if triggers PromptDeltaNeeded envelopes when:
	•	requirements ambiguous
	•	missing contract/schema
	•	approval required
	•	Escalation halts the node until resolved.

2.6 Completion

A node becomes DONE iff:
	•	all gates pass
	•	validator PASS exists for that node
	•	required acceptance evidence is attached (receipts/blobs)
	•	no stop_conditions are triggered
	•	output.close_on_pass=true implies the orchestrator must request WIH close via Rails APIs.

⸻

3) Optional fields

3.1 Global policy hooks
hooks:
  on_dag_start: ["inject_policy_bundle","plan_load"]
  on_node_start: ["context_pack_compile"]
  on_node_end: ["seal_artifacts","emit_summary"]
3.2 Concurrency policy
concurrency:
  max_parallel_nodes: 2
  allow_parallel_if_no_path_overlap: true
3.3 Node-level execution permission override (tighten only)
nodes:
  - id: "N3"
    wih: "work_items/T1044.md"
    depends_on: ["N2"]
    execution_permission:
      mode: "write_leased"          # tighter than default read_only only if required
4) Example minimal DAG template
dag_version: 1
dag_id: "D0001"
title: "Example DAG"
nodes:
  - id: "N1"
    wih: "work_items/T0001.md"
    depends_on: []
    gates: ["validator_pass"]
</DAGSchema>
```
