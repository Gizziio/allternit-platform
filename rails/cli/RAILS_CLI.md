# `rails` CLI

`rails` is a standalone ticket and DAG workflow CLI. It is also the Rails
surface of the Allternit platform, sharing workspace state with the ledger,
gate, vault, mail, lease, and context-pack systems.

It is designed to work anywhere: initialize it in any directory and you get
hash-based, event-sourced issue tracking with typed dependencies, ready-list
derivation, external tracker sync, memory/echo stores, and optional Dolt
storage.

## Install

### From source (anywhere with Rust)

```bash
git clone <repo>
cd allternit/rails/cli
cargo install --path .
```

### From the workspace root

```bash
cargo install --path allternit/rails/cli
```

### Using the install script

```bash
cd allternit/rails/cli
./install.sh           # installs to ~/.cargo/bin
./install.sh /usr/local/bin
```

The binary is named `rails`.

### Optional Dolt support

Dolt support is compiled in by default. To build without it:

```bash
cargo install --path . --no-default-features
```

## Quick start

```bash
rails init
rails ticket new "Fix login bug" --description "Users cannot log in" --priority P1
rails ticket list
rails dag block T-<blocked> T-<blocker>
rails ready --explain
rails doctor
```

## Concepts

- **Ticket** — the basic unit of tracked work. Tickets have a hash-based ID
  (`T-` prefix, 32 hex chars), status, kind, priority, assignee, labels, and
  notes.
- **DAG** — directed dependency graph between tickets. Edges can be `blocks`
  (hard blocker) or `relates` (bidirectional link).
- **Ready list** — tickets that are open, not deferred, and have no open
  blockers (or unresolved gates).
- **Event log** — the source of truth for tickets. Snapshots are derived views.
- **Kill switch** — an emergency brake that blocks mutating operations.
- **SLO metrics** — operation success/failure/duration statistics.

## Command reference

### `rails init`

Creates `.allternit/rails/` with event, snapshot, dependency, memory, echo,
template, and sync state directories.

### `rails ticket`

- `new <title>` — create a ticket
- `list` — list tickets (omit closed by default; use `--all`)
- `show <id>` — show ticket details
- `update <id>` — update title, description, priority, assignee, labels, etc.
- `close <id>` — close a ticket with optional `--reason`
- `note <id> <text>` — append a note

Examples:

```bash
rails ticket new "Add OAuth" --kind feature --priority P0 --assignee alice
rails ticket close T-abc123 --reason "fixed in commit def456"
```

### `rails dag`

- `block <ticket> <blocker>` — hard blocker edge
- `relate <a> <b>` — bidirectional relation edge
- `tree <id>` — show dependency tree
- `verify` — check the graph is acyclic

### `rails ready`

Shows tickets with no open blockers. Use `--explain` to see why others are
blocked or gated.

### `rails memory`

- `learn <content> --tags <tag1,tag2>` — store a persistent memory
- `recall <id>` — retrieve a memory
- `list --tag <tag>` — list memories
- `search <query>` — search memories
- `brief --tags <tag1,tag2> --limit 10` — generate a context brief
- `update <id> --content ... --tags ...` — update a memory
- `forget <id>` — delete a memory

### `rails echo`

- `new <content> --kind <kind> --ttl <seconds>` — create an ephemeral echo
- `list --expired` — list echoes
- `gc` — remove expired echoes

### `rails template`

- `new <name> --steps <steps.json>` — create a template from a JSON step file
- `list` — list templates
- `show <id>` — show template details
- `instantiate <id>` — create tickets from a template
- `delete <id>` — delete a template

A step JSON file is an array of objects with `id`, `title`, `description`,
`kind`, `priority`, and `blocked_by` (array of step ids). Example:

```json
[
  {"id": "design", "title": "Design API", "description": "...", "kind": "task", "priority": "p1", "blocked_by": []},
  {"id": "implement", "title": "Implement API", "description": "...", "kind": "task", "priority": "p2", "blocked_by": ["design"]}
]
```

### `rails batch`

- `exec <file.json>` — atomically execute a batch of operations

A batch JSON file is an array of operations:

```json
[
  {"op": "create_ticket", "id": "parent", "title": "Parent", "description": "...", "kind": "task", "priority": "p1"},
  {"op": "create_ticket", "id": "child", "title": "Child", "description": "...", "kind": "task", "priority": "p2"},
  {"op": "add_dependency", "from": "<ticket-id>", "to": "<ticket-id>", "kind": "blocks"},
  {"op": "update_ticket", "id": "<ticket-id>", "title": "New title"},
  {"op": "close_ticket", "id": "<ticket-id>", "reason": "done"}
]
```

The batch is validated before execution. Unknown ticket IDs and blocking cycles
are rejected.

### `rails gate`

- `add <ticket> <kind>` — add a wait-gate to a ticket
  - `--description <text>`
  - `--until <iso8601>` (timer gates)
  - `--repo owner/repo` (GitHub gates)
  - `--run-id <id>` (GitHub Actions run gates)
  - `--pr <number>` (GitHub PR gates)
- `resolve <id> --outcome ok|failed|skipped` — resolve a gate
- `list <ticket> --resolved` — list gates for a ticket
- `remove <id>` — delete a gate

Gates are evaluated by `rails ready`: a ticket with any unsatisfied open gate
is reported as "gated" and excluded from the ready list.

### `rails lock`

- `acquire <domain> --owner <owner> --ttl <seconds>` — acquire an exclusive merge lock
- `release <id>` — release a lock
- `list --active` — list locks
- `status <domain>` — show active lock for a domain
- `gc` — clean up expired/released locks

Merge locks prevent concurrent conflicting work on a conflict domain such as
`branch:main` or `path:src/db/schema.sql`.

### `rails query`

- `query --entity <tickets|memories|echoes|gates|locks> <expr>` — query workspace state

Supported operators: `:`, `!=`, `<=`, `>=`, `<`, `>`, and `contains:` shorthand.
Examples:

```bash
rails query --entity tickets status:open kind:bug
rails query --entity tickets priority>=P1
rails query --entity memories tag:api
rails query --entity locks owner:ci
```

### `rails sync`

`rails` can sync with six external trackers:

- `linear`
- `github`
- `jira`
- `ado` (Azure DevOps)
- `gitlab`
- `notion`

Commands:

- `sync <provider> --configure --token <token>` — configure a provider
- `sync <provider> pull` — pull issues from the tracker into Rails
- `sync <provider> push` — push Rails tickets to the tracker
- `sync <provider> status` — check configuration and connectivity

Examples:

```bash
rails sync github --configure --token $GITHUB_TOKEN
rails sync github pull
rails sync github push

rails sync linear --configure --token $LINEAR_API_KEY
rails sync linear pull
```

Provider-specific settings (owner/repo, project, base URL) are read from the
provider configuration file at `.allternit/rails/sync/<provider>.json`.

### `rails compact`

- `snapshots` — rebuild ticket snapshots from the event log
- `echoes` — garbage collect expired echoes
- `sync-state` — remove stale sync mapping files
- `prune --retention <days>` — archive closed ticket events older than the retention window
- `all` — run all compaction operations

### `rails kill`

Emergency brake for mutating operations.

- `enable --reason <reason> --actor <actor>` — block writes
- `disable` — allow writes again
- `status` — show current state

When the kill switch is enabled, all mutating commands (ticket changes, DAG
edits, sync push, memory learn/forget, template instantiate, batch exec,
gate/lock mutations, compact, policy injection, Dolt push/pull) are rejected
with the recorded reason.

### `rails slo`

Show operation success/failure/duration statistics.

- `slo --window <minutes>` — summarize SLO metrics over the last N minutes

### `rails dolt`

Optional Dolt storage backend for replicating ticket state to a MySQL-compatible
server.

- `dolt init --url mysql://user:pass@host:port/db` — create Rails tables
- `dolt push --url ...` — upload local tickets to Dolt
- `dolt pull --url ...` — download Dolt tickets into the local store
- `dolt status --url ...` — compare local and Dolt ticket counts

The URL can also be supplied through environment variables:

```bash
export RAILS_DOLT_HOST=127.0.0.1
export RAILS_DOLT_PORT=3306
export RAILS_DOLT_USER=root
export RAILS_DOLT_PASSWORD=
export RAILS_DOLT_DATABASE=rails
rails dolt status
```

### `rails policy`

- `policy --injected-by <actor>` — inject `AGENTS.md` and `.allternit/agents/*.md`
  into the ledger as a policy bundle

This records the current policy sources and their hash so the workspace's
rules are auditable and versioned.

### `rails mcp`

- `mcp` — start the Model Context Protocol server over stdin/stdout

Exposed tools include:
- `rails_ticket_new`
- `rails_ticket_list`
- `rails_ticket_close`
- `rails_ready`
- `rails_memory_learn`
- `rails_memory_brief`

Mutating MCP tools respect the kill switch.

Example client interaction:

```bash
rails mcp
# then send JSON-RPC lines:
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
{ "jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": { "name": "rails_ticket_new", "arguments": { "title": "From MCP", "priority": "P1" } } }
```

### `rails setup`

- `setup <claude|codex|cursor|windsurf|aider>` — write agent/editor integration files

Example: `rails setup claude` creates `.claude/AGENTS.md` with Rails usage
instructions.

### `rails doctor`

- `doctor` — run integrity diagnostics
- `doctor --json` — machine-readable report

Checks: dependency cycles, tamper-evident ledger integrity, closed tickets
missing `closed_at`, stale tickets, orphan tickets, duplicate titles.

## Global flags

- `--root <dir>` — workspace root (default: current directory)
- `--json` — output JSON instead of human-readable text

## Storage model

Tickets are stored as an append-only event log in `.allternit/rails/ticket_events/`
and projected snapshots in `.allternit/rails/ticket_snapshots/`. Each event is
wrapped in a tamper-evident envelope with `previous_hash` and `event_hash`, so
the ledger chain can be verified with `rails doctor`.

Dependencies are stored in `.allternit/rails/dependencies/graph.json`.
Memories are stored in `.allternit/rails/memories/` and echoes in
`.allternit/rails/echoes/`.

The optional Dolt backend replicates ticket state to a MySQL-compatible server
for SQL querying, branching, and collaboration.

## Standalone usage

`rails` does not require the rest of the Allternit platform. Any directory can
host a Rails workspace:

```bash
rails init
rails ticket new "Write docs" --kind chore
rails ticket list --json
```

The CLI is self-contained and stores all state under `.allternit/rails/`.

## Allternit platform integration

When used inside the Allternit platform, `rails` shares the workspace root with
the existing ledger, gate, vault, mail, leases, and context packs. The same
`.allternit/` directory is used by other Allternit components, so tickets,
memories, and gates are visible across the platform.

Run `rails setup <agent>` to generate agent/editor configuration files that
teach Claude, Codex, Cursor, Windsurf, and Aider how to use Rails commands.

## Environment variables

- `RAILS_DOLT_HOST`, `RAILS_DOLT_PORT`, `RAILS_DOLT_USER`, `RAILS_DOLT_PASSWORD`,
  `RAILS_DOLT_DATABASE` — default Dolt connection settings
- Provider tokens are normally stored in `.allternit/rails/sync/<provider>.json`
  after `rails sync <provider> --configure --token <token>`.
