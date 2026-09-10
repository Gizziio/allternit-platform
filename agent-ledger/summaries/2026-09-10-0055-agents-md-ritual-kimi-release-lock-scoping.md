# Agent Work Attestation — docs/agents-md-ritual

**Date:** 2026-09-10 00:55
**Session ID:** agents-md-ritual
**Branch:** session/agents-md-ritual
**Agent:** kimi
**Commit:** c04f59e75 (merge commit 3d337c27c, PR #230)
**Ledger entry:** [../LEDGER.md](../LEDGER.md)

## What was done

Owner-directed precision cuts to the AGENTS.md desktop release-lock
commandments (owner: "the desktop ritual is too limiting — does it stop
subsequent agents from working?"):

- **Commandment 6 scoped.** A red release workflow now pauses release-path
  work only; all other repo work continues. The fix is due before the next
  desktop release is cut, tracked via an issue or ledger entry naming the
  failing run — not an absolute block on unrelated sessions. The
  never-repoint-a-tag-to-dodge-a-failure clause is unchanged.
- **Worktree ownership rule added** to the session-worktrees section. A
  worktree belongs to its session; never checkout/switch/reset/merge/rebase in
  a worktree you did not create. Non-session worktrees (e.g.
  `allternit-desktop-preview`) move forward only: fetch + detach at newer
  origin/main — never sideways to another branch, never backwards. Documents
  the 2026-09-09 incident where an outside process checking out origin/main in
  the preview worktree wiped the shell-rail session's uncommitted edit pass
  (recovered by re-application, PR #219).
- Header LAST UPDATED stamped 2026-09-10.

## How it works

Docs-only; no code, workflow, or config changes. Commandments 1–5 untouched
(tag lock, release-path preflight 26/0, sidecar hard requirements,
production-compile verification, Windows gotchas). Commandment 2's preflight
gate is not triggered by this PR because no release-path files changed.

## Verification

- `git diff --stat`: AGENTS.md only, +4/−2.
- Read-back of both edited sections against the intent (scoping language,
  forward-only rule, incident rationale).

## Known gaps / remaining work

- The worktree-ownership rule is convention, not enforcement — the PreToolUse
  guard still only protects the shared main checkout. If wipes recur, consider
  extending the guard to detect non-owner checkouts (e.g. lockfile keyed by
  session id in each session worktree).
- Related, still open from the same owner review thread: desktop binary
  build-number stamping (buildVersion + local artifact suffix) was proposed as
  option 1 but not yet commissioned.

## Files changed

- `AGENTS.md`
