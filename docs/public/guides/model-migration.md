# Model Migration Guide

Moving between providers and models is a normal part of running a multi-model platform. Allternit makes this easier by exposing a unified OpenAI-compatible API, but there are still differences in capabilities, pricing, and output behavior to account for.

## Discover available models

Use the LLM gateway model list to see everything your virtual key is allowed to call:

```bash
curl https://api.allternit.example/v1/models \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY"
```

Each entry includes:

- `id` — the full `provider/model` id or a policy alias such as `smart`.
- `context_window` and `max_output_tokens`.
- `deprecated` and `replacement` when a model is being retired.

Models marked `deprecated: true` still work during a transition window, but you should move to the `replacement` id as soon as possible.

## Common provider mappings

| Capability | Anthropic | OpenAI | Kimi |
|------------|-----------|--------|------|
| Reasoning/thinking | `thinking` | `reasoning_effort` | `thinking` / `reasoning_effort` |
| Structured output | `tools` + `tool_choice=any` with schema | `response_format.json_schema` | `response_format` |
| Prompt caching | `cache_control` | `service_tier: flex` + cached-token billing | `cache_control` hints |
| Vision | `image` content blocks | `image_url` | `image_url` |
| Computer use | `computer_20250124` tool | custom tool definitions | custom tool definitions |

Allternit normalizes these into a single request surface. Provider-specific transforms happen inside the Gizzi runtime, so most migrations only require changing the `model` string.

## Migration checklist

1. **Check context window** — A smaller context window may require truncation or summarization. Use `GET /v1/models/:id` to confirm limits.
2. **Review output format** — Models differ in JSON adherence, thinking blocks, and citation behavior. Test with `response_format` and `tool_choice` as needed.
3. **Validate tool definitions** — Strict tool schemas and `parallel_tool_calls` may not be supported by every provider. Run a small tool-call test before switching traffic.
4. **Compare pricing** — Use `GET /v1/pricing` to estimate cost per 1M tokens, including cache-read/write and over-200k tiers.
5. **Use a fallback chain** — Configure a fallback chain in your routing policy so a model outage or refusal automatically retries an alternative.
6. **Run an eval** — Use the admin eval endpoints (`/api/v1/admin/eval/metrics/score`) to compare outputs against a reference dataset.

## Testing a new model

Start with non-streaming requests and a small prompt set:

```bash
curl https://api.allternit.example/v1/chat/completions \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 256
  }'
```

Once outputs look correct, enable streaming and tool use incrementally.

## Batch migrations

For large migrations, use the batch API to run many requests asynchronously:

```bash
curl https://api.allternit.example/v1/batches \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "/v1/chat/completions",
    "input_file_id": "file_xxx"
  }'
```

## Deprecation policy

When a provider deprecates a model, Allternit surfaces it in the model list and logs usage against the deprecated id. Plan to migrate before the provider's sunset date; Allternit does not guarantee availability beyond what the upstream provider supports.

## Related docs

- [Provider parity matrix](../providers/parity-matrix.md)
- [API reference](../api/reference.md)
- [Pricing](../providers/parity-matrix.md)
