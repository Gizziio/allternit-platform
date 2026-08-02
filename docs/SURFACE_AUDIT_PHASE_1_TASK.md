# Phase 1 — Cross-reference every Web/Desktop item

Read `docs/SURFACE_AUDIT_MAP.md` in full first — it has the classification
rubric and all three raw inventories. Also read `GIZZI.md` at the repo
root for the authoritative surfaces framework. This phase makes NO code
changes anywhere — it is a research/documentation task only.

## Scope

Go through **every single item** in "RAW INVENTORY 1 — Web/Desktop" in the
map doc, top to bottom, section by section (Core Chat/Home, Cowork, Code,
ACI/Browser, Design/Creative, Terminal/Runtime/Infra, DAG suite,
Marketplace/Plugins, Products/Discovery, Mail/Knowledge, Onboarding/
Account, Voice/Local Models, AllternitOS, Playground/Verification/QA,
empty stubs, and the explicit Desktop-only list at the end). That is
approximately 150 items across ~15 sections — do not skip any section,
including ones that look purely internal/engineering-facing (DAG suite,
runtime-ops, AllternitOS). The whole point of this pass is exhaustiveness.

For each item, check it against RAW INVENTORY 2 (iOS) and RAW INVENTORY 3
(gizzi-code) in the same map doc, and classify per the rubric already
defined there: FULL PARITY / PARTIAL / GAP / INTENTIONALLY
SURFACE-SPECIFIC / UNCLEAR — NEEDS CODE-LEVEL CHECK.

Some guidance on applying the rubric to this specific list, since a few
patterns repeat a lot:

- Items already listed in the Web inventory's own "Desktop-only /
  platform-specific" section at the bottom: these are Electron-bridge
  features. For each, classify as INTENTIONALLY SURFACE-SPECIFIC with the
  reason given there (native filesystem access, computer-use OS control,
  etc.) — UNLESS the underlying capability conceptually also exists via a
  completely different mechanism on iOS or gizzi-code (e.g. "local runtime
  discovery" the desktop preload bridge does might have a gizzi-code CLI
  equivalent via its `runtime` command — check before assuming no overlap).
- Large internal-engineering subsystems (DAG suite: Policy Manager,
  Ontology Viewer, Directive Compiler, Evaluation Harness, Receipts Viewer,
  Security Dashboard, Purpose Binding, Checkpointing, Observability
  Dashboard, IVKGE Panel, UI Forge, etc.; Runner/DAK; H5I panels) — do NOT
  assume these are "obviously engineering-only, skip." Check specifically
  whether gizzi-code has ANY equivalent capability (it has its own
  permissions system, verification command, hooks system, cost tracking —
  some of these DAG-suite panels may directly correspond to a gizzi-code
  CLI capability that has zero platform UI on iOS, which would make it a
  real GAP worth surfacing, not something to wave through as "internal
  tooling."). Classify honestly based on what you actually find.
- Where the web item's own description already says something is
  "engineering/debug-facing rather than mainstream end-user" (the DAG
  suite's own summary line says this) — you may use INTENTIONALLY
  SURFACE-SPECIFIC for the *iOS* comparison specifically (a debug dashboard
  plausibly doesn't belong on a phone), but you must still separately check
  the *gizzi-code* comparison on its own merits (a technical/engineering
  capability is exactly the kind of thing that plausibly SHOULD have a CLI
  equivalent, even if it shouldn't have a mobile one) — don't let one
  surface's N/A reasoning bleed into the other surface's classification.

## Output

Write `docs/SURFACE_AUDIT_PHASE_1_MATRIX.md` — a markdown table, one row
per web item, columns: `Item | Section | iOS | gizzi-code | Classification
| Note`. Keep the Note column to one sentence. Preserve the original
section groupings as table sub-headers so it stays readable at ~150 rows.

Do not attempt to also process the iOS-only or gizzi-code-only items in
this phase — that's Phase 2, which will read your matrix and add what's
missing from it. Do NOT start Phase 2.

## Deliverable

When finished, write `docs/SURFACE_AUDIT_PHASE_1_NOTES.md` starting with
YAML frontmatter — `status: done|blocked`, `files_changed: [paths]`,
`deviations: [what + why]`, `remaining: [items]` — then prose notes:
confirm the exact row count of your matrix (should be close to the ~150
web items — if it's meaningfully lower, explain what you consolidated and
why, since silent dropping is exactly the failure mode this audit exists
to avoid), and call out anything you classified UNCLEAR that a human
should resolve. That file existing = phase done.
