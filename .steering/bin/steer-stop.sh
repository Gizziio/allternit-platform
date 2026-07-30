#!/bin/bash
# .steering/bin/steer-stop.sh — agent-CLI-agnostic Stop hook (kimi, Claude Code,
# codex, gizzi-code). Registered per CLI; see .steering/bin/steer-install.sh.
#
# Consults a separate steering agent when .steering/checkpoint.md changed since
# the last review. The steering agent replies with first line "APPROVE"
# (hook exits 0, the turn ends) or "STEER" (hook blocks; the feedback is
# injected back into the working session so it keeps working).
#
# Guards: does nothing unless <cwd>/.steering/checkpoint.md exists and
# <cwd>/.steering/off does not. Fails open on any consult error.
set -u
. "$(dirname "$0")/steer-common.sh"

steer_parse_payload
cwd="$STEER_CWD"
session_id="$STEER_SESSION_ID"
steer_guard "$cwd" || exit 0

dir="$cwd/.steering"
checkpoint="$dir/checkpoint.md"
state_dir="$dir/state"
mkdir -p "$state_dir"
state="$state_dir/$session_id"

cur_hash=$(shasum -a 256 "$checkpoint" | awk '{print $1}')
last_hash=""
[ -f "$state" ] && last_hash=$(head -1 "$state")

# Already reviewed this exact checkpoint version -> allow the turn to end.
[ "$cur_hash" = "$last_hash" ] && exit 0

tmp=$(mktemp -t steer)
steer_build_context "$cwd" "$tmp"
answer=$(steer_consult "$cwd" "$tmp")
rm -f "$tmp"

if [ -z "$(printf '%s' "$answer" | tr -d '[:space:]')" ]; then
  # Consult failed or returned nothing -> fail open, don't re-consult this version.
  printf '%s\n' "$cur_hash" > "$state"
  steer_log "$cwd" "$session_id" "hash=$cur_hash verdict=CONSULT_FAILED"
  exit 0
fi

verdict=$(steer_verdict "$answer")
printf '%s\n' "$cur_hash" > "$state"
steer_log "$cwd" "$session_id" "hash=$cur_hash verdict=$verdict"

[ "$verdict" = "APPROVE" ] && exit 0

steer_block "[steering] Checkpoint review from the steering agent (answer its questions, apply its guidance, then update .steering/checkpoint.md):
$(steer_clean "$answer")"
