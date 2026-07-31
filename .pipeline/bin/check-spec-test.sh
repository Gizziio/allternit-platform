#!/usr/bin/env bash
# check-spec-test.sh — offline test for check-spec.sh.
#   - SPEC_CHECK_CMD stubbed to cat canned verdict files (per spec slug)
#   - curl PATH-shimmed with a capture fake (rails announce + memory ingest)
#   - rails-ensure stubbed via RAILS_ENSURE
# Verifies: READY moves + announces + records; NEEDS-WORK writes .review.md
# and increments round; bullet-prefix-tolerant verdict parsing; 2nd
# NEEDS-WORK triggers the memory POST; 3rd marks STALLED and skips
# afterwards; memory failure is advisory (logged, run continues); transport
# failure records nothing. PASS/FAIL lines, non-zero exit on any FAIL.
set -uo pipefail

CHECK_SPEC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-spec.sh"
TMP="$(mktemp -d /tmp/check-spec-test-XXXXXX)"
export TMP
PDIR="$TMP/pipeline"
mkdir -p "$PDIR/specs" "$TMP/canned" "$TMP/bin"

export CHECK_SPEC_DIR="$PDIR"
export CONSULT_LOG="$TMP/consults.log"
export CURL_CAPTURE="$TMP/curl.log"
export CANNED_DIR="$TMP/canned"
touch "$CONSULT_LOG" "$CURL_CAPTURE"

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
export RAILS_ENSURE="$TMP/ensure-ok.sh"
export SPEC_RUBRIC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/spec-rubric.md"

cat > "$TMP/stub-consult.sh" <<'EOF'
#!/usr/bin/env bash
req="$(cat)"
printf '%s' "$req" > "$(dirname "$CONSULT_LOG")/last-request.txt"
slug="$(printf '%s' "$req" | sed -n 's/.*SPEC UNDER REVIEW: \.pipeline\/specs\/\([^.]*\)\.md.*/\1/p' | head -1)"
echo "$slug" >> "$CONSULT_LOG"
if [ -n "$slug" ] && [ -f "$CANNED_DIR/$slug.txt" ]; then
  cat "$CANNED_DIR/$slug.txt"
  exit 0
fi
exit 1  # transport failure
EOF
chmod +x "$TMP/stub-consult.sh"
export SPEC_CHECK_CMD="$TMP/stub-consult.sh"

cat > "$TMP/bin/curl" <<'EOF'
#!/usr/bin/env bash
url=""; payload=""; prev=""
for a in "$@"; do
  [ "$prev" = "-d" ] && payload="$a"
  case "$a" in http*) url="$a" ;; esac
  prev="$a"
done
printf '%s %s\n' "$url" "$payload" >> "$CURL_CAPTURE"
if [[ "$url" == *:3201/api/query* && "${MEMORY_MODE:-}" != "fail" ]]; then
  # Realistic memory response for the taste-precedents query.
  printf '%s' '{"answer":"past rejections: crypto trading bot (charter: no crypto)","memories":[{"content":"REJECTED spec nft-minter — violates crypto/web3 clause"}],"insights":[]}'
elif [[ "$url" == *:3201* && "${MEMORY_MODE:-}" == "fail" ]]; then
  printf '500'
elif [[ "$url" == *:8013* && "${RAILS_MODE:-}" == "fail" ]]; then
  printf '500'
else
  printf '201'
fi
EOF
chmod +x "$TMP/bin/curl"
export PATH="$TMP/bin:$PATH"

# ─── Fixtures ───────────────────────────────────────────────────────────────

for s in alpha beta gamma; do
  printf '# %s spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' "$s" > "$PDIR/specs/$s.md"
done
printf 'READY\n\nAll four checks pass.\n' > "$TMP/canned/alpha.txt"
printf '• NEEDS-WORK\n• R1: trigger is not observable — define the dispatch signal\n' > "$TMP/canned/beta.txt"
# gamma has no canned file -> stub consult exits 1 (transport failure)

run_checker() { bash "$CHECK_SPEC"; }

verdict_field() { # verdict_field <slug> <field>
  python3 - "$PDIR/verdicts.json" "$1" "$2" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    d = {}
print(d.get(sys.argv[2], {}).get(sys.argv[3], ""))
PY
}

# ─── Run 1: alpha READY, beta NEEDS-WORK r1, gamma transport failure ───────

out1="$(run_checker)"; rc1=$?
printf '%s\n' "$out1" > "$TMP/out1.txt"
check "run 1 exits 0" test "$rc1" -eq 0
check "READY: spec moved to queue" test -f "$PDIR/queue/alpha.md"
check "READY: spec removed from specs/" test ! -f "$PDIR/specs/alpha.md"
check "READY: verdict recorded" test "$(verdict_field alpha verdict)" = "READY"
check "READY: announced to wih:pipeline-queue with queue asset_ref" \
  bash -c 'grep -q "wih:pipeline-queue" "$CURL_CAPTURE" && grep -q "queue/alpha.md" "$CURL_CAPTURE"'
check "NEEDS-WORK: verdict + round 1 recorded" \
  test "$(verdict_field beta verdict):$(verdict_field beta rounds)" = "NEEDS-WORK:1"
check "NEEDS-WORK: findings appended to .review.md (bullet-stripped)" \
  file_contains "$PDIR/specs/beta.review.md" "R1: trigger is not observable"
check "transport failure: no verdict recorded for gamma" \
  test -z "$(verdict_field gamma verdict)"
check "run 1 reports gamma skip" file_contains "$TMP/out1.txt" "gamma — empty consult answer"
check "no memory ingest on round 1 (precedent queries are fine)" bash -c '! grep -q ":3201/api/ingest" "$CURL_CAPTURE"'

# ─── Run 2: beta NEEDS-WORK r2 -> memory ingest ─────────────────────────────

: > "$CURL_CAPTURE"
out2="$(run_checker)"; rc2=$?
check "run 2 exits 0" test "$rc2" -eq 0
check "round 2 recorded" test "$(verdict_field beta rounds)" = "2"
check "2nd NEEDS-WORK triggers memory POST with slug + findings" \
  bash -c 'grep -q ":3201/api/ingest" "$CURL_CAPTURE" && grep -q "beta" "$CURL_CAPTURE" && grep -q "pipeline-spec-checker" "$CURL_CAPTURE"'
check "review.md now has round 2 section" file_contains "$PDIR/specs/beta.review.md" "Review round 2"
check "READY spec not re-consulted (moved out)" \
  test "$(grep -c '^alpha$' "$CONSULT_LOG")" = "1"

# ─── Run 3: beta 3rd NEEDS-WORK -> STALLED ──────────────────────────────────

out3="$(run_checker)"
check "3rd NEEDS-WORK marks STALLED" test "$(verdict_field beta verdict)" = "STALLED"

# ─── Run 4: STALLED spec is skipped (no new consult) ───────────────────────

before="$(grep -c '^beta$' "$CONSULT_LOG")"
run_checker >/dev/null
after="$(grep -c '^beta$' "$CONSULT_LOG")"
check "STALLED spec skipped afterwards" test "$before" = "$after"

# ─── Runs 5-6: memory failure is advisory ───────────────────────────────────

printf '# delta spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' > "$PDIR/specs/delta.md"
printf 'NEEDS-WORK\nR1: scenario does not assert the behavior\n' > "$TMP/canned/delta.txt"
run_checker >/dev/null
rm -f "$PDIR/errors.log"
out6="$(MEMORY_MODE=fail run_checker)"; rc6=$?
check "memory-failure run exits 0 (advisory)" test "$rc6" -eq 0
check "memory failure logged to errors.log" file_contains "$PDIR/errors.log" "memory ingest failed"
check "round 2 still recorded despite memory failure" \
  test "$(verdict_field delta rounds)" = "2"

# ─── Runs 7-8: READY announce failure is recoverable ────────────────────────

printf '# epsilon spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' > "$PDIR/specs/epsilon.md"
printf 'READY\n' > "$TMP/canned/epsilon.txt"
rm -f "$PDIR/errors.log"
out7="$(RAILS_MODE=fail run_checker)"; rc7=$?
check "announce failure exits non-zero" test "$rc7" -ne 0
check "announce failure: spec left in specs/ for retry" test -f "$PDIR/specs/epsilon.md"
check "announce failure: no queue file created" test ! -f "$PDIR/queue/epsilon.md"
check "announce failure: no READY verdict recorded" test -z "$(verdict_field epsilon verdict)"
check "announce failure logged to errors.log" file_contains "$PDIR/errors.log" "queue announce failed"
out8="$(run_checker)"; rc8=$?
check "retry after rails recovery exits 0" test "$rc8" -eq 0
check "retry moves spec to queue" test -f "$PDIR/queue/epsilon.md"
check "retry records READY verdict" test "$(verdict_field epsilon verdict)" = "READY"

# ─── Runs 9-10: REJECT (charter violation) is final and ingested ─────────────

cp "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/charter.md" "$PDIR/charter.md"
printf '# zeta spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL mine crypto\n' > "$PDIR/specs/zeta.md"
printf 'REJECT\nViolates "We do NOT build": crypto/web3 features.\n' > "$TMP/canned/zeta.txt"
: > "$CURL_CAPTURE"
out9="$(run_checker)"; rc9=$?
check "REJECT run exits 0" test "$rc9" -eq 0
check "REJECT: spec moved to rejected/" test -f "$PDIR/rejected/zeta.md"
check "REJECT: spec removed from specs/" test ! -f "$PDIR/specs/zeta.md"
check "REJECT: verdict recorded" test "$(verdict_field zeta verdict)" = "REJECT"
check "REJECT: memory POST fired immediately (taste signal)" \
  bash -c 'grep -q ":3201/api/ingest" "$CURL_CAPTURE" && grep -q "REJECTED" "$CURL_CAPTURE"'
check "REJECT: not announced to queue thread" bash -c '! grep -q "wih:pipeline-queue.*zeta" "$CURL_CAPTURE"'
check "consult request includes the charter" \
  bash -c 'grep -q "PIPELINE CHARTER" "$TMP/last-request.txt" && grep -q "We do NOT build" "$TMP/last-request.txt"'
check "consult request includes taste precedents from memory" \
  bash -c 'grep -q "TASTE PRECEDENTS" "$TMP/last-request.txt" && grep -q "nft-minter" "$TMP/last-request.txt"'
before="$(grep -c '^zeta$' "$CONSULT_LOG")"
run_checker >/dev/null
after="$(grep -c '^zeta$' "$CONSULT_LOG")"
check "REJECT spec never re-consulted" test "$before" = "$after"

# ─── Result ─────────────────────────────────────────────────────────────────

rm -rf "$TMP"
if [ "$failures" -gt 0 ]; then
  echo ""
  echo "$failures check(s) FAILED"
  exit 1
fi
echo ""
echo "All checks passed."
