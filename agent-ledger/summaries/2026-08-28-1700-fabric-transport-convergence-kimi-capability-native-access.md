# Session Attestation — Fabric Transport Convergence

**Date/Time:** 2026-08-28 17:00 local  
**Session ID / Branch:** `session/fabric-transport-convergence`  
**Agent:** kimi  
**Commit:** `af2403577` (base) + uncommitted convergence changes  
**Worktree:** `/Users/joe/Desktop/allternit-workspace/allternit-session-fabric-transport-convergence`

## Summary

Laid the runtime foundation for replacing remote-control with capability-native harness access. Introduced a `FabricTransport` abstraction, a Tailscale-backed implementation that reuses the existing mesh join logic, a node capability catalog, new `/v1/session-worker` and `/v1/node/capabilities` routes, and deprecation shims for `/v1/remote-control`. Instance registration now publishes a full capability record instead of just `{ url, name }`.

This is **not a full migration** of the UI or mobile clients; it is the server-side contract and transport layer another agent can build on.

## What was done

1. **Fabric transport contracts** (`cmd/gizzi-code/src/runtime/fabric/`)
   - `transport.ts` — `FabricTransport` interface, `NodeIdentity`, `NodeEndpoint`, `FabricCapability`, `FabricLease`, `FabricWorkload`, `FabricEvent`, `CapabilityQuery`, `JoinResult`, `FabricConnection`. Shapes are aligned with the draft `@allternit/os-contracts` spine (Capability/Lease/Workload/Event) but use the local zod v4 stack.
   - `capability-catalog.ts` — discovers and advertises built-in harness capabilities (`harness.session`, `harness.session.message`, `harness.session.events`, `harness.session.abort`, `harness.shell`, `harness.file`, `network.tailscale`, etc.) plus node resources (CPU cores, memory, platform).
   - `tailscale-transport.ts` — `TailscaleFabricTransport` implementing `FabricTransport` by delegating to the existing `Mesh` namespace (sidecar/attach/spawn) and publishing a capability record via `InstanceRegistration.registerCapabilityRecord`.
   - `tunnel-transport.ts` — `TunnelFabricTransport` implementing `FabricTransport` by delegating to the existing `Tunnel` module (cloudflared quick/named tunnels) and publishing a capability record.
   - `index.ts` — exports `Fabric.getTailscaleTransport()`, `Fabric.getTunnelTransport()`, and `Fabric.getTransport()` singletons plus resets.

2. **Instance registration convergence** (`cmd/gizzi-code/src/runtime/server/instance-registration.ts`)
   - Added `registerCapabilityRecord(record: NodeIdentity)`.
   - The legacy `register({ url, name })` now builds a minimal `NodeIdentity` and delegates to `registerCapabilityRecord`, so both tunnel and mesh registrations emit the same shape.
   - PUT body keeps `url` and `name` at the top level for backward compatibility with the existing platform registry, and includes the full capability record for platforms that understand it.

3. **New capability-native routes**
   - `cmd/gizzi-code/src/runtime/server/routes/capabilities.ts` — `GET /v1/node/capabilities` returns the local harness capability record.
   - `cmd/gizzi-code/src/runtime/server/routes/session_worker.ts` — `/v1/session-worker/invoke` plus `/v1/session-worker/sessions/:sessionID/{messages,abort,events}` expose session control as worker functions instead of remote desktop operations.
   - `cmd/gizzi-code/src/runtime/server/middleware/lease-check.ts` — `LeaseCheck.enforce()` middleware reads `X-Allternit-Lease`, validates a `FabricLease`, and attaches it to Hono context. Defaults to lenient mode; set `GIZZI_ENFORCE_LEASES=true` to reject requests without a valid lease.

4. **Capability executor registry** (`cmd/gizzi-code/src/runtime/fabric/executor.ts`)
   - `CapabilityExecutors.register()` / `dispatch()` map capability names to async handlers and return structured `InvocationResult` receipts.
   - Built-in executors for `harness.session`, `harness.session.message`, `harness.session.abort`, and `harness.node.capabilities`.
   - `/v1/session-worker/invoke` now routes through the executor, passing the validated lease from the middleware as execution context.

5. **Remote-control deprecation** (`cmd/gizzi-code/src/runtime/server/routes/remote_control.ts`)
   - Added `Deprecation: true`, `Link: </v1/session-worker/sessions>; rel="successor-version"`, and `X-Allternit-Deprecated: remote-control → session-worker` headers to all `/remote-control` responses.

6. **Peer registry** (`cmd/gizzi-code/src/runtime/fabric/peer-registry.ts`)
   - `PlatformPeerRegistry` queries `/api/v1/gizzi-instances` and `/api/v1/runtime-devices`, merges URL endpoints with device capabilities, and returns `NodeIdentity[]`.
   - Short in-memory cache (30s) with `invalidate()`.
   - `TailscaleFabricTransport.resolve()` now uses the registry, so capability queries can return both the local node and peer runtimes.

7. **Lease authority** (`cmd/gizzi-code/src/runtime/fabric/lease-authority.ts`)
   - Node-local HMAC lease signing/verification with a secret persisted under the gizzi data dir (`fabric-lease.key`).
   - `LeaseAuthority.issue()` mints signed `FabricLease` records.
   - `LeaseAuthority.check()` verifies signature, status, and expiry.

8. **Fabric routes** (`cmd/gizzi-code/src/runtime/server/routes/fabric.ts`)
   - `POST /v1/fabric/leases` — mint a signed capability lease.
   - `GET /v1/fabric/peers` — capability-filtered peer resolution.
   - `GET /v1/fabric/peers/local` — local node identity.

9. **Lease-check middleware** (`cmd/gizzi-code/src/runtime/server/middleware/lease-check.ts`)
   - Validates the `X-Allternit-Lease` header using `LeaseAuthority.check()`.
   - Supports revocation via `LeaseCheck.revokeLease()`.
   - Lenient by default; set `GIZZI_ENFORCE_LEASES=true` to reject invalid or missing leases.

10. **Server wiring** (`cmd/gizzi-code/src/runtime/server/server.ts`)
    - Mounted `/v1/session-worker`, `/v1/node`, and `/v1/fabric`.
    - Replaced direct `Mesh.start` / `Mesh.stop` calls with `Fabric.getTailscaleTransport().join()` / `leave()` when `--mesh` is enabled.
    - Replaced direct `Tunnel.start` / `Tunnel.stop` calls with `Fabric.getTunnelTransport().join()` / `leave()` when `--tunnel` is enabled.

## Verification

- `bun run typecheck` in `cmd/gizzi-code` passes for all touched files.
- The only remaining type errors are pre-existing missing `packages/sdk/dist/...` imports in `packages/sdk/scripts/verify-sdk.ts` (SDK build artifact not present).
- `pnpm install --ignore-scripts` was run at the workspace root to obtain `tsc`; full `pnpm install` is blocked by a `better-sqlite3` native build failure against Node 26.5.0, unrelated to these changes.

## Known gaps / remaining work

- **Peer discovery completeness**: `PlatformPeerRegistry` merges the existing `gizzi-instances` and `runtime-devices` APIs. Full capability records (endpoints, resources, rich capabilities) require the platform registry to store the full `NodeIdentity` shape emitted by `registerCapabilityRecord`.
- **Lease service**: Leases are signed/verified locally with a node-local HMAC secret. A platform lease service (or shared key delegation) is needed for multi-node deployments before `GIZZI_ENFORCE_LEASES=true` is safe beyond a single node.
- **Application adapters**: The spec calls for Photoshop/Xcode/etc. adapters into the capability layer; these are not implemented.
- **Client/mobile migration**: iOS app and web dispatch UI still consume `/remote-control`. They need to migrate to `/v1/session-worker`.
- **os-contracts convergence**: When `@allternit/os-contracts` is ratified and built, the local fabric schemas should be replaced by imports from that package.

## Files changed

- `cmd/gizzi-code/src/runtime/fabric/transport.ts` — new Fabric transport contracts
- `cmd/gizzi-code/src/runtime/fabric/capability-catalog.ts` — new node capability catalog
- `cmd/gizzi-code/src/runtime/fabric/tailscale-transport.ts` — new Tailscale transport implementation
- `cmd/gizzi-code/src/runtime/fabric/tunnel-transport.ts` — new cloudflared tunnel transport implementation
- `cmd/gizzi-code/src/runtime/fabric/executor.ts` — new capability executor registry
- `cmd/gizzi-code/src/runtime/fabric/peer-registry.ts` — new platform peer registry
- `cmd/gizzi-code/src/runtime/fabric/lease-authority.ts` — new local lease signing/verification
- `cmd/gizzi-code/src/runtime/fabric/index.ts` — new Fabric singleton exports
- `cmd/gizzi-code/src/runtime/server/instance-registration.ts` — capability-record registration
- `cmd/gizzi-code/src/runtime/server/routes/capabilities.ts` — new `GET /v1/node/capabilities`
- `cmd/gizzi-code/src/runtime/server/routes/session_worker.ts` — new session worker routes
- `cmd/gizzi-code/src/runtime/server/routes/fabric.ts` — new `/v1/fabric/leases`, `/v1/fabric/peers`, and `/v1/fabric/peers/local`
- `cmd/gizzi-code/src/runtime/server/middleware/lease-check.ts` — lease-check middleware with signature validation
- `cmd/gizzi-code/src/runtime/server/routes/remote_control.ts` — deprecation headers
- `cmd/gizzi-code/src/runtime/server/server.ts` — mount new routes, use Fabric transports for mesh and tunnel
