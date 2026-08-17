# Steering checkpoint

## Goal
Implement the approved Allternit Office Suite standalone plan: create `@allternit/allternit-office-suite`, refactor the four office apps and Sign to use an injectable `OfficeHost` contract, decouple `@allternit/office-ai` and the xlsx engine from platform endpoints, and build `surfaces/office.allternit.com` as a standalone host. Platform (`surfaces/ai.allternit.com`) remains the primary entry point.

## Milestones
- [x] **Milestone 1**: Scaffold `@allternit/allternit-office-suite` with `OfficeHost`, `OfficeAiClient`, `XlsxEngineHost`, `OfficeStorageProvider`, bridge context, and theme.
- [x] **Milestone 2**: Wrap Docs/Sheets/Slides/PDF with host-aware adapters; platform views provide a browser host that overrides `saveFile` with artifact persistence.
- [ ] **Milestone 3**: Decouple `@allternit/office-ai` and the xlsx engine from platform endpoints via the host contract.
- [ ] **Milestone 4**: Extract Allternit Sign into the suite and normalize its UI palette.
- [ ] **Milestone 5**: Build `surfaces/office.allternit.com` standalone host.
- [ ] **Milestone 6**: Verification, tests, and documentation.

## Just did
- Milestone 2:
  - Added `DocsApp`, `SheetsApp`, `SlidesApp`, `PdfApp` adapters in the suite package.
  - Added `createBrowserHost` helper for standalone surfaces.
  - Updated platform views (`DocsView`, `SheetsView`, `SlidesView`, `PdfView`) to use `OfficeHostProvider`.
  - Added ambient declaration for `harfbuzzjs/hb.js` so the suite package typechecks cleanly.
  - Verified suite and platform surface typechecks pass.

## Next
- **Milestone 4** (Sign extraction): move the native signing UI/utilities into the suite package as a host-aware `SignApp`, normalize its palette to match the office apps, and update the platform view to use it.
- Return to **Milestone 3** once Sign is extracted, because it requires deeper changes to the vendored app bridges.

## Open questions
- Should the standalone Sheets host implement a client-side recalc engine, or gracefully degrade to the simpler `@allternit/office-sheets-editor`?
- Should the standalone AI host default to Ollama, a no-op, or a lightweight built-in LLM stub?
