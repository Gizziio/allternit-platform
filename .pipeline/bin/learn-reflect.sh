#!/usr/bin/env bash
# learn-reflect.sh — reflection at completion boundaries (M1-R2). Called at
# the end of a pipeline run (build-queue) or executor phase (check-spec):
#
#   1. reads .pipeline/learn/events.jsonl since the last reflection
#      (watermark = line count already reflected, in .pipeline/learn/watermark);
#   2. consults ao-consult with the distillation prompt
#      (.pipeline/learn/reflect-prompt.md) + the new events
#      (LEARN_CONSULT_CMD overrides the consult for tests, same pattern as
#      SPEC_CHECK_CMD);
#   3. appends the returned `RULE | text | confidence | provenance` lines to
#      .pipeline/playbook.md as rule lines carrying confidence, provenance,
#      added and last_confirmed dates;
#   4. advances the watermark — but only on a non-empty consult answer, so a
#      failed reflection never loses events.
#
# Reflection is advisory: consult failure is logged to errors.log and the
# caller continues (exit stays 0).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PIPELINE_DIR="${LEARN_PIPELINE_DIR:-$ROOT/.pipeline}"
LEARN_DIR="$PIPELINE_DIR/learn"
EVENTS="$LEARN_DIR/events.jsonl"
WATERMARK="$LEARN_DIR/watermark"
PROMPT="${LEARN_REFLECT_PROMPT:-$LEARN_DIR/reflect-prompt.md}"
PLAYBOOK="$PIPELINE_DIR/playbook.md"
ERRORS_LOG="$PIPELINE_DIR/errors.log"

log_error() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$1" >> "$ERRORS_LOG"
}

if [ ! -f "$EVENTS" ]; then
  echo "learn-reflect: no events yet; nothing to reflect"
  exit 0
fi

total="$(wc -l < "$EVENTS" | tr -d ' ')"
seen=0
[ -f "$WATERMARK" ] && seen="$(tr -cd '0-9' < "$WATERMARK")"
[ -n "$seen" ] || seen=0

new=$((total - seen))
if [ "$new" -le 0 ]; then
  echo "learn-reflect: no new events since last reflection ($seen/$total)"
  exit 0
fi

request="$(mktemp -t learn-reflect)"
{
  cat "$PROMPT" 2>/dev/null
  printf '\n\n=== EVENTS SINCE LAST REFLECTION (%d new of %d total) ===\n' "$new" "$total"
  tail -n +$((seen + 1)) "$EVENTS"
} > "$request"

if [ -n "${LEARN_CONSULT_CMD:-}" ]; then
  answer="$($LEARN_CONSULT_CMD < "$request")"
elif command -v ao-consult >/dev/null 2>&1; then
  answer="$(ao-consult < "$request")"
else
  answer=""
fi
rm -f "$request"

if [ -z "${answer// /}" ]; then
  log_error "learn-reflect: consult failed or empty ($new events pending) — watermark NOT advanced, continuing (advisory)"
  echo "learn-reflect: consult failed or empty — logged, continuing (advisory)"
  exit 0
fi

# The answer travels via argv, not stdin: the heredoc below IS stdin (the
# program), so a `printf | python3 <<PY` pipe would be silently overridden.
python3 - "$PLAYBOOK" "$WATERMARK" "$total" "$answer" <<'PY'
import datetime
import os
import sys

playbook, watermark, total, answer = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

rules = []
for line in answer.splitlines():
    line = line.strip()
    if line.startswith("• "):
        line = line[2:].strip()
    if not line.upper().startswith("RULE"):
        continue
    parts = [p.strip() for p in line.split("|")]
    if len(parts) < 4:
        continue
    text, confidence, provenance = parts[1], parts[2].lower(), parts[3]
    if not text:
        continue
    if confidence not in ("low", "medium", "high"):
        confidence = "low"
    rules.append((text, confidence, provenance))

if rules:
    if not os.path.exists(playbook):
        os.makedirs(os.path.dirname(playbook), exist_ok=True)
        with open(playbook, "w") as f:
            f.write("# Pipeline playbook (M1)\n\n"
                    "<!-- Distilled by learn-reflect.sh from .pipeline/learn/events.jsonl.\n"
                    "     Rules are advisory: included in steering/spec-check consults,\n"
                    "     marked [stale] after 90 days unconfirmed. -->\n\n"
                    "## Rules\n")
    with open(playbook, "a") as f:
        for text, confidence, provenance in rules:
            f.write("- %s (confidence: %s; provenance: %s; added: %s; last_confirmed: %s)\n"
                    % (text, confidence, provenance, today, today))

# The consult answered: the events were considered whether or not they
# yielded rules, so the watermark advances.
with open(watermark, "w") as f:
    f.write("%d\n" % total)

print("%d rule(s) appended" % len(rules))
PY

echo "learn-reflect: reflected $new event(s); watermark now $total"
