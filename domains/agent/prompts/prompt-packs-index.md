# Allternit Prompt Packs Index v1 (Agent Runner)

<SECTION id="meta">
---
pack_index_version: 1
status: locked
workspace_root: ".allternit"
variable_syntax: "{{var_name}}"
prompt_format: "PFS v1"
principle: "Prompts are versioned, parameterized templates; determinism comes from WIH+DAG+policy+hooks+receipts, not prose."
---
</SECTION>

<SECTION id="pack_core">
## Pack: core (always available)

### 1) allternit.pack.core.context_prime@v1
**Purpose**: Prime an agent session with *deterministic* context injection (AGENTS.md + policy bundle + selected specs + DAG slice + receipts slice).  
**Outputs**: `injection_marker.json` (or Rails event ref)  
**Hooks**: SessionStart, UserPromptSubmit  
**Key vars**: {{agents_md_path}}, {{policy_bundle_id}}, {{context_pack_id}}, {{dag_id}}, {{node_id}}

### 2) allternit.pack.core.normalize_request_to_wih_dag@v1
**Purpose**: Convert a user prompt into: (a) prompt provenance record, (b) mutations spec for DAG/WIH creation, without writing outside workspace.  
**Outputs**: `mutations.json`, `wih_draft.md`, `dag_patch.json`  
**Hooks**: UserPromptSubmit  
**Key vars**: {{user_prompt}}, {{project_id}}, {{workspace_root}}

### 3) allternit.pack.core.plan_with_files@v1
**Purpose**: Maintain plan.md/todo.md/progress.md/findings.md as authoritative planning artifacts (no model-memory planning).  
**Outputs**: `plan.md`, `todo.md`, `progress.md`, `findings.md`  
**Hooks**: SessionStart, PreCompact  
**Key vars**: {{plan_dir}}, {{dag_id}}

### 4) allternit.pack.core.cleanup_and_seal@v1
**Purpose**: End-of-run cleanup: ensure artifacts are in correct locations, produce manifests, and request Rails vault pipeline if needed.  
**Outputs**: `artifact_manifest.json`, `run_summary.md`  
**Hooks**: SessionEnd  
**Key vars**: {{run_id}}, {{workspace_root}}

</SECTION>

<SECTION id="pack_orchestration">
## Pack: orchestration (Ralph loops + delegation + flow control)

### 5) allternit.pack.orch.orchestrator_loop@v1
**Purpose**: Run bounded iterations until gates pass or escalation triggers.  
**Outputs**: `iteration_state.json`, `escalation_envelope.json` (when needed)  
**Hooks**: Stop, TaskCompleted  
**Key vars**: {{max_iterations}}, {{acceptance_refs}}, {{required_evidence}}

### 6) allternit.pack.orch.delegation_spawn@v1
**Purpose**: Spawn subagents/workers with role-scoped WIH + fresh context packs; enforce inheritance rules.  
**Outputs**: `spawn_requests.json` (or Rails event refs)  
**Hooks**: SubagentStart, SubagentStop  
**Key vars**: {{role}}, {{child_wih_path}}, {{context_pack_id}}, {{execution_permission_mode}}

### 7) allternit.pack.orch.control_flow@v1
**Purpose**: Conditional branching, early returns, and loop controls as structured outputs (not freeform).  
**Outputs**: `control_flow_decision.json`  
**Hooks**: Stop  
**Key vars**: {{conditions}}, {{on_true}}, {{on_false}}

</SECTION>

<SECTION id="pack_roles">
## Pack: role prompts (builder/validator/reviewer/security)

### 8) allternit.pack.role.builder@v1
**Purpose**: Implement artifacts under WIH scope; cannot self-approve completion.  
**Outputs**: `build_report.yaml` + code changes (within allowlist)  
**Hooks**: PreToolUse, PostToolUse, PostToolUseFailure  
**Key vars**: {{wih_path}}, {{allowed_paths}}, {{allowed_tools}}

### 9) allternit.pack.role.validator@v1
**Purpose**: Evaluate against WIH acceptance + contracts + evidence; cannot implement.  
**Outputs**: `validator_report.yaml` (PASS/FAIL + bounded fix list)  
**Hooks**: PreToolUse, PostToolUse, Stop  
**Key vars**: {{wih_path}}, {{artifacts}}, {{test_logs}}

### 10) allternit.pack.role.reviewer@v1
**Purpose**: Architectural review + risk review; produces actionable review diffs only.  
**Outputs**: `review_report.md`  
**Hooks**: Stop  
**Key vars**: {{diff}}, {{architecture_refs}}

### 11) allternit.pack.role.security@v1
**Purpose**: Threat delta + policy compliance verdict; can request escalation/approval gates.  
**Outputs**: `security_report.yaml`  
**Hooks**: PreToolUse, PermissionRequest, Stop  
**Key vars**: {{wih_path}}, {{policy_refs}}

</SECTION>

<SECTION id="pack_evidence">
## Pack: evidence + observability

### 12) allternit.pack.evidence.receipt_emit@v1
**Purpose**: Package evidence/receipts and submit via Rails APIs only (no “truth files”).  
**Outputs**: `receipt_bundle.json` (or Rails receipt refs)  
**Hooks**: PostToolUse, PostToolUseFailure  
**Key vars**: {{run_id}}, {{wih_id}}, {{artifact_manifest}}

### 13) allternit.pack.evidence.trace_summarize@v1
**Purpose**: Produce derived compaction summaries that reference event ranges and receipt IDs; never overwrite ledger truth.  
**Outputs**: `compaction_summary.md`  
**Hooks**: PreCompact  
**Key vars**: {{from_event_id}}, {{to_event_id}}, {{method_version}}

</SECTION>
