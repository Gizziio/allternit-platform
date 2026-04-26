# Operator Pack Acceptance Tests

## 1. Daemon (a2d) Correctness
- [ ] `GET /v1/health` returns 200.
- [ ] `POST /v1/intent/dispatch` spawns a valid `CapsuleInstance` with associated `A2UI`.
- [ ] `GET /v1/journal/stream` successfully upgrades to SSE and emits heartbeat.
- [ ] `POST /v1/evidence/add` persists evidence to the Journal.

## 2. CLI (a2) Correctness
- [ ] `a2 up` successfully initializes the daemon.
- [ ] `a2 cap new` returns a valid UUID and spawns a thread.
- [ ] `a2 ev ls` displays items in a formatted table.
- [ ] `a2 cap open <id>` correctly spawns the system browser to the right URL.

## 3. TUI (Cockpit) Correctness
- [ ] All 3 panes render on startup.
- [ ] Journal event feed updates in real-time as `a2` commands are run.
- [ ] Selecting a capsule in the left pane correctly populates the center preview.
- [ ] `Ctrl+J` and `Ctrl+E` toggle their respective panels without crashing.

## 4. Integrity & Safety
- [ ] High-risk tool calls (e.g. `shell.exec`) trigger an "Approval Required" journal event.
- [ ] Journal is append-only (cannot be mutated by client).
- [ ] Breaking changes in schema trigger a `doctor` warning.
