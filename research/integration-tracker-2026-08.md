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
| 2.7 | Grok Bot (x.ai/bot) | ⏳ Queued | — | — | UX reference only; do not fork proprietary code. |
| 2.8 | agency-agents personas | ✅ Done | Agent swarm | `ao/p1-agency-agents` | 8 curated personas added to Agent Hub with Personas tab + create-agent-from-persona flow. Typecheck clean for touched files. |
| 2.9 | OpenManus patterns | 🔄 In Progress | Agent swarm | `ao/p2-openmanus-audit` | Audit planning/tool-use patterns. |
| 2.10 | prime-agent dual-loop harness | 🔄 In Progress | Agent swarm | `ao/p2-prime-agent-audit` | Evaluate RL + sequential dual-loop design. |
| 2.11 | browse.sh CLI browser UX | 🔄 In Progress | Agent swarm | `ao/p2-browse-sh-audit` | Borrow UX for gizzi-code browser command. |
| 2.12 | diagram-design artifacts | ✅ Done | Agent swarm | `ao/p1-diagram-design` | SVG diagram renderer with pan/zoom, DAG layout, ArtifactRenderer integration. Typecheck clean for touched files. |
| 2.13 | Happier cross-device sync | 🔄 In Progress | Agent swarm | `ao/p2-happier-sync` | Adapt relay/daemon/session-sync architecture. |
| 2.14 | Claude cookbooks | ✅ Done | Agent swarm | `ao/p1-claude-cookbooks` | Dynamic Workflows cookbook ported to gizzi-code docs + `gizzi docs` CLI. Typecheck clean for touched files. |
| 2.15 | Vercel agent plugin adapter | 🔄 In Progress | Agent swarm | `ao/p2-vercel-agent-plugin` | Add Vercel AI SDK protocol adapter to plugin-sdk. |
| 2.16 | Qwen-MM-Plugins | ✅ Done | Agent swarm | `ao/p1-qwen-mm-plugins` | `QwenMMPluginAdapter` + schema + registry helper + 10 tests. `bun test` clean. |
| 2.17 | openresearch-cli / hyperresearch | ✅ Done | Agent swarm | `ao/p1-openresearch-tools` | `allternit-agent-tools-router` crate + OpenResearch/HyperResearch adapters + API routes + `gizzi research` CLI. 6 tests passing. |

---

## P3 — Nice-to-have / Educational / Blocked

| # | Item | Status | Owner | Location / Branch | Notes |
|---|------|--------|-------|-------------------|-------|
| 3.1 | OpenTag (Slack/Teams bridge) | ❌ Rejected as tagging solution | Audit | — | Misidentified initially; OpenTag is a Slack/Teams agent, not a tagging UI. Reclassify as optional P3 Slack/Teams bridge only if needed. |
| 3.2 | computer-use-mcp | ⏳ Queued | — | — | Audit for schema improvements only. |
| 3.3 | page-agent | ⏳ Queued | — | — | Promote existing extension integration to shared service. |
| 3.4 | apitap.io | ⏸️ Blocked | — | — | Overlaps with existing providers; needs unique value proof. |
| 3.5 | hermes-eats-world PR | ⏸️ Blocked | — | — | Single PR, immature. |
| 3.6 | GuppyLM | ⏳ Queued | — | — | Educational micro-model training; not production. |
| 3.7 | loopany.ai templates | 🔄 In Progress | Agent swarm | `ao/p2-loopany-spawn` | Curate into loop library. |
| 3.8 | SPAWN.md | ⏳ Queued | — | — | Alternative agent bootstrap format. |
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

---

## Next Actions

1. **Vercel agent plugin adapter**: implement protocol adapter in plugin-sdk.
2. **OpenManus audit**: evaluate tool-use patterns for Allternit surfaces.
3. **prime-agent audit**: evaluate RL + sequential dual-loop harness design.
4. **browse.sh audit**: borrow CLI browser UX for gizzi-code browser command.
5. **Happier sync**: adapt relay/daemon/session-sync architecture.
6. **loop/SPAWN templates**: curate loop templates and SPAWN.md bootstrap format.

---

## Conventions

- Each P1 gets its own session worktree when it touches the monorepo.
- Typecheck or test validation is required before marking ✅ Done.
- The tracker is updated at the end of every meaningful subtask.
