# Attestation — session/coworkp1-0914: Consumer-packaged Cowork Phase 3 "Finished deliverables"

- **Date:** 2026-09-14
- **Agent:** kimi (Kimi Code CLI), session `coworkp1-0914`
- **PR:** #512 — merged to main `94353732a27c02ab15f4aae504fb1757a92a1711` (owner-authorized)

## What was done

Agent-written markdown becomes finished office documents attached to the
canonical run:

- office-engine `POST /deliverable/render` — minimal-OOXML generators:
  report (.docx), sheet (.xlsx), deck (.pptx) from markdown (headings,
  bullets, code, tables). 4 new vitest; office-engine suite 30 passed.
- api `/cowork/runs/:id/deliverables[/:name]` — persist bytes under the data
  dir; registry = attributed `deliverable.created` run events (no
  migration); inline preview + content-disposition export; authz = run
  owner or same-workspace worker principal.
- agentic worker `deliverable` tool attaches documents mid-job under its
  principal bearer.
- FabricTransportView: Deliverables document cards above the attributed
  timeline (3.2).

## Latent P1 production bug found + fixed

The auth middleware rejected `atok_` principal tokens before they reached
the fabric routes — the managed worker could never authenticate in a
packaged non-bypass deployment. Fixed: pass-through to route-level
authentication; garbage tokens 403.

## Verification

43/43 runtime tests; office-engine 30 passed; api build + clippy clean;
gizzi/SPA/desktop typechecks clean; agentic 7/7; preflight 36/0.
Live (`tmp/p3-evidence/`): chat → weekly-summary.docx attached by the
worker → preview 200 + unzip content check → export attachment header;
authz matrix 200/403 verified without the dev bypass.

## Incidents

- Worker deliverable call initially 501'd (double `/api/v1` prefix in the
  worker path) — found by the demo, fixed.
- A SIGTERM'd demo worker finished its in-flight job then briefly claimed
  the next queued job before observing the stop flag (graceful-stop
  semantics are finish-in-flight-first, by design; the daemon manager's
  intentional stop is unaffected).

## Deferrals

- Per rebuild policy: no desktop rebuild after P3 (P2 build is current for
  everything except the api-side deliverable routes, which ship in the
  final rebuild after P5).
