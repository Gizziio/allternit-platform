# A://TERNIT --- Environment Standardization Spec v1

**Doc ID:** Allternit-ENV-SPEC-v1\
**Date:** 2026-02-19\
**Status:** Draft (ready for implementation)

------------------------------------------------------------------------

## 0. Why this is not a pivot

This spec does **not** change the A://TERNIT direction. It **extends**
it.

A://TERNIT was already being built as an agentic engineering OS
with: - orchestration (DAG / swarms), - governance (policy, receipts), -
deterministic execution.

What was missing was a **first-class, standardized environment
contract** that makes autonomous execution: - reproducible, - spawnable
at scale, - portable across substrates (BYOC, partner clouds), -
verifiable (hashes + receipts), - safe (policy-bound, scoped
credentials).

This is a **new layer** (Layer 3) that locks down the execution
substrate assumptions so Layer 1 (control plane) and Layer 2 (execution
fabric) can scale without drift.

------------------------------------------------------------------------

## 1. Problem statement

Autonomous engineering agents fail to produce mergeable output when they
cannot reliably run: - builds, - tests, - service stacks (DB/cache), -
migrations, - UI previews, in a deterministic environment.

Localhost drift, inconsistent tool versions, manual steps, and shared
state break agent autonomy.

------------------------------------------------------------------------

## 2. Goals

1.  **Reproducibility:** same repo + same spec → same environment
    (within defined determinism envelope).
2.  **Spawnability:** create N isolated environments concurrently.
3.  **Portability:** run on multiple execution drivers (Kata /
    Firecracker / gVisor / local dev) without changing repo config.
4.  **Autonomy:** environment can self-assemble without human
    intervention.
5.  **Verifiability:** every run binds to immutable hashes of env +
    policy + inputs.
6.  **Safety:** credentials are ephemeral; policies bound and
    enforceable.

------------------------------------------------------------------------

## 3. Non-goals

-   Replacing Dev Containers or Nix; Allternit compiles/normalizes them.
-   Defining a full hypervisor/runtime; this is upstream (Execution
    Fabric).
-   Guaranteeing bit-for-bit determinism for all programs; we define an
    envelope and require logging/freeze rules.

------------------------------------------------------------------------

## 4. Core concepts

### 4.1 Environment Instance (EI)

A single isolated execution context created for a run (or a swarm
worker): - isolated filesystem + runtime, - resource-capped, -
policy-bound, - credential-scoped, - destroyable.

### 4.2 Environment Definition Sources

Allternit accepts one or more of: - `devcontainer.json` (Dev Containers) -
`flake.nix` (Nix Flakes) \[optional\] - `allternit.env.yaml` (Allternit native
minimal spec) \[recommended for explicitness\]

Allternit converts sources into a **Normalized Environment Spec (NES)**.

### 4.3 Normalized Environment Spec (NES)

The canonical, driver-agnostic representation consumed by the Execution
Driver.

------------------------------------------------------------------------

## 5. File layout (repo conventions)

Allternit looks for the following (in order of precedence):

1.  `/.allternit/env/allternit.env.yaml` (native spec)
2.  `/.devcontainer/devcontainer.json` or `/devcontainer.json`
3.  `/flake.nix` (optional)
4.  `/.allternit/env/overrides.yaml` (policy-approved overrides; optional)

Additionally: - `/.allternit/env/services.yaml` (optional split) -
`/.allternit/env/tasks.yaml` (optional split)

------------------------------------------------------------------------

## 6. Normalized Environment Spec (NES): schema (v1)

### 6.1 Top-level

-   `apiVersion`: `"allternit.dev/v1"`
-   `name`: string
-   `base`: base image or base derivation reference
-   `toolchain`: languages + versions
-   `packages`: system + language packages (if not embedded in base)
-   `workspace`: repo mount strategy and paths
-   `env`: environment variables (non-secret)
-   `secrets`: **references only** (never raw values)
-   `services`: long-running processes with health checks
-   `tasks`: one-time jobs with triggers
-   `ports`: exposed/forwarded ports (metadata)
-   `checks`: readiness + validation commands
-   `artifacts`: paths to collect
-   `resources`: cpu/mem/disk limits (defaults allowed)
-   `network`: egress rules (default deny for public marketplace tier)
-   `determinism`: freeze/log rules
-   `metadata`: labels, owners, tags

### 6.2 Example: minimal `allternit.env.yaml`

``` yaml
apiVersion: allternit.dev/v1
name: myrepo
base:
  type: devcontainer
  ref: .devcontainer/devcontainer.json
toolchain:
  node: "20.11"
  rust: "1.76"
workspace:
  root: /workspace
env:
  NODE_ENV: test
secrets:
  - name: GITHUB_TOKEN
    source: allternit.credential
services:
  - name: postgres
    kind: docker-compose
    ref: docker-compose.yml
    health:
      type: tcp
      host: 127.0.0.1
      port: 5432
tasks:
  - name: install
    run: ["bash", "-lc", "pnpm install --frozen-lockfile"]
    trigger: onStart
  - name: migrate
    run: ["bash", "-lc", "pnpm db:migrate"]
    trigger: after:install
checks:
  - name: ready
    run: ["bash", "-lc", "pnpm -s healthcheck"]
artifacts:
  - path: ./test-results
  - path: ./coverage
```

------------------------------------------------------------------------

## 7. Lifecycle model (deterministic hooks)

Every Environment Instance follows a strict lifecycle:

1.  **Resolve**
    -   resolve sources (devcontainer/flake/native)
    -   produce NES
    -   compute hashes (envHash)
2.  **Provision**
    -   create isolated EI via driver
    -   attach workspace
    -   apply resource limits
    -   attach ephemeral credentials (scopeId)
    -   apply network policy
3.  **Bootstrap (Tasks)**
    -   run tasks with triggers:
        -   `onPrebuild` (optional)
        -   `onStart`
        -   `after:<task>`
        -   `manual`
4.  **Start Services**
    -   start services declared in NES
    -   apply health checks
    -   enforce service timeouts
5.  **Readiness Checks**
    -   execute `checks[]` in order
    -   environment marked READY only if checks pass
6.  **Run Steps**
    -   agent tool loop executes commands/tools inside EI
7.  **Collect Artifacts**
    -   gather declared artifact paths
    -   store with lineage metadata (runId, envHash, policyHash)
8.  **Teardown**
    -   destroy EI (default)
    -   optional snapshot (policy-gated)

------------------------------------------------------------------------

## 8. Determinism + hashing

### 8.1 Hashes

Compute and record: - `envHash`: hash(NES canonical JSON) + base ref
digests - `policyHash`: hash(policy doc + enforcement tier) -
`inputsHash`: hash(context pack + prompts + tool inputs) - `codeHash`:
commit SHA (or tree hash for dirty state)

These are written into receipts and bound to PR provenance.

### 8.2 Determinism envelope (v1)

Allternit defines replay parity as: - same envHash + policyHash + inputsHash +
codeHash - plus same model id/version and temperature policy - plus
allowed external I/O captured or frozen

### 8.3 External I/O rules

NES declares: - `network.egress` allowlist/denylist - optional caching
proxy endpoint - requirement: any network responses used for tests/build
must be logged when replayable.

------------------------------------------------------------------------

## 9. Secrets model (no raw secrets in repo or spec)

-   NES contains **references** only:
    -   `source: allternit.credential`
    -   `source: tenant.vault`
    -   `source: env.injected` (for BYOC, policy-gated)
-   Execution Driver receives ephemeral tokens, bound to:
    -   tenantId/projectId/runId
    -   least privilege
    -   TTL

------------------------------------------------------------------------

## 10. Portability rules

Allternit must guarantee that NES fields are: - driver-agnostic, -
declarative, - free from host-specific paths.

Driver-specific behavior is selected via: - driver capabilities
handshake (N14) - optional `metadata.driverHints` (policy-controlled)

------------------------------------------------------------------------

## 11. Compatibility tiers

Allternit supports environment tiering:

-   **Tier 0 (Local Dev):** best effort; convenience-oriented; not used
    for public marketplace runs.
-   **Tier 1 (Enterprise BYOC):** customer-managed compute; strict
    reproducibility required; logs mandatory.
-   **Tier 2 (Marketplace Untrusted):** microVM required; default-deny
    egress; strongest policy.

------------------------------------------------------------------------

## 12. Acceptance tests (v1)

1.  **Recreate:** same repo + spec produces same envHash.
2.  **Bootstrap:** tasks + services + checks complete without human
    input.
3.  **Parallel Spawn:** N EIs can run concurrently without port/caches
    conflicts.
4.  **Replay:** run can be replayed and produces comparable receipts
    under envelope.
5.  **Secrets:** no raw secret values present in NES artifacts.
6.  **Policy Binding:** policyHash is present in every receipt and
    cannot be bypassed.

------------------------------------------------------------------------

## 13. Implementation checklist

-   Parser(s): devcontainer, native YAML; optional nix
-   Normalizer: produce canonical NES JSON
-   Canonicalizer: stable ordering for hashing
-   Lifecycle runner: triggers, dependency graph, timeouts
-   Artifact collector: path collection + integrity hashes
-   Driver adapter: translate NES → driver spawn/exec operations
