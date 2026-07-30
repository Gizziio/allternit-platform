#!/bin/bash
# .steering/bin/steer-stop.sh — agent-CLI-agnostic Stop hook (kimi, Claude Code,
# codex, gizzi-code). Registered per CLI; see .steering/bin/steer-install.sh.
#
# Consults a separate steering agent when .steering/checkpoint.md changed since
# the last review. The steering agent replies with first line "APPROVE"
# (hook exits 0, the turn ends) or "STEER" (hook exits 2; the feedback on
# stderr is injected back into the working session so it keeps working).
#
# Guards: does nothing unless <cwd>/.steering/checkpoint.md exists and
# <cwd>/.steering/off does not. Fails open on any consult error.
set -u

payload=$(cat)
cwd=$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("cwd",""))' 2>/dev/null)
session_id=$(printf '%s' "$payload" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id","unknown"))' 2>/dev/null)
session_id=$(printf '%s' "${session_id:-unknown}" | tr -cd 'A-Za-z0-9_-')
# Fallback: some CLIs' Stop payloads omit cwd; hook commands run in the session dir.
[ -n "$cwd" ] || cwd="$PWD"

dir="$cwd/.steering"
checkpoint="$dir/checkpoint.md"
[ -f "$checkpoint" ] || exit 0   # steering not set up for this project
[ ! -f "$dir/off" ] || exit 0    # kill switch

state_dir="$dir/state"
mkdir -p "$state_dir"
state="$state_dir/$session_id"
log="$state_dir/consults.log"

cur_hash=$(shasum -a 256 "$checkpoint" | awk '{print $1}')
last_hash=""
[ -f "$state" ] && last_hash=$(head -1 "$state")

# Already reviewed this exact checkpoint version -> allow the turn to end.
if [ "$cur_hash" = "$last_hash" ]; then
  exit 0
fi

# Assemble the consult prompt: steering instructions + checkpoint + git state.
tmp=$(mktemp -t steer)
{
  cat "$dir/prompt.md" 2>/dev/null
  printf '\n\n=== CHECKPOINT FILE (.steering/checkpoint.md) ===\n'
  head -c 12000 "$checkpoint"
  printf '\n\n=== git status --short ===\n'
  git -C "$cwd" status --short 2>/dev/null | head -50
  printf '\n=== git diff --stat HEAD ===\n'
  git -C "$cwd" diff --stat HEAD 2>/dev/null | tail -30
} > "$tmp"

consult() {
  if [ -n "${STEER_CONSULT_CMD:-}" ]; then
    # Test override, or route through the agent-orchestrator tooling (ao-*)
    # once it is installed from the other machine, e.g.:
    #   STEER_CONSULT_CMD="ao-consult --session steer"
    $STEER_CONSULT_CMD < "$tmp"
  elif command -v ao-consult >/dev/null 2>&1; then
    ao-consult < "$tmp"
  else
    (cd "$cwd" && kimi -p "$(cat "$tmp")" 2>/dev/null)
  fi
}

answer=$(consult)
rm -f "$tmp"

if [ -z "$(printf '%s' "$answer" | tr -d '[:space:]')" ]; then
  # Consult failed or returned nothing -> fail open, don't re-consult this version.
  printf '%s\n' "$cur_hash" > "$state"
  printf '%s session=%s hash=%s verdict=CONSULT_FAILED\n' "$(date -u +%FT%TZ)" "$session_id" "$cur_hash" >> "$log"
  exit 0
fi

# kimi -p prefixes transcript lines with "• "; strip for the verdict check.
clean=$(printf '%s\n' "$answer" | sed 's/^• //')
first_line=$(printf '%s\n' "$clean" | head -1 | tr -d '\r')

printf '%s\n' "$cur_hash" > "$state"

if printf '%s' "$first_line" | grep -qi '^APPROVE'; then
  printf '%s session=%s hash=%s verdict=APPROVE\n' "$(date -u +%FT%TZ)" "$session_id" "$cur_hash" >> "$log"
  exit 0
fi

printf '%s session=%s hash=%s verdict=STEER\n' "$(date -u +%FT%TZ)" "$session_id" "$cur_hash" >> "$log"
# Block the stop and inject the steering feedback into the working session.
# Multi-CLI contract: stderr + exit 2 covers kimi and Claude Code; the JSON on
# stdout covers codex and gizzi-code, which read {"decision","reason"}.
reason="[steering] Checkpoint review from the steering agent (answer its questions, apply its guidance, then update .steering/checkpoint.md):
$(printf '%s\n' "$clean" | head -c 4000)"
REASON="$reason" python3 -c 'import json,os; print(json.dumps({"decision":"block","reason":os.environ["REASON"]}))'
printf '%s\n' "$reason" >&2
exit 2
