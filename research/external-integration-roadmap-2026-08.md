# Allternit External Integration Roadmap — Deep Research & Gap Analysis

**Date:** 2026-08-12  
**Scope:** 29 external repositories/products across computer-use harness, agent hub, surfaces, model training, connectors, loops, AI CLI, artifacts, docs, and iOS.  
**Status:** Research complete; ready for phased implementation.

---

## 1. Executive Summary

Allternit already has a production-grade multi-layer agent platform: a canonical computer-use router, browser/desktop/mobile providers, a Vite/React platform shell with a typed view registry, a plugin SDK with MCP/HTTP/Native adapters, a Rust API, an Electron desktop shell, a SwiftUI iOS surface, and local model management (Ollama/HF/Bonsai/MLX). The main gaps are:

1. **No first-class tagging/annotation system** for agents, tools, scripts, and artifacts. (Note: OpenTag is not this; it is a Slack/Teams agent.)
2. **No local model training/fine-tuning stack** — only inference/download exists.
3. **Thin native mobile OS harness** — only basic ADB/idb UI-tree actions.
4. **No cross-device session continuity / remote handoff** for iOS.
5. **No agent-bot packaging layer** (à la OpenMausBot / Grok Bot) in the left rail.
6. **No deep-research CLI integration** comparable to alphaXiv/hyperresearch.
7. **No unified agent tool marketplace / credential proxy** comparable to treg.

This roadmap assigns every item a priority, recommendation, integration target, and rough steps. **P1 items** should be started immediately because they close critical gaps or are explicitly flagged by product leadership as linchpins.

---

## 2. Priority Matrix

| Priority | Count | Items |
|----------|-------|-------|
| **P1** | 6 | Allternit Tagging Subsystem, Unsloth, droidrun/mobile-harness, ShawnPana/phone-harness, agent-desktop, treg |
| **P2** | 12 | Model Studio, OpenMausBot, Grok Bot, agency-agents, OpenManus, prime-agent, browse.sh, diagram-design, Happier, Claude cookbooks, Vercel agent plugins, Qwen-MM-Plugins, openresearch-cli/hyperresearch |
| **P3** | 11 | OpenTag (Slack/Teams bridge only), computer-use-mcp, page-agent, apitap.io, hermes-eats-world PR, GuppyLM, loopany.ai templates, SPAWN.md, Vercel AI CLI, Qwen-MM-Plugins (fallback), agency-agents (fallback) |

> **P1 definition:** Closes a critical platform gap or is explicitly called a linchpin/priority by product leadership.  
> **P2 definition:** High value but can follow P1 foundations; often content/UI/adapter work.  
> **P3 definition:** Educational, niche, or blocked by P1/P2 prerequisites.

---

## 3. Allternit Baseline (Research Summary)

### 3.1 Computer Use / ACI
- **Legacy + canonical APIs** in `domains/computer-use/core/` and `sdk/computer-use/`.
- **Providers:** browser.playwright, browser.cdp, browser.extension, desktop.accessibility, desktop.cua-driver (t.la Cua), chrome-stream browser service.
- **Mobile:** `AppAgentAdapter` (Android ADB / iOS idb) with click/type/swipe/ui_tree only.
- **Gaps:** vision loop incomplete; browser service missing drag/select/resize; mobile harness is thin; no deterministic cross-app desktop refs beyond Cua.

### 3.2 Surfaces
- `surfaces/ai.allternit.com/` — Vite/React shell, `ViewType` registry, `nav.policy.ts`, `ViewRegistry.tsx`, left rail (Home/Code/Browser modes).
- `surfaces/allternit-desktop/` — Electron shell spawning CUA driver, Gizzi runtime, Rust API, Office engine, mini-apps.
- `surfaces/allternit-mobile/` — SwiftUI iOS with mesh/tsnet-ios, ACI viewport, terminal, on-device MLX not wired to chat.
- Gaps: no remote session handoff, no push backend, no mobile screen control.

### 3.3 Plugins / Agent Hub / Registry
- `packages/@allternit/plugin-sdk` with MCP/HTTP/Native/CLI/VSCode/LangChain adapters.
- `src/lib/plugins/unified-registry.ts`, `src/views/plugins/CapabilitiesManager.tsx` (Skills/Commands/CLI Tools/Plugins/MCPs/Webhooks/Connectors).
- Agent Hub: `src/views/AgentHub.tsx`, `src/lib/agents/agent.store.ts`, mode contracts in `src/lib/agents/agent-mode-contracts.ts`.
- Gaps: fragmented registries, no Vercel AI SDK agent protocol, no unified tool marketplace, no agent-bot packaging.

### 3.4 Model Training / Open Weights
- Strong inference/download UI (`LocalModelManager.tsx`, `ModelManagementView.tsx`), Ollama + HF GGUF + Bonsai.
- **No training/fine-tuning/LoRA backend.** No MLX/Unsloth/PEFT integration.

### 3.5 Docs / A://Labs
- Mintlify docs at `docs/public/`, A://Labs pipeline at `alabs-generated-courses/`.
- No Claude-specific cookbooks, no local model training course module.

---

## 4. Detailed Findings by Category

### 4.1 Computer Use Harness Additions

#### 4.1.1 agent-desktop (`lahfir/agent-desktop`)
- **URL:** https://github.com/lahfir/agent-desktop
- **What it is:** Native Rust CLI + C-ABI FFI library exposing macOS accessibility trees as structured JSON. Snapshot-scoped deterministic refs (`@snapshot_id:eN`), 58 commands, semantic headless actions, progressive skeleton traversal (78–96% token reduction), actionability preflight, JSONL/HTML traces.
- **License:** Apache 2.0 (repo) / MIT (some subdirs) — verify before fork.
- **Gap vs Allternit:** Fills the deterministic cross-app desktop element-ref gap better than the existing `desktop.accessibility.canonical` Python adapter. Provides strict ref semantics and skeleton traversal that Allternit lacks.
- **Recommendation:** **FORK / ADAPT.** Wrap as a new canonical provider `desktop.agent-desktop.canonical` and possibly replace the legacy accessibility adapter on macOS.
- **Integration target:** `domains/computer-use/core/providers/agent_desktop_canonical.py`, Rust FFI bindings in `cmd/allternit-api` or desktop manager.
- **Rough steps:**
  1. Fork and vendor the Rust crate under `domains/computer-use/core/native/agent-desktop-rs/`.
  2. Build a canonical provider that spawns the CLI, sends observe/act JSON, and maps `@snapshot:eN` refs to canonical `ElementNode`/`ActionTransaction`.
  3. Add progressive skeleton observation mode to canonical `observe` endpoint.
  4. Wire into desktop Electron via `computer-use-driver-manager.ts` as alternative to Cua driver.
  5. Conformance tests against vision loop suites.
- **Priority:** **P1** — directly hardens Allternit's desktop computer-use determinism.
- **Risks:** macOS 13+ only; Windows/Linux are stubs/planned. TCC/permissions still attributed to host process.

#### 4.1.2 computer-use-mcp (`minghinmatthewlam/computer-use-mcp`)
- **URL:** https://github.com/minghinmatthewlam/computer-use-mcp
- **What it is:** An MCP server that exposes computer-use primitives (screenshot, click, type, scroll, navigate) so any MCP client can drive a browser/desktop.
- **License:** MIT.
- **Gap vs Allternit:** Allternit already has ACU MCP and canonical MCP servers. This is conceptually similar but likely simpler/standalone.
- **Recommendation:** **ADAPT** selectively. Audit its tool schema and screenshot normalization; borrow any improvements for the existing ACU MCP (`acu_mcp/server.py`).
- **Integration target:** `domains/computer-use/core/acu_mcp/server.py`, `canonical_mcp/server.py`.
- **Priority:** **P3/P2** — only if it exposes a cleaner schema or better cross-client compatibility.
- **Risks:** Potential duplication; must not fragment MCP surface.

#### 4.1.3 page-agent (`alibaba/page-agent`)
- **URL:** https://github.com/alibaba/page-agent
- **What it is:** Alibaba's page-level web agent built on browser extension / page introspection. Was already referenced inside Allternit extensions.
- **License:** Apache 2.0.
- **Gap vs Allternit:** Overlaps heavily with existing browser extension page-agent and chrome-stream browser service.
- **Recommendation:** **ADAPT / IGNORE.** Integrate any novel DOM understanding or planning modules into the existing extension page-agent (`surfaces/allternit-extensions/allternit-extension/src/agent/`), but do not fork wholesale.
- **Priority:** **P3** — extension integration already in progress.

#### 4.1.4 droidrun/mobile-harness
- **URL:** https://github.com/droidrun/mobile-harness
- **What it is:** Native mobile harness for Android (ADB) with richer agent-oriented actions: launch, tap, swipe, type, screenshot, UI tree, shell commands, file push/pull, intent launching, notification access, and task planning loop.
- **License:** MIT.
- **Gap vs Allternit:** Replaces/extends the thin `AppAgentAdapter`. Adds a task loop, richer actions, and better Android coverage.
- **Recommendation:** **FORK / INTEGRATE.** Vendor as the canonical mobile harness for Android and extend to iOS where possible.
- **Integration target:** `domains/computer-use/core/adapters/mobile/droidrun_adapter.py` or new `providers/mobile.droidrun.canonical`.
- **Rough steps:**
  1. Fork under `domains/computer-use/core/mobile-harness/droidrun/`.
  2. Wrap actions behind canonical `/{env}/mobile/actions`.
  3. Add task-planning loop and screenshot→vision provider path.
  4. Surface in iOS ACI viewport and desktop ACI sessions.
- **Priority:** **P1** — user flagged as linchpin for Compute OS; closes Android harness gap.

#### 4.1.5 phone-harness (`ShawnPana/phone-harness`)
- **URL:** https://github.com/ShawnPana/phone-harness
- **What it is:** iOS-focused harness using `pymobiledevice3` / `idb` to control iPhones: screenshot, tap, swipe, type, home, app launch, accessibility tree.
- **License:** MIT.
- **Gap vs Allternit:** Complements droidrun by covering iOS deeply; current `AppAgentAdapter` iOS path is basic.
- **Recommendation:** **FORK / INTEGRATE.** Pair with droidrun as `mobile.droidrun` (Android) + `mobile.phone` (iOS) canonical providers.
- **Integration target:** `domains/computer-use/core/adapters/mobile/phone_harness_adapter.py`.
- **Rough steps:**
  1. Fork under `domains/computer-use/core/mobile-harness/phone-harness/`.
  2. Implement iOS provider with `pymobiledevice3` fallback to `idb`.
  3. Wire to canonical router and iOS/desktop ACI surfaces.
- **Priority:** **P1** — linchpin for Compute OS mobile↔desktop seamless control.

#### 4.1.6 hermes-eats-world PR (`lEWFkRAD/hermes-eats-world/pull/1`)
- **URL:** https://github.com/lEWFkRAD/hermes-eats-world/pull/1
- **What it is:** Single PR — likely an early experiment around browser/agent world modeling.
- **Gap vs Allternit:** Insufficient maturity to evaluate.
- **Recommendation:** **IGNORE** until the PR lands and the project stabilizes.
- **Priority:** **P3**.

#### 4.1.7 apitap.io
- **URL:** https://www.apitap.io
- **What it is:** Browser automation / API tap service for web actions.
- **Gap vs Allternit:** Overlaps with existing browser providers and chrome-stream.
- **Recommendation:** **IGNORE / ADAPT.** Only integrate if it offers a unique anti-bot or enterprise proxy capability not available via Skyvern/Playwright/CDP.
- **Priority:** **P3**.

#### 4.1.8 browse.sh
- **URL:** https://browse.sh
- **What it is:** CLI browser — fetch, render, navigate, extract, screenshot from the terminal.
- **License:** Unknown / check site.
- **Gap vs Allternit:** Allternit's chrome-stream and browser providers are backend services; browse.sh is a user-facing CLI pattern.
- **Recommendation:** **ADAPT.** Fork/inspire the CLI UX for `gizzi-code browser` command or a lightweight ACI terminal tool. Reuse rendering/snapshot logic in chrome-stream.
- **Integration target:** `cmd/gizzi-code/src/cli/commands/browser/` or new `cmd/allternit-browser-cli/`.
- **Priority:** **P2** — improves CLI/browser parity; not blocking.

---

### 4.2 Docs Fork

#### 4.2.1 Claude Cookbooks — `08_Dynamic_workflows.ipynb`
- **URL:** https://github.com/anthropics/claude-cookbooks/blob/main/claude_agent_sdk/08_Dynamic_workflows.ipynb
- **What it is:** Anthropic's MIT-licensed notebook showing dynamic workflow orchestration in Claude Code: generate a JS script, spawn subagents, parallel/pipeline/phase primitives, adversarial verification pattern.
- **License:** MIT.
- **Gap vs Allternit:** Allternit has workflow engine + Rails peers but no Claude-specific cookbook content.
- **Recommendation:** **ADAPT.** Port the pattern into Allternit-flavored Mintlify docs and optionally an A://Labs module.
- **Integration target:** `docs/public/cookbooks/claude-dynamic-workflows.md` (or `docs/public/guides/claude-cookbooks.md`), `alabs-generated-courses/` optional module.
- **Rough steps:**
  1. Create Mintlify page in active docs worktree.
  2. Translate `claude-agent-sdk` examples to Allternit harness / workflow engine / Rails patterns.
  3. Register in `surfaces/docs/docs.json` nav.
  4. Optionally generate A://Labs module with quizzes.
- **Priority:** **P2** — content parity; good for onboarding.

---

### 4.3 Agents Hub

#### 4.3.1 treg (`superdesigndev/treg`)
- **URL:** https://github.com/superdesigndev/treg
- **What it is:** "OpenRouter for agent tools" — unified proxy for ~2,600 endpoints across ~42 providers (SEO, ads, enrichment, scraping). Server-side credential injection, team/org model, MCP server, skill bundles.
- **License:** Apache 2.0 with additional commercial terms (self-host free; embedding in commercial SaaS requires written permission).
- **Gap vs Allternit:** Fills the unified external-tool marketplace + credential-vault gap.
- **Recommendation:** **INTEGRATE as connector/provider.** Add treg as a first-class connector in plugin manager and as a tool provider in the agent runtime.
- **Integration target:** `src/lib/agents/tool-registry.store.ts`, `src/views/plugins/CapabilitiesManager.tsx` (Connectors tab), `cmd/allternit-api/src/tool_routes.rs` or new connector service.
- **Rough steps:**
  1. Add treg provider config (base URL, token) to settings.
  2. Implement treg catalog search + call proxy in Rust API or TS service.
  3. Expose treg tools in agent tool registry with server-side auth injection.
  4. Add Connector tab UI for browsing/searching treg catalog.
  5. Add MCP server option for external clients.
- **Priority:** **P1** — directly enables SEO/SDR/media-buyer agent personas the user asked for.
- **Risks:** Commercial license restriction; must clarify distribution terms with superdesign.dev.

#### 4.3.2 agency-agents (`msitarzewski/agency-agents`)
- **URL:** https://github.com/msitarzewski/agency-agents
- **What it is:** Large template repo of specialized AI agents (frontend wizards, Reddit ninjas, whimsy injectors, reality checkers) with personality, processes, deliverables.
- **License:** Check repo (likely MIT).
- **Gap vs Allternit:** Allternit has agent hub but no pre-packaged persona library.
- **Recommendation:** **ADAPT.** Curate and port the best personas into Allternit agent definitions/skills rather than forking the entire template.
- **Integration target:** `domains/agent/templates/`, `src/lib/agents/agent.store.ts`, Agent Hub "Marketplace" tab.
- **Priority:** **P2** (or P3 if persona count is overwhelming) — content enrichment.

#### 4.3.3 OpenManus (`FoundationAgents/OpenManus`)
- **URL:** https://github.com/FoundationAgents/OpenManus
- **What it is:** Open-source general-purpose agent framework (planning, tool use, multi-agent orchestration).
- **License:** MIT.
- **Gap vs Allternit:** Allternit has its own orchestration; OpenManus may have planning/tool-use patterns worth borrowing.
- **Recommendation:** **ADAPT.** Audit planning loop and tool-use patterns; port improvements to `allternit-agent-orchestration` rather than replacing.
- **Priority:** **P2** — research/inspiration value.

#### 4.3.4 prime-agent (`PrimeIntellect-ai/prime-agent`)
- **URL:** https://github.com/PrimeIntellect-ai/prime-agent
- **What it is:** Harness with two systems — RL-based and sequential — resembling "left brain / right brain" logical + creative loops.
- **License:** Apache 2.0.
- **Gap vs Allternit:** Allternit's harness is mostly sequential; no RL/creative dual-loop harness.
- **Recommendation:** **ADAPT / RESEARCH.** Evaluate the dual-loop design for the Allternit harness; implement as an optional harness mode.
- **Integration target:** `services/orchestration/control-plane/allternit-agent-orchestration/` or `domains/agent/templates/`.
- **Priority:** **P2** — architectural research; may become P1 if dual-loop proves valuable.

#### 4.3.5 OpenMausBot (`milind-soni/OpenMausBot`)
- **URL:** https://github.com/milind-soni/OpenMausBot
- **What it is:** Newer open-source agent bot with packaged bot UI/UX — bots appear as tabs/sessions, take tasks end-to-end, use a "consensus framework."
- **License:** MIT.
- **Gap vs Allternit:** Allternit has sessions but no packaged "bot" abstraction in the left rail.
- **Recommendation:** **FORK / ADAPT.** Implement packaged agent bots as a new view type + rail section, not a competing system.
- **Integration target:** `src/views/bots/` or `src/views/agent-hub/bots/`, `src/nav/nav.types.ts`, `src/shell/ShellRail.tsx`, `src/lib/agents/agent.store.ts`.
- **Rough steps:**
  1. Add `bot` concept to agent store: packaged definition, system prompt, tool scope, persistence.
  2. Add `BotSession` view type and rail section.
  3. Implement consensus loop (plan → execute → review → deliver) as a harness mode.
  4. Seed with OpenMausBot UX patterns (welcome card, task input, progress feed, deliverable panel).
- **Priority:** **P2** — high UX value; fits the user's "tabs in left rail sessions" vision.

#### 4.3.6 Grok Bot (x.ai/bot)
- **URL:** https://x.ai/bot
- **What it is:** X.AI's packaged agent bot (early beta), similar to what Cursor offers: a bot that can be summoned across surfaces, takes tasks, and produces artifacts.
- **License:** Proprietary.
- **Gap vs Allternit:** Same as OpenMausBot; adds a polished consumer reference.
- **Recommendation:** **REVERSE-ENGINEER / ADAPT.** Use Grok Bot as a UX reference while building Allternit's own packaged bot layer (OpenMausBot provides the open forkable base).
- **Integration target:** Same as OpenMausBot.
- **Priority:** **P2** — reference design, not code to fork.

---

### 4.4 Desktop & Surfaces Integrations

#### 4.4.1 OpenTag (`CopilotKit/OpenTag`)
- **URL:** https://github.com/CopilotKit/OpenTag
- **What it actually is:** An open-source, self-hosted **knowledge-work agent for Slack and Microsoft Teams** built on the CopilotKit Channels SDK and AG-UI protocol. It is not a composer tagging UI; it is a deployable Slack/Teams bot with a Python LangGraph agent, Node Channels runtime, approval gates, and rich native UI cards.
- **License:** MIT.
- **Gap vs Allternit:** Allternit does not currently have a native Slack/Teams agent presence. OpenTag provides a complete Channels SDK starter application for that.
- **Recommendation:** **REJECT as a tagging solution; ADAPT as optional Slack/Teams agent bridge.** Do not fork OpenTag expecting composer tagging. If Allternit wants a Slack/Teams agent surface, fork OpenTag as `services/channels-agent/` or `surfaces/channels/` and point it at Allternit's agent runtime.
- **Integration target (if pursued):** `services/opentag-bridge/` or `surfaces/channels/`, consuming Allternit agent API instead of the bundled LangGraph agent.
- **Priority:** **P3** for Slack/Teams bridge; **NOT P1** for tagging.

#### 4.4.2 Allternit Tagging Subsystem (inspired by the user's requirement, not OpenTag)
- **What it is:** A first-class tagging/annotation layer for agents, tools, scripts, artifacts, and sessions inside Allternit surfaces.
- **Gap vs Allternit:** No tagging/annotation system exists for agents/tools/scripts/artifacts.
- **Recommendation:** **BUILD.** Implement directly in Allternit surfaces. A scaffold already exists in the session worktree (`src/lib/tags/`, `src/components/tagging/`, `src/views/tags/`, Agent Hub Tags tab).
- **Integration target:** `src/components/tagging/`, `src/lib/tags/tag.store.ts`, `src/views/tags/TagManagerView.tsx`, `src/views/plugins/CapabilitiesManager.tsx`, agent/tool/skill registry backends.
- **Rough steps:**
  1. ✅ Design tag schema: id, label, color, icon, scope (`agent`, `tool`, `script`, `artifact`, `session`), metadata.
  2. Add backend table/API for tags and taggings (currently localStorage-persisted).
  3. ✅ Build `TagPicker`, `TagCloud`, `TagFilter` components.
  4. Wire `TagPicker` into agent creation/detail, composer, plugin manager, artifact library.
  5. Add tag-based filtering/search in agent hub and capabilities manager.
- **Priority:** **P1** — user explicitly wants composer tagging; the scaffold is in place.

---

### 4.5 Model Weights Training

#### 4.5.1 ModelStudio Console (Alibaba Cloud)
- **URL:** https://modelstudio.console.alibabacloud.com
- **What it is:** Cloud-managed fine-tuning (SFT, CPT, DPO, LoRA) for Qwen-family models; OpenAI-compatible API/CLI.
- **License:** Proprietary SaaS.
- **Gap vs Allternit:** No training backend; Qwen models not surfaced for training.
- **Recommendation:** **INTEGRATE as cloud training provider.** Add a "Cloud Training" tab in model management.
- **Integration target:** `surfaces/ai.allternit.com/src/views/settings/ModelManagementView.tsx`, `cmd/allternit-api/src/provider_routes.rs` or new training service.
- **Priority:** **P2** — fastest path to training, but cloud-only and vendor-locked.

#### 4.5.2 Unsloth (`unslothai/unsloth`)
- **URL:** https://github.com/unslothai/unsloth
- **What it is:** Open-source local training/inference platform: LoRA/QLoRA/RL, 2× faster training, 70% less VRAM, exports to GGUF/FP8/NVFP4/MLX. Tauri Desktop + Studio web UI.
- **License:** Dual license — **core library Apache 2.0**, **Studio UI AGPL-3.0**.
- **Gap vs Allternit:** Fills the entire missing local training stack.
- **Recommendation:** **ADAPT (backend only).** Consume Apache 2.0 Unsloth Core as the training backend; build UI in Allternit's existing surfaces. Do **not** fork AGPL Studio UI into proprietary code.
- **Integration target:** New `services/model-training/` or `domains/kernel/service/allternit-local-compute/model-training/`, extending `LocalModelManager.tsx`/`ModelManagementView.tsx`.
- **Rough steps:**
  1. License review: confirm clean separation of Apache 2.0 backend from Allternit UI.
  2. Prototype Python worker wrapping Unsloth Core for LoRA on Llama/Qwen.
  3. Define async training job API and queue.
  4. Add training UI: base model, dataset upload, method, hyperparameters, loss dashboard, export.
  5. Export trained adapters to GGUF/MLX for Allternit's existing inference paths.
  6. Add dataset helpers and synthetic data generation.
- **Priority:** **P1** — closes Allternit's largest capability gap; key to open-weights strategy.
- **Risks:** AGPL UI contamination if not careful; heavy PyTorch dependency; GPU hardware assumptions.

#### 4.5.3 GuppyLM (`arman-bd/guppylm`)
- **URL:** https://github.com/arman-bd/guppylm
- **What it is:** Tiny (~9M param) from-scratch LLM trainer + ONNX browser inference demo. **Training is Python/PyTorch, not browser.**
- **License:** README says MIT, but no LICENSE file (verify).
- **Gap vs Allternit:** Educational complete pipeline; not production.
- **Recommendation:** **ADAPT as educational content.** Use for an A://Labs module or micro-model sandbox, not the main training UI.
- **Integration target:** `alabs-generated-courses/` module; optional `services/guppy-trainer/`.
- **Priority:** **P3**.

---

### 4.6 Agent Connector Tools / Plugins

#### 4.6.1 treg (`superdesigndev/treg`)
(See 4.3.1 — P1 connector/tool marketplace.)

#### 4.6.2 Vercel Agent Plugins
- **URL:** https://vercel.com/blog/introducing-agent-plugins
- **What it is:** Vercel's agent plugin protocol for Next.js / AI SDK — declarative tools, streaming, UI components.
- **License:** Vercel proprietary / open SDK packages under their licenses.
- **Gap vs Allternit:** Allternit plugin SDK lacks Vercel AI SDK agent protocol adapter and streaming tool-call contract.
- **Recommendation:** **ADAPT.** Add a Vercel AI SDK adapter to `@allternit/plugin-sdk` and document how Vercel plugins map to Allternit capabilities.
- **Integration target:** `packages/@allternit/plugin-sdk/adapters/vercel/`, docs.
- **Priority:** **P2** — ecosystem interoperability.

#### 4.6.3 Qwen-MM-Plugins (`QwenLM/Qwen-MM-Plugins`)
- **URL:** https://github.com/QwenLM/Qwen-MM-Plugins
- **What it is:** Multimodal plugins for Qwen-VL (image understanding, OCR, grounding, etc.).
- **License:** Check repo (likely Apache 2.0 or Tongyi license).
- **Gap vs Allternit:** Qwen is already a provider, but no native Qwen multimodal plugin system.
- **Recommendation:** **INTEGRATE.** Add Qwen-MM-Plugins as native multimodal tools in Gizzi code and platform surfaces.
- **Integration target:** `cmd/gizzi-code/src/runtime/integrations/multimodal/qwen-mm/`, `src/plugins/built-in/multimodal-qwen/`.
- **Priority:** **P2** — strengthens native multimodal support.

---

### 4.7 Loops

#### 4.7.1 loopany.ai/templates
- **URL:** https://loopany.ai/templates
- **What it is:** Pre-built agent loop templates.
- **Gap vs Allternit:** Allternit has loops but no public template marketplace.
- **Recommendation:** **ADAPT.** Curate templates into Allternit loop library.
- **Integration target:** `src/views/loops/` or automation loops UI.
- **Priority:** **P3** — content, can wait until loop UI matures.

#### 4.7.2 SPAWN.md (`0xprincess/SPAWN.md`)
- **URL:** https://github.com/0xprincess/SPAWN.md
- **What it is:** Markdown-driven agent/loop spawn pattern.
- **Gap vs Allternit:** Allternit uses YAML/JSON agent definitions and SKILL.md; SPAWN.md is a similar pattern.
- **Recommendation:** **ADAPT.** Consider supporting SPAWN.md as an alternative agent bootstrap format in agent hub.
- **Integration target:** `src/lib/agents/agent-loader.ts` or `domains/agent/templates/`.
- **Priority:** **P3** — format parity.

---

### 4.8 AI CLI / Deep Research

#### 4.8.1 Vercel AI CLI (`vercel-labs/ai-cli`)
- **URL:** https://github.com/vercel-labs/ai-cli
- **What it is:** General-purpose AI CLI from Vercel.
- **Gap vs Allternit:** Allternit has gizzi-code CLI.
- **Recommendation:** **IGNORE / ADAPT UX.** Borrow UX patterns for gizzi-code; no need to fork.
- **Priority:** **P3**.

#### 4.8.2 openresearch-cli (`alphaXiv/openresearch-cli`)
- **URL:** https://github.com/alphaXiv/openresearch-cli
- **What it is:** CLI for deep research on arXiv papers.
- **License:** Check repo.
- **Gap vs Allternit:** No dedicated deep-research CLI tool.
- **Recommendation:** **INTEGRATE.** Add as a tool in agent runtime and a research mode plugin.
- **Integration target:** `src/lib/agents/tool-registry.store.ts`, `src/plugins/built-in/research/`, gizzi-code tool.
- **Priority:** **P2** — supports research agent mode.

#### 4.8.3 hyperresearch (`jordan-gibbs/hyperresearch`)
- **URL:** https://github.com/jordan-gibbs/hyperresearch
- **What it is:** Another deep-research CLI tool.
- **Recommendation:** **INTEGRATE / COMPARE.** Evaluate alongside openresearch-cli; pick the better one or support both.
- **Priority:** **P2**.

---

### 4.9 Artifacts

#### 4.9.1 diagram-design (`cathrynlavery/diagram-design`)
- **URL:** https://github.com/cathrynlavery/diagram-design
- **What it is:** Claude/Codex skill for generating 27 types of editorial SVG diagrams as self-contained HTML. MIT.
- **Gap vs Allternit:** Allternit has Mermaid but no editorial diagram design system.
- **Recommendation:** **ADAPT.** Ingest the skill into Gizzi-code and platform artifact pipeline as a new `diagram` kind.
- **Integration target:** `surfaces/ai.allternit.com/src/lib/ai/tools/generate-web-artifact.ts`, `cmd/gizzi-code/src/runtime/artifacts/`, `src/components/artifact/DiagramArtifact.tsx`.
- **Priority:** **P2** — improves artifact quality.

---

### 4.10 iOS

#### 4.10.1 Happier (`happier-dev/happier`)
- **URL:** https://github.com/happier-dev/happier
- **What it is:** Cross-device remote companion for AI coding agents (Claude Code, Codex, etc.). E2EE session sync, session handoff, file browser, diff viewer, terminal, voice assistant, MCP registry.
- **License:** MIT.
- **Gap vs Allternit:** Allternit iOS can chat but cannot hand off/resume desktop CLI sessions; no push backend; no E2EE cross-device sync.
- **Recommendation:** **ADAPT architecture, not UI.** Do not replace SwiftUI app with Happier's Expo/React Native app. Port the relay/daemon/session-sync concepts to Allternit.
- **Integration target:** New `cmd/allternit-relay` or extensions to `cmd/allternit-api`, `cmd/gizzi-code` daemon mode, `surfaces/allternit-mobile/ios/Features/Chat/`.
- **Rough steps:**
  1. Audit Happier protocol (`packages/protocol`, relay, daemon).
  2. Design Allternit device pairing + E2EE session envelopes.
  3. Build relay endpoints for session sync and push routing.
  4. Add gizzi-code daemon mode.
  5. Update iOS ChatViewModel for attach/resume/fork session.
  6. Finish push notification backend + entitlements.
- **Priority:** **P2** — strategic cross-device upgrade; Allternit iOS is already functional.

---

## 5. Cross-Cutting Framework Plan: Allternit Compute OS

The user called out **mobile harness + desktop computer-use** as the linchpin for an "Allternit Compute OS" where mobile and desktop OSes are seamlessly controllable. The following architecture is recommended:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Allternit Compute OS                         │
├─────────────────────────────────────────────────────────────────────┤
│  Control Plane                                                        │
│  └── domains/computer-use/core/canonical_router.py                   │
│      ├── Providers: browser.*, desktop.*, mobile.*                   │
│      └── Unified element refs: @eN across all surfaces               │
├─────────────────────────────────────────────────────────────────────┤
│  Desktop OS Layer                                                     │
│  ├── desktop.cua-driver       (macOS native, existing)               │
│  ├── desktop.accessibility    (existing)                             │
│  └── desktop.agent-desktop    (new — deterministic AX refs)          │
├─────────────────────────────────────────────────────────────────────┤
│  Mobile OS Layer                                                      │
│  ├── mobile.droidrun          (new — Android harness)                │
│  ├── mobile.phone-harness     (new — iOS harness)                    │
│  └── mobile.appagent          (existing fallback)                    │
├─────────────────────────────────────────────────────────────────────┤
│  Cross-Device Session / Relay                                         │
│  ├── cmd/allternit-relay      (new — E2EE session sync)              │
│  ├── cmd/gizzi-code --daemon  (new — local provider host)            │
│  └── surfaces/allternit-mobile/ios/  (resume/handoff UI)             │
├─────────────────────────────────────────────────────────────────────┤
│  Surfaces                                                             │
│  ├── Desktop Electron       → spawn drivers, host relay              │
│  ├── Web Platform           → ACI dashboard, agent bot tabs          │
│  ├── iOS SwiftUI            → remote session + ACI viewport          │
│  └── Browser Extension      → page-agent + native messaging          │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.1 Mobile Harness Integration Milestones

| Phase | Deliverable | Owner Path |
|-------|-------------|------------|
| 0 | Fork droidrun + phone-harness into `domains/computer-use/core/mobile-harness/` | domains/computer-use/core/ |
| 1 | Canonical `mobile.droidrun` and `mobile.phone` providers | domains/computer-use/core/providers/ |
| 2 | Screenshot + vision loop for mobile | chrome-stream + vision providers |
| 3 | iOS ACI viewport upgrade to live screenshot stream | surfaces/allternit-mobile/ios/Features/ACI/ |
| 4 | Desktop ACI can attach to a phone as an environment | surfaces/allternit-desktop/ |
| 5 | Cross-device relay for session handoff | cmd/allternit-relay + gizzi daemon |

---

## 6. Implementation Sequence (Recommended)

### Phase A — Foundation (Weeks 1–4)
1. **Allternit Tagging Subsystem** (P1) — tagging/annotation layer across surfaces; smallest scoped high-impact win. OpenTag is not the source; build it directly.
2. **agent-desktop** (P1) — deterministic desktop AX provider; hardens computer-use.
3. **treg connector** (P1) — external tool marketplace; unlocks SEO/SDR/media-buyer personas.

### Phase B — Compute OS (Weeks 3–8)
4. **droidrun/mobile-harness** (P1) — Android provider.
5. **phone-harness** (P1) — iOS provider.
6. **Cross-device relay + gizzi daemon** (P2/P1-follow-up) — session handoff.

### Phase C — Open Weights (Weeks 5–10)
7. **Unsloth backend** (P1) — local LoRA/QLoRA training worker.
8. **Training UI** (P1/P2) — tabs in `ModelManagementView` + export to GGUF/MLX.
9. **Model Studio cloud training tab** (P2) — parallel cloud option.

### Phase D — Agent Bots & Content (Weeks 6–12)
10. **OpenMausBot packaged bots** (P2) — left-rail bot sessions.
11. **agency-agents personas** (P2) — curated marketplace personas.
12. **diagram-design artifact kind** (P2) — editorial diagrams.
13. **Claude cookbooks** (P2) — docs + A://Labs module.

### Phase E — Research & Connectors (Weeks 8–14)
14. **openresearch-cli / hyperresearch** (P2) — deep research tools.
15. **Vercel agent plugin adapter** (P2) — ecosystem bridge.
16. **Qwen-MM-Plugins** (P2) — native multimodal plugins.
17. **Happier cross-device architecture** (P2) — if Phase B relay needs refinement.

---

## 7. Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| **Unsloth AGPL UI contamination** | Use Apache 2.0 core only; legal review if any UI code is borrowed. |
| **treg commercial license** | Contact jason@superdesign.dev to clarify embedding terms before shipping. |
| **Mobile harness hardware dependencies** | Gate training/features by environment; document GPU/ADB/idb requirements. |
| **iOS push/backend signing** | Fix `DEVELOPMENT_TEAM` and backend APNs endpoint before Happier-style handoff. |
| **Vision loop not complete** | Complete vision loop before agent-desktop/mobile screenshot paths reach production. |
| **Plugin registry fragmentation** | Unify `@allternit/plugin-sdk`, `platform/plugins/`, gizzi `.claude-plugin`, and surface `UnifiedPluginRegistry` as a P0 meta-task. |
| **Scope explosion** | Strictly phase implementation; do not attempt all P2s in parallel. |

---

## 8. Immediate Next Steps

1. Review and approve this roadmap.
2. Choose the first P1 to scaffold. Recommended order:
   - **OpenTag** (fastest user-visible win, explicit priority)
   - **agent-desktop** (hardens core computer-use)
   - **treg connector** (unlocks external personas)
   - **droidrun + phone-harness** (Compute OS linchpin)
   - **Unsloth backend** (largest strategic gap)
3. Create design docs / RFCs for each P1 before coding.
4. Update this roadmap as items ship or priorities change.
