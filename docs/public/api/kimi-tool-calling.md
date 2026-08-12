# Kimi tool calling

Allternit supports the Kimi `tool_calls` format for function/tool calling. Define tools with JSON Schema, force the model to call them, and handle results in subsequent messages.

## Define tools with JSON Schema

```json
{
  "model": "kimi/kimi-k2.6",
  "messages": [{"role": "user", "content": "What is the weather in Paris?"}],
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get the current weather",
      "parameters": {
        "type": "object",
        "properties": {
          "city": {"type": "string"}
        },
        "required": ["city"]
      }
    }
  }]
}
```

## Tool choice

- `"auto"` — the model decides whether to call tools (default).
- `"none"` — the model will not call tools.
- `"required"` — the model must call a tool.
- Specific tool: `{"type": "function", "function": {"name": "get_weather"}}`.

```json
{
  "tool_choice": "required"
}
```

## Handle tool calls

When the model emits `tool_calls`, respond with a `tool` message for each call:

```json
{
  "messages": [
    {"role": "user", "content": "What is the weather in Paris?"},
    {
      "role": "assistant",
      "tool_calls": [{
        "id": "call_123",
        "type": "function",
        "function": {"name": "get_weather", "arguments": "{\"city\":\"Paris\"}"}
      }]
    },
    {
      "role": "tool",
      "tool_call_id": "call_123",
      "content": "{\"temperature\": 20, \"condition\": \"sunny\"}"
    }
  ]
}
```

Every `tool_call` must have a matching `tool` message with the same `tool_call_id`.

## Tool calls in streaming responses

Tool call deltas are emitted as SSE events with `delta.tool_calls`. Collect the deltas to reconstruct the full function arguments.

## Tool calls vs `function_call`

Allternit uses the modern `tools` / `tool_calls` format. The legacy `functions` / `function_call` format is also accepted for older clients, but `tool_calls` is recommended. The gateway normalizes both into the same runtime representation.

## Dynamic tool search

You do not need to hard-code every tool in the request. Allternit discovers tools dynamically from:

- The [Tool Belt](../tools/tool-belt.md) native tools (`web_search`, `web_fetch`, `bash`, `code_execution`, `memory`, `pdf_process`, ...).
- Attached [MCP servers](../tools/mcp.md) discovered via `~/.allternit/mcp-servers.json` or the admin API.
- Skills loaded from `~/.allternit/skills/` that expose their own tools.

Reference tools by name in the request, or set `tool_choice` to require a specific one.

## Full agent loop

A typical tool-calling loop with the Allternit API looks like:

1. Send the user message with `tools` and `tool_choice: "auto"`.
2. If the assistant message contains `tool_calls`, run each tool and build `tool` messages.
3. Send the assistant `tool_calls` plus the `tool` results back to `/v1/chat/completions`.
4. Repeat until the model returns a final `content` message.

Always include the full conversation history, including `tool_call_id` values, on every turn.

## Complete example: call the `web_search` official tool

```json
{
  "model": "kimi/kimi-k2.6",
  "messages": [
    {"role": "user", "content": "What happened in AI today?"}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "web_search",
        "description": "Search the web for current information",
        "parameters": {
          "type": "object",
          "properties": {
            "query": {"type": "string"}
          },
          "required": ["query"]
        }
      }
    }
  ],
  "tool_choice": "auto"
}
```

When the model emits `tool_calls` for `web_search`, reply with a `tool` message:

```json
{
  "role": "tool",
  "tool_call_id": "call_123",
  "content": "{\"results\":[{\"title\":\"...\",\"url\":\"...\"}]}"
}
```

## Troubleshoot `tool_call_id not found`

This error means a `tool` message is missing or its `tool_call_id` does not match an assistant `tool_calls` entry in the same conversation. Fix it by:

- Including every `tool_call_id` from the assistant message in a matching `tool` message.
- Not reusing old IDs from earlier turns.
- Ensuring the `tool` message is placed immediately after the assistant message that emitted the call.

## Multiple completions (`n` parameter)

The Allternit chat endpoint currently returns one completion per request. To obtain `n` samples, send `n` parallel requests with the same payload (and different `seed` values if you want diversity).

## Handle Fiber/tool results and continue the conversation

After executing a tool, append the result as a `role: "tool"` message and resend the whole `messages` array. The model will use the result to produce the next assistant message. If additional tool calls are emitted, repeat the loop.

## Official tools

Allternit provides built-in tools such as `web_search` and `web_fetch`. Specify them in the `tools` array or use `tool_choice` to require them.

## Related pages

- [Kimi API overview](./kimi-api-overview.md)
- [Kimi JSON Mode](./kimi-json-mode.md)
