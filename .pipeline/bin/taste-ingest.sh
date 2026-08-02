#!/usr/bin/env bash
# taste-ingest.sh — build the taste corpus (C1): ingest three source classes
# into the memory service (POST :3201/api/ingest, advisory) with trust-tier
# metadata:
#   a. repo docs    (TASTE_REPO_DOCS, default: repo root) — top-level
#                   AGENTS.md / DESIGN.md / README.md and docs/*.md (top level
#                   only) -> trust_tier "trusted", source "repo-docs"
#   b. brain wiki   (TASTE_BRAIN; default resolution — D1-R3: gizzi settings
#                   `brain.path` as written by `gizzi brain init`, else
#                   ~/brain when it exists, else the legacy
#                   $HOME/Desktop/allternit-brain; skipped silently when
#                   absent) — all *.md recursively ->
#                   "trusted", source "brain"
#   c. agent sessions (TASTE_SESSIONS, default: skipped unless set) —
#                   space-separated list of session dirs; every file found is
#                   ingested as a first+last 2KB excerpt, source
#                   "agent-sessions", trust_tier from
#                   .pipeline/taste/trust-rules.json (path-pattern -> tier;
#                   default "unverified"; shipped rules map paths containing
#                   "revert"/"failed" -> "failed").
# Every item is POSTed with metadata {source, trust_tier, provenance_ref}.
# Memory down = log to .pipeline/errors.log and continue (advisory — like
# check-spec.sh's ingest_lesson). Idempotent-ish: .pipeline/taste/ingested.json
# ledgers source:provenance_ref -> sha256(content); unchanged items are skipped
# on re-run. The ledger is updated only after a 2xx, so items that failed to
# post are retried next run.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PIPELINE_DIR="${TASTE_PIPELINE_DIR:-$ROOT/.pipeline}"
TASTE_DIR="$PIPELINE_DIR/taste"
LEDGER="$TASTE_DIR/ingested.json"
TRUST_RULES="${TASTE_TRUST_RULES:-$TASTE_DIR/trust-rules.json}"
ERRORS_LOG="$PIPELINE_DIR/errors.log"
MEMORY_URL="${TASTE_MEMORY_URL:-http://localhost:3201/api/ingest}"

REPO_DOCS="${TASTE_REPO_DOCS:-$ROOT}"
# Brain path resolution (D1-R3) lives in the shared brain-resolve.sh helper
# (extracted for M3): TASTE_BRAIN → gizzi settings brain.path → ~/brain →
# legacy ~/Desktop/allternit-brain. Skipped silently below when absent.
BRAIN_RESOLVE="${BRAIN_RESOLVE:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/brain-resolve.sh}"
BRAIN="$("$BRAIN_RESOLVE")"
SESSIONS="${TASTE_SESSIONS:-}"

mkdir -p "$TASTE_DIR"

log_error() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$1" >> "$ERRORS_LOG"
}

# ─── ledger (python3, like check-spec.sh verdict helpers) ───────────────────

ledger_get() { # ledger_get <key> -> hash or empty
  python3 - "$LEDGER" "$1" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    d = {}
print(d.get(sys.argv[2], ""))
PY
}

ledger_set() { # ledger_set <key> <hash>
  python3 - "$LEDGER" "$1" "$2" <<'PY'
import json, sys, os
path, key, h = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    d = json.load(open(path))
except Exception:
    d = {}
d[key] = h
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(d, f, indent=2, sort_keys=True)
    f.write("\n")
PY
}

# ─── trust rules (sessions) ──────────────────────────────────────────────────

session_tier() { # session_tier <path> -> tier
  python3 - "$TRUST_RULES" "$1" <<'PY'
import json, sys
rules_path, path = sys.argv[1], sys.argv[2]
try:
    d = json.load(open(rules_path))
except Exception:
    d = {}
default = d.get("default_tier", "unverified")
low = path.lower()
for r in d.get("rules", []):
    pat = str(r.get("pattern", "")).lower()
    if pat and pat in low:
        print(r.get("trust_tier", default))
        sys.exit(0)
print(default)
PY
}

# First 2KB + last 2KB (small files pass through whole).
session_extract() { # session_extract <src> <dst>
  python3 - "$1" "$2" <<'PY'
import sys
src, dst = sys.argv[1], sys.argv[2]
data = open(src, "rb").read()
CH = 2048
if len(data) <= 2 * CH:
    excerpt = data
else:
    excerpt = (data[:CH]
               + ("\n\n[... %d bytes elided ...]\n\n" % (len(data) - 2 * CH)).encode()
               + data[-CH:])
open(dst, "wb").write(excerpt)
PY
}

# ─── ingest (advisory) ───────────────────────────────────────────────────────

posted=0; skipped=0; failed=0

ingest_item() { # ingest_item <source> <trust_tier> <provenance_ref> <content-file>
  local source="$1" tier="$2" prov="$3" cfile="$4" key hash payload code
  key="$source:$prov"
  hash="$(python3 -c 'import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$cfile")"
  if [ "$(ledger_get "$key")" = "$hash" ]; then
    skipped=$((skipped + 1))
    return 0
  fi
  payload=$(python3 -c 'import json,sys
content = open(sys.argv[1], encoding="utf-8", errors="replace").read()
print(json.dumps({
    "content": content,
    "source": sys.argv[2],
    "metadata": {
        "source": sys.argv[2],
        "trust_tier": sys.argv[3],
        "provenance_ref": sys.argv[4],
    },
}))' "$cfile" "$source" "$tier" "$prov")
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "$MEMORY_URL" \
    -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
  if [[ "$code" == 2* ]]; then
    ledger_set "$key" "$hash"
    posted=$((posted + 1))
  else
    failed=$((failed + 1))
    log_error "taste-ingest: memory ingest failed for $key (HTTP ${code:-000}) — continuing (advisory)"
  fi
}

# ─── (a) repo docs → trusted ────────────────────────────────────────────────

for name in AGENTS.md DESIGN.md README.md; do
  [ -f "$REPO_DOCS/$name" ] && ingest_item "repo-docs" "trusted" "$name" "$REPO_DOCS/$name"
done
if [ -d "$REPO_DOCS/docs" ]; then
  for f in "$REPO_DOCS"/docs/*.md; do
    [ -f "$f" ] || continue
    ingest_item "repo-docs" "trusted" "docs/$(basename "$f")" "$f"
  done
fi

# ─── (b) brain wiki → trusted (skip silently when absent) ───────────────────

if [ -d "$BRAIN" ]; then
  while IFS= read -r f; do
    ingest_item "brain" "trusted" "${f#"$BRAIN"/}" "$f"
  done < <(find "$BRAIN" -type f -name '*.md' | sort)
fi

# ─── (c) agent sessions → trust-rules tiers (skip unless TASTE_SESSIONS) ────

for dir in $SESSIONS; do
  [ -d "$dir" ] || continue
  while IFS= read -r f; do
    tmp="$(mktemp -t taste-ingest)"
    session_extract "$f" "$tmp"
    ingest_item "agent-sessions" "$(session_tier "$f")" "$f" "$tmp"
    rm -f "$tmp"
  done < <(find "$dir" -type f | sort)
done

echo "taste-ingest: posted=$posted skipped=$skipped failed=$failed (ledger: $LEDGER)"
