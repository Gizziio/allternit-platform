# `rails` CLI

`rails` is a standalone ticket and DAG workflow CLI. It is also the Rails
surface of the Allternit platform, sharing workspace state with the ledger,
gate, vault, mail, lease, and context-pack systems.

It works anywhere: initialize it in any directory and you get hash-based,
event-sourced issue tracking with typed dependencies, ready-list derivation,
external tracker sync, memory/echo stores, kill switch/SLO monitoring, and an
optional Dolt storage backend.

## Install

### From source

```bash
git clone <repo>
cd allternit/rails/cli
cargo install --path .
```

Or from the workspace root:

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

## Quick start

```bash
rails init
rails ticket new "Fix login bug" --description "Users cannot log in" --priority P1
rails ticket list
rails ready --explain
rails doctor
```

## Full documentation

See [RAILS_CLI.md](./RAILS_CLI.md) for the complete command reference,
including:

- Ticket, DAG, memory, echo, template, batch, gate, and lock commands
- `rails sync` with GitHub, Linear, Jira, Azure DevOps, GitLab, and Notion
- `rails compact` for compaction/pruning
- `rails kill` and `rails slo` for emergency brake and observability
- `rails dolt` for optional Dolt storage
- `rails mcp` for Model Context Protocol integration
- Standalone usage and Allternit platform integration

## Standalone product

`rails` is intentionally separate from the rest of the Allternit platform. All
state lives under `.allternit/rails/` in the workspace root, so it can be used
in any project without pulling in the full platform.

## Allternit platform integration

When used inside the Allternit platform, `rails` shares the workspace root with
the existing ledger, gate, vault, mail, leases, and context packs. Run
`rails setup <agent>` to generate agent/editor configuration files that teach
Claude, Codex, Cursor, Windsurf, and Aider how to use Rails commands.
