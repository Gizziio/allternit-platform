#!/usr/bin/env bash
# taste-test.sh — offline test for taste-ingest.sh, record-outcome.sh, and the
# query_precedents staleness extension in check-spec.sh.
#   - curl PATH-shimmed with a capture fake (ingest posts + memory query)
#   - memory query response comes from $MEMORY_CANNED (built with fresh
#     timestamps at test time); MEMORY_MODE=fail makes :3201 return 500
#   - check-spec consult stubbed via SPEC_CHECK_CMD (captures the request)
# Verifies: correct metadata per source class; trust-rules map revert/failed
# patterns to `failed`; re-run skips unchanged paths (and re-posts a changed
# file); record-outcome appends to outcomes.jsonl and posts to memory with the
# right tier; [stale] marking for >90-day precedents only; memory-down paths
# log to errors.log and continue (exit 0). PASS/FAIL lines, non-zero on FAIL.
set -uo pipefail

BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASTE_INGEST="$BIN/taste-ingest.sh"
RECORD_OUTCOME="$BIN/record-outcome.sh"
CHECK_SPEC="$BIN/check-spec.sh"
TMP="$(mktemp -d /tmp/taste-test-XXXXXX)"
export TMP
PDIR="$TMP/pipeline"
export PDIR
mkdir -p "$PDIR/taste" "$TMP/bin"
cp "$BIN/../taste/trust-rules.json" "$PDIR/taste/trust-rules.json"

export TASTE_PIPELINE_DIR="$PDIR"
export CURL_CAPTURE="$TMP/curl.log"
touch "$CURL_CAPTURE"

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

# ─── curl stub ──────────────────────────────────────────────────────────────

cat > "$TMP/bin/curl" <<'EOF'
#!/usr/bin/env bash
url=""; payload=""; prev=""
for a in "$@"; do
  [ "$prev" = "-d" ] && payload="$a"
  case "$a" in http*) url="$a" ;; esac
  prev="$a"
done
printf '%s %s\n' "$url" "$payload" >> "$CURL_CAPTURE"
if [[ "$url" == *:3201* && "${MEMORY_MODE:-}" == "fail" ]]; then
  printf '500'
elif [[ "$url" == *:3201/api/query* ]]; then
  cat "${MEMORY_CANNED:-/dev/null}"
else
  printf '201'
fi
EOF
chmod +x "$TMP/bin/curl"
export PATH="$TMP/bin:$PATH"

# ─── fixtures ───────────────────────────────────────────────────────────────

REPO="$TMP/repo"; mkdir -p "$REPO/docs/nested"
printf '# Agents guide\n' > "$REPO/AGENTS.md"
printf '# Design\n' > "$REPO/DESIGN.md"
printf '# Readme\n' > "$REPO/README.md"
printf '# Guide\n' > "$REPO/docs/guide.md"
printf '# Deep — must NOT be ingested (docs top level only)\n' > "$REPO/docs/nested/deep.md"
export TASTE_REPO_DOCS="$REPO"

BRAIN="$TMP/brain"; mkdir -p "$BRAIN/sub"
printf '# Decision: use rails\n' > "$BRAIN/decision.md"
printf '# Log\n' > "$BRAIN/sub/log.md"
export TASTE_BRAIN="$BRAIN"

SESS="$TMP/sessions"
mkdir -p "$SESS/ok-run" "$SESS/reverted-approach" "$SESS/build-failed"
printf 'session ok transcript\n' > "$SESS/ok-run/session.log"
printf 'tried X then it was reverted\n' > "$SESS/reverted-approach/session.log"
printf 'build failed at link step\n' > "$SESS/build-failed/session.log"
export TASTE_SESSIONS="$SESS"

# ─── Run 1: full ingest, correct metadata per source class ──────────────────

out1="$(bash "$TASTE_INGEST")"; rc1=$?
printf '%s\n' "$out1" > "$TMP/out1.txt"
check "taste-ingest run 1 exits 0" test "$rc1" -eq 0
check "run 1 posts 9 items (4 repo + 2 brain + 3 sessions)" \
  test "$(grep -c ':3201/api/ingest' "$CURL_CAPTURE")" = "9"
check "summary reports posted=9 skipped=0 failed=0" \
  file_contains "$TMP/out1.txt" "posted=9 skipped=0 failed=0"
check "repo-docs: trusted tier + provenance" \
  bash -c 'grep "AGENTS.md" "$CURL_CAPTURE" | grep -q "\"source\": \"repo-docs\"" &&
           grep "AGENTS.md" "$CURL_CAPTURE" | grep -q "\"trust_tier\": \"trusted\"" &&
           grep -q "\"provenance_ref\": \"AGENTS.md\"" "$CURL_CAPTURE"'
check "repo-docs: docs/*.md top level ingested" \
  bash -c 'grep -q "\"provenance_ref\": \"docs/guide.md\"" "$CURL_CAPTURE"'
check "repo-docs: nested docs/*.md NOT ingested" \
  bash -c '! grep -q "nested/deep.md" "$CURL_CAPTURE"'
check "brain: trusted tier, recursive, relative provenance" \
  bash -c 'grep "sub/log.md" "$CURL_CAPTURE" | grep -q "\"source\": \"brain\"" &&
           grep "sub/log.md" "$CURL_CAPTURE" | grep -q "\"trust_tier\": \"trusted\""'
check "sessions: source agent-sessions, default tier unverified" \
  bash -c 'grep "ok-run" "$CURL_CAPTURE" | grep -q "\"source\": \"agent-sessions\"" &&
           grep "ok-run" "$CURL_CAPTURE" | grep -q "\"trust_tier\": \"unverified\""'
check "trust-rules: 'revert' pattern -> failed tier" \
  bash -c 'grep "reverted-approach" "$CURL_CAPTURE" | grep -q "\"trust_tier\": \"failed\""'
check "trust-rules: 'failed' pattern -> failed tier" \
  bash -c 'grep "build-failed" "$CURL_CAPTURE" | grep -q "\"trust_tier\": \"failed\""'

# ─── Run 2: re-run skips unchanged paths ────────────────────────────────────

: > "$CURL_CAPTURE"
out2="$(bash "$TASTE_INGEST")"
printf '%s\n' "$out2" > "$TMP/out2.txt"
check "re-run posts nothing (ledger hit)" \
  bash -c '! grep -q ":3201/api/ingest" "$CURL_CAPTURE"'
check "re-run summary reports skipped=9" \
  file_contains "$TMP/out2.txt" "skipped=9"

# ─── Run 3: a changed file is re-posted, everything else skipped ────────────

printf '# Decision: use rails v2\n' > "$BRAIN/decision.md"
: > "$CURL_CAPTURE"
out3="$(bash "$TASTE_INGEST")"
printf '%s\n' "$out3" > "$TMP/out3.txt"
check "changed file: exactly one re-post" \
  test "$(grep -c ':3201/api/ingest' "$CURL_CAPTURE")" = "1"
check "re-posted item is the changed brain page" \
  bash -c 'grep -q "\"provenance_ref\": \"decision.md\"" "$CURL_CAPTURE"'

# ─── record-outcome: appends + posts with the right tier ────────────────────

: > "$CURL_CAPTURE"
ro1="$(bash "$RECORD_OUTCOME" my-feature rejected "too clever")"; rorc1=$?
check "record-outcome exits 0" test "$rorc1" -eq 0
check "outcomes.jsonl gains ts+slug+outcome+note" \
  bash -c 'grep -q "\"slug\": \"my-feature\"" "$PDIR/outcomes.jsonl" &&
           grep -q "\"outcome\": \"rejected\"" "$PDIR/outcomes.jsonl" &&
           grep -q "\"note\": \"too clever\"" "$PDIR/outcomes.jsonl" &&
           grep -q "\"ts\":" "$PDIR/outcomes.jsonl"'
check "rejected outcome posted as failed-tier precedent" \
  bash -c 'grep ":3201/api/ingest" "$CURL_CAPTURE" | grep -q "pipeline-outcome" &&
           grep ":3201/api/ingest" "$CURL_CAPTURE" | grep -q "\"trust_tier\": \"failed\"" &&
           grep ":3201/api/ingest" "$CURL_CAPTURE" | grep -q "my-feature"'
: > "$CURL_CAPTURE"
bash "$RECORD_OUTCOME" other-feature merged >/dev/null
check "merged outcome posted as trusted-tier precedent" \
  bash -c 'grep ":3201/api/ingest" "$CURL_CAPTURE" | grep -q "\"trust_tier\": \"trusted\""'
check "invalid outcome rejected with usage error" \
  bash -c '! bash "$RECORD_OUTCOME" s bogus-outcome >/dev/null 2>&1'

# ─── staleness: check-spec marks >90-day precedents [stale] ─────────────────

PDIR2="$TMP/pipeline-checker"; mkdir -p "$PDIR2/specs"
printf '# omega spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' > "$PDIR2/specs/omega.md"

python3 - <<'PY' > "$TMP/memory.json"
import json, datetime
now = datetime.datetime.now(datetime.timezone.utc)
def iso(days):
    return (now - datetime.timedelta(days=days)).isoformat()
print(json.dumps({"answer": "", "memories": [
    {"content": "Old precedent: crypto bot rejected", "ingested_at": iso(100)},
    {"content": "Fresh precedent: rails verdicts", "ingested_at": iso(10)},
    {"content": "Undated precedent: no timestamp"},
    {"content": "Reverted approach: hand-rolled scheduler",
     "metadata": {"trust_tier": "failed", "source": "agent-sessions"}},
    {"content": "Rejected outcome: doom-feature",
     "metadata": {"trust_tier": "failed"}, "ingested_at": iso(100)},
    {"content": "Merged outcome: good-feature",
     "metadata": {"trust_tier": "trusted"}},
]}))
PY
export MEMORY_CANNED="$TMP/memory.json"

cat > "$TMP/ensure-ok.sh" <<'EOF'
#!/usr/bin/env bash
echo "rails: OK"
exit 0
EOF
export RAILS_ENSURE="$TMP/ensure-ok.sh"
export SPEC_RUBRIC="$BIN/../spec-rubric.md"
export REQUEST_CAPTURE="$TMP/request.txt"
cat > "$TMP/stub-consult.sh" <<'EOF'
#!/usr/bin/env bash
cat > "$REQUEST_CAPTURE"
printf 'READY\n'
EOF
chmod +x "$TMP/stub-consult.sh"
export SPEC_CHECK_CMD="$TMP/stub-consult.sh"
export CHECK_SPEC_DIR="$PDIR2"

cs_out="$(bash "$CHECK_SPEC")"; csrc=$?
check "check-spec run exits 0" test "$csrc" -eq 0
check "100-day precedent marked [stale]" \
  bash -c 'grep -qF "[stale] Old precedent: crypto bot rejected" "$REQUEST_CAPTURE"'
check "10-day precedent NOT marked stale" \
  bash -c '! grep -qF "[stale] Fresh precedent" "$REQUEST_CAPTURE"'
check "undated precedent NOT marked stale (degrades to current)" \
  bash -c '! grep -qF "[stale] Undated precedent" "$REQUEST_CAPTURE"'
check "precedents still included in the consult request" \
  bash -c 'grep -q "TASTE PRECEDENTS" "$REQUEST_CAPTURE" &&
           grep -q "Fresh precedent: rails verdicts" "$REQUEST_CAPTURE"'
check "failed-tier precedent marked [pitfall] (visible, not evidence)" \
  bash -c 'grep -qF "[pitfall] Reverted approach: hand-rolled scheduler" "$REQUEST_CAPTURE"'
check "failed-tier + old precedent marked [pitfall] [stale]" \
  bash -c 'grep -qF "[pitfall] [stale] Rejected outcome: doom-feature" "$REQUEST_CAPTURE"'
check "trusted-tier precedent NOT marked pitfall" \
  bash -c '! grep -qF "[pitfall] Merged outcome" "$REQUEST_CAPTURE" &&
           ! grep -qF "[pitfall] Fresh precedent" "$REQUEST_CAPTURE" &&
           ! grep -qF "[pitfall] Old precedent" "$REQUEST_CAPTURE"'

# ─── memory down: log and continue (advisory everywhere) ────────────────────

rm -f "$PDIR/taste/ingested.json" "$PDIR/errors.log"
md_out="$(MEMORY_MODE=fail bash "$TASTE_INGEST")"; mdrc=$?
printf '%s\n' "$md_out" > "$TMP/out-md.txt"
check "memory-down ingest exits 0 (advisory)" test "$mdrc" -eq 0
check "memory-down failures logged to errors.log" \
  file_contains "$PDIR/errors.log" "taste-ingest: memory ingest failed"
check "memory-down summary reports failed=9" \
  file_contains "$TMP/out-md.txt" "failed=9"
check "memory-down: ledger NOT updated (retry next run)" \
  test ! -s "$PDIR/taste/ingested.json"

rm -f "$PDIR/errors.log"
ro_md="$(MEMORY_MODE=fail bash "$RECORD_OUTCOME" doom-feature reverted)"; romdrc=$?
check "memory-down record-outcome exits 0" test "$romdrc" -eq 0
check "memory-down record-outcome still appends to outcomes.jsonl" \
  bash -c 'grep -q "\"slug\": \"doom-feature\"" "$PDIR/outcomes.jsonl"'
check "memory-down record-outcome logs to errors.log" \
  file_contains "$PDIR/errors.log" "record-outcome: memory ingest failed"

# ─── absent sources skip silently ───────────────────────────────────────────

mkdir -p "$TMP/empty-repo"
: > "$CURL_CAPTURE"
skip_out="$(TASTE_BRAIN="$TMP/no-such-brain" TASTE_REPO_DOCS="$TMP/empty-repo" TASTE_SESSIONS="" bash "$TASTE_INGEST")"; skiprc=$?
printf '%s\n' "$skip_out" > "$TMP/out-skip.txt"
check "absent brain + empty repo + no sessions: exits 0" test "$skiprc" -eq 0
check "absent sources: nothing posted, silently" \
  bash -c '! grep -q ":3201" "$CURL_CAPTURE" && grep -q "posted=0 skipped=0 failed=0" "$TMP/out-skip.txt"'

# ─── result ─────────────────────────────────────────────────────────────────

rm -rf "$TMP"
if [ "$failures" -gt 0 ]; then
  echo ""
  echo "$failures check(s) FAILED"
  exit 1
fi
echo ""
echo "All checks passed."
