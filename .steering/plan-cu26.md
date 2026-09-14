# Plan — session/cu26-realmodel-rerun (verify F1 turn-saving with a frontier model)

Goal: re-run the cu22 real-model campaign against FIXED main (PR #480 F1 + PR #484
migration fix) to verify the observation-disconnect fix delivers turn savings
end-to-end with gpt-6-astra via the codex-CLI brain path. Same five tasks as cu22.

## Todos
- [x] Worktree `allternit-cu26` from origin/main (branch session/cu26-realmodel-rerun)
- [x] Adapt cu22 harness → tmp-cu26-realmodel (own ports 18081/9223/18113; per-arm evidence)
- [ ] Stack: cargo build allternit-api (bg), site :18081, Chrome CDP :9333, api :18113
- [ ] A: real-model smoke (a_smoke.py) — one logged frontier inference
- [ ] B: arm (c) batched+f1 all 5 tasks; arm (a) per-step all 5 tasks; arm (b) pre-f1
      (strip post_batch_observation client-side) at least extract-then-act + form-fill
- [ ] C: docs/public/aci/safety.md batch section — re-measured numbers, honest caveats
- [ ] Verification: cargo aci_batch tests, python touched suites, release-preflight
- [ ] Landing: push, PR, checks, merge, attestation + LEDGER, remove worktrees/branches

## Arms (same tasks each)
- (a) per-step baseline — mode=per-step
- (c) batch + F1 — mode=batched --arm f1 (post_batch_observation through real path)
- (b) batch pre-F1 — mode=batched --arm pre-f1 (harness strips the observation field;
      faithful pre-PR#480 semantics, no product code touched)

## Decisive numbers
model turns, dispatches, grants issued, steps succeeded, end-to-end task success.
F1 claim to verify: batched turns approach the P2 scripted ratio (4-step batch = 2
turns) instead of cu22's 28-vs-13 anti-result; grant amplification gone (1 grant per
batch, not 12 on extract-then-act).

## Honesty rules
No silent retries; task failed if the loop halts or the harness human-gate isn't
approved within limits; every real model call logged (tokens in/out); scripted human
gate only where cu22 used one. If the CLI brain path is down/quota-blocked: STOP and
report — no synthetic numbers.

## Quota discipline
Commit after every sub-deliverable; at 90 min stop, push, open PR, report.
