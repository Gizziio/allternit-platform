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
url=""; payload=""; prev=""
for a in "$@"; do
  [ "$prev" = "-d" ] && payload="$a"
  case "$a" in http*) url="$a" ;; esac
  prev="$a"
done
printf '%s %s\n' "$url" "$payload" >> "$CURL_CAPTURE"
if [[ "$url" == *:8013* && "${RAILS_MODE:-}" == "fail" ]]; then
  printf '500'
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
  bash -c 'grep -q "ao-send build-alpha" "$AO_LOG" && grep -q "wt-build-alpha/.pipeline/builds/alpha-TASK.md" "$AO_LOG"'
check "watch called with session build-alpha + sentinel + 3600 30" \
  file_contains "$AO_LOG" "ao-watch build-alpha $TMP/wt-build-alpha/docs/BUILD_ALPHA_NOTES.sentinel 3600 30"
check "task file copied into worktree" test -f "$TMP/wt-build-alpha/.pipeline/builds/alpha-TASK.md"

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

# ─── Result ─────────────────────────────────────────────────────────────────

rm -rf "$TMP"
if [ "$failures" -gt 0 ]; then
  echo ""
  echo "$failures check(s) FAILED"
  exit 1
fi
echo ""
echo "All checks passed."
