#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
claude -p "$(cat docs/OPENAI_AUDIT_CLAUDE_TASK.md)" --dangerously-skip-permissions
touch docs/openai-audit/CLAUDE_AUDIT_NOTES.sentinel
