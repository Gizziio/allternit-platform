# Allternit Computer Use: OSS Gap Analysis

**Compared:** Allternit ACU vs. [`injaneity/pi-computer-use`](https://github.com/injaneity/pi-computer-use) and [`trycua/cua`](https://github.com/trycua/cua)  
**Assessment date:** 2026-07-15  
**Original assessment method:** Static inspection of the current local Allternit worktree and the two upstream repositories at commits `230d2e2` (pi-computer-use) and `740806c` (cua).
**Completion status:** Gaps in the committed integration plan were implemented and
validated on 2026-07-15. Validation included Python compilation and package
imports, provider-boundary enforcement, TypeScript SDK and Summit bridge checks,
SDK transport smoke tests, canonical in-process HTTP smoke tests, and 18 passing
plugin connector tests. Native/VM providers continue to report unavailable when
their optional host runtime is not installed.

## Executive conclusion

> **Implementation companion:** The complete, all-capabilities integration program is defined in [`COMPUTER-USE-FULL-INTEGRATION-MASTER-PLAN.md`](./COMPUTER-USE-FULL-INTEGRATION-MASTER-PLAN.md). Its waves indicate dependency order; every listed capability is committed priority scope.

Allternit already has a broad computer-use *product*: browser and desktop adapters, an autonomous vision loop, provider routing, approval gates, receipts, recordings, a live sidecar, AX-tree display, parallel and hybrid workflows, and a conformance dashboard.

Its largest gap is not another adapter. It is a single, trustworthy execution substrate.

- **Use pi-computer-use as the reference for correctness:** immutable observations, state-scoped element references, stale-action rejection, per-resource concurrency, semantic postconditions, honest action outcomes, and strict background-operation invariants.
- **Use Cua as the reference for infrastructure:** a cross-OS sandbox API, packaged native drivers, VM/image lifecycle, MCP/SDK distribution, trajectory evidence, repeatable E2E matrices, and benchmark/RL tooling.
- **Keep Allternit's differentiators:** policy and approval UX, receipts, multi-provider routing, replay/sidecar experience, plugin workflows, and browser-to-desktop orchestration.

The recommended strategy is **adopt and wrap, not rewrite**: define one Allternit computer contract, place pi/Cua-class drivers behind it, and make the existing ACU planner, policy engine, receipts, and UI consume that contract.

## Capability scorecard

Scores describe evidenced implementation maturity, not feature claims: 0 absent, 1 stub/idea, 2 partial, 3 usable, 4 strong, 5 reference-grade.

| Area | Allternit | pi-computer-use | Cua | Gap interpretation |
|---|---:|---:|---:|---|
| Browser automation | 4 | 4 | 4 | Allternit is competitive, but browser control is duplicated across Playwright, CDP, browser-use, extension, and gateway paths. |
| Native desktop control | 3 | 5 | 5 | Allternit has AX/Quartz/pyautogui mechanisms, but lacks the same proven, packaged, cross-platform driver contract. |
| Observation/state correctness | 2 | 5 | 3 | Allternit has `@eN` refs and diffs, but no clearly enforced immutable `stateId` + resource epoch model across all adapters. |
| Background/non-interfering input | 2 | 5 | 5 | Allternit's SkyLight route has an unresolved distribution entitlement and can fall back to global pyautogui input. |
| Cross-platform coverage | 2 | 4 | 5 | Allternit is macOS-centric at the native layer; pi covers macOS/Windows; Cua covers macOS, Windows, Linux, and sandbox/mobile paths. |
| Sandboxes and images | 2 | 0 | 5 | Allternit contains Firecracker/Apple virtualization work, but Cua exposes a coherent, user-facing lifecycle and image API. |
| Agent planning/providers | 5 | 2 | 4 | Allternit is strongest here: multi-provider vision, routing, planning, hybrid execution, and plugins. |
| Safety/approvals/governance | 4 | 4 | 3 | Allternit has explicit policy rules, approvals, and receipts. It needs lower-level driver invariants to make those controls enforceable. |
| Recording/replay | 4 | 2 | 5 | Allternit records JSONL/GIF; Cua's trajectories, video, typed evidence, and evaluation linkage are more rigorous. |
| Benchmarks/evaluation | 2 | 3 | 5 | Allternit's 40-test claim includes stub/mock paths; Cua has Cua-Bench, datasets, calibration, parallel runs, and OS/application matrices. |
| SDK/MCP/distribution | 3 | 4 | 5 | Allternit exposes REST and MCP but has multiple services/ports and a less unified installation/runtime story. |
| Product UX | 5 | 1 | 3 | Allternit's sidecar, approval controls, AX display, cursor overlay, and product integration are a genuine advantage. |

## What Allternit already does better

1. **Product integration.** The live computer-use sidecar is mounted across Chat, Cowork, and Code; it exposes screenshots, AX changes, windows, notifications, approvals, and direct targeting rather than remaining a developer-only CLI.
2. **Governance.** The seven-rule policy layer, destructive-action approval gate, cross-session restrictions, receipts, and receipt verification go beyond the default product surface in both references.
3. **Model and adapter routing.** Allternit supports multiple vision providers and browser/desktop/retrieval/hybrid adapter families rather than coupling the driver to one model loop.
4. **Workflow breadth.** Browser-to-desktop-to-browser work, plugins/cookbooks, retrieval, parallel contexts, SSE status events, cancellation, and approval are already represented.
5. **User-facing observability.** JSONL/GIF recording, cursor animation, verification badges, AX diffs, and a conformance dashboard give Allternit a strong foundation for a computer-use control plane.

These advantages should remain above the driver layer; they should not be reimplemented inside a new native backend.

## Gaps exposed by pi-computer-use

### 1. Observations are not a universal immutable contract — critical

pi treats each observation as immutable and binds every element ref to a `stateId`. Each physical resource also has an epoch; an action based on an observation from an older epoch is rejected before dispatch. Cached search/inspect operations can run concurrently, while live operations serialize only per process or browser target.

Allternit has AX refs, snapshots, and diffs, but its public gateway remains action/session oriented. There is no clearly universal contract requiring every browser and desktop action to carry the exact observation state and epoch from which it was grounded.

**Risk:** stale coordinates or refs can act on a changed UI; concurrent planner/sidecar actions can race; adapter-specific state semantics leak upward.

**Close it:** introduce `ComputerObservation { state_id, resource_id, epoch, roots, elements, image, captured_at }`. Require `base_state_id` for every mutating action. Reject stale writes centrally, not in individual adapters.

### 2. Action results are not uniformly honest — critical

pi distinguishes `worked`, `didnt`, and `unknown`, attaches evidence, and can require a semantic postcondition such as text appearing. It avoids replaying ambiguous pointer actions and stops a transaction at the first uncertain boundary.

Allternit has confidence verification, but its adapter surface frequently returns generic `success` values, and direct browser/desktop paths do not share one mandatory outcome/evidence schema.

**Risk:** delivery of an input event is mistaken for completion of the user's intent.

**Close it:** standardize `ActionOutcome` with `status`, `delivery`, `grounding`, `evidence`, `postcondition`, `stopped_at`, and `successor_state_id`. Never map `unknown` to success.

### 3. Strict background mode is not an enforceable invariant — critical

pi defines strict headless behavior: no app activation, focus theft, global cursor movement, raw input, or visible cursor overlay. Cua Driver makes background, per-process input a core product promise.

Allternit attempts `SLEventPostToPid`, but its own documentation flags the private SkyLight entitlement as unresolved for distribution, while pyautogui remains a fallback.

**Risk:** a task advertised as background can interfere with the user's active desktop or type into the wrong application.

**Close it:** separate modes into `background_strict`, `foreground_allowed`, and `sandboxed`. In strict mode, fail closed when only global-input fallback is available. Surface route and interference guarantees in every action receipt.

### 4. Unified semantic UI forest is incomplete — high

pi represents desktop windows, transient roots, and CDP pages through one root/element/state model with progressive disclosure (`find_roots`, `observe_ui`, `search_ui`, `expand_ui`, `inspect_ui`, `act_ui`).

Allternit exposes separate gateway actions, AX inspection, browser selectors, CDP, screenshots, and extension paths.

**Impact:** planners need adapter knowledge, payloads become larger, and browser/native transitions are harder to reason about.

**Close it:** make browser DOM/AX and native AX/UIA trees conform to one observation and ref namespace. Retain adapter-specific escape hatches only as diagnostics.

### 5. Native parity and packaging are not yet product-grade — high

pi ships stable macOS and Windows helpers, platform invariant/version handshakes, permission setup, bounded native state, and platform conformance rules.

Allternit's native automation is largely Python/ctypes/pyautogui with macOS-specific accessibility logic; Windows and Linux do not have equivalent evidenced product paths.

**Close it:** either embed Cua Driver behind the Allternit contract or build an equivalent signed helper. Require backend capability/invariant negotiation during startup.

## Gaps exposed by Cua

### 6. Sandbox lifecycle is fragmented — critical

Cua exposes one SDK for ephemeral or persistent Linux containers, Linux/macOS/Windows VMs, Android, custom images, shell, files, screenshots, mouse, keyboard, and gestures. Lume and QEMU are integrated into the same product story.

Allternit contains browser contexts, process sandboxing, Firecracker code, Apple virtualization work, VM routes, and a separate browser runtime, but these do not form one stable computer/sandbox lifecycle used by ACU.

**Close it:** define `ComputerEnvironment` with create/start/stop/snapshot/restore/destroy, image identity, isolation level, OS, display stream, shell/files, and input channels. Make local host control one environment type, not the implicit default.

### 7. Cross-OS and mobile support trails materially — high

Cua presents one control API across macOS, Windows, Linux, and Android; its driver separately targets macOS, Windows, and Linux. Allternit has a mobile adapter and virtualization components, but they are not shown as a coherent, validated product matrix.

**Close it:** publish an explicit support matrix per OS/action/route with `supported`, `best_effort`, or `unavailable`, and tie it to automated evidence.

### 8. Trajectories are recordings, not yet evaluation-grade evidence — high

Cua links trajectories to video, screenshots, accessibility trees, structured results, environment metadata, test cells, datasets, and benchmark runs. Allternit's JSONL/GIF replay is useful for UX but weaker for regression analysis and training export.

**Close it:** version a trajectory schema containing observation IDs, model/provider/version, prompts or hashes, action outcome evidence, policy decisions, approvals, environment/image digest, costs, timings, and verification results. Add deterministic redaction.

### 9. Benchmarking is below the claimed maturity — critical

Allternit documentation labels all 40 conformance checks “production grade,” yet also acknowledges that hybrid and plugin suites use `_DummyAdapter`; code and docs include mock-driven integration paths, a stub cost ceiling, and unimplemented fallback handlers. This makes the 100% grade unsuitable as a production-readiness claim.

Cua provides benchmark datasets, repeated calibration, max-step controls, parallel execution, environment creation, OSWorld/ScreenSpot/Windows Arena integration, and typed E2E artifacts.

**Close it:** split tests into:

- contract/unit;
- deterministic simulated;
- real browser headed/headless;
- real native OS/app matrix;
- sandbox lifecycle;
- end-to-end task success;
- safety/adversarial;
- benchmark/regression.

Never combine mock and live results into one “production grade.” Report task success, action success, unknown-outcome rate, policy violations, interference failures, latency, tokens, and cost separately.

### 10. Installation and service topology are too complex — medium

Allternit currently describes a FastAPI gateway on 8760, an MCP server on 8765, a Playwright browser runtime on 8001, native GUI gateway tools, and other browser/extension bridges. Cua and pi each give agents a clearer primary entry point and helper lifecycle.

**Close it:** provide one supervised `allternit-computer` daemon with local IPC, one public SDK contract, and adapters/drivers as internal providers. MCP, REST, and product UI should be transports over the same core session manager.

### 11. Distribution/security hardening needs a release path — high

The unresolved private macOS entitlement is a blocker for promising background native control. Native helpers also need stable signing identity, permission attribution, version negotiation, update/rollback, and explicit telemetry policy.

**Close it:** choose a supported distribution strategy early. If private APIs cannot be shipped reliably, use Cua Driver as an optional installed provider or constrain native host mode to supported AX operations and move raw interaction into a sandbox.

## Architecture recommendation

```text
Allternit UI / Chat / Cowork / Code / SDK / MCP
                    |
          Policy + approval + receipts
                    |
       Planner/router + provider selection
                    |
     Canonical Computer Contract (new seam)
      observation | action | outcome | trace
          /             |              \
 native driver     browser driver     sandbox driver
 (pi/Cua-class)    (CDP/Playwright)   (Cua/VM/QEMU)
          \             |              /
       one session/resource/epoch manager
                    |
       trajectories + eval + replay store
```

Key rule: the planner never calls pyautogui, Playwright, CDP, AX, or a VM directly. It calls the canonical contract. The selected driver reports its capabilities and guarantees, while policy decides whether those guarantees are sufficient for the requested risk level.

## Dependency-ordered roadmap

All capabilities in the companion master plan are priorities. The stages below establish the dependency path; they do not classify later capabilities as optional or lower-value.

### P0 — Trustworthy core (2–4 weeks)

1. Freeze and publish the canonical observation/action/outcome schemas.
2. Add immutable state IDs, per-resource epochs, and stale-write rejection.
3. Add `worked/didnt/unknown`, evidence, and semantic postconditions.
4. Make strict background mode fail closed; remove silent global-input fallback from that mode.
5. Correct the conformance dashboard and docs so mocks/stubs cannot receive a production grade.

**Exit criteria:** a stale action cannot execute; an ambiguous click cannot be reported successful; strict background mode cannot move the user's cursor or steal focus; every result identifies its actual route.

### P1 — Driver convergence (4–8 weeks)

1. Prototype Cua Driver behind the canonical native-driver interface on macOS and Windows.
2. Normalize AX/UIA/CDP observations into the unified forest.
3. Consolidate the gateway, browser runtime, and MCP tools onto one session manager.
4. Add helper signing, permission setup, version/invariant negotiation, and upgrade flow.

**Exit criteria:** the same task contract runs against browser, macOS native, and Windows native providers without planner changes.

### P2 — Sandbox product (6–10 weeks)

1. Wrap Cua Sandbox or align Allternit's VM components to the proposed `ComputerEnvironment` interface.
2. Add image digests, snapshot/restore, timeouts, resource limits, network policy, and artifact extraction.
3. Add streamed viewport/take-control and clipboard synchronization to the existing sidecar.

**Exit criteria:** risky tasks default to an isolated environment with reproducible image and trajectory identity.

### P3 — Evidence and differentiation (ongoing)

1. Adopt a versioned trajectory schema and Cua-Bench-compatible export.
2. Build an Allternit benchmark pack around governed workflows: approvals, receipts, browser-to-desktop handoff, recovery, and human takeover.
3. Measure task success, intervention rate, unknown outcomes, policy compliance, latency, and cost per provider/route.
4. Turn successful governed trajectories into cookbooks while preserving human approval boundaries.

**Exit criteria:** releases have comparable, reproducible benchmark reports and regression evidence across supported OS/application cells.

## Adopt, adapt, or avoid

| Reference capability | Decision | Reason |
|---|---|---|
| pi immutable state/ref/epoch contract | **Adapt immediately** | Highest-value correctness improvement; independent of driver choice. |
| pi progressive semantic outline | **Adapt** | Reduces screenshots/tokens and unifies native/browser planning. |
| pi strict background invariants | **Adopt as policy** | Prevents silent interference and misrepresented guarantees. |
| Cua Driver | **Prototype as provider** | Fastest path to packaged, cross-platform native background control. |
| Cua Sandbox/Lume/QEMU | **Wrap or align** | Avoid rebuilding an already mature environment/image layer. |
| Cua-Bench and trajectory schema | **Integrate/export to** | Gives Allternit credible evaluation and training data paths. |
| Allternit policy/approval/receipts | **Keep and deepen** | Strongest differentiation and the correct product control plane. |
| More top-level adapters before convergence | **Avoid** | Adds breadth while increasing behavioral inconsistency and test burden. |
| Silent pyautogui fallback in background mode | **Remove** | Violates non-interference guarantees. |
| “Production” grades derived from mocks | **Stop** | Masks the exact reliability risk the benchmark should reveal. |

## Evidence inspected

### Allternit

- `domains/computer-use/core/README.md`
- `domains/computer-use/core/Allternit_COMPUTER_USE_COMPLETE.md`
- `domains/computer-use/core/core/`
- `domains/computer-use/core/adapters/`
- `domains/computer-use/core/gateway/`
- `domains/computer-use/core/policy/`
- `domains/computer-use/core/observability/`
- `api/services/browser-runtime/`
- `api/gateway/routing/src/gui_tools.rs`
- `surfaces/ai.allternit.com/src/capsules/browser/`
- `surfaces/ai.allternit.com/src/integration/computer-use-engine.ts`

### Upstream

- pi-computer-use README, architecture, usage/configuration, TypeScript runtime, CDP backend, and macOS/Windows native helper contracts.
- Cua top-level architecture, Cua Driver, computer server, sandbox/agent SDKs, Cua-Bench, Lume/QEMU, trajectory recording, platform action matrix, and E2E evidence model.

## Bottom line

Allternit does not need to become a clone of either repository. It should become the governed product/control plane above a pi-quality state/action contract and Cua-quality driver/sandbox/evaluation substrate. The immediate business and engineering win is reliability consolidation: fewer execution paths, stronger guarantees, honest results, and benchmark evidence that makes Allternit's approval-and-receipt story credible.
