#!/bin/bash
# .steering/bin/steer-pre-commit-gate.sh — agent-CLI-agnostic PreToolUse hook
# (kimi, Claude Code, codex, gizzi-code). Hard gate: the steering agent must
# APPROVE before a `git commit` or `git push` is allowed to execute.
#
# Non-git commands pass instantly (a grep, no consult). Fails open on consult
# errors — the gate must never wedge the session on steering outages.
set -u
. "$(dirname "$0")/steer-common.sh"

payload=$(cat)
# Extract the shell command across CLI payload shapes:
# kimi/Claude/codex: .tool_input.command ; gizzi-code: .input[.tool_input].command
command=$(printf '%s' "$payload" | python3 -c '
import json, sys
p = json.load(sys.stdin)
ti = p.get("tool_input") or (p.get("input") or {})
if isinstance(ti, dict) and "tool_input" in ti:
    ti = ti.get("tool_input") or {}
print(ti.get("command", "") if isinstance(ti, dict) else "")
' 2>/dev/null)

# Only gate git commit/push; everything else passes without a consult.
# Heuristic (a real shell parser is out of scope): the line must contain a git
# invocation (left boundary = start or any non-letter, so /usr/bin/git,
# sh -c 'git …', \git all count, but "legit" doesn't) AND a bare commit/push
# word. May over-gate odd commands like `git status; echo commit` — harmless,
# it just means an extra consult.
printf '%s' "$command" | grep -qE '(^|[^A-Za-z])git([[:space:]]|$)' \
  && printf '%s' "$command" | grep -qE '(^|[^A-Za-z])(commit|push)([^A-Za-z]|$)' \
  || exit 0

cwd=$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd",""))' 2>/dev/null)
[ -n "$cwd" ] || cwd="$PWD"
session_id=$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id","unknown"))' 2>/dev/null)
session_id=$(printf '%s' "${session_id:-unknown}" | tr -cd 'A-Za-z0-9_-')
steer_guard "$cwd" || exit 0

mkdir -p "$cwd/.steering/state"

tmp=$(mktemp -t steer-gate)
steer_build_context "$cwd" "$tmp"
{
  printf '\n\n=== GATE DECISION ===\n'
  printf 'The working agent is about to run: %s\n' "$command"
  printf 'Decide whether this commit/push is allowed to proceed. Reply first line APPROVE to allow it, or STEER with what must be fixed first.\n'
} >> "$tmp"

answer=$(steer_consult "$cwd" "$tmp")
rm -f "$tmp"

if [ -z "$(printf '%s' "$answer" | tr -d '[:space:]')" ]; then
  steer_log "$cwd" "$session_id" "gate=1 cmd=\"$(printf '%s' "$command" | head -c 80)\" verdict=CONSULT_FAILED"
  exit 0
fi

verdict=$(steer_verdict "$answer")
steer_log "$cwd" "$session_id" "gate=1 cmd=\"$(printf '%s' "$command" | head -c 80)\" verdict=$verdict"
# M1-R1: capture the gate verdict at the moment it happens (advisory).
steer_learn "$cwd" "gate" "$(printf '%s' "$command" | head -c 120)" "verdict=$verdict"

[ "$verdict" = "APPROVE" ] && exit 0

steer_block "[steering] Commit gate: the steering agent blocked \`$command\`:
$(steer_clean "$answer")"
