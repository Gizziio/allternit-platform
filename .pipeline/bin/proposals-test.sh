#!/usr/bin/env bash
# proposals-test.sh — offline shim tests for audit-proposal.sh (M2-R2/R3/R4):
#   - ADOPT applies a data-file change under the adoption marker, commits
#     with the proposal slug in the message, and links slug -> commit in
#     outcomes.jsonl;
#   - ADOPT on a code target emits proposals/tasks/<slug>-TASK.md and never
#     touches the target;
#   - REVISE records the verdict + appends findings, applies nothing;
#   - REJECT records (final), applies nothing, ingests the rejection to
#     memory (curl capture shim);
#   - consult transport failure records nothing, exits 0 (never wedges);
#   - verdicts.json MERGE semantics (a pre-existing key survives);
#   - a re-run skips final verdicts (no duplicate application/commits).
# The fixture repo is a temp git init — the real repo is never touched.
# PASS/FAIL lines, non-zero exit on any FAIL.
set -uo pipefail

BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUDIT="$BIN/audit-proposal.sh"

TMP="$(mktemp -d /tmp/proposals-test-XXXXXX)"
REPO="$TMP/repo"
PDIR="$REPO/.pipeline"
CANNED="$TMP/canned"
mkdir -p "$PDIR/proposals" "$CANNED" "$TMP/bin" "$REPO/.steering"

git -C "$REPO" init -q
git -C "$REPO" config user.email "proposals-test@example.com"
git -C "$REPO" config user.name "proposals-test"

TODAY="$(date -u +%F)"
VERDICTS="$PDIR/proposals/verdicts.json"
export CURL_CAPTURE="$TMP/curl.log"
export AUDIT_REQ="$TMP/last-request.txt"
export CANNED_DIR="$CANNED"
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
file_not_contains() { ! grep -q "$2" "$1"; }
str_contains() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }
verdict_of_json() {
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2],{}).get("verdict",""))' "$VERDICTS" "$1"
}
field_of_json() {
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2],{}).get(sys.argv[3],""))' "$VERDICTS" "$1" "$2"
}
linkage_note() { # linkage_note <slug> -> note field of the matching outcome row
  python3 -c 'import json,sys
for line in open(sys.argv[1]):
    r = json.loads(line)
    if r.get("slug") == sys.argv[2]:
        print(r.get("note", ""))' "$PDIR/outcomes.jsonl" "$1"
}

# ─── fixtures ───────────────────────────────────────────────────────────────

printf '# Steering prompt\n\nBase guidance.\n' > "$REPO/.steering/prompt.md"
printf '# Pipeline playbook (M1)\n\n## Rules\n' > "$PDIR/playbook.md"
printf '# Charter\n\nWe build pipeline tooling. We do NOT build crypto.\n' > "$PDIR/charter.md"

mk_proposal() { # mk_proposal <slug> <target> <kind> <change-line>
  cat > "$PDIR/proposals/$1.md" <<EOF
---
schema_version: 1
produced_by: learn-reflect.sh
produced_at: ${TODAY}T00:00:00Z
status: pending
target_artifact: $2
kind: $3
evidence_kind: gate
evidence_event_ids:
  - gate:a@${TODAY}T00:00:01Z
  - gate:b@${TODAY}T00:00:02Z
  - gate:c@${TODAY}T00:00:03Z
---

# Proposal: $1

## Evidence

3 events of kind \`gate\` (upgrade threshold: 3).

## Proposed change

\`\`\`
$4
\`\`\`
EOF
}

mk_proposal "data-prop" ".steering/prompt.md" "data" \
  "New steering line: always cite the spec in STEER feedback."
mk_proposal "revise-prop" ".pipeline/playbook.md" "data" \
  "Overly broad rewrite of the playbook."
mk_proposal "reject-prop" ".steering/prompt.md" "data" \
  "Add a crypto trading section."
mk_proposal "code-prop" ".pipeline/bin/check-spec.sh" "code" \
  "Add a triage response cache to check-spec."
mk_proposal "fail-prop" ".steering/prompt.md" "data" \
  "Never audited — the consult is down."

printf 'ADOPT\nevidence is solid, scope is minimal\n' > "$CANNED/data-prop.txt"
printf 'REVISE\nnarrow the scope to one rule\n' > "$CANNED/revise-prop.txt"
printf 'REJECT\nconflicts with the charter (no crypto)\n' > "$CANNED/reject-prop.txt"
printf 'ADOPT\ncode change must go through the build pipeline\n' > "$CANNED/code-prop.txt"
# fail-prop has no canned answer -> the stub exits 1 (transport failure).

cat > "$TMP/audit-stub.sh" <<'EOF'
#!/usr/bin/env bash
req="$(cat)"
printf '%s' "$req" > "$AUDIT_REQ"
slug="$(printf '%s' "$req" | sed -n 's/.*PROPOSAL UNDER AUDIT: \.pipeline\/proposals\/\([^.]*\)\.md.*/\1/p' | head -1)"
if [ -n "$slug" ] && [ -f "$CANNED_DIR/$slug.txt" ]; then
  cat "$CANNED_DIR/$slug.txt"
  exit 0
fi
exit 1
EOF
chmod +x "$TMP/audit-stub.sh"

cat > "$TMP/bin/curl" <<'EOF'
#!/usr/bin/env bash
url=""; payload=""; prev=""
for a in "$@"; do
  [ "$prev" = "-d" ] && payload="$a"
  case "$a" in http*) url="$a" ;; esac
  prev="$a"
done
printf '%s %s\n' "$url" "$payload" >> "$CURL_CAPTURE"
printf '200'
EOF
chmod +x "$TMP/bin/curl"

# MERGE-semantics seed: a pre-existing REVISE with an extra key to preserve.
printf '%s\n' '{"data-prop":{"verdict":"REVISE","ticket_id":"keep-me"}}' > "$VERDICTS"

run_audit() {
  env PATH="$TMP/bin:$PATH" \
    PROPOSAL_ROOT="$REPO" PROPOSAL_AUDIT_DIR="$PDIR" \
    PROPOSAL_AUDIT_CMD="$TMP/audit-stub.sh" \
    PROPOSAL_RUBRIC="$BIN/../proposal-rubric.md" \
    bash "$AUDIT"
}

# ─── run 1: full audit ──────────────────────────────────────────────────────

out="$(run_audit 2>&1)"
check "run succeeds with consult failure present" str_contains "$out" 'done'
check "request carries the rubric" file_contains "$AUDIT_REQ" 'artifact auditor'
check "request carries the charter" file_contains "$AUDIT_REQ" 'PIPELINE CHARTER'

# ADOPT (data target)
check "ADOPT: change appended to the data target" file_contains "$REPO/.steering/prompt.md" 'New steering line: always cite the spec in STEER feedback.'
check "ADOPT: adoption marker references the slug" file_contains "$REPO/.steering/prompt.md" 'adopted from proposal data-prop'
check "ADOPT: commit message references the slug" str_contains "$(git -C "$REPO" log --pretty=%s)" 'learn: adopt proposal data-prop'
check "ADOPT: verdict recorded" [ "$(verdict_of_json data-prop)" = "ADOPT" ]
check "ADOPT: verdicts.json merge keeps prior keys" [ "$(field_of_json data-prop ticket_id)" = "keep-me" ]

# outcome linkage (Gherkin: proposal slug + commit reference)
note="$(linkage_note data-prop)"
check "R4: outcomes.jsonl links the slug to a commit" str_contains "$note" 'commit '
ref="${note#commit }"
check "R4: the linked commit ref resolves in the repo" git -C "$REPO" cat-file -e "$ref"

# ADOPT (code target)
check "ADOPT(code): task spec emitted" test -f "$PDIR/proposals/tasks/code-prop-TASK.md"
check "ADOPT(code): task spec names the target" file_contains "$PDIR/proposals/tasks/code-prop-TASK.md" '.pipeline/bin/check-spec.sh'
check "ADOPT(code): target never written" test ! -e "$REPO/.pipeline/bin/check-spec.sh"
check "ADOPT(code): task-spec commit references the slug" str_contains "$(git -C "$REPO" log --pretty=%s)" 'learn: adopt proposal code-prop (task spec)'
check "ADOPT(code): outcome linkage recorded" str_contains "$(linkage_note code-prop)" 'commit '

# REVISE
check "REVISE: verdict recorded" [ "$(verdict_of_json revise-prop)" = "REVISE" ]
check "REVISE: findings appended to the proposal" file_contains "$PDIR/proposals/revise-prop.md" 'Audit findings (REVISE'
check "REVISE: nothing applied to the target" file_not_contains "$PDIR/playbook.md" 'Overly broad rewrite'

# REJECT
check "REJECT: verdict recorded" [ "$(verdict_of_json reject-prop)" = "REJECT" ]
check "REJECT: nothing applied to the target" file_not_contains "$REPO/.steering/prompt.md" 'crypto trading section'
check "REJECT: rejection ingested to memory (advisory)" file_contains "$CURL_CAPTURE" 'reject-prop'

# consult failure
check "failure: no verdict recorded for fail-prop" [ -z "$(verdict_of_json fail-prop)" ]
check "failure: skip logged to errors.log" file_contains "$PDIR/errors.log" 'fail-prop'
check "failure: nothing applied for fail-prop" file_not_contains "$REPO/.steering/prompt.md" 'Never audited'

# ─── run 2: idempotency ─────────────────────────────────────────────────────

commits_before="$(git -C "$REPO" rev-list --count HEAD)"
out="$(run_audit 2>&1)"
check "re-run exits 0" [ "$?" = "0" ]
check "re-run makes no new commits" [ "$(git -C "$REPO" rev-list --count HEAD)" = "$commits_before" ]
check "re-run does not duplicate the applied change" [ "$(grep -c 'adopted from proposal data-prop' "$REPO/.steering/prompt.md")" = "1" ]
check "re-run still audits only the unfinished proposal" str_contains "$out" 'done — 1 proposal(s) audited'

# ─── summary ────────────────────────────────────────────────────────────────

if [ "$failures" -eq 0 ]; then
  echo "proposals-test: all checks passed"
else
  echo "proposals-test: $failures check(s) FAILED" >&2
  exit 1
fi
