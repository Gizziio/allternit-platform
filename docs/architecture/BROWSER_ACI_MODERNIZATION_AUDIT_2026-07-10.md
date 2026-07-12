# Allternit Browser + Computer-Use Modernization Audit

**Date:** 2026-07-10  
**Scope:** Gizzi browser tools, ACI/computer-use SDK, browser runtimes, Chrome extension, browser-mode chat, and repeatable browser skills/workflows.

## Executive decision

Allternit should keep its product-specific browser UI, safety/approval model, receipts, and extension. It should stop maintaining multiple independent browser execution cores.

The target is one browser capability plane with provider adapters:

1. **One protocol** for sessions, observations, actions, approvals, events, artifacts, and receipts.
2. **One local Playwright/CDP engine** for deterministic execution and attachment to a user's existing browser.
3. **Provider adapters** for Browser Use, Browserbase/Stagehand, and future providers rather than parallel runtimes.
4. **One observation contract** based on bounded accessibility/DOM snapshots with stable refs, plus screenshots only when vision is required.
5. **A trajectory-to-skill compiler** that turns a verified browser run into a reviewable, versioned, executable skill/workflow.
6. **One browser chat experience** that shows the plan, live actions, approvals, evidence, recovery, and a “Save as skill” outcome.

This should be a consolidation program, not a rewrite. The existing `@allternit/computer-use` event and approval vocabulary is the best starting public contract; the Chrome-stream browser engine has the strongest local execution/test base; the extension and browser capsule should become clients of that plane.

## What exists today

| Layer | Current implementation | Assessment |
|---|---|---|
| Public computer-use contract | `sdk/computer-use` | Broad event, approval, reply, and MCP types; useful contract seed, but 3,655 lines and not visibly consumed by the browser execution packages. |
| General browser tool library | `packages/@allternit/browser-tools` | 3,367 lines of Playwright actions, extraction, event streaming, and quarantine; effectively isolated and has no tests. |
| API browser runtime | `api/services/browser-runtime` | Simple Playwright/Express/WebSocket runtime. Duplicated under `services/runtime/runtime/browser-runtime`. |
| Canonical-looking local browser service | `infrastructure/chrome-stream/agent-systems/allternit-browser` | CDP, Playwright actions, snapshots, tabs, server routes, canvas host, and tests. Best consolidation candidate, but snapshot grounding and server lifecycle tests are broken. |
| Chrome extension | `surfaces/allternit-extensions/allternit-extension` | WXT/MV3 side panel, page-agent packages, native messaging, cloud/WebSocket connectors, a second browser-agent executor, and broad permissions. Product value is high; execution logic is duplicated. |
| Browser-mode UI | `surfaces/ai.allternit.com/src/capsules/browser` | Rich browser capsule plus a 1,060-line Zustand agent store. `BrowserChatPane` divides “Chat” and “Operator” into two mental models and two data paths. |
| Skills/workflows | `packages/computer-use/plugins/allternit-computer-use` | Good starting skills, commands, cookbooks, and record/replay descriptions. They are mostly prose and are not automatically produced, validated, promoted, or repaired from real runs. |
| Gizzi orchestration | Gizzi chat/session routes and browser surface selection | Browser chat can select an agent and stream messages, but actions/evidence are not presented as a first-class task timeline in the chat pane. |

## Verified technical debt

### P0 — silent grounding failure

`infrastructure/chrome-stream/agent-systems/allternit-browser/src/browser/playwright/snapshot.ts` returns an `Accessibility Snapshot Placeholder` because the removed/deprecated Playwright accessibility snapshot API was not replaced. This is worse than a hard error: callers may believe they received grounded page state and fall back to unreliable selectors or coordinates.

Replace it with the current Playwright accessibility snapshot/ref approach (or consume Playwright MCP/CLI snapshot semantics behind an adapter). The output must be bounded, deterministic, frame-aware, and versioned.

### P0 — overlapping execution cores

There are at least four local browser managers/executors plus extension-specific execution:

- `@allternit/browser-tools`
- `api/services/browser-runtime`
- `services/runtime/runtime/browser-runtime`
- `@allternit/browser` in Chrome-stream
- extension `browser-agent/*` and `agent/*`

Two browser-runtime trees contain byte-identical `browser.ts` and `types.ts`; their `index.ts` files have already drifted. This is direct duplication debt. The package usage scan also shows almost no source consumers of `@allternit/browser-tools`, suggesting it is a stranded implementation rather than a real shared core.

### P0 — security boundary is too broad

The extension requests `<all_urls>`, `tabs`, `scripting`, `webNavigation`, `nativeMessaging`, and exposes resources to every HTTP(S) page. Those permissions may be required for the full product, but they are granted as a single undifferentiated capability set.

Move to explicit runtime grants and policy:

- optional host permissions where feasible;
- per-domain allow/deny policy;
- separate read, interact, download/upload, credential, and transaction capabilities;
- short-lived task leases for native/cloud connections;
- origin-bound messages with schema validation and nonce/session binding;
- redaction before any observation leaves the browser;
- an audit receipt for every approval and external side effect.

### P1 — tests do not establish a releasable baseline

Audit commands on 2026-07-10 found:

- `@allternit/browser-tools` typecheck passes.
- `@allternit/browser-tools` test command finds no tests and exits 1.
- `@allternit/browser` reports 20 passing, 9 failing, and 3 skipped tests. Failures cover ephemeral-port reporting, status/profile/tab endpoints, and Canvas-host index serving.
- `@allternit/computer-use` runs 3 suites: the types suite passes (27 tests), while client compilation fails because tests no longer match the approval-predicate API and Bun's `fetch` type, and conformance fails because `@allternit/replies-reducer` cannot be resolved.

No browser subsystem should be called canonical until contract, lifecycle, and real-browser smoke tests are green.

### P1 — dependency and API drift

The root uses Playwright `^1.58.2`, while browser packages declare `^1.40.0` or `^1.42.0`. The placeholder snapshot is already evidence of API drift. Pin one workspace catalog version and use a single browser installation strategy.

### P1 — browser chat fragments the product

`BrowserChatPane` presents separate **Chat** and **Operator** tabs. Chat streams backend messages; Operator mounts the extension side-panel adapter. Users should not need to choose which internal execution path represents “the browser agent.”

The current message rendering also stringifies non-string content, hiding structured tool calls, approvals, screenshots, citations, and receipts instead of rendering them intentionally.

### P1 — record/replay is specified, not closed-loop learning

Allternit already describes JSONL recording, replay, screenshots, reflections, cost, and verification. That is valuable raw material, but there is no production path that:

1. detects a successful repeatable run;
2. removes secrets and volatile data;
3. parameterizes inputs;
4. compiles deterministic steps;
5. adds assertions and recovery;
6. tests the candidate;
7. asks the user to approve promotion;
8. retrieves and patches the skill on later runs.

## Where the industry moved

The relevant shift is from unconstrained “LLM clicks around” toward hybrid, observable, reusable execution.

- [Playwright MCP](https://github.com/microsoft/playwright-mcp) standardizes structured browser tools and accessibility snapshots, including an extension mode that attaches to existing logged-in tabs. Allternit should match its ref/snapshot ergonomics even if it keeps its own protocol.
- [Stagehand](https://github.com/browserbase/stagehand) explicitly combines natural-language discovery with deterministic code, action preview, caching, and self-healing. This is the closest product analogue to the requested “turn browser tasks into repeatable workflows.”
- [Browser Use](https://github.com/browser-use/browser-use) has become a provider/framework with domain restrictions, cloud execution, and installable agent skills. It should be an adapter and comparison target, not a second Allternit core.
- [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp) is moving sites toward exposing structured tools directly to agents inside a browsing context. Allternit's resolver should prefer site-declared/WebMCP tools, then deterministic DOM/ref actions, then vision/coordinates as the last resort.
- Hermes separates a browser registry/provider layer from supervision, skill management, and scheduled “blueprints.” Its strongest reusable ideas are provider routing, persistent CDP supervision, background skill review, skill provenance/security scanning, and treating an automation as a skill plus metadata rather than a new format.

## Hermes lessons to adopt

Adopt the patterns, not the Python implementation:

1. **Provider registry.** Local CDP, managed local, and cloud providers share one capability interface and expose feature flags.
2. **Hybrid routing.** Keep private/LAN targets local; route eligible public targets to a configured cloud provider. Re-check redirects to prevent SSRF pivots.
3. **Persistent supervisor.** Keep a session-scoped CDP connection for dialogs, OOPIF/frame state, console errors, downloads, and lifecycle cleanup.
4. **Procedural-memory nudge.** After a complex verified task, assess whether a reusable skill should be created or an invoked skill patched.
5. **Background curation.** Deduplicate, score, archive, and consolidate agent-created skills without blocking the user's task.
6. **Provenance and quarantine.** Mark agent-created/imported skills, scan them, restrict dangerous operations, and retain an audit trail.
7. **Blueprints.** A scheduled workflow is a skill with schedule/delivery metadata, not an unrelated workflow object.

Do not copy Hermes' provider-specific workarounds into the core. Keep them behind capability adapters and conformance tests.

## Target architecture

```text
Browser UI / Extension / Gizzi / SDK clients
                    |
          ComputerUseProtocol v1
                    |
     Policy + approvals + receipts + events
                    |
        Browser Capability Orchestrator
          /          |             \
 Local Playwright  Existing-tab   Cloud adapters
 + CDP supervisor  extension/CDP  Browser Use/Stagehand
                    |
      Observation + Artifact Store
                    |
       Trajectory / Verification Store
                    |
          Skill Compiler + Registry
                    |
      deterministic replay + repair agent
```

### Canonical contracts

Create a small `@allternit/browser-protocol` package (or a browser namespace inside the public computer-use SDK) containing only schemas and no runtime dependencies:

- `SessionSpec`, `ProviderCapabilities`, `BrowserObservation`
- `ActionIntent`, `ResolvedAction`, `ActionResult`
- `ApprovalRequest`, `PolicyDecision`
- `ArtifactRef`, `Receipt`, `BrowserEvent`
- `Trajectory`, `WorkflowSpec`, `SkillManifest`

Use Zod/JSON Schema at every process and extension boundary. Include `schemaVersion` and capability negotiation.

### Observation ladder

Use the cheapest reliable representation in this order:

1. WebMCP/site-declared structured tool.
2. Focused accessibility/DOM snapshot with stable refs and changed-region diff.
3. Direct deterministic locator/action.
4. Screenshot plus vision for canvas, image-only, or ambiguous UI.
5. Coordinate action only with immediate visual/DOM verification.

Snapshots must cap nodes/tokens, include frame/dialog state, mask secrets, and allow targeted refresh by frame or region.

### Action lifecycle

Every action follows the same state machine:

`planned -> resolved -> policy_checked -> approval_pending? -> executing -> observed -> verified -> committed | recovering | failed`

This becomes the single source for UI status, audit receipts, retries, and skill recording.

## Trajectory-to-skill system

### Principle

A recording is evidence; a workflow is executable; a skill is reusable procedural knowledge. Do not treat raw JSONL replay as the finished skill.

### Pipeline

1. **Capture:** record semantic action intent, resolved locator/ref, minimal before/after observations, URL pattern, frame, downloads, approvals, result, timing, and cost. Store screenshots by artifact reference, not inline base64.
2. **Verify:** require explicit outcome assertions. Failed or ambiguous runs do not auto-promote.
3. **Sanitize:** remove cookies, tokens, passwords, raw PII, one-time IDs, and irrelevant page content.
4. **Parameterize:** infer inputs such as account, date range, search term, file, destination, and output schema. Ask only when ambiguity changes behavior.
5. **Compile:** generate a `workflow.yaml`/JSON graph plus a concise `SKILL.md`. Deterministic Playwright/ref actions are primary; natural-language agent steps are bounded fallback nodes.
6. **Harden:** add preconditions, postconditions, domain policy, idempotency key, retry budget, timeout, and compensation/stop behavior.
7. **Test:** replay in dry-run/sandbox, then live with approvals. Run contract fixtures and a known-site canary.
8. **Promote:** show a diff and request approval before publishing to the user's/team skill registry.
9. **Retrieve:** match future tasks by skill description, domain, inputs, and capability needs. Preview the plan before execution.
10. **Repair:** when a deterministic step fails, invoke the agent only for that step, verify the repair, and propose a versioned patch.
11. **Curate:** merge duplicates, deprecate stale versions, track success/cost/last-verified, and quarantine untrusted imports.

### Proposed skill layout

```text
skills/browser/<slug>/
  SKILL.md                 # when to use, safety, inputs, outputs, recovery
  workflow.yaml            # executable versioned graph
  schemas/input.schema.json
  schemas/output.schema.json
  scripts/run.ts           # optional deterministic fast path
  fixtures/                # sanitized snapshots/assertions
  metadata.json            # provenance, metrics, last verified, domains
```

### Promotion gates

A candidate becomes reusable only when:

- final outcome is verified;
- no secret/PII scan findings remain;
- target domains and permissions are explicit;
- destructive/external actions retain approvals;
- inputs and outputs validate;
- at least one replay or fixture test passes;
- a human approves first publication for team/global scope.

Never auto-learn credential entry, CAPTCHAs, financial transactions, account recovery, or irreversible actions as unattended workflows.

## Browser-mode chat update

Replace the Chat/Operator split with a single task thread and an optional details drawer.

The main thread should render:

- user objective and editable plan;
- live page/session identity;
- action cards with target, reason, and before/after evidence;
- inline approvals with risk and exact side effect;
- a compact “watch browser” affordance;
- recovery events and changed plans;
- structured extraction results and citations;
- final verified outcome and receipt;
- **Save as skill**, **Update existing skill**, and **Schedule** actions.

The details drawer can hold console/network/frame diagnostics, raw observations, model/provider selection, and policy configuration. The extension side panel and platform browser should consume the same view model and protocol; do not maintain parallel chat implementations.

## Migration plan

### Phase 0 — baseline and freeze (1 week)

- Declare no new browser runtime packages.
- Inventory runtime entrypoints and actual consumers.
- Rerun all tests with correct commands and add a single CI browser matrix.
- Add architecture decision records for the canonical protocol and engine.
- Pin one Playwright version.

**Exit:** every browser package is classified as canonical, adapter, client, or delete/migrate.

### Phase 1 — repair the foundation (1–2 weeks)

- Replace the placeholder accessibility snapshot.
- Fix ephemeral-port and Canvas-host tests.
- Add contract tests for session lifecycle, tabs, frames, dialogs, downloads, redirects, cleanup, and secret masking.
- Add a provider capability matrix.

**Exit:** local engine passes unit, contract, and real-browser smoke tests.

### Phase 2 — unify protocol and execution (2–4 weeks)

- Extract schemas from the computer-use SDK.
- Adapt Chrome-stream engine to the protocol.
- Turn Browser Use/Stagehand into provider adapters.
- Migrate extension executor calls to protocol messages.
- Remove one duplicated browser-runtime tree immediately; migrate/delete the other after consumers move.
- Deprecate `@allternit/browser-tools` or reduce it to thin client/tool adapters.

**Exit:** UI, extension, and Gizzi execute through one orchestrator.

### Phase 3 — skill factory (2–4 weeks)

- Normalize trajectory storage and artifact references.
- Implement sanitize/parameterize/compile/test/promote stages.
- Add skill provenance, trust scope, versioning, metrics, and review UI.
- Seed the registry by compiling the existing cookbooks and validating them.

**Exit:** a verified task can become a reviewable skill and replay with deterministic-first execution.

### Phase 4 — unified browser chat (2–3 weeks)

- Introduce the task timeline/view model.
- Merge Chat and Operator presentation.
- Render structured events rather than JSON stringification.
- Reuse the same components in the extension and platform capsule.
- Add save/update/schedule skill actions.

**Exit:** one coherent browser-agent UX across product surfaces.

### Phase 5 — optimization and self-repair (ongoing)

- Snapshot diffs and token budgets.
- Deterministic action caching.
- Step-level repair and patch proposals.
- Skill retrieval evaluation, canaries, and stale-skill curation.
- Optional WebMCP resolver and cloud routing.

## Delete/deprecate candidates

Do not delete until the usage inventory and migration tests are complete, but start with:

1. One of the two duplicated `browser-runtime` trees.
2. The deprecated placeholder snapshot implementation.
3. Package-local Playwright version declarations after workspace catalog pinning.
4. Parallel extension execution code once protocol adapters cover it.
5. Chat-only rendering that stringifies structured messages.
6. Inline base64 screenshots in durable trajectory records.
7. Hand-maintained workflow prose that has no executable spec or conformance test.

## Measures of success

Track by provider, site, and skill version:

- verified task success rate;
- deterministic-step ratio;
- mean model tokens and cost per successful task;
- median steps and wall time;
- recovery rate after site change;
- approval frequency and denial rate;
- secret/PII policy violations;
- orphan browser/session count;
- skill replay success and last-verified age;
- percentage of repeated tasks served by an existing skill;
- extension permission grants by active domain.

## Immediate backlog

1. Fix snapshot grounding and add a regression test that asserts real roles/names/refs.
2. Fix the 9 failing Chrome-stream tests and the 2 failing computer-use SDK suites.
3. Write an entrypoint/consumer inventory and select the canonical engine in an ADR.
4. Delete the byte-identical duplicate browser runtime after confirming the package path consumers.
5. Define `ComputerUseProtocol v1` schemas and provider capabilities.
6. Restrict and validate extension messaging; design optional/per-task host permissions.
7. Prototype one end-to-end compiled skill from an existing successful recording.
8. Replace the browser Chat/Operator tabs with a task timeline prototype.
9. Add Hermes-style post-task “create or patch skill?” review with explicit promotion gates.
10. Evaluate the user's referenced GitHub project against this architecture once its URL/name is provided.

## Open input needed

The specific GitHub project mentioned in the request was not identifiable from the repository or message. Its URL or exact repository name is needed for a line-by-line adoption/rejection review. This does not block the consolidation work above.
