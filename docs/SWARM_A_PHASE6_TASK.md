# Swarm A — Phase 6 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-a`  
**Branch:** `ao/p6-a`  
**Base:** `parity/swarm-sprint`

## Goal
Add native PDF content block support to the harness message schema and provider adapters.

## Deliverables

1. **PDF content block type**
   - Add `PdfContentBlock` to `sdk/allternit-sdk/src/ai-runtime/harness/types.ts` with fields: `type: 'pdf'`, `source: 'base64' | 'url' | 'file_id'`, `data?: string`, `url?: string`, `fileId?: string`, `title?: string`.
   - Allow `Message.content` to include `PdfContentBlock`.

2. **PDF text/image extraction**
   - Add a utility module `sdk/allternit-sdk/src/ai-runtime/harness/pdf.ts` that extracts text from base64 PDFs using a lightweight parser (e.g. `pdf-parse` if available in workspace, otherwise use a regex/text extraction fallback or a new minimal dependency).
   - For providers that do not support PDF natively, flatten PDFs to extracted text + image references.

3. **Provider adapters**
   - In `toAnthropicRequest`, map `PdfContentBlock` to Anthropic's `document` content block type when source is `base64`; otherwise flatten to text.
   - In `toOpenAIRequest`, flatten PDF blocks to text (OpenAI does not natively accept PDF in chat completions as of this phase).
   - Update `provider-request.test.ts` with tests for both mappings.

4. **API file-ID support**
   - Add `POST /v1/files` and `GET /v1/files/:id` endpoints in `cmd/allternit-api` for PDF upload/retrieval, storing in SQLite with a `files` table.
   - Add migration `V59__files.sql`.

5. **Docs**
   - Update `docs/public/providers/parity-matrix.md` PDF row to DONE.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass
- `bun test sdk/allternit-sdk/src/ai-runtime/harness/__tests__` — pass

## Commit
Commit on `ao/p6-a` with message: `feat(p6): Swarm A native PDF content blocks and file API`.
