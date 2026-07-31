#!/bin/bash
# Weekly photo-edition job — runs the photo-edition generator as an
# ao-orchestrated Codex agent (local ChatGPT auth), then commits and pushes
# the artifacts. Scheduled via launchd (com.allternit.weekly-photo-editions).
#
# Logs: ~/.agent-orchestrator/logs/ (tmux transcripts + this job's log)
# Notes: ~/.agent-orchestrator/evidence/weekly-photo-editions/NOTES.md
set -uo pipefail

REPO=/Users/joe/Desktop/allternit-workspace/allternit
SLUG=weekly-photo-editions
ENV_FILE="$HOME/.config/allternit/photo-editions.env"
EVIDENCE_DIR="$HOME/.agent-orchestrator/evidence/$SLUG"
LOG_DIR="$HOME/.agent-orchestrator/logs"
SENTINEL="$EVIDENCE_DIR/done.sentinel"

mkdir -p "$EVIDENCE_DIR" "$LOG_DIR"

# KIMI_API_KEY enables article-grounded photo briefs; without it the
# generator falls back to deterministic templates.
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

cd "$REPO" || exit 1
git pull --ff-only origin main || echo "$(date -Iseconds) WARN: git pull failed, continuing with local state"

rm -f "$SENTINEL"

# Headless one-shot: the sentinel is touched when codex exec exits, so
# completion never depends on the agent remembering it.
ao-spawn "$SLUG" "$REPO" \
  "codex exec --skip-git-repo-check \"\$(cat docs/jobs/weekly-photo-editions.md)\"; touch \"$SENTINEL\""

ao-watch "$SLUG" "$SENTINEL" 7200 30
RC=$?
ao-kill "$SLUG" >/dev/null 2>&1

case $RC in
  0) echo "$(date -Iseconds) weekly photo editions: DONE" ;;
  3) echo "$(date -Iseconds) weekly photo editions: PANE-DEAD — see $LOG_DIR" ;;
  4) echo "$(date -Iseconds) weekly photo editions: TIMEOUT after 2h" ;;
  *) echo "$(date -Iseconds) weekly photo editions: ao-watch rc=$RC" ;;
esac
exit $RC
