# Allternit Runtime Pairing Protocol

This document describes the first-party device-pairing protocol that binds Allternit desktop and VPS runtimes to a human account without giving the runtime the human's Clerk session token.

## Overview

```
┌─────────────────────────────────────┐
│ ai.allternit.com                    │  Clerk authenticates the human
│ Clerk session                       │
└─────────────┬───────────────────────┘
              │ approves
              ▼
┌─────────────────────────────────────┐
│ api.allternit.com                   │  Allternit owns device trust
│ runtime pairing + relay             │
└─────────────┬───────────────────────┘
              │ outbound WebSocket
              ▼
┌─────────────────────────────────────┐
│ Desktop / VPS runtime               │  Ed25519 keypair + device token
│ Gizzi brain                         │
└─────────────────────────────────────┘
```

Core separation:

- **Clerk** proves the human identity.
- **Allternit Cloud** issues and revokes device credentials.
- **Gizzi** owns provider credentials (Claude, OpenAI, MiniMax, etc.).
- **The local device** owns its private key; the cloud only sees the public key fingerprint.

## Pairing Flow

### 1. Runtime creates a pairing request

`POST /api/v1/runtime-pairings`

The runtime generates an Ed25519 keypair and sends the public key to the cloud.

```json
{
  "name": "Eoj’s MacBook Desktop",
  "runtimeType": "desktop",
  "hostname": "Eojs-MacBook-Pro.local",
  "platform": "darwin-arm64",
  "version": "1.2.3",
  "publicKey": "base64url(32-byte-ed25519-public-key)",
  "capabilities": [
    "runtime:connect",
    "runtime:execute",
    "runtime:files",
    "runtime:terminal",
    "providers:connect",
    "providers:use"
  ]
}
```

Response:

```json
{
  "pairingId": "uuid",
  "deviceCode": "base64url-secret",
  "userCode": "ABCD-2345",
  "challenge": "base64url-secret",
  "verificationUrl": "https://ai.allternit.com/pair?code=ABCD-2345",
  "expiresAt": "2026-07-16T01:40:00Z",
  "pollIntervalSeconds": 2
}
```

The runtime displays `userCode` and opens `verificationUrl` in the system browser.

### 2. Human approves in the browser or in Allternit Desktop

The browser loads `/pair?code=ABCD-2345`. If not signed in, Clerk redirects to sign-in and returns to `/pair`. Alternatively, an already-paired Allternit Desktop approves in-app from Settings → Devices. Both paths call:

`GET /api/v1/runtime-pairings/code/:code`  
`POST /api/v1/runtime-pairings/code/:code/approve`

Both require a valid Clerk session token in the `Authorization` header, or the runtime device credential of an already-paired device (which resolves to that device's owner — it can only act on pairings and devices belonging to its own account). The same applies to `POST /api/v1/runtime-pairings/code/:code/deny` and `GET /api/v1/runtime-devices`.

### 3. Runtime exchanges the pairing for a device credential

`POST /api/v1/runtime-pairings/exchange`

```json
{
  "pairingId": "uuid",
  "deviceCode": "base64url-secret",
  "signature": "base64url(ed25519-sign("allternit-runtime-pairing:{pairingId}:{challenge}"))"
}
```

If approval is pending:

```json
{ "error": "authorization_pending", "status": "pending" }  // HTTP 428
```

If approved:

```json
{
  "runtimeId": "rt_uuid",
  "userId": "user_uuid",
  "userEmail": "eoj@allternit.com",
  "organizationId": "org_uuid",
  "deviceToken": "allternit_runtime_...",
  "tokenType": "Bearer",
  "expiresAt": "2026-10-14T01:40:00Z",
  "capabilities": ["runtime:connect", ...]
}
```

The runtime stores the device token and private key in its local credential store (Electron `safeStorage` on macOS, authenticated local encryption in dev, mode-0600 file for VPS).

## Device Credential Lifecycle

### Heartbeat

Runtimes call `POST /api/v1/runtime-devices/:id/heartbeat` every 60 seconds (desktop) or 30 seconds (VPS) with the device token in the `Authorization` header.

### Rotation

Runtimes call `POST /api/v1/runtime-devices/:id/rotate` before the credential expires (default 90 days, rotation begins 7 days early). The cloud returns a new `deviceToken` and the runtime replaces the old one atomically.

### Revocation

Humans revoke a runtime from **Account & Connections** in the browser:

`DELETE /api/v1/runtime-devices/:id`

Runtimes can also self-revoke on explicit sign-out:

`POST /api/v1/runtime-devices/:id/revoke-self`

## Browser-to-Runtime Relay

Once paired, a runtime maintains an outbound WebSocket to:

`wss://api.allternit.com/api/v1/runtime-relay/connect/:runtime_id`

It authenticates with:

```json
{
  "type": "authenticate",
  "runtime_id": "rt_uuid",
  "device_token": "allternit_runtime_..."
}
```

A Clerk-authenticated browser can then proxy requests to that runtime:

`POST /api/v1/runtime-devices/:id/proxy`

```json
{
  "method": "POST",
  "path": "/api/v1/chat/completions",
  "headers": { "Content-Type": "application/json" },
  "body": "{...}",
  "bodyEncoding": "utf8"
}
```

The cloud checks that the runtime belongs to the same Clerk user and that the runtime's capabilities include the requested operation. The runtime executes the request on its private loopback API and streams the response back.

For WebSocket endpoints (SSE, terminal, panes), the browser first requests a one-time ticket:

`POST /api/v1/runtime-devices/:id/socket-ticket`  
`GET /api/v1/runtime-devices/:id/socket?ticket=...`

The ticket is valid for 30 seconds and scoped to a single path.

## Capability Scopes

| Capability | Allows |
|------------|--------|
| `runtime:connect` | Heartbeat, accept relay connections |
| `runtime:execute` | Generic API execution |
| `runtime:files` | File/workspace endpoints |
| `runtime:terminal` | Terminal/PTY endpoints |
| `providers:connect` | Write provider credentials |
| `providers:use` | Read/use provider connections |

## Security Properties

1. **No Clerk token in the runtime.** The runtime never receives or stores the human's Clerk JWT.
2. **Proof of possession.** Exchange requires an Ed25519 signature over a server-provided challenge.
3. **Revocable.** A lost or compromised device can be revoked from the browser.
4. **Scoped.** Each runtime has a capability list; the cloud enforces it on every relayed request.
5. **No browser secrets.** Provider API keys, Gizzi credentials, and the platform encryption key never leave the runtime.
6. **Outbound-only.** Runtimes connect outward to the cloud, so no public inbound port is required for browser access.

## Migration from Desktop OAuth

The previous `allternit-desktop` OAuth client has been retired. Existing desktop OAuth sessions are quarantined on first launch and the runtime must be paired once. The `allternit://auth/callback` deep link is no longer used; pairing completion uses `allternit://pairing/complete?pairing_id=...`.
