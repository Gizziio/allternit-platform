#!/usr/bin/env bash
# install.sh — symlink the agent-orchestrator toolkit onto PATH.
# Idempotent; safe to re-run after `git pull`.
#
# What it installs into ~/.local/bin:
#   ao-*      (external-agent tmux orchestration: spawn/send/watch/status/kill/doctor/consult)
#   steer-*   (parallel-session steering: discover/context/checkpoint/prompt/verify + steer dispatcher)
#
# The ao-* scripts are shims over the `allternit-rails` Rust binary. If the
# binary is not on PATH, this script builds and installs it from the repo's
# rails/ crate (requires cargo).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="$HERE/scripts"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
BIN_DIR="${ALLTERNIT_BIN_DIR:-$HOME/.local/bin}"

mkdir -p "$BIN_DIR"

installed=()
for script in "$SCRIPTS_DIR"/ao-* "$SCRIPTS_DIR"/steer*; do
  [ -f "$script" ] || continue
  name=$(basename "$script")
  chmod +x "$script"
  ln -sf "$script" "$BIN_DIR/$name"
  installed+=("$name")
done

count=${#installed[@]}
echo "installed $count tools into $BIN_DIR: ${installed[*]:-none}"

# ao-* shims need allternit-rails on PATH.
if ! command -v allternit-rails >/dev/null 2>&1; then
  PREBUILT="$REPO_ROOT/target/release/allternit-rails"
  if [ -x "$PREBUILT" ]; then
    ln -sf "$PREBUILT" "$BIN_DIR/allternit-rails"
    echo "installed allternit-rails (prebuilt release binary)"
  elif command -v cargo >/dev/null 2>&1; then
    echo "building allternit-rails from rails/ crate..."
    (cd "$REPO_ROOT" && cargo build --release -p allternit-agent-system-rails)
    ln -sf "$REPO_ROOT/target/release/allternit-rails" "$BIN_DIR/allternit-rails"
    echo "installed allternit-rails (built from source)"
  else
    echo "warning: allternit-rails not on PATH and cargo unavailable — ao-* shims will not work until it is installed" >&2
  fi
fi

# Sanity: PATH check
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "note: $BIN_DIR is not on PATH — add it to your shell profile" >&2 ;;
esac
