# Steering spec — M4: second brain as a first-class web surface section

<!-- From .pipeline/PROGRAM-meta-learning.md. M1+M2+M3 merged. D2 brain
     remotes + pages API in main (f1297f804). -->

## Requirements

- [ ] R1: WHEN a user opens ai.allternit.com, THE SYSTEM SHALL have a
  first-class "Brain" section (top-level nav item, not buried in a miniapp):
  a brains list from the platform (add `GET /api/v1/brains` list endpoint
  scoped to the authenticated user if D2 didn't ship one — check
  cmd/allternit-api brains routes first).
- [ ] R2: WHEN a brain is opened, THE SYSTEM SHALL render its pages via
  `GET /api/v1/brains/:id/pages`: markdown rendered, frontmatter shown as
  badges (type / status / domain / confidence), grouped by directory
  (decisions, runbooks, ideas, learnings).
- [ ] R3: WHEN the learnings directory is viewed, THE SYSTEM SHALL present it
  as the Learning Feed: lesson pages newest-first, stale lessons visually
  dimmed, provenance refs shown — the visible record of what the system has
  learned (M1/M3 output).
- [ ] R4: WHEN a user wants to fork a brain, THE SYSTEM SHALL show the
  brain's clone URL with a copy action (fork = git clone; D2 clone_url).

## Acceptance (Gherkin)

- Scenario: brain section with real data
  Given the dev API serving a brain with pages
  When the Brain section loads
  Then pages render grouped by directory with frontmatter badges, and the
  clone URL is copyable.
- Scenario: learning feed
  Given learnings/ pages with one stale lesson
  When the Learning Feed loads
  Then the stale lesson is dimmed and provenance refs are visible.
- Scenario: empty state
  Given no brains
  When the section loads
  Then it shows how to create one (gizzi brain init / POST /api/v1/brains).

## Constraints

- Read-only surface (no page editing in this phase).
- Follow the surface's existing conventions (routes/views, its markdown
  renderer if one exists, design system).
- Auth follows the existing Clerk/APIClient path.
