# Session Attestation — Fabric Transport Phase A Hardening

**Date/Time:** 2026-08-29 02:00 local  
**Session ID / Branch:** `session/fabric-transport-convergence`  
**Agent:** kimi  
**Base attestation:** `agent-ledger/summaries/2026-08-28-1700-fabric-transport-convergence-kimi-capability-native-access.md`  
**Worktree:** `/Users/joe/Desktop/allternit-workspace/allternit-session-fabric-transport-convergence`

## Summary

Hardened the server-side Fabric runtime so that the capability catalog is no longer false advertising. Added executable shell, file, and browser capabilities; receipt/journal emission after every invocation; shared-key lease authority support; and richer peer discovery with full-record fallback. This keeps the convergence on track for client migration in Phase B.

## What was done

1. **Capability executors** (`cmd/gizzi-code/src/runtime/fabric/executor.ts`)
   - Added `harness.shell` executor: one-shot command execution with stdout/stderr/exit code via `Bun.spawn`.
   - Added `harness.file.read`, `harness.file.write`, `harness.file.list`, and `harness.file.search` executors, reusing the existing `File` namespace.
   - Added `harness.browser.navigate` executor: fetches a URL and returns status, content type, title, and optional content preview.
   - Every dispatch (success, failure, or lease rejection) now emits a receipt through `FabricJournal`.

2. **Capability catalog** (`cmd/gizzi-code/src/runtime/fabric/capability-catalog.ts`)
   - Advertises the new granular capabilities:
     - `harness.shell`, `harness.shell.exec`, `harness.shell.stream`
     - `harness.file`, `harness.file.read`, `harness.file.write`, `harness.file.list`, `harness.file.search`
     - `harness.browser.navigate`
   - Existing session capabilities and `network.tailscale` remain.

3. **Receipt/journal** (`cmd/gizzi-code/src/runtime/fabric/journal.ts`) — new file
   - Writes append-only JSON-lines `FabricReceipt` records to `~/.gizzi/fabric-journal/<YYYY-MM-DD>.ndjson`.
   - Receipts include capability, node, request ID, lease ID, success/failure, result summary, and input keys.
   - Provides `FabricJournal.readRecent(limit)` for local audit/debugging.

4. **Shared-key lease authority** (`cmd/gizzi-code/src/runtime/fabric/lease-authority.ts`)
   - `ALLTERNIT_FABRIC_LEASE_KEY` env variable can provide a shared 32+ byte key (hex or base64) used for lease signing/verification across nodes.
   - Falls back to node-local HMAC secret only when no shared key is configured.
   - Added `LeasePolicy` with `workloadId`, `principalId`, `budgetId`, `maxInvocations`, and `extra` fields; policy is signed into the lease canonical payload.

5. **Lease and Fabric route schemas** (`cmd/gizzi-code/src/runtime/fabric/transport.ts`, `cmd/gizzi-code/src/runtime/server/routes/fabric.ts`)
   - Added `policy` field to `FabricLease` schema.
   - `POST /v1/fabric/leases` accepts an optional `policy` object and returns a signed lease carrying it.

6. **Peer registry improvements** (`cmd/gizzi-code/src/runtime/fabric/peer-registry.ts`)
   - `PlatformPeerRegistry` now accepts a `localIdentity` callback and always includes the local node when resolving peers, even with no platform credential.
   - If the platform registry returns a full `record` field on a `gizzi-instance`, it is used as the peer `NodeIdentity` instead of being reconstructed from URL/name/capability strings.
   - Avoided circular imports by passing the local identity callback from transport constructors rather than importing `Fabric`.

7. **Transport constructors** (`cmd/gizzi-code/src/runtime/fabric/tailscale-transport.ts`, `cmd/gizzi-code/src/runtime/fabric/tunnel-transport.ts`)
   - Pass `() => this._identity` to `PlatformPeerRegistry` so local identity is injected without a circular dependency.

8. **Unit tests** (`cmd/gizzi-code/src/runtime/fabric/fabric.test.ts`) — new file
   - Tests for lease issue/verify, tamper detection, policy inclusion.
   - Tests for journal write/read.
   - Tests for peer registry local identity inclusion and capability filtering.

## Verification

- `bun test src/runtime/fabric/fabric.test.ts --timeout 30000` passes (6/6 tests).
- `bun run typecheck` in `cmd/gizzi-code` shows only the pre-existing `packages/sdk/scripts/verify-sdk.ts` missing-dist errors. No new errors were introduced by these changes.
- The SDK dist errors are an existing workspace artifact issue; building `@allternit/sdk` with `build:runtime` produces the runtime exports but not all provider/harness dist files used by the verify script.

## Known gaps / remaining work

- **Client migration (Phase B)**: iOS, Desktop, and Web clients still consume `/remote-control`. They need to discover nodes via `/v1/fabric/peers`, request leases from `/v1/fabric/leases`, and invoke capabilities through `/v1/session-worker/invoke`.
- **Application adapters**: Photoshop/Xcode/native-app adapters remain future work; the current executors cover shell, file, and browser navigation.
- **Policy enforcement**: `maxInvocations` and other policy constraints are carried in the lease but not yet enforced by the executor gateway.
- **Platform registry full-record storage**: `PlatformPeerRegistry` uses full records when the platform returns them, but the gizzi-code side cannot force the platform schema to store them.
- **LAN transport proof**: `LanFabricTransport` (mDNS/Bonjour) is not implemented; only Tailscale and cloudflared tunnel transports exist.
- **os-contracts convergence**: Local zod v4 schemas remain; replace with `@allternit/os-contracts` imports once ratified.

## Files changed

- `cmd/gizzi-code/src/runtime/fabric/executor.ts` — shell/file/browser executors + receipt emission
- `cmd/gizzi-code/src/runtime/fabric/journal.ts` — new receipt journal
- `cmd/gizzi-code/src/runtime/fabric/capability-catalog.ts` — advertise new capabilities
- `cmd/gizzi-code/src/runtime/fabric/lease-authority.ts` — shared-key + policy support
- `cmd/gizzi-code/src/runtime/fabric/transport.ts` — `policy` field on lease schema
- `cmd/gizzi-code/src/runtime/fabric/peer-registry.ts` — local identity callback + full-record fallback
- `cmd/gizzi-code/src/runtime/fabric/tailscale-transport.ts` — pass local identity callback
- `cmd/gizzi-code/src/runtime/fabric/tunnel-transport.ts` — pass local identity callback
- `cmd/gizzi-code/src/runtime/server/routes/fabric.ts` — accept `policy` in lease request
- `cmd/gizzi-code/src/runtime/fabric/fabric.test.ts` — new unit tests

## Phase B — iOS client migration (this session)

Migrated the iOS chat/agent path onto the capability-native Fabric endpoints while keeping session create/list/get/abort and attachment uploads on the existing `AgentChatClient` REST paths (the new `/v1/session-worker` surface does not yet expose session create).

### What was done

1. **Fabric models** (`surfaces/allternit-mobile/ios/Core/Fabric/FabricModels.swift`) — new file
   - Swift equivalents of `NodeIdentity`, `NodeEndpoint`, `FabricCapability`, `NodeResource`, `FabricLease`, `FabricLeasePolicy`, `IssueLeaseRequest`, `CapabilityInvocationRequest`, `InvocationResult`, and `CapabilityQuery`.
   - All `Codable` and `Sendable`; `NodeIdentity`, `FabricCapability`, `NodeEndpoint`, and `NodeResource` are `Identifiable`.
   - Added a minimal `AnyCodable` helper for the free-form metadata/constraints/policy extras.

2. **Session-worker client** (`surfaces/allternit-mobile/ios/Core/Fabric/SessionWorkerClient.swift`) — new file
   - `SessionWorkerClient` initialized with `baseURL` and a token provider, mirroring `PtyClient`.
   - `fetchPeers(query:)`, `fetchLocalPeer()`, `issueLease(request:)`, `invoke(capability:inputs:lease:)`.
   - Sends `X-Allternit-Lease` header on `/v1/session-worker/invoke` when a lease is provided.
   - `streamEvents(sessionID:)` parses SSE `data:` lines into a typed `SessionWorkerEvent` enum.
   - `streamAgentChatEvents(sessionID:)` maps those Bus events to the existing `AgentChatEvent` model so `ChatViewModel` requires no changes.

3. **Node directory** (`surfaces/allternit-mobile/ios/Core/Fabric/NodeDirectory.swift`) — new file
   - `@MainActor ObservableObject` wrapping `InstanceConnection.resolve()` for the base URL.
   - Fetches `/v1/fabric/peers`, exposes `@Published var peers: [NodeIdentity]`.
   - Helpers `peer(for:)`, `peers(capability:)`, `peers(resource:)`, plus `refresh()` and a SwiftUI `.refreshNodeDirectory(_:)` task helper.

4. **Agent-chat client migration** (`surfaces/allternit-mobile/ios/Core/API/AgentChatClient.swift`)
   - Kept `createSession`, `listSessions`, `listMessages`, `abort`, `revert`, and `upload` on the existing `/api/v1/agent-sessions` and `/api/v1/uploads` paths.
   - Replaced the body of `sendMessageStream` with a two-stage path:
     1. Resolve a node via `InstanceConnection`.
     2. If a base URL resolves: lease `harness.session.message`, invoke it with `{ sessionID, text, attachments }`, then stream `/v1/session-worker/sessions/:id/events` mapped to `AgentChatEvent`.
     3. If no node resolves: fall back to legacy `POST /api/agent-chat` so release builds without a registered instance still behave during the transition.

5. **Code thread UI** (`surfaces/allternit-mobile/ios/Features/Code/CodeModeView.swift`)
   - Added a capability-based Fabric peer picker to `CodeThreadChatView` (shown when `NodeDirectory.peers.count > 1`).
   - Kept the existing instance picker/menu for terminal/file-browser host resolution through `InstanceConnection`.
   - Confirmed no user-facing "Remote Control" labels exist in the iOS tree.

### Verification

- `swiftc -parse` on the three new Fabric files succeeds.
- `swiftc -parse` passes on all new/modified Swift files.
- `xcodebuild` simulator build was run after regenerating the project with `xcodegen`; it fails before reaching Swift compilation because the pre-existing vendored frameworks (`Frameworks/Mesh.xcframework`, `Frameworks/libgit2.xcframework`) are absent in this worktree. This is an environment/setup issue, not a regression from the migration.
- No new Swift package dependencies were added.
- `PtyClient`, `FileClient`, and terminal flows are untouched.

### Known gaps / remaining work

- The SSE event mapping (`message.part.delta` → `textDelta`, `session.status` → `finish/done`, etc.) is best-effort against the current Bus event schemas. Full parity with the legacy agent-chat frame set may need tuning once the session-worker event contracts are exercised end-to-end.
- The new peer picker is a UI signal today; the chat path still resolves the actual host through `InstanceConnection`. Wiring a pinned Fabric peer directly into `AgentChatClient.sendMessageStream` is a small follow-up if desired.
- Desktop and Web clients still need equivalent Phase B migrations.

---

## Contract integration (2026-08-29 follow-up)

Aligned the runtime Fabric contracts with the canonical `@allternit/os-contracts` spine and removed locally-invented authority semantics.

### What changed

1. **Extended `@allternit/os-contracts`** (`packages/@allternit/os-contracts/src/spine.ts`)
   - Added `observe` and `stream` to `capabilityKindSchema`.
   - Added `leasePolicySchema`, `fabricTransportSchema`, `nodeEndpointSchema`, `nodeResourceSchema`, `nodeIdentitySchema`, `capabilityQuerySchema`, `fabricEventSchema`, and `fabricInvocationReceiptSchema`.
   - Extended `leaseSchema` with optional `policy` and `signature` fields.
   - Re-exported all new schemas/types from `src/index.ts`.
   - Added unit-test coverage for the new Fabric schemas.

2. **Built and published the package**
   - `pnpm --filter @allternit/os-contracts build` succeeded.
   - `pnpm --filter @allternit/os-contracts test` passes (6/6).

3. **Runtime schema alignment** (`cmd/gizzi-code/src/runtime/fabric/transport.ts`)
   - Canonical types (`NodeIdentity`, `NodeEndpoint`, `FabricCapability`, `FabricLease`, etc.) are now imported from `@allternit/os-contracts` and re-exported.
   - Local zod v4 validators are kept only as runtime parsers and are explicitly documented as mirrors of the canonical contracts.
   - Removed local semantic additions (`policy` invented locally); `policy` and `signature` now come from the contract.

4. **Lease authority cleanup** (`cmd/gizzi-code/src/runtime/fabric/lease-authority.ts`)
   - Removed node-local HMAC signing and the `ALLTERNIT_FABRIC_LEASE_KEY` shared-key fallback.
   - `issue()` now mints an unsigned dev lease only.
   - `check()` validates against the canonical `leaseSchema` and checks status/expiry; signature verification is left to the upstream authority service.

5. **Receipt alignment** (`cmd/gizzi-code/src/runtime/fabric/journal.ts`)
   - `FabricReceipt` is now the canonical `FabricInvocationReceipt` type from `@allternit/os-contracts`.

6. **Dependency**
   - Added `@allternit/os-contracts: "workspace:*"` to `cmd/gizzi-code/package.json` and re-ran `pnpm install --ignore-scripts`.

7. **iOS model alignment** (`surfaces/allternit-mobile/ios/Core/Fabric/FabricModels.swift`)
   - Made `FabricLease.signature` optional to match the canonical contract.

### Verification

- `bun run typecheck` in `cmd/gizzi-code` shows only the pre-existing `packages/sdk/scripts/verify-sdk.ts` dist errors.
- `bun test src/runtime/fabric/fabric.test.ts --timeout 30000` passes (4/4).
- `pnpm --filter @allternit/os-contracts test` passes (6/6).

### Remaining authority work

- The upstream Allternit lease authority service (signature issuance and verification) is not implemented in this runtime.
- `POST /v1/fabric/leases` is a dev-only convenience and must be disabled or proxied to the authority service in production.
