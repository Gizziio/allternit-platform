#!/usr/bin/env bash
# contract-test.sh — golden-file contract tests for pipeline artifact
# frontmatter (C3-R1). Every artifact the pipeline writes — briefs (scout),
# specs (generate-spec), verdict review records (check-spec) — must carry
# schema-versioned frontmatter with exactly these required keys (extras
# allowed):
#
#   schema_version (== 1), trust_tier, provenance_refs, produced_by, produced_at
#
# Checks:
#   1. Golden fixtures under docs/pipeline/taste/golden/ satisfy the contract.
#   2. Regeneration: the golden brief re-run through generate-spec.cjs yields
#      the golden spec byte-for-byte (produced_at masked — the one wall-clock
#      field).
#   3. Live producers: a stubbed scout.cjs brief and a stubbed check-spec.sh
#      review record satisfy the same contract (frontmatter can't drift from
#      the fixtures silently).
# No network: fetch/announce/consult/memory are all stubbed (PATH-shim curl).
# PASS/FAIL lines, non-zero exit on any FAIL.
set -uo pipefail

BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GOLDEN="$BIN/../taste/golden"
TMP="$(mktemp -d /tmp/contract-test-XXXXXX)"
export TMP
mkdir -p "$TMP/bin"

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

# contract_ok <file> — frontmatter exists, holds all required keys,
# schema_version is 1. Tolerant parser: top-level "key:" lines only.
contract_ok() {
  python3 - "$1" <<'PY'
import sys
REQUIRED = {"schema_version", "trust_tier", "provenance_refs", "produced_by", "produced_at"}
try:
    lines = open(sys.argv[1], encoding="utf-8", errors="replace").read().split("\n")
except Exception:
    sys.exit(1)
if not lines or lines[0].strip() != "---":
    sys.exit(1)
keys = {}
for line in lines[1:]:
    if line.strip() == "---":
        break
    if ":" in line and not line.startswith((" ", "\t", "-")):
        k, _, v = line.partition(":")
        keys[k.strip()] = v.strip()
if not REQUIRED.issubset(keys):
    sys.exit(1)
sys.exit(0 if keys["schema_version"] == "1" else 1)
PY
}

mask_produced_at() { # mask_produced_at <file> -> stdout, timestamp masked
  sed 's/^produced_at:.*$/produced_at: <masked>/' "$1"
}

# ─── 1. Golden fixtures satisfy the contract ────────────────────────────────

for f in contract-fixture-brief.md contract-fixture-spec.md contract-fixture-review.md; do
  check "golden $f carries the C3-R1 contract" contract_ok "$GOLDEN/$f"
done
check "golden brief is unverified with source-URL provenance" \
  bash -c 'grep -q "trust_tier: unverified" "'"$GOLDEN"'/contract-fixture-brief.md" &&
           grep -q "  - https://example.com/golden-fixture" "'"$GOLDEN"'/contract-fixture-brief.md"'
check "golden spec provenance cites brief path + brief hash" \
  bash -c 'grep -q "  - docs/pipeline/briefs/contract-fixture-brief.md" "'"$GOLDEN"'/contract-fixture-spec.md" &&
           grep -q "  - sha256:" "'"$GOLDEN"'/contract-fixture-spec.md"'
check "golden review provenance cites the spec path" \
  bash -c 'grep -q "  - docs/pipeline/specs/contract-fixture.md" "'"$GOLDEN"'/contract-fixture-review.md"'

# ─── 2. Regeneration of the fixture spec passes unchanged ───────────────────

GEN="$TMP/gen"; mkdir -p "$GEN/briefs"
cp "$GOLDEN/contract-fixture-brief.md" "$GEN/briefs/contract-fixture-brief.md"
gen_out="$(GENERATOR_DIR="$GEN" node "$BIN/generate-spec.cjs" "$GEN/briefs/contract-fixture-brief.md" 2>&1)"; genrc=$?
check "spec regeneration exits 0" test "$genrc" -eq 0
check "regenerated spec matches golden (produced_at masked)" \
  bash -c 'diff <(sed "s/^produced_at:.*$/produced_at: <masked>/" "'"$GEN"'/specs/contract-fixture-brief.md") \
                <(sed "s/^produced_at:.*$/produced_at: <masked>/" "'"$GOLDEN"'/contract-fixture-spec.md") >/dev/null'

# ─── 3. Live producers satisfy the same contract ────────────────────────────

# curl shim: memory + rails are not under test here; accept everything.
cat > "$TMP/bin/curl" <<'EOF'
#!/usr/bin/env bash
printf '201'
EOF
chmod +x "$TMP/bin/curl"
export PATH="$TMP/bin:$PATH"

# scout.cjs, stubbed like scout-test.cjs (no LLM -> TODO template brief).
SCOUT_DIR_LIVE="$TMP/scout"; mkdir -p "$SCOUT_DIR_LIVE"
cat > "$TMP/fixture-pipeline.cjs" <<'EOF'
'use strict';
module.exports = {
  fetchAllSources: async () => ({
    filtered: [{
      title: 'Contract Fixture Item',
      url: 'https://example.com/contract-item',
      text: 'excerpt',
      source: 'hackernews',
      relevance: { score: 0.9, matched: [], focusAreas: [] },
    }],
  }),
};
EOF
cat > "$TMP/ensure-ok.sh" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$TMP/announcer.cjs" <<'EOF'
'use strict';
module.exports = async () => {};
EOF
scout_out="$(SCOUT_DIR="$SCOUT_DIR_LIVE" SCOUT_PIPELINE_MODULE="$TMP/fixture-pipeline.cjs" \
  SCOUT_RAILS_ENSURE="$TMP/ensure-ok.sh" SCOUT_ANNOUNCER="$TMP/announcer.cjs" \
  node "$BIN/scout.cjs" 2>&1)"; scoutrc=$?
check "live scout run exits 0" test "$scoutrc" -eq 0
live_brief="$SCOUT_DIR_LIVE/briefs/contract-fixture-item.md"
check "live scout brief written" test -f "$live_brief"
check "live scout brief carries the C3-R1 contract" contract_ok "$live_brief"
check "live scout brief: unverified tier + source-URL provenance + producer" \
  bash -c 'grep -q "trust_tier: unverified" "'"$live_brief"'" &&
           grep -q "  - https://example.com/contract-item" "'"$live_brief"'" &&
           grep -q "produced_by: scout.cjs" "'"$live_brief"'"'

# check-spec.sh, stubbed to NEEDS-WORK (writes the verdict review record).
PDIR="$TMP/checker"; mkdir -p "$PDIR/specs"
printf '# live spec\n\n## Requirements\n\n- [ ] R1: WHEN x, THE SYSTEM SHALL y\n' > "$PDIR/specs/live.md"
cat > "$TMP/consult-needswork.sh" <<'EOF'
#!/usr/bin/env bash
cat > /dev/null
printf 'NEEDS-WORK\nR1: trigger is not observable\n'
EOF
chmod +x "$TMP/consult-needswork.sh"
cs_out="$(CHECK_SPEC_DIR="$PDIR" RAILS_ENSURE="$TMP/ensure-ok.sh" \
  SPEC_RUBRIC="$BIN/../spec-rubric.md" SPEC_CHECK_CMD="$TMP/consult-needswork.sh" \
  bash "$BIN/check-spec.sh" 2>&1)"; csrc=$?
check "live check-spec run exits 0" test "$csrc" -eq 0
live_review="$PDIR/specs/live.review.md"
check "live review record written" test -f "$live_review"
check "live review record carries the C3-R1 contract" contract_ok "$live_review"
check "live review record: unverified tier + spec-path provenance + producer" \
  bash -c 'grep -q "trust_tier: unverified" "'"$live_review"'" &&
           grep -q "  - docs/pipeline/specs/live.md" "'"$live_review"'" &&
           grep -q "produced_by: check-spec.sh" "'"$live_review"'"'
check "live review record still appends findings below the frontmatter" \
  bash -c 'grep -q "Review round 1" "'"$live_review"'" && grep -q "trigger is not observable" "'"$live_review"'"'

# ─── result ─────────────────────────────────────────────────────────────────

rm -rf "$TMP"
if [ "$failures" -gt 0 ]; then
  echo ""
  echo "$failures check(s) FAILED"
  exit 1
fi
echo ""
echo "All checks passed."
