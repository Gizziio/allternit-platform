#!/bin/bash
# .steering/bin/worktree-guard-test.sh — offline tests for session-worktree.sh
# and guard-main-checkout.sh. PASS/FAIL lines, non-zero exit on any FAIL.
set -uo pipefail

BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d /tmp/wt-guard-test-XXXXXX)"
export TMP
failures=0
check() { local name="$1"; shift; if "$@"; then echo "PASS: $name"; else failures=$((failures+1)); echo "FAIL: $name"; fi }

# ─── Sandbox steering repo + a linked worktree ───────────────────────────────

REPO="$TMP/repo"
mkdir -p "$REPO/.steering/state"
git -C "$REPO" init -q 2>/dev/null
touch "$REPO/.steering/checkpoint.md"
git -C "$REPO" add .steering/checkpoint.md
git -C "$REPO" -c user.email=t@t -c user.name=t commit -qm init
git -C "$REPO" worktree add -q "$REPO-session-abc123" -b session/abc123 2>/dev/null

PLAIN="$TMP/plain"
mkdir -p "$PLAIN"; git -C "$PLAIN" init -q

pay() { python3 -c 'import json,sys; print(json.dumps({"session_id":sys.argv[1],"cwd":sys.argv[2]}))' "$1" "$2"; }
pay_bash() { python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]},"session_id":"t","cwd":sys.argv[2]}))' "$1" "$2"; }
pay_gizzi() { python3 -c 'import json,sys; print(json.dumps({"input":{"tool_input":{"command":sys.argv[1]}},"session_id":"t","cwd":sys.argv[2]}))' "$1" "$2"; }
export -f pay pay_bash pay_gizzi

# ─── session-worktree.sh ─────────────────────────────────────────────────────

out="$(pay s1 "$REPO" | bash "$BIN/session-worktree.sh")"
check "W1: shared checkout gets the ritual" bash -c "printf '%s' \"\$0\" | grep -q 'SESSION WORKTREE REQUIRED' && printf '%s' \"\$0\" | grep -q 'worktree add' " "$out"
check "W1: nag marker created" test -f "$REPO/.steering/state/wt-nag-s1"
out="$(pay s1 "$REPO" | bash "$BIN/session-worktree.sh")"
check "W2: same session not nagged twice" bash -c '! printf '%s' "$0" | grep -q "SESSION WORKTREE REQUIRED"' "$out"
out="$(pay s2 "$REPO-session-abc123" | bash "$BIN/session-worktree.sh")"
check "W3: linked worktree is silent" bash -c '! printf '%s' "$0" | grep -q "SESSION WORKTREE REQUIRED"' "$out"
out="$(pay s3 "$PLAIN" | bash "$BIN/session-worktree.sh")"
check "W4: non-steering repo is silent" bash -c '! printf '%s' "$0" | grep -q "SESSION WORKTREE REQUIRED"' "$out"

# ─── guard-main-checkout.sh ──────────────────────────────────────────────────

pay_bash 'git commit -m x' "$REPO" | bash "$BIN/guard-main-checkout.sh" >/tmp/g1.json 2>/dev/null
rc=$?
check "G1: git commit in shared checkout blocked (exit 2)" test "$rc" -eq 2
check "G1: block JSON emitted" bash -c "grep -q '\"decision\": \"block\"' /tmp/g1.json"
check "G2: git status passes" bash -c "pay_bash 'git status' '$REPO' | bash '$BIN/guard-main-checkout.sh'"
check "G3: git commit in worktree passes" bash -c "pay_bash 'git commit -m x' '$REPO-session-abc123' | bash '$BIN/guard-main-checkout.sh'"
check "G4: git worktree add passes (ritual)" bash -c "pay_bash 'git -C $REPO worktree add /tmp/x -b y' '$REPO' | bash '$BIN/guard-main-checkout.sh'"
check "G5: non-git command passes" bash -c "pay_bash 'ls -la' '$REPO' | bash '$BIN/guard-main-checkout.sh'"
check "G6: STEER_GUARD_OFF=1 escape" bash -c "STEER_GUARD_OFF=1 bash -c \"pay_bash 'git commit -m x' '$REPO' | bash '$BIN/guard-main-checkout.sh'\""
check "G7: gizzi-shaped payload blocked too" bash -c "! pay_gizzi 'git push origin main' '$REPO' | bash '$BIN/guard-main-checkout.sh' >/dev/null 2>&1"
check "G8: branch -d blocked in shared" bash -c "! pay_bash 'git branch -d session/x' '$REPO' | bash '$BIN/guard-main-checkout.sh' >/dev/null 2>&1"
check "G9: non-steering repo git commit passes" bash -c "pay_bash 'git commit -m x' '$PLAIN' | bash '$BIN/guard-main-checkout.sh'"

# ─── steering-review regression cases (MAJORs) ──────────────────────────────

check "G10: read-only git log with 'reset' in path passes" \
  bash -c "pay_bash 'git log --oneline -- cmd/gizzi-code/src/cli/commands/reset-limits' '$REPO' | bash '$BIN/guard-main-checkout.sh'"
check "G11: git pull blocked in shared" bash -c "! pay_bash 'git pull' '$REPO' | bash '$BIN/guard-main-checkout.sh' >/dev/null 2>&1"
check "G12: git cherry-pick blocked in shared" bash -c "! pay_bash 'git cherry-pick abc123' '$REPO' | bash '$BIN/guard-main-checkout.sh' >/dev/null 2>&1"
check "G13: git revert blocked in shared" bash -c "! pay_bash 'git revert HEAD' '$REPO' | bash '$BIN/guard-main-checkout.sh' >/dev/null 2>&1"
check "G14: git am blocked in shared" bash -c "! pay_bash 'git am < patch.diff' '$REPO' | bash '$BIN/guard-main-checkout.sh' >/dev/null 2>&1"
check "G15: git stash pop blocked in shared" bash -c "! pay_bash 'git stash pop' '$REPO' | bash '$BIN/guard-main-checkout.sh' >/dev/null 2>&1"
check "G16: bare git stash passes" bash -c "pay_bash 'git stash list' '$REPO' | bash '$BIN/guard-main-checkout.sh'"
check "G17: git -C <path> commit blocked in shared" bash -c "! pay_bash 'git -C /tmp/x commit -m y' '$REPO' | bash '$BIN/guard-main-checkout.sh' >/dev/null 2>&1"
check "G18: git -C <path> log passes" bash -c "pay_bash 'git -C /tmp/x log --oneline' '$REPO' | bash '$BIN/guard-main-checkout.sh'"
check "G19: chained mutation after && blocked" bash -c "! pay_bash 'npm test && git push' '$REPO' | bash '$BIN/guard-main-checkout.sh' >/dev/null 2>&1"
check "G20: pull in worktree passes" bash -c "pay_bash 'git pull' '$REPO-session-abc123' | bash '$BIN/guard-main-checkout.sh'"

rm -rf "$TMP" /tmp/g1.json
if [ "$failures" -gt 0 ]; then echo ""; echo "$failures check(s) FAILED"; exit 1; fi
echo ""
echo "All checks passed."
