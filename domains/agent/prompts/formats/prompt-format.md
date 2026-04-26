Below are two save-ready spec files (Markdown) that lock:
	1.	Prompt Format Spec (YAML metadata + Markdown body + XML section demarcation)
	2.	Prompt Pack Index (the pack, the prompts inside it, and what each prompt contains/outputs)

You can copy these verbatim into your repo under something like:
	•	workspace/agent/packs/PROMPT_FORMAT_SPEC.md
	•	workspace/agent/packs/Allternit_PROMPT_PACK_INDEX.md

⸻

FILE 1 — PROMPT_FORMAT_SPEC.md

# Allternit Prompt Format Spec (v1.0.0)

This spec defines the canonical prompt file format for the Agent Runner system.
Prompts are versioned assets used by the runner to compile tasks, build context bundles, and produce deterministic outputs.

---

## 0) Format summary (LOCKED)

- Metadata: **YAML front matter**
- Body: **Markdown**
- Structure: **XML tags only for section demarcation**
- Variable syntax: `{{var_name}}` only
- All prompts share the same section order and IDs.

---

## 1) YAML Front Matter (Required Keys)

Every prompt MUST start with YAML front matter containing these keys:

```yaml
---
id: {{id}}                     # stable identifier (string)
name: {{name}}                 # human readable name (string)
version: {{version}}           # semver (x.y.z)
type: {{type}}                 # system|workflow|control|delegation|meta|utility
description: {{description}}   # 1–2 lines
argument_hint: {{argument_hint}}

model: {{model}}               # runner chooses actual model; prompt declares preference

execution:
  permission_mode: {{permission_mode}}     # safe|yolo|dangerously_skip_permissions
  network_policy: {{network_policy}}       # off|allowlist|on
  max_iters: {{max_iters}}                 # integer
  max_retries: {{max_retries}}             # integer

tools:
  allowed: {{allowed_tools}}               # list[str] or ["*"] for allow-all under runner enforcement
  disallowed: {{disallowed_tools}}         # list[str]

hooks:
  pre: {{pre_hooks}}                       # list[str]
  post: {{post_hooks}}                     # list[str]

storage_policy:
  writable_root: ".allternit"
  deny_writes_outside_allternit: true
  run_dir: ".allternit/runs/{{run_id}}"
  dirs:
    dag: ".allternit/runs/{{run_id}}/dag"
    wih: ".allternit/runs/{{run_id}}/wih"
    beads: ".allternit/runs/{{run_id}}/beads"
    mail: ".allternit/runs/{{run_id}}/mail"
    rail: ".allternit/runs/{{run_id}}/rail"
    reports: ".allternit/runs/{{run_id}}/reports"
  registries:
    artifacts: ".allternit/runs/{{run_id}}/ARTIFACTS.json"
    dag: ".allternit/runs/{{run_id}}/dag/DAG.json"
    wih_index: ".allternit/runs/{{run_id}}/wih/WIH.index.json"
    mail_index: ".allternit/runs/{{run_id}}/mail/MAIL.index.json"
    rail_pack: ".allternit/runs/{{run_id}}/rail/RAIL.pack.json"

crud_notes:
  safe_to_edit: {{safe_to_edit}}           # list[str] paths or keys
  do_not_edit: {{do_not_edit}}             # list[str]
---

1.1 Locked invariants

These MUST NOT be removed or weakened in any prompt:
	•	storage_policy.deny_writes_outside_allternit: true
	•	storage_policy.writable_root: ".allternit"
	•	Variable syntax is only {{var_name}}

⸻

2) Body Sections (LOCKED order + IDs)

After YAML front matter, every prompt MUST contain the following sections in this exact order.

2.1 Section list
	1.	<section id="codebase_structure">
	2.	<section id="prompt_purpose">
	3.	<section id="variables">
	4.	<section id="instructions">
	5.	<section id="workflow_play">
	6.	<section id="report">
	7.	<section id="examples">
	8.	<section id="references">

2.2 Canonical skeleton

<section id="codebase_structure">
{{codebase_tree}}
{{codebase_notes}}
</section>

<section id="prompt_purpose">
# {{name}}
{{task_description}}
</section>

<section id="variables">
## Static Variables
{{static_vars}}

## Dynamic Variables
{{dynamic_vars}}

## Variable Syntax
All variables are referenced as `{{var_name}}` exactly.
</section>

<section id="instructions">
{{instructions}}
</section>

<section id="workflow_play">
Only use dense control keywords inside this section:
IMPORTANT, MUST, DO NOT, IF, ELSE, STOP, RETURN, RETRY.

{{workflow_steps}}
</section>

<section id="report">
<output_rules>
{{output_rules}}
</output_rules>

## Deliverables
{{deliverables}}

## Formats
{{formats}}

## Validation
{{validation}}
</section>

<section id="examples">
{{examples}}
</section>

<section id="references">
{{references}}
</section>


⸻

3) Output Rules Contract (LOCKED)

Every prompt MUST embed the following rules verbatim inside <output_rules> unless the prompt is explicitly “no-write” (in which case it must say so).

### Output Rules (Anti-Drift)
- WRITE ROOT: Only write artifacts under `.allternit/`.
- DENY: Any attempt to write outside `.allternit/` MUST STOP with reason `WRITE_OUTSIDE_Allternit`.
- REGISTRY REQUIRED: Before writing any artifact, register it in `.allternit/runs/{{run_id}}/ARTIFACTS.json`:
  - fields: path, type, owner, purpose, planned_by_node
- NO IMPLICIT PATHS: Every output path MUST be enumerated in Deliverables.
- NO SIDE FILES: No additional outputs beyond Deliverables.
- HASH UPDATE: After writing, update registry with sha256, bytes, status=written.

3.1 No-write prompts

If a prompt must not write anything, it must explicitly declare in <output_rules>:
	•	“NO-WRITE PROMPT: do not write artifacts; return text-only output”

⸻

4) Prompt-to-Task Compilation Requirements (Runner-facing)

Prompts are designed to be compiled into tasks (DAG/WIH/Rail tasks). Therefore:
	•	Every prompt SHOULD declare:
	•	expected role (or allowed roles)
	•	required inputs (explicit paths/IDs)
	•	required outputs (explicit .allternit/... paths)
	•	acceptance/evidence expectations (for gates)
	•	loop policy (max iterations / escalate conditions) if used by orchestrator prompts

⸻

5) Provenance fields (Recommended standard in reports)

Prompts SHOULD include these provenance fields in their reports:
	•	run_id
	•	dag_id / node_id
	•	wih_id
	•	prompt_id + prompt_version
	•	context_pack_id
	•	policy_bundle_id
	•	execution.permission_mode

⸻

6) Versioning policy
	•	id is stable forever.
	•	version increments semver:
	•	patch: wording/clarity changes
	•	minor: additive new variables/outputs
	•	major: breaking change in deliverables or validation
	•	Never remove existing deliverables without major bump.

END

