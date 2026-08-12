# Kimi JSON Mode

Allternit supports structured JSON output via `response_format`, including JSON Schema constraints. This works with Kimi models and any other provider that supports structured outputs.

## Enable JSON Mode

Set `response_format.type` to `json_object`:

```json
{
  "model": "kimi/kimi-k2.6",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant. Answer as JSON."},
    {"role": "user", "content": "List three planets."}
  ],
  "response_format": { "type": "json_object" }
}
```

## JSON Schema

For stricter output, provide a JSON Schema:

```json
{
  "model": "kimi/kimi-k2.6",
  "messages": [{"role": "user", "content": "Give me a user profile."}],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "user_profile",
      "schema": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "age": {"type": "integer"}
        },
        "required": ["name", "age"]
      }
    }
  }
}
```

## Strict mode

Use `strict: true` to reject outputs that do not match the schema:

```json
{
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "user_profile",
      "strict": true,
      "schema": { ... }
    }
  }
}
```

## Validate your schema

Allternit validates the JSON Schema you supply and rejects malformed schemas before the request reaches the model. For the strictest guarantee, set `strict: true` inside `json_schema`; the gateway then asks the provider to constrain output to the schema. You can also validate the returned object locally:

```python
import jsonschema
jsonschema.validate(instance=json.loads(response), schema=schema)
```

## Field-type mismatch or Markdown code blocks

If the model returns the JSON wrapped in a Markdown fence (for example ` ```json ... ``` `) or uses the wrong type for a field, check that:

1. `response_format.type` is set to `json_schema` or `json_object`.
2. The prompt explicitly asks for raw JSON only.
3. `strict: true` is enabled.

When `strict: true` is used, Markdown wrapping and type mismatches are treated as a generation error and surfaced as a `finish_reason: "content_filter"` or `invalid_request_error`.

## Structured output advantages

Using `response_format` with a JSON Schema gives you:

- **Deterministic shape**: downstream code can deserialize without defensive parsing.
- **Provider portability**: the same schema works across Kimi, OpenAI, and Anthropic models.
- **Validation**: malformed outputs are caught and can be retried automatically.
- **Tool-free extraction**: extract entities, scores, or tables from unstructured text without writing regexes.

## Truncated JSON

If the response is truncated (`finish_reason = "length"`), the JSON may be incomplete. Retry with a higher `max_tokens` or break the request into smaller parts.

## Related pages

- [Kimi API overview](./kimi-api-overview.md)
- [Kimi tool calling](./kimi-tool-calling.md)
