# Allternit Cloud API Quick Start

The Allternit Cloud API is the hosted control plane for user accounts, runtime pairing, and the browser-to-runtime relay. Users self-host the Allternit Desktop or VPS runtime; this service is what binds those runtimes to their Allternit account.

---

## Prerequisites

- Rust toolchain (1.78+)
- SQLite for local development, Postgres for production
- A Clerk account and application for `platform.allternit.com`

---

## 1. Start the Control Plane

```bash
# From the workspace root
cargo run -p allternit-cloud-api
```

The server starts on `http://localhost:8080` by default.

**Required environment variables:**

| Variable | Example | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `DATABASE_URL` | `./data/api.db` | SQLite path or Postgres URL |
| `CLERK_ISSUER` | `https://allternit.com/__clerk` | Clerk JWT issuer |
| `CLERK_JWKS_URL` | `https://allternit.com/__clerk/.well-known/jwks.json` | Clerk signing keys |
| `ALLTERNIT_PLATFORM_URL` | `https://ai.allternit.com` | Browser pairing origin |
| `CORS_ALLOWED_ORIGINS` | `https://ai.allternit.com` | Allowed browser origins |

---

## 2. Run Migrations

Migrations run automatically on startup by default. To run them manually:

```bash
sqlx migrate run --source cmd/allternit-cloud-api/migrations --database-url $DATABASE_URL
```

The runtime-pairing tables are created by `011_runtime_pairing.sql`.

---

## 3. Verify Health

```bash
curl http://localhost:8080/api/v1/health/live
```

Expected:

```json
{"status":"ok"}
```

---

## 4. Pair a Desktop Runtime

### 4.1 Create a pairing request from the desktop

This is normally done automatically by Allternit Desktop, but you can simulate it:

```bash
# Generate an Ed25519 keypair first; here we use a placeholder public key.
curl -X POST http://localhost:8080/api/v1/runtime-pairings \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Desktop",
    "runtimeType": "desktop",
    "hostname": "test-machine",
    "platform": "darwin-arm64",
    "version": "0.1.0",
    "publicKey": "base64url-encoded-32-byte-public-key"
  }'
```

Response:

```json
{
  "pairingId": "uuid",
  "deviceCode": "secret",
  "userCode": "ABCD-2345",
  "challenge": "secret",
  "verificationUrl": "https://platform.allternit.com/pair?code=ABCD-2345",
  "expiresAt": "...",
  "pollIntervalSeconds": 2
}
```

### 4.2 Approve in the browser

Open the `verificationUrl` while signed into `platform.allternit.com`, then approve the runtime.

### 4.3 Exchange for a device credential

Back on the desktop, sign the challenge and exchange:

```bash
curl -X POST http://localhost:8080/api/v1/runtime-pairings/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "pairingId": "uuid",
    "deviceCode": "secret",
    "signature": "base64url-ed25519-signature-of-allternit-runtime-pairing:pairingId:challenge"
  }'
```

Response:

```json
{
  "runtimeId": "rt_uuid",
  "userId": "user_uuid",
  "userEmail": "eoj@allternit.com",
  "deviceToken": "allternit_runtime_...",
  "tokenType": "Bearer",
  "expiresAt": "...",
  "capabilities": ["runtime:connect", "runtime:execute", ...]
}
```

---

## 5. Connect the Runtime Relay

The desktop/VPS runtime opens an outbound WebSocket to the cloud API:

```bash
wscat -c "ws://localhost:8080/api/v1/runtime-relay/connect/rt_uuid" \
  -x '{"type":"authenticate","runtime_id":"rt_uuid","device_token":"allternit_runtime_..."}'
```

Once authenticated, the browser can proxy requests to this runtime.

---

## 6. Proxy a Request from the Browser

With a Clerk token in `Authorization`:

```bash
curl -X POST http://localhost:8080/api/v1/runtime-devices/rt_uuid/proxy \
  -H "Authorization: Bearer <clerk-session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "GET",
    "path": "/api/v1/health",
    "headers": {},
    "body": "",
    "bodyEncoding": "utf8"
  }'
```

The cloud API verifies the runtime belongs to the Clerk user, checks capabilities, forwards the request over the runtime WebSocket, and streams the response back.

---

## 7. List and Revoke Runtimes

```bash
# List runtimes
curl http://localhost:8080/api/v1/runtime-devices \
  -H "Authorization: Bearer <clerk-session-token>"

# Revoke a runtime
curl -X DELETE http://localhost:8080/api/v1/runtime-devices/rt_uuid \
  -H "Authorization: Bearer <clerk-session-token>"
```

---

## Production Notes

- Use Postgres for `DATABASE_URL` so concurrent runtimes and web workers can share state.
- Store Clerk secrets and runtime encryption keys in Railway/Fly/AWS secret management, never in the repo.
- Run at least two instances behind a load balancer for availability; the relay state is currently in-memory, so sticky sessions or a shared Redis backend would be needed for multi-instance deployments.

---

## Next Steps

- Read the full [Runtime Pairing Protocol](./RUNTIME_PAIRING.md)
- Read the [API Reference](./API.md) for Cowork Runtime endpoints
- See `../../infrastructure/` for deployment templates
