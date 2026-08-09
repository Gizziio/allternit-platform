# Swarm C — Phase 6 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-c`  
**Branch:** `ao/p6-c`  
**Base:** `parity/swarm-sprint`

## Goal
Build and register a `PdfSkill` for document processing.

## Deliverables

1. **PdfSkill implementation**
   - Create `sdk/allternit-sdk/src/ai-runtime/skills/pdf-skill.ts` (or equivalent path in the existing skill system).
   - The skill accepts a PDF source (base64, URL, or file path) and returns:
     - Extracted markdown text
     - Per-page image thumbnails (optional, base64)
     - Detected document structure (headings, tables if feasible)
   - Use `pdf-parse` or a workspace-available PDF parser. If none is available, use the same extraction utility Swarm A creates.

2. **Skill registration**
   - Register `PdfSkill` in the native Tool Belt / skill registry alongside `web_search` and `web_fetch`.
   - Expose it as a tool named `pdf_process` with JSON schema input.

3. **Tests**
   - Add a test that runs `pdf_process` against a small base64-encoded PDF fixture and verifies markdown output length > 0.
   - Add a test for invalid input handling.

## Validation
- `bun test sdk/allternit-sdk/src/ai-runtime/__tests__/tool-belt.test.ts` — pass
- `cargo check -p allternit-api` — pass

## Commit
Commit on `ao/p6-c` with message: `feat(p6): Swarm C PdfSkill for document processing`.
