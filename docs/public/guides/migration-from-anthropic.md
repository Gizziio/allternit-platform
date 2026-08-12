# Migrating from Anthropic

Anthropic Messages API concepts map directly to the Allternit harness contract. The API gateway accepts an OpenAI-shaped body and translates reasoning, cache markers, and tool settings to the Gizzi runtime.

## Authentication and endpoint

Before:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01"
```

After (SDK harness):

```typescript
import { AllternitHarness } from '@allternit/sdk/ai-runtime/harness';

const harness = new AllternitHarness({
  mode: 'byok',
  byok: { anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! } },
});

const response = await harness.run({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

After (REST gateway):

```bash
export ALLTERNIT_API_URL="http://127.0.0.1:8013/v1"
export ALLTERNIT_API_KEY="ak-..."
curl "$ALLTERNIT_API_URL/chat/completions" \
  -H "Authorization: Bearer $ALLTERNIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## Messages request

Before:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 1024,
  "system": "Be terse.",
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

After:

```json
{
  "model": "anthropic/claude-3-5-sonnet-20241022",
  "max_tokens": 1024,
  "messages": [
    {"role": "system", "content": "Be terse."},
    {"role": "user", "content": "Hello"}
  ]
}
```

The gateway concatenates system messages into Gizzi's top-level `system` field and renders the remaining messages as a transcript.

## Thinking / reasoning

Before:

```json
{
  "model": "claude-3-7-sonnet-20250219",
  "thinking": {"type": "enabled", "budget_tokens": 2048},
  "messages": [{"role": "user", "content": "Solve x+2=5"}],
  "max_tokens": 4096
}
```

After (SDK):

```typescript
const response = await harness.run({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Solve x+2=5' }],
  maxTokens: 4096,
  reasoning: { enabled: true, budgetTokens: 2048 },
});
```

After (REST):

```json
{
  "model": "anthropic/claude-3-5-sonnet-20241022",
  "messages": [{"role": "user", "content": "Solve x+2=5"}],
  "max_tokens": 4096,
  "reasoning_effort": "medium"
}
```

## Cache control

Before:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "system": [
    {"type": "text", "text": "Long system prompt...", "cache_control": {"type": "ephemeral"}}
  ],
  "messages": [{"role": "user", "content": "Hello"}]
}
```

After (SDK):

```typescript
const response = await harness.run({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'system', content: 'Long system prompt...', cache: true },
    { role: 'user', content: 'Hello' },
  ],
});
```

`cache: true` is shorthand for `{ type: 'ephemeral' }`. You can also pass the full `cache_control` object on messages, tools, and the system prompt.

## Tool choice and parallel tool use

Before:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [{"role": "user", "content": "Use the weather tool"}],
  "tools": [{"name": "get_weather", "input_schema": {"type": "object", "properties": {}}}],
  "tool_choice": {"type": "tool", "name": "get_weather"},
  "disable_parallel_tool_use": true
}
```

After (SDK):

```typescript
const response = await harness.run({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Use the weather tool' }],
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather',
      parameters: { type: 'object', properties: {} },
    },
  ],
  toolChoice: { name: 'get_weather' },
  parallelToolCalls: false,
});
```

## Citations

The Anthropic `citations_delta` event becomes a `CitationChunk` in the SDK stream:

```typescript
for await (const chunk of harness.stream({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Cite your sources' }],
  citations: true,
})) {
  if (chunk.type === 'citation') {
    console.log(chunk.citation.citedText, chunk.citation.url);
  }
}
```

## Computer use and text editor tools

Anthropic's built-in tools are exposed as SDK capabilities:

| Anthropic tool | Allternit SDK |
|----------------|---------------|
| `computer_20250124` | `ComputerUseCapability` / `COMPUTER_USE_TOOL` |
| `text_editor_20250124` | `TextEditorTool` (`str_replace_editor`) |

```typescript
import { ComputerUseCapability } from '@allternit/sdk/ai-runtime/capabilities/computer-use';
import { TextEditorTool } from '@allternit/sdk/ai-runtime/tools/text-editor';

const computer = new ComputerUseCapability({ displayWidthPx: 1024, displayHeightPx: 768 });
const editor = new TextEditorTool({ workspaceRoot: '/tmp/project' });

const response = await harness.run({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Edit src/index.ts and take a screenshot' }],
  tools: [computer.getTool(), editor.definition()],
});
```

## Stop reason mapping

Anthropic stop reasons are normalized to `HarnessStopReason`:

| Anthropic | Allternit `HarnessStopReason` |
|-----------|-------------------------------|
| `end_turn` | `end_turn` |
| `max_tokens` | `max_tokens` |
| `stop_sequence` | `stop_sequence` |
| `tool_use` / `tool_calls` | `tool_use` |

In the REST gateway, these map to OpenAI `finish_reason` strings (`stop`, `length`, `tool_calls`).

## Checklist

- [ ] Move `system` from a top-level Anthropic field to a `system` role message.
- [ ] Convert `thinking` to `reasoning.enabled` + `reasoning.budgetTokens` in the SDK, or `reasoning_effort` in the REST API.
- [ ] Convert `cache_control` to `cache` or `cache_control` on SDK messages/tools.
- [ ] Convert `tool_choice` to SDK `toolChoice`; `{ type: 'tool', name }` becomes `{ name }`.
- [ ] Convert `disable_parallel_tool_use` to SDK `parallelToolCalls`.
- [ ] Use `ComputerUseCapability` and `TextEditorTool` for Anthropic built-in tools.
