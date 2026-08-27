---
status: done
files_changed:
  - docs/pipeline/bin/brain-resolve.sh
  - docs/pipeline/bin/learn-reflect.sh
  - docs/pipeline/bin/learn-test.sh
  - docs/pipeline/bin/taste-ingest.sh
  - docs/pipeline/bin/wiki-ingest.sh
  - docs/pipeline/README.md
  - .steering/checkpoint.md
  - docs/META_M3_NOTES.md
tests_green: true
deviations:
  - "Brain resolution extraction (build map item 1): the resolve_brain logic was verbatim-duplicated in taste-ingest.sh and wiki-ingest.sh (24 lines each); it is now the executable docs/pipeline/bin/brain-resolve.sh (prints the resolved path, same TASTE_BRAIN → gizzi settings brain.path → ~/brain → legacy semantics), called via a BRAIN_RESOLVE override point. First attempt defaulted the helper path to $PIPELINE_DIR/bin/ — that broke taste/wiki tests (temp pipeline dirs have no bin/) and, inverted, would have let learn-test runs touch the operator's REAL brain. The default is now script-relative (committed code travels with the caller), and learn-test.sh exports TASTE_BRAIN to an unresolvable path globally, with per-scenario fixture overrides."
  - "R2 stale flip is driven by the brain page's own last_confirmed frontmatter (not playbook frontmatter as the build map parenthetically suggested): on every learn-reflect invocation — aging is time-based, so it also runs on no-new-events runs — learnings/*.md pages with status: active and last_confirmed 90+ days old flip to status: stale, in place, frontmatter-only. The playbook's inline last_confirmed remains the consult-side marker (M1-R4); the brain page is the persistence-side one."
  - "R3 commit message: the spec says `learn: <rule slug>`, the build map says `learn: <n> rules (<date>)` or the first slug. Implemented: 1 rule → `learn: <slug>`; n>1 → `learn: <n> rules (<date>)`; stale-flips-only → `learn: stale flips (<date>)`. Always exactly one commit per run covering new pages AND flips (add -- learnings only)."
  - "Re-distilled rule (same slug already in the brain): the page is refreshed (text/confidence/provenance) but keeps its original added / last_confirmed / status — re-distillation is not confirmation, so it must not reset the aging clock."
  - "domain is fixed to `pipeline` — rules are distilled from pipeline events and carry no finer-grained domain signal."
remaining:
  - "Rules are still never actively re-confirmed, so every learning eventually goes stale; an M2 audit pass could refresh last_confirmed when a rule is observed guiding a good verdict."
  - "Stale-flipped pages are never resurrected automatically when the same lesson is re-distilled after flipping (status is preserved); a human or a future phase can flip status back to active."
  - "No brain-side compaction: learnings/ grows one page per distinct rule slug."
---
# M3 — learnings persist in the second brain: completion notes

## What was built (spec .steering/spec.md R1–R4, task docs/META_M3_TASK.md)

### Shared brain resolution (build map item 1)

- New executable `docs/pipeline/bin/brain-resolve.sh`: prints the resolved brain
  path (`TASTE_BRAIN` → gizzi settings `brain.path` → `~/brain` → legacy
  `~/Desktop/allternit-brain`), extracted verbatim from the duplicated
  `resolve_brain` in `taste-ingest.sh` and `wiki-ingest.sh`. Both scripts now
  call it via a `BRAIN_RESOLVE` override point; the default is script-relative
  so test temp pipeline dirs (no `bin/`) keep working.

### R1 — rules land in the brain (learn-reflect.sh extension)

- After the playbook append, the parsed rules travel to the shell as JSONL
  (temp file) and each is written by `brain_write_rule` to
  `<brain>/learnings/<slug>.md` (slug = slugified rule text, dismiss.sh
  convention). Frontmatter: `type: lesson`, `status: active`,
  `domain: pipeline`, `confidence`, `provenance_refs` (dashed list of the
  rule's `kind:refs@ts` event refs), `added`, `last_confirmed`. Body is the
  rule text under a `# ` heading.

### R2 — aging is visible

- `brain_stale_sweep` runs on EVERY learn-reflect invocation (before the
  no-new-events early exit): learnings pages with `status: active` and
  `last_confirmed` 90+ days old flip to `status: stale` in place;
  page content is otherwise untouched.

### R3 — one `learn:` commit per run, never push

- `brain_commit`: no-op unless the brain is a git repo with changes under
  `learnings/`; then `git add -- learnings` + one commit — `learn: <slug>`
  (1 rule), `learn: <n> rules (<date>)` (n>1), or `learn: stale flips
  (<date>)` (flips only). Never pushes; commit failure is logged, advisory.

### R4 — no brain, no problem

- No resolvable brain (or `BRAIN_RESOLVE` missing): rule-producing runs log
  ONE `no brain resolvable` note to errors.log; the playbook update,
  watermark advance, and exit 0 are unaffected. Idle runs stay silent.

## Tests (learn-test.sh, +24 checks; all M1 checks green)

- Gherkin "rules land in the brain": git-init brain fixture, 2-rule stub
  consult → 2 frontmatter-valid lesson pages (type/status/domain/confidence/
  added/last_confirmed/provenance_refs all asserted), page body carries the
  rule text, exactly ONE `learn: 2 rules (<date>)` commit touching only
  `learnings/`.
- Gherkin "aging is visible": pre-aged page (last_confirmed 100 days) flips
  to `status: stale` on the next run, content intact, fresh rules stay
  active, single-rule commit message is `learn: <slug>`, no remotes (never
  pushed).
- Gherkin "no brain, no problem": unresolvable brain → exit 0, playbook
  still gains the rule, exactly one skip note in errors.log, no phantom
  brain dir created.
- Non-git brain: pages still written, no commit attempted, exit 0.
- Regression guard: learn-test.sh exports `TASTE_BRAIN` to an unresolvable
  path so test runs can never write to the operator's real brain.

Full suite green: learn-test (66), check-spec-test, build-queue-test (66),
contract-test, wiki-test, taste-test, generate-spec-test, scout-test,
worktree-guard-test.

## Constraints honored

- Brain written ONLY under `learnings/` (pages + stale flips; commit staged
  with `add -- learnings`).
- No push, no remote mutation; memory service untouched (stays advisory).
- bash + python3 only, no new dependencies.
