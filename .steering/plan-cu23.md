# Plan — cu23 code mode (P4 code-mode-execution, C0–C3)

**Goal:** Sandboxed code execution as a third, opt-in integration mode behind the
existing grant gate. Grant over code payload, microVM/sandbox-only execution,
fixed result envelope, timeout caps, never default.

**Just did:** Worktree `allternit-cu23` on `session/cu23-codemode` from
origin/main (2992df297). Read both specs + substrate (aci_batch.rs,
batch_dispatch.py, planning_loop.py, sandbox_env.py, session-preservation contract).

**Next:**
1. ~~C0~~ done — `aci_code.rs` (17 tests green), committed with C1+C2 as one
   landable unit.
2. ~~C1~~ done — `code_execution.py` + `code_runner.mjs` (17 tests green).
3. ~~C2~~ done — loop integration + contract §8 + `code_mode.py` (10 tests green).
4. C3 — live smoke (scripts/code_mode_smoke.sh; server building), safety.md
   subsection, release-preflight. Commit.
5. Verify + land: cargo aci suites, python suites, PR, merge, attestation, cleanup.

**Open questions:** none — spec binding. pyautogui-python accepted in descriptor
allowlist but executor v1 is playwright-js only (honest deferral, spec allows).
