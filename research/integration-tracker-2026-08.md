# Allternit External Integration Tracker

**Updated:** 2026-08-13 (session in progress)  
**Source roadmap:** `research/external-integration-roadmap-2026-08.md`

This tracker is the single source of truth for status, scope, and next actions for every item in the external-integration roadmap.

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Done | Scaffolded/integrated and validated (typecheck or tests). |
| 🔄 In Progress | Currently being worked on in this or another session. |
| ⏳ Queued | Approved for implementation, waiting for capacity. |
| ⏸️ Blocked | External dependency, license issue, or prerequisite not met. |
| ❌ Rejected | Explicitly out of scope or unsuitable after audit. |

---

## P1 — Critical / Linchpin

| # | Item | Status | Owner | Location / Branch | Notes |
|---|------|--------|-------|-------------------|-------|
| 1.1 | **Allternit Tagging Subsystem** | ✅ Done | This session | `session/opentag-p1-D5262E14` | Rust backend routes + migration `V83__tags.sql` + 387 tests passing. TS API client + Zustand store + surface integration (`TagPicker`, `TagManagerView`, `AgentGalleryGrid`). `bun typecheck` clean for changed files. |
| 1.2 | **agent-desktop provider** | ✅ Done | Agent swarm | `ao/p1-agent-desktop` → `ao/p1-agent-desktop-phase2` | Full macOS AX traversal + click/type/press/scroll/show_menu/raise + app lifecycle + JSON-RPC provider. `cargo check --workspace` clean; 14 tests passing (1 ignored). |
| 1.3 | **droidrun/mobile-harness** | ✅ Done | Agent swarm | `ao/p1-droidrun` | Python FastAPI adapter under `platform/mobile-harness/`. ADB device discovery + tap/swipe/type/screenshot/launch endpoints. Smoke test passed; `py_compile` clean. |
| 1.4 | **phone-harness** | ✅ Done | Agent swarm | `ao/p1-phone-harness` | Python Flask adapter under `platform/phone-harness/`. iPhone Mirroring window discovery + `/health`, `/devices`, `/action`. `py_compile` clean. |
| 1.5 | **Unsloth training backend** | ✅ Done | Agent swarm | `ao/p1-unsloth` | Model Lab worker under `services/model-lab/` + Rust proxy + API routes in `cmd/allternit-api/src/model_lab_routes.rs`. `cargo check` clean; 385 `allternit-api` tests passing. |
| 1.6 | **treg connector** | ✅ Done | Agent swarm | `ao/p1-treg-2` | Rust crate `platform/agent-tools-router/` with manifest loader, schema translator, `/health`, `/tools`, `/tools/{id}/execute`. `cargo check` clean; 4 smoke tests passing. |
| 1.7 | **Allternit Local Engine** | ✅ Done | This session | `ao/p1-local-engine` | Native local model serving layer for Allternit Model Lab. Controller service (`services/local-engine/`) + runtime recipes (vLLM/SGLang/llama.cpp/MLX) + model cache + GPU monitoring + OpenAI-compatible proxy. `/api/local-engine/*` proxy routes in `cmd/allternit-api`. Model Lab UI extended with Engine + Playground tabs; Unsloth jobs get **Serve locally** action. `cargo check` clean; 15 tests passing. |
| 1.8 | **ApiTap / HAR-derived API Capture** | ✅ Done | This session | `ao/p1-apitap-capture` | Native capture→derive→replay subsystem. Rust service (`services/api-capture/`) with HAR v1.2 parser, SQLite persistence, contract derivation, replay executor, and `/api/api-capture/*` proxy. Surface UI panel **Site APIs** registered in rail. Cross-surface integration: `api_capture_*` tools added to `sdk/computer-use` MCP specs, `packages/computer-use` plugin tool belt, and `allternit-os/kernel/AgentTools.ts` agent runtime. Browser toolbar has a **Record network requests** toggle that injects a HAR recorder into the active webview/iframe, ingests traffic, and derives a Site API contract. `cargo check` clean; 4 integration tests passing. TypeScript typecheck clean for touched files.

---

## P2 — High Value

| # | Item | Status | Owner | Location / Branch | Notes |
|---|------|--------|-------|-------------------|-------|
| 2.1 | agent-desktop full AX traversal + actions | ✅ Done | Agent swarm | `ao/p1-agent-desktop-phase2` | Full macOS AX provider: snapshot, list_apps, click, type, press, scroll, launch, focus. 14 tests passing. |
| 2.2 | Surface integration for desktop/mobile adapters | ✅ Done | Agent swarm | `ao/p1-surface-computer-use` | `ComputerUseView` capsule + desktop JSON-RPC client + Zustand store + rail/route plumbing. Typecheck clean for touched files. |
| 2.3 | Model Lab UI for Unsloth | ✅ Done | Agent swarm | `ao/p1-unsloth` | Catalog/Train/Jobs tabs, Zustand store, API client, rail entry. `bun typecheck` clean. |
| 2.4 | treg ToolProvider trait + gateway registration | ✅ Done | Agent swarm | `ao/p1-treg-2` | `TregToolProvider` implements `mcp::gateway_integration::ToolProvider`; `/api/agent-tools/*` routes. 12 tests passing. |
| 2.5 | Model Studio cloud training | ✅ Done | Agent swarm | `ao/p1-model-studio` | Cloud training tab integrated into existing Unsloth Model Lab; backend stubs + proxy routes. `cargo check` clean; typecheck clean for touched files. |
| 2.6 | OpenMausBot packaged bots | ✅ Done | Agent swarm | `ao/p1-openmausbot` | Bots tab in Agent Hub with 6 packaged bot templates + session launch. Typecheck clean for touched files. |
| 2.7 | Allternit Bot (x.ai/bot) | ✅ Done | Agent swarm | `ao/p3-allternit-bot-audit` | Audit report: persistent bots, shared cloud computer, skills/routines, approval model, integration plan. |
| 2.8 | agency-agents personas | ✅ Done | Agent swarm | `ao/p1-agency-agents` | 8 curated personas added to Agent Hub with Personas tab + create-agent-from-persona flow. Typecheck clean for touched files. |
| 2.9 | OpenManus patterns | ✅ Done | Agent swarm | `ao/p2-openmanus-audit` | Audit report: PlanningTool, ReAct loop, ToolCollection patterns vs Allternit. |
| 2.10 | prime-agent dual-loop harness | ✅ Done | Agent swarm | `ao/p2-prime-agent-audit` | Audit report: RLM + Continual Harness dual-loop design vs DAK Runner. |
| 2.11 | browse.sh CLI browser UX | ✅ Done | Agent swarm | `ao/p2-browse-sh-audit` | Audit report: snapshot/refs, skill catalog, structured output, cloud session UX gaps vs browser capsule. |
| 2.12 | diagram-design artifacts | ✅ Done | Agent swarm | `ao/p1-diagram-design` | SVG diagram renderer with pan/zoom, DAG layout, ArtifactRenderer integration. Typecheck clean for touched files. |
| 2.13 | Happier cross-device sync | ✅ Done | Agent swarm | `ao/p2-happier-sync` | Audit + `surfaces/ai.allternit.com/src/lib/sync/sync-contract.ts` cross-device sync contract. Typecheck clean for touched file. |
| 2.14 | Claude cookbooks | ✅ Done | Agent swarm | `ao/p1-claude-cookbooks` | Dynamic Workflows cookbook ported to gizzi-code docs + `gizzi docs` CLI. Typecheck clean for touched files. |
| 2.15 | Vercel agent plugin adapter | ✅ Done | Agent swarm | `ao/p2-vercel-agent-plugin` | `VercelAgentPluginAdapter` + schema + registry + 13 tests. `bun test` and `tsc --noEmit` clean. |
| 2.16 | Qwen-MM-Plugins | ✅ Done | Agent swarm | `ao/p1-qwen-mm-plugins` | `QwenMMPluginAdapter` + schema + registry helper + 10 tests. `bun test` clean. |
| 2.17 | openresearch-cli / hyperresearch | ✅ Done | Agent swarm | `ao/p1-openresearch-tools` | `allternit-agent-tools-router` crate + OpenResearch/HyperResearch adapters + API routes + `gizzi research` CLI. 6 tests passing. |
| 2.18 | **Unsloth guides & notebooks feed** | ⏳ Queued | — | — | Discovery section inside Model Lab that surfaces Unsloth docs, model-specific guides, and free fine-tuning notebooks (e.g., Muse Glimmer 30B, GRPO RL). Users can browse, filter by model/task, and launch a notebook into a training job. |

---

## P3 — Nice-to-have / Educational / Blocked

| # | Item | Status | Owner | Location / Branch | Notes |
|---|------|--------|-------|-------------------|-------|
| 3.1 | OpenTag (Slack/Teams bridge) | ❌ Rejected as tagging solution | Audit | — | Misidentified initially; OpenTag is a Slack/Teams agent, not a tagging UI. Reclassify as optional P3 Slack/Teams bridge only if needed. |
| 3.2 | computer-use-mcp | ✅ Done | Agent swarm | `ao/p3-computer-use-mcp-audit` | Audit report: 28-tool catalog, outcome contract, canonical provider gap analysis. |
| 3.3 | page-agent | ✅ Done | Agent swarm | `ao/p3-page-agent-promotion` | Shared `services/page-agent/` package + API routes + surface re-exports. `cargo check` and typecheck clean after fix. |
| 3.4 | apitap.io | 🔄 Promoted to P1 | — | `ao/p1-apitap-capture` | Unique API-discovery-and-replay capability verified. Now tracked as **1.8 ApiTap / HAR-derived API Capture**. |
| 3.5 | hermes-eats-world PR | ❌ Rejected | — | — | The repository-level PR is immature. The relevant capability (HAR-derived API client) is captured under **1.8 ApiTap / HAR-derived API Capture**. |
| 3.6 | GuppyLM | ✅ Done | Agent swarm | `ao/p3-guppylm-audit` | Audit report: 8.7M transformer, ONNX→WASM pipeline, Browser Training tab plan. |
| 3.7 | loopany.ai templates | ✅ Done | Agent swarm | `ao/p2-loopany-spawn` | 18 curated templates + gallery + import into Automation Tasks. Typecheck clean for touched files. |
| 3.8 | SPAWN.md | ✅ Done | Agent swarm | `ao/p3-spawn-md-audit` | Audit report: workflow tracks, conformance map, agent creation integration plan. |
| 3.9 | Vercel AI CLI | ❌ Rejected | — | — | gizzi-code already covers this; borrow UX only. |

---

## Completed This Session

| Date | Item | Evidence |
|------|------|----------|
| 2026-08-12/13 | Research roadmap for all 29 items | `research/external-integration-roadmap-2026-08.md` |
| 2026-08-12 | OpenTag audit correction | Updated roadmap + steering checkpoint |
| 2026-08-12 | Allternit Tagging Subsystem — full stack | Rust routes, migration, tests, TS API/store, surface UI (`surfaces/ai.allternit.com/src/lib/tags/`, `TagPicker.tsx`, `TagManagerView.tsx`, `AgentGalleryGrid.tsx`) |
| 2026-08-12 | agent-desktop provider — Phase 1 | `crates/allternit-desktop-core/`, `crates/allternit-desktop-macos/`, `cmd/allternit-desktop-provider/`; `cargo check --workspace` clean; 10 tests passing |
| 2026-08-12 | droidrun / mobile-harness — Phase 1 | `platform/mobile-harness/`; smoke test passed; `py_compile` clean |
| 2026-08-12 | phone-harness — Phase 1 | `platform/phone-harness/`; `py_compile` clean |
| 2026-08-12 | Unsloth Model Lab — Phase 1 | `services/model-lab/`, `cmd/allternit-api/src/model_lab_routes.rs`; `cargo check` clean; 385 tests passing |
| 2026-08-13 | treg connector — Phase 1 | `platform/agent-tools-router/`; `cargo check` clean; 4 smoke tests passing |
| 2026-08-13 | agent-desktop provider — Phase 2 | Full macOS AX traversal + actions; `cargo check --workspace` clean; 14 tests passing |
| 2026-08-13 | Mobile harness API routes | `cmd/allternit-api/src/mobile_harness_routes.rs`; 6 tests passing |
| 2026-08-13 | Unsloth Model Lab UI | Catalog/Train/Jobs tabs + store + API client; `bun typecheck` clean |
| 2026-08-13 | treg ToolProvider integration | `TregToolProvider` + `/api/agent-tools/*` routes; 12 tests passing |
| 2026-08-13 | Qwen-MM-Plugins adapter | `platform/plugins/src/adapters/qwen-mm.ts`; 10 tests passing |
| 2026-08-13 | OpenMausBot packaged bots | Bots tab + 6 templates in Agent Hub; typecheck clean |
| 2026-08-13 | Claude cookbooks integration | Dynamic Workflows cookbook + `gizzi docs` CLI; typecheck clean |
| 2026-08-13 | Diagram-design artifacts | SVG diagram renderer + ArtifactRenderer integration; typecheck clean |
| 2026-08-13 | OpenResearch / HyperResearch tools | `allternit-agent-tools-router` crate + adapters + API routes + `gizzi research` CLI; 6 tests passing |
| 2026-08-13 | Surface computer-use capsule | `ComputerUseView` + desktop client/store + capsule/rail/route plumbing; typecheck clean for touched files |
| 2026-08-13 | Model Studio cloud training | Cloud tab merged into Unsloth Model Lab; backend stubs + proxy routes; `cargo check` clean; typecheck clean |
| 2026-08-13 | Agency-agents personas | 8 curated personas + Personas tab + create-agent-from-persona flow; typecheck clean |
| 2026-08-13 | Happier cross-device sync | Audit + `src/lib/sync/sync-contract.ts` cross-device sync contract; typecheck clean |
| 2026-08-13 | OpenManus patterns audit | Audit report: PlanningTool, ReAct loop, ToolCollection patterns vs Allternit |
| 2026-08-13 | browse.sh CLI browser UX audit | Audit report: snapshot/refs, skill catalog, structured output, cloud session UX gaps |
| 2026-08-13 | prime-agent dual-loop harness audit | Audit report: RLM + Continual Harness dual-loop design vs DAK Runner |
| 2026-08-13 | Vercel agent plugin adapter | `VercelAgentPluginAdapter` + schema + registry + 13 tests; `bun test` and `tsc --noEmit` clean |
| 2026-08-13 | loopany.ai templates | 18 curated templates + gallery + import into Automation Tasks; typecheck clean |
| 2026-08-13 | computer-use-mcp audit | Audit report: 28-tool catalog, outcome contract, canonical provider gap analysis |
| 2026-08-13 | page-agent promotion | Shared `services/page-agent/` package + API routes + surface re-exports; `cargo check` and typecheck clean |
| 2026-08-13 | SPAWN.md audit | Audit report: workflow tracks, conformance map, agent creation integration plan |
| 2026-08-13 | GuppyLM audit | Audit report: 8.7M transformer, ONNX→WASM pipeline, Browser Training tab plan |
| 2026-08-13 | Allternit Bot (x.ai/bot) audit | Audit report: persistent bots, shared cloud computer, skills/routines, approval model, integration plan |
| 2026-08-13 | ApiTap research & unblock | Audited ApiTap and Hermes `har-derived-api-client`; promoted ApiTap from blocked to P1 |
| 2026-08-13 | Allternit Local Engine | `services/local-engine/` + `/api/local-engine/*` proxy + Model Lab Engine/Playground tabs + Unsloth **Serve locally** action; `cargo check` clean; 15 tests passing |
| 2026-08-13 | ApiTap / HAR-derived API Capture | `services/api-capture/` + `/api/api-capture/*` proxy + Site APIs surface panel; HAR ingest, contract derivation, replay; `cargo check` clean; 4 tests passing |
| 2026-08-13 | ApiTap cross-surface integration | `sdk/computer-use/src/mcp-tool-spec.ts` + `packages/computer-use/plugins/allternit-computer-use/tools/tool-definitions.ts` + `surfaces/ai.allternit.com/src/allternit-os/kernel/AgentTools.ts` + browser toolbar record toggle + `useApiCaptureRecorder` hook; typecheck clean for touched files; cargo tests passing |

---

## Next Actions

1. **Unsloth guides & notebooks feed (2.18)** — design and implement a discovery
   section in Model Lab that pulls/curates Unsloth guides and notebooks and lets
   users launch them as training jobs.
2. **Merge/integration readiness** — schedule the integration sprint to land all
   validated feature branches (`ao/p1-local-engine`, `ao/p1-apitap-capture`, and
   earlier P1/P2 branches) into `main` with CI validation.
3. **Rejected/blocked items** — no action unless product direction changes:
   - `3.1 OpenTag` (as a tagging solution)
   - `3.9 Vercel AI CLI`

---

## Conventions

- Each P1 gets its own session worktree when it touches the monorepo.
- Typecheck or test validation is required before marking ✅ Done.
- The tracker is updated at the end of every meaningful subtask.
- "Location / Branch" refers to the Git branch or worktree where the validated
  implementation lives. Code referenced in those paths is not necessarily on `main`
  until an explicit merge/integration sprint lands it.
