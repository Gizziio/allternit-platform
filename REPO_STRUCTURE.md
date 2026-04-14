# Allternit Repository Architecture

This document describes the production-grade repository setup for the Allternit ecosystem.

## Monorepo + Satellite Repos

We use a **monorepo + satellite repo** architecture:

- **`allternit-platform`** (this repo) — Core platform monorepo. Source of truth for the full stack.
- **Satellite repos** — Extracted public packages with independent release cycles.

## Core Monorepo (`allternit-platform`)

The monorepo contains everything needed to build, test, and deploy the full Allternit platform.

```
allternit-platform/
├── cmd/gizzi-code/           # Gizzi Code CLI source
├── packages/@allternit/      # Internal SDK packages
├── plugins/                  # Card plugins
├── sdk/allternit-sdk/        # Public SDK build target
├── surfaces/                 # Web apps and desktop surfaces
├── domains/                  # Domain logic
├── api/                      # Backend services
└── ...
```

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
