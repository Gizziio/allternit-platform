---

— Allternit_PROMPT_PACK_INDEX.md

```md
# Allternit Prompt Pack Index (v1.0.0)

This document locks the initial prompt packs and the prompts inside them.
Each prompt is a deterministic template conforming to PROMPT_FORMAT_SPEC.md.

---

## PACK A — Allternit Core Orchestration Pack (v1.0.0)

Purpose: Minimal set to run deterministic agentic engineering loops:
Policy injection → ContextPack → DAG/WIH → Rail task pack → Orchestrate → Verify → Cleanup.

### Prompts in Pack A

#### A01 — SYS.PRIME
- Type: system
- Purpose: Global invariants, tool gating, anti-drift rules, provenance expectations.
- Contains:
  - strict “no writes outside .allternit” enforcement reminder
  - minimal “MissingInputs” behavior
  - final Checklist requirement

#### A02 — POLICY.BUNDLE.BUILDER
- Type: utility
- Purpose: Deterministic policy injection bundle builder.
- Inputs:
  - repo AGENTS.md
  - `.allternit/agents/*` role policies
  - selected spec excerpts (optional, by WIH)
- Outputs (.allternit):
  - `.allternit/runs/{{run_id}}/reports/PolicyBundle.md`
  - `.allternit/runs/{{run_id}}/reports/InjectionMarker.json`
- Validation:
  - deterministic ordering
  - hash of AGENTS.md recorded
  - injection marker includes policy_bundle_id

#### A03 — CONTEXTPACK.BUILDER
- Type: utility
- Purpose: Build sealed ContextPack recipe from Rails truth + policy bundle + DAG slice + receipts.
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/ContextPack.md`
  - `.allternit/runs/{{run_id}}/reports/ContextPack.seal.json`
- Validation:
  - includes: policy bundle ref, DAG slice ref, receipt refs, leases ref (if present)
  - seal includes method_version + input refs

#### A04 — DAG.WIH.PLANNER
- Type: workflow
- Purpose: Convert goal into DAG.json + WIH nodes (WIH per DAG node).
- Outputs:
  - `.allternit/runs/{{run_id}}/dag/DAG.json`
  - `.allternit/runs/{{run_id}}/wih/N###.md`
  - `.allternit/runs/{{run_id}}/wih/WIH.index.json`
- Must include in WIH:
  - role
  - inputs/outputs
  - acceptance_checks
  - evidence refs
  - loop policy fields (max_iterations, escalation rules)

#### A05 — RAIL.TASKPACK.BUILDER
- Type: utility
- Purpose: Compile DAG/WIH into rail-ingestible task pack.
- Outputs:
  - `.allternit/runs/{{run_id}}/rail/RAIL.pack.json`
  - `.allternit/runs/{{run_id}}/rail/RAIL.map.json`
- Task fields inside RAIL.pack.json:
  - task_id (node id)
  - role
  - deps[]
  - inputs[] / outputs[]
  - allowed_tools
  - permission_mode
  - acceptance_checks[]
  - stop_conditions[]
  - context_bundle_refs (PolicyBundle + ContextPack + node slice)

#### A06 — ORCH.RALPH.LOOP
- Type: control/workflow
- Purpose: Orchestrator loop controller (Plan→Act→Verify→Fix).
- Behavior:
  - drives iterations until gates pass or escalation triggers
  - spawns subagents with fresh contexts per policy
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/LoopLog.md`
  - `.allternit/runs/{{run_id}}/mail/*.md` handoffs (optional)
- Validation:
  - logs iteration transitions and reasons

#### A07 — WORKER.PLAN.ONLY
- Type: workflow
- Purpose: Generate plan for a node; no code changes.
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/PlanReceipt.md`
- Validation:
  - plan maps directly to WIH acceptance checks and outputs

#### A08 — WORKER.BUILD.WITH.PROVENANCE
- Type: workflow
- Purpose: Implement node outputs under strict write policy.
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/BuildReceipt.md`
  - (optionally) patch artifacts under `.allternit/runs/{{run_id}}/...` if you’re doing “propose changes” mode
- Validation:
  - no writes outside `.allternit`
  - registry updated
  - provenance fields present

#### A09 — WORKER.REVIEW.ONLY
- Type: workflow
- Purpose: Review changes/evidence; no writes to repo truth.
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/ReviewReceipt.md`
- Validation:
  - pass/fail + risks + required fixes

#### A10 — WORKER.VERIFY.DEFAULT
- Type: workflow
- Purpose: Verification gate (tests, contract checks, acceptance checks).
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/VerifyReceipt.md`
- Validation:
  - explicit pass/fail against acceptance_checks
  - missing evidence list if fail

#### A11 — EVIDENCE.AUDITOR
- Type: utility
- Purpose: Check whether receipts/evidence satisfy acceptance refs.
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/EvidenceAudit.md`
- Validation:
  - enumerates which acceptance checks are satisfied and by what evidence IDs

#### A12 — CLEANUP.RECONCILE
- Type: utility
- Purpose: Reconcile registry, detect unregistered artifacts, close mail threads, produce cleanup actions.
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/CleanupReport.md`
- Validation:
  - lists mismatches, proposed deletes, unresolved mail

---

## PACK B — Allternit Memory & Reinjection Pack (v1.0.0)

Purpose: Deterministic compaction + reinjection + CTR policy integration (runner-enforced).

### Prompts in Pack B

#### B01 — COMPACTION.DERIVE
- Type: utility
- Purpose: Produce derived compaction artifact from an event/receipt slice.
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/CompactionSummary.md`
  - `.allternit/runs/{{run_id}}/reports/CompactionSeal.json`
- Validation:
  - includes: input event range, receipt IDs, method_version

#### B02 — REINJECTION.POLICY
- Type: utility
- Purpose: Emit reinjection rules for new contexts (what gets injected and when).
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/ReinjectionPolicy.md`
- Validation:
  - explicit triggers: new spawn, new iteration, post-compaction, cwd change

#### B03 — CTR.HOOK.CONFIG
- Type: utility
- Purpose: Produce tool-risk retrieval profiles (thresholds, dedup rules) for PreToolUse.
- Outputs:
  - `.allternit/runs/{{run_id}}/reports/CTRConfig.json`
- Validation:
  - per-tool thresholds + dedup rules + max injected items

---

## Notes on Execution Modes

All prompts declare:
- execution.permission_mode: safe | yolo | dangerously_skip_permissions

Runner interprets and maps these to CLI flags / tool policies.
Prompts do not mention “sandbox” except as an optional execution mode in specific contexts.

END


