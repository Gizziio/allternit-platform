# Allternit Repository Architecture

This document describes the production-grade repository setup for the Allternit ecosystem.

## Monorepo + Satellite Repos

We use a **monorepo + satellite repo** architecture:

- **`allternit-platform`** (this repo) — Core platform monorepo. Source of truth for the full stack.
- **Satellite repos** — Extracted public packages with independent release cycles.

## Core Monorepo (`allternit-platform`)

The monorepo contains everything needed to build, test, and deploy the full Allternit platform.

```
allternit/
├── cmd/                      # CLI binaries and API servers
│   ├── allternit-api/        # Main API server
│   ├── allternit-cloud-api/  # Cloud deployment API
│   ├── allternit-cloud-wizard/
│   ├── allternit-mux/
│   ├── launcher/
│   └── gizzi-code/           # Gizzi Code CLI source
├── api/                      # Backend API services (gateway, cloud, workspace)
├── services/                 # Long-running services (memory, voice, registry, orchestration; vendored: open-connector, docmost*)
├── domains/                  # Domain logic (agent, computer-use, governance, kernel; agent-swarm archived → archive/agent-swarm, live agent tools at tools/agent-swarm/; cowork compose stack moved to tools/cowork-integration/stack/, cowork runtime crates remain in infrastructure/executor/cowork/)
├── infrastructure/           # Cloud providers, executors, bridges (alias: infra/ symlink)
├── mcp/                      # Model Context Protocol crates
├── drivers/                  # VM and hardware drivers (firecracker, apple-vf)
├── rails/                    # Agent Rails execution engine
├── packages/@allternit/      # Internal SDK packages (being consolidated into platform/)
├── platform/                 # Contracts, protocols, SDK, plugin runtime, shared packages
├── sdk/                      # Public SDK packages
├── surfaces/                 # Web apps and desktop surfaces
│   ├── ai.allternit.com/     # Main web surface (alias: ui/ symlink → its src/)
│   ├── allternit-desktop/    # Desktop shell (Electron)
│   ├── allternit-extensions/ # Browser extensions
│   ├── allternit-mobile/     # Mobile surface
│   └── docs/                 # Docs surface
├── docs/                     # Documentation hub (archive/, gap-analysis/, learnings/, reports/, specs/)
├── research/                 # Active research & planning docs (+ adr/)
├── spec/                     # Contract schemas + specs (wired into rails)
├── scripts/                  # Repo automation (A://Labs Canvas pipeline, builds; adhoc/ for one-offs)
├── bin/                      # Executable helpers (dev-up, ci-gate, ...)
├── dev/                      # Dev-ops + migration scripts
├── tests/                    # Acceptance/e2e/integration/load suites
├── tools/                    # Misc tooling (cowork-integration, deployment, mcp-servers)
├── config/                   # allternit.json + system config (read by live code)
├── resources/                # company.json (config:company:write output) + vm/
├── patches/                  # pnpm patchedDependencies
├── archive/                  # Retired material: card plugins, orphan crates, card-templates, alabs-curator
├── alabs-generated-courses/  # A://Labs courseware source of truth (+ demos/)
├── alabs-module-template/    # Shared HTML shell for course modules
├── remix-content/            # Remix pipeline course content + plans/
└── worktree-manager/         # Git worktree management crate
```

> Reorganized 2026-07-22: removed `plugins/` (empty; card plugins live in `archive/plugins/`, runtime in `platform/plugins/`), root `src/`, `data/`, `public/`, `proof/`, `output/`, `dispatch-screenshots/`, `Desktop/` (accidental commit), and merged `analysis/` → `docs/gap-analysis/`, `reports/` → `docs/reports/`, `alabs-demos/` → `alabs-generated-courses/demos/`, `remix-plans/` → `remix-content/plans/`, `agent/`/`templates/`/`alabs-curator/` → `archive/`.

## Satellite Repos

These repos are published independently to NPM and have their own GitHub releases.

| Repo | NPM Package | Purpose |
|------|-------------|---------|
| [`allternit-sdk`](https://github.com/Gizziio/allternit-sdk) | `@allternit/sdk` | AI runtime, providers, ACP, and OpenAPI client |
| [`allternit-plugin-sdk`](https://github.com/Gizziio/allternit-plugin-sdk) | `@allternit/plugin-sdk` | Universal plugin SDK with 6 adapters |
| [`allternit-api-client`](https://github.com/Gizziio/allternit-api-client) | `@allternit/api-client` | TypeScript API client |
| [`gizzi-code`](https://github.com/Gizziio/gizzi-code) | `@allternit/gizzi-code` | Workspace-aware AI CLI |
| [`allternit-plugins`](https://github.com/Gizziio/allternit-plugins) | `@allternit/*-plugin` | 12 ready-to-use card plugins |
| [`allternit-docs`](https://github.com/Gizziio/allternit-docs) | — | Documentation websites |
| [`allternit-assets`](https://github.com/Gizziio/allternit-assets) | — | Brand assets and logos |

## Development Workflow

1. **Day-to-day development** happens in `allternit-platform`.
2. When a satellite package is ready for release:
   - Code is extracted from the monorepo
   - Pushed to the satellite repo
   - Tagged and released on GitHub
   - Published to NPM

## NPM Organization

All packages are published under the **`@allternit`** scope:

```bash
npm install @allternit/sdk
npm install @allternit/plugin-sdk
npm install @allternit/api-client
npm install -g @allternit/gizzi-code
npm install -g @allternit/marketresearchcard-plugin
```
