# Computer Use Full Integration — Execution Ledger

This ledger is the implementation companion to `COMPUTER-USE-FULL-INTEGRATION-MASTER-PLAN.md`.

**Status: FINISHED — 2026-07-15.** All mandatory implementation items are marked
complete. Supported compatibility routes have live consumers and are not deferred
deprecation work.

Status values: `[ ]` pending, `[~]` in progress, `[x]` complete, `[!]` blocked with reason. Every item is committed scope; sections are dependency waves, not priority tiers.

## Wave 0 — Baseline and governance

- [x] Record upstream commit pins, licenses, and dependency restrictions.
- [x] Inventory current entry points, session owners, adapters, transports, and evidence stores, including final compatibility-route consumer audit.
- [x] Add ADR: canonical computer contract.
- [x] Add ADR: Cua Driver provider.
- [x] Add ADR: Cua Sandbox/environment provider.
- [x] Add ADR: unified daemon and transport topology.
- [x] Add ADR: upstream source, telemetry, licensing, and update policy.
- [x] Create source reuse/derivation ledger.
- [x] Freeze new direct adapters outside the provider contract with a boundary manifest, provider policy, and staged-file enforcement script.

## Wave 1 — Canonical trust core

- [x] Add canonical Python contract models for environments, capabilities, roots, observations, actions, outcomes, evidence, and events.
- [x] Add immutable in-memory observation store with bounded eviction.
- [x] Add per-resource epoch scheduler and stale-state rejection.
- [x] Add state-scoped reference validation.
- [x] Add transaction executor with exact stop boundary and unknown preservation.
- [x] Add JSON Schema documents and TypeScript contract types to the existing `@allternit/computer-use` SDK.
- [x] Add semantic postcondition verifier.
- [x] Add successor diff renderer with confidence fallback.
- [x] Add SQLite persistent observation-store provider with immutable writes, bounded eviction, scope queries, and latest-state lookup.
- [x] Add provider invariant/version handshake enforcement and transaction preflight primitives.
- [x] Add conservative legacy `BaseAdapter` compatibility bridge; unverified `completed` results remain `unknown`.
- [x] Add canonical Playwright provider over the existing gateway session manager with state-scoped DOM refs and screenshot evidence.
- [x] Add canonical compatibility provider for the existing accessibility adapter; it explicitly disallows strict background and discloses global-input risk.
- [x] Add single-use, expiring approvals cryptographically bound to exact transaction state/action/environment/resource fields.
- [x] Extend receipts and trajectory events with canonical evidence using append-only receipt and event ledgers.
- [x] Add canonical gateway transport for provider discovery, observation, and state-bound transactions.
- [x] Migrate sidecar state and result display with visible provider guarantees, immutable state/epoch/evidence, honest outcome, and receipt status.
- [x] Add canonical provider/observe/transaction methods to the existing TypeScript SDK client.
- [x] Add canonical environment provider/image/environment/lease methods and types to both shipped TypeScript SDK surfaces.

## Wave 2 — Native and browser convergence

- [x] Implement Cua Driver local CLI transport, binary/manifest discovery, canonical observation/action translation, and truthful unavailable diagnostics. Automatic download/install remains prohibited pending the packaging flow.
- [x] Complete macOS native capability/permission lifecycle contract with non-prompting Accessibility/Screen Recording probes, signed-app settings plans, remediation, and recheck semantics.
- [x] Complete Windows native capability/permission lifecycle contract with UIA integrity-level planning, restart/recheck semantics, and explicit secure-desktop exclusion.
- [x] Complete Linux X11/Wayland capability matrix with AT-SPI discovery, X11 foreground/global-input limits, portal consent plans, and no unattended Wayland/strict-background claim.
- [x] Consolidate Playwright, CDP, extension, and browser-use under one durable logical session/resource authority; physical resources remain owned only by the backend that created or explicitly attached them, and goal-level browser-use is migration-only rather than falsely atomic.
- [x] Add canonical CDP provider over the existing Playwright CDP adapter without auto-launching or taking ownership of unrelated browsers; full session consolidation remains.
- [x] Add canonical browser-extension provider with DOM/accessibility/screenshot observations and state-scoped selector actions; shared session ownership remains.
- [x] Normalize DOM/CDP AX/native AX/UIA/Cua observations into the canonical `ElementNode` forest; nested sources use the bounded shared normalizer and provider-flat sources remain honest multi-root forests without invented hierarchy.
- [x] Add unified canonical root discovery across registered Playwright, accessibility, and Cua Driver providers; tree normalization remains in progress.
- [x] Make canonical provider initialization concurrency-safe and isolate aggregate root-discovery failures with per-provider diagnostics.
- [x] Enforce declared strict-background, foreground-assisted, and sandbox modes during transaction preflight; unsupported modes fail before delivery.
- [x] Remove silent global-input fallback from strict-background mode: legacy accessibility and mixed-route Cua Driver advertise foreground only, while strict routes must prove the guarantee.
- [x] Add fail-closed VM isolation controls so canonical Apple Virtualization and Firecracker environments cannot silently execute on the host.
- [x] Make unsafe VM-to-host process fallback opt-in-off globally; callers needing process isolation must select the process backend explicitly.

## Wave 3 — Environments and devices

- [x] Add durable canonical environment/image authority with immutable image metadata, clean-scan provisioning gate, lifecycle transitions, owner quotas, TTL cleanup, snapshot lineage, and exclusive human/agent leases.
- [x] Implement optional local-only Cua Sandbox environment provider with truthful SDK/runtime discovery, telemetry disabled, and no implicit cloud provisioning.
- [x] Implement image registry, immutable digest/provenance, mutable scan attestations, clean-image provisioning gates, and optional fail-closed Trivy scanning without auto-install/download.
- [x] Integrate optional Cua Docker Linux containers and Cua QEMU/Allternit Firecracker/Apple-VF Linux VMs with truthful runtime discovery and fail-closed isolation.
- [x] Integrate optional local Cua Lume macOS VMs as a dormant capability cell unless both SDK and Lume runtime are installed.
- [x] Integrate optional local Cua QEMU/Hyper-V Windows VM/sandbox environments as dormant capability cells unless the matching runtime is present.
- [x] Integrate custom images and snapshot/restore/clone with digest registration, lease/approval-bound Cua snapshot capture, immutable lineage, exact image-spec clone restoration, and requested-state provisioning.
- [x] Integrate lease-bound Cua Android tap, text, swipe, scroll, fling, pinch, hardware-key, wake, and notification actions with OS validation and honest unverified delivery status.
- [x] Add shell, files, clipboard, network controls, and artifact export: lease-bound argv shell, Cua text file/list and clipboard, bounded hashed artifact export, deny-by-default network policy, and fail-closed provider enforcement.
- [x] Add explicit viewport/audio/codec capability negotiation with truthful accepted/rejected channels and no fabricated transport readiness.
- [x] Add exclusive expiring human-takeover/agent leases; agent shell actions suspend during human takeover.
- [x] Add durable environment pools, per-pool and per-owner quotas, TTL cleanup, and exclusive leases for concurrent isolation.
- [x] Reconcile Firecracker, Apple-VF, legacy VM sessions, and optional Cua runtimes under one documented ownership matrix; canonical VM requests reuse existing backends and forbid host-process fallback.

## Wave 4 — Product, governance, and transports

- [x] Consolidate new computer-use work on one canonical session/resource authority with durable provider bindings and inspection; legacy managers are frozen migration-only pending deletion after deprecation gates.
- [x] Add supervised `allternit-computer` daemon with secure binding, launchd/systemd/Windows manifests, absolute-path installer rendering, restart policy, non-implicit activation, status CLI, and signed health-check/rollback packaging contract.
- [x] Provide canonical Python and TypeScript SDKs covering provider discovery, roots, observation, approvals, transactions, environments, leases, side effects, trajectory, evaluation/routing foundations, and honest API errors.
- [x] Provide schema-mapped REST, ordered events, MCP-stdio local IPC, packaged CLI, and dedicated canonical MCP tools that delegate to one authority without weakening semantics.
- [x] Migrate Chat, Cowork, Code, Browser, Desktop, and plugins to shared boundaries (shared SDK/store/sidecar, daemon runtime, Python/TS/MCP plugin boundaries, per-surface matrix, SDK-only product HTTP, canonical environment pools, and frozen compatibility cells recorded for old goal/VM runners).
- [x] Complete policy coverage for canonical transaction and environment side-effect channels with exact single-use approvals for shell, file writes, clipboard writes, and Android actions plus lease/network/image gates.
- [x] Add budgets, quotas, reference-only secret injection, deterministic redaction, clean-image gates, size limits, deny-by-default egress, pool/owner quotas, and redacted secret-reference audit facts.
- [x] Upgrade sidecar for live screenshot streaming, direct/human takeover controls, canonical evidence/outcomes/receipts/trajectory, and visible strict-background versus foreground route guarantees.

## Wave 5 — Evidence, evaluation, and training

- [x] Version canonical trajectory export schema with ordered append-only events and integrity hash.
- [x] Add canonical MP4 generation with capture-time-aligned frame durations, managed-artifact path validation, timeline metadata, and integrity hash.
- [x] Upgrade sidecar trajectory viewer with ordered event tail, event count, deterministic integrity hash, and canonical evidence/outcome/receipt context.
- [x] Integrate optional Cua-Bench through an explicit runner adapter with isolated environment IDs, timeouts, validated JSON evidence, hashing, and no auto-install.
- [x] Integrate optional OSWorld, ScreenSpot, and Windows Arena through explicit per-suite runner adapters with OS/license metadata, isolated environment IDs, evidence validation/hashing, and truthful unavailable diagnostics.
- [x] Add versioned Allternit governance/safety dataset cases for stale scope, unsafe fallback, approvals, takeover, images, quotas, secrets, honest outcomes, artifacts, and evidence gates.
- [x] Add repeated calibration and statistical reporting with sample counts, mean score, pass rate, and Wilson 95% interval.
- [x] Add bounded parallel benchmark orchestration with a separately allocated/released environment per case repetition and measured-evidence recording.
- [x] Add deterministic redacted training export with recursive sensitive-key removal and SHA-256 integrity.
- [x] Replace mock-derived production grades in the canonical path with measured-only evidence records keyed by provider capability cell.
- [x] Enforce fail-closed benchmark release gates with minimum samples, score, and confidence-bound thresholds.

## Wave 6 — Migration and retirement

- [x] Shadow canonical runtime against legacy paths with side-effect-free dual observations and post-hoc canonical-receipt versus legacy-result comparison; side effects are never replayed for shadowing.
- [x] Add durable dual-route capability cells with ordered migration stages and no stage skipping.
- [x] Make canonical-default and retirement transitions fail closed unless the exact provider capability cell passes measured release gates; rollback to earlier stages remains allowed.
- [x] Migrate recordings, receipts, and sessions with root-confined, content-hashed, idempotent JSON/JSONL imports into read-only canonical events; legacy receipts remain explicitly non-canonical rather than receiving false integrity claims.
- [x] Retire gateway self-loop, duplicate logical session manager, obsolete direct product HTTP ownership, and unsafe fallbacks; compatibility routes/schemas are frozen and governed by the canonical transport map and deprecation registry until release gates permit deletion.
- [x] Remove unused retired paths immediately, retain demonstrably used goal/action/session routes as supported compatibility APIs, and validate rollback through capability-cell routing without an artificial time-based deprecation gate.
- [x] Establish monthly upstream/security/compatibility operations with pinned-source, licensing, telemetry, advisories, scanning, conformance, measured gates, signing, and emergency rollback checks.

## Completion validation

- [x] Python canonical contracts, core, providers, gateway, MCP, and Python SDK compile successfully.
- [x] Canonical router, daemon CLI, MCP server, service, and environment authority import successfully as packages.
- [x] Canonical in-process health, provider, native capability, and environment-provider endpoints return HTTP 200.
- [x] TypeScript SDK source and both Summit bridge copies typecheck successfully.
- [x] Shipped SDK JavaScript and declaration artifacts include the new transport methods.
- [x] SDK compatibility action, session, streaming, and screenshot transports pass mocked runtime smoke checks.
- [x] HTTP/MCP plugin connector suites pass: 18 tests.
- [x] Provider-boundary validation, JSON validation, direct product HTTP audit, and scoped diff checks pass.
- [x] Clean wheel build/install and installed daemon start/stop/restart pass.
- [x] Real Chromium harness workflow passes 6/6 actions with receipts and screenshot artifact.
- [x] Five concurrent isolated browser sessions pass 15/15 actions.
- [x] Focused validation and canonical safety invariants pass; private-alpha boundary is recorded in `COMPUTER-USE-PRIVATE-ALPHA-READINESS-2026-07-15.md`.
- [x] Install and activate signed Cua Driver with telemetry disabled, both macOS grants, real desktop capture, and canonical harness registration.
- [x] Display the full canonical provider catalog in the harness, including actionable setup diagnostics rather than hiding unavailable routes.
# Packaged Allternit permission ownership — complete (2026-07-15)

- [x] Pin and checksum-verify Cua Driver 0.8.2 during desktop packaging.
- [x] Sign the embedded driver as nested Allternit app code.
- [x] Spawn it directly from `com.allternit.desktop` with embedded mode and upstream telemetry disabled.
- [x] Route the computer-use provider through the app-owned Unix socket.
- [x] Request Accessibility and Screen Recording from Allternit itself; no standalone CuaDriver privacy approval is part of the shipped flow.
- [x] Surface `Active · Allternit-owned` status in Allternit Settings.
