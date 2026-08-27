# M1 TASK — event-driven learning capture + reflection playbook

You are the executor, working under the steering system (your checkpoints and
commit are independently reviewed). `docs/pipeline/PROGRAM-meta-learning.md` is
the program context. `.steering/spec.md` below is your spec.

## Spec (M1)

- R1: WHEN a learnable moment occurs — a steering verdict (via
  `.steering/bin/steer-common.sh` consult path), a gate verdict
  (steer-pre-commit-gate.sh), a check-spec verdict, a record-outcome call,
  a dismissal — THE SYSTEM SHALL append `{ts, kind, refs, summary}` to
  `docs/pipeline/learn/events.jsonl` (gitignored) at the moment it happens, via
  one shared helper (`docs/pipeline/bin/learn-event.sh <kind> <refs> <summary>`).
- R2: WHEN a pipeline run or executor phase completes (end of build-queue
  run, end of check-spec run), THE SYSTEM SHALL offer reflection:
  `docs/pipeline/bin/learn-reflect.sh` reads events.jsonl since last reflection
  (watermark file), consults ao-consult with a distillation prompt
  (`docs/pipeline/learn/reflect-prompt.md`), and appends resulting rules to
  `docs/pipeline/playbook.md` — each rule imperative, with `confidence`,
  `provenance` (event refs), `added`, `last_confirmed`. Reflection is
  advisory: consult failure logs and continues.
- R3: WHEN any consult request is assembled (steer-common.sh build_context,
  check-spec.sh request), THE SYSTEM SHALL include `docs/pipeline/playbook.md`
  (capped 4KB) if present.
- R4: WHEN rules age, THE SYSTEM SHALL mark rules unconfirmed for 90+ days
  as stale at inclusion time (same pattern as precedent staleness).

## Acceptance (Gherkin)

- Scenario: moment captured at the moment
  Given a gate fires a STEER verdict
  When the verdict is logged
  Then events.jsonl gains a gate event with the verdict + cmd ref in the same run.
- Scenario: reflection distills at completion
  Given 3 events since the watermark and a stubbed consult returning rules
  When learn-reflect runs (stub via STEER_CONSULT_CMD-style override)
  Then playbook.md gains the rules with confidence + provenance, the
  watermark advances, and a second run reflects nothing new.
- Scenario: playbook reaches consults
  Given a playbook with a rule
  When a check-spec request is assembled
  Then it contains the rule text; a 90-day-old rule is marked [stale].

## Build map

1. `docs/pipeline/bin/learn-event.sh` — the shared append helper (bash+python3,
   .pipeline conventions; sanitize inputs; create dir).
2. Hook points: steer-common.sh (after verdict computed), steer-pre-commit-
   gate.sh (verdict), check-spec.sh (verdict paths), record-outcome.sh,
   dismiss.sh — one-line call each with kind/refs/summary. Do NOT change
   their verdict semantics.
3. `docs/pipeline/bin/learn-reflect.sh` + `docs/pipeline/learn/reflect-prompt.md` —
   watermark at `docs/pipeline/learn/watermark`; consult override env
   LEARN_CONSULT_CMD for tests (same pattern as SPEC_CHECK_CMD).
4. Playbook inclusion: steer-common.sh steer_build_context + check-spec.sh
   request assembly, 4KB cap, [stale] marking by rule date.
5. `docs/pipeline/bin/learn-test.sh` — shim tests for R1-R4 + the two Gherkin
   scenarios (capture-on-verdict, reflect idempotency, playbook inclusion,
   stale marking). PASS/FAIL, non-zero on FAIL.
6. `docs/pipeline/.gitignore`: learn/events.jsonl, learn/watermark (playbook.md
   and reflect-prompt.md ARE committed).

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] authoritative.
2. Done → `docs/META_M1_NOTES.md` with YAML frontmatter, then
   `touch docs/META_M1_NOTES.sentinel`.
3. Then commit: `git add .pipeline .steering docs && git commit -m "feat(pipeline): event-driven learning capture + reflection playbook (M1)"`.
   A gate reviews; fix and retry if blocked.

## Constraints

- bash + python3 only; no new deps; memory stays advisory.
- Do not alter any existing verdict/gate behavior — capture is additive.
