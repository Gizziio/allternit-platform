# MiroFish — Upstream & Ecosystem Comparison

Date: 2026-07-17. Companion to `MIROFISH_GAP_ANALYSIS.md`: how the original MiroFish and the
projects around it solve the robustness/service gaps we identified in our implementation.

## The lineage

```
CAMEL-AI OASIS (engine, arXiv:2411.11581)
   └── 666ghj/MiroFish (product, 33k+ stars, Shanda-incubated)
         ├── mirofish.ink            — hosted service
         ├── amadad/mirofish         — English CLI fork, artifact/run-manifest design
         └── nikmcfly/MiroFish-Offline — fully local: Neo4j + Ollama (+ German fork etc.)
```

Our feature is a from-scratch "MiroFish-style" build referencing the upstream repo
(see `SWARM_MIROFISH_MAP.md`) — none of their code, so their engineering choices are
free lessons, not merge candidates.

## How they solve the gaps we found (mapped to our gap-analysis numbering)

**Server-side orchestration (our P2 #11).** Every project in the lineage runs LLM calls
server-side (OASIS: Python asyncio engine; upstream: Python backend + Vue frontend;
amadad: CLI process; offline fork: local backend). Nobody ships browser-side model calls.
Our client-side execution is the outlier and the ceiling on everything else — this is the
strongest external validation of gap #11.

**Persistence & run history (our P1 #6).** OASIS persists *everything* to SQLite (agent
state, social graph, every action) with a PettingZoo-style `reset()`/`step()` API that makes
checkpoint-and-resume a natural workflow. amadad/mirofish stores each run in an immutable
artifact directory with a manifest, plus commands to list prior runs, check status, and
export. Upstream uses Zep Cloud as a managed long-term agent-memory service. Ours loses
everything on refresh; our `MemoryStore` interface anticipated exactly the Zep/DB step.

**Progress visibility (our P1 #5).** Upstream structures the product as a 5-stage pipeline
(graph building → environment setup → simulation → report → deep interaction) surfaced as
stages in the UI. amadad streams the pipeline visually to stderr while emitting structured
JSON to stdout. Nobody hides a multi-minute run behind a lone spinner like we currently do.

**Cost/scale guardrails (our P0 #4).** OASIS throttles via an *activation probability*
(only a fraction of agents act per step — cost scales with agents × activation × steps) and
publishes token-consumption reference numbers. Upstream's docs lead with "high consumption,
try < 40 rounds first". We fan out every persona every round at concurrency 20 with no
guidance or estimate shown.

**Fail-fast configuration (our model-access saga).** amadad validates the model provider at
startup and exits with a config error — no silent misconfiguration. Our equivalent failure
mode was a CORS error surfacing only at run time (pre-fix: an invisible ghost run).

**Structured outputs (service quality, beyond our gap list).** amadad emits `verdict.json`
with confidence scores plus SVG cluster maps and timelines. Upstream/hosted generate an
executive-summary report with risk signals and "narrative paths", produced by a dedicated
**ReportAgent** that can interrogate the finished simulation with tools. Our output is raw
round summaries — no synthesis layer at all.

**Deep interaction (our P1 #9).** Upstream's post-sim chat includes both individual agents
*and* the ReportAgent over the whole world, with conversation context. Ours is single-turn
per persona and the model never sees the chat history the UI displays.

**Persona/world quality (no direct gap entry — a differentiator we lack).** Upstream's
seed ingestion is GraphRAG-based: entities and relationships are extracted into a knowledge
graph first, and personas are generated *from graph entities* with individual + collective
memory injection. The offline fork keeps this with Neo4j + local embeddings
(`nomic-embed-text`). Our personas come from one direct prompt over raw seed text — this is
the biggest fidelity difference between our build and the original.

**Local/offline mode (our dev setup, accidentally).** MiroFish-Offline exists precisely to
run the whole stack on Ollama — their default model is `qwen2.5:32b`. Our
`VITE_LOCAL_AI_BASE_URL` override landed on the same pattern (with a much smaller model);
worth treating as a first-class supported mode, not just a test rig.

## What we already do as well or better

- **Failure-tolerant fan-out** (per-turn failures don't kill a round) — comparable to the
  ecosystem; our total-failure throw is now stricter than upstream documents.
- **Bounded-concurrency scheduling abstraction** (`SwarmScheduler`/`SwarmProvider`) is
  cleaner than upstream's hardwired stack and is provider-agnostic by design.
- **In-app nesting** — theirs are standalone apps; ours lives inside an existing product
  surface next to other modes. No one in the lineage solves that UX; we already have.
- **Sandbox tier option** (E2B) — nobody in the lineage isolates agents at all; we built
  optional isolation they don't have (currently unused, see gap #12).

## Recommendations delta (on top of MIROFISH_GAP_ANALYSIS.md sequencing)

1. **Adopt the staged-pipeline model** as the spine for progress UX (gap #5): our run
   already has natural stages (personas → rounds → report); name them, emit stage events.
2. **Run manifests + history** (amadad's pattern) as the cheapest persistence step (gap #6)
   before full DB persistence: one JSON artifact per run, listable, reloadable — tenant-scoped.
3. **Add a synthesis layer**: a final report call (executive summary, risk signals,
   confidence) over the round summaries — small cost, transforms perceived value. A full
   tool-using ReportAgent can come later.
4. **Graph-lite seed ingestion**: even a single entity/relationship-extraction call feeding
   persona generation would close most of the fidelity gap without adopting GraphRAG infra.
5. **Publish cost guidance** in the panel (registry pricing × calls) and consider an
   activation-probability option for large populations (OASIS's trick) instead of every
   persona acting every round.
6. **Promote the Ollama path** to a supported "local mode" with a sane default model
   (≥7B), mirroring MiroFish-Offline's positioning.

## Sources

- https://github.com/666ghj/MiroFish
- https://github.com/camel-ai/oasis (paper: arXiv:2411.11581)
- https://github.com/amadad/mirofish
- https://github.com/nikmcfly/MiroFish-Offline
- https://mirofish.ink/
