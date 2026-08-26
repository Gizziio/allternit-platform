# Allternit Remote Control Push Worker

Cloudflare edge Web Push delivery service for the Allternit Remote Control dashboard / PWA.

## What it does

- **Push subscriptions**: stores browser Push API subscriptions in KV, keyed by runtime, so a runtime can fan out notifications when it needs user attention.
- **Push delivery**: receives a notify request and sends a Web Push to every subscribed browser for a runtime.

The runtime relay (WebSocket / HTTP proxy / socket tickets) lives in `cmd/allternit-cloud-api/src/routes/runtime_relay.rs`, not in this worker.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vapid-public-key` | VAPID public key for browser subscription (plain text) |
| POST | `/subscribe` | Store a browser push subscription. Body: `{ runtimeId, endpoint, keys: { p256dh, auth }, label? }` |
| POST | `/unsubscribe` | Remove a browser push subscription. Body: `{ runtimeId, endpoint }` |
| POST | `/notify` | Send a push to all subscriptions for a runtime. Body: `{ runtimeId, title, body, tag? }` |
| GET | `/pending` | Fetch the payload that triggered a background push. Query: `?endpoint=...` |
| GET | `/health` | Health check |

## Local development

```bash
cd services/remote-control-push
pnpm install
pnpm run dev
```

## Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Add the keys to Wrangler secrets (do not commit keys):

```bash
pnpm exec wrangler secret put VAPID_PUBLIC_KEY
pnpm exec wrangler secret put VAPID_JWK
```

Or set them in the Cloudflare dashboard under Workers & Pages > allternit-remote-control-push > Settings > Variables.

## KV namespace

A KV namespace is already bound as `REMOTE_CONTROL_PUSH_KV` in `wrangler.toml`. If you need to recreate it:

```bash
pnpm exec wrangler kv:namespace create "REMOTE_CONTROL_PUSH_KV"
# paste the id/preview_id into wrangler.toml
```

## Deploy

```bash
pnpm run deploy
```

CI deploys automatically on pushes to `main` that touch `services/remote-control-push/**`.

## Surface configuration

Set the worker URL in the surface environment:

```
VITE_REMOTE_CONTROL_PUSH_URL=https://push.remotecontrol.allternit.com
```

For backward compatibility the platform wrapper also reads `NEXT_PUBLIC_ALLTERNIT_PUSH_WORKER_URL`, but `VITE_REMOTE_CONTROL_PUSH_URL` is preferred.

If unset, push notifications are disabled and the bell toggle is hidden.
