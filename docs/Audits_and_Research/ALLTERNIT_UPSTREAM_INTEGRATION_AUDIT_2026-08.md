# Allternit upstream integration audit and execution roadmap

**Date:** 2026-08-12  
**Scope:** computer use, browser use, mobile control, Agent Hub, docs/cookbooks, model training, plugins, loops, research CLI, artifacts, and iOS  
**Status:** research and architecture proposal; no upstream code has been copied  
**Decision vocabulary:** **adopt** (consume with a pinned adapter), **extract** (reimplement a bounded subsystem), **fork** (maintain an Allternit derivative), **reference** (use as product/design input), **reject** (do not integrate now)

## Executive decision

Do not merge these projects directly into individual surfaces. Allternit already has most of the necessary product shells and several overlapping runtimes. The durable move is to add shared capability planes and make every surface a client:

1. **Interaction Plane** — one observation/action protocol for browser DOM, desktop accessibility, screenshots/vision, Android, iOS Portal, and iPhone Mirroring.
2. **Agent Package Plane** — one signed package model for agents, bots, skills, tools, plugins, cookbooks, and loop templates.
3. **Model Lab Plane** — isolated local/remote training jobs, datasets, model artifacts, inference endpoints, and evaluation receipts.
4. **Research and Artifact Plane** — evidence graph, source/claim provenance, reproducible research runs, and high-quality artifact renderers.

The highest-value first moves are:

- adopt `agent-desktop` semantics and evaluate its Apache-2.0 Rust implementation as the macOS accessibility backend;
- add `mobilerun-core` and iPhone Mirroring as separate adapters behind a new `DeviceSession` contract;
- promote the existing Page Agent extension code into a browser-wide capability service instead of reintegrating it a second time;
- add ApiTap-style network capture/replay as an optimization lane after policy and provenance controls exist;
- import Qwen MM capabilities as separately installable skill + MCP packages, not hard-coded Gizzi features;
- use Unsloth as an isolated worker/sidecar behind Allternit's Model Lab API rather than forking its full UI immediately;
- import Agency Agents through a normalized, reviewed catalog pipeline, not by copying hundreds of prompts into the built-in registry;
- borrow OpenMausBot's canonical event stream, bot roster, and inline approval UX while preserving Allternit's existing Sessions and Agent Hub;
- use HyperResearch's evidence/claim concepts and openresearch-cli's compute adapters as complementary layers;
- integrate diagram-design as a renderer skill and artifact contract fixture.

## Current Allternit baseline

This audit is against the repository, not a hypothetical greenfield platform.

### Computer and browser use already present

- `packages/computer-use/plugins/allternit-computer-use/` already defines commands, skills, cookbooks, planning/recovery/verification subagents, HTTP/MCP adapters, recording, replay, screenshots, browser navigation, and desktop control.
- `surfaces/allternit-extensions/allternit-extension/` already declares `@page-agent/core`, `@page-agent/llms`, `@page-agent/page-controller`, and `@page-agent/ui`. Its background/content/main-world entrypoints explicitly combine browser-agent and Page Agent behavior.
- `surfaces/allternit-extensions/allternit-extension/src/browser-agent/protocol-transport.ts` already speaks `@allternit/computer-use-protocol`.
- the current extension is therefore the existing Page Agent integration. The missing work is promotion, lifecycle ownership, multi-browser transport, policy, and cross-surface UX.
- `cmd/cli/src/commands/computer-use.ts` exists, but the repository's own surface audit reports incomplete Gizzi/CLI and host-OS parity.

### Mobile and session surfaces already present

- `surfaces/allternit-mobile/ios/` is a native Swift app with Agent Hub, agent-mode, cowork, loop, runtime, model, project, node, and workspace stores.
- iOS ACI computer use is browser-scoped; it is not a host-OS automation engine.
- web already has `AgentHub.tsx`, a local agent registry, dedicated agent-session views, plugin settings, artifact rendering, and multiple mode-specific surfaces.
- desktop already owns native process and computer-use concerns; it should host local drivers, permissions, and signing rather than duplicating orchestration logic in renderers.

### Existing architectural constraint

All new backends should enter through a shared protocol and capability registry. Direct imports from upstream projects into Web, Desktop, iOS, or Gizzi would recreate four different implementations and make permissions, receipts, replay, and upgrades diverge.

## Target architecture

```text
Allternit surfaces
  Web | Desktop | iOS | Gizzi CLI | Browser extension
                         |
                 Capability Gateway
  auth | policy | approval | leases | audit | streaming | artifact store
                         |
     +-------------------+---------------------+
     |                   |                     |
Interaction Plane   Agent Package Plane   Model/Research Plane
     |                   |                     |
browser-dom         agents/bots             training jobs
browser-cdp         skills/plugins          datasets/models
desktop-ax          tools/connectors         evidence/claims
desktop-vision      cookbooks/loops          reports/artifacts
android-adb/http    versions/signatures      evals/receipts
ios-portal/mirror   permissions/secrets      compute adapters
```

### Canonical Interaction Plane contract

Add a versioned contract in `packages/@allternit/computer-use-protocol` (or move the existing protocol there if it is currently elsewhere in the workspace):

```ts
type TargetKind =
  | 'browser-dom'
  | 'browser-cdp'
  | 'desktop-accessibility'
  | 'desktop-vision'
  | 'android'
  | 'ios-portal'
  | 'ios-mirror'

interface Observation {
  sessionId: string
  revision: string
  target: TargetDescriptor
  screenshot?: ArtifactRef
  tree?: AccessibilityTree
  refs: ElementRef[]
  capabilities: CapabilitySet
  timestamp: string
}

interface ActionRequest {
  sessionId: string
  expectedRevision?: string
  action: SemanticAction | CoordinateAction | ScriptAction
  idempotencyKey: string
  risk: 'read' | 'write' | 'destructive' | 'credential'
}

interface ActionReceipt {
  attempted: boolean
  verified: boolean
  beforeRevision?: string
  afterRevision?: string
  evidence: ArtifactRef[]
  error?: StructuredRecoveryError
}
```

Required invariants:

- element refs are scoped to a revision/snapshot and stale refs never silently retarget;
- adapters advertise capabilities; callers do not guess platform support;
- mutating actions carry idempotency keys and return verified receipts;
- per-target leases prevent concurrent agents from interleaving actions;
- semantic actions are preferred, then target-local events, then coordinates/vision;
- credential, purchase, publish, delete, and external-message actions cross explicit approval gates;
- recordings redact secrets and separate operational telemetry from replayable user data;
- every adapter exposes `doctor`, permissions, health, and recovery hints.

## Source-by-source decisions

### 1. Computer Use Harness Addition

#### `lahfir/agent-desktop` — **adopt behind adapter; fork only if upstream collaboration fails**

**What it contributes:** Apache-2.0 Rust CLI; macOS accessibility trees; compact JSON; snapshot-scoped deterministic refs; progressive skeleton traversal; semantic controls; surface/window/app/notification/clipboard APIs; batch actions; structured stale-ref recovery. Upstream is active and macOS-only today.

**Gap against Allternit:** Allternit has agent workflow, vision, Playwright, recording, replay, prompts, and transports, but lacks an equally mature native AX observation/action implementation in the shared computer-use plane.

**Add:**

- `DesktopAccessibilityAdapter` translating its snapshots and errors to Allternit's canonical protocol;
- compact/skeleton observations and drill-down by root ref to reduce model tokens;
- snapshot-scoped refs and explicit `STALE_REF` recovery;
- semantic idempotent actions (`check`, `uncheck`, `expand`, `collapse`, `select`);
- app/window/surface enumeration and permission doctor;
- native Rust daemon ownership in Allternit Desktop, with Gizzi and Web connecting through the gateway.

**Do not copy:** its calling-agent loop or CLI UX into each surface. Keep Allternit's planner, approvals, receipts, and recording.

**Fork trigger:** only for required protocol hooks, multi-session daemon behavior, or signing/distribution changes that upstream declines. Prefer a pinned dependency plus a thin process adapter first.

Source: <https://github.com/lahfir/agent-desktop>

#### `minghinmatthewlam/computer-use-mcp` — **extract design patterns; time-box a backend spike**

**What it contributes:** MIT Swift 6, macOS 14+, single MCP binary, background-safe control without moving the human cursor/focus, accessibility-first plus pixel fallback, layered event delivery, verified post-actions, shared engine daemon, per-app leases, locator re-resolution, destructive-action confirmation, and teach/replay.

**Gap against Allternit:** background-safe input, verified postconditions, per-app concurrency leases, stable code signing/TCC identity, and model-free deterministic replay are stronger than the current Allternit design documents demonstrate.

**Add:**

- an experimental `BackgroundMacAdapter` behind the same contract;
- a per-app lease manager in the gateway, not inside a single vendor adapter;
- action postcondition verification and fresh-state receipts;
- stable signed helper/app identity so macOS permissions survive upgrades;
- deterministic recorded skills that resolve locators at replay time.

**Decision gate:** run a focused comparison with `agent-desktop` across Finder, Safari, Electron, Slack, dialogs, occluded windows, and two concurrent sessions. Select one native backend as default; keep the other optional. Do not ship two overlapping default tool sets.

Source: <https://github.com/minghinmatthewlam/computer-use-mcp>

#### `alibaba/page-agent` — **promote existing integration; do not fork again**

**What it contributes:** MIT in-page text/DOM agent, BYO models, optional Chrome extension for multi-page work, and beta MCP. It is explicitly a client-side web-enhancement tool rather than a server-side browser runtime.

**Allternit reality:** the extension already imports its workspace packages and its entrypoints already merge Page Agent and browser-agent behavior. This item is partly complete.

**Remaining work:**

- move Page Agent execution behind a `BrowserDomAdapter` exposed to every surface;
- separate in-page DOM execution from extension tab orchestration and CDP/Playwright;
- create browser session records in Rails/API so Desktop, Web, iOS, and Gizzi see the same run;
- expose page masks, activity, history, and takeover through the shared session UI;
- add Firefox/Safari adapters only through a browser transport interface;
- enforce origin allowlists, tab grants, prompt-injection boundaries, and cross-origin navigation receipts;
- remove upstream Page Agent branding/links from production-facing Allternit UI while preserving license notices.

Source: <https://github.com/alibaba/page-agent>

#### `droidrun/mobile-harness` — **adopt harness knowledge; integrate `mobilerun-core` as adapter**

**What it contributes:** MIT Markdown harness plus a single `Mobilerun` facade for cloud devices, local Android ADB, Android Portal HTTP, and iOS Portal HTTP; capability discovery; accessibility search; node taps; verified scroll; app lifecycle; screenshots; optional cloud browser script execution; platform/app/recovery guides.

**Gap against Allternit:** there is no shared native mobile device session protocol across desktop, iOS UI, Gizzi, and web. Allternit iOS is a client surface, not yet a general device driver.

**Add:**

- `MobileRunAdapter` in a sandboxed Python worker managed by Desktop/compute;
- `DeviceRegistry` records for physical, simulator, emulator, cloud, and portal devices;
- capability probing (`supports`) as a required protocol feature;
- platform/app knowledge cards as Agent Package Plane resources;
- device reservations/leases, health, battery/network state, and disconnect recovery;
- streams for screenshots, accessibility revisions, actions, receipts, and human takeover.

**Do not fork first:** the harness intentionally contains operating instructions rather than runtime logic. Track `mobilerun-core` as the runtime dependency and keep Allternit-specific policy outside it.

Source: <https://github.com/droidrun/mobile-harness>

#### `ShawnPana/phone-harness` — **adopt as a macOS-only fallback adapter**

**What it contributes:** MIT iPhone control through Apple's iPhone Mirroring, window capture, Vision OCR, and CGEvent input without jailbreak, Xcode, or WebDriverAgent. It is small, editable, and works where there is no useful UI tree.

**Gap/limits:** one phone/session; requires a frontmost mirroring window; OCR has text rather than semantics; no multitouch, camera/Face ID, or DRM capture; macOS Sequoia dependency.

**Add:**

- `IOSMirrorAdapter` as a distinct capability-degraded transport;
- OCR observations with confidence and coordinate transforms;
- `waitStable`/before-after visual verification;
- explicit `requiresForeground`, `singleSession`, `noBiometric`, and `noMultitouch` capabilities;
- handoff UI when a task requires physical unlock, biometric confirmation, or camera.

**Rule:** never pretend this is equivalent to iOS Portal. The router chooses Portal for structured automation and Mirroring for user-device reach/fallback.

Source: <https://github.com/ShawnPana/phone-harness>

#### `lEWFkRAD/hermes-eats-world` PR #1 — **reference after manual provenance review**

The provided reference is a pull request, not a stable project release. Treat it as experimental design input. Capture the exact commit SHA, changed-file inventory, license of the base repository, and provenance before borrowing any implementation. No production dependency should point at a mutable PR ref.

Source: <https://github.com/lEWFkRAD/hermes-eats-world/pull/1>

#### ApiTap — **adopt concepts; adapter/fork decision after license and threat-model review**

**What it contributes:** capture browser network traffic once, produce a parameterized signed endpoint skill, then replay directly with structured JSON; CDP attach to existing signed-in Chrome; auth separated into encrypted storage; drift detection; SSRF/header-injection controls; PII scrubbing; read-only capture.

**Best Allternit use:** a `browser-api` fast lane under computer use:

```text
task -> known signed endpoint skill? -> direct replay
     -> unknown/read-only?          -> browser capture + proposed skill
     -> UI-only or unsafe endpoint? -> DOM/CDP/vision interaction
```

**Required controls:** user authorization for capture, origin and method allowlists, schema/provenance signatures, replay risk classification, CSRF/nonce detection, auth isolation in Vault, robots/terms awareness, rate limits, response validation, and automatic fallback when endpoints drift.

**Do not position it as a browser replacement.** It cannot safely reproduce arbitrary UI semantics, consent, CAPTCHAs, passkeys, human approvals, or UI-only workflows.

Sources: <https://www.apitap.io/>

#### browse.sh — **reference/adapt CLI ergonomics; do not fork without source/license**

**What it contributes:** one agent-oriented CLI for local/cloud browser sessions, low-level primitives, accessibility refs, console/network tailing, and site-specific skills with selectors/XHR hints.

**Add to Allternit:** a compact `gizzi browser` command family over the shared protocol; session aliases; local/cloud parity; `network --tail` and `console --tail`; installable domain knowledge packs; browser-skill versioning and provenance.

**Gate:** the public site describes the CLI, but a fork requires identifiable source code and license. Until verified, copy no code or proprietary catalog data.

Source: <https://browse.sh/>

### 2. Allternit Docs Fork

#### Anthropic dynamic workflows cookbook — **import as a versioned, attributed cookbook**

Convert `08_Dynamic_workflows.ipynb` into an Allternit-native cookbook with:

- the original notebook preserved under vendor references with commit SHA and license attribution;
- a generated Markdown/interactive lesson in Allternit Docs/A://Labs;
- examples mapped to Allternit agents, tools, Rails, approvals, and artifacts;
- executable cells disabled by default and promoted to isolated jobs when run;
- a sync manifest so upstream changes can be reviewed rather than overwritten.

Do not blend vendor-specific SDK claims into canonical Allternit architecture docs. Keep an explicit “upstream example” layer and an “Allternit translation” layer.

Source: <https://github.com/anthropics/claude-cookbooks/blob/main/claude_agent_sdk/08_Dynamic_workflows.ipynb>

### 3. Agents Hub and packaged bots

#### `superdesigndev/treg` — **reference architecture; no fork until licensing is explicit**

**What it contributes:** a task-oriented tool catalog, metered provider calls, team-owned credentials, server-side secret injection, endpoint/CLI/skill registration, org roles, audit logs, OAuth refresh, and a credential preference ladder.

**Fit:** this belongs in Allternit Connectors/Tools and the Agent Package Plane, not Agent Hub itself. Agent Hub consumes tool packages; it should not own credential proxying.

**Add:** capability search by job rather than vendor; price/cost metadata; organization-scoped tool grants; server-side key injection; health and audit; explicit selection when equivalent providers exist; HTTP 402/cost receipts; `llms.txt`-style machine onboarding.

**Do not add yet:** shared third-party paid-account brokering until vendor terms, resale rights, liability, abuse controls, and repository licensing are cleared. GitHub reports no recognized license at audit time.

Source: <https://github.com/superdesigndev/treg>

#### `msitarzewski/agency-agents` — **adopt through catalog ingestion, not source-tree copy**

**What it contributes:** a large MIT catalog of specialized agent Markdown files plus converters/installers for many coding agents.

**Add:** an importer that maps agent identity, purpose, triggers, workflow, tools, outputs, success metrics, and license into the canonical Allternit agent schema; preview/diff; content lint; duplicates/taxonomy; trust badges; upstream version and update channel.

**Quality gate:** every imported agent must have a bounded purpose, non-conflicting permissions, test prompts, expected deliverables, and a maintainer/review status. The large star count is demand evidence, not quality evidence for each prompt.

Source: <https://github.com/msitarzewski/agency-agents>

#### `FoundationAgents/OpenManus` — **extract patterns; do not fork as a second runtime**

Useful patterns include ReAct/tool-call/planning agent separation, sandbox agents, MCP server/client support, ask-human, browser/search/data visualization, and A2A examples. Allternit already has a broader platform and should map these concepts onto its runtime, tools, Rails, and sessions.

Extract conformance fixtures for planning/tool calls, sandbox tool boundaries, and termination. Do not import the Python application as a competing agent kernel.

Source: <https://github.com/FoundationAgents/OpenManus>

#### `PrimeIntellect-ai/prime-agent` — **spike RLM and long-running-agent concepts**

This is not simply a “creative brain.” It describes a self-improving RLM coding agent with persistent IPython, subagents, skills, long-running/detached agents, heartbeats/schedules, JSON/RPC modes, and provider abstraction.

**Add experimentally:**

- a cognitive-strategy field (`sequential`, `recursive`, `ensemble`, `policy-trained`) rather than hard-coding left/right-brain metaphors;
- persistent computation kernels as isolated session resources;
- long-running agent detach/reattach, goals, heartbeats, and schedules through Rails;
- policy/eval improvement loops gated by datasets, frozen benchmarks, budgets, and promotion approval;
- cross-provider handoff and session-resource tests.

**Hard boundary:** no agent self-modification reaches production without immutable training/eval inputs, before/after benchmarks, security review, rollback artifact, and a human promotion gate.

Source: <https://github.com/PrimeIntellect-ai/prime-agent>

#### `milind-soni/OpenMausBot` and Grok Bot — **extract UX/runtime contracts; integrate as an Agent Hub view mode**

OpenMausBot's strongest reusable elements are a bot-as-contact roster, per-bot model/computer/apps, local harness drivers, one canonical SSE event stream, inline approvals/questions, screenshots folded into the transcript, connector marketplace, pin/unread/duplicate/hide controls, and graceful unavailable-provider states.

**Allternit implementation:**

- add a `bot` presentation/profile type to canonical Agent records; a bot is not a new runtime entity;
- add a Bots filter/tab in the existing left rail and Agent Hub;
- keep each bot backed by normal Allternit Sessions, permissions, Rails events, memory, connectors, and computer sessions;
- normalize provider events once in Rails/API, then let Web/Desktop/iOS/Gizzi fold the same stream;
- support bot templates/packages, duplication, install/update provenance, model policy, workspace, and optional compute target;
- add inline approval and human-question cards to every surface.

**Grok Bot caveat:** reverse engineer public behavior and interaction patterns only. Do not copy private implementation, assets, text, or trade dress. OpenMausBot is the licensable implementation reference; xAI is a product benchmark.

Sources: <https://github.com/milind-soni/OpenMausBot>, <https://x.ai/bot>

### 4. Desktop and cross-surface tagging

#### `CopilotKit/OpenTag` — **reject for composer tagging; adopt selected channel patterns**

The linked repository currently describes an MIT Slack/Microsoft Teams on-call triage app using Channels SDK. It is not an `@agent` composer-tag library. Its reusable parts are channel lifecycle, thread subscription semantics, sender context, native channel UI, human-in-the-loop write confirmation, resumable interrupts, and deployment shape.

For the requested visual tagging feature, build against Allternit's own registries:

- parser: typed token spans for `@agent`, `/command`, `$skill`, `#artifact`, `+connector`, and optionally `!tool`;
- resolver: federated search across canonical registries with permissions and availability;
- composer UI: accessible popover, grouping, recent/favorite entities, keyboard navigation, chips, unresolved/error state;
- serialization: stable IDs in structured message parts, with human-readable fallback text;
- runtime: resolve packages at send time, snapshot versions into the session, and display exact grants;
- surfaces: shared TypeScript core for Web/Desktop/extension, equivalent Swift component on iOS, compact textual completion in Gizzi.

Use OpenTag only if Allternit adds Slack/Teams channel agents.

Source: <https://github.com/CopilotKit/OpenTag>

### 5. Model Weights Training / Model Lab

#### Alibaba Cloud ModelStudio Console — **benchmark UX and integrate through official APIs**

Do not scrape and clone a signed-in cloud console as the product architecture. Use browser capture only to document flows you are authorized to access, then implement provider-neutral product capabilities backed by official APIs/SDKs:

- models and dataset registry;
- training/fine-tuning job wizard;
- job logs, metrics, checkpoints, evaluations, and cost estimates;
- deployments/endpoints and credentials;
- experiment comparison and lineage;
- provider adapter for Model Studio/DashScope.

Scraping is brittle, may expose secrets, and can violate terms. UI screenshots may inform interaction design but should not be copied.

Source: <https://www.alibabacloud.com/help/en/model-studio/>

#### `unslothai/unsloth` — **adopt as isolated training/inference worker; evaluate UI extraction later**

**What it contributes:** Apache-2.0 local run/train/deploy stack, desktop and Studio UI, CPU/NVIDIA/AMD/Intel/macOS support, multi-GPU, LLM/diffusion/audio/embedding training, LoRA/QLoRA/full fine-tuning/RL/GRPO/DPO, data recipes, export formats, OpenAI-compatible serving, and agent connections.

**Architecture:**

- Allternit owns Model Lab UI, job records, policy, artifact lineage, and provider routing;
- an `UnslothWorker` runs in a local sandbox/container or selected compute node;
- job specs are declarative and immutable; logs/metrics stream through Rails;
- outputs enter the Model Registry with base model, dataset hashes, recipe, hardware, package versions, license, evals, and export variants;
- inference endpoints register as ordinary model providers for all Allternit surfaces.

**First slice:** model discovery/download, hardware probe, chat/inference, dataset recipe, one LoRA job, evaluation, GGUF export, and OpenAI-compatible registration. Defer broad diffusion/audio/RL UI until the core job/lineage contract is stable.

Source: <https://github.com/unslothai/unsloth>

#### `arman-bd/guppylm` — **reference as an educational/browser-inference sample**

GuppyLM trains a tiny ~8.7M vanilla transformer in Colab and runs a quantized ONNX model in-browser. It is excellent for A://Labs and a Model Lab “from scratch” tutorial, but it is not a browser training platform or production training backend.

Add it as an attributed course/sample demonstrating synthetic data, tokenizer training, small-model training, ONNX export, quantization, WebAssembly inference, and the limitations of tiny context/model capacity.

Source: <https://github.com/arman-bd/guppylm>

### 6. Multimodal Plugin for Gizzi and all surfaces

#### Vercel agent plugins — **extract lifecycle/context-ranking concepts**

Vercel's published plugin design includes a knowledge graph, specialist agents, commands, lifecycle hooks, a project profiler, priority-ranked/deduplicated/budgeted context injection, and post-tool validation.

Map this to Allternit's plugin runtime:

- declarative triggers: globs, imports, commands, prompt intent, workspace type, and runtime events;
- per-session dedupe and context budget ledger;
- hook permissions and deterministic ordering;
- post-tool validators that return structured findings rather than silently mutate;
- plugin provenance, compatibility, signatures, update policy, and uninstall cleanup;
- a compiled matcher index rather than loading every plugin prompt.

Source: <https://vercel.com/changelog/introducing-vercel-plugin-for-coding-agents>

#### `QwenLM/Qwen-MM-Plugins` — **adopt capability packages and adapter pattern**

**What it contributes:** Apache-2.0 separately installable Skill + optional MCP capabilities, with native manifests for several harnesses. The tree includes core image/video readers and renderers, crop/bounding-box utilities, OCR/grounding/vision chat/ASR/segmentation APIs, search, video memory/editing, education, Blender, and FreeCAD capabilities.

**Add:**

- import each capability as an independent Allternit package with its own permissions, dependencies, model requirements, license, and update channel;
- translate `.codex-plugin`/`.claude-plugin` manifests through the existing Plugin SDK rather than embedding Qwen-only assumptions;
- register media producers/readers and artifacts with typed MIME and provenance;
- route API-backed features through provider adapters and local features through sandboxed workers;
- support the packages across Gizzi, Web/Desktop sessions, and eligible iOS flows.

Start with `core` and `api`; gate Blender/FreeCAD/video editing behind explicit local app/compute capabilities.

Source: <https://github.com/QwenLM/Qwen-MM-Plugins>

### 7. Loops and governance templates

#### Loopany templates — **reference/import only through a signed template contract**

Evaluate individual templates, not the gallery as one dependency. Normalize trigger, inputs, steps/DAG, tools, secrets, approvals, retry/idempotency, schedule, outputs, cost budget, and license. Imported templates are drafts until validation passes; external writes stay approval-gated.

Source: <https://loopany.ai/templates>

#### `0xprincess/SPAWN.md` — **extract governance artifacts; no runtime integration needed**

Useful concepts are append-only architecture proposals, a machine-readable conformance map, predeclared experiments with budgets and falsifiable criteria, explicit autonomy grants/invariants/escalation, normative goals separated from descriptive handoff, and session verification of inherited claims.

Map these into Allternit Projects/Rails as optional governance templates. Do not impose them on every task. GitHub reports no recognized license at audit time, so copy no text until licensing is resolved.

Source: <https://github.com/0xprincess/SPAWN.md>

### 8. AI CLI and deep research

#### `vercel-labs/ai-cli` — **reference UX; license gate before code reuse**

Treat it as a terminal-generation UX benchmark. Allternit already has Gizzi, provider routing, tools, artifacts, and sessions; a second general AI CLI would fragment state. Extract only bounded command/streaming/output patterns after source review. GitHub reports no recognized license at audit time.

Source: <https://github.com/vercel-labs/ai-cli>

#### `alphaXiv/openresearch-cli` — **adopt compute/evidence adapters through an integration spike**

The Rust project exposes project/experiment/report concepts, literature and evidence skills, plan/MCP gates, local/remote compute, and adapters for local boxes, Kubernetes, Modal, Ray, Slurm, SSH, Hugging Face, and open research jobs.

Use it for experiment execution and compute brokerage in Model Lab/Research mode. Do not make it Allternit's only research store. Gate code reuse because GitHub reports no recognized license at audit time.

Source: <https://github.com/alphaXiv/openresearch-cli>

#### `jordan-gibbs/hyperresearch` — **adopt evidence graph and synthesis pipeline concepts**

**What it contributes:** MIT persistent research vault, full-text/embedding search, claims, citations, source independence, quality/ranking, graph links, research runs, MCP, and a staged workflow covering decomposition, breadth, contradictions, depth, reconciliation, source tensions, critics, synthesis, gap fetch, cite checking, patching, and readability.

**Add:**

- `ResearchProject`, `Source`, `Claim`, `EvidenceLink`, `Contradiction`, `ResearchRun`, and `ReportVersion` records;
- immutable source snapshots plus URL/access timestamps;
- per-claim citation checks and source-independence scoring;
- research run manifests with model/tool versions and query logs;
- export to Allternit Docs/Artifacts and a persistent searchable research library;
- optional browser lane for authenticated sources through the Interaction Plane.

Use openresearch-cli for compute/experiments and HyperResearch concepts for evidence persistence and synthesis.

Source: <https://github.com/jordan-gibbs/hyperresearch>

### 9. Artifacts

#### `cathrynlavery/diagram-design` — **adopt as an artifact renderer skill**

The MIT project provides editorial diagram patterns based on self-contained HTML + SVG. Integrate it as a skill/renderer package:

- typed `DiagramSpec` artifact with layout intent, nodes/edges/groups, theme tokens, target aspect ratio, detail level, and accessibility description;
- deterministic SVG/HTML output stored as an artifact with source spec;
- import/redraw path for Mermaid/draw.io where license permits;
- preview, edit, export, and regeneration in Gizzi and Web/Desktop artifact panels;
- visual regression fixtures for the supported diagram families.

Keep it separate from the core `ArtifactRenderer`: the renderer selects a plugin by artifact MIME/type.

Source: <https://github.com/cathrynlavery/diagram-design>

### 10. Allternit iOS

#### `happier-dev/happier` — **extract cross-device session patterns; do not fork the whole client**

**What it contributes:** MIT web/desktop/mobile clients; E2E-encrypted remote control of local coding agents; follow/takeover/import of existing sessions; session fork/replay and machine handoff; attach; collaboration; queue/steer/interrupt; global approval inbox; project/worktree/file/git/terminal views; reusable prompts/skills/MCP; profiles and ACP backends; local transcript search; multi-server isolation; enterprise auth and feature toggles.

**High-value gaps to close:**

- formal cross-device session lease and handoff protocol;
- pending-message queue visible and editable on every surface;
- one global attention inbox for approvals/questions/unread sessions;
- follow vs control vs take-over roles;
- E2E encryption envelope and server-blind payload option;
- provider capability matrix for fork, steer, attach, permissions, and replay;
- multi-server profile isolation and exact notification routing;
- diagnostics bundle and feature advertisement.

**Do not fork UI wholesale.** Allternit already has native iOS and broader product navigation. Lift protocol/state-machine concepts into shared Rails/API contracts, then implement them in the existing Swift stores/views.

Source: <https://github.com/happier-dev/happier>

## Prioritized roadmap

### Phase 0 — provenance and contracts (1–2 weeks)

- create an upstream register with repo URL, pinned SHA/tag, license, notice obligations, owner, decision, update policy, and security review;
- inventory the current computer-use protocol, Rails events, Agent schema, Plugin SDK, artifact types, model providers, and mobile session records;
- ratify `Observation`, `ActionRequest`, `ActionReceipt`, `DeviceSession`, `CapabilitySet`, lease, and structured recovery errors;
- add architecture decision records for Interaction Plane and Agent Package Plane;
- define threat models for desktop control, mobile control, endpoint replay, plugin hooks, and training workers.

**Exit:** contract fixtures can represent current extension/Playwright actions plus one desktop and one mobile example without vendor fields leaking into core types.

### Phase 1 — desktop/browser unification (3–5 weeks)

- implement the adapter host and capability gateway;
- integrate `agent-desktop` in a signed/local development lane;
- spike `computer-use-mcp` background-safe actions and compare against a frozen task suite;
- wrap the existing Page Agent extension as `BrowserDomAdapter`;
- add session leases, stale-ref handling, verification receipts, permission doctor, network/console streaming;
- expose the same sessions to Desktop, Web, and Gizzi.

**Exit:** one recorded task can move between DOM and desktop adapters, produces consistent receipts, and cannot interleave conflicting actions.

### Phase 2 — mobile compute bridge (4–6 weeks)

- implement `DeviceRegistry` and `DeviceSession` APIs;
- add Mobilerun Android ADB/HTTP and iOS Portal adapters;
- add iPhone Mirroring fallback on supported Macs;
- ship device pairing, capability display, approval/handoff, live screenshot, accessibility view, action log, and disconnect recovery;
- surface devices in Desktop/Web/Gizzi; make Allternit iOS a controller/observer before attempting on-device agent hosting.

**Exit:** an authorized agent can reserve a device, inspect capability state, execute and verify a benign workflow, hand off to a human, and release it with a complete receipt.

### Phase 3 — packages, bots, and composer entities (3–5 weeks)

- finalize canonical agent/bot/skill/tool/plugin/cookbook/loop package manifests;
- build Agency Agents importer and review queue;
- add bot presentation to Agent Hub and left rail;
- implement structured composer entity tokens across TypeScript surfaces, then Swift/Gizzi;
- add canonical runtime events and inline approvals/questions inspired by OpenMausBot;
- add trigger-ranked, deduplicated, budgeted plugin context.

**Exit:** an imported agent package can be previewed, installed, tagged in a composer, launched as a bot/session, and audited to exact package versions and grants.

### Phase 4 — multimodal, browser API lane, and channels (3–5 weeks)

- package Qwen MM `core` and `api` first;
- introduce media/artifact provenance and typed tool results;
- prototype ApiTap-style capture/replay with read-only endpoints first;
- add domain browser knowledge packs and Gizzi browser CLI ergonomics;
- optionally prototype Slack/Teams channel agents using OpenTag/Channels patterns.

**Exit:** multimodal tools install independently, and a captured read-only endpoint can be reviewed, signed, replayed, drift-detected, and revoked.

### Phase 5 — Model Lab (5–8 weeks)

- create datasets/models/jobs/checkpoints/evals/deployments records and UI;
- implement compute/hardware probe and isolated worker protocol;
- integrate the Unsloth first slice;
- add official Model Studio adapter;
- register resulting inference endpoints in the common model catalog;
- publish the GuppyLM learning path in A://Labs.

**Exit:** a user can create a data recipe, run one bounded LoRA job, compare evals, export/register a model, and use it in a normal Allternit session with complete lineage.

### Phase 6 — research and artifacts (3–5 weeks)

- add evidence graph and claim/citation records;
- integrate research run/synthesis pipeline concepts from HyperResearch;
- spike openresearch-cli compute adapters after license clearance;
- add diagram-design renderer package;
- import the Anthropic dynamic workflow cookbook with attribution and Allternit translation.

**Exit:** a research run produces a versioned report whose claims link to source snapshots and whose diagrams remain editable/regenerable artifacts.

## Fork policy

Fork only when all conditions hold:

1. the license permits the planned distribution and obligations are recorded;
2. the subsystem provides substantial code, not only a product idea;
3. a narrow adapter cannot meet the requirement;
4. the maintenance owner and upstream sync cadence are named;
5. Allternit-specific changes are unlikely to be accepted upstream;
6. security review and dependency scanning exist;
7. the fork exposes Allternit contracts rather than leaking vendor types across surfaces.

Likely fork candidates after spikes: none by default. `agent-desktop`, `computer-use-mcp`, and Qwen MM are adapter/dependency candidates; Page Agent is already integrated; Unsloth should be a worker; the remaining projects are primarily package imports or pattern sources.

## Legal and product red flags

- No recognized GitHub license at audit time: treg, SPAWN.md, vercel-labs/ai-cli, openresearch-cli. Treat as all-rights-reserved until verified.
- browse.sh source/license was not established from the public product page; do not fork its implementation or catalog.
- Grok Bot is a benchmark, not an implementation source. Avoid trade dress and private-behavior reverse engineering.
- ModelStudio should be integrated through documented APIs; do not clone authenticated console implementation or scrape secrets.
- website endpoint replay can violate user expectations or provider terms even when technically possible; authorization and method-level risk policy are mandatory.
- agent prompt catalogs can carry unsafe instructions, unbounded authority, conflicting identities, or copied proprietary content; import is a supply-chain event.
- mobile and desktop automation require visible permission, revocation, foreground/takeover semantics, and careful treatment of credentials, payments, messages, and biometric boundaries.

## Success metrics

- task success and verified-success rate per adapter;
- stale-ref/recovery rate and average observation tokens;
- foreground/focus disruption rate;
- conflicting-session actions prevented by leases;
- human takeover frequency and recovery success;
- mobile device connection and reconnection success;
- package install-to-first-success time and update rollback rate;
- plugin context tokens saved by ranking/deduplication;
- browser API replay hit rate, drift rate, and UI fallback success;
- training job completion, reproducibility, and eval improvement against cost;
- research claims with valid citations and independent-source coverage;
- cross-surface session continuation without transcript or permission loss.

## Immediate implementation tickets

1. **CU-ARCH-001:** inventory and freeze computer-use protocol v1 fixtures.
2. **CU-DESKTOP-002:** `agent-desktop` adapter spike with permission doctor and stale-ref receipts.
3. **CU-DESKTOP-003:** background-safe Swift backend comparison.
4. **CU-BROWSER-004:** expose existing Page Agent extension through the capability gateway.
5. **CU-MOBILE-005:** define `DeviceSession` and implement a Mobilerun read-only probe.
6. **CU-MOBILE-006:** implement iPhone Mirroring read-only observation and capability reporting.
7. **PKG-AGENT-001:** canonical package manifest and Agency Agents importer preview.
8. **UI-COMPOSER-001:** structured entity-token parser/resolver and Web/Desktop composer prototype.
9. **BOT-SESSION-001:** bot profile type plus canonical event/approval cards.
10. **MM-PLUGIN-001:** import Qwen MM core as a sandboxed Allternit plugin package.
11. **MODEL-LAB-001:** job/artifact/lineage contracts and Unsloth worker spike.
12. **RESEARCH-001:** evidence graph/claim schema plus HyperResearch-compatible import.
13. **ARTIFACT-001:** `DiagramSpec` and diagram-design renderer package.
14. **DOCS-COOKBOOK-001:** vendor cookbook sync manifest and dynamic-workflows translation.

## Research method and freshness

Repository claims were checked against the current upstream GitHub metadata, README, and repository trees on 2026-08-12. Product-only claims were checked against their public pages. Popularity counts are intentionally excluded from decisions because they change and do not establish fitness, quality, or license. Before implementation, pin exact upstream commits and repeat the license/security review.

