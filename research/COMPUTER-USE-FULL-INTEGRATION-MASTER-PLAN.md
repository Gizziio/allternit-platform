# Allternit Computer Use — Full Integration Master Plan

**Sources:** `injaneity/pi-computer-use` and `trycua/cua`  
**Status:** Implementation finished and validated on 2026-07-15  
**Planning rule:** Every capability below is a priority. Waves express technical dependency and safe landing order, not importance or optionality.

All six implementation waves are complete. Actively consumed goal/action/session
routes remain supported compatibility APIs; unused duplicate managers, unsafe
fallbacks, direct product HTTP ownership, and the gateway self-loop were removed.
Runtime-dependent providers remain truthfully dormant when their native runtime
is absent rather than being reported as working.

The focused packaging and harness campaign is recorded in
`COMPUTER-USE-PRIVATE-ALPHA-READINESS-2026-07-15.md`. The proven release boundary
is macOS plus Playwright browser use for private alpha; untested OS/runtime cells
remain dormant.

## 1. Target outcome

Allternit will provide one governed computer-use platform that can:

- observe and control browsers and native applications;
- operate on macOS, Windows, Linux, and Android;
- run on the user's host or in isolated containers and VMs;
- work in strict background, foreground-assisted, or sandboxed modes;
- expose the same contract through the product UI, SDK, REST, MCP, and plugins;
- reject stale actions and report only verified outcomes;
- record reproducible trajectories, video, accessibility evidence, policy decisions, approvals, receipts, cost, and timing;
- evaluate releases against real application and benchmark matrices;
- preserve Allternit's routing, model choice, approval UX, receipts, plugins, and browser-to-desktop workflows.

This is not a plan to paste two repositories into the monorepo. It is a plan to absorb their required capabilities behind an Allternit-owned contract, reuse upstream components where that reduces risk, and eliminate overlapping Allternit implementations only after parity is proven.

## 2. Non-negotiable architecture

```text
Product surfaces
Chat | Cowork | Code | Browser | Desktop | SDK | REST | MCP | Plugins
                              |
Governance plane
identity | policy | approval | budgets | receipts | audit | redaction
                              |
Agent plane
planner | model router | skills | recovery | human takeover
                              |
Canonical Computer API
environment | session | roots | observation | action | outcome | artifact
                              |
Runtime plane
resource scheduler | state store | capability negotiation | event stream
             /                 |                  \
native driver          browser driver       sandbox/device driver
mac/win/linux           CDP/Playwright       container/VM/Android
             \                 |                  /
Evidence plane
trajectory | screenshots | AX/DOM | video | metrics | replay | benchmarks
```

The agent and product UI must never depend directly on pyautogui, AX, UIA, CDP, Playwright, QEMU, Lume, or Cua-specific classes. Those are providers behind the canonical API.

## 3. Integration decisions

| Area | Source of truth | Decision |
|---|---|---|
| Immutable observations and scoped refs | pi-computer-use | Reimplement the contract in Allternit and write compatibility adapters. |
| Resource epochs and concurrency | pi-computer-use | Adopt the same invariants in Allternit's runtime manager. |
| Semantic action transactions | pi-computer-use | Adopt outcomes, postconditions, stop boundaries, and successor-state behavior. |
| Native background input | Cua Driver + pi invariants | Integrate Cua Driver as the initial packaged provider; enforce Allternit/pi policy above it. |
| Browser semantic control | pi CDP model + existing Allternit browser paths | Consolidate CDP/Playwright/extension paths behind one browser driver. |
| Cross-OS sandbox API | Cua Sandbox | Wrap behind `ComputerEnvironmentProvider`; do not leak the upstream SDK into product code. |
| macOS/Linux virtualization | Cua Lume/QEMU plus existing Allternit VM code | Prefer upstream provider first; migrate useful Allternit VM features into the common interface. |
| Windows and Android environments | Cua | Integrate as providers under the same environment contract. |
| Benchmarks and training export | Cua-Bench | Add an Allternit adapter and retain compatible trajectory export. |
| Policy, approvals, receipts, routing, UI | Allternit | Keep as product authority and extend to cover new runtime guarantees. |

## 4. Canonical contracts to build first

### 4.1 Environment

```ts
interface ComputerEnvironment {
  id: string
  provider: string
  os: 'macos' | 'windows' | 'linux' | 'android'
  isolation: 'host' | 'container' | 'vm'
  imageDigest?: string
  state: 'creating' | 'ready' | 'paused' | 'stopped' | 'failed'
  capabilities: CapabilityManifest
}
```

Required operations: create, start, stop, pause, resume, snapshot, restore, clone, destroy, health, stream, shell, files, clipboard, network policy, resource limits, artifact export.

### 4.2 Session and resource

Each session owns environments and logical roots. Each physical process, window group, CDP target, or device has a stable `resource_id`, scheduler lane, and monotonically increasing epoch.

### 4.3 Observation

Required fields:

- `state_id`, `session_id`, `resource_id`, `epoch`, `captured_at`;
- root identity, window/frame/scale/display metadata;
- normalized semantic tree with state-scoped element refs;
- optional screenshot and OCR evidence;
- DOM/AX/UIA/native identities kept private inside provider metadata;
- truncation, visibility, focus, editability, pressability, and scroll capability;
- image/coordinate transform and freshness information;
- provider, route, driver version, and invariant version.

Observations are immutable, bounded, and restorable until explicit eviction. Search, expand, and inspect are cached queries unless a live refresh is explicitly requested.

### 4.4 Action transaction

Every mutation includes `base_state_id`. Supported normalized actions:

- press/click/double-click/right-click;
- set text/type text;
- keypress/key chord;
- scroll;
- drag/drop;
- move pointer;
- wait;
- clipboard read/write;
- window focus/move/resize/minimize/maximize/close;
- application launch/quit;
- browser navigate/back/forward/reload/evaluate;
- shell, file, and mobile gesture actions when the environment allows them.

Transactions execute against one resource and stop on the first invalid, failed, or unknown boundary. Multi-resource workflows remain orchestration, not one transaction.

### 4.5 Outcome

Every action result contains:

- `worked`, `didnt`, `unknown`, `blocked`, or `cancelled`;
- grounding method and delivery route;
- verification evidence and semantic postcondition result;
- policy decision, approval identity, and receipt reference;
- executed step count and `stopped_at`;
- successor `state_id` and either a trustworthy diff or folded full observation;
- focus/cursor/interference changes;
- duration, model/provider usage, and cost;
- replay and trajectory references.

No adapter may translate event delivery into `worked` without verification.

### 4.6 Capability and invariant negotiation

Providers advertise:

- OS/action coverage;
- semantic vs raw input routes;
- strict-background guarantees;
- screenshot and stream modes;
- AX/UIA/DOM/OCR availability;
- isolation guarantees;
- clipboard/audio/mobile support;
- maximum concurrency and known limitations;
- driver and invariant schema versions.

Startup fails closed when a provider does not meet the invariants required by its configured mode.

## 5. Complete capability integration map

### 5.1 From pi-computer-use

| Capability | Allternit destination | Required work | Acceptance |
|---|---|---|---|
| Multi-root forest | `domains/computer-use/core/contracts/` and gateway | Normalize native windows, transient UI, and browser pages as roots. | One `find_roots` response covers all active provider roots. |
| Immutable state store | new runtime package under computer-use core | Persist complete bounded observations keyed by `state_id`. | Old refs resolve only in their owning state. |
| State-scoped element refs | replace/extend `core/element_refs.py` | Bind refs to state, never session-global mutable trees. | Cross-state ref use fails deterministically. |
| Resource epochs | new resource scheduler | Increment on mutations; reject stale writes before provider dispatch. | Race test proves losing write never reaches driver. |
| Per-resource scheduling | replace scattered locks/coordinators | Serialize same resource; allow independent roots in parallel. | Same-process actions order; independent apps overlap. |
| Cached progressive disclosure | observation query service | Add search, expand, inspect, text read over stored trees. | Queries do not recapture unless explicitly live. |
| Folded initial observations | gateway/MCP/SDK renderers | Return compact tree with targeted expansion. | Token and payload budgets are enforced. |
| Unified CDP/native tree | browser and native providers | Convert CDP AX tree into canonical nodes. | Planner uses identical ref actions in browser/native contexts. |
| Action lists/transactions | canonical action service | Validate and execute dependent steps against one base state. | Partial results identify exact stop boundary. |
| Semantic postconditions | verifier service | Support text/role/value/visibility appear/disappear conditions. | Delivered event with failed condition returns `didnt`. |
| Honest outcomes | all adapters | Replace generic success booleans with canonical outcome. | `unknown` is preserved end-to-end and visible in UI. |
| Safe retry rules | action service | Retry only proven side-effect-free failures; never replay ambiguous pointer acts. | Duplicate-submit regression test passes. |
| Focus preservation | native transaction provider | Retain click-established focus for dependent keyboard input. | Canvas/editor input tests pass. |
| Strict headless invariant | policy + provider selection | Prohibit activation, focus theft, raw global input, cursor movement, overlay. | Observer confirms zero user-desktop interference. |
| Coordinate freshness | canonical observation/action validation | Coordinates require image-bearing state and matching transform. | Stale/missing image coordinates fail closed. |
| Successor diffs | observation renderer and sidecar | Stabilize identities; emit diff only when trustworthy. | Low-confidence matching falls back to full view. |
| Root appearance/closure tracking | event journal | Track menus, dialogs, sheets, popovers, window lifecycle. | Transient roots remain discoverable after actions. |
| Platform invariant versioning | provider handshake | Require contract and invariant declarations. | Old/missing provider versions cannot start in production mode. |
| macOS permission lifecycle | desktop packaging/onboarding | Stable bundle identity and TCC checks. | Fresh install guides and verifies required permissions. |
| Windows UIA lifecycle | Windows provider | Worker-local UIA, bounded extraction, root events, ref re-resolution. | Native Windows application matrix passes. |
| CDP target matching | browser provider | Stable page/window pairing and target-keyed connections. | Same-title/multi-window cases resolve correctly. |
| Browser console attachment | observation/outcome evidence | Capture relevant browser console records. | Failures link console evidence in trajectory. |
| Wait/read live operations | provider contract | Provider-side live polling with epochs. | No screenshot busy loop in gateway. |

### 5.2 From Cua

| Capability | Allternit destination | Required work | Acceptance |
|---|---|---|---|
| Cua Driver provider | new native provider | Install/proxy driver, translate canonical API to MCP/CLI/daemon contract. | macOS/Windows/Linux smoke matrix uses same Allternit calls. |
| Background native control | native provider + policy | Expose actual route and guarantee; prohibit false strict mode. | Background matrix shows no focus/cursor theft. |
| MCP driver transport | unified transport layer | Support stdio/local IPC; keep remote exposure authenticated. | Same provider works from product and MCP client. |
| Cua Sandbox provider | environment service | Wrap SDK lifecycle and controls. | Ephemeral environment completes create→act→destroy. |
| Linux container images | environment/image registry | Register supported XFCE/container images and digests. | Repeated task starts from identical digest. |
| Linux VM support | environment provider | QEMU-backed VM lifecycle. | Snapshot/restore preserves task state. |
| macOS VM support | Lume provider | Integrate lifecycle, images, streaming, shell, files, input. | Apple Silicon end-to-end task passes in clean VM. |
| Windows VM/sandbox | environment provider | Integrate Windows images and control server. | Clean Windows task is reproducible. |
| Android/device gestures | device provider | Normalize taps, swipes, multitouch, keyboard, screenshot. | Android benchmark smoke pack passes. |
| Bring-your-own image | image registry | Validate, import, digest, scan, and policy-gate custom images. | Imported image is reproducible and attributable. |
| Shell and files in environment | canonical environment API | Add controlled exec, upload/download, directory and artifact operations. | Policy and receipts cover shell/file side effects. |
| Clipboard | environment/session contract | Bidirectional, policy-filtered clipboard synchronization. | Secret/redaction policy is enforced. |
| Streaming viewport | sidecar and environment provider | Negotiate codec, resolution, fps, resize, reconnect. | User can watch and take control without session loss. |
| Shared audio where supported | stream contract | Optional negotiated audio channel. | Capability is explicit and disabled by policy by default. |
| Human takeover/co-op | sidecar/session lease | Pause agent, grant user lease, resume after re-observation. | Agent cannot act while human lease is held. |
| Concurrent sessions/pools | environment/session manager | Pool environments with isolation, quotas, cleanup, and graceful shutdown. | Multi-client isolation and eviction tests pass. |
| Image building/app installation | image pipeline | Declarative image builds with provenance and caching. | Produced image includes manifest and digest. |
| Trajectory recording | evidence service | Capture typed events, observations, actions, outcomes, artifacts, environment metadata. | Every production run has schema-valid trace. |
| Video recording | evidence service/replay UI | Generate time-aligned MP4 in addition to GIF. | Timeline seeks from action to video/evidence. |
| Trajectory viewer | Allternit sidecar/replay view | Show actions, diffs, policy, approvals, costs, logs, and video. | Failed task can be diagnosed without raw server logs. |
| Computer server tools | canonical API transports | Cover screen, mouse, keyboard, clipboard, shell, files, windows, accessibility. | Tool inventory is generated from one schema. |
| Python SDK | SDK package | Generated typed client for environment/session/action API. | Public examples run without internal imports. |
| TypeScript SDK | `@allternit/sdk/computer-use` | Expand around canonical schemas and event streams. | Product consumes public SDK, not private gateway shapes. |
| CLI | Allternit CLI | Environment/session/observe/act/record/benchmark commands. | CLI and UI operate the same session. |
| Cua-Bench adapter | benchmark package | Implement Allternit agent/environment adapters. | Allternit runs Cua basic dataset and exports results. |
| OSWorld integration | benchmark package | Register dataset/environment requirements. | Repeatable scored run with archived evidence. |
| ScreenSpot integration | benchmark package | Add grounding evaluation. | Coordinate/ref accuracy metrics reported. |
| Windows Arena integration | benchmark package | Windows task runner and image setup. | Repeatable Windows score and trajectory bundle. |
| Custom datasets | benchmark registry | Manifest schema, verifier, reset, secrets, attempts, limits. | Teams can add a task without modifying runner core. |
| Calibration/retries | benchmark runner | N attempts per task/model and statistical summaries. | Reports include variance and confidence intervals. |
| Parallel benchmark execution | benchmark scheduler | Quotas and independent environments. | Parallel results equal isolated sequential semantics. |
| Training export | trajectory export service | Redacted model-ready actions/observations and provenance. | Export validates and contains no disallowed secrets. |
| Telemetry controls | settings/governance | Explicit notice, enable/disable, local audit, no hidden upstream telemetry. | Offline mode produces no outbound telemetry. |
| Cross-platform action matrix | docs + generated dashboard | Derive from provider tests and capability manifests. | Public matrix matches test artifacts automatically. |
| Typed E2E evidence | CI/evidence pipeline | Attach video, trajectory, screenshots, AX/DOM, result and environment record per cell. | A green cell cannot exist without required evidence. |

### 5.3 Existing Allternit capabilities to preserve and connect

| Capability | Integration requirement |
|---|---|
| Multi-provider vision and model routing | Consume canonical observations and return canonical intent actions. |
| Planning loop | Operate only through the canonical API; re-observe after unknown or invalidated actions. |
| Policy engine | Evaluate environment, route guarantee, action, target, data class, and postcondition before dispatch. |
| Approval flow | Bind approval to exact action hash, base state, resource epoch, environment, and expiry. |
| Receipts | Include provider route, guarantees, evidence hashes, approval, successor state, and trajectory. |
| Browser/desktop hybrid workflows | Use orchestrated transactions with explicit handoff states. |
| Parallel coordinator | Delegate scheduling to resource/environment manager; retain workflow fan-out logic. |
| Recordings/GIF | Keep for lightweight UX; derive from canonical trajectory and add MP4. |
| Sidecar/cursor/AX UI | Render canonical events; show route, confidence, outcome, state freshness, and control lease. |
| Plugins/cookbooks | Declare required capabilities and risk; resolve through provider selection. |
| Conformance dashboard | Report evidence-backed layers separately; remove mock-derived production grades. |

## 6. Workstreams — all mandatory

### WS-A: Contracts and schemas

Own the canonical types, JSON schemas, error codes, versioning, migrations, compatibility fixtures, and generated SDK types.

### WS-B: State, refs, scheduling, and transactions

Build immutable storage, epochs, resource lanes, ref resolution, progressive queries, transaction boundaries, successor observations, and safe cancellation.

### WS-C: Native driver integration

Integrate Cua Driver, build provider translation, package permissions and signing, prove macOS/Windows/Linux behavior, and retain the existing Allternit accessibility adapter only as a compatibility provider until parity is established.

### WS-D: Browser convergence

Unify Playwright, CDP, extension, and browser-use routing. Prefer semantic DOM/AX action; use vision/coordinates only when required. Remove the gateway self-loop and duplicated session ownership.

### WS-E: Sandboxes, VMs, images, and devices

Wrap Cua Sandbox/Lume/QEMU/container/Android providers, integrate existing Firecracker and VM work where beneficial, and ship one environment/image registry.

### WS-F: Governance and safety

Extend policies to environment isolation, network, files, clipboard, shell, secrets, downloads, authentication, payments, destructive actions, background guarantees, and human takeover.

### WS-G: Evidence, replay, and observability

Unify SSE events, JSONL, GIF, video, screenshots, semantic trees, console/logs, metrics, receipts, and trace IDs into one versioned trajectory.

### WS-H: SDK, MCP, REST, CLI, and product UI

Generate transports from canonical schemas, consolidate daemon topology, update the sidecar and approval UX, and ensure all surfaces share sessions.

### WS-I: Evaluation, benchmarks, and training

Integrate Cua-Bench and external benchmark adapters; build real OS/app matrices, safety tests, calibration, regression gates, and redacted training exports.

### WS-J: Packaging, release, security, and operations

Handle upstream pinning, licenses, SBOM, signing, updates, rollback, telemetry consent, compatibility, quotas, cleanup, support matrix generation, and operational runbooks.

## 7. Dependency waves

Every wave is required. A later wave begins as soon as its required interfaces stabilize; workstreams may overlap.

### Wave 0 — Program baseline and source governance

- Record upstream commit pins and licenses.
- Inventory every current Allternit computer-use entry point and owner.
- Freeze new standalone adapters unless they implement the canonical provider interface.
- Establish architecture decision records for Cua Driver, Cua Sandbox, and upstream update policy.
- Identify code that can be reused directly versus wrapped, rewritten, or retired.

**Gate:** approved capability ledger, dependency graph, ownership map, and license/SBOM baseline.

### Wave 1 — Canonical trust core

- Land contracts, state IDs, resource epochs, scheduler, scoped refs, action outcomes, postconditions, provider handshake, and event envelope.
- Adapt current Playwright and accessibility paths to the new contract without removing old APIs.
- Change UI and receipts to display actual outcome and route.

**Gate:** stale writes are rejected before I/O; unknown stays unknown; all mutations produce successor state; current product can run through compatibility adapters.

### Wave 2 — Native and browser provider convergence

- Integrate Cua Driver on macOS and Windows, followed by Linux.
- Consolidate CDP, Playwright, extension, and browser-use under one browser provider family.
- Implement unified roots and semantic tree.
- Enforce strict-background behavior and permission/version lifecycle.

**Gate:** real application matrices pass for all three desktop OSes; browser/native tasks use identical agent-facing contracts; no silent global-input fallback.

### Wave 3 — Environment and device convergence

- Integrate Cua Sandbox and image registry.
- Integrate Linux containers, Linux/macOS/Windows VMs, custom images, snapshots, streaming, shell/files/clipboard, and Android.
- Connect Allternit Firecracker and existing VM functionality as providers or retire duplicated incomplete paths.
- Add user takeover leases and pooled concurrent sessions.

**Gate:** reproducible environment lifecycle and task replay across every supported OS/device class.

### Wave 4 — Full product and governance integration

- Migrate all product surfaces, plugins, agent modes, and workflows to public SDK contracts.
- Consolidate gateway/MCP/browser runtime processes behind one supervised daemon and session authority.
- Complete policy coverage, approval binding, receipts, budgets, quotas, network/data controls, and redaction.
- Upgrade sidecar to streaming, takeover, trajectory timeline, evidence, and route guarantees.

**Gate:** no product surface calls a legacy adapter directly; one session is visible and controllable across UI, SDK, CLI, REST, and MCP.

### Wave 5 — Evaluation, training, and release proof

- Integrate Cua-Bench, OSWorld, ScreenSpot, Windows Arena, and Allternit governance datasets.
- Add typed E2E evidence for every declared support cell.
- Add calibration, provider comparisons, cost/latency/intervention metrics, safety/adversarial suites, and training exports.
- Make evidence-backed matrices and regression reports release gates.

**Gate:** no platform/action capability is marked production without current real-environment evidence; benchmark changes are quantified release to release.

### Wave 6 — Legacy retirement and upstream maintenance

- Remove duplicate session managers, self-loop gateway adapter, obsolete direct tool schemas, unsafe fallbacks, and superseded provider code.
- Migrate stored recordings/receipts where needed.
- Establish monthly upstream review, compatibility tests, security response, and upgrade cadence.

**Gate:** one canonical runtime remains; unused legacy code is removed, actively
used compatibility routes have explicit owners, and rollback artifacts plus
migration records exist. No time-based deprecation delay is required.

## 8. Allternit file and package map

Proposed destinations are intentionally explicit; final names can change through ADRs without changing the separation of concerns.

```text
domains/computer-use/
  contracts/                 canonical schemas and generated types
  runtime/
    state/                   immutable observations and eviction
    scheduler/               resource epochs and lanes
    transactions/            validation, execution, outcomes
    sessions/                shared session authority and leases
  providers/
    native-cua-driver/       Cua Driver translation
    native-legacy/           temporary existing AX/pyautogui compatibility
    browser-cdp/
    browser-playwright/
    browser-extension/
    sandbox-cua/
    sandbox-firecracker/
    device-android/
  environments/             lifecycle, images, snapshots, pools
  governance/               policy, approvals, budgets, redaction
  evidence/                 trajectory, artifacts, video, replay
  evaluation/               conformance, benchmarks, matrices
  transports/               local IPC, REST, MCP, event streaming

packages/@allternit/sdk/
  computer-use/              generated/public TypeScript API

surfaces/ai.allternit.com/
  src/capsules/browser/      canonical session, stream, replay, takeover UI
  src/integration/           SDK-only integration; no raw gateway shapes

cmd/
  allternit-computer/        supervised daemon and CLI
```

Existing `domains/computer-use/core`, `api/services/browser-runtime`, and gateway GUI tools should migrate incrementally into this map. They must not be bulk-deleted until parity, data migration, and rollback are proven.

## 9. Safety and governance requirements

These are mandatory across host and sandbox modes:

1. Default risky work to sandbox isolation when available.
2. Bind approvals to exact state/action/environment and expire them after any relevant mutation.
3. Separate observation permission from input, clipboard, shell, files, network, microphone/audio, and secrets permissions.
4. Deny cross-session refs, cookies, credentials, clipboard, and artifacts unless explicitly authorized.
5. Redact trajectories deterministically before upload, sharing, or training export.
6. Require human confirmation for payments, account changes, external publication, destructive actions, security settings, and irreversible submissions.
7. Pause all agent input while a human takeover lease is active.
8. Enforce max steps, wall time, token/cost budget, environment resources, downloads, and network scope.
9. Make strict background claims machine-verifiable; otherwise label the run foreground-assisted.
10. Record policy inputs, decision, rule/version, approval, execution route, and evidence in the receipt.

## 10. Test and evidence matrix

Each declared provider/action cell must progress through all applicable layers:

| Layer | Purpose | Production evidence requirement |
|---|---|---|
| Schema/contract | Serialization and compatibility | Versioned fixtures and generated-client tests |
| Deterministic unit | State, epochs, refs, retry, diff logic | Cross-platform deterministic pass |
| Simulated provider | Error and race injection | Clearly labeled non-production evidence |
| Browser real E2E | Chromium plus supported browsers | Screenshot, DOM/AX, trajectory, result |
| Native real E2E | Representative apps per OS | Video, before/after, AX/UIA, interference observer |
| Environment lifecycle | Images, snapshots, cleanup, isolation | Digest, environment record, resource/cleanup proof |
| Task benchmark | End-to-end success | Verifier output, attempts, cost, latency, trace |
| Safety/adversarial | Policy bypass and prompt injection | Decision log, no forbidden side effect |
| Human takeover | Pause/lease/resume correctness | Timeline proving exclusive input ownership |
| Upgrade/rollback | Compatibility and recovery | Old/new driver matrix and rollback record |

Required real application coverage:

- macOS: Finder, TextEdit, Safari/Chrome, system dialogs, one canvas/non-AX-heavy app;
- Windows: Explorer, Notepad, Edge/Chrome, system dialogs, one Electron app;
- Linux: X11 and supported Wayland routes, browser, GTK, Electron, file manager;
- browser: forms, dialogs, downloads/uploads, multiple tabs/windows, canvas, iframes, auth boundaries;
- Android: tap, swipe, type, back/home, rotation/resolution, app lifecycle;
- sandbox: create, boot, reconnect, snapshot, restore, clone, failure cleanup, concurrent isolation.

## 11. Metrics and release gates

Report per OS, provider, route, app class, model, and environment:

- task success rate and verifier confidence;
- action `worked/didnt/unknown/blocked` distribution;
- stale-action rejection count;
- grounding/ref/coordinate accuracy;
- interference failures and focus/cursor changes;
- human intervention and approval rates;
- policy violations and prevented unsafe actions;
- latency by observe/plan/act/verify step;
- tokens and cost per successful task;
- crash, reconnect, cleanup, and leaked-environment rates;
- trajectory completeness and redaction failures;
- benchmark score with attempts and variance.

Production gates:

- zero known uncontained cross-session or cross-environment access;
- zero silent background-to-global-input fallbacks;
- zero mock-only cells labeled production;
- every advertised cell has current typed evidence;
- ambiguous side-effecting actions are never auto-retried;
- all active environments have quota, timeout, cleanup, and audit ownership;
- rollback is available for daemon, driver, schema migration, and image updates.

## 12. Migration strategy

1. **Shadow:** canonical runtime observes existing actions and compares normalized results without controlling dispatch.
2. **Dual route:** selected sessions use new providers; old path remains available per session.
3. **Default new:** new runtime becomes default for proven cells; unsupported cells remain explicitly legacy.
4. **Read-only legacy:** old sessions/recordings remain viewable, but new runs cannot select retired routes.
5. **Removal:** delete legacy only after usage reaches zero, parity evidence passes, data migration completes, and rollback window expires.

Provider selection must be explicit in traces. Automatic fallback is allowed only when policy confirms the replacement route provides equal or stronger isolation and interference guarantees.

## 13. Upstream and licensing controls

- Pin upstream commits or released versions; never track an unreviewed branch.
- Preserve MIT notices and attribution for incorporated code.
- Maintain a source ledger mapping copied/derived files and modifications.
- Review optional dependencies independently; Cua notes that optional `cua-agent[omni]` pulls `ultralytics` under AGPL-3.0, so do not include it in distributed Allternit builds without a deliberate licensing decision.
- Disable or explicitly configure upstream telemetry through Allternit consent settings.
- Generate SBOMs for daemon, native helper, Python/TypeScript SDKs, VM/container images, and optional providers.
- Run upstream compatibility fixtures before every upgrade and retain rollback pins.

## 14. Definition of complete

The integration program is complete only when:

- every capability in Sections 5.1 and 5.2 is implemented, deliberately replaced by an equal-or-stronger Allternit capability, or documented as legally/platform-impossible with an approved product constraint;
- every Allternit surface uses the canonical public SDK and shared session authority;
- native host, browser, sandbox, VM, and Android providers share observation/action/outcome contracts;
- macOS, Windows, and Linux native matrices carry real evidence;
- strict background behavior is proven, not inferred;
- environment/image lifecycle is reproducible and audited;
- trajectories, video, receipts, policies, approvals, costs, and benchmark results are linked;
- mock and simulated results are visibly separated from production evidence;
- duplicated and unsafe legacy paths are retired;
- installation, permission setup, updates, rollback, telemetry consent, and operational cleanup are supported product flows;
- documentation and the conformance dashboard are generated from tested provider capabilities rather than manually asserted status.

## 15. Immediate execution backlog

All items are program priorities; the ordering below is the shortest dependency path to full integration.

1. Create ADRs for canonical contracts, Cua Driver provider, Cua Sandbox provider, daemon topology, and source/licensing policy.
2. Produce the current entry-point and session-owner inventory.
3. Add contract packages and JSON schemas.
4. Implement immutable state storage, epochs, scheduler, and scoped refs.
5. Implement canonical transaction outcomes and postconditions.
6. Adapt current Playwright and accessibility implementations to the contract.
7. Change receipts, events, SDK, and sidecar to consume canonical results.
8. Integrate Cua Driver on macOS, then Windows and Linux through the same provider interface.
9. Converge browser providers and remove duplicated session ownership/self-loop routing.
10. Integrate Cua Sandbox and the environment/image registry.
11. Add containers, macOS/Linux/Windows VMs, snapshots, streaming, shell/files/clipboard, and Android.
12. Add human takeover leases and pooled concurrent sessions.
13. Complete policy coverage and state-bound approvals.
14. Implement versioned trajectories, MP4, evidence linking, redaction, and viewer upgrades.
15. Add Python/TypeScript SDK generation, MCP/REST/local IPC, CLI, and one supervised daemon.
16. Integrate Cua-Bench, OSWorld, ScreenSpot, Windows Arena, custom Allternit governance datasets, and training export.
17. Replace current maturity grades with evidence-derived support matrices and release gates.
18. Migrate product surfaces and plugins, then retire legacy routes through the staged migration process.
19. Establish upstream update, security response, benchmark regression, and rollback operations.

The plan deliberately treats reliability, cross-platform support, sandboxing, product integration, safety, evidence, benchmarks, SDKs, packaging, and operations as one program. None is relegated to “future nice-to-have” status.
