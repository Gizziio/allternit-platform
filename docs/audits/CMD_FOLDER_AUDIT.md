# `cmd/` Folder Audit

Audit scope:

- `/Users/macbook/Desktop/allternit-workspace/allternit/cmd`

Audit date:

- 2026-04-01

## Executive Summary

This is not one CLI codebase. It is a cluster of multiple unrelated or partially related projects:

- old small CLI(s)
- Rust services
- one extracted stable core package
- one large Allternit/Gizzi monorepo
- one separately imported Claude-derived repo
- multiple generated/build-transformed copies
- test output and local workspace state checked into the tree

The biggest source of confusion is that:

- `gizzi-code` and `gizzi-code-claude` are **not** two branches of the same source tree inside `cmd`
- they are two different application trees with different entrypoints and different architecture
- they even share **zero** `src/` file paths

So the drift problem is not just “bad merges.” It is structural duplication plus generated artifacts living beside source.

## Top-Level Inventory

| Folder | Size | Has package.json | Has Cargo.toml | Has .git | Classification |
|---|---:|---|---|---|---|
| `a2r` | 16K | no | no | no | config/support artifact |
| `allternit-api` | 6.5G | no | yes | no | heavy Rust service/backend |
| `allternit-auth` | 4K | yes | no | no | tiny JS package stub |
| `allternit-cloud-api` | 656K | no | yes | no | Rust cloud API |
| `allternit-cloud-wizard` | 188K | no | yes | no | Rust wizard/tool |
| `api` | 36K | no | no | no | unclear/minimal |
| `cli` | 268K | yes | no | no | small legacy TypeScript CLI |
| `cli-rust-archive` | 848K | no | yes | no | archived Rust CLI |
| `cli-typescript` | 24K | no root package | no | no | wrapper/partial folder |
| `cloud-backend` | 37M | yes | no | no | separate TS backend |
| `gizzi-code` | 1.9G | yes | no | no | large Allternit canonical-ish monorepo |
| `gizzi-code-claude` | 207M | yes | no | yes | imported Claude-derived repo |
| `gizzi-core` | 69M | yes | no | no | extracted production-ready primitives |
| `launcher` | 12K | no | yes | no | small Rust launcher |

## Canonical Project Classification

### 1. `gizzi-core`

Path:

- `/Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-core`

Classification:

- clean extracted package
- low drift
- intentionally productionized

Evidence:

- README explicitly describes it as production-ready primitives
- tiny source surface: `14` files, `8` dirs
- normal package shape
- no migration-analysis clutter

Recommendation:

- treat as canonical shared core
- do not mix it with leaked Claude reconstruction work
- use as a reusable dependency, not a dumping ground

### 2. `gizzi-code`

Path:

- `/Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code`

Classification:

- main Allternit/Gizzi app/monorepo
- likely canonical product line
- heavily polluted with build artifacts, transformed copies, outputs, and research docs

Evidence:

- large source tree: `937` files, `276` dirs under `src`
- workspace packages under `packages/*`
- dedicated CLI entrypoint: `src/cli/main.ts`
- rich runtime namespaces: `runtime/`, `cli/`, `continuity/`, `session/`, `tool/`, `mcp/`
- packaging layer: `cli-package/`
- multiple internal docs/specs/research reports

Recommendation:

- treat as the canonical Allternit product repo
- but immediately separate source from artifacts
- this is the folder that needs structural cleanup before any integration decision

### 3. `gizzi-code-claude`

Path:

- `/Users/macbook/Desktop/allternit-workspace/allternit/cmd/gizzi-code-claude`

Classification:

- imported standalone repo
- derivative integration attempt
- not integrated into `gizzi-code`

Evidence:

- has its own `.git`
- remote points to `https://github.com/tanbiralam/claude-code.git`
- commit `9f51e71`
- package name duplicates Gizzi package identity
- README still describes leaked Claude Code source, not a finished Allternit product
- source tree has `1993` files, `375` dirs

Recommendation:

- treat as an external donor/import, not as canonical product source
- do not continue integrating by hand inside this folder
- either:
  - mine it intentionally for features/files, or
  - retire it from the active source surface

### 4. `cli`

Path:

- `/Users/macbook/Desktop/allternit-workspace/allternit/cmd/cli`

Classification:

- small legacy TS CLI

Evidence:

- only `16` source files
- separate package name `@allternit/cli`
- simple `src/index.ts`

Recommendation:

- treat as legacy
- do not confuse it with `gizzi-code` CLI

## Critical Structural Findings

## Finding 1: `gizzi-code` and `gizzi-code-claude` are separate apps, not overlapping trees

Measured facts:

- `gizzi-code/src` files: `937`
- `gizzi-code-claude/src` files: `1993`
- shared relative `src` paths: `0`

Meaning:

- no path-for-path merge happened
- `gizzi-code-claude` was not consolidated into `gizzi-code`
- the integration attempt mostly created a parallel app, not a merged one

Consequence:

- any future integration must be deliberate and file-mapped
- there is no safe “just reconcile diffs” path

## Finding 2: duplicate product identity

Both of these declare effectively the same product identity:

- `gizzi-code/package.json`
  - `name: "@allternit/gizzi-code"`
- `gizzi-code-claude/package.json`
  - `name: "@allternit/gizzi-code"`

Consequence:

- package identity collision
- install/build confusion
- unclear which repo is meant to produce the real `gizzi` binary

Recommendation:

- only one folder in `cmd` should own the `@allternit/gizzi-code` identity

## Finding 3: `gizzi-code` contains multiple generated/build-transformed source copies

Artifact folders inside `gizzi-code`:

- `.build` — 33M
- `.build-production` — 503M
- `.build-transformed` — 507M
- `dist` — 87M
- `output` — 12M
- `cli-package/dist`

These are not source-of-truth folders. They contain:

- copied/transformed `src`
- copied packages
- duplicated `node_modules`
- generated build outputs

Consequence:

- massive drift risk
- easy to edit the wrong file
- search results are polluted
- package managers and build scripts can accidentally resolve against transformed copies

Recommendation:

- immediately mark these as generated artifacts
- exclude them from search/edit workflows
- ideally move them outside the source repo or add strict cleanup rules

## Finding 4: `gizzi-code` contains local runtime state inside the repo

Folder:

- `gizzi-code/.gizzi`

Contains:

- local workspace memory/identity files
- its own `package.json`
- its own `node_modules`

Consequence:

- source tree contains mutable workspace state
- searches will surface local state alongside product code
- risk of accidental coupling between app and developer-local workspace data

Recommendation:

- treat `.gizzi/` as runtime data, not product source

## Finding 5: documentation/research clutter is mixed with source

Examples under `gizzi-code`:

- websocket migration reports
- cowork architecture analysis
- remote control implementation docs
- packaging guides
- testing reports
- HTML mockups
- screenshots

Examples under `gizzi-code-claude`:

- build error analyses
- migration strategy docs
- mapping docs
- rebranding docs

Consequence:

- hard to infer which docs are canonical
- significant narrative drift
- too many stale strategy documents competing with code

Recommendation:

- docs need categorization:
  - canonical product docs
  - historical notes
  - migration/integration scratch
  - generated reports

## Project-by-Project Assessment

## `gizzi-core`

Use for:

- stable shared primitives
- bus/workspace/continuity/verification pieces

Do not use for:

- integration scratch
- leaked-source recovery

Status:

- healthy

## `gizzi-code`

Use for:

- canonical Allternit CLI/TUI direction
- current product architecture
- package/workspace structure

Problems:

- contains too many artifact folders
- contains local runtime workspace state
- contains too many adjacent research and generated docs

Status:

- canonical but cluttered

## `gizzi-code-claude`

Use for:

- source donor/reference for Claude-derived features only
- explicit feature mining
- mapping missing capabilities against `gizzi-code`

Do not use for:

- canonical product ownership
- direct long-term development target

Status:

- donor repo / derivative import

## `cli`

Use for:

- legacy reference only

Status:

- probably obsolete

## Immediate Cleanup Priorities

### Priority 0: establish ownership boundaries

Decide and document:

- `gizzi-code` is the canonical product app
- `gizzi-core` is the canonical shared core package
- `gizzi-code-claude` is donor/import only
- `cli` is legacy

Without this, all future integration work will keep drifting.

### Priority 1: quarantine generated/build folders inside `gizzi-code`

Folders:

- `.build`
- `.build-production`
- `.build-transformed`
- `dist`
- `output`
- `cli-package/dist`

These should be treated as non-source immediately.

### Priority 2: quarantine runtime-local state

Folder:

- `gizzi-code/.gizzi`

This should not be part of source audit/integration scope.

### Priority 3: stop treating `gizzi-code-claude` as “the integration”

It is not integrated.

It is:

- a parallel imported repo
- carrying the Claude-derived tree in its own structure

So the real future question is:

- what should be selectively imported from `gizzi-code-claude` into `gizzi-code`?

not:

- how do we keep working inside both?

## Recommended Canonical Layout

### Canonical source owners

- `gizzi-core`
  - shared primitives
- `gizzi-code`
  - actual Allternit CLI/TUI product

### Non-canonical / derivative

- `gizzi-code-claude`
  - donor/reference only
- `cli`
  - legacy
- `cli-rust-archive`
  - archive

### Services/supporting systems

- `cloud-backend`
- `allternit-api`
- `allternit-cloud-api`
- `allternit-cloud-wizard`
- `launcher`

These should be treated as separate systems, not mixed into CLI integration planning unless directly required.

## What this means for the next integration gameplan

Before planning any Claude/Gizzi integration, the next step should be:

1. freeze `gizzi-code` as the canonical destination
2. mark `gizzi-code-claude` as donor-only
3. ignore generated folders inside `gizzi-code`
4. build a file-level feature import map from donor to destination

The key fact enabling that plan:

- there are zero overlapping `src/` paths between `gizzi-code` and `gizzi-code-claude`

So integration must be designed as:

- selective adoption into `gizzi-code`

not:

- reconciliation of two partially merged trees

## Recommended next audit slice

The next useful step after this report is:

- a file-level audit of `gizzi-code` only
- classify `src`, `packages`, `cli-package`, `.build*`, `dist`, `output`, `.gizzi`
- produce a “source-of-truth map” showing what folders should remain in active development scope

That will give a stable destination before any Claude-derived import decisions are made.
