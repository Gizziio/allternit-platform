# Swarm E — Phase 8 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-e`  
**Branch:** `ao/p8-e`  
**Base:** `parity/swarm-sprint`

## Goal
Add a session-scoped file store API for agent files.

## Deliverables

1. **Agent files API**
   - Add `session_files` table with `id`, `session_id`, `org_id`, `filename`, `mime_type`, `storage_path`, `size_bytes`, `created_at`.
   - Add migration `V66__session_files.sql`.
   - Add `POST /beta/sessions/:id/files`, `GET /beta/sessions/:id/files`, `GET /beta/sessions/:id/files/:file_id`, `DELETE /beta/sessions/:id/files/:file_id`.
   - Store file content on disk under `.allternit/session-files/` (or SQLite blob for small files).

2. **Integration with messages**
   - Allow `file_id` references in `PdfContentBlock` and `VisionContentBlock` to resolve against session files.
   - In `toAnthropicRequest`/`toOpenAIRequest`, load file content when a `file_id` is referenced.

3. **Tests**
   - Add Rust tests for file CRUD and retrieval.

## Validation
- `cargo check -p allternit-api` — pass
- `cargo test -p allternit-api --lib` — pass

## Commit
Commit on `ao/p8-e` with message: `feat(p8): Swarm E session-scoped agent file store`.
