# Steering spec — taste engine, Phase C1+C4 (taste memory loop)

<!-- From .pipeline/TRACK-C-taste-engine.md. Source of truth for this feature. -->

## Acceptance (Gherkin) — C1+C4

- Scenario: failed attempts don't become evidence
  Given a past session where an approach was tried and reverted
  When the taste corpus is built and a consult assembles precedents
  Then the reverted approach appears as a pitfall, not as trusted evidence.
- Scenario: outcome feedback recorded
  Given a spec that reached READY and was built
  When a human rejects it at merge
  Then .pipeline/outcomes.jsonl gains an event linking spec slug + outcome + date,
  and memory ingest is attempted with the rejection as a taste precedent.
- Scenario: precedent staleness
  Given a precedent ingested 100 days ago
  When a consult assembles precedents
  Then it is marked stale rather than treated as current.

## Phase C1+C4 — taste memory loop

- [ ] C1-R1: WHEN the taste corpus is built, THE SYSTEM SHALL ingest three
  source classes into the memory service (`POST :3201/api/ingest`) via
  connector scripts in `.pipeline/taste/`: (a) repo docs (AGENTS.md, DESIGN.md,
  module READMEs), (b) allternit-brain wiki pages (read-only clone path from
  env `BRAIN_REPO`), (c) local agent session transcripts (kimi, claude, codex
  session dirs from env overrides) — each item ingested with metadata
  `{source, trust_tier, provenance_ref}`.
- [ ] C1-R2: WHEN trust tiers are assigned, THE SYSTEM SHALL mark: merged
  code/docs and human-authored wiki decisions `trusted`; pipeline-generated
  artifacts `unverified`; reverted commits, REJECTed specs, and failed builds
  `failed` — and consult requests (steering, spec-checker) SHALL exclude
  `failed`-tier content from evidence while keeping it visible as pitfalls.
- [ ] C4-R1: WHEN a build outcome is known (merged, reverted, human-rejected),
  THE SYSTEM SHALL record it as an outcome event on the producing artifacts
  (brief slug, spec slug) in `.pipeline/outcomes.jsonl` and ingest the outcome
  to memory as a taste precedent.
- [ ] C4-R2: WHEN consult requests are assembled, THE SYSTEM SHALL include
  relevant past outcomes and REJECT/pitfall precedents (extending the current
  `query_precedents`) so repeated mistakes decay — a precedent older than 90
  days SHALL be marked `stale` rather than silently treated as current.

