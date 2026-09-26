# Checkpoint — session/subsfab-p3

## Goal
Execute docs/specs/subscription-fabric/p3/P3_PHASE_1_TASK.md: subscription-gateway worker layer + artifact store (fake-adapter tested). Deliverables: artifacts/store.ts, queue/scheduler.ts, worker/{supervisor,worker,reconcile,detach,progress}.ts, http enqueue wiring, vitest suite, P3_PHASE_1_NOTES.md sentinel.

## Just did
All deliverables implemented and verified: artifact store (content-addressed, quarantine xattr, sha256 + magic-byte MIME verify, relative local_path), pure priority scheduler, worker executor (durable two-write markSubmitted, full AdapterEvent consumption incl. quota/model/needs_user/detach, submission_ambiguous on sent_unconfirmed errors), supervisor (reconcile-before-resume gate, stall watchdog 90s/1200s config-overridable), reconcile sweep (§A2 outcomes), detach watch scheduler (backoff cap 15min, read-only watch ctx), progress bridge, http enqueue wiring. Gates: build PASS, 108/108 tests PASS (77 P1 green), no provider literals. NOTES sentinel written at docs/specs/subscription-fabric/p3/P3_PHASE_1_NOTES.md.

## Next
Session lifecycle: commit + push session/subsfab-p3, PR, merge (--merge), sync shared checkout, ledger attestation, worktree cleanup, git-discipline-check.

## Open questions
None.

---

# Checkpoint — session/gizzi-tui-parity (parallel session, keep both)

## Goal
gizzi-code TUI parity program (8 phases, owner-approved plan; dag:dag_625298 / wih_8397). P0–P3 landed (PRs #743–#746); P4 (telemetry surfaces) implemented, merging.

## Just did
- P0–P3 landed: permission bypass fix, animated startup screen, streaming/tool polish, organized /model picker (ledger summaries 0434/0442/0447/0518).
- P4 IMPLEMENTED (coder subagent, reviewed): per-turn SystemRunTelemetryMessage (cost-tracker diffs, wall time, tool count, context block-bar, tightest quota chip; never-fabricate assembly in utils/telemetry/) + /usage Plan quota section. 20 new tests; 45/45 components+commands; typecheck clean; preflight 52/0; /usage honest path pty-verified. Per-turn line not exercised live (no quota spend).

## Next
- Land P4 (PR #748 — resolving this checkpoint conflict), then P5: artifacts — fix /artifact Gemini leftover path (commands/artifact/artifact.tsx:19-25), markdown viewer, FilePathLink open, inline created-file cards.

## Open questions
- .steering/checkpoint.md is shared across parallel sessions and conflicts on every merge — resolution convention used here: keep both sessions' sections, active session on top.
