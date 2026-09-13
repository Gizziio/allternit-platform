# Attestation — session/skills-gate0 + session/dag-rollout (PRs #468, #469)

**When:** 2026-09-13 ~08:25–08:35 local · **Agent:** kimi-code · **Branches:** `session/skills-gate0`, `session/dag-rollout` · **Merged:** #468 `923d4e273`, #469 `b48043f7a`

## What was done

Completed the final DAG-as-default rollout items (spec delta `commrails/spec/DAG_AS_DEFAULT_TASK_SYSTEM.md`):

1. **Gate-0 skill updates (PR #468)** — added the ratified DAG-entry rule as "Gate 0" to: canonical `tools/agent-orchestrator/SKILL.md` (repo, via PR) and, in place, `~/.kimi-code/skills/agent-orchestrator/SKILL.md`, `~/.claude/skills/agent-orchestrator/SKILL.md`, `~/.kimi-code/skills/research-pipeline/SKILL.md`, `~/.claude/skills/research-pipeline/SKILL.md`, `~/.agent-orchestrator/ORCHESTRATOR.md`. Rule: orchestrated/pipeline work starts with `allternit-commrails plan new` + `wih pickup`; handoffs reference `dag:`/`wih:` ids; ≤2-step work may skip.
2. **End-to-end DAG pilot (this work item itself)** — executed entirely through the WIH lifecycle with no plan file: `plan new` → `dag_544340`/`n_6057` → `wih pickup` (`wih_3160`) → gate-checked edits → `wih close wih_3160 done <evidence>` → `runner once` auto-vaulted to `.allternit/vault/2026/dag_544340` (23 events reindexed).
3. **Rollout complete (PR #469)** — final checklist item checked; delta status → RATIFIED, rollout COMPLETE.

## Verification evidence

- `grep -c "Gate 0"` → 1 in each of the 5 skill files (+ORCHESTRATOR.md).
- Runner output: "Autopipeline: vaulted wih_3160 -> …/.allternit/vault/2026/dag_544340".
- PRs merged with merge commits per ritual.

## Incidents / honest deferrals

- **Three agent-orchestrator skill variants exist** (repo v3 canonical, `~/.claude` v3 variant, `~/.kimi-code` v2 tmux-native) — they diverge in more than this change; full reconciliation is out of scope, noted here.
- **Skills outside this set** (`lead-intake-agent`, `billing-agent`, etc.) were not given Gate 0 — they are cron-shaped agents, and the delta's consequence #4 named research-pipeline and orchestrator scopes specifically. Extend later if wanted.
- **Known pilot limitation carries forward:** queue→DAG projection is one-way (memo documents); making the sweep write node statuses back remains future work.
- Desktop rebuild skipped: docs-only changes.
