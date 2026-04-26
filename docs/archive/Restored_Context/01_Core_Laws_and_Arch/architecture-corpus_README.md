# Architecture Corpus
**Location:** `Desktop/Allternit Workspace/Architecture/` (External to Repo)
**Status:** AUTHORITATIVE (v002)

This folder tracks the integration of the external Architecture Design Corpus.
The corpus itself is **NOT** checked into this repo to enforce separation of concerns:
- **Architecture Folder:** Design, Law, Direction (The "Why" and "What")
- **Code Repo:** Implementation, Execution, Verification (The "How")

## Rules
1. **Mandatory Reading:** No task in `docs/BACKLOG_EXECUTION.md` may be started without reading the corresponding source files in the corpus.
2. **Traceability:** Every major feature PR must cite the Architecture MD files that informed it.
3. **Conflict Resolution:** If code and architecture conflict, Architecture wins unless an ADR is filed.

## Trace Matrix
See `TRACE_MATRIX.md` for the mapping of Corpus Files -> Backlog Items.
