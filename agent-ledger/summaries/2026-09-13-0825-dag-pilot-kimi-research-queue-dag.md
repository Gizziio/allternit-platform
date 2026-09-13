# Attestation — session/dag-pilot (PR #467)

**When:** 2026-09-13 ~00:45–08:25 local (overnight wall-clock; active work ~1h) · **Agent:** kimi-code · **Branch:** `session/dag-pilot` · **Merged:** `668644a3dfa6f7008fe1c1ef6bd4c02c3d2a9b23`

## What was done

Executed the Research-queue DAG pilot — the ratified spec delta's first rollout item (PR #461 checklist):

- Projected the open Research queue (`Allternit Brain/Research/queue.json`, 38 open items at snapshot: 25 researched / 6 inbox / 5 spec_ready / 2 watch) into a CommRails WIH DAG in the Brain workspace root.
- **Plan `dag_505836`** (prompt `p_798882`, root `n_7416`, refine delta `d_531176`): 38 item nodes, `node_id` = queue item id, child of root, `node_kind: task`, `execution_mode: shared`, no `blocked_by` edges. All 39 nodes READY per `wih list --ready`.
- Ledger + DAG state live at `Allternit Brain/.allternit/` — next to the queue they track. First use of the Brain root auto-injected a policy bundle (hashes the root's AGENTS.md).
- Brain vault: memo `Research/memos/dag-pilot-2026-09-13.md` (frontmatter per Brain rules, linked from `Research/INDEX.md`, `Dashboard/Log.md` line, audit run, committed `3ea2709`).
- Platform: spec checklist item checked off (PR #467).

## Verification evidence

- `plan show dag_505836` → 39 nodes, all `status: "READY"`.
- `wih list --ready` → 39 rows.
- Generator + mutation JSON shape (`{"op":"create_node",...}`) documented in the memo.

## Incidents / honest deferrals

- **Queue moved under the projection:** count went 39 → 38 mid-flight (`rq-20260912-005` left `approved` — another sweep was working the queue concurrently). Plan text says "39", actual 38 — cosmetic, noted in memo.
- **Transient Desktop EPERM:** macOS TCC denied Desktop access to this process twice mid-session (~2 min window). First hit surfaced as a confusing "policy injection required" gate error — retried after access returned and it worked. No state corruption.
- **One-way projection, by design:** node statuses do not flow back to `queue.json`; nothing prevents re-projection duplication. Next sweep integration should close the loop (memo lists this as the top limitation).
- **spec_ready items appear READY** — human-gate rule is a title convention, not gate-enforced. Deliberate pilot simplification.
- **Remaining rollout item:** one end-to-end multi-session work item via plan → pickup → gates → vault with no parallel plan file. Deliberately deferred — needs a real work item to ride it, not a synthetic one.
- Desktop rebuild skipped: no code changed.
