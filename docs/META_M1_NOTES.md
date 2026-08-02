---
status: done
files_changed:
  - .pipeline/bin/learn-event.sh
  - .pipeline/bin/learn-playbook.sh
  - .pipeline/bin/learn-reflect.sh
  - .pipeline/bin/learn-test.sh
  - .pipeline/learn/reflect-prompt.md
  - .pipeline/bin/check-spec.sh
  - .pipeline/bin/build-queue.sh
  - .pipeline/bin/record-outcome.sh
  - .pipeline/bin/dismiss.sh
  - .pipeline/.gitignore
  - .pipeline/README.md
  - .steering/bin/steer-common.sh
  - .steering/bin/steer-stop.sh
  - .steering/bin/steer-pre-commit-gate.sh
  - .steering/checkpoint.md
  - docs/META_M1_NOTES.md
tests_green: true
deviations:
  - "R1 lists the steering verdict hook point as 'steer-common.sh consult path', but verdicts are computed in the callers (steer-stop.sh, steer-pre-commit-gate.sh), not in steer-common.sh. steer-common.sh gained the shared `steer_learn` helper (advisory, `|| true`, no-op when the helper is absent) and both callers invoke it one line after their verdict steer_log — capture happens in the same run, at the moment of the verdict, without touching verdict semantics."
  - "R2's reflection consult-answer transport: the answer is passed to the parsing python3 via argv, not stdin — a `printf | python3 - <<'PY'` pipe is silently overridden by the heredoc (the heredoc IS stdin), which the first test run caught ('0 rule(s) appended')."
  - "Playbook rule line format (spec names the fields, not the serialization): `- <imperative> (confidence: low|medium|high; provenance: <kind:refs@ts, ...>; added: YYYY-MM-DD; last_confirmed: YYYY-MM-DD)` — single-line, regex-parseable by learn-playbook.sh for [stale] marking. The reflect consult contract is `RULE | <text> | <confidence> | <provenance>` lines (defined in learn/reflect-prompt.md); unknown/missing confidence degrades to low."
  - "Watermark = reflected line count of events.jsonl (not a byte offset), advanced only on a non-empty consult answer — a failed/empty reflection logs to errors.log and leaves the watermark, so events are re-presented next time. A successful reflection that yields zero rules still advances (the events were considered)."
  - "Reflection triggers wired: end of check-spec.sh (after the spec loop) and end of build-queue.sh (after the build loop), both `[ -x ]`-guarded and `|| true`. Early exits (empty queue, rails-ensure abort, no specs) do not reflect — nothing completed in those runs."
remaining:
  - "Rules are never re-confirmed automatically: last_confirmed is set at append time, so every rule goes [stale] after 90 days unless a future phase (M2 audit loop?) refreshes it on observed usefulness."
  - "Old events are never compacted; events.jsonl grows unboundedly (mitigated by 500-char summary caps, but a sweeper may be warranted)."
  - "build-queue early-exit paths (empty queue, rails-ensure abort) skip reflection; if reflection-on-idle is ever wanted, hoist the offer before those exits."
---
# M1 — event-driven learning capture + reflection playbook: completion notes

## What was built (spec .steering/spec.md R1–R4, task docs/META_M1_TASK.md)

### R1 — capture at the moment (learn-event.sh + hook points)

- New shared helper `.pipeline/bin/learn-event.sh <kind> <refs> <summary>`:
  appends `{ts, kind, refs, summary}` as one JSON line to
  `.pipeline/learn/events.jsonl` (gitignored). Inputs sanitized (whitespace
  collapsed, kind/refs/summary capped at 40/300/500 chars), directory created
  on demand, `LEARN_PIPELINE_DIR` override for tests (same pattern as
  `TASTE_PIPELINE_DIR`).
- Hook points, one additive call each, all advisory (`|| true`, exit codes
  and verdict semantics untouched):
  - `steer-common.sh`: new `steer_learn <cwd> <kind> <refs> <summary>`
    helper (no-op when learn-event.sh is absent from the project);
  - `steer-stop.sh`: `steering` event after the checkpoint verdict
    (refs = checkpoint hash);
  - `steer-pre-commit-gate.sh`: `gate` event after the gate verdict
    (refs = the git command, 120-char cap);
  - `check-spec.sh`: `check-spec` event on READY / NEEDS-WORK / STALLED /
    REJECT right after each `verdict_set` (refs = slug);
  - `record-outcome.sh`: `outcome` event (refs = slug, summary = outcome +
    note);
  - `dismiss.sh`: `dismissal` event (refs = slug, summary = title).

### R2 — reflection at completion (learn-reflect.sh + reflect-prompt.md)

- `.pipeline/bin/learn-reflect.sh`: reads events since the watermark
  (line count in `.pipeline/learn/watermark`), assembles
  `.pipeline/learn/reflect-prompt.md` + the new events, consults ao-consult
  (`LEARN_CONSULT_CMD` override, same pattern as `SPEC_CHECK_CMD`), parses
  `RULE | text | confidence | provenance` lines from the answer, and appends
  them to `.pipeline/playbook.md` with `added`/`last_confirmed` dates.
- Advisory: empty/failed consult → errors.log entry, watermark NOT advanced,
  exit 0. Success advances the watermark even when zero rules distill.
- Offered at the end of `check-spec.sh` and `build-queue.sh` runs
  (`LEARN_REFLECT` override point for tests).

### R3 — playbook reaches every consult (learn-playbook.sh)

- New `.pipeline/bin/learn-playbook.sh [path]`: prints the playbook for
  inclusion — 4KB-capped, exit 0 + empty output when absent.
- `steer-common.sh steer_build_context`: a `=== LEARNED PLAYBOOK ===` section
  follows the spec/checkpoint evidence (steering + gate consults).
- `check-spec.sh` request assembly: same section after the taste precedents.

### R4 — staleness at inclusion time

- `learn-playbook.sh` parses each `- ` rule line's `last_confirmed:
  YYYY-MM-DD`; 90+ days unconfirmed → the line is emitted as
  `- [stale] <text> (...)` (same pattern as C4-R2 precedent staleness). The
  playbook file itself is never mutated.

## Tests (learn-test.sh, 42 checks, fully stubbed)

- R1: direct capture shape + sanitization + usage error; gate STEER verdict
  captured in the same run with cmd ref (Gherkin 1, gate still blocks with
  exit 2 — semantics unchanged); check-spec READY verdict event;
  record-outcome + dismiss events.
- R2 (Gherkin 2): 3 events distilled via stubbed `LEARN_CONSULT_CMD` →
  playbook gains rules with confidence + provenance + dates, watermark
  advances to 3, second run consults nothing and changes nothing; consult
  failure is logged, advisory, watermark untouched; reflection offered at
  end of check-spec and build-queue runs (marker-stub).
- R3 (Gherkin 3): check-spec request and steering/gate context both contain
  the playbook rule text under a labeled section.
- R4: 100-day-old rule marked `[stale]` in both consult assemblies; fresh
  rule unmarked; inclusion non-mutating; 4KB cap enforced; missing playbook
  prints nothing.

Full suite green: learn-test (42), check-spec-test, build-queue-test (66),
contract-test, wiki-test, taste-test, generate-spec-test, scout-test,
worktree-guard-test.

## Constraints honored

- bash + python3 only; no new dependencies; memory stays advisory.
- No verdict/gate behavior altered — every capture/reflection call is
  additive, `[ -x ]`-guarded, and `|| true`.
- `.pipeline/.gitignore`: `learn/events.jsonl` + `learn/watermark` ignored;
  `playbook.md` and `learn/reflect-prompt.md` committed.
