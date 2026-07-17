# Swarm Sandbox Tier + MiroFish-style Prediction Feature — Map

## Why this exists

Eoj (product owner) wants two things that build on each other:

1. **A fast, high-volume sandbox tier** — the ability to create, run, and destroy thousands of
   lightweight execution contexts concurrently, in the spirit of Modal's sandbox infra (~1M
   sandboxes in 52s via a custom scheduler with heavy pre-forking/checkpoint-restore). This is a
   different problem from low-latency single-container execution — it's about the control plane
   not becoming a bottleneck at high concurrency, and batch lifecycle APIs instead of one-at-a-time.

2. **A MiroFish-style product feature** on top of that infra. Reference:
   https://github.com/666ghj/MiroFish — "A Simple and Universal Swarm Intelligence Engine,
   Predicting Anything." It ingests seed material from the real world (news, policy drafts,
   financial signals), builds a high-fidelity parallel digital world via GraphRAG, populates it
   with thousands of LLM agents that have independent personas, long-term memory, and behavioral
   logic, lets them interact and socially evolve, and produces a prediction report. It's built on
   CAMEL-AI's OASIS social-simulation engine, uses Zep for agent memory. Workflow: Graph Building
   -> Environment Setup -> Simulation -> Report Generation -> Deep Interaction (chat with any
   simulated agent afterward).

## Current repo state (as of 2026-07-16)

- `surfaces/ai.allternit.com/src/lib/sandbox/` currently contains **only** `README.md` and
  `smart-sandbox.test.ts` — the actual implementation files (`smart-sandbox.ts`,
  `wasm-sandbox.ts`, `docker-sandbox.ts`, `sandbox-pool.ts`, `webvm-connector.ts`,
  `src/state/useSandboxStore.ts`) were **deleted** in commit `f2afa34cb` ("source refactor, agent
  views, and cowork surface updates", 2026-07-02) with nothing replacing them. The docs
  (`docs/SANDBOX_ARCHITECTURE.md`, `docs/SANDBOX_QUICK_REFERENCE.md`) and the test file are stale
  — the test file re-implements the analyzer logic inline as a self-contained fixture, it does not
  import a real module.
- **Explicit decision from Eoj: do not restore the deleted tiers.** Build the new swarm tier and
  MiroFish feature fresh and production-ready, using an open-source project to solve the
  fast-provisioning problem rather than reinventing it. The swarm tier does not depend on
  WASM/Docker/WebVM tiers existing — it is a new, standalone capability.
- `dockerode` and `pyodide` are still listed in `package.json` but are currently unused anywhere
  in the codebase (confirmed via repo-wide grep). Leave them; do not remove as part of this work
  unless they conflict with something you add.
- No existing persona/memory/GraphRAG/simulation infrastructure exists anywhere in this codebase
  — this is greenfield.
- App is a Vite + React app (not Next.js, despite some leftover `NEXT_PUBLIC_*` env var naming).
  Package manager is `pnpm`. Path alias `@/*` -> `src/*`. Test runner is `vitest`
  (`pnpm test` / `vitest run`). Logger convention:
  `import { createModuleLogger } from '@/lib/logger'; const logger = createModuleLogger('Name');`
  (see `src/lib/ai/mcp/sandbox-client.ts` for a real example of this pattern in use).
- Do not touch `src/lib/agents/agent-workspace.service.ts`, `src/lib/agents/files-api.ts`,
  `src/lib/agents/useAgentBootstrap.ts`, `cmd/allternit-mux/`, or anything under `rails/` /
  `cmd/allternit-api/` — these have unrelated in-progress changes from another session on `main`
  that this worktree branched from. If your work needs to touch any of these files, stop and
  report it in your NOTES file instead of proceeding.

## Chosen approach: E2B (not Daytona, not a from-scratch Firecracker integration)

Researched two candidates for the underlying fast-provisioning engine:

- **E2B** (`e2b-dev/infra`, Apache-2.0) — purpose-built for exactly this: on-demand,
  Firecracker-microVM-isolated sandboxes for AI agent code execution at high volume. Sub-second
  (~150-500ms) cold starts, proven at 500M+ sandboxes processed. Self-hosted infra deploys via
  Terraform with Nomad + Consul + Firecracker (GCP fully supported, AWS in beta). SDK is
  Apache-2.0 and genuinely open source.
- **Daytona** — optimized for *persistent, stateful* dev workspaces (Running/Stopped/
  Archived/Deleted lifecycle), Docker-container-based with a shared host kernel. Good fit for
  long-lived agentic dev sessions, poor fit for bursty, ephemeral, thousands-at-once swarms.

**Decision: E2B.** It matches the actual shape of the problem (many short-lived, isolated,
identical-shape execution contexts spun up and torn down in bulk) far better than Daytona's
long-lived-workspace model.

## Target architecture

```
MiroFish-style feature (product layer)
  Seed Ingestion -> World/Graph Builder -> Agent Population Builder -> Simulation Engine
  -> Report Generator -> Deep Interaction (chat with a simulated agent)
        │
        ▼
Swarm Sandbox Tier (infra layer) — NEW, this is the "Modal-style" piece
  Batch provisioning API (create N contexts, run, destroy N contexts)
  Scheduler / pool manager sitting in front of E2B (or a pluggable provider interface,
  with E2B as the first/only implementation for now)
  Each "swarm unit" = one simulated agent's execution context (persona + memory + one
  simulation round's worth of reasoning), not a general-purpose code sandbox
```

Keep the swarm tier's public interface provider-agnostic (a thin interface with `E2BSwarmProvider`
as the sole implementation) so a future provider swap doesn't require touching the product layer.
Do not build speculative support for a second provider now — YAGNI, one implementation is enough,
just don't hard-wire E2B specifics into the product layer's call sites.

## Phasing

- **Phase 1** (this task): Swarm sandbox tier infra (E2B-based) + a features brainstorm doc.
  Fully standalone, no product-layer code yet.
- **Phase 2** (later): MiroFish simulation engine on top of Phase 1 — seed ingestion, persona/
  memory agent population, multi-round simulation loop with agent-to-agent interaction.
- **Phase 3** (later): Report generation + deep interaction (chat with a simulated agent) + UI
  wiring.

Do not start Phase 2 or Phase 3 work in this pass — only Phase 1, as scoped in
`SWARM_MIROFISH_PHASE_1_TASK.md`.
