# Platform Production Gap Audit

Date: 2026-05-06
Status: Open
Scope: `surfaces/allternit-platform` production path plus platform-coupled SDK runtime code in `sdk/allternit-sdk`

## Purpose

The platform now typechecks and builds again, but it is not yet production-quality. This document inventories the remaining issues that still degrade runtime trustworthiness, especially:

- placeholders that present synthetic success or synthetic data
- compatibility shims that keep old surfaces compiling but not fully real
- in-memory fallbacks that are acceptable in local development but weak in production
- UI routes that are explicit placeholder shells over backend work
- build/runtime warnings that indicate architecture leakage

This audit is intentionally scoped to the production path. It excludes test doubles, docs-only examples, `plugin-template`, `dev`, `dev-portal`, `qa`, generated output, and public demo assets.

## Current State After Rescue

What is now true:

- `pnpm run typecheck:fast` passes
- `pnpm run build` passes with increased Node heap
- platform startup is no longer hidden behind broken wrapper scripts
- Prisma/schema drift and major visual-editor type drift have been repaired enough to restore trust in compilation

What is still not true:

- the major surfaces have not all been smoke-tested end to end
- some client/API layers still fabricate data instead of calling real backends
- several views are honest placeholders
- some fallback paths would silently degrade correctness in production
- build warnings still expose bundling and environment issues

## Remaining Non-Blocking But Real Issues

### 1. Build warning: server-only code leaks into client graph

File:
- `src/lib/agents/agent-heartbeat-executor.ts`

Observed symptom:
- Next build warns that `child_process` cannot be resolved from a browser bundle trace.

Why this matters:
- this is a server/client boundary leak
- it means the dependency graph still lets server-only capabilities enter client compilation paths
- production correctness becomes fragile even when the build succeeds

Production-quality fix:
- mark server-only modules with `server-only`
- split `agent-heartbeat-executor` and any shell/process dependencies behind server route boundaries
- make `mode-session-store` and chat/session views depend only on serializable API interfaces, never on Node-execution helpers

### 2. Static generation environment warning

Observed symptom:
- resolved: build no longer emits `--localstorage-file was provided without a valid path` after moving persisted Zustand stores to explicit browser-only storage

Why this matters:
- this suggests a runtime/process bootstrap assumption is leaking into Next static generation
- it may hide broken initialization logic in production deploys

Production-quality fix:
- trace the flag source and ensure it is only passed by desktop/runtime entrypoints
- remove the flag from web builds entirely
- add one build-time invariant test that asserts web production build does not depend on desktop-only process flags

### 3. Third-party CSS compatibility warning

Import chain:
- `ag-grid-community/styles/ag-grid.css`
- `src/components/allternit/AllternitDataGrid.tsx`

Observed symptom:
- autoprefixer warns about `end` vs `flex-end`

Why this matters:
- low severity, but it leaves noise in CI and obscures more important warnings

Production-quality fix:
- prefer a patched or upgraded AG Grid version that resolves the CSS warning
- if upstream cannot be changed, document and suppress it in a controlled way rather than accepting recurring warning noise

### 4. Runtime validation gap

Observed symptom:
- build and typecheck passed, but the full surface matrix is not yet verified manually

Why this matters:
- many of the remaining issues are behavioral, not syntactic

Production-quality fix:
- add a smoke matrix for:
  - `/api/v1/version`
  - `/api/status`
  - chat/session creation
  - artifact flow
  - one code canvas flow
  - one design canvas flow
  - at least one infrastructure/deploy flow

## Production-Path Placeholders, Stubs, Shims, And Fallbacks

### A. Auth, Env, And Identity Shims

#### A1. Browser auth stub

File:
- `src/lib/auth-browser.ts`

Current behavior:
- returns 501-style placeholder auth handlers
- reads a demo session from `localStorage`

What it is trying to accomplish:
- keep browser bundles from importing Node-only auth dependencies

Why it blocks production quality:
- it can make unsupported auth states look like valid anonymous behavior
- localStorage-backed session state is not authoritative auth

Production-quality fix:
- remove this from production auth paths
- expose a real browser-safe auth adapter backed by Clerk or desktop auth bridge
- hard-fail unsupported environments instead of pretending auth exists

#### A2. Browser env stub

File:
- `src/lib/env-browser.ts`

Current behavior:
- injects fake defaults like `AUTH_SECRET: "dev-secret"` and `KERNEL_URL: http://127.0.0.1:3004`

What it is trying to accomplish:
- prevent client code from crashing when server env is unavailable

Why it blocks production quality:
- fake defaults can silently route requests to nonexistent or incorrect services
- it normalizes insecure assumptions like a dev auth secret

Production-quality fix:
- split client env and server env schemas explicitly
- remove secret-like fields from browser bundles entirely
- fail closed when required client env is missing

#### A3. Clerk server fallback stub

Files:
- `src/lib/runtime-backend-clerk.ts`
- `src/lib/server-auth.ts`

Current behavior:
- if Clerk import fails, code falls back to `@/stubs/clerk/nextjs-server`

What it is trying to accomplish:
- allow local/dev execution without Clerk middleware

Why it blocks production quality:
- production auth should never silently substitute a stub provider
- failure mode becomes ambiguous: missing middleware, misconfigured env, or intentional local mode

Production-quality fix:
- allow stub fallback only when an explicit local-dev flag is enabled
- in production builds, require real Clerk wiring or return a hard configuration error

#### A4. Non-blocking sign-up placeholder

File:
- `src/lib/platform-auth-client.tsx`

Current behavior:
- when Clerk is disabled, browser auth UI can degrade into a placeholder/non-blocking route

What it is trying to accomplish:
- let the platform run in desktop/local mode

Why it blocks production quality:
- hosted auth and local desktop auth are different products and need different explicit UX states

Production-quality fix:
- split hosted-web auth UX from local desktop auth UX
- do not render sign-in/up surfaces that imply real account creation when auth is disabled

### B. Agent Execution And Session Simulation

#### B1. Autopilot board-task simulation

File:
- `src/services/autopilot.ts`

Current behavior:
- `executeBoardTask` updates board status and then simulates progress with timed sleeps

What it is trying to accomplish:
- execute claimed cowork/board tasks through the agent runtime

Why it blocks production quality:
- task completion is synthetic
- a task can appear successful without any actual execution receipt

Production-quality fix:
- execute through the real agent/session runtime
- persist run IDs and receipts
- stream backend progress via SSE/WebSocket
- update board state only from verified execution events

#### B2. Runner plan simulation

File:
- `src/runner/runner.store.ts`

Current behavior:
- generates a mock plan client-side after calling operator execute
- step execution completion is simulated with timers

What it is trying to accomplish:
- provide plan-then-execute UX for browser automation and operator runs

Why it blocks production quality:
- the user can approve a plan that does not reflect backend reality
- step success is UI fiction

Production-quality fix:
- require the backend to return the actual plan model
- persist backend step IDs and statuses
- subscribe to real execution events
- treat missing backend planning as a degraded/error state, not a simulated happy path

#### B3. Native agent view compatibility hooks

File:
- `src/views/NativeAgentView.tsx`

Current behavior:
- local hook stubs return empty canvases and null replies
- execution mode loading is skipped
- compatibility aliases stand in for missing store contracts

What it is trying to accomplish:
- keep the reconstructed native agent shell running while mode-session-store evolves

Why it blocks production quality:
- the view can look operational while core panes have no real backing state
- users cannot trust canvas/reply sync behavior

Production-quality fix:
- either wire canvases, replies, and execution mode into the actual session store
- or gate this view behind a feature flag until those contracts exist

#### B4. Cowork project file-add stub

File:
- `src/views/cowork/CoworkProjectView.tsx`

Current behavior:
- file creation uses a prompt-based stub and fake file metadata

What it is trying to accomplish:
- let cowork users attach or create files in a project

Why it blocks production quality:
- file lifecycle is not real
- it can mislead users about persisted workspace state

Production-quality fix:
- replace with real file-picker or create-file flows
- persist through workspace APIs
- validate mime, size, path, and write success

#### B5. Code/cowork session canvas compatibility stubs

Files:
- `src/views/code/CodeCanvas.tsx`
- `src/views/cowork/CoworkRoot.tsx`

Current behavior:
- comments explicitly note canvases are not yet implemented in the new store

What they are trying to accomplish:
- preserve shell-level rendering while session/canvas persistence is in migration

Why they block production quality:
- canvas state may appear available while being partially disconnected from persistence

Production-quality fix:
- complete the store migration
- remove compatibility comments only when state persistence, hydration, and updates are real

### C. Infrastructure And Provisioning API Stubs

#### C1. Cloud provider client is synthetic

File:
- `src/api/infrastructure/cloud.ts`

Current behavior:
- provider list is hardcoded
- instance/deployment operations are TODOs or console logs

What it is trying to accomplish:
- list cloud providers, instances, and deployments

Why it blocks production quality:
- deploy/destroy/cancel actions are not authoritative
- operators could believe cloud actions were executed when nothing happened

Production-quality fix:
- replace with a real authenticated backend client
- implement idempotent create/cancel/destroy APIs
- return typed provider/region/catalog data from the backend

#### C2. SSH key management client is synthetic

File:
- `src/api/infrastructure/ssh-keys.ts`

Current behavior:
- list returns empty
- create fabricates a fingerprint
- import/generate/update/get are unimplemented

What it is trying to accomplish:
- manage SSH keys for BYOC/VPS flows

Why it blocks production quality:
- key identity, storage, and provenance are not real
- security-critical operations are not wired

Production-quality fix:
- back with secure server APIs
- store encrypted private material only when explicitly supported
- compute real fingerprints server-side
- add audit logs and permission boundaries

#### C3. VPS connection client is synthetic

File:
- `src/api/infrastructure/vps.ts`

Current behavior:
- test/install/execute/metrics return stub success or random values

What it is trying to accomplish:
- manage VPS connections and agent installation

Why it blocks production quality:
- success states are fabricated
- random metrics destroy operator trust

Production-quality fix:
- call real server endpoints for probe, execute, install, and telemetry
- remove random synthetic metrics entirely

#### C4. Environment provisioning client is synthetic

File:
- `src/api/infrastructure/environments.ts`

Current behavior:
- template and environment reads return empty data
- provision returns fabricated environment records
- log subscription is a no-op stub

What it is trying to accomplish:
- provision work environments and stream their lifecycle

Why it blocks production quality:
- environment lifecycle is not authoritative
- users cannot distinguish “nothing happened” from “provisioning”

Production-quality fix:
- implement real environment APIs
- make provisioning asynchronous with persisted job state
- stream logs/status from server-owned sources only

#### C5. Infrastructure websocket is synthetic

File:
- `src/api/infrastructure/websocket.ts`

Current behavior:
- connect/disconnect only log; no actual socket is created

What it is trying to accomplish:
- push deployment, instance, environment, and health events in real time

Why it blocks production quality:
- the presence of an event bus abstraction implies live data that does not exist

Production-quality fix:
- implement the actual websocket transport
- define connection lifecycle, auth, reconnect semantics, and event schema compatibility

### D. Workspace, Persistence, And Policy Gaps

#### D1. Snapshot restore placeholder

File:
- `src/lib/agents/agent-workspace.service.ts`

Current behavior:
- restore logic is a placeholder and does not reconstruct workspace state

What it is trying to accomplish:
- allow workspace snapshots/checkpoints to be restored

Why it blocks production quality:
- restore is a safety feature; if it is fake, recovery workflows are unsafe

Production-quality fix:
- persist snapshot manifests and file checksums
- restore files transactionally
- record restore audit events and conflict outcomes

#### D2. Policy parsing/evaluation is simplified

File:
- `src/agent-workspace/http-client.ts`

Current behavior:
- parses a policy file as a single rule “for now”
- effective behavior is permissive

What it is trying to accomplish:
- enforce workspace access policy

Why it blocks production quality:
- policy systems must be explicit and testable
- permissive fallback is unsafe

Production-quality fix:
- define a real policy grammar and evaluator
- support allow/deny semantics and precedence
- enforce server-side, not just in client helpers

#### D3. Changeset review is file-level only

File:
- `src/stores/changeset-store.ts`

Current behavior:
- `acceptHunk` and `rejectHunk` are “basic implementation for now”
- state is not truly hunk-granular

What it is trying to accomplish:
- support partial review/apply of generated changes

Why it blocks production quality:
- UI semantics imply hunk review precision that the store does not actually model

Production-quality fix:
- implement explicit hunk identity, acceptance state, merge semantics, and patch application

#### D4. OAuth token store has in-memory fallback

File:
- `src/lib/oauth-tokens.ts`

Current behavior:
- falls back to in-memory Maps when Redis is unavailable

What it is trying to accomplish:
- issue and rotate access/refresh tokens

Why it blocks production quality:
- tokens do not survive restarts
- multi-instance correctness is lost
- revocation semantics become process-local

Production-quality fix:
- require Redis or equivalent durable distributed store in production
- treat missing token store as a startup error

#### D5. A2UI session store has in-memory fallback

File:
- `src/lib/a2ui-sessions.ts`

Current behavior:
- stores sessions in process memory if Redis is absent

What it is trying to accomplish:
- persist A2UI session state

Why it blocks production quality:
- session continuity disappears on restart or scale-out

Production-quality fix:
- require shared persistence in production
- add session expiry, pruning, and data integrity checks

#### D6. Agent workspace discovery can fall back to WASM

Files:
- `src/agent-workspace/discovery.ts`
- `src/agent-workspace/useWorkspace.ts`
- `src/agent-workspace/types.ts`

Current behavior:
- retains compatibility layers and WASM fallback behavior

What it is trying to accomplish:
- preserve workspace access across different runtime backends

Why it blocks production quality:
- local-memory fallback is acceptable for exploration, not for authoritative stateful workflows

Production-quality fix:
- define which runtime modes are supported in production
- surface fallback mode explicitly in UI
- disallow ephemeral fallback for workflows requiring persistence

### E. Media, Evidence, And Model Output Truthfulness Gaps

#### E1. Image generation route returns placeholders on config or model failure

File:
- `src/app/api/v1/images/generate/route.ts`

Current behavior:
- returns a gradient placeholder image when no key is configured or generation fails

What it is trying to accomplish:
- keep presentation slides rendering even when image generation fails

Why it blocks production quality:
- generated media and placeholder media are materially different outputs
- silent substitution can hide provider failure

Production-quality fix:
- return explicit error/source state
- allow placeholders only behind an explicit user-facing fallback contract
- persist provider response metadata and failure reason

#### E2. Browser screenshot fallback is synthetic evidence

File:
- `src/allternit-os/programs/BrowserScreenshotCitations.tsx`

Current behavior:
- if browser automation is unavailable, generates a realistic SVG placeholder from the URL

What it is trying to accomplish:
- provide research citations with screenshots

Why it blocks production quality:
- synthetic screenshots can be mistaken for real captured evidence
- this is a truthfulness problem, not just a UX problem

Production-quality fix:
- never label synthetic screenshots as real evidence
- replace with explicit “capture unavailable” cards
- require provenance metadata for every stored screenshot

#### E3. Voice preset fallback is synthetic

File:
- `src/lib/agents/voice.service.ts`

Current behavior:
- if the voice service fails, returns default preset metadata

What it is trying to accomplish:
- keep voice-selection UI populated

Why it blocks production quality:
- the UI can advertise voices that may not be available or previewable

Production-quality fix:
- return service health and capability state separately
- mark unavailable voices as unavailable, not implicitly supported

#### E4. TokenLens uses heuristic assumptions

File:
- `src/lib/tokenlens/index.ts`

Current behavior:
- estimates usage with a “50% of context used for response” placeholder assumption

What it is trying to accomplish:
- estimate token usage / context budget

Why it blocks production quality:
- heuristics may be fine for telemetry but not for controls or billing semantics

Production-quality fix:
- separate estimate from measured usage
- derive from provider metadata where possible
- label estimates clearly in both API and UI

#### E5. Docmost adapter fallback section

File:
- `src/lib/artifacts/adapters/docmost.adapter.ts`

Current behavior:
- if structured headings are absent, emits a synthetic fallback section ID/body

What it is trying to accomplish:
- map Docmost content into the artifact schema

Why it blocks production quality:
- low-to-medium risk
- synthetic fallback content is acceptable only if it is clearly marked as lossy conversion

Production-quality fix:
- implement a fuller ProseMirror-to-section mapping
- record adapter warnings when lossy conversion occurs

#### E6. Multimedia video client is speculative

File:
- `src/lib/api/multimedia.ts`

Current behavior:
- Kling video client is labeled as a placeholder and may not match the actual provider API

What it is trying to accomplish:
- generate video assets through a third-party API

Why it blocks production quality:
- external provider contract may be wrong
- failures will only be discovered at runtime

Production-quality fix:
- verify against current provider docs
- add typed response decoding and integration tests
- avoid shipping speculative provider clients

### F. UI Placeholder Shells

The DAG operator surfaces were placeholder shells. They are now implemented against the real rails-backed runtime contracts through `src/views/dag/DagRuntimeWorkspace.tsx`, including planning, execution, WIH management, receipt evidence, ledger tracing, gate verification, ontology mapping, and vault/index maintenance.

Additional UI placeholder:

- `src/views/nodes/components/NodeList.tsx`
  - contains `Coming soon`
  - production fix: complete the list behavior or remove the entry point

### G. Mesh And Network Integration Gaps

#### G1. SSH over mesh is unimplemented

File:
- `src/lib/mesh-network/platform-integration.ts`

Current behavior:
- `sshOverMesh` throws “not implemented”

What it is trying to accomplish:
- execute commands over a joined mesh network

Why it blocks production quality:
- core promised mesh capability is absent

Production-quality fix:
- integrate a real SSH transport
- support host key verification, timeout control, output streaming, and audit logs

#### G2. Mesh invitation storage is non-persistent

File:
- `src/lib/mesh-network/platform-integration.ts`

Current behavior:
- invitation store/get/update/deregister methods are placeholders

What it is trying to accomplish:
- manage trustable mesh join invitations

Why it blocks production quality:
- invitation lifecycle is nonfunctional
- join flows cannot survive process restart

Production-quality fix:
- persist invitations and active mesh state in the database
- add expiry enforcement, one-time use guarantees, and cleanup jobs

### H. SDK Runtime Incomplete Implementations

#### H1. ACP harness bridge returns streaming placeholder

File:
- `sdk/allternit-sdk/src/ai-runtime/acp/harness-bridge.ts`

Current behavior:
- `stream` action returns a placeholder `streaming_initiated` response

What it is trying to accomplish:
- bridge ACP requests to model runtime streaming

Why it blocks production quality:
- callers may assume a stream exists when no stream contract is actually attached

Production-quality fix:
- implement real stream lifecycle handles, cancellation, chunk transport, and terminal events

#### H2. Multi-provider streaming modes are not implemented

File:
- `sdk/allternit-sdk/src/ai-runtime/harness/index.ts`

Current behavior:
- multiple provider streaming paths are still TODOs
- unsupported modes throw at runtime

What it is trying to accomplish:
- provide a unified harness across cloud, Anthropic, OpenAI, Google, local, and subprocess modes

Why it blocks production quality:
- runtime support matrix is broader than actual implementation

Production-quality fix:
- either implement each provider mode fully
- or reduce the advertised capability matrix and reject unsupported modes at registration time

### I. Smaller Compatibility And Accuracy Gaps

#### I1. OpenUI system-instruction stub

File:
- `src/lib/openui/prompts.ts`

Current behavior:
- local replacement for `getSystemInstructions` because the upstream package does not export it

What it is trying to accomplish:
- construct OpenUI instructions for interface-generation flows

Why it blocks production quality:
- low-to-medium risk, but it is an unowned compatibility shim

Production-quality fix:
- upgrade or patch the dependency
- or vendor a tested internal implementation with owned behavior

#### I2. Agent API verification uses synthetic fallbacks

File:
- `src/lib/agents/api-verification.ts`

Current behavior:
- default models/tools and local fallback responses are fabricated when endpoints are unavailable

What it is trying to accomplish:
- keep the agent creation wizard functional during backend outages

Why it blocks production quality:
- outages should degrade honestly, not manufacture capabilities

Production-quality fix:
- convert this into a capability-health layer
- surface degraded state explicitly
- do not fabricate inventories or create-agent semantics

#### I3. Model message text extraction is a placeholder

File:
- `src/lib/utils.ts`

Current behavior:
- `getTextContentFromModelMessage` is explicitly a placeholder implementation

What it is trying to accomplish:
- normalize model-message text extraction

Why it blocks production quality:
- message schema drift can corrupt transcript rendering or downstream processing

Production-quality fix:
- define a canonical message schema
- parse typed variants explicitly instead of `any`

## Non-Production Scaffolding That Should Stay Out Of The Blocker List

These are not being counted as production blockers unless they are imported into the production path:

- `src/plugin-template/**`
- `src/dev/**`
- `src/dev-portal/**`
- `src/qa/**`
- tests and fixtures
- generated assets and public demo content
- docs-only implementation notes

They should still be reviewed for accidental imports into production bundles.

## Correct Next Execution Plan

### Phase 6: Remove Production-Lying Fallbacks

1. Replace synthetic success/data in infrastructure clients:
   - `cloud.ts`
   - `ssh-keys.ts`
   - `vps.ts`
   - `environments.ts`
   - `websocket.ts`
2. Replace simulated execution in:
   - `autopilot.ts`
   - `runner.store.ts`
   - `NativeAgentView.tsx`
3. Remove browser auth/env stubs from production paths:
   - `auth-browser.ts`
   - `env-browser.ts`
   - Clerk fallback imports

### Phase 7: Harden Persistence And Policy

1. Make Redis mandatory for production token/session stores:
   - `oauth-tokens.ts`
   - `a2ui-sessions.ts`
2. Implement real snapshot restore:
   - `agent-workspace.service.ts`
3. Replace permissive policy parsing with a real evaluator:
   - `agent-workspace/http-client.ts`
4. Finish hunk-granular review semantics:
   - `changeset-store.ts`

### Phase 8: Fix Build/Runtime Boundary Issues

1. Remove server-only imports from client bundle paths:
   - `agent-heartbeat-executor.ts`
   - any transitive imports from session/chat client state
2. keep persisted client state on explicit browser-only storage adapters so SSR/build workers never touch implicit `localStorage`
3. clean or intentionally suppress the AG Grid CSS warning

### Phase 9: Truthfulness And Evidence Hardening

1. stop silent placeholder substitution in:
   - `images/generate/route.ts`
   - `BrowserScreenshotCitations.tsx`
   - `voice.service.ts`
2. validate speculative third-party clients:
   - `multimedia.ts`
3. distinguish measured vs estimated usage:
   - `tokenlens/index.ts`

### Phase 10: Close Or Gate Placeholder Surfaces

1. either fully implement or gate DAG placeholder views
2. complete or remove `NodeList` “Coming soon”
3. finish code/cowork/native session-canvas store migration

### Phase 11: Smoke-Test Matrix

1. chat/session flow
2. artifact flow
3. design canvas
4. code canvas
5. infrastructure flow
6. auth flow
7. one media-generation flow
8. one workspace snapshot/restore flow

## Decision Rule Going Forward

For the next tranche, no surface should be considered production-ready merely because it compiles. The minimum bar is:

- no synthetic success paths for real operations
- no hidden in-memory persistence for production state
- no placeholder UI on production routes without feature gating
- explicit degraded states instead of fabricated capabilities
- smoke-tested behavior for the main user workflows
