# Kimi reasoning and thinking

Kimi models expose an internal reasoning stream through the `thinking` or `reasoning_effort` parameters. Allternit forwards these controls to the underlying provider and surfaces reasoning content in responses.

## Enable thinking

```json
{
  "model": "kimi/kimi-k2.6",
  "messages": [{"role": "user", "content": "Solve this puzzle"}],
  "reasoning_effort": "medium"
}
```

Allowed values: `low`, `medium`, `high`.

## Preserved thinking across turns

To keep the model's reasoning visible in multi-turn conversations, include the `reasoning_content` from the assistant message in the `messages` array:

```json
{
  "messages": [
    {"role": "user", "content": "Solve this puzzle"},
    {
      "role": "assistant",
      "content": "The answer is 42.",
      "reasoning_content": "I considered the factors..."
    },
    {"role": "user", "content": "Why?"}
  ]
}
```

## Reasoning content in responses

When the model produces reasoning, the response includes a `reasoning_content` field on the assistant message:

```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "The answer is 42.",
      "reasoning_content": "I considered the factors..."
    }
  }]
}
```

## Control thinking with the `thinking` parameter

Kimi-style `thinking` controls map to Allternit's provider-agnostic `reasoning_effort`. The gateway accepts either form and forwards it to the underlying provider:

```json
{
  "model": "kimi/kimi-k2.6",
  "messages": [{"role": "user", "content": "Optimize this function"}],
  "thinking": {"type": "enabled", "budget_tokens": 2048}
}
```

Equivalent:

```json
{
  "reasoning_effort": "medium"
}
```

Allowed `reasoning_effort` values include `none`, `minimal`, `low`, `medium`, `high`, and `xhigh`.

## `kimi-k2.7-code` defaults

`kimi-k2.7-code` enables reasoning by default for code tasks. You do not need to pass `thinking` or `reasoning_effort`; the model will reason automatically.

## Token usage for reasoning

`reasoning_content` and `thinking` tokens are included in the response `usage` object under `completion_tokens_details.reasoning_tokens`. They count toward `completion_tokens` and are metered like any other generated tokens. There is no separate reasoning surcharge in the Allternit meter.

## Model-specific notes

- `kimi-k2.6` and `kimi-k2.7-code` support `reasoning_effort`.
- `kimi-k2.7-code` does not require a `thinking` parameter; reasoning is enabled by default for code tasks.

## Related pages

- [Kimi API overview](./kimi-api-overview.md)
- [Hide or surface reasoning events](../cli/reasoning-events.md)
