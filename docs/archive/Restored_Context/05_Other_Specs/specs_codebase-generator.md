# Codebase Generator Spec (P0100)

## Objective
Automatically generate `CODEBASE.md` to provide LLM agents with an up-to-date, high-level map of the repository.

## Requirements
1.  **Deterministic**: Output must be stable for git diffs.
2.  **Ignored Paths**: Respect `.gitignore` and `.allternitignore`.
3.  **Structure**:
    *   Directory Tree (max depth 3)
    *   Key File Content (READMEs, package.json)
    *   Architecture definitions (from .allternit/graphs)

## Implementation Plan
*   **Script**: `bin/generate-codebase-md` (Python)
*   **Trigger**: Pre-commit hook or manual `make codebase`
*   **Output**: Root `CODEBASE.md`

