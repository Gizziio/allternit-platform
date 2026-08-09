# Migrating from OpenAI

The Allternit API is wire-compatible with OpenAI chat completions. Most requests work unchanged; the differences are in auth (virtual keys), model identifiers, and a few provider-specific fields.

## Endpoint and authentication

Before:

```bash
export OPENAI_API_KEY="sk-..."
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

After:

```bash
export ALLTERNIT_API_URL="http://127.0.0.1:8013/v1"
export ALLTERNIT_API_KEY="ak-..."
curl "$ALLTERNIT_API_URL/chat/completions" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

## Chat completion

Before:

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "response_format": {"type": "json_object"}
  }'
```

After (same request, local gateway):

```bash
curl "$ALLTERNIT_API_URL/chat/completions" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "response_format": {"type": "json_object"}
  }'
```

You can also use a policy alias such as `allternit-balanced` instead of an explicit provider/model.

## JSON Schema responses

OpenAI accepts `json_schema` only with a `name`. Allternit also accepts a shorthand `schema` field:

Before:

```json
{
  "model": "gpt-4o",
  "messages": [{"role": "user", "content": "Return a user object"}],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "user",
      "schema": {
        "type": "object",
        "properties": {"name": {"type": "string"}},
        "required": ["name"]
      },
      "strict": true
    }
  }
}
```

After:

```json
{
  "model": "allternit-balanced",
  "messages": [{"role": "user", "content": "Return a user object"}],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "user",
      "schema": {
        "type": "object",
        "properties": {"name": {"type": "string"}},
        "required": ["name"]
      }
    }
  }
}
```

## Legacy functions

OpenAI's legacy `functions`/`function_call` fields are accepted for validation. For new code, prefer the SDK's normalized `tools`/`toolChoice` contract:

```typescript
import { AllternitHarness } from '@allternit/sdk/ai-runtime/harness';

const harness = new AllternitHarness({
  mode: 'byok',
  byok: { openai: { apiKey: process.env.OPENAI_API_KEY! } },
});

const response = await harness.run({
  provider: 'openai',
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is 2+2?' }],
  tools: [
    {
      name: 'calculator',
      description: 'Evaluate arithmetic',
      parameters: {
        type: 'object',
        properties: { expression: { type: 'string' } },
        required: ['expression'],
      },
    },
  ],
  toolChoice: 'auto',
});
```

## Streaming

OpenAI streaming works unchanged. Add `stream: true` and read SSE frames:

```bash
curl -sN "$ALLTERNIT_API_URL/chat/completions" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "allternit-balanced",
    "messages": [{"role": "user", "content": "Count to 5"}],
    "stream": true
  }'
```

## Tools and tool_choice

The API validates `tools` and `tool_choice` but does not forward them; Gizzi owns the agent loop and tool execution. The final assistant text is what returns. Use the SDK harness if you need fine-grained tool streaming.

## Rate limits

OpenAI returns `x-ratelimit-*` headers. Allternit returns `GET /v1/rate-limits` and `Retry-After` on `429`:

```bash
curl "$ALLTERNIT_API_URL/rate-limits" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

## Error codes

OpenAI error `type` values are preserved, and an additional Allternit `code` is included:

```json
{
  "error": {
    "message": "Rate limit exceeded for this API key. Please retry after the Retry-After interval.",
    "type": "rate_limit_exceeded",
    "code": "allternit.rate_limited"
  }
}
```

## Checklist

- [ ] Replace `https://api.openai.com/v1` with `http://127.0.0.1:8013/v1` (or your deployed URL).
- [ ] Replace `sk-...` with an Allternit virtual key `ak-...`.
- [ ] Use explicit `provider/model` ids or a policy alias such as `allternit-balanced`.
- [ ] Update rate-limit polling to use `GET /v1/rate-limits`.
- [ ] Read `code` in error responses for programmatic handling.
