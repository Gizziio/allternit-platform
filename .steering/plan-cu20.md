# Plan — session/cu20-teachbatch (stagehand-batch-fork deferrals)

Spec: `stagehand-batch-fork.md` "Deferred with notes" items. P0–P3 landed (#415/#430/#433/#434). Quota: commit after every sub-deliverable; stop exploring at 90 min, land current state.

## A — record→teach→batch workflow compilation
- [ ] Read `workflow_runner.py` (EXECUTOR_ACTION_MAP, per-step dispatch, {{param}} substitution), `batch_dispatch.py`, `planning_loop.py`
- [ ] Compile `BrowserWorkflowSpec` → ONE batch descriptor at run start when: all steps batch-mappable (whitelist vocab, same page binding, no per-step approval in `safety.requiresApprovalFor`)
- [ ] Fallback on grant decline/failure or unbatchable step: resume per-step runner at failed step, no silent retry of completed steps
- [ ] Env/flag opt-out of batching (per-step path byte-for-byte available)
- [ ] `model_turns_saved` → same ledger event the planning loop uses
- [ ] Commit A

## B — automatic page binding for batch descriptors
- [ ] Planning loop reads current URL from sidecar observation result (`observation.url`), pins NEXT batch's descriptor binding; operator `batch_page_url` still overrides
- [ ] No URL in observation → keep origin+session binding
- [ ] Append to session-preservation contract, bump version note
- [ ] Commit B

## C — aci one-shot flake
- [ ] Run `cargo test -p allternit-api --lib aci_` (named + nocapture, single-threaded and default, ≥6 runs or reproduce)
- [ ] Fix if small+obvious, else document precisely
- [ ] Commit C

## Verification
- [ ] Targeted python suites before/after counts
- [ ] Live smoke: teach 3-step workflow → compiled-batch run (1 grant) → same workflow forced per-step (opt-out) → receipts correct
- [ ] `cargo test -p allternit-api --lib aci_batch` 19/19; full aci_ suite clean (cite runs)
- [ ] `node scripts/release-preflight.mjs` (report score)
- [ ] Runtime `pnpm run typecheck`+`build` if sidecar touched

## Landing
- [ ] Push, PR, wait checks, merge, attestation + LEDGER line via detached worktree push to main
- [ ] Remove ALL worktrees created (incl. ledger), delete branch local+remote, report SHAs
