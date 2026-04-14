# allternit-platform — Agent Guide

> Core platform monorepo. Source of truth for the Allternit stack.

## Quick Start

```bash
# Install all dependencies
pnpm install

# Build all workspace packages
pnpm build

# Run the full dev stack (API + runtime + shell)
make dev
```

## Key Commands

| Command | What it does |
|---------|--------------|
| `pnpm build` | Recursive build across the pnpm workspace |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:e2e` | Run Playwright e2e tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm dev:api` | Start the Rust API server only |
| `bun run --cwd cmd/gizzi-code dev` | Start Gizzi Code CLI in dev mode |

## Directory Map

| Path | Purpose |
|------|---------|
| `cmd/` | CLIs (gizzi-code, etc.) |
| `packages/@allternit/` | Internal SDK packages |
| `surfaces/allternit-platform/` | Main Next.js shell UI |
| `api/` | Backend servers (Rust / TS) |
| `services/` | Orchestration & microservices |
| `domains/` | Domain-specific business logic |
| `plugins/` | Card plugins |

## Conventions

- **Package manager:** pnpm (do not use npm or yarn at the root)
- **Rust:** `cargo build --release` in `api/` or individual crates
- **Formatting:** Follow `.editorconfig` (2-space indent, LF, UTF-8)
- **Tests:** Vitest for TS, `cargo test` for Rust

## Warnings

- Do not modify `pnpm-workspace.yaml` package globs without confirming the directory still exists.
- The old `7-apps/` and `6-ui/` paths referenced in some legacy docs no longer exist; use `surfaces/`, `cmd/`, `api/`, etc.

## Related Repos

- [`allternit-sdk`](https://github.com/Gizziio/allternit-sdk) — Published SDK + plugins
- [`gizzi-code`](https://github.com/Gizziio/gizzi-code) — AI assistant CLI
- [`allternit-docs`](https://github.com/Gizziio/allternit-docs) — Platform documentation
