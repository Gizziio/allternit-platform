# GenOffice Phase 5 — OS Program Packaging: Decision Record

**Date:** 2026-08-04
**Status:** Blocked-with-reason (precondition not met) — revisit when the contract spine lands
**Decided by:** Phase 5 precondition evaluation against the master integration plan

## Precondition

The master plan (`GENOFFICE_INTEGRATION_PLAN.md` §Phase 5) gates OS program
packaging on:

> The AllternitOS `Workload`/`Capability`/`Lease`/`Receipt` contract spine
> (ADR-002 through ADR-012) must be ratified. If it is not, keep the program
> integration internal and do not claim OS program status.

## Evidence (checked 2026-08-04)

- `docs/Core_System/00-Strategy/ALLTERNIT_OS_LIVING_ROADMAP.md:337` lists
  "Create ADR-001 through ADR-012" as an outstanding task; the ADR table shows
  ADR-002 in status **investigation** and ADR-012 in status **recommended**.
- The same roadmap's capability register (`:549`) records
  **"Contract spine | not started | v1 schemas and bindings"**.
- `docs/Core_System/00-Strategy/ALLTERNIT_OS_GAP_AND_TRACEABILITY_REGISTER.md:33`
  confirms "no ratified language-neutral OS protocol and canonical object
  state machines".

**Conclusion: the contract spine is not ratified.** Shipping a "Documents and
Office OS program package" now would claim a conformance the platform cannot
verify.

## Decision

Do **not** package Documents and Office as an AllternitOS program. The
integration stays internal: all office surfaces ship as ordinary platform
routes, desktop program windows, and the office-engine sidecar — none of
which require OS program status.

## What is already in place (would feed a future program package)

- Engines: `packages/@allternit/office-{docx,pptx,pptx-render,file-parse,xlsx}-engine`
  (Apache-2.0 attribution, upstream pinned in `upstream/sources.yaml`).
- Backend: `services/office-engine` behind the gateway at `/api/office/*` and
  `/api/v1/office/engines/*`; desktop-managed sidecar lifecycle.
- Surfaces: `/docs`, `/sheets`, `/slides`, `/pdf`, `/office` on the platform;
  desktop office program windows with file associations; iOS read-only viewer.
- Data model: Allternit artifacts (sections + revisions) as the only
  persistence layer — already compatible with a future `Artifact` contract.
- Binding schema: `OfficeBinding` / `OfficeRuntimeSession` (zod) in the
  add-in, designed to map onto workspace/session contracts.

## Revisit criteria (when to reopen Phase 5)

1. ADR-002 (contract schema) and the ADR-003…ADR-012 spine are ratified, with
   v1 schemas for `Workload`, `Capability`, `Lease`, `Receipt`, `Artifact`,
   `Approval`, `Event` available in-repo.
2. A conformance harness exists to prove program participation.
3. Then: author the Documents and Office program manifest (capabilities:
   `office.docx` / `office.xlsx` / `office.pptx` / `office.pdf`; surfaces:
   web routes, desktop windows, iOS viewer; sidecar: office-engine), map
   engine operations to artifact/receipt flows, and add conformance tests
   (round-trip fidelity, cross-surface artifact sync, add-in security).

## Risk of deferral

Low. No user-facing capability is gated on OS program status; the deferral
only postpones install/update/remove packaging of the program as a unit.
