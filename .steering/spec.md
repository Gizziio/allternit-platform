# Steering spec — M2: learned artifacts, audited before adoption

<!-- From .pipeline/PROGRAM-meta-learning.md. M1+M3 merged. -->

## Requirements

- [ ] R1: WHEN a reflection run produces a rule whose provenance shows 3+
  independent events of the same kind (e.g. 3 gate blocks with the same
  failure class), THE SYSTEM SHALL mark that rule `upgrade_candidate` in the
  playbook and write a proposal to `.pipeline/proposals/<slug>.md`: what to
  change (which artifact — rubric, prompt, skill, script), the proposed
  diff/content, and the provenance.
- [ ] R2: WHEN a proposal exists, THE SYSTEM SHALL route it through the
  pipeline's own audit: the spec-checker (ao-steer via ao-consult) reviews
  the proposal against a new `.pipeline/proposal-rubric.md` (does the
  evidence support the change, is scope minimal, does it conflict with the
  charter) and verdicts ADOPT / REVISE / REJECT — recorded in
  `.pipeline/proposals/verdicts.json`. REJECT feeds the taste memory.
- [ ] R3: WHEN a proposal verdicts ADOPT, THE SYSTEM SHALL apply it:
  prompt/rubric/playbook changes are applied to the target file directly
  (they are data); script/skill changes produce a task spec for an executor
  instead (code goes through the full build pipeline). Application commits
  reference the proposal slug.
- [ ] R4: WHEN an adopted change lands, THE SYSTEM SHALL record the outcome
  linkage (proposal slug → commit) in `.pipeline/outcomes.jsonl` so later
  metrics can judge whether the upgrade helped.

## Acceptance (Gherkin)

- Scenario: repeated failures become a proposal
  Given 3 gate-block events of the same failure class in events.jsonl
  When reflection runs
  Then the rule is marked upgrade_candidate and a proposal exists with the
  target artifact, proposed change, and provenance.
- Scenario: audit gates adoption
  Given a proposal
  When the audit runs with a stubbed consult
  Then ADOPT applies the data-file change referencing the proposal slug;
  REJECT applies nothing and ingests the rejection; verdicts.json records it.
- Scenario: outcome linkage
  Given an adopted prompt change
  When it is applied
  Then outcomes.jsonl contains proposal slug + commit reference.
