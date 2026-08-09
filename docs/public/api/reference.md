# API Reference

The public Allternit API is an OpenAI-compatible surface mounted at `/v1`. It is backed by the local Gizzi runtime and uses virtual-key authentication. Requests are validated, metered, and routed through the LLM gateway (`cmd/allternit-api/src/llm_gateway`).

## Base URL and authentication

```bash
export ALLTERNIT_API_URL="http://127.0.0.1:8013/v1"
export ALLTERNIT_API_KEY="ak-..."
```

Every request must include the virtual key as a Bearer token:

```bash
-H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

Virtual keys are managed at `/api/v1/gateway/keys` (Clerk-protected). A key may be restricted to specific models or policy aliases via `allowed_models`.

## Request and error shape

Successful responses follow the OpenAI object schema. Errors return the standard OpenAI error envelope with an Allternit machine-readable `code`:

```json
{
  "error": {
    "message": "...",
    "type": "invalid_request_error",
    "param": "model",
    "code": "allternit.model_not_found"
  }
}
```

Stable error codes include `allternit.invalid_request`, `allternit.authentication_failed`, `allternit.permission_denied`, `allternit.rate_limited`, `allternit.budget_exceeded`, `allternit.idempotency_conflict`, `allternit.model_not_found`, `allternit.upstream_error`, and `allternit.internal_error`.

## POST /v1/chat/completions

Create a chat completion. The request is normalized, routed through the Gizzi runtime, and metered in `llm_usage_events`.

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `model` | string | yes | Policy alias (`auto`, `allternit-balanced`, ...), bare model id, or `provider/model`. |
| `messages` | array | yes | `system`, `user`, `assistant`, `tool` roles. String or part-array content. |
| `temperature` | number | no | 0.0–2.0. |
| `top_p` | number | no | 0.0–1.0. |
| `max_tokens` | integer | no | Must be >= 1 when provided. |
| `stop` | string \| array | no | Single string or array of stop sequences. |
| `stream` | boolean | no | Default `false`. |
| `stream_options` | object | no | `{ "include_usage": true }` to receive a final usage chunk. |
| `response_format` | object | no | `{ "type": "json_schema", "json_schema": { "name", "schema" } }` or shorthand `{ "type": "json_schema", "schema": ... }`. |
| `reasoning_effort` | string | no | `none`, `minimal`, `low`, `medium`, `high`, `xhigh`. Forwarded as a Gizzi variant. |
| `tools` | array | no | Validated for shape but not forwarded; Gizzi owns tool execution. |
| `tool_choice` | any | no | Validated for shape but not forwarded. |
| `parallel_tool_calls` | boolean | no | Validated for shape but not forwarded. |
| `user` | string | no | Passed through for attribution. |

### Non-streaming response

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "anthropic/claude-sonnet-4",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello!" },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15,
    "completion_tokens_details": { "reasoning_tokens": 0 },
    "prompt_tokens_details": { "cached_tokens": 0 }
  }
}
```

Response headers:

- `x-allternit-session-id`: Gizzi session id. Reuse it with the same header to continue a conversation without resending the full transcript.
- `x-allternit-fallback`: Present when a fallback model was used (`from->to`).

### curl example (non-streaming)

```bash
curl -s "$ALLTERNIT_API_URL/chat/completions" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: create-invoice-42" \
  -d '{
    "model": "allternit-balanced",
    "messages": [{"role": "user", "content": "Write a one-sentence greeting."}]
  }'
```

## Streaming (`chat.completion.chunk`)

When `stream: true`, the gateway returns `text/event-stream` frames. Each `data:` line is a JSON chunk; the stream ends with `data: [DONE]`.

Chunk sequence:

1. Role chunk: `{ "choices": [{ "delta": { "role": "assistant" } }] }`
2. One or more content chunks: `{ "choices": [{ "delta": { "content": "..." } }] }`
3. Finish chunk: `{ "choices": [{ "delta": {}, "finish_reason": "stop" }] }`
4. Optional usage chunk (when `stream_options.include_usage` is true): `{ "choices": [], "usage": { ... } }`
5. `[DONE]`

Mid-stream failures emit an OpenAI-shaped error frame before `[DONE]`.

### curl example (streaming)

```bash
curl -sN "$ALLTERNIT_API_URL/chat/completions" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "allternit-balanced",
    "messages": [{"role": "user", "content": "Count to 3"}],
    "stream": true,
    "stream_options": { "include_usage": true }
  }'
```

### SDK streaming (`HarnessStreamChunk`)

The TypeScript SDK provides a provider-neutral stream:

```typescript
import { AllternitHarness } from '@allternit/sdk/ai-runtime/harness';

const harness = new AllternitHarness({
  mode: 'byok',
  byok: { anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! } },
});

for await (const chunk of harness.stream({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello' }],
})) {
  if (chunk.type === 'text') process.stdout.write(chunk.text);
  if (chunk.type === 'done') console.log('\nusage:', chunk.usage);
}
```

`HarnessStreamChunk` types are `text`, `tool_call`, `tool_call_complete`, `tool_result`, `citation`, `error`, and `done`.

## Idempotency

The gateway honors `Idempotency-Key` for non-streaming `POST /v1/chat/completions` only. A stream cannot be replayed from a stored body, so the header is ignored when `stream: true`.

- The key must be 1–255 ASCII characters.
- A duplicate key for a completed request replays the stored response body with status `200 OK`.
- A duplicate key for an in-flight request returns `409 Conflict` with code `allternit.idempotency_conflict`.
- An `in_progress` row older than 10 minutes is treated as abandoned and may be retried.

See [Idempotency and retries](../guides/idempotency-and-retries.md) for the full lifecycle and SDK behavior.

## POST /v1/batches

Store a batch of chat-completion requests for later execution. Phase 1 provides metadata storage and lifecycle endpoints; execution and provider polling are Phase 2.

### Request body

```json
{
  "requests": [
    { "model": "allternit-balanced", "messages": [{"role": "user", "content": "Hello"}] },
    { "model": "allternit-code", "messages": [{"role": "user", "content": "World"}] }
  ]
}
```

Each element is validated as a `ChatCompletionRequest` and checked against the key's model allowlist.

### Response (201 Created)

```json
{
  "id": "batch_...",
  "object": "batch",
  "status": "validating",
  "request_count": 2,
  "created_at": "2026-08-09T09:00:00Z",
  "updated_at": null,
  "cancelled_at": null
}
```

### curl example

```bash
curl -s "$ALLTERNIT_API_URL/batches" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"model": "allternit-balanced", "messages": [{"role": "user", "content": "Summarize A."}]},
      {"model": "allternit-balanced", "messages": [{"role": "user", "content": "Summarize B."}]}
    ]
  }'
```

## GET /v1/batches/:id

Retrieve a batch by id. Returns `404` if the batch does not belong to the key.

```bash
curl -s "$ALLTERNIT_API_URL/batches/batch_..." \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

## POST /v1/batches/:id/cancel

Cancel a batch. Idempotent: cancelling an already-cancelled batch returns the current state.

```bash
curl -s -X POST "$ALLTERNIT_API_URL/batches/batch_.../cancel" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

## GET /v1/batches/:id/results

Return the stored results json for a completed batch. Returns `404` if no results are stored.

```bash
curl -s "$ALLTERNIT_API_URL/batches/batch_.../results" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

## POST /v1/tokens

Estimate input tokens for a chat-completion-shaped body. The estimate is deterministic and provider-independent: four UTF-8 characters per token, rounded up.

### Request body

Same shape as `POST /v1/chat/completions` (only `model` and `messages` are required).

### Response

```json
{
  "object": "token_count",
  "model": "allternit-balanced",
  "input_tokens": 3
}
```

### curl example

```bash
curl -s "$ALLTERNIT_API_URL/tokens" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "allternit-balanced",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## GET /v1/rate-limits

Return the caller's current quota snapshot: per-key sliding-window request rate and token budget.

### Response

```json
{
  "object": "rate_limits",
  "requests_remaining": 598,
  "requests_limit": 600,
  "tokens_remaining": 987,
  "tokens_limit": 1000,
  "reset_at": "2026-08-09T09:01:00Z"
}
```

`requests_*` come from the key's per-minute rate limit (default 600). `tokens_*` come from the key's monthly budget and any tenant hard cap, with the tighter remaining value winning.

### curl example

```bash
curl -s "$ALLTERNIT_API_URL/rate-limits" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

## Embeddings (`AllternitEmbeddings.create`)

The SDK provides an OpenAI-compatible embeddings client that resolves the endpoint from the harness config mode.

```typescript
import { AllternitEmbeddings } from '@allternit/sdk/ai-runtime/embeddings';

const embeddings = new AllternitEmbeddings({
  mode: 'byok',
  byok: {
    openai: { apiKey: process.env.OPENAI_API_KEY! },
  },
});

const result = await embeddings.create({
  model: 'text-embedding-3-small',
  input: ['Allternit API', 'provider parity'],
});

console.log(result.data[0].embedding.length);
```

Mode resolution:

| Mode | Endpoint | Auth |
|------|----------|------|
| `byok` (OpenAI) | `config.byok.openai.baseURL ?? https://api.openai.com/v1` + `/embeddings` | `Authorization: Bearer <openai.apiKey>` |
| `cloud` | `config.cloud.baseURL` + `/v1/embeddings` | `Authorization: Bearer <cloud.accessToken>` |
| `local` | `config.local.baseURL` + `/embeddings` | none |
| `subprocess` | — | not supported |

The response shape is `EmbeddingsResponse`:

```json
{
  "object": "list",
  "data": [
    { "object": "embedding", "embedding": [0.1, ...], "index": 0 }
  ],
  "model": "text-embedding-3-small",
  "usage": { "prompt_tokens": 4, "total_tokens": 4 }
}
```

## GET /v1/models

List models available to the key. Includes policy aliases owned by `allternit` and catalog models from connected Gizzi providers. Catalog entries expose `context_window` and `max_output_tokens` when the provider catalog provides them.

```bash
curl -s "$ALLTERNIT_API_URL/models" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```
