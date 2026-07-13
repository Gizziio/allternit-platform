# @allternit/orchestrator

Vendor-neutral agent orchestration primitives (ADR-0044). One agent — any vendor —
orchestrates executor agents (claude, kimi, codex, agy) in isolated sessions:
scope → delegate → monitor → review → iterate.

```ts
import { SessionRegistry, LocalTerminalBackend, launchCommand } from '@allternit/orchestrator';

const registry = new SessionRegistry(new LocalTerminalBackend());

const result = await registry.handoff(
  {
    slug: 'settings-parity-p2',
    workdir: '/path/to/repo',
    vendor: 'kimi',
    mode: 'interactive',
    launchCommand: launchCommand('kimi', 'interactive'),
    isolation: 'worktree',
    taskFile: 'docs/SETTINGS_PHASE_2_TASK.md',
    notesFile: 'docs/SETTINGS_PHASE_2_NOTES.md',
  },
  'Read docs/SETTINGS_PHASE_2_TASK.md and execute it exactly. It is your full task spec.',
);

// result.outcome  — { kind: 'done', report } | { kind: 'dead' } | { kind: 'timeout' }
// result.footprint — what actually changed (worktree diff), for the review gate.
```

Key invariants (see ADR-0044):

- The notes file's existence is the ONLY completion signal (never TUI busy-indicators).
- Verified send: paste → read back → submit only on match; `C-u` on mismatch, never `C-c`.
- `handoff` returns the executor's report AND the real footprint — review is the caller's
  explicit act, never automated away.
- Task specs are written by the orchestrator before spawn; executors make no product decisions.

Backends: `local-terminal` (tmux, default) and optional `local-pty`
(`TerminalControlBackend`). The terminal-control backend fails closed when `termctrl`
is absent, verifies prompts against the rendered screen before submitting Enter, and
attaches sensitive PNG/text/recording paths to the review footprint. `kernel` /
`cloud` / `acu` remain later phase-2 targets. The dev-machine `ao-*` scripts are the
reference implementation of the same semantics.
## Runtime discovery

The known launch matrix is verified against installed CLIs before fallback selection:

```ts
import { doctor, formatDoctorReport, selectVendor } from '@allternit/orchestrator';

const report = await doctor();
console.log(formatDoctorReport(report));
const selected = await selectVendor(['kimi', 'codex', 'claude'], 'interactive');
```

`selectVendor` preserves preference order and fails closed when no installed CLI
supports the requested mode or required flags. It never silently changes a headless
request into an interactive one.

The three-run rollout gate in ADR-0044 is satisfied. Gizzi owns the live Node process
registry and exposes its lifecycle through `/v1/orchestrator/*`; MCP tools can bind to
the same registry contract without duplicating executor state.

Gizzi's stdio MCP entrypoints expose `orchestrator_doctor`, `orchestrator_spawn`,
`orchestrator_assign`, `orchestrator_handoff`, `orchestrator_status`,
`orchestrator_send`, `orchestrator_watch`, `orchestrator_review`, and
`orchestrator_kill`. They call the
canonical HTTP runtime at `GIZZI_ORCHESTRATOR_URL` (falling back to
`GIZZI_SERVER_URL`, then `http://127.0.0.1:4096`) and forward Gizzi basic-auth
environment credentials when configured.

Lifecycle events are also available over `/events` as SSE. Session/spec metadata is
stored with owner-only permissions at `~/.allternit/orchestrator-sessions.json`
(`GIZZI_ORCHESTRATOR_STATE_PATH` overrides it); launch commands are redacted before
persistence. Completed sessions require an explicit accepted/rejected review decision.

`KernelExecutorBackend`, `CloudExecutorBackend`, and `AcuExecutorBackend` are guarded
driver adapters. Their owning runtime injects an `ExecutorBackendDriver`; without one
they report unavailable and fail closed. Drivers must provide real footprints—missing
review evidence is never represented as an empty successful footprint.
