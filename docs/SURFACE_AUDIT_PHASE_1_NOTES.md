---
status: done
files_changed:
  - docs/SURFACE_AUDIT_PHASE_1_MATRIX.md
deviations:
  - "Row granularity: several Web bullets in the source inventory bundle multiple distinct registered views into one line (e.g. \"Cowork Runs/Drafts/Tasks/Cron/Project/Documents/Tables/Files/Exports views\", \"H5I panels (Agent Hooks/Audit/Commit/Context/Diff/MCP)\", Design Mode's 7 named tabs, the DAG suite's ~15 named sub-panels). Where the source text itself signals these are individually registered (\"each is its own registered view\", \"registered individually\", \"3 registered routes\") or lists distinctly named sub-panels, I gave each its own row instead of collapsing the bullet — this is why the matrix has 171 rows rather than landing closer to the doc's rough ~150 estimate. This was a deliberate choice toward more exhaustiveness, not less; nothing was dropped."
  - "Settings sub-sections were consolidated to the 6 top-level categories (Account, Platform, Products, Infrastructure, Customize, About) rather than all 29 individual leaf sections listed in the source inventory. Splitting to all 29 would have pushed the table past 190 rows and, unlike the DAG/Cowork/Design sub-panels (each independently interesting), most Settings leaves within a category share the same classification and reasoning — the category-level row captures that without just repeating near-identical rows 29 times. Each category row's Note names which specific leaf sections are present/thin/absent where that varied within the category (e.g. Account: Sign-in/Usage present on iOS, Org Access/Billing absent)."
  - "Where an item recurred verbatim in two places in the source inventory (Enterprise BYOC panel appears under both Terminal/Runtime/Infra and Onboarding & Account's Settings breakdown; several Desktop-only-list items are implementation detail of a feature already covered earlier, e.g. the Chrome-extension bridge duplicates \"Browser Extensions manager\"), both rows were kept rather than silently merged, with the Note on the later occurrence pointing back to the first. This preserves the 1-row-per-inventory-bullet contract even when the underlying feature is genuinely the same."
  - "For the DAG suite specifically, per the phase task's explicit guidance, INTENTIONALLY SURFACE-SPECIFIC was used for the iOS side of the comparison alone (the section's own text calls itself \"engineering/debug-facing\") while gizzi-code was checked independently on each item's technical merits — this surfaced several real GAPs (Ontology Viewer, Directive Compiler, GC Agents, Receipts Viewer, Security Dashboard, Purpose Binding, Evolution Layer, Context Control Plane, Multimodal Input testing, UI Forge, H5I Context/Audit) where gizzi-code has no equivalent despite being a plausible fit, rather than waving the whole section through as internal tooling."
  - "The rubric text defines GAP as \"exists on exactly one surface.\" In practice several items exist on two of the three surfaces (e.g. web + iOS, missing only from gizzi-code, or web + gizzi-code, missing only from iOS) with no defensible reason for the third surface's absence. I classified these as GAP as well, since the rubric's own instruction (\"state which surface(s) it's missing from\") is plural and the alternative — forcing every 2-of-3 case into PARTIAL, which is defined as \"thinner somewhere\" rather than \"absent somewhere\" — would misrepresent items that are fully absent from one surface, not just thin. This is a interpretation call, not a rubric violation; flagging it explicitly in case a stricter reading is wanted."
remaining:
  - "Dispatch (Core Chat/Home): can't confirm from the inventory alone whether iOS implements a Dispatch-receiving flow — marked UNCLEAR."
  - "Archived and Search (Core Chat/Home): can't tell from either inventory whether iOS/gizzi-code have a distinct archived-session state or a global (not just Projects-scoped) search — both marked UNCLEAR."
  - "IVKGE Panel (DAG suite): description too vague (\"knowledge-graph-adjacent panel\") to confidently classify against brain/vault — marked UNCLEAR."
  - "Jobs (Mail/Knowledge): unimplemented on web itself (empty stub), so there's nothing concrete to cross-reference yet — marked UNCLEAR pending actual product scoping."
  - "Model Management view (Onboarding & Account): iOS's \"Capabilities\" Settings section might cover this but isn't detailed enough in the inventory to confirm — leaned PARTIAL given gizzi-code's strong `models`/`provider` match, but the iOS side specifically is UNCLEAR."
---

## Summary

Went through every item in RAW INVENTORY 1 (Web/Desktop) in
`docs/SURFACE_AUDIT_MAP.md`, section by section, top to bottom, and
cross-referenced each against RAW INVENTORY 2 (iOS) and RAW INVENTORY 3
(gizzi-code) in the same doc. No sections were skipped, including the
ones that look purely internal/engineering-facing (DAG suite,
runtime-ops, AllternitOS, Playground/QA) — those got the same
item-by-item treatment as Chat and Cowork.

**Row count: 171** in `docs/SURFACE_AUDIT_PHASE_1_MATRIX.md`, confirmed by
counting table rows (16 section tables × 1 header + 171 data rows = 187
total `|`-prefixed lines, 16 of which are headers). This is higher than
the task doc's rough "~150" estimate, not lower — see the `deviations`
entries above for exactly what was split out and why (mainly: Cowork's 9
sub-views, Design Mode's 7 named tabs, the DAG suite's ~15 named
sub-panels, and H5I's 6 named panels were each given their own row
because the source text itself describes them as individually
registered/named, not because I invented new items). The one place row
count was *reduced* relative to maximum possible granularity is Settings,
where 29 leaf sections were consolidated to 6 category rows — explained
above.

## Notable findings worth a human's attention

- **Web/desktop's own "mesh" implementation is an empty stub, while iOS
  has a real, working Mesh/tailnet feature.** This inverts the usual
  "iOS is behind" assumption and is worth flagging on its own — the
  cross-surface audit exists partly to catch exactly this kind of
  surprise.
- **The DAG suite has several real gaps on the gizzi-code side**, not
  just the "obviously fine to skip on mobile" pattern the earlier
  judgment-based skim assumed: Ontology Viewer, Directive Compiler, GC
  Agents, Receipts Viewer, Security Dashboard, Purpose Binding, Evolution
  Layer, Context Control Plane, and the H5I Audit/Context panels have no
  CLI-side equivalent despite several of them (audit receipts,
  self-improvement, context control) being exactly the kind of capability
  a "brain" CLI would plausibly want.
- **Changeset Review** is a concrete, actionable GAP: iOS can start an
  agentic coding session but the inventory shows no way to review/approve
  a diff before it's applied, while gizzi-code has this via cowork
  approvals and web has a dedicated review UI.
- **Local runtime discovery** was the one item in the Desktop-only list
  that the phase task explicitly asked to double-check before assuming
  no overlap — it does overlap: gizzi-code's `runtime` command is a real,
  named equivalent to the desktop Electron-bridge discovery mechanism,
  reclassified from what would otherwise have been an automatic
  INTENTIONALLY SURFACE-SPECIFIC.

## Items flagged UNCLEAR (see `remaining` above for the full list with reasoning)

Dispatch, Archived, Search, IVKGE Panel, Jobs, and the iOS side of Model
Management — six items total where the inventory descriptions don't give
enough to classify confidently one way or the other without reading the
actual code.

Made no code changes anywhere, per the phase task's scope. Did not touch
iOS-only or gizzi-code-only items — that's explicitly Phase 2's job,
which reads this matrix and adds what's missing from it. Did not start
Phase 2.
