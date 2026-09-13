# Attestation — session/dag-ratify (PR #461)

**When:** 2026-09-13 ~00:26–00:35 local · **Agent:** kimi-code · **Branch:** `session/dag-ratify` · **Merged:** `57860b8c7b0ca59387a3287a75721e6e99ac5273`

## What was done

Ratified the spec delta from PR #459 (owner decision "yes", 2026-09-13):

1. `commrails/spec/DAG_AS_DEFAULT_TASK_SYSTEM.md` — status DRAFT → RATIFIED (decision). Ticket-system identity resolved as **(a)**: the standalone ticket DAG (`src/tickets/`, `cli/`) is out-of-scope tooling for foreign repos, never a work-tracking channel inside this tree. Rollout checklist kept in-file: decision + AGENTS.md items checked; Research-queue pilot and end-to-end multi-session pilot remain open.
2. `AGENTS.md` — session-lifecycle step 2 and the "Planning and task tracking" section rewritten: multi-step work (>2 steps, or anything cross-session) must enter the WIH DAG via `allternit-commrails plan new` before execution; markdown plan files are pre-DAG scratch only; handoffs reference `dag:<dag_id>` / `wih:<wih_id>`; no dual tracking.

This makes the DAG rule deterministic where it previously lived in the delta's proposal text only.

## How it works

Docs-only. No code, no gates, no mechanics changed — the rule now has an authoritative home (`AGENTS.md`) pointing at the ratified spec (`commrails/spec/DAG_AS_DEFAULT_TASK_SYSTEM.md`).

## Verification evidence

- Docs-only change; no build/test surface affected.
- Post-merge `origin/main` verified at `57860b8c7` (merge of #461) before attesting.

## Incidents / honest deferrals

- **Rollout not complete:** the two pilot checklist items (Research queue DAG projection; one end-to-end multi-session work item through plan → pickup → gates → vault) are deliberately deferred and tracked in the spec file. Skills that instruct ad-hoc todo tracking (`research-pipeline`, agent-orchestrator scopes) still need their leading `plan new` step — also deferred, noted in the delta's Consequences #4.
- **Process note (lessons from PR #459 attestation):** attestation was written in a scratch worktree off `origin/main` and pushed `HEAD:main`, because the shared checkout is occupied by another session's branch (`ao/platform-console-agents`). Shared checkout left untouched this time.
- Desktop rebuild (lifecycle step 8) skipped: docs-only change, nothing binary-affecting in bundled crates.
