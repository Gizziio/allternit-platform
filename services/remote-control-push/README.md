# Allternit Remote Control Push Worker

Cloudflare edge relay and Web Push delivery service for the Allternit Remote Control dashboard / PWA.

## What it does

- **Runtime relay**: holds a WebSocket from a paired `agent-daemon` runtime in a Durable Object and proxies browser HTTP/WebSocket traffic to it.
- **Push subscriptions**: stores browser Push API subscriptions in KV, keyed by runtime, so a runtime can fan out notifications when it needs user attention.
- **Push delivery**: receives a notify request and sends a Web Push to every subscribed browser for a runtime.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/connect/:runtimeId` | Runtime WebSocket upstream connection |
| POST | `/proxy/:runtimeId` | HTTP proxy from browser → runtime |
| POST | `/socket-ticket/:runtimeId` | Create a ticket for a browser WebSocket |
| GET | `/socket?ticket=...` | Browser WebSocket using ticket |
| GET | `/push/vapid-public-key` | VAPID public key for browser subscription |
| POST | `/push/subscribe/:runtimeId` | Store a browser push subscription |
| POST | `/push/unsubscribe/:runtimeId` | Remove a browser push subscription |
| POST | `/push/notify/:runtimeId` | Send a push to all subscriptions for a runtime |

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

Add the keys to `wrangler.toml` secrets (do not commit keys):

```bash
pnpm exec wrangler secret put VAPID_PUBLIC_KEY
pnpm exec wrangler secret put VAPID_PRIVATE_KEY
```

Or set them in the Cloudflare dashboard under Workers & Pages > allternit-remote-control-push > Settings > Variables.

## KV namespace

Create a KV namespace and bind it as `PUSH_SUBSCRIPTIONS`:

```bash
pnpm exec wrangler kv:namespace create "PUSH_SUBSCRIPTIONS"
# paste the id/preview_id into wrangler.toml
```

## Deploy

```bash
pnpm run deploy
```

CI deploys automatically on pushes to `main` that touch `services/remote-control-push/**`.

## Surface configuration

Set the worker URL in the platform surface environment:

```
NEXT_PUBLIC_ALLTERNIT_PUSH_WORKER_URL=https://allternit-remote-control-push.<your-account>.workers.dev
```

If unset, push notifications are disabled and the bell toggle is hidden.
