#!/usr/bin/env bash
# metrics-test.sh — fixture tests for metrics.sh (M5). Hand-computed fixture
# logs (consults.log / events.jsonl / outcomes.jsonl / git timestamps) are run
# through metrics.sh and the outputs are asserted against the hand-computed
# values:
#
#   1. Rich fixture: latest.json matches the hand-computed rates per R1, and
#      latest.md renders each metric with its trend (R2 + acceptance).
#   2. Thin fixture (< 3 events): every metric reports insufficient_data (R3).
#   3. Idempotency: latest.* overwritten, history.jsonl appended only when
#      the values change (R4).
#   4. Advisory memory: unreachable memory = exit 0 + errors.log line (R2).
#
# No network: METRICS_MEMORY_URL points at the discard port (connection
# refused). PASS/FAIL lines, non-zero exit on any FAIL.
set -uo pipefail

BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METRICS="$BIN/metrics.sh"
TMP="$(mktemp -d /tmp/metrics-test-XXXXXX)"

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

# json_assert <file> <python-expr> — exit 0 iff expr (given `d` = parsed json)
# is truthy.
json_assert() {
  python3 - "$1" "$2" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
sys.exit(0 if eval(sys.argv[2]) else 1)
PY
}

# ─── fixture A: rich, hand-computed ─────────────────────────────────────────
#
# Weeks: 2026-06-29 is the Monday of ISO week 2026-W27; 2026-07-06 is the
# Monday of 2026-W28.
#
# Gate consults (8):
#   W27: a STEER→APPROVE (5 min gap, no stall), b APPROVE, c APPROVE
#        + one stop consult APPROVE
#   W28: d STEER→APPROVE (15 min gap > 10 min → 1 stall), e APPROVE,
#        f CONSULT_FAILED (never approved → not a resolved gated commit)
#
# Hand-computed:
#   first_pass_rate: resolved = a,b,c,d,e (5); first-pass = b,c,e (3) → 0.60
#     W27: a,b,c → 2/3 ≈ 0.667 ; W28: d,e → n=2 < 3 → insufficient (null)
#   gate_block_rate: 2 STEER / 8 gate consults = 0.25
#     W27: 1/4 = 0.25 ; W28: 1/4 = 0.25 → trend flat
#   verdict_distribution: APPROVE 6 (5 gate + 1 stop), STEER 2, REJECT 0,
#     CONSULT_FAILED 1
#   stall_signals: 1 long gap (cmd d, 900 s) + 1 nudge event = 2
#   outcome_linkage: adopted prop-1,2,3; linked prop-1 (merged), prop-2
#     (reverted) → 2/3 ≈ 0.667
#   commits_per_week: W27 2, W28 1 (git fixture)

FA="$TMP/a"
mkdir -p "$FA/pipeline/learn" "$FA/steering/state"

cat > "$FA/steering/state/consults.log" <<'EOF'
2026-06-29T10:00:00Z session=s1 gate=1 cmd="git commit -m a" verdict=STEER
2026-06-29T10:05:00Z session=s1 gate=1 cmd="git commit -m a" verdict=APPROVE
2026-06-29T11:00:00Z session=s1 gate=1 cmd="git commit -m b" verdict=APPROVE
2026-06-29T12:00:00Z session=s1 gate=1 cmd="git commit -m c" verdict=APPROVE
2026-06-29T12:30:00Z session=s1 hash=aaaaaaaa verdict=APPROVE
2026-07-06T09:00:00Z session=s2 gate=1 cmd="git commit -m d" verdict=STEER
2026-07-06T09:15:00Z session=s2 gate=1 cmd="git commit -m d" verdict=APPROVE
2026-07-06T10:00:00Z session=s2 gate=1 cmd="git commit -m e" verdict=APPROVE
2026-07-06T11:00:00Z session=s2 gate=1 cmd="git commit -m f" verdict=CONSULT_FAILED
EOF

cat > "$FA/pipeline/learn/events.jsonl" <<'EOF'
{"ts": "2026-06-29T12:35:00Z", "kind": "steering", "refs": "aaaaaaaa", "summary": "checkpoint verdict=APPROVE session=s1"}
{"ts": "2026-07-06T12:00:00Z", "kind": "nudge", "refs": "s2", "summary": "executor nudged after idle turn"}
EOF

cat > "$FA/pipeline/outcomes.jsonl" <<'EOF'
{"ts": "2026-06-29T13:00:00Z", "slug": "prop-1", "outcome": "adopted", "note": "commit abc"}
{"ts": "2026-06-30T13:00:00Z", "slug": "prop-2", "outcome": "adopted", "note": "commit def"}
{"ts": "2026-07-06T13:00:00Z", "slug": "prop-3", "outcome": "adopted", "note": "commit ghi"}
{"ts": "2026-07-01T13:00:00Z", "slug": "prop-1", "outcome": "merged", "note": ""}
{"ts": "2026-07-02T13:00:00Z", "slug": "prop-2", "outcome": "reverted", "note": ""}
EOF

cat > "$FA/git-ts" <<'EOF'
2026-06-29T14:00:00+00:00
2026-06-30T09:00:00+00:00
2026-07-06T15:00:00+00:00
EOF

run_metrics() { # run_metrics <fixture-dir>
  METRICS_PIPELINE_DIR="$1/pipeline" \
  METRICS_STEERING_DIR="$1/steering" \
  METRICS_MEMORY_URL="http://127.0.0.1:9/api/ingest" \
  METRICS_GIT_LOG_FILE="$1/git-ts" \
  bash "$METRICS"
}

run_metrics "$FA" >/dev/null 2>&1
check "rich fixture: metrics.sh exits 0 with memory down (advisory)" \
  test $? -eq 0

J="$FA/pipeline/metrics/latest.json"
check "latest.json exists" test -f "$J"
check "latest.md exists" test -f "$FA/pipeline/metrics/latest.md"

check "first_pass_rate overall = 0.60 (3/5 hand-computed)" \
  json_assert "$J" 'abs(d["metrics"]["first_pass_rate"]["value"] - 0.6) < 1e-9'
check "first_pass_rate W27 = 2/3" \
  json_assert "$J" 'abs(d["metrics"]["first_pass_rate"]["per_week"]["2026-W27"] - 2/3) < 1e-9'
check "first_pass_rate W28 insufficient_data (2 resolved < 3)" \
  json_assert "$J" 'd["metrics"]["first_pass_rate"]["per_week"]["2026-W28"] is None'
check "gate_block_rate = 0.25, trend flat (0.25 both weeks)" \
  json_assert "$J" 'abs(d["metrics"]["gate_block_rate"]["value"] - 0.25) < 1e-9 and d["metrics"]["gate_block_rate"]["trend"] == "flat"'
check "verdict distribution APPROVE 6 / STEER 2 / REJECT 0 / CONSULT_FAILED 1" \
  json_assert "$J" 'd["metrics"]["verdict_distribution"]["counts"] == {"APPROVE": 6, "STEER": 2, "REJECT": 0, "CONSULT_FAILED": 1}'
check "stall_signals = 2 (1 long gap + 1 nudge)" \
  json_assert "$J" 'd["metrics"]["stall_signals"]["total"] == 2 and d["metrics"]["stall_signals"]["long_gaps"] == 1 and d["metrics"]["stall_signals"]["nudges"] == 1'
check "outcome_linkage = 2/3 adopted proposals linked" \
  json_assert "$J" 'abs(d["metrics"]["outcome_linkage"]["value"] - 2/3) < 1e-9 and d["metrics"]["outcome_linkage"]["adopted"] == 3 and d["metrics"]["outcome_linkage"]["linked"] == 2'
check "commits_per_week from git fixture (W27: 2, W28: 1)" \
  json_assert "$J" 'd["commits_per_week"] == {"2026-W27": 2, "2026-W28": 1}'
check "all five metrics status ok on rich fixture" \
  json_assert "$J" 'all(m["status"] == "ok" for m in d["metrics"].values())'

M="$FA/pipeline/metrics/latest.md"
check "latest.md renders each metric paragraph" \
  bash -c 'grep -q "First-pass rate" "$0" && grep -q "Gate block rate" "$0" && grep -q "verdict distribution" "$0" && grep -q "stall signals" "$0" && grep -q "Outcome linkage" "$0"' "$M"
check "latest.md carries trend arrows and hand-computed numbers" \
  bash -c 'grep -q "(→)" "$0" && grep -q "60%" "$0" && grep -q "25%" "$0" && grep -q "67%" "$0"' "$M"

check "memory-down run logged the advisory failure to errors.log" \
  grep -q "metrics: memory ingest failed" "$FA/pipeline/errors.log"

# ─── R4: idempotency ─────────────────────────────────────────────────────────

H="$FA/pipeline/metrics/history.jsonl"
run_metrics "$FA" >/dev/null 2>&1
check "history.jsonl has exactly 1 line after two identical runs" \
  bash -c 'test "$(wc -l < "$0" | tr -d " ")" = "1"' "$H"

echo '2026-07-06T20:00:00Z session=s2 gate=1 cmd="git commit -m g" verdict=APPROVE' \
  >> "$FA/steering/state/consults.log"
run_metrics "$FA" >/dev/null 2>&1
check "history.jsonl appended once when values changed" \
  bash -c 'test "$(wc -l < "$0" | tr -d " ")" = "2"' "$H"
run_metrics "$FA" >/dev/null 2>&1
check "history.jsonl unchanged when values unchanged" \
  bash -c 'test "$(wc -l < "$0" | tr -d " ")" = "2"' "$H"
check "latest.json reflects the change (first-pass now 4/6)" \
  json_assert "$J" 'abs(d["metrics"]["first_pass_rate"]["value"] - 4/6) < 1e-9'

# ─── fixture B: thin data is honest (R3) ─────────────────────────────────────

FB="$TMP/b"
mkdir -p "$FB/pipeline/learn" "$FB/steering/state"
cat > "$FB/steering/state/consults.log" <<'EOF'
2026-06-29T10:00:00Z session=s1 gate=1 cmd="git commit -m a" verdict=APPROVE
2026-06-29T11:00:00Z session=s1 gate=1 cmd="git commit -m b" verdict=STEER
EOF
: > "$FB/git-ts"

run_metrics "$FB" >/dev/null 2>&1
check "thin fixture: metrics.sh exits 0" test $? -eq 0
JB="$FB/pipeline/metrics/latest.json"
check "thin fixture: every metric reports insufficient_data" \
  json_assert "$JB" 'all(m["status"] == "insufficient_data" for m in d["metrics"].values())'
check "thin fixture: no fake numbers (all values null)" \
  json_assert "$JB" 'd["metrics"]["first_pass_rate"]["value"] is None and d["metrics"]["gate_block_rate"]["value"] is None and d["metrics"]["outcome_linkage"]["value"] is None'
check "thin fixture: latest.md says insufficient_data" \
  bash -c 'test "$(grep -c insufficient_data "$0")" -ge 5' "$FB/pipeline/metrics/latest.md"

# ─── fixture C: missing logs entirely ────────────────────────────────────────

FC="$TMP/c"
mkdir -p "$FC/pipeline" "$FC/steering"
: > "$FC/git-ts"
run_metrics "$FC" >/dev/null 2>&1
check "missing logs: metrics.sh still exits 0 and writes outputs" \
  bash -c 'test -f "$0/pipeline/metrics/latest.json" && test -f "$0/pipeline/metrics/latest.md"' "$FC"

# ─── result ──────────────────────────────────────────────────────────────────

rm -rf "$TMP"
if [ "$failures" -gt 0 ]; then
  echo ""
  echo "$failures check(s) FAILED"
  exit 1
fi
echo ""
echo "All checks passed."
