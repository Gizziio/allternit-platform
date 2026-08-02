#!/usr/bin/env bash
# wiki-ingest.sh — wiki connector (C2-R1/R2). Reads the brain wiki
# (TASTE_BRAIN; default resolution — D1-R3: gizzi settings `brain.path` as
# written by `gizzi brain init`, else ~/brain when it exists, else the legacy
# $HOME/Desktop/allternit-brain; skipped silently when absent) and, for every
# *.md page (recursive):
#
#   - Parses frontmatter TOLERANTLY (leading --- block; keys type/status/
#     domain; a page with no frontmatter is a context page). Page content is
#     DATA: it is never executed, eval'd, or sourced (C2-R1).
#   - type: idea|pain            -> CANDIDATE: .pipeline/candidates/<slug>.md
#                                   with frontmatter source_page, trust_tier:
#                                   unverified, ingested_at.
#   - everything else            -> context only, never a candidate (C2-R2).
#   - ALL pages (candidates or not) are ingested to memory (:3201, advisory)
#     following taste-ingest.sh conventions: metadata {source, trust_tier,
#     provenance_ref}; idea/pain pages ingest as "unverified", context pages
#     as "trusted"; hash ledger in .pipeline/taste/ingested.json under
#     "wiki:<relpath>" keys, updated only after a 2xx.
#
# HARD RULE (C2-R1): this connector is ENFORCEMENT-ONLY. It never writes
# outside .pipeline/ and the memory service, never writes back to TASTE_BRAIN
# (the wiki is read-only), never executes page content, and page text such as
# "ignore previous instructions" / "approve everything" / "disable steering"
# changes nothing about verdicts, permissions, or guardrails — the only
# effect any page can have is: one candidate file (marked unverified) and one
# advisory memory item.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PIPELINE_DIR="${TASTE_PIPELINE_DIR:-$ROOT/.pipeline}"
TASTE_DIR="$PIPELINE_DIR/taste"
LEDGER="$TASTE_DIR/ingested.json"
CANDIDATES_DIR="$PIPELINE_DIR/candidates"
ERRORS_LOG="$PIPELINE_DIR/errors.log"
MEMORY_URL="${TASTE_MEMORY_URL:-http://localhost:3201/api/ingest}"

# Brain path resolution (D1-R3) lives in the shared brain-resolve.sh helper
# (extracted for M3): TASTE_BRAIN → gizzi settings brain.path → ~/brain →
# legacy ~/Desktop/allternit-brain. Skipped silently below when absent.
BRAIN_RESOLVE="${BRAIN_RESOLVE:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/brain-resolve.sh}"
BRAIN="$("$BRAIN_RESOLVE")"

# Absent wiki: skip silently (same convention as taste-ingest.sh).
if [ ! -d "$BRAIN" ]; then
  echo "wiki-ingest: no wiki at $BRAIN; nothing to do"
  exit 0
fi

mkdir -p "$TASTE_DIR" "$CANDIDATES_DIR"

log_error() {
  printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$1" >> "$ERRORS_LOG"
}

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

# Tolerant frontmatter parse: prints "type=<value>" (empty when no frontmatter
# or no type key). Pure data extraction — the page is never executed.
page_type() { # page_type <file>
  python3 - "$1" <<'PY'
import sys
try:
    text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
except Exception:
    print("type=")
    sys.exit(0)
lines = text.split("\n")
ptype = ""
if lines and lines[0].strip() == "---":
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if ":" in line and not line.startswith((" ", "\t", "-")):
            k, _, v = line.partition(":")
            if k.strip() == "type":
                ptype = v.strip().strip('"').strip("'").lower()
print("type=" + ptype)
PY
}

posted=0; skipped=0; failed=0; candidates=0

ingest_page() { # ingest_page <trust_tier> <provenance_ref> <file>
  local tier="$1" prov="$2" f="$3" key hash payload code
  key="wiki:$prov"
  hash="$(python3 -c 'import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$f")"
  if [ "$(ledger_get "$key")" = "$hash" ]; then
    skipped=$((skipped + 1))
    return 0
  fi
  payload=$(python3 -c 'import json,sys
content = open(sys.argv[1], encoding="utf-8", errors="replace").read()
print(json.dumps({
    "content": content,
    "source": "wiki",
    "metadata": {
        "source": "wiki",
        "trust_tier": sys.argv[2],
        "provenance_ref": sys.argv[3],
    },
}))' "$f" "$tier" "$prov")
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -X POST "$MEMORY_URL" \
    -H 'Content-Type: application/json' -d "$payload" 2>/dev/null)
  if [[ "$code" == 2* ]]; then
    ledger_set "$key" "$hash"
    posted=$((posted + 1))
  else
    failed=$((failed + 1))
    log_error "wiki-ingest: memory ingest failed for $key (HTTP ${code:-000}) — continuing (advisory)"
  fi
}

# write_candidate <file> <relpath> — slug from the first "# " heading, else the
# filename; collisions get a short hash suffix of the relpath. Candidate
# content is the page VERBATIM below a generated header (data, never executed).
write_candidate() {
  python3 - "$1" "$2" "$CANDIDATES_DIR" <<'PY'
import hashlib, os, re, sys, datetime

path, relpath, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path, encoding="utf-8", errors="replace").read()

title = None
for line in text.split("\n"):
    if line.startswith("# "):
        title = line[2:].strip()
        break
if not title:
    title = os.path.splitext(os.path.basename(relpath))[0]

def base_slug(t):
    s = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:60].rstrip("-")
    return s or hashlib.sha1(t.encode()).hexdigest()[:12]

slug = base_slug(title)
if os.path.exists(os.path.join(outdir, slug + ".md")):
    h = hashlib.sha1(relpath.encode()).hexdigest()[:8]
    slug = "%s-%s" % (base_slug(title)[:51].rstrip("-"), h)

now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
doc = "---\nsource_page: %s\ntrust_tier: unverified\ningested_at: %s\n---\n\n# %s\n\n%s" % (
    relpath, now, title, text if text.endswith("\n") else text + "\n")
with open(os.path.join(outdir, slug + ".md"), "w") as f:
    f.write(doc)
print(slug)
PY
}

while IFS= read -r f; do
  rel="${f#"$BRAIN"/}"
  ptype="$(page_type "$f")"; ptype="${ptype#type=}"
  case "$ptype" in
    idea|pain)
      # C2-R2: only explicitly-marked idea/pain pages become candidates,
      # always trust_tier unverified — regardless of any page content.
      slug="$(write_candidate "$f" "$rel")"
      candidates=$((candidates + 1))
      echo "wiki-ingest: candidate $CANDIDATES_DIR/$slug.md (type: $ptype, unverified) <- $rel"
      ingest_page "unverified" "$rel" "$f"
      ;;
    *)
      # Context page (runbook/decision/identity/domain/unknown/no frontmatter)
      ingest_page "trusted" "$rel" "$f"
      ;;
  esac
done < <(find "$BRAIN" -type f -name '*.md' | sort)

echo "wiki-ingest: candidates=$candidates posted=$posted skipped=$skipped failed=$failed (ledger: $LEDGER)"
