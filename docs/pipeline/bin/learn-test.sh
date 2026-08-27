#!/usr/bin/env bash
# learn-test.sh — offline shim tests for the M1 learning loop (R1–R4 + the
# acceptance Gherkin scenarios):
#   - R1: learn-event.sh appends sanitized {ts,kind,refs,summary} JSONL;
#         verdict/outcome/dismissal captures fire from the real hook scripts
#         (gate, check-spec, record-outcome, dismiss).
#   - R2: learn-reflect.sh distills events since the watermark via a stubbed
#         consult (LEARN_CONSULT_CMD), appends confidence+provenance rules,
#         advances the watermark, is idempotent, and is advisory on consult
#         failure (watermark untouched). Reflection is offered at the end of
#         check-spec and build-queue runs.
#   - R3: playbook rules reach the gate/steering context and the check-spec
#         request assembly.
#   - R4: a 90+ day-unconfirmed rule is marked [stale] at inclusion time;
#         output is capped at 4KB.
# PASS/FAIL lines, non-zero exit on any FAIL.
set -uo pipefail

BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEARN_EVENT="$BIN/learn-event.sh"
LEARN_PLAYBOOK="$BIN/learn-playbook.sh"
LEARN_REFLECT="$BIN/learn-reflect.sh"
CHECK_SPEC="$BIN/check-spec.sh"
BUILD_QUEUE="$BIN/build-queue.sh"
RECORD_OUTCOME="$BIN/record-outcome.sh"
DISMISS="$BIN/dismiss.sh"
GATE="$(cd "$BIN/../../.steering/bin" && pwd)/steer-pre-commit-gate.sh"

TMP="$(mktemp -d /tmp/learn-test-XXXXXX)"
mkdir -p "$TMP/bin"
# Tests must never touch the operator's real brain: default every run to an
# unresolvable brain; M3 scenarios override TASTE_BRAIN per-run with fixtures.
export TASTE_BRAIN="$TMP/no-brain-anywhere"
failures=0

check() { # check <name> <condition...>
  local name="$1"; shift
  if "$@"; then
    echo "PASS: $name"
  else
    failures=$((failures + 1))
    echo "FAIL: $name"
  fi
}
file_contains() { grep -q "$2" "$1"; }
file_not_contains() { ! grep -q "$2" "$1"; }
str_contains() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }
export LEARN_REFLECT_PROMPT="$BIN/../learn/reflect-prompt.md"
json_field() { # json_field <file> <line#> <key> -> value
  python3 -c 'import json,sys
print(json.loads(open(sys.argv[1]).read().splitlines()[int(sys.argv[2])-1]).get(sys.argv[3],""))' "$1" "$2" "$3"
}
TODAY="$(date -u +%F)"
OLD_DATE="$(python3 -c 'import datetime; print((datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(days=100)).strftime("%Y-%m-%d"))')"

# ─── R1: learn-event.sh direct ──────────────────────────────────────────────

PD1="$TMP/p1"
LEARN_PIPELINE_DIR="$PD1" "$LEARN_EVENT" "gate" "git commit -m x" "verdict=STEER" >/dev/null
check "R1: events.jsonl created on first capture" test -f "$PD1/learn/events.jsonl"
check "R1: event has ts" [ -n "$(json_field "$PD1/learn/events.jsonl" 1 ts)" ]
check "R1: event kind recorded" [ "$(json_field "$PD1/learn/events.jsonl" 1 kind)" = "gate" ]
check "R1: event refs recorded" [ "$(json_field "$PD1/learn/events.jsonl" 1 refs)" = "git commit -m x" ]
check "R1: event summary recorded" [ "$(json_field "$PD1/learn/events.jsonl" 1 summary)" = "verdict=STEER" ]

LEARN_PIPELINE_DIR="$PD1" "$LEARN_EVENT" "outcome" "multi
line	ref" "collapsed
summary" >/dev/null
check "R1: multiline inputs sanitized to one JSONL line" [ "$(wc -l < "$PD1/learn/events.jsonl" | tr -d ' ')" = "2" ]
check "R1: whitespace collapsed" [ "$(json_field "$PD1/learn/events.jsonl" 2 refs)" = "multi line ref" ]

LEARN_PIPELINE_DIR="$PD1" "$LEARN_EVENT" >/dev/null 2>&1
check "R1: missing kind is a usage error (exit 2)" [ "$?" = "2" ]

# ─── R4: learn-playbook.sh stale marking + 4KB cap ──────────────────────────

PD2="$TMP/p2"
mkdir -p "$PD2"
cat > "$PD2/playbook.md" <<EOF
# Pipeline playbook (M1)

## Rules
- Always rebase before pushing (confidence: high; provenance: gate:x@$TODAY; added: $TODAY; last_confirmed: $TODAY)
- Never trust an unverified summary (confidence: low; provenance: outcome:y@$OLD_DATE; added: $OLD_DATE; last_confirmed: $OLD_DATE)
EOF

out="$("$LEARN_PLAYBOOK" "$PD2/playbook.md")"
check "R4: fresh rule included unmarked" str_contains "$out" '- Always rebase before pushing'
check "R4: 90+ day rule marked [stale]" str_contains "$out" '- [stale] Never trust an unverified summary'
check "R4: stale marking does not mutate the playbook" file_not_contains "$PD2/playbook.md" '\[stale\]'

big="$TMP/big.md"
{ echo "# big"; i=0; while [ $i -lt 200 ]; do echo "- rule $i $(printf 'x%.0s' $(seq 1 40)) (confidence: low; provenance: p; added: $TODAY; last_confirmed: $TODAY)"; i=$((i+1)); done; } > "$big"
check "R4: inclusion capped at 4KB" [ "$("$LEARN_PLAYBOOK" "$big" | wc -c | tr -d ' ')" -le 4097 ]
check "R4: missing playbook prints nothing, exit 0" [ -z "$("$LEARN_PLAYBOOK" "$TMP/nonexistent.md")" ]

# ─── Gherkin 1: gate verdict captured at the moment (+ R3 steering inclusion)

REPO="$TMP/repo"
mkdir -p "$REPO/.steering" "$REPO/docs/pipeline/bin"
cp "$LEARN_EVENT" "$LEARN_PLAYBOOK" "$REPO/docs/pipeline/bin/"
cp "$PD2/playbook.md" "$REPO/docs/pipeline/playbook.md"
echo "# checkpoint" > "$REPO/.steering/checkpoint.md"

cat > "$TMP/bin/gate-consult.sh" <<'EOF'
#!/usr/bin/env bash
cat > "$GATE_REQ"
echo "STEER fix the failing test first"
EOF
chmod +x "$TMP/bin/gate-consult.sh"
export GATE_REQ="$TMP/gate-request.txt"
export STEER_CONSULT_CMD="$TMP/bin/gate-consult.sh"

payload="$(python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":"git commit -m \"test\""},"cwd":sys.argv[1],"session_id":"t1"}))' "$REPO")"
printf '%s' "$payload" | bash "$GATE" >/dev/null 2>&1
rc=$?
check "Gherkin1: STEER verdict still blocks (exit 2 — semantics unchanged)" [ "$rc" = "2" ]
check "Gherkin1: gate event captured in the same run" test -f "$REPO/docs/pipeline/learn/events.jsonl"
check "Gherkin1: event kind=gate" [ "$(json_field "$REPO/docs/pipeline/learn/events.jsonl" 1 kind)" = "gate" ]
check "Gherkin1: event carries the verdict" [ "$(json_field "$REPO/docs/pipeline/learn/events.jsonl" 1 summary)" = "verdict=STEER" ]
check "Gherkin1: event carries the cmd ref" str_contains "$(json_field "$REPO/docs/pipeline/learn/events.jsonl" 1 refs)" 'git commit'
check "R3: playbook rule reached the steering/gate consult" file_contains "$GATE_REQ" 'Always rebase before pushing'
check "R3+R4: stale rule marked in the steering/gate consult" file_contains "$GATE_REQ" '\[stale\] Never trust an unverified summary'
unset STEER_CONSULT_CMD

# ─── Stubs shared by the check-spec scenario ────────────────────────────────

cat > "$TMP/bin/ensure-ok.sh" <<'EOF'
#!/usr/bin/env bash
echo "rails: OK"
EOF
chmod +x "$TMP/bin/ensure-ok.sh"

cat > "$TMP/bin/curl" <<'EOF'
#!/usr/bin/env bash
url=""; prev=""
for a in "$@"; do
  case "$a" in http*) url="$a" ;; esac
  prev="$a"
done
case "$url" in
  *:8013/api/rails/mail/share) printf '200' ;;
  *:8013/api/rails/tickets) printf '%s\n200' '{"ticket":{"id":"t-1"}}' ;;
  *:3201/api/query) printf '{}' ;;
  *:3201*) printf '200' ;;
  *) printf '000'; exit 1 ;;
esac
EOF
chmod +x "$TMP/bin/curl"

# ─── Gherkin 2 + 3: check-spec capture, playbook inclusion, reflection ──────

PD3="$TMP/p3"
mkdir -p "$PD3/specs"
cat > "$PD3/specs/one.md" <<EOF
# Spec one

A minimal spec for the learning-loop test.
EOF
cp "$PD2/playbook.md" "$PD3/playbook.md"

# Seed 2 events; the READY verdict capture adds the 3rd ("Given 3 events").
LEARN_PIPELINE_DIR="$PD3" "$LEARN_EVENT" "gate" "git push" "verdict=STEER" >/dev/null
LEARN_PIPELINE_DIR="$PD3" "$LEARN_EVENT" "outcome" "older-thing" "reverted" >/dev/null

cat > "$TMP/bin/spec-consult.sh" <<'EOF'
#!/usr/bin/env bash
cat > "$CHECK_REQ"
printf 'READY\nlooks good\n'
EOF
chmod +x "$TMP/bin/spec-consult.sh"
export CHECK_REQ="$TMP/check-request.txt"

cat > "$TMP/bin/reflect-consult.sh" <<'EOF'
#!/usr/bin/env bash
cat > "$REFLECT_REQ"
cat <<'RULES'
RULE | Always run the full pipeline test suite before the prescribed commit | high | check-spec:one@2026-08-02T00:00:00Z, gate:git-push@2026-08-02T00:00:01Z
RULE | When a consult fails, keep the watermark untouched so events survive | medium | outcome:older-thing@2026-08-02T00:00:02Z
RULES
EOF
chmod +x "$TMP/bin/reflect-consult.sh"
export REFLECT_REQ="$TMP/reflect-request.txt"

out="$(env \
  PATH="$TMP/bin:$PATH" \
  CHECK_SPEC_DIR="$PD3" \
  RAILS_ENSURE="$TMP/bin/ensure-ok.sh" \
  SPEC_CHECK_CMD="$TMP/bin/spec-consult.sh" \
  LEARN_EVENT="$LEARN_EVENT" \
  LEARN_PLAYBOOK="$LEARN_PLAYBOOK" \
  LEARN_REFLECT="$LEARN_REFLECT" \
  LEARN_CONSULT_CMD="$TMP/bin/reflect-consult.sh" \
  bash "$CHECK_SPEC" 2>&1)"
check "check-spec run succeeds" str_contains "$out" 'READY'

check "R1: check-spec verdict captured as event" [ "$(json_field "$PD3/learn/events.jsonl" 3 kind)" = "check-spec" ]
check "R1: check-spec event carries verdict+slug" [ "$(json_field "$PD3/learn/events.jsonl" 3 summary)" = "verdict=READY round=0" ]

check "Gherkin3: check-spec request contains the playbook rule" file_contains "$CHECK_REQ" 'Always rebase before pushing'
check "Gherkin3: check-spec request marks the 90-day rule [stale]" file_contains "$CHECK_REQ" '\[stale\] Never trust an unverified summary'
check "R3: playbook section labeled in the request" file_contains "$CHECK_REQ" 'LEARNED PLAYBOOK'

check "Gherkin2: reflect consulted with the 3 new events" file_contains "$REFLECT_REQ" 'EVENTS SINCE LAST REFLECTION (3 new of 3 total)'
check "Gherkin2: playbook gained rule with confidence" file_contains "$PD3/playbook.md" 'confidence: high'
check "Gherkin2: playbook rule carries provenance" file_contains "$PD3/playbook.md" 'provenance: check-spec:one@2026-08-02T00:00:00Z'
check "Gherkin2: playbook rule carries added + last_confirmed" file_contains "$PD3/playbook.md" "added: $TODAY; last_confirmed: $TODAY"
check "Gherkin2: watermark advanced to all 3 events" [ "$(tr -d ' \n' < "$PD3/learn/watermark")" = "3" ]

# Idempotency: a second reflect with no new events consults nothing.
rm -f "$REFLECT_REQ"
out="$(env LEARN_PIPELINE_DIR="$PD3" LEARN_CONSULT_CMD="$TMP/bin/reflect-consult.sh" bash "$LEARN_REFLECT")"
check "Gherkin2: second run reflects nothing new" str_contains "$out" 'no new events'
check "Gherkin2: second run does not consult" [ ! -f "$REFLECT_REQ" ]
check "Gherkin2: playbook unchanged on second run" [ "$(grep -c '^- ' "$PD3/playbook.md")" = "4" ]

# Advisory on consult failure: watermark must NOT advance.
LEARN_PIPELINE_DIR="$PD3" "$LEARN_EVENT" "dismissal" "some-idea" "dismissed: Some idea" >/dev/null
cat > "$TMP/bin/reflect-fail.sh" <<'EOF'
#!/usr/bin/env bash
cat >/dev/null
exit 1
EOF
chmod +x "$TMP/bin/reflect-fail.sh"
env LEARN_PIPELINE_DIR="$PD3" LEARN_CONSULT_CMD="$TMP/bin/reflect-fail.sh" bash "$LEARN_REFLECT" >/dev/null 2>&1
check "R2: consult failure exits 0 (advisory)" [ "$?" = "0" ]
check "R2: consult failure logged to errors.log" file_contains "$PD3/errors.log" 'watermark NOT advanced'
check "R2: watermark untouched on failure" [ "$(tr -d ' \n' < "$PD3/learn/watermark")" = "3" ]

# ─── R1: record-outcome.sh + dismiss.sh capture ─────────────────────────────

PD4="$TMP/p4"
env PATH="$TMP/bin:$PATH" TASTE_PIPELINE_DIR="$PD4" LEARN_EVENT="$LEARN_EVENT" \
  bash "$RECORD_OUTCOME" "my-spec" "merged" "shipped" >/dev/null 2>&1
check "R1: record-outcome captured" [ "$(json_field "$PD4/learn/events.jsonl" 1 kind)" = "outcome" ]
check "R1: outcome event carries slug+outcome" [ "$(json_field "$PD4/learn/events.jsonl" 1 summary)" = "merged — shipped" ]

env PATH="$TMP/bin:$PATH" TASTE_PIPELINE_DIR="$PD4" LEARN_EVENT="$LEARN_EVENT" \
  bash "$DISMISS" "Some wild idea" "not now" >/dev/null 2>&1
check "R1: dismissal captured" [ "$(json_field "$PD4/learn/events.jsonl" 2 kind)" = "dismissal" ]
check "R1: dismissal event refs the slug" [ "$(json_field "$PD4/learn/events.jsonl" 2 refs)" = "some-wild-idea" ]

# ─── R2: build-queue offers reflection at end of run ────────────────────────

PD5="$TMP/p5"
mkdir -p "$PD5/queue"
echo "# queued spec" > "$PD5/queue/done-spec.md"
printf '%s\n' '{"done-spec":{"status":"built","announced":true}}' > "$PD5/builds.json"
cat > "$TMP/bin/reflect-marker.sh" <<'EOF'
#!/usr/bin/env bash
echo "reflect-offered" >> "$REFLECT_MARKER"
EOF
chmod +x "$TMP/bin/reflect-marker.sh"
export REFLECT_MARKER="$TMP/reflect-marker.txt"

cat > "$TMP/bin/curl-down" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
chmod +x "$TMP/bin/curl-down"
mkdir -p "$TMP/bin-down"
cp "$TMP/bin/curl-down" "$TMP/bin-down/curl"

env PATH="$TMP/bin-down:$PATH" BUILD_QUEUE_DIR="$PD5" RAILS_ENSURE="$TMP/bin/ensure-ok.sh" \
  LEARN_REFLECT="$TMP/bin/reflect-marker.sh" \
  bash "$BUILD_QUEUE" --all >/dev/null 2>&1
check "R2: build-queue run ends in reflection offer" file_contains "$REFLECT_MARKER" 'reflect-offered'

# ─── M3: learnings persist in the second brain ──────────────────────────────

BRAIN_RESOLVE_REAL="$BIN/brain-resolve.sh"

page_field() { # page_field <file> <key> -> top-level frontmatter value
  python3 - "$1" "$2" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
val = ""
try:
    lines = open(path, encoding="utf-8").read().split("\n")
except Exception:
    lines = []
if lines and lines[0].strip() == "---":
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith((" ", "\t")):
            continue
        k, sep, v = line.partition(":")
        if sep and k.strip() == key:
            val = v.strip()
print(val)
PY
}

page_prov() { # page_prov <file> -> provenance_refs items, one per line
  python3 - "$1" <<'PY'
import sys
try:
    lines = open(sys.argv[1], encoding="utf-8").read().split("\n")
except Exception:
    lines = []
items = []
in_refs = False
if lines and lines[0].strip() == "---":
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith("provenance_refs:"):
            in_refs = True
            continue
        if in_refs:
            if line.startswith(("  - ", "- ")):
                items.append(line.split("- ", 1)[1].strip())
            elif line.strip():
                in_refs = False
print("\n".join(items))
PY
}

fm_list() { # fm_list <file> <key> -> dashed frontmatter list items
  python3 - "$1" "$2" <<'PY'
import sys
path, key = sys.argv[1], sys.argv[2]
try:
    lines = open(path, encoding="utf-8").read().split("\n")
except Exception:
    lines = []
items = []
in_list = False
if lines and lines[0].strip() == "---":
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith(key + ":"):
            in_list = True
            continue
        if in_list:
            if line.startswith(("  - ", "- ")):
                items.append(line.split("- ", 1)[1].strip())
            elif line.strip():
                in_list = False
print("\n".join(items))
PY
}

# Scenario: rules land in the brain (2 rules, one learn: commit).
PD6="$TMP/p6"
BRAIN6="$TMP/brain6"
mkdir -p "$BRAIN6"
git -C "$BRAIN6" init -q
git -C "$BRAIN6" config user.email "learn-test@example.com"
git -C "$BRAIN6" config user.name "learn-test"

LEARN_PIPELINE_DIR="$PD6" "$LEARN_EVENT" "gate" "git push" "verdict=STEER" >/dev/null
LEARN_PIPELINE_DIR="$PD6" "$LEARN_EVENT" "outcome" "older-thing" "reverted" >/dev/null
LEARN_PIPELINE_DIR="$PD6" "$LEARN_EVENT" "check-spec" "one" "verdict=READY round=0" >/dev/null

out="$(env LEARN_PIPELINE_DIR="$PD6" TASTE_BRAIN="$BRAIN6" BRAIN_RESOLVE="$BRAIN_RESOLVE_REAL" \
  LEARN_CONSULT_CMD="$TMP/bin/reflect-consult.sh" bash "$LEARN_REFLECT")"
check "M3: reflection with brain succeeds" str_contains "$out" 'persisted to'
check "M3: two lesson pages written" [ "$(ls "$BRAIN6/learnings"/*.md 2>/dev/null | wc -l | tr -d ' ')" = "2" ]

slug1="$(python3 -c 'import re; print(re.sub(r"[^a-z0-9]+", "-", "Always run the full pipeline test suite before the prescribed commit".lower()).strip("-")[:60].rstrip("-"))')"
page1="$BRAIN6/learnings/$slug1.md"
check "M3: page slug from rule title" test -f "$page1"
check "M3: page type is lesson" [ "$(page_field "$page1" type)" = "lesson" ]
check "M3: page status active" [ "$(page_field "$page1" status)" = "active" ]
check "M3: page has domain" [ "$(page_field "$page1" domain)" = "pipeline" ]
check "M3: page confidence carried" [ "$(page_field "$page1" confidence)" = "high" ]
check "M3: page added date" [ "$(page_field "$page1" added)" = "$TODAY" ]
check "M3: page last_confirmed date" [ "$(page_field "$page1" last_confirmed)" = "$TODAY" ]
check "M3: page provenance refs carried" str_contains "$(page_prov "$page1")" 'check-spec:one@2026-08-02T00:00:00Z'
check "M3: page body carries the rule text" file_contains "$page1" 'Always run the full pipeline test suite'
check "M3: exactly one brain commit" [ "$(git -C "$BRAIN6" rev-list --count HEAD)" = "1" ]
check "M3: commit message is learn: <n> rules (<date>)" [ "$(git -C "$BRAIN6" log -1 --pretty=%s)" = "learn: 2 rules ($TODAY)" ]
check "M3: commit touches only learnings/" [ -z "$(git -C "$BRAIN6" show --pretty= --name-only HEAD | grep -v '^learnings/')" ]

# Scenario: aging is visible (stale flip on the next run).
cat > "$BRAIN6/learnings/old-rule.md" <<EOF
---
type: lesson
status: active
domain: pipeline
confidence: medium
provenance_refs:
  - gate:something@$OLD_DATE
added: $OLD_DATE
last_confirmed: $OLD_DATE
---

# An old rule that was never reconfirmed
EOF

cat > "$TMP/bin/reflect-consult-1.sh" <<'EOF'
#!/usr/bin/env bash
cat >/dev/null
echo "RULE | Keep reflections idempotent across runs | high | gate:git-push@2026-08-02T01:00:00Z"
EOF
chmod +x "$TMP/bin/reflect-consult-1.sh"

LEARN_PIPELINE_DIR="$PD6" "$LEARN_EVENT" "gate" "git commit" "verdict=APPROVE" >/dev/null
out="$(env LEARN_PIPELINE_DIR="$PD6" TASTE_BRAIN="$BRAIN6" BRAIN_RESOLVE="$BRAIN_RESOLVE_REAL" \
  LEARN_CONSULT_CMD="$TMP/bin/reflect-consult-1.sh" bash "$LEARN_REFLECT")"
check "M3: aged rule flipped to stale" [ "$(page_field "$BRAIN6/learnings/old-rule.md" status)" = "stale" ]
check "M3: stale flip keeps the page content" file_contains "$BRAIN6/learnings/old-rule.md" 'An old rule that was never reconfirmed'
check "M3: fresh rules stay active" [ "$(page_field "$page1" status)" = "active" ]
check "M3: second run = one more learn: commit" [ "$(git -C "$BRAIN6" rev-list --count HEAD)" = "2" ]
check "M3: single-rule commit message is learn: <slug>" [ "$(git -C "$BRAIN6" log -1 --pretty=%s)" = "learn: keep-reflections-idempotent-across-runs" ]
check "M3: brain never pushed (no remotes)" [ -z "$(git -C "$BRAIN6" remote)" ]

# Scenario: no brain, no problem (playbook still updates, skip noted once).
PD7="$TMP/p7"
LEARN_PIPELINE_DIR="$PD7" "$LEARN_EVENT" "outcome" "foo" "merged" >/dev/null
env LEARN_PIPELINE_DIR="$PD7" TASTE_BRAIN="$TMP/no-such-brain" BRAIN_RESOLVE="$BRAIN_RESOLVE_REAL" \
  LEARN_CONSULT_CMD="$TMP/bin/reflect-consult-1.sh" bash "$LEARN_REFLECT" >/dev/null 2>&1
check "M3: no-brain reflection exits 0" [ "$?" = "0" ]
check "M3: playbook still updates without a brain" file_contains "$PD7/playbook.md" 'Keep reflections idempotent across runs'
check "M3: skip noted exactly once in errors.log" [ "$(grep -c 'no brain resolvable' "$PD7/errors.log")" = "1" ]
check "M3: no phantom brain dir created" [ ! -e "$TMP/no-such-brain" ]

# Non-git brain: pages still written, no commit attempted, exit 0.
PD8="$TMP/p8"
BRAIN8="$TMP/brain8"
mkdir -p "$BRAIN8"
LEARN_PIPELINE_DIR="$PD8" "$LEARN_EVENT" "outcome" "bar" "merged" >/dev/null
env LEARN_PIPELINE_DIR="$PD8" TASTE_BRAIN="$BRAIN8" BRAIN_RESOLVE="$BRAIN_RESOLVE_REAL" \
  LEARN_CONSULT_CMD="$TMP/bin/reflect-consult-1.sh" bash "$LEARN_REFLECT" >/dev/null 2>&1
rc=$?
check "M3: non-git brain still gets pages" [ "$(ls "$BRAIN8/learnings"/*.md 2>/dev/null | wc -l | tr -d ' ')" = "1" ]
check "M3: non-git brain run exits 0" [ "$rc" = "0" ]

# ─── M2-R1: repeated failures become a proposal ─────────────────────────────

# Scenario: 3+ same-kind provenance events → upgrade_candidate + proposal.
PD9="$TMP/p9"
LEARN_PIPELINE_DIR="$PD9" "$LEARN_EVENT" "gate" "git commit -m a" "verdict=STEER" >/dev/null
LEARN_PIPELINE_DIR="$PD9" "$LEARN_EVENT" "gate" "git commit -m b" "verdict=STEER" >/dev/null
LEARN_PIPELINE_DIR="$PD9" "$LEARN_EVENT" "gate" "git push" "verdict=STEER" >/dev/null

cat > "$TMP/bin/reflect-consult-m2.sh" <<'EOF'
#!/usr/bin/env bash
cat >/dev/null
cat <<'RULES'
RULE | Never commit while the gate is red | high | gate:git-commit-a@2026-08-02T00:00:01Z, gate:git-commit-b@2026-08-02T00:00:02Z, gate:git-push-c@2026-08-02T00:00:03Z
RULE | Keep summaries short | low | outcome:x@2026-08-02T00:00:04Z, gate:git-commit-d@2026-08-02T00:00:05Z
RULES
EOF
chmod +x "$TMP/bin/reflect-consult-m2.sh"

env LEARN_PIPELINE_DIR="$PD9" BRAIN_RESOLVE="$BRAIN_RESOLVE_REAL" \
  LEARN_CONSULT_CMD="$TMP/bin/reflect-consult-m2.sh" bash "$LEARN_REFLECT" >/dev/null 2>&1

check "M2: 3+ same-kind rule marked upgrade_candidate" file_contains "$PD9/playbook.md" 'Never commit while the gate is red.*upgrade_candidate: true'
check "M2: exactly one rule flagged" [ "$(grep -c 'upgrade_candidate: true' "$PD9/playbook.md")" = "1" ]
prop9="$PD9/proposals/never-commit-while-the-gate-is-red.md"
check "M2: proposal file written for the flagged rule" test -f "$prop9"
check "M2: no proposal for the mixed-kind rule" [ "$(ls "$PD9/proposals"/*.md 2>/dev/null | wc -l | tr -d ' ')" = "1" ]
check "M2: proposal carries target_artifact" [ "$(page_field "$prop9" target_artifact)" = "docs/pipeline/playbook.md" ]
check "M2: proposal kind computed as data" [ "$(page_field "$prop9" kind)" = "data" ]
check "M2: proposal lists 3 evidence events" [ "$(fm_list "$prop9" evidence_event_ids | wc -l | tr -d ' ')" = "3" ]
check "M2: evidence ids carried" str_contains "$(fm_list "$prop9" evidence_event_ids)" 'gate:git-commit-b@2026-08-02T00:00:02Z'
check "M2: proposal has a Proposed change section" file_contains "$prop9" '## Proposed change'
check "M2: default proposed change is the rule itself" file_contains "$prop9" 'Never commit while the gate is red'

# Scenario: consult steers the proposal target via PROPOSAL line (+ fence).
PD10="$TMP/p10"
LEARN_PIPELINE_DIR="$PD10" "$LEARN_EVENT" "gate" "git commit" "verdict=STEER" >/dev/null

cat > "$TMP/bin/reflect-consult-m2b.sh" <<'EOF'
#!/usr/bin/env bash
cat >/dev/null
cat <<'OUT'
RULE | Always run tests before the prescribed commit | high | gate:a@2026-08-02T00:00:01Z, gate:b@2026-08-02T00:00:02Z, gate:c@2026-08-02T00:00:03Z
PROPOSAL | .steering/prompt.md | Add a test-first line to the steering prompt

```
New prompt line: the working agent runs .steering/test-command before every commit.
```
RULE | Cache triage responses between runs | medium | check-spec:a@2026-08-02T00:00:01Z, check-spec:b@2026-08-02T00:00:02Z, check-spec:c@2026-08-02T00:00:03Z
PROPOSAL | docs/pipeline/bin/check-spec.sh | Add a triage cache to check-spec
OUT
EOF
chmod +x "$TMP/bin/reflect-consult-m2b.sh"

env LEARN_PIPELINE_DIR="$PD10" BRAIN_RESOLVE="$BRAIN_RESOLVE_REAL" \
  LEARN_CONSULT_CMD="$TMP/bin/reflect-consult-m2b.sh" bash "$LEARN_REFLECT" >/dev/null 2>&1

prop10="$PD10/proposals/always-run-tests-before-the-prescribed-commit.md"
prop10c="$PD10/proposals/cache-triage-responses-between-runs.md"
check "M2: PROPOSAL line steers the target" [ "$(page_field "$prop10" target_artifact)" = ".steering/prompt.md" ]
check "M2: steered prompt target is data kind" [ "$(page_field "$prop10" kind)" = "data" ]
check "M2: fenced block becomes the proposed change" file_contains "$prop10" 'New prompt line: the working agent runs .steering/test-command before every commit.'
check "M2: script target computed as code kind" [ "$(page_field "$prop10c" kind)" = "code" ]

# ─── summary ────────────────────────────────────────────────────────────────


if [ "$failures" -eq 0 ]; then
  echo "learn-test: all checks passed"
else
  echo "learn-test: $failures check(s) FAILED" >&2
  exit 1
fi
