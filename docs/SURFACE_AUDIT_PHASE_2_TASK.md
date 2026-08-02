# Phase 2 — Cover remaining iOS/gizzi-code items, then final report

Read `docs/SURFACE_AUDIT_MAP.md` and `docs/SURFACE_AUDIT_PHASE_1_MATRIX.md`
in full first. Phase 1 is reviewed and approved — 171 rows, one per
Web/Desktop inventory item, each cross-referenced against iOS and
gizzi-code. This phase is scoped to: (1) find any iOS or gizzi-code item
NOT already captured by a Phase-1 row, classify those, then (2) produce
the final combined report. No code changes anywhere.

## Step 1 — find what Phase 1 didn't cover

Phase 1 worked from the Web/Desktop inventory outward. That means an item
that's genuinely iOS-only or gizzi-code-only — with no Web/Desktop
equivalent at all — would never have gotten a row, since nothing in the
Web list would have triggered checking for it.

Go through RAW INVENTORY 2 (iOS) in the map doc, item by item, and check:
is this iOS item already represented by some row in
`SURFACE_AUDIT_PHASE_1_MATRIX.md` (even if that row's Web-side description
uses different words for the same concept — e.g. Phase 1's "Artifacts
Library" row covers iOS's "Artifacts Library" even though they're phrased
identically, that's already covered; but if an iOS item has literally no
corresponding Web-side row at all, it's uncovered). List every iOS item
that is NOT covered by any existing row.

Do the same for RAW INVENTORY 3 (gizzi-code) — go through every command,
plugin/skill, and runtime subsystem listed, and check whether it's already
represented in a Phase-1 row (many will be, via the "gizzi-code" column of
existing rows). List every gizzi-code item that is NOT covered.

For each newly-found uncovered item, classify it using the exact same
rubric from the map doc (FULL PARITY / PARTIAL / GAP / INTENTIONALLY
SURFACE-SPECIFIC / UNCLEAR), checking it against the OTHER two surfaces
the same way Phase 1 did. Expect this list to be short — most iOS and
gizzi-code items should already be captured via their appearance in
Phase 1's iOS/gizzi-code columns — but do not skip this step or assume
it's empty without actually checking every item.

## Step 2 — final combined report

Write `docs/SURFACE_AUDIT_FINAL_REPORT.md`:

1. **Full matrix**: Phase 1's 171 rows plus Step 1's newly-found rows,
   combined into one document, same table format, organized by domain
   (keep Phase 1's section groupings; add a new section for Step 1's
   iOS-only/gizzi-code-only additions).
2. **Summary statistics**: total item count, count per classification
   (how many FULL PARITY / PARTIAL / GAP / INTENTIONALLY SURFACE-SPECIFIC
   / UNCLEAR).
3. **Prioritized GAP list**: every item classified GAP, pulled out into
   its own list, grouped by "what a real user/team would actually care
   about" — roughly: (a) core product features a user would notice missing
   day-to-day, (b) capabilities engineers/power-users would want, (c)
   lower-priority/edge-case gaps. Use judgment on grouping, but the point
   is a human reading just this section should be able to tell what to
   actually act on first, not read all ~180 rows to figure that out.
4. **UNCLEAR items**: pulled into their own short list with what would
   need to be checked to resolve each one (a specific file/command to
   read), so a human or a future agent can close them out quickly.

## Deliverable

When finished, write `docs/SURFACE_AUDIT_PHASE_2_NOTES.md` with the same
YAML frontmatter contract as Phase 1, then prose confirming: how many new
rows Step 1 added (and which surface(s) they came from), the final total
row count, and the GAP count in the prioritized summary. That file
existing = phase done. This is the last phase.
