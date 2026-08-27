---
status: done
files_changed:
  - docs/pipeline/bin/taste-ingest.sh       # new: taste corpus ingest, 3 source classes + trust tiers (C1-R1/R2)
  - docs/pipeline/bin/record-outcome.sh     # new: outcome feedback loop -> outcomes.jsonl + memory precedent (C4-R1)
  - docs/pipeline/bin/taste-test.sh         # new: offline PATH-shim test (36 checks)
  - docs/pipeline/bin/check-spec.sh         # query_precedents: [stale] for >90-day + [pitfall] for failed-tier (C4-R2, C1-R2)
  - docs/pipeline/taste/trust-rules.json    # new: default path-pattern -> trust-tier rules for sessions
  - docs/pipeline/README.md                 # C1+C4 section, record-outcome wiring at merge stage, testing, layout
  - docs/pipeline/.gitignore                # added taste/ingested.json + outcomes.jsonl
  - .steering/checkpoint.md             # steering checkpoint for this task
  - docs/TASTE_C1_NOTES.md              # this file
deviations:
  - "Spec C1-R1 names the brain env override BRAIN_REPO; the task doc (more
    specific, executor-facing) specifies TASTE_BRAIN defaulting to
    $HOME/Desktop/allternit-brain, skipped silently when absent. Followed the
    task doc; likewise TASTE_REPO_DOCS / TASTE_SESSIONS."
  - "TASTE_SESSIONS is a space-separated list of session dirs; every file
    found under them is ingested as a first+last 2KB excerpt (whole file when
    <=4KB). The task's 'first+last 2KB' is honored verbatim."
  - "Shipped trust-rules.json encodes the task's default exactly: default_tier
    unverified, patterns 'revert' and 'failed' -> failed (case-insensitive
    substring match on the file path)."
  - "record-outcome trust tiers follow C1-R2: merged -> trusted;
    reverted/rejected -> failed, so rejected/reverted outcomes surface as
    pitfalls, not evidence."
  - "Staleness looks for ingested_at/created_at/timestamp/ts/updated_at (ISO
    or epoch); absent or unparseable -> treated as current, per 'degrade
    gracefully when absent'."
  - "Ledger (docs/pipeline/taste/ingested.json) is updated only after an HTTP 2xx,
    so items that fail to post (memory down) are retried on the next run
    instead of being silently marked done."
remaining:
  - "Live end-to-end run against a real memory service on :3201 was not
    executed — all tests stub curl (offline, like check-spec-test.sh)."
  - "C2 (wiki connector, enforcement-only) and C3 (artifact contracts) remain
    as later phases per TRACK-C; not in this task's scope."
---

# C1+C4 NOTES — taste corpus + outcome feedback loop

## What was built

**`docs/pipeline/bin/taste-ingest.sh`** (C1-R1, C1-R2) — builds the taste corpus.
Three source classes, each POSTed to `http://localhost:3201/api/ingest` with
metadata `{source, trust_tier, provenance_ref}`:

- **repo docs** (`TASTE_REPO_DOCS`, default repo root): top-level `AGENTS.md`,
  `DESIGN.md`, `README.md` and `docs/*.md` (top level only) → `trusted`,
  source `repo-docs`.
- **brain wiki** (`TASTE_BRAIN`, default `$HOME/Desktop/allternit-brain`,
  skipped silently when absent): all `*.md` recursively → `trusted`, source
  `brain`.
- **agent sessions** (`TASTE_SESSIONS`, skipped unless set): every file under
  the given dirs, ingested as a first+last 2KB excerpt, source
  `agent-sessions`, tier from `docs/pipeline/taste/trust-rules.json` (path-pattern
  → tier; default `unverified`; shipped rules map `revert`/`failed` →
  `failed`).

Memory down = logged to `docs/pipeline/errors.log`, run continues and exits 0
(advisory, same posture as `check-spec.sh`'s `ingest_lesson`). Idempotent-ish:
`docs/pipeline/taste/ingested.json` ledgers `source:provenance_ref` →
sha256(content); unchanged items are skipped on re-run, and the ledger is only
updated after a 2xx so failures retry next run.

**`docs/pipeline/bin/record-outcome.sh <slug> <merged|reverted|rejected> [note]`**
(C4-R1) — the human half of the merge-stage loop. Appends
`{ts, slug, outcome, note}` to `docs/pipeline/outcomes.jsonl` (the hard artifact)
and ingests the outcome to memory as a taste precedent: `merged` → `trusted`,
`reverted`/`rejected` → `failed`. Memory down = logged, exit still 0. Wired by
documentation in `docs/pipeline/README.md`: human merge/reject decisions at the
queue/merge stage should be recorded with this command; the build-queue
announce step is unchanged.

**Precedent staleness + pitfall labeling** (C4-R2, C1-R2 consult half) —
`query_precedents` in `check-spec.sh` now prefixes `[stale] ` to memory items
whose timestamp is older than 90 days (checks
`ingested_at`/`created_at`/`timestamp`/`ts`/`updated_at`, ISO or epoch), and
prefixes `[pitfall] ` to items whose `metadata.trust_tier` (or top-level
`trust_tier`) is `failed`. Both labels compose (`[pitfall] [stale] …`). Items
without a parseable timestamp degrade to current; untiered items read as
ordinary precedents. Assembled precedent text is otherwise unchanged —
failed-tier content stays visible, but can no longer read as evidence.

**`docs/pipeline/bin/taste-test.sh`** — 36 offline checks, curl PATH-shimmed like
`check-spec-test.sh`: per-source-class metadata, trust-rule `failed` mapping,
ledger idempotency (re-run skips, changed file re-posts exactly once),
record-outcome append + post + tiers + usage error, `[stale]` marking only for
the 100-day precedent, `[pitfall]` marking only for failed-tier precedents
(including the composed `[pitfall] [stale]` case), and memory-down
log-and-continue for both scripts.

## Acceptance mapping

- *Failed attempts don't become evidence*: sessions under paths matching
  `revert`/`failed` are ingested as `failed` tier; `reverted`/`rejected`
  outcomes likewise. On the consult side, `query_precedents` labels every
  `failed`-tier item `[pitfall]` — a reverted approach appears as
  `[pitfall] Reverted approach: …`, never as undifferentiated evidence
  (verified by test; this was the steering gate's first-pass blocker, fixed).
- *Outcome feedback recorded*: `record-outcome.sh` appends to
  `outcomes.jsonl` and attempts memory ingest with the rejection as a taste
  precedent (verified by test).
- *Precedent staleness*: a 100-day-old precedent is assembled as
  `[stale] Old precedent: …`; 10-day and undated ones are not (verified).

## Verification

- `bash docs/pipeline/bin/taste-test.sh` — 36/36 PASS.
- `bash docs/pipeline/bin/check-spec-test.sh` — all PASS (staleness change is
  backward-compatible with timestamp-less memory responses).
- `bash -n` on all touched scripts.
