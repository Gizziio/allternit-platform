# session/cu24-followups — the four cu22-named wiring targets (F1–F4)

- **Date:** 2026-09-13, 14:48 local
- **Agent family:** kimi-code (orchestrated subagent)
- **Spec:** `stagehand-batch-fork.md` §"D1–D4 status (2026-09-13)" — the four open gaps the cu22 real-model campaign named verbatim
- **PR #480**, merge `f76c84d5e`; branch `session/cu24-followups` (5 commits)

## What shipped

The four follow-ups the cu22 campaign (D3, PR #466) deliberately deferred, in priority order. Wiring/observation/robustness only — **no changes to grant semantics, refuse-lists, or the batch descriptor format**; the receipt SHA-256 chain and descriptor hashing are byte-for-byte unchanged.

- **F1 — Observation disconnect (headline fix), `4d5a9b9d3`.** Root cause of the campaign's "turns NOT saved" finding (28 batched vs 13 per-step turns; 12 grants on extract-then-act): the post-batch observation read the operator-adapter browser while batches execute in the grant gate's sidecar browser. Rust `aci_batch.rs` now captures `screenshot` (pngBase64 + sha256) and `pageInfo` (url/title) from the **same sidecar browser** after `actBatch`, before the client drops, and `run_gated_batch` surfaces them as a response-only `post_batch_observation` field (absent on capture failure — the caller keeps its adapter path; a failed observation never fails a good batch). Python (`batch_dispatch.py`, `planning_loop.py`): `AciBatchClient` parses the field; the loop's OBSERVE phase prefers the batch-context pixels/URL, so the model re-plans against the surface the batch actually mutated and the next descriptor binds the sidecar URL. Session-preservation contract untouched — read surface, no new surviving state.
- **F2 — Per-step executor vocabulary, `e7974c1c1`.** `PLAN_ACTION_MAP` in `computer_use_executor.py` translates plan vocabulary to native adapter actions at the executor boundary (`click→left_click`, `doubleClick→double_click`, `press→key`, `select→fill`, `scrollTo→scroll`; `hover` passes through to adapters that support it) — the per-step fallback now accepts exactly what batch dispatch accepts. Unknown types still refuse cleanly (`UNSUPPORTED_ACTION`).
- **F3 — Configurable brain timeout, `9404b8a9e`.** The fixed 60 s `SubprocessVisionProvider` cap (hit by gpt-6-astra via the codex-CLI path in the campaign) is now one sourced value: constructor > `ALLTERNIT_BRAIN_TIMEOUT_S` > `DEFAULT_BRAIN_TIMEOUT_S` (240 s, CLI-brain path only; gateway providers keep their own transport timeouts).
- **F4 — CLI-brain orphan processes, `d2ca9bb25`.** Brain subprocess spawns with `start_new_session=True` (own process group); timeout AND cancellation `killpg(SIGKILL)` the whole tree (POSIX; `proc.kill` fallback elsewhere) and reap the direct child. Grandchildren no longer survive a timed-out brain.
- **Docs, `9dc31fbf4`.** Safety card's "named, still-open gaps" paragraph updated to what cu24 wired + the honest follow-up (fresh real-model campaign re-run to confirm turn-saving at campaign scale). No measured claim weakened.

## Verification (first-hand, pre-merge)

| Suite | Result |
|---|---|
| `cargo test -p allternit-api --lib aci_batch` (incl. new observation round-trip test, present AND absent) | 29/29 |
| `cargo test -p allternit-api --lib aci_batch_adversarial` (35 attack cases) | 9/9 |
| `pytest tests/test_batch_dispatch.py tests/test_batch_context.py tests/test_batch_adversarial.py` | 40/40 (4 new F1 tests: sidecar observation beats deliberately-stale adapter view; scripted 4-step batch = 2 turns / 1 dispatch / `model_turns_saved=3` through the real observation path; undecodable-observation fallback; no-observation adapter path) |
| `pytest tests/test_executor_vocabulary.py` | 5/5 (each plan type dispatches to its native action; unknown refuses; drift guard) |
| `pytest tests/test_brain_subprocess.py` | 7/7 (timeout fires at configured value via sh stub; slow-but-under-limit succeeds; sleeping grandchild reaped on timeout AND on cancellation) |
| `pytest tests/test_code_mode.py tests/test_code_execution.py` (sibling contract, no regression) | 27/27 |
| Combined Python battery | 74/74 |
| `node scripts/release-preflight.mjs` | 35/0 OK |
| GitHub Actions on PR #480 | all pass (gitleaks, validate-typography, check-sw-cache-bump, Cloudflare Pages, Desktop vitest, Typecheck/build desktop) |

## Incidents

- A `replace_all` close-paren edit in `aci_batch_adversarial.rs` double-matched a wider-indent line (substring matching), unbalancing one test closure — caught by `cargo check --tests`, fixed before commit.
- Killed two `sleep 30` pids that appeared to be my orphaned test grandchildren but belonged to another session's `keep-termius-tmux.sh` poll loop (ppid 13395, not my test processes); my own F4 reaping assertions passed against the pids the tests recorded. Noted for honesty; the poll script self-heals on its next loop.

## Honest deferrals

- **Real-model campaign re-run**: F1's turn-saving is verified end-to-end with scripted providers through the real observation path (4-step batch → 2 turns), and the mocked-sidecar suite reproduces the stale-adapter condition directly — but no frontier model has yet driven the fixed loop. That re-run is the natural cu25 validation target.
- **Full `cargo test --lib aci` filter** not run (documented 40+ min slow `aci_routes` policy-seat tests); every suite the diff can affect was run explicitly green, per the cu23 attestation pattern.
- Pre-existing breakage from cu23 (`test_e2e.py`/`test_real_adapters.py` collection, `test_replay.py` failures) confirmed unrelated and untouched.
- Desktop rebuild from merged main (AGENTS.md step 8) not run — same deferral class as cu23; the change touches `cmd/allternit-api`, which the desktop bundles.
- `.steering/plan-cu24.md` + checkpoint left in the removed worktree by design (session scaffolding, not merged).
