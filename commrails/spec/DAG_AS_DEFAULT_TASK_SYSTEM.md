# DAG as the Default Task System (Spec Delta)

Status: DRAFT — proposed 2026-09-13. Not yet ratified. Supersedes nothing until
the ratification checklist at the bottom is complete.

## Problem

Today, whether multi-step work is tracked in the WIH DAG or in an ad-hoc plan
file is the agent's discretion. The repo's own `AGENTS.md:67-76` prescribes
plain plan files as "the source of truth for the session" and never mentions
`allternit-commrails plan`/`wih`. Result: the DAG is the architecturally
canonical work representation *inside* commrails, but most agent sessions never
touch it, so cross-session work has no provable identity, no gate receipts, and
no vault trail.

## Proposal

The WIH DAG is the deterministic default for **all multi-step work** performed
by any agent session in this tree. One rule:

> If a session expects to take more than two steps, or its work will be picked
> up, reviewed, or continued by another session, it must be represented as DAG
> nodes under a `plan` before execution. Two-step-or-less work may stay
> ephemeral.

"Deterministic" means: not a style preference, not a judgment call. The gate
already enforces provenance for mutations *inside* the system; this delta
extends the boundary outward so work must *enter* the system to count.

## Consequences

1. **Plan files are demoted, not deleted.** A plan file may still exist as a
   scratch outline *while* drafting a `plan new`, but it ceases to be "the
   source of truth" the moment the DAG exists. Session handoffs reference
   `dag:<dag_id>` / `wih:<wih_id>` (matching `spec/MAIL_SCOPE.md:11-14`),
   never a path to a plan file.
2. **`AGENTS.md:67-76` is amended** to say: multi-step work starts with
   `allternit-commrails plan new`, todos live as DAG node statuses, and
   readiness comes from `ready_nodes` — not from a checklist in a markdown
   file.
3. **Research pipeline and queue docs migrate last.** The Research queue's
   stage model (inbox → baseline → … → spec_ready) maps naturally onto a DAG
   template; a one-time projection of open queue items into DAG nodes is part
   of ratification, not prerequisite for it.
4. **Skill/harness updates.** Any skill that currently instructs ad-hoc todo
   tracking (`research-pipeline`, agent-orchestrator scopes, etc.) gains a
   leading step: `plan new` unless the work is provably ≤2 steps.

## Non-goals

- No change to the ledger, gate mechanics, WIH lifecycle, or vault pipeline —
  they already do the right thing. This delta only changes *what enters* the
  system.
- No automatic executor. `ready_nodes` stays derived-on-demand; runners and
  orchestrators keep driving execution per-WIH.

## Open question that must be resolved before ratification

The Work Identity Law (`spec/SPEC_OVERVIEW.md:9`) says `dag_id` is the
canonical work ID with **no separate ticket entity**, yet the crate ships a
full Beads-style ticket DAG (`src/tickets/`, `cli/`). Routing all work through
the WIH DAG forces a decision:

- **(a) Ticket system is out-of-scope tooling** — a standalone CLI usable in
  foreign repos, documented as such, and never used inside this tree; or
- **(b) Ticket system is removed/merged** — its dependency analytics move onto
  WIH edges, and `cli/` is retired.

This delta assumes (a) is sufficient. If (b) is chosen instead, ratification
waits on the merge.

## Failure modes to guard against

- **Ceremony inflation**: agents creating DAGs for trivial 2-step work. The
  ≤2-step escape hatch stays; the gate does not police it, review does.
- **Ghost DAGs**: plans created and never progressed. `ready_nodes` output
  becomes part of session handoff review; Dags with no status change within N
  days are surfaced (runner concern, future delta).
- **Dual tracking**: a plan file and a DAG both claiming to be truth. The rule
  is temporal — plan file is pre-DAG scratch only — and `AGENTS.md` language
  must say so unambiguously.

## Ratification checklist

- [ ] Decision recorded: ticket system (a) or (b).
- [ ] `AGENTS.md` planning section rewritten.
- [ ] One queue (Research) projected into DAG nodes as the pilot.
- [ ] At least one full multi-session work item completed end-to-end via
      plan → pickup → gates → vault with no parallel plan file.
- [ ] This file's Status changed to RATIFIED with the date.
