# Steering spec — Track D, Phase D1: gizzi brain init

<!-- From .pipeline/TRACK-D-brain-onboarding.md (steered v1). Product decision:
     local-first with sync; brain = git repo of frontmatter markdown. -->

## The brain (canonical structure)

A user's second brain: a git repo of markdown with frontmatter, created by
onboarding, read by agents (pipeline taste engine, steering, future features).
Canonical layout (v1):

```
brain/
├── brain.yaml                 # schema_version, owner, created, platform remote
├── identity.md                # who the user is, roles, goals (frontmatter: type: identity)
├── domains/
│   └── <domain>.md            # areas of work/life (frontmatter: type: domain, status)
├── decisions/                 # type: decision, status: active|superseded, date
├── runbooks/                  # type: runbook, domain
├── ideas/                     # type: idea|pain, status: new|reviewing|rejected|built
└── MEMORY.md                  # index/agents' entry point (like AGENTS.md)
```

Frontmatter convention matches Track C2 (`type`, `status`, `domain`) so the
taste engine's wiki connector consumes any brain with zero adapter work.


## Phase D1 — gizzi-code: `gizzi brain init`

- [ ] D1-R1: WHEN a user runs `gizzi brain init`, THE SYSTEM SHALL create the
  canonical brain structure (git init, template files above, first commit) at
  a user-chosen path (default `~/brain`), refusing to overwrite a non-empty
  existing brain unless `--force`.
- [ ] D1-R2: WHEN a brain exists, `gizzi brain` SHALL print status (path,
  remote configured?, uncommitted changes, unpushed commits) and
  `gizzi brain sync` SHALL git pull --rebase then push to the configured
  remote, surfacing conflicts as plain instructions (never auto-resolving).
- [ ] D1-R3: WHEN a brain is initialized, THE SYSTEM SHALL wire it into the
  local agent layer: memory ingestion config pointing at the brain path
  (so the taste corpus / wiki connector can ingest it) and an AGENTS.md-style
  pointer in the brain's MEMORY.md.
- [ ] D1-R4: WHEN a user has a platform account, `gizzi brain init --remote`
  SHALL provision a hosted remote via the D2 API and configure it as origin.


## Acceptance (Gherkin)

- Scenario: init creates a conforming brain
  Given an empty target path
  When `gizzi brain init` runs
  Then the canonical layout exists with valid frontmatter in every template
  page, one initial commit, and `gizzi brain` reports clean status.

## Constraints

- Sync is git. No bespoke merge logic anywhere in D1-D3.
- The platform is never the system of record: losing the hosted remote loses
  no data (every device has full history).
- D1 lives in cmd/gizzi-code (match its command conventions); D2 in
  cmd/allternit-api (new route module, auth like existing routes).
