# Agent scratchpad

The canonical Gizzi runtime gives every session a private, file-backed working area. Child agents under the same root session also share one explicit coordination area.

This is working state—not model chain-of-thought, project content, or long-term memory. It is intended for intermediate results, temporary scripts, structured notes, and deliberate subagent handoffs.

## Agent tools

- `scratchpad_list`: metadata-only listing of private and shared files.
- `scratchpad_read`: read one UTF-8 file by relative path.
- `scratchpad_write`: atomically replace one UTF-8 file by relative path.
- `scratchpad_remove`: remove one file; it cannot remove directories or project files.

Set `shared: true` only when sibling agents should consume the file. Shared contents are treated as untrusted peer input.

## Isolation and limits

- Private path: one scope per session.
- Shared path: one scope per top-level/root session tree.
- Paths must be relative and cannot traverse outside their scope.
- Symbolic-link files and directory escapes are rejected.
- Files are owner-only (`0600`); directories are owner-only (`0700`).
- Maximum file size: 1 MB.
- Maximum scope size: 20 MB and 1,000 files.
- Concurrent runtime writes are serialized and committed through a temporary-file rename.

The runtime stores scratchpads beneath its private data directory but does not expose those absolute paths to the model. Agents use only the scratchpad tools.

## Lifecycle and diagnostics

Scratchpads survive turns, compaction, daemon restarts, and child-agent execution. Deleting a child session removes its private scope. Deleting the root session removes the entire root container, including its shared scope.

Replay traces record relative path, scope, and byte counts for reads/writes/removals; they never record file contents. Support bundles include the same metadata and explicitly exclude contents.

Set `GIZZI_DISABLE_SCRATCHPAD=1` to hide the tools and prompt guidance without deleting existing files.

## HTTP contract

- `GET /v1/session/:sessionID/scratchpad`
- `GET /v1/session/:sessionID/scratchpad/file?path=...&shared=false`
- `PUT /v1/session/:sessionID/scratchpad/file`
- `DELETE /v1/session/:sessionID/scratchpad/file?path=...&shared=false`
