# History persistence

`gizzi-code` keeps local conversation history so you can replay prompts, resume
past sessions, and review what happened in a thread. This page explains what is
stored, where it lives, how to disable or clear it, and how it relates to
Allternit platform sessions.

## What is persisted

Two kinds of history are written locally:

| Kind | Purpose | Example use |
| ---- | ------- | ----------- |
| **Session transcripts** | Full turn-by-turn JSONL records for each session | `/resume`, `--resume`, session search |
| **Prompt history** | Global, append-only log of submitted prompts | Up-arrow recall, `Ctrl+R` prompt search |

Session transcripts include user and assistant messages, tool calls, tool
outputs, file snapshots, and metadata such as the session ID and project root.
Prompt history stores the display text, timestamp, project path, and session ID.
Large pasted content may be stored by reference in a separate paste store.

## Where history is stored

All local history lives under `GIZZI_HOME`. If `GIZZI_HOME` is not set, the
default is:

- macOS / Linux: `~/.gizzi`
- Windows: `%USERPROFILE%\.gizzi`

### Session transcripts

Each project gets its own directory derived from the directory you started
`gizzi` in:

```text
$GIZZI_HOME/projects/<project-root>/<session-id>.jsonl
```

For example, a session started in `~/src/my-app` is stored separately from one
started in `~/src/other-app`.

### Prompt history

The global prompt log is a single append-only file:

```text
$GIZZI_HOME/history.jsonl
```

## Disabling history persistence

### Disable prompt history only

Set `GIZZI_SKIP_PROMPT_HISTORY` before starting `gizzi-code`:

```bash
export GIZZI_SKIP_PROMPT_HISTORY=1
gizzi
```

When this is set, new prompts are not appended to `history.jsonl`. Existing
entries are not removed.

### Disable session persistence entirely

Set `cleanupPeriodDays` to `0`:

```bash
gizzi config set cleanupPeriodDays 0
```

With `cleanupPeriodDays = 0`, `gizzi-code` does not write session transcripts to
disk and removes existing transcripts at startup. This also disables `/resume`
and `--resume` for past sessions.

For a one-off non-interactive run, use `--no-session-persistence` with
`--print`:

```bash
gizzi exec --print --no-session-persistence "summarize README.md"
```

This keeps the session out of `$GIZZI_HOME/projects` without changing your
global settings.

## Clearing history

### Clear the global prompt history

```bash
rm ~/.gizzi/history.jsonl
```

`gizzi-code` recreates the file on the next prompt if prompt history is enabled.

### Clear session transcripts for one project

```bash
rm ~/.gizzi/projects/<project-root>/*.jsonl
```

Deleting a session's `.jsonl` file removes the local transcript used by
`/resume` for that session.

### Clear all local history

```bash
rm -rf ~/.gizzi/projects ~/.gizzi/history.jsonl
```

This removes every local session transcript and the global prompt log. It does
not affect remote sessions stored on the Allternit platform.

## Managing retention and disk usage

By default, session transcripts are retained for 30 days. You can change the
retention window with `cleanupPeriodDays`:

```bash
# Keep transcripts for 7 days
gizzi config set cleanupPeriodDays 7
```

A background cleanup task removes transcripts older than the configured window.
Set it to `0` to disable persistence entirely, or to a larger number to keep
sessions available for resume longer.

## Platform session and thread model

Local history in `gizzi-code` complements, but is separate from, Allternit
platform sessions:

- **Local sessions** map to files on disk (`<session-id>.jsonl`). They power
  `/resume`, offline replay, and the local prompt picker.
- **Platform sessions** are managed through the Allternit Sessions API. When you
  are authenticated, the platform persists the same conversation server-side and
  enforces budgets, metadata, and lifecycle rules.
- **Threads** are represented on the platform by creating a session with a
  `parent_thread_id`. Locally, child sessions are recorded in their own
  transcript files and can reference the same project directory.

Clearing or disabling local history does not delete platform sessions. To remove
a platform session, use the Sessions API or the Allternit web/desktop interface.

## Security and privacy

- History files are created with `0o600` permissions and should not be shared or
  committed to version control.
- Treat `~/.gizzi/auth.json` and `~/.gizzi/history.jsonl` as sensitive: they may
  contain API tokens, code snippets, or pasted content.
- When you clear `history.jsonl`, inline pasted content is removed with it. Large
  pasted content stored by hash reference may still exist in the paste store
  until it is garbage collected.
