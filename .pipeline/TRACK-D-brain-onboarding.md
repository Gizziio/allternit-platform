# Track D spec — second-brain onboarding (local-first with platform sync)

Status: DRAFT v1. Product decision (user, 2026-08-01): **local-first with
platform sync**. The brain is a local git repo of agent-readable markdown;
the platform is the hosted remote + read API, NOT the system of record.
Sync = git push/pull (git's own merge machinery) — no bespoke sync engine.

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

## Phase D2 — platform: hosted brain remotes + read API

Infrastructure reality (steering review, verified by grep): no git smart-HTTP
serving exists anywhere in this repo today; no git-compatible credential type
exists (Clerk JWT, desktop-bootstrap secret, and `allternit_runtime_` device
tokens are all session-scoped, not git-Basic-Auth-shaped). D2 is therefore
split: D2a is real new infrastructure, D2b is simple once D2a exists.

- [ ] D2a-R1: WHEN an authenticated user provisions a brain,
  `POST /api/v1/brains` SHALL create a per-user bare git repo on the platform
  and return its clone URL; per-user isolation enforced.
- [ ] D2a-R2: WHEN git clients connect, THE SYSTEM SHALL serve smart-HTTP
  push/pull by proxying to `git http-backend` (the CGI binary bundled with
  git — the well-precedented bootstrap path; hand-rolling the protocol is
  out of scope), under the platform's auth middleware.
- [ ] D2a-R3: WHEN a git client authenticates, THE SYSTEM SHALL accept a NEW
  credential type minted for git operations: a long-lived personal-access-
  token-style token (`allternit_git_` prefix), created/revoked via
  `POST/DELETE /api/v1/tokens/git`, usable as HTTP Basic password on the
  git endpoints only — not a Clerk session JWT.
- [ ] D2b-R1: WHEN agents need brain content server-side,
  `GET /api/v1/brains/:id/pages` SHALL return the brain's markdown pages with
  frontmatter parsed (read-only; writes happen only via git).

## Phase D3 — iOS onboarding

PRE-PHASE (spike, must complete before D3-R1/R2 are handed to a builder):
select and integrate an embedded iOS git client — most likely SwiftGit2
wrapping libgit2 compiled for iOS ARM64 (no git library exists in the iOS
surface today, and App Store sandboxing forbids shelling out to a git
binary). Deliverable: go/no-go + a minimal clone/commit/push proof in the
iOS app target.

- [ ] D3-R1: WHEN a new user completes iOS onboarding, THE SYSTEM SHALL offer
  brain creation: one tap provisions the hosted remote (D2a) and clones the
  canonical structure locally on-device via the spike's library.
- [ ] D3-R2: WHEN the user captures a note/idea/pain in the iOS app,
  THE SYSTEM SHALL append it as a frontmatter-marked page under `ideas/` and
  sync (push) in the background; sync failures queue locally and retry.

## Out of scope

- Team/shared brains, web editor, end-to-end encryption, migration of
  existing brains (allternit-brain stays as-is; D1 may offer `--import`).
- Automatic conflict resolution (git surfaces conflicts; humans resolve).

## Acceptance (Gherkin)

- Scenario: init creates a conforming brain
  Given an empty target path
  When `gizzi brain init` runs
  Then the canonical layout exists with valid frontmatter in every template
  page, one initial commit, and `gizzi brain` reports clean status.
- Scenario: round-trip through the platform
  Given a provisioned hosted remote
  When a page is added locally and `gizzi brain sync` runs, then cloned on a
  second device
  Then the second device has the page; and a conflicting edit on both devices
  surfaces as a git conflict with instructions, never silent overwrite.
- Scenario: platform read API
  Given a synced brain
  When GET /api/v1/brains/:id/pages is called
  Then pages return with parsed frontmatter matching the local files.
- Scenario: iOS capture queues offline
  Given the iOS app offline
  When a note is captured
  Then it is committed locally and pushed on next connectivity without
  duplication.

## Constraints

- Sync is git. No bespoke merge logic anywhere in D1-D3.
- The platform is never the system of record: losing the hosted remote loses
  no data (every device has full history).
- D1 lives in cmd/gizzi-code (match its command conventions); D2 in
  cmd/allternit-api (new route module, auth like existing routes).
