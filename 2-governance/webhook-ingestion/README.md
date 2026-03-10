# @a2r/webhook-ingestion

Webhook ingestion service for a2rchitech - receives, validates, normalizes, and processes webhooks from multiple sources (GitHub, Discord, Ant Farm, Moltbook) and emits events to Rails ledger.

## Features

- **Multi-Source Support**: GitHub, Discord, Ant Farm, Moltbook, and custom webhooks
- **Signature Verification**: HMAC-SHA256/1/512 verification for secure webhooks
- **Normalization**: Transforms source-specific payloads into canonical event schema
- **Idempotency**: Deduplication with configurable TTL
- **Rate Limiting**: Sliding window rate limiting per source
- **Allowlist/Blocklist**: Configurable source and event type filtering
- **Rails Integration**: Emits events to a2rchitech Rails ledger
- **Receipt Recording**: Immutable audit trail for all processed events

## Installation

```bash
pnpm install
```

## Configuration

Set environment variables (see `.env.example`):

```bash
# Server
WEBHOOK_PORT=8787
WEBHOOK_HOST=0.0.0.0
WEBHOOK_LOG_LEVEL=info

# Secrets (HMAC verification)
WEBHOOK_GITHUB_SECRET=your_github_secret
WEBHOOK_DISCORD_SECRET=your_discord_secret

# Rails
A2R_RAILS_URL=http://127.0.0.1:3011
A2R_RAILS_API_KEY=your_api_key
```

## Usage

### Start Server

```bash
pnpm serve
# or
pnpm serve --port 8787 --log-level debug
```

### List Configured Sources

```bash
pnpm list
```

### Test Webhook

```bash
pnpm trigger --source github --event pull_request.opened
```

## API

### POST /webhook/:source

Receive webhook from specific source.

```bash
curl -X POST http://localhost:8787/webhook/github \
  -H "Content-Type: application/json" \
  -d '{"action": "opened", "number": 42, ...}'
```

### POST /webhook

Generic webhook (source in body).

```bash
curl -X POST http://localhost:8787/webhook \
  -H "Content-Type: application/json" \
  -d '{"source": "custom", "eventType": "my.event", "customData": {...}}'
```

### GET /health

Health check.

```bash
curl http://localhost:8787/health
```

## Architecture

```
Webhook → Signature Check → Rate Limit → Allowlist → Idempotency → Normalize → Rails Events
```

## Testing

```bash
pnpm test
pnpm test:coverage
```

## License

MIT
