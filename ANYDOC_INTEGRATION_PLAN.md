# anydoc → Allternit Integration Plan

Firecrawl's [anydoc](https://github.com/firecrawl/anydoc) (MIT, Rust core + napi prebuilds, zero external converters) converts Word/PowerPoint/Excel/OpenDocument/RTF/EPUB/CSV/PDF bytes to clean GFM Markdown. This plan adds a single **"Open as Markdown"** capability across the platform, backend-first with thin surfaces.

This supersedes an earlier draft plan. Corrections applied:

1. **Pin the dependency exactly.** anydoc is 0.1.x and days old; `@firecrawl/anydoc` is pinned (`0.1.6`, no `^`), and `THIRD_PARTY_NOTICES.md` gets the MIT attribution.
2. **The gateway proxy is a first-class Phase 1 step**, not an afterthought — both mounts (`/api/office/markdown` and `/api/v1/office/engines/markdown`) go into `cmd/allternit-api/src/office_engine_routes.rs` in the same phase, and the gateway binary must be rebuilt/restarted (the running 8013 process predates new routes).
3. **No fifth "markdown" editor card.** The suite cards map to real editors; a conversion target is not an editor. Instead, file-open routing gains a markdown target for formats no editor owns (legacy `.doc/.ppt/.xls`, ODF, `.rtf`, `.epub`, `.csv`), and editor-owned formats keep opening in their editors.
4. **Artifact-native output.** Conversion results persist as Allternit artifacts (markdown section), so agents and the iOS read-only viewer get converted documents through the **existing** artifact channel — the other plan's bespoke iOS picker + API client is unnecessary for v1.
5. **Shell-first desktop.** Markdown preview opens as an ACI shell view; dedicated windows only via file association, per the desktop office model.

## Phase 1 — Backend + gateway (prerequisite for everything) — **DONE**

Evidence: `services/office-engine` vitest 24/24 green (incl. `tests/markdown.test.ts`), `cargo check -p allternit-api` green, `POST :8099/markdown` converts a CSV to a GFM table; running gateway binary on :8013 still predates the new proxy routes (rebuild/restart pending).

- `services/office-engine`: add `@firecrawl/anydoc` (exact `0.1.6`); new `src/markdown.ts` (`convertToMarkdown(bytes, filename)` → `{ markdown, format, title? }`, anydoc error codes mapped to stable `{code, message}`); `POST /markdown` (raw body + `x-office-filename`, mirrors `/extract`; 400 empty, 415 unsupported, 422 conversion failure); `/health` reports anydoc availability + version. Tests: fixture `.docx`/`.pdf`/`.csv` convert to non-empty GFM; unsupported → 415; encrypted → mapped error.
- `cmd/allternit-api/src/office_engine_routes.rs`: proxy `/office/markdown` on both mounts. `cargo check` green. Rebuild + restart note for the running gateway.
- Not changed: `/extract` stays as-is (plain text); `/markdown` is the LLM-ready GFM sibling.

## Phase 2 — Web surface — **DONE**

Evidence: `tests/office-markdown.spec.ts` 3/3 green (.rtf → preview, .docx routing not hijacked, save-as-artifact payload asserted); office-launcher spec green; surface tsc has no new errors.

- `MarkdownPreviewView` (new shell view + `/markdown-preview` route): renders converted GFM with the platform Markdown renderer; header shows filename + format badge; actions: copy, download `.md`, **Save as artifact** (default-on when opened from a file handoff).
- `OfficeSuiteSection`/`file-handoff`: extend `accept` with the anydoc extension set; `ROUTE_BY_EXT` gains markdown-target entries for `.doc .docm .ppt .pps .pot .pptm .ppsx .ppsm .xls .xlsm .xlsb .odt .ods .odp .rtf .epub .csv` (formats with no editor). Those open the preview view (shell view via `openView`, route fallback otherwise); conversion POSTs to `/api/office/markdown`.
- Error UX: unsupported/encrypted/oversized files surface the mapped error in the preview view, not a silent failure.
- Tests: launcher hands a `.rtf`/`.csv` to the markdown preview; a `.docx` still goes to Allternit Docs (routing not hijacked); save-as-artifact posts the expected section.

## Phase 2b — Web: URL → Markdown ("the other half", decided) — **DONE**

Evidence: engine vitest 30/30 green incl. `tests/markdown-url.test.ts` (local node:http fixture server: HTML → GFM without nav/footer junk, document content-type passes through anydoc, private/loopback → 400, non-200 upstream → 422); `cargo check -p allternit-api` green; Playwright office-markdown + office-launcher 7/7 green incl. the mocked `markdown-url` empty-state flow; surface tsc clean apart from the known pre-existing set.

anydoc is documents-only (no HTML/URLs by design). Rather than vendoring Firecrawl's self-host stack (AGPL-3.0 + 7-service Redis/RabbitMQ/Playwright compose — rejected: copyleft on network deployment and heavy ops for a local-first platform), the URL half is a **native endpoint in office-engine**: `POST /markdown-url` (`{url}` JSON) fetches the page server-side with SSRF guards (http/https only, private/loopback hosts blocked, redirect + size caps, timeout), extracts main content with `@mozilla/readability` (Apache-2.0), converts to GFM with `turndown` (MIT). Document content-types at a URL (pdf/docx/…) are passed through to the anydoc byte path — one endpoint for anything. Gateway proxy on both mounts. Preview view gains a URL input (empty state + launcher affordance). Optional Firecrawl hosted provider for JS-heavy/anti-bot pages is a later, config-gated enhancement.

## Phase 3 — Desktop — **DONE**

Evidence: `office-programs.test.ts` covers .rtf/.csv/.doc/.ppt/.xls/.odt/.epub → `markdown` and editor-owned formats unchanged; full `@allternit/desktop` vitest suite 94/94 green. Desktop e2e not run (Electron single-instance lock risk), per instructions.

- `office-programs.ts`: `markdown` target; `editorForFile` maps the anydoc-only extensions to it. File-association open of e.g. an `.rtf` lands in the preview (shell view when the main window is up; dedicated window otherwise).
- Unit tests for the routing table.

## Phase 4 — Extensions (Office add-in) — **DONE**

Evidence: `markdown-conversion.test.ts` 5/5 green (endpoint/headers/error mapping), add-in `tsc --noEmit` clean, full add-in vitest suite 132/132 green.

- Taskpane: "View as Markdown" on the connected-document panel; `Document.getFileAsync` bytes → `POST /api/v1/office/engines/markdown` → read-only panel + "Open in platform" link.

## Phase 5 — Mobile (iOS) — **NO-OP for v1 (intentional)**

Artifact channel covers it: converted documents saved as artifacts render in `OfficeDocumentView` via plaintext sections. No code changed.

- v1: nothing new — converted documents saved as artifacts already render in `OfficeDocumentView` via plaintext sections. Only if needed: an explicit "Convert to Markdown" action on the document list calling the v1 endpoint.

## Phase 6 — Docs surface — **DONE**

Evidence: `surfaces/docs/surfaces/anydoc.mdx` added and registered in the Surfaces group of `surfaces/docs/docs.json` (JSON validated); MIT attribution shipped in Phase 1.

- `surfaces/docs`: anydoc page (what it does, format table, per-surface usage) + nav entry. Also add the MIT attribution to `THIRD_PARTY_NOTICES.md` in Phase 1.

## Known anydoc limits (accepted, documented)

- No OCR (scanned PDFs → `unsupported`), no HTML/image input, encrypted files rejected, non-configurable resource caps (512 MiB decompressed), pre-1.0 API drift risk (pinned, upstream tracked in `upstream/sources.yaml` style).

## Verification

- `services/office-engine` test suite green with the new markdown tests.
- Gateway `cargo check` green; `/api/office/markdown` proxies after rebuild.
- Platform Playwright: office specs green including new markdown-preview specs.
- Manual smoke: `.docx`, `.xlsx`, `.pptx`, `.pdf`, `.rtf`, `.csv` through the launcher.
