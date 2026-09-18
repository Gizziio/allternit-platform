#!/bin/bash
# git-discipline-check.sh — session-end gate for the shared checkout.
#
# Exits 0 only when ALL of the following hold:
#   1. HEAD is on `main` (never detached, never a leftover session branch)
#   2. local `main` == `origin/main` (neither behind nor ahead)
#   3. no local branch is unmerged into origin/main, except:
#      - branches checked out in another worktree (live sessions), and
#      - branches passed as arguments (intentional, e.g. `ao/swarm-mirofish`)
#   4. the working tree is clean
#
# On success it prints an evidence block — paste it verbatim into the
# session summary. On failure it prints every violation and exits 1;
# a session whose check fails is NOT done (AGENTS.md commandments 1 and 6).
#
# Usage: scripts/git-discipline-check.sh [allowed-unmerged-branch ...]

set -u
# resolve the repo root from the script's own location so it works from any cwd
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir/.."

fail=0

# --- 1. on main, not detached -------------------------------------------------
branch=$(git symbolic-ref -q --short HEAD)
if [ -z "$branch" ]; then
  echo "FAIL: detached HEAD at $(git rev-parse --short HEAD) — 'git switch main && git pull --ff-only'"
  fail=1
elif [ "$branch" != "main" ]; then
  echo "FAIL: on branch '$branch', expected 'main' — shared checkout must live on main"
  fail=1
fi

# --- 2. main == origin/main ---------------------------------------------------
git fetch origin --quiet --prune
behind=$(git rev-list --count main..origin/main 2>/dev/null || echo "?")
ahead=$(git rev-list --count origin/main..main 2>/dev/null || echo "?")
if [ "$behind" != "0" ]; then
  echo "FAIL: main is $behind commit(s) BEHIND origin/main — 'git pull --ff-only'"
  fail=1
fi
if [ "$ahead" != "0" ]; then
  echo "FAIL: main is $ahead commit(s) AHEAD of origin/main (local-only commits) — push or reset"
  fail=1
fi

# --- 3. no unmerged branches (beyond live worktrees + explicit allowlist) -----
# branches checked out in any worktree (these belong to live sessions)
worktree_branches=$(git for-each-ref --format='%(refname:short) %(worktreepath)' refs/heads \
  | awk '$2 != "" {print $1}')
allowed=$(printf '%s\n' "$@" | sort -u)
skip=$(printf '%s\n' $worktree_branches | sort -u)

unmerged=$(git branch --no-merged origin/main --format='%(refname:short)' | sort -u)
flagged=$(comm -23 <(printf '%s\n' "$unmerged" | sed '/^$/d') \
                    <(printf '%s\n%s\n' "$skip" "$allowed" | sed '/^$/d' | sort -u))
if [ -n "$flagged" ]; then
  echo "FAIL: unmerged stale branch(s) present:"
  printf '%s\n' "$flagged" | sed 's/^/  - /'
  echo "  Merge them (lifecycle step 5-6), or delete if verified abandoned (commandment 2),"
  echo "  or pass intentional ones as arguments to this script."
  fail=1
fi

# --- 4. clean tree ------------------------------------------------------------
dirty=$(git status --porcelain)
if [ -n "$dirty" ]; then
  echo "FAIL: working tree is not clean:"
  printf '%s\n' "$dirty" | sed 's/^/  /' | head -20
  fail=1
fi

# --- verdict ------------------------------------------------------------------
if [ "$fail" -eq 0 ]; then
  sha=$(git log -1 --format='%h %s')
  nbranches=$(git branch --format='%(refname:short)' | wc -l | tr -d ' ')
  echo "PASS git-discipline: on main == origin/main ($sha)"
  echo "  branches: $nbranches, unmerged: $(printf '%s\n' "$unmerged" | sed '/^$/d' | wc -l | tr -d ' ') (all live-worktree or allowlisted)"
  echo "  worktree: clean"
  exit 0
else
  echo "FAIL git-discipline: session is NOT done until every item above is resolved."
  exit 1
fi
