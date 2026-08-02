#!/usr/bin/env bash
# learn-reflect.sh — reflection at completion boundaries (M1-R2, M3). Called
# at the end of a pipeline run (build-queue) or executor phase (check-spec):
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
#      failed reflection never loses events;
#   5. (M3-R1) persists each new rule to the resolved brain (brain-resolve.sh:
#      TASTE_BRAIN → gizzi settings brain.path → ~/brain → skip) as
#      learnings/<slug>.md — frontmatter type: lesson, status: active,
#      domain: pipeline, confidence, provenance_refs, added, last_confirmed.
#      The brain is written ONLY under learnings/;
#   6. (M3-R2) flips learnings pages whose last_confirmed is 90+ days old to
#      status: stale — on every run, since aging is time-based;
#   7. (M3-R3) makes ONE `learn:` commit per run in the brain when it is a
#      git repo (add -- learnings only; NEVER pushes — sync is the user's
#      `gizzi brain sync`);
#   8. (M3-R4) when no brain is resolvable, skips persistence with ONE note
#      in errors.log per rule-producing run — the playbook still updates.
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
BRAIN_RESOLVE="${BRAIN_RESOLVE:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/brain-resolve.sh}"
TODAY="$(date -u +%F)"

log_error() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$1" >> "$ERRORS_LOG"
}

# ─── brain (M3) ─────────────────────────────────────────────────────────────

BRAIN=""
brain_ok=0
if [ -x "$BRAIN_RESOLVE" ]; then
  BRAIN="$("$BRAIN_RESOLVE" 2>/dev/null)"
  if [ -n "$BRAIN" ] && [ -d "$BRAIN" ]; then
    brain_ok=1
  fi
fi

# brain_stale_sweep <brain> -> count of pages flipped active -> stale (M3-R2).
# Reads/writes ONLY <brain>/learnings/*.md frontmatter.
brain_stale_sweep() {
  python3 - "$1" <<'PY'
import datetime
import os
import sys

brain = sys.argv[1]
learnings = os.path.join(brain, "learnings")
STALE_DAYS = 90
today = datetime.datetime.now(datetime.timezone.utc).date()
flipped = 0
if os.path.isdir(learnings):
    for name in sorted(os.listdir(learnings)):
        if not name.endswith(".md"):
            continue
        path = os.path.join(learnings, name)
        try:
            lines = open(path, encoding="utf-8", errors="replace").read().split("\n")
        except Exception:
            continue
        if not lines or lines[0].strip() != "---":
            continue
        status = confirmed = None
        end = len(lines)
        for i, line in enumerate(lines[1:], 1):
            if line.strip() == "---":
                end = i
                break
            k, sep, v = line.partition(":")
            if not sep:
                continue
            k = k.strip()
            if k == "status":
                status = v.strip()
            elif k == "last_confirmed":
                confirmed = v.strip()
        if status != "active" or not confirmed:
            continue
        try:
            d = datetime.date(*[int(x) for x in confirmed[:10].split("-")])
        except Exception:
            continue
        if (today - d).days < STALE_DAYS:
            continue
        for i in range(1, end):
            if lines[i].partition(":")[0].strip() == "status":
                lines[i] = "status: stale"
                break
        with open(path, "w") as f:
            f.write("\n".join(lines))
        flipped += 1
print(flipped)
PY
}

# brain_write_rule <brain> <today> <rule-json> -> slug on stdout. Writes
# learnings/<slug>.md; a re-distilled rule keeps its original added /
# last_confirmed / status (re-distillation is not confirmation).
brain_write_rule() {
  python3 - "$1" "$2" "$3" <<'PY'
import hashlib
import json
import os
import re
import sys

brain, today, rule = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
text, confidence, provenance = rule["text"], rule["confidence"], rule["provenance"]


def slugify(t):
    s = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:60].rstrip("-")
    return s or hashlib.sha1(t.encode()).hexdigest()[:12]


slug = slugify(text)
learnings = os.path.join(brain, "learnings")
os.makedirs(learnings, exist_ok=True)
path = os.path.join(learnings, slug + ".md")

added, last_confirmed, status = today, today, "active"
if os.path.exists(path):
    try:
        old = open(path, encoding="utf-8", errors="replace").read().split("\n")
        if old and old[0].strip() == "---":
            for line in old[1:]:
                if line.strip() == "---":
                    break
                k, sep, v = line.partition(":")
                if not sep or not v.strip():
                    continue
                k = k.strip()
                if k == "added":
                    added = v.strip()
                elif k == "last_confirmed":
                    last_confirmed = v.strip()
                elif k == "status":
                    status = v.strip()
    except Exception:
        pass

refs = [r.strip() for r in provenance.split(",") if r.strip()]
fm = ["---", "type: lesson", "status: " + status, "domain: pipeline",
      "confidence: " + confidence, "provenance_refs:"]
fm += ["  - " + r for r in refs] if refs else ["  - none"]
fm += ["added: " + added, "last_confirmed: " + last_confirmed, "---"]
doc = "\n".join(fm) + "\n\n# " + text + "\n\n" \
    "Distilled by learn-reflect.sh from .pipeline/learn/events.jsonl (M3).\n"
with open(path, "w") as f:
    f.write(doc)
print(slug)
PY
}

# brain_commit <message> — ONE commit per run, learnings/ only, never push
# (M3-R3). No-op when the brain is absent, not a git repo, or clean.
brain_commit() {
  [ "$brain_ok" = "1" ] || return 0
  git -C "$BRAIN" rev-parse --git-dir >/dev/null 2>&1 || return 0
  [ -n "$(git -C "$BRAIN" status --porcelain -- learnings 2>/dev/null)" ] || return 0
  if git -C "$BRAIN" add -- learnings >/dev/null 2>&1 \
     && git -C "$BRAIN" commit -m "$1" >/dev/null 2>&1; then
    echo "learn-reflect: brain committed ($1)"
  else
    log_error "learn-reflect: brain commit failed ($1) — continuing (advisory)"
  fi
}

# Aging is time-based, so the stale sweep runs on every invocation — even
# runs with nothing new to distill.
flips=0
[ "$brain_ok" = "1" ] && flips="$(brain_stale_sweep "$BRAIN")"
[ -n "$flips" ] || flips=0

if [ ! -f "$EVENTS" ]; then
  [ "$flips" != "0" ] && brain_commit "learn: stale flips ($TODAY)"
  echo "learn-reflect: no events yet; nothing to reflect"
  exit 0
fi

total="$(wc -l < "$EVENTS" | tr -d ' ')"
seen=0
[ -f "$WATERMARK" ] && seen="$(tr -cd '0-9' < "$WATERMARK")"
[ -n "$seen" ] || seen=0

new=$((total - seen))
if [ "$new" -le 0 ]; then
  [ "$flips" != "0" ] && brain_commit "learn: stale flips ($TODAY)"
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

rules_dump="$(mktemp -t learn-rules)"

# The answer travels via argv, not stdin: the heredoc below IS stdin (the
# program), so a `printf | python3 <<PY` pipe would be silently overridden.
python3 - "$PLAYBOOK" "$WATERMARK" "$total" "$answer" "$rules_dump" <<'PY'
import datetime
import json
import os
import sys

playbook, watermark, total, answer, rules_out = (
    sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4], sys.argv[5])
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

# The parsed rules travel to the brain-persistence step as JSON lines.
with open(rules_out, "w") as f:
    for text, confidence, provenance in rules:
        f.write(json.dumps({"text": text, "confidence": confidence,
                            "provenance": provenance}) + "\n")

# The consult answered: the events were considered whether or not they
# yielded rules, so the watermark advances.
with open(watermark, "w") as f:
    f.write("%d\n" % total)

print("%d rule(s) appended" % len(rules))
PY

# M3-R1/R4: persist the new rules to the brain — or note the skip once.
n_rules=0
first_slug=""
if [ -s "$rules_dump" ]; then
  n_rules="$(wc -l < "$rules_dump" | tr -d ' ')"
  if [ "$brain_ok" = "1" ]; then
    while IFS= read -r rule_json; do
      [ -n "$rule_json" ] || continue
      slug="$(brain_write_rule "$BRAIN" "$TODAY" "$rule_json")"
      [ -z "$first_slug" ] && first_slug="$slug"
    done < "$rules_dump"
    echo "learn-reflect: $n_rules rule(s) persisted to $BRAIN/learnings/"
  else
    log_error "learn-reflect: no brain resolvable — $n_rules rule(s) not persisted (playbook.md updated)"
    echo "learn-reflect: no brain resolvable — $n_rules rule(s) kept in playbook only (logged)"
  fi
fi
rm -f "$rules_dump"

# M3-R3: one commit per reflection run, covering new pages and stale flips.
if [ "$n_rules" -gt 0 ] || [ "$flips" != "0" ]; then
  if [ "$n_rules" = "1" ] && [ -n "$first_slug" ]; then
    msg="learn: $first_slug"
  elif [ "$n_rules" -gt 1 ]; then
    msg="learn: $n_rules rules ($TODAY)"
  else
    msg="learn: stale flips ($TODAY)"
  fi
  brain_commit "$msg"
fi

echo "learn-reflect: reflected $new event(s); watermark now $total"
