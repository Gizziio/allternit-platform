#!/usr/bin/env bash
#
# check-command-exits.sh — watchdog audit for one-shot gizzi CLI commands.
#
# Background: bootstrap leaves live runtime handles (agent comms runtime, db
# watchers, lazily re-created Instances). Print-mode `gizzi exec` was fixed in
# src/cli/commands/run.ts (drain 100ms, then process.exit), but every other
# print-and-return command had the same disease: it would print its output
# and then hang forever instead of exiting. The central fix lives in
# src/cli/main.ts (denylist of long-lived commands + forced drain-then-exit
# for everything else). This script is the regression check.
#
# What it does:
#   Runs a fixed list of clearly one-shot commands via
#     bun --conditions=browser ./src/cli/main.ts <cmd>   (stdin < /dev/null)
#   with a 20s watchdog and a fresh GIZZI_CONFIG_DIR (mktemp -d) per command.
#
# Result semantics:
#   EXITED — the process terminated on its own (any exit code; a clean-env
#            error exit is fine). Only hanging counts as failure.
#   HANG   — the watchdog had to kill it; the command failed to exit.
#
# Usage: bash script/check-command-exits.sh
# Exit code: 0 if every command EXITED, 1 otherwise.
#
# Note: long-lived commands (default TUI, serve, web, acp, attach, run
# without --print, mcp serve, runtime daemon, cowork attach,
# remote connect/logs, ...) are intentionally NOT in this list — they are
# expected to keep running. See the denylist in src/cli/main.ts.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

WATCHDOG_SECS=20

# One-shot commands under test (word-split on purpose; no quoted args needed).
COMMANDS=(
  "--version"
  "--help"
  "auth status --json"
  "api-keys list"
  "doctor"
  "completions bash"
  "mcp list"
  "skills list"
  "models"
  "connect list"
  "stats"
  "session list"
)

watchdog() {
  # Run "$@" with a $WATCHDOG_SECS kill. Returns the command's exit code,
  # or 124 if the watchdog had to kill it.
  local secs=$1; shift
  "$@" </dev/null >/dev/null 2>&1 &
  local pid=$!
  (
    sleep "$secs"
    kill -TERM "$pid" 2>/dev/null
    sleep 1
    kill -9 "$pid" 2>/dev/null
  ) &
  local wpid=$!
  wait "$pid" 2>/dev/null
  local code=$?
  kill "$wpid" 2>/dev/null
  wait "$wpid" 2>/dev/null
  if [ "$code" -gt 128 ]; then
    # Killed by signal (128+N) — treat as watchdog kill.
    return 124
  fi
  return "$code"
}

fails=0
printf "%-28s %-8s %s\n" "COMMAND" "RESULT" "EXIT CODE"
printf "%-28s %-8s %s\n" "-------" "------" "---------"

for cmd in "${COMMANDS[@]}"; do
  cfg_dir="$(mktemp -d)"
  # shellcheck disable=SC2086
  GIZZI_CONFIG_DIR="$cfg_dir" watchdog "$WATCHDOG_SECS" \
    bun --conditions=browser ./src/cli/main.ts $cmd
  code=$?
  if [ "$code" -eq 124 ]; then
    result="HANG"
    fails=$((fails + 1))
  else
    result="EXITED"
  fi
  printf "%-28s %-8s %s\n" "$cmd" "$result" "$code"
  rm -rf "$cfg_dir"
done

echo
if [ "$fails" -gt 0 ]; then
  echo "FAIL: $fails command(s) hung past the ${WATCHDOG_SECS}s watchdog."
  exit 1
fi
echo "OK: all commands exited within the ${WATCHDOG_SECS}s watchdog."
exit 0
