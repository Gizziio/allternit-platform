# Steering spec — M3: learnings persist in the second brain

<!-- From .pipeline/PROGRAM-meta-learning.md. M1 merged (228a1e5d4). -->

## Requirements

- [ ] R1: WHEN learn-reflect.sh distills rules into the playbook, THE SYSTEM
  SHALL also write each rule as a frontmatter page into the resolved brain
  (same resolution as taste-ingest: TASTE_BRAIN env → gizzi settings
  brain.path → ~/brain → skip silently): `learnings/<slug>.md` with
  frontmatter `type: lesson`, `status: active|stale`, `domain`,
  `confidence`, `provenance_refs` (event ids), `added`, `last_confirmed`.
- [ ] R2: WHEN a rule goes stale (90+ days unconfirmed), THE SYSTEM SHALL
  flip its brain page `status` to `stale` on the next reflection run —
  learnings age visibly in the brain, not silently.
- [ ] R3: WHEN the brain is a git repo, THE SYSTEM SHALL commit learning
  pages with message `learn: <rule slug>` (single commit per reflection run,
  not per rule) and SHALL NOT push (sync is the user's `gizzi brain sync`).
- [ ] R4: WHEN no brain is resolvable, THE SYSTEM SHALL skip brain
  persistence and note it once in errors.log (never fail the reflection).

## Acceptance (Gherkin)

- Scenario: rules land in the brain
  Given a resolved brain dir and a reflection producing 2 rules
  When the run completes
  Then brain/learnings/ contains 2 frontmatter-valid lesson pages with
  provenance refs, and `git -C <brain> log -1` shows one `learn:` commit.
- Scenario: aging is visible
  Given a rule older than 90 days unconfirmed
  When the next reflection runs
  Then its brain page status is stale.
- Scenario: no brain, no problem
  Given no resolvable brain
  When reflection runs
  Then playbook.md still updates and errors.log notes the skip once.
