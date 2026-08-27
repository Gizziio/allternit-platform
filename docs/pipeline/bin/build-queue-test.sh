#!/usr/bin/env bash
# build-queue-test.sh — offline test for build-queue.sh.
#   - ao-spawn / ao-send / ao-watch / curl PATH-shimmed with capture fakes
#     (ao-spawn prints a fake "<session> <workdir> <log>"; ao-watch creates
#     the sentinel it is given and exits 0, or exits 3 under WATCH_MODE=fail)
#   - rails-ensure stubbed via RAILS_ENSURE
# Verifies: rails-ensure failure aborts before any spawn; a queued spec
# produces a task file with the spec content + executor conventions;
# spawn/send/watch called with the right session names; `built` recorded;
# rails announcement captured with the awaiting-merge note; already-built
# slug skipped on re-run; --no-wait spawns without watching; watch exit 3
# records `failed` + announces "failed: <slug>"; announce failure records
# `announced: false` + errors.log and a re-run retries ONLY the announce
# (no re-spawn); ao-send failure records `failed` + errors.log; empty queue
# exits 0. PASS/FAIL lines, non-zero exit on any FAIL.
set -uo pipefail

BUILD_QUEUE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build-queue.sh"
TMP="$(mktemp -d /tmp/build-queue-test-XXXXXX)"
export TMP
PDIR="$TMP/pipeline"
mkdir -p "$PDIR/queue" "$TMP/bin"

export BUILD_QUEUE_DIR="$PDIR"
export AO_LOG="$TMP/ao.log"
export CURL_CAPTURE="$TMP/curl.log"
touch "$AO_LOG" "$CURL_CAPTURE"

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

# ─── Stubs ──────────────────────────────────────────────────────────────────

cat > "$TMP/ensure-ok.sh" <<'EOF'
#!/usr/bin/env bash
echo "rails: OK"
exit 0
EOF
cat > "$TMP/ensure-fail.sh" <<'EOF'
#!/usr/bin/env bash
echo "rails: nope" >&2
exit 1
EOF

cat > "$TMP/bin/ao-spawn" <<'EOF'
#!/usr/bin/env bash
echo "ao-spawn $*" >> "$AO_LOG"
slug="$2"  # --worktree <slug> <root> <cmd...>
wt="$TMP_WT/wt-$slug"
mkdir -p "$wt"
echo "ao-$slug $wt $TMP_WT/ao-$slug.log"
EOF

cat > "$TMP/bin/ao-send" <<'EOF'
#!/usr/bin/env bash
echo "ao-send $*" >> "$AO_LOG"
if [ "${SEND_MODE:-}" = "fail" ]; then
  echo "error: prompt not found (stubbed)" >&2
  exit 1
fi
EOF

cat > "$TMP/bin/ao-watch" <<'EOF'
#!/usr/bin/env bash
echo "ao-watch $*" >> "$AO_LOG"
if [ "${WATCH_MODE:-}" = "fail" ]; then
  echo "PANE-DEAD ao-$1 (stubbed)"
  exit 3
fi
mkdir -p "$(dirname "$2")"
touch "$2"
echo "DONE $2"
exit 0
EOF

cat > "$TMP/bin/curl" <<'EOF'
#!/usr/bin/env bash
url=""; payload=""; prev=""; method=""
for a in "$@"; do
  [ "$prev" = "-d" ] && payload="$a"
  [ "$prev" = "-X" ] && method="$a"
  case "$a" in http*) url="$a" ;; esac
  prev="$a"
done
printf '%s %s %s\n' "$method" "$url" "$payload" >> "$CURL_CAPTURE"
if [[ "$url" == *:8013* && "${RAILS_MODE:-}" == "fail" ]]; then
  printf '500'
elif [[ "$url" == *"/api/rails/tickets/ready"* ]]; then
  # B3-R2: ready list from fixture; TICKETS_MODE=fail simulates outage.
  if [ "${TICKETS_MODE:-}" = "fail" ]; then
    printf '500'
  else
    cat "$TICKETS_FIXTURE/ready.json" 2>/dev/null
  fi
elif [[ "$url" == *"/api/rails/graph/triage"* ]]; then
  # B3-R2: triage ordering from fixture; TRIAGE_MODE=fail degrades ordering.
  if [ "${TRIAGE_MODE:-}" = "fail" ]; then
    printf '500'
  else
    cat "$TICKETS_FIXTURE/triage.json" 2>/dev/null
  fi
elif [[ "$url" == *"/api/rails/tickets/"*"/close"* ]]; then
  printf '%s' '{"ticket":{"status":"closed"}}'
elif [[ "$url" == *"/api/rails/tickets/"* && "$method" = "PATCH" ]]; then
  printf '%s' '{"ticket":{"status":"open"}}'
elif [[ "$url" == *"/api/rails/tickets/"* ]]; then
  printf '{"ticket":{"id":"%s","description":"original desc"}}' "${url##*/}"
else
  printf '201'
fi
EOF

chmod +x "$TMP/bin/ao-spawn" "$TMP/bin/ao-send" "$TMP/bin/ao-watch" "$TMP/bin/curl"
export PATH="$TMP/bin:$PATH"
export TMP_WT="$TMP"

# ─── Fixtures ───────────────────────────────────────────────────────────────

for s in alpha beta gamma eta zeta; do
  printf '# %s spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' "$s" > "$PDIR/queue/$s.md"
done

build_field() { # build_field <slug> <field>
  python3 - "$PDIR/builds.json" "$1" "$2" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    d = {}
v = d.get(sys.argv[2], {}).get(sys.argv[3], "")
print("" if v is None else v)
PY
}

run_queue() { bash "$BUILD_QUEUE" "$@"; }

# ─── Run 0: list mode (no args, read-only) ──────────────────────────────────

out0="$(run_queue)"; rc0=$?
check "list mode exits 0" test "$rc0" -eq 0
check "list mode shows queued specs" file_contains <(printf '%s' "$out0") "alpha"

# ─── Run 1: rails-ensure failure aborts before any spawn ────────────────────

: > "$AO_LOG"
out1="$(RAILS_ENSURE="$TMP/ensure-fail.sh" run_queue alpha)"; rc1=$?
check "rails-ensure failure exits non-zero" test "$rc1" -ne 0
check "rails-ensure failure: no spawn attempted" test ! -s "$AO_LOG"
check "rails-ensure failure: nothing recorded" test -z "$(build_field alpha status)"

# ─── Run 2: happy path — alpha built ────────────────────────────────────────

export RAILS_ENSURE="$TMP/ensure-ok.sh"
: > "$AO_LOG"; : > "$CURL_CAPTURE"
out2="$(run_queue alpha)"; rc2=$?
printf '%s\n' "$out2" > "$TMP/out2.txt"
check "build run exits 0" test "$rc2" -eq 0

TASK="$PDIR/builds/alpha-TASK.md"
check "task file generated" test -f "$TASK"
check "task file contains spec content" file_contains "$TASK" "R1: WHEN x, THE SYSTEM SHALL y"
check "task file contains executor conventions (steering)" file_contains "$TASK" "steering"
check "task file names the NOTES file" file_contains "$TASK" "BUILD_ALPHA_NOTES.md"
check "task file names the sentinel" file_contains "$TASK" "BUILD_ALPHA_NOTES.sentinel"
check "task file forbids merge (human boundary)" file_contains "$TASK" "human merges"

check "spawn called with session build-alpha" file_contains "$AO_LOG" "ao-spawn --worktree build-alpha"
check "send called with session build-alpha + in-worktree task path" \
  bash -c 'grep -q "ao-send build-alpha" "$AO_LOG" && grep -q "wt-build-alpha/docs/pipeline/builds/alpha-TASK.md" "$AO_LOG"'
check "watch called with session build-alpha + sentinel + 3600 30" \
  file_contains "$AO_LOG" "ao-watch build-alpha $TMP/wt-build-alpha/docs/BUILD_ALPHA_NOTES.sentinel 3600 30"
check "task file copied into worktree" test -f "$TMP/wt-build-alpha/docs/pipeline/builds/alpha-TASK.md"

check "built recorded in builds.json" test "$(build_field alpha status)" = "built"
check "built recorded with timestamp" test -n "$(build_field alpha updated)"
check "rails announcement: thread + awaiting-merge note + worktree NOTES asset_ref" \
  bash -c 'grep -q "wih:pipeline-builds" "$CURL_CAPTURE" \
    && grep -q "built: alpha" "$CURL_CAPTURE" \
    && grep -q "awaiting human merge review" "$CURL_CAPTURE" \
    && grep -q "wt-build-alpha/docs/BUILD_ALPHA_NOTES.md" "$CURL_CAPTURE"'

# ─── Run 3: re-run skips the already-built slug ─────────────────────────────

: > "$AO_LOG"
run_queue alpha >/dev/null
check "already-built slug skipped on re-run (no spawn)" test ! -s "$AO_LOG"

# ─── Run 4: --no-wait spawns without watching ───────────────────────────────

: > "$AO_LOG"
out4="$(run_queue --no-wait beta)"; rc4=$?
check "--no-wait run exits 0" test "$rc4" -eq 0
check "--no-wait spawns" file_contains "$AO_LOG" "ao-spawn --worktree build-beta"
check "--no-wait does not watch" bash -c '! grep -q "ao-watch" "$AO_LOG"'
check "--no-wait leaves status building" test "$(build_field beta status)" = "building"

# ─── Run 5: watch exit 3 -> failed recorded + announced ─────────────────────

: > "$CURL_CAPTURE"
out5="$(WATCH_MODE=fail run_queue gamma)"; rc5=$?
check "watch-failure run exits non-zero" test "$rc5" -ne 0
check "failed recorded in builds.json" test "$(build_field gamma status)" = "failed"
check "watch exit code recorded" test "$(build_field gamma watch_exit)" = "3"
check "rails announcement: failed note" file_contains "$CURL_CAPTURE" "failed: gamma"
check "announce tracked separately: announced true after 2xx" \
  test "$(build_field gamma announced)" = "True"

# ─── Run 6: ao-send failure -> failed recorded + errors.log (no stuck state) ─

: > "$AO_LOG"; rm -f "$PDIR/errors.log"
out6="$(SEND_MODE=fail run_queue eta)"; rc6=$?
check "ao-send failure exits non-zero" test "$rc6" -ne 0
check "ao-send failure records failed (not stuck building)" \
  test "$(build_field eta status)" = "failed"
check "ao-send failure records reason" test "$(build_field eta reason)" = "ao-send failed"
check "ao-send failure logged to errors.log" file_contains "$PDIR/errors.log" "ao-send failed for eta"
check "ao-send failure: no watch attempted" bash -c '! grep -q "ao-watch" "$AO_LOG"'

# ─── Run 7: announce failure -> announced:false, retry announces w/o respawn ─

rm -f "$PDIR/errors.log"
out7="$(RAILS_MODE=fail run_queue zeta)"; rc7=$?
check "announce failure exits non-zero (hard error)" test "$rc7" -ne 0
check "announce failure: watch verdict still recorded" \
  test "$(build_field zeta status)" = "built"
check "announce failure: announced recorded false" \
  test "$(build_field zeta announced)" = "False"
check "announce failure: asset_ref stashed for retry" \
  test -n "$(build_field zeta announce_asset_ref)"
check "announce failure: note stashed for retry" \
  test -n "$(build_field zeta announce_note)"
check "announce failure logged to errors.log" file_contains "$PDIR/errors.log" "builds announce failed for zeta"

: > "$AO_LOG"; : > "$CURL_CAPTURE"
out8="$(run_queue zeta)"; rc8=$?
check "announce-retry run exits 0" test "$rc8" -eq 0
check "announce retry does NOT re-spawn" test ! -s "$AO_LOG"
check "announce retry delivers the stashed note" \
  bash -c 'grep -q "wih:pipeline-builds" "$CURL_CAPTURE" && grep -q "built: zeta" "$CURL_CAPTURE" && grep -q "awaiting human merge review" "$CURL_CAPTURE"'
check "announced flips to true after successful retry" \
  test "$(build_field zeta announced)" = "True"
: > "$AO_LOG"
run_queue zeta >/dev/null
check "fully-announced built slug skipped thereafter" test ! -s "$AO_LOG"

# ─── Run 8: --all builds everything not already building/built ──────────────

rm -f "$PDIR/builds.json" "$PDIR/queue"/{beta,gamma,eta,zeta}.md
printf '# delta spec\n\n## Requirements\n\n- [ ] R1: WHEN d, THE SYSTEM SHALL e\n' > "$PDIR/queue/delta.md"
: > "$AO_LOG"
run_queue --all >/dev/null
check "--all skips nothing pending: alpha + delta spawned" \
  bash -c 'grep -q "build-alpha" "$AO_LOG" && grep -q "build-delta" "$AO_LOG"'

# ─── Run 9: empty queue exits 0 with a sensible message ─────────────────────

rm -f "$PDIR/queue"/*.md
out7="$(run_queue --all)"; rc7=$?
check "empty queue (--all) exits 0" test "$rc7" -eq 0
check "empty queue message" file_contains <(printf '%s' "$out7") "queue is empty"
out8="$(run_queue)"; rc8=$?
check "empty queue (list mode) exits 0" test "$rc8" -eq 0
check "empty queue list message" file_contains <(printf '%s' "$out8") "queue is empty"

# ─── B3 fixtures: ready/triage endpoints + record-outcome capture ────────────

mkdir -p "$TMP/fixtures"
export TICKETS_FIXTURE="$TMP/fixtures"
export OUTCOME_LOG="$TMP/outcome.log"
: > "$OUTCOME_LOG"
cat > "$TMP/record-outcome-stub.sh" <<'EOF'
#!/usr/bin/env bash
echo "record-outcome $*" >> "$OUTCOME_LOG"
EOF
export RECORD_OUTCOME="$TMP/record-outcome-stub.sh"

spawn_order() { grep 'ao-spawn' "$AO_LOG" | sed 's/.*--worktree build-\([a-z0-9]*\).*/\1/' | tr '\n' ','; }

# ─── B3-R2: ticketed ordering — scored > 50-cap fallback > legacy ───────────

for s in sx sy sz sw blk leg; do
  printf '# %s spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' "$s" > "$PDIR/queue/$s.md"
done
cat > "$TICKETS_FIXTURE/ready.json" <<'EOF'
{"ready":[
  {"id":"T-sx","title":"sx","created_at":"2026-08-01T00:00:00Z","labels":["pipeline","spec:sx"]},
  {"id":"T-sy","title":"sy","created_at":"2026-08-01T00:01:00Z","labels":["pipeline","spec:sy"]},
  {"id":"T-sz","title":"sz","created_at":"2026-08-01T00:03:00Z","labels":["pipeline","spec:sz"]},
  {"id":"T-sw","title":"sw","created_at":"2026-08-01T00:02:00Z","labels":["pipeline","spec:sw"]},
  {"id":"T-other","title":"other","created_at":"2026-08-01T00:00:00Z","labels":["other-team"]}
]}
EOF
# Triage is the 50-capped view: sz/sw are ready but absent from it.
cat > "$TICKETS_FIXTURE/triage.json" <<'EOF'
{"ready_count":4,"items":[
  {"ticket":"T-sx","title":"sx","score":25,"reason":"unblocks 2","unblocks":2},
  {"ticket":"T-sy","title":"sy","score":5,"reason":"priority","unblocks":0}
]}
EOF
python3 - "$PDIR/verdicts.json" <<'PY'
import json, sys
d = {s: {"verdict": "READY", "rounds": 0, "ticket_id": "T-" + s} for s in ("sx", "sy", "sz", "sw", "blk")}
json.dump(d, open(sys.argv[1], "w"), indent=2, sort_keys=True)
PY

: > "$AO_LOG"; : > "$CURL_CAPTURE"
out10="$(run_queue --all --no-wait)"; rc10=$?
printf '%s\n' "$out10" > "$TMP/out10.txt"
check "B3-R2: ticketed --all run exits 0" test "$rc10" -eq 0
check "B3-R2: scored (triage order) > 50-cap fallback (created_at) > legacy" \
  test "$(spawn_order)" = "sx,sy,sw,sz,leg,"
check "B3-R2: blocked ticket (not in ready list) skipped, not built as legacy" \
  bash -c '! grep -q "build-blk" "$AO_LOG" && grep -q "blk — ticket not ready" "$TMP/out10.txt"'
check "B3-R2: ready + triage endpoints consumed" \
  bash -c 'grep -q "api/rails/tickets/ready" "$CURL_CAPTURE" && grep -q "api/rails/graph/triage" "$CURL_CAPTURE"'

# ─── B3-R3: built -> ticket closed (reason = NOTES path) + outcome merged ───

rm -f "$PDIR/builds.json"
printf '# tb spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' > "$PDIR/queue/tb.md"
python3 - "$PDIR/verdicts.json" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
d["tb"] = {"verdict": "READY", "rounds": 0, "ticket_id": "T-tb"}
json.dump(d, open(p, "w"), indent=2, sort_keys=True)
PY
: > "$AO_LOG"; : > "$CURL_CAPTURE"; : > "$OUTCOME_LOG"
out11="$(run_queue tb)"; rc11=$?
check "B3-R3: built run exits 0" test "$rc11" -eq 0
check "B3-R3: built -> POST close with reason = NOTES path" \
  bash -c 'grep -q "POST http://localhost:8013/api/rails/tickets/T-tb/close" "$CURL_CAPTURE" \
    && grep -q "BUILD_TB_NOTES.md" "$CURL_CAPTURE"'
check "B3-R3: outcome recorded via record-outcome.sh (merged)" \
  file_contains "$OUTCOME_LOG" "record-outcome tb merged"

# ─── B3-R3: failed -> ticket stays open + PATCH note + outcome failed ───────

rm -f "$PDIR/builds.json"
printf '# tf spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' > "$PDIR/queue/tf.md"
python3 - "$PDIR/verdicts.json" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
d["tf"] = {"verdict": "READY", "rounds": 0, "ticket_id": "T-tf"}
json.dump(d, open(p, "w"), indent=2, sort_keys=True)
PY
: > "$AO_LOG"; : > "$CURL_CAPTURE"; : > "$OUTCOME_LOG"
out12="$(WATCH_MODE=fail run_queue tf)"; rc12=$?
check "B3-R3: failed run exits non-zero" test "$rc12" -ne 0
check "B3-R3: failed -> ticket NOT closed" bash -c '! grep -q "/close" "$CURL_CAPTURE"'
check "B3-R3: failed -> ticket fetched + PATCHed with appended failure note" \
  bash -c 'grep -q "PATCH http://localhost:8013/api/rails/tickets/T-tf" "$CURL_CAPTURE" \
    && grep -qF "[build-queue] failed: tf" "$CURL_CAPTURE" \
    && grep -q "original desc" "$CURL_CAPTURE"'
check "B3-R3: outcome recorded via record-outcome.sh (failed)" \
  file_contains "$OUTCOME_LOG" "record-outcome tf failed"

# ─── B3-R2: triage down -> ticketed items unscored (created_at order) ───────

rm -f "$PDIR/builds.json" "$PDIR/queue"/*.md
for s in sx sy; do
  printf '# %s spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' "$s" > "$PDIR/queue/$s.md"
done
: > "$AO_LOG"
out13="$(TRIAGE_MODE=fail run_queue --all --no-wait)"; rc13=$?
check "B3-R2: triage-down run exits 0 (ordering degrade only)" test "$rc13" -eq 0
check "B3-R2: triage-down falls back to created_at order" \
  test "$(spawn_order)" = "sx,sy,"

# ─── B3-R2: tickets endpoint down -> documented legacy file mode ─────────────

rm -f "$PDIR/builds.json" "$PDIR/queue"/*.md
printf '# d1 spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' > "$PDIR/queue/d1.md"
printf '# d2 spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' > "$PDIR/queue/d2.md"
rm -f "$PDIR/errors.log"
: > "$AO_LOG"
out14="$(TICKETS_MODE=fail run_queue --all --no-wait)"; rc14=$?
check "B3-R2: endpoint-down run exits 0 (legacy degrade)" test "$rc14" -eq 0
check "B3-R2: degrade logged to errors.log" \
  file_contains "$PDIR/errors.log" "degraded to legacy file mode"
check "B3-R2: legacy mode builds every queue file in glob order" \
  test "$(spawn_order)" = "d1,d2,"

# ─── Result ─────────────────────────────────────────────────────────────────

rm -rf "$TMP"
if [ "$failures" -gt 0 ]; then
  echo ""
  echo "$failures check(s) FAILED"
  exit 1
fi
echo ""
echo "All checks passed."
