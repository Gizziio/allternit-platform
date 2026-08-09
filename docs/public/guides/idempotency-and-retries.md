# Idempotency and retries

Allternit has two idempotency layers and one retry interceptor. They operate at different scopes and should not be confused:

1. **`Idempotency-Key` on the Clerk-protected `/api/v1` surface** — caches full responses for `POST/PUT/PATCH` requests, scoped by organization or user.
2. **`Idempotency-Key` on the public `/v1` LLM gateway** — pre-inserts a usage row for non-streaming `POST /v1/chat/completions` and replays the stored response body for duplicate keys.
3. **`fetchWithRetry` SDK interceptor** — retries network errors and selected HTTP status codes with exponential backoff + jitter.

## `Idempotency-Key` on `/api/v1`

The protected API (`cmd/allternit-api/src/idempotency.rs`) layers idempotency after Clerk authentication. It is active only for mutable methods (`POST`, `PUT`, `PATCH`) and when the header is present.

- The cache key is scoped by `organization_id` (or `user_id` when no org is selected) plus the caller-provided key.
- A duplicate key for a completed request replays the cached status, `content-type`, and body.
- A duplicate key for an in-flight request returns `409 Conflict`.
- Only `content-type` is replayed from the cached headers; `content-length` is recomputed.
- Entries expire after 24 hours. In-flight rows older than 10 minutes are treated as abandoned and may be retried.

```bash
curl -s -X POST "$ALLTERNIT_API_URL/api/v1/gateway/keys" \
  -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -H "Idempotency-Key: create-key-2026-08-09" \
  -H "Content-Type: application/json" \
  -d '{"name": "production", "monthly_budget_cents": 10000}'
```

## `Idempotency-Key` on `/v1/chat/completions`

The public gateway (`cmd/allternit-api/src/llm_gateway/proxy.rs`) honors `Idempotency-Key` for non-streaming chat completions only.

- The key is scoped by the virtual key (`virtual_key_id`), not by user or organization.
- Validation, model allowlist checks, and session creation run **before** the in-progress row is inserted, so rejected requests never leave a stranded row.
- If a completed row exists, the gateway returns `200 OK` with the stored response body.
- If an `in_progress` row exists and is not stale, the gateway returns `409 Conflict` with code `allternit.idempotency_conflict`.
- Streaming requests ignore the header because a byte stream cannot be replayed from a stored JSON body.

```bash
curl -s "$ALLTERNIT_API_URL/chat/completions" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Idempotency-Key: invoice-generation-42" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "allternit-balanced",
    "messages": [{"role": "user", "content": "Generate invoice #42"}]
  }'
```

## `Retry-After`

The gateway returns `Retry-After` on two 429 responses:

- **Rate limit exceeded** (`allternit.rate_limited`): the per-key sliding window is 60 seconds, so `Retry-After` is 60.
- **Budget exceeded** (`allternit.budget_exceeded`): no `Retry-After` is emitted because the condition depends on the calendar-month budget resetting, not a fixed interval.

Clients should respect `Retry-After` instead of retrying immediately.

```bash
curl -s -D - "$ALLTERNIT_API_URL/chat/completions" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "allternit-balanced", "messages": []}'
# HTTP/1.1 429 Too Many Requests
# Retry-After: 60
```

## SDK `fetchWithRetry`

`fetchWithRetry` in `sdk/allternit-sdk/src/ai-runtime/harness/retry.ts` wraps the global `fetch` for provider calls made by the harness.

### Default options

| Option | Default | Description |
|--------|---------|-------------|
| `maxRetries` | 3 | Retry attempts after the initial try. |
| `initialDelayMs` | 500 | Base delay before the first retry. |
| `maxDelayMs` | 8000 | Upper bound for backoff. |
| `jitter` | true | Randomize delay within `[0, backoff]`. |

### Retryable conditions

- Network errors (thrown by `fetch`).
- HTTP status codes: `408`, `409`, `429`, `500`, `502`, `503`, `504`.

Non-retryable 4xx responses (e.g., `401`, `404`, `422`) are returned as-is so callers can handle them normally.

### Usage

```typescript
import { fetchWithRetry } from '@allternit/sdk/ai-runtime/harness/retry';

const response = await fetchWithRetry(
  'https://api.example.com/v1/chat/completions',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] }),
  },
  { maxRetries: 5, initialDelayMs: 1000 }
);
```

The harness passes `config.retry` through to `fetchWithRetry` automatically for BYOK provider calls.

## Combining idempotency and retries

A safe request pattern for write-like operations:

1. Generate a deterministic idempotency key from the operation id (e.g., `invoice-42`).
2. Call `POST /v1/chat/completions` with the key.
3. On `409 Conflict`, wait briefly and retry with the same key; the next attempt will either replay the completed response or conflict again.
4. On `429 Too Many Requests`, sleep for the `Retry-After` interval before retrying.
5. Use `fetchWithRetry` only for idempotent reads or for operations where duplicate side effects are acceptable.

Do not combine `fetchWithRetry` with `Idempotency-Key` on the same mutable call unless the retry logic preserves the same key; otherwise duplicates may create multiple usage rows.
