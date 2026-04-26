# Allternit Prompt Format Spec (PFS) v1

<SECTION id="meta">
---
pfs_version: 1
name: "Allternit Prompt Format Spec"
status: locked
purpose: "Defines the canonical, reusable prompt file format used by Agent Runner prompt packs."
variable_syntax:
  required: "{{var_name}}"
  notes:
    - "Use snake_case for var_name."
    - "All variable references MUST use the exact same spelling everywhere."
sections:
  - metadata_front_matter
  - prompt_name_and_task
  - variables
  - instructions
  - workflow
  - report
  - examples
  - references
---
</SECTION>

<SECTION id="1_metadata_front_matter">
## 1) Metadata front matter (YAML) — REQUIRED

This YAML block is the machine-parsed contract for the prompt.

### Required keys
- `prompt_id`: stable identifier (e.g., `allternit.pack.core.context_prime@v1`)
- `version`: semver-ish (`v1`, `v1.1`, `v2`)
- `description`: one sentence
- `argument_hint`: CLI-style usage hint (string)
- `model`: preferred model or routing hint (`any` allowed)
- `anchors`: `input | workflow | output` (high-level intent label only)
- `allowed_tools`: list of tool IDs (or `["*"]` only for supervised modes)
- `disallowed_tools`: list of tool IDs
- `execution_permission_mode`: `default | acceptEdits | plan | dontAsk | bypassPermissions`
- `hooks_required`: list of hook stages that MUST be active for this prompt
- `outputs`: list of required artifacts (filenames or logical artifact IDs)
- `writes_policy`:
  - `workspace_root`: e.g. `.allternit/` (or other repo-defined root)
  - `allow_write_paths`: allowlist globs
  - `deny_write_paths`: denylist globs

### Optional keys
- `role`: `orchestrator | planner | builder | validator | reviewer | security | researcher`
- `timeout_s`: integer
- `max_iterations`: integer (for Ralph-loop prompts)
- `requires_lease`: boolean
- `requires_wih`: boolean
- `requires_dag_node`: boolean
- `context_pack_inputs`: list (IDs or paths)
- `tool_schema_refs`: list (paths/IDs)
- `policy_refs`: list (paths/IDs)
- `notes`: freeform list

### Codebase structure block (OPTIONAL but recommended)
Include a short, stable, human-readable tree (not exhaustive). This is not “truth”; it is a navigation hint the Agent Runner can inject.

Example:
```text
codebase_structure:
  .allternit/
    wih/            # WIH files (execution envelopes)
    dags/           # DAG specs
    ledger/         # append-only events
    receipts/       # immutable receipt blobs
  workspace/agent/
    packs/          # prompt packs
    policy/         # policy bundles + injection markers
    context/        # ContextPack builder + slicers
```
</SECTION>

<SECTION id="2_prompt_name_and_task">
## 2) Prompt name and task description — REQUIRED

A short header the user sees, plus a precise task statement.

Template:
```md
# {{PROMPT_NAME}}

**Task**: <single sentence task definition>
**Role**: <role name> (must match metadata `role` if present)
**Stop condition**: <what ends this prompt run>
```
</SECTION>

<SECTION id="3_variables">
## 3) Variables — REQUIRED

Variables are declared in a single block and referenced via `{{var_name}}`.

### Rules
- Declare every variable (static + dynamic).
- Static variables MUST have defaults.
- Dynamic variables MUST be marked `required: true`.
- Do not create new variables mid-prompt.

Template:
```yaml
variables:
  path_to_plan:
    required: true
    description: "Path to plan.md"
  plan_output_directory:
    required: true
    description: "Where to write plan artifacts (must be under workspace root)"
  user_prompt:
    required: true
    description: "Raw user request text"
  workspace_root:
    required: false
    default: ".allternit"
```
</SECTION>

<SECTION id="4_instructions">
## 4) Instructions — REQUIRED

Non-step scaffolding: assumptions, invariants, guardrails, definitions.

### Must include
- **IMPORTANT** invariants
- **DO NOT** constraints
- escalation conditions (when to stop and ask Rails / user)

Example bullets:
- IMPORTANT: Treat WIH as the narrowest authority; do not widen scope.
- DO NOT: Write outside `writes_policy.allow_write_paths`.
- IMPORTANT: Any durable state mutation must be routed through Rails (ledger/gate), not ad-hoc files.
</SECTION>

<SECTION id="5_workflow">
## 5) Workflow — REQUIRED

Step-by-step playbook for agents. Dense keywords are allowed.

### Rules
- Each step starts with `STEP <n>:` (machine-parsable).
- Explicitly state which artifacts are read/written per step.
- If loops exist, define loop bounds and exit conditions.

Template:
```md
STEP 1: Load inputs
- Read: {{path_to_plan}}, DAG node, WIH (if required)
- Validate: schemas/policies referenced in metadata

STEP 2: Execute scoped work
- IMPORTANT: Use only allowed tools
- DO NOT: create new files outside allowlist

STEP 3: Evidence + report
- Write: required report artifact(s)
- Emit: completion envelope (or “blocked” envelope)
```
</SECTION>

<SECTION id="6_report">
## 6) Report and output format — REQUIRED

Define exactly what the run must return, in a deterministic schema.

Rules:
- Prefer YAML or JSON blocks for machine ingestion.
- Include `status: PASS|FAIL|BLOCKED` and `reasons[]`.
- Include `artifacts[]` listing produced files with hashes if available.

Template:
```yaml
report:
  status: PASS|FAIL|BLOCKED
  summary: "<one line>"
  artifacts:
    - path: "<path>"
      kind: "<plan|report|patch|receipt_ref|event_ref>"
  next_actions:
    - "<bounded instruction>"
```
</SECTION>

<SECTION id="7_examples">
## 7) Examples — OPTIONAL but recommended

Provide:
- One minimal example invocation
- One “blocked” example (missing input, denied tool, etc.)
- One multi-iteration example for loop prompts
</SECTION>

<SECTION id="8_references">
## 8) References — OPTIONAL

If not embedded above, reference:
- skills/plugins/MCP tools by stable IDs
- agent personas (role cards)
- sandbox/permission mode semantics
- CLI commands the Agent Runner is expected to call
</SECTION>
