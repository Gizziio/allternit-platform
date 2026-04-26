#!/bin/bash
#
# allternit-browser-dev.sh — Allternit Browser Development Skill Launcher
#
# Launches the Allternit browser development agent/skill for testing
# browser automation, extension integration, and CDP workflows.
#
# Passes all arguments through to the skill agent.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SKILL_PATH="$HOME/.agents/skills/allternit-browser-dev/agent.js"

echo "🌐 Allternit Browser Dev Skill"
echo "========================"
echo ""

if [ ! -f "$SKILL_PATH" ]; then
  echo "⚠️  Skill agent not found at: $SKILL_PATH"
  echo ""
  echo "Install the Allternit browser dev skill first, or use workspace alternatives:"
  echo "  bin/chrome-dev.sh              — Launch Chrome with CDP"
  echo "  bin/allternit-extension-load.sh — Load Allternit extension"
  echo "  bin/allternit-inject-local-config.sh — Inject local config"
  echo ""
  echo "To install the skill:"
  echo "  git clone <repo> $HOME/.agents/skills/allternit-browser-dev"
  exit 1
fi

exec node "$SKILL_PATH" "$@"
