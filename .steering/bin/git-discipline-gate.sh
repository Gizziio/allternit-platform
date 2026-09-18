#!/bin/bash
# .steering/bin/git-discipline-gate.sh — Stop hook (kimi, Claude Code, codex,
# gizzi-code). Registered per CLI; see .steering/bin/steer-install.sh.
#
# Runs scripts/git-discipline-check.sh against the SHARED checkout at every
# turn end and BLOCKS the stop if the checkout has drifted:
#   - detached HEAD, or not on main
#   - main behind or ahead of origin/main
#   - unmerged stale branches (beyond live worktrees + the allowlist)
# A dirty working tree does NOT block (another session's in-flight work may
# legitimately live there — it is downgraded to a warning via
# GIT_DISCIPLINE_SOFT_DIRTY=1); the other three conditions are never
# legitimate mid-session, so they hard-block.
#
# This is the mechanical enforcement of AGENTS.md commandment 6 ("show proof,
# not claims") and Eoj's 2026-09-18 rule: "merge to main" must mean it.
#
# Guards: no-ops outside git repos and repos without .steering/checkpoint.md.
# Escape for humans/orchestrators: STEER_GUARD_OFF=1 (same as the other hooks).
set -u
. "$(dirname "$0")/steer-common.sh"

steer_parse_payload
cwd="$STEER_CWD"

[ "${STEER_GUARD_OFF:-}" = "1" ] && exit 0

# Resolve the repo from the session cwd, then the SHARED (primary) checkout —
# sessions may be stopping from inside their own linked worktree.
top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
shared=$(git -C "$top" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2; exit}')
[ -n "$shared" ] || exit 0
[ -f "$shared/.steering/checkpoint.md" ] || exit 0

# Run the check against the shared checkout; soft-dirty so in-flight work in
# the shared checkout never blocks another session's stop.
out=$(GIT_DISCIPLINE_SOFT_DIRTY=1 bash "$shared/scripts/git-discipline-check.sh" 2>&1)
rc=$?

steer_log "$shared" "$STEER_SESSION_ID" "git-discipline rc=$rc"

[ "$rc" -eq 0 ] && exit 0

steer_block "[steering] GIT DISCIPLINE GATE — the shared checkout drifted, and a session cannot end while it has (AGENTS.md commandment 6; Eoj's rule: 'merge to main' must mean it).

$out

Fix it before stopping:
  cd \"$shared\"
  git switch main && git pull --ff-only          # if detached or behind
  git branch -d <merged-stale-branch>            # verified merged only (commandment 2)
  git branch -D <branch>                         # only if verified abandoned; unmerged
                                                 # branches are red flags — surface them
                                                 # in .steering/checkpoint.md first
Intentional long-lived unmerged branches go in .steering/git-discipline-allowlist
with a reason. Then re-run: bash scripts/git-discipline-check.sh — it must PASS.
(Human/orchestrator escape: STEER_GUARD_OFF=1.)"
