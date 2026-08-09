# TypeScript SDK quickstart

The `@allternit/sdk` package provides a provider-agnostic harness for AI
completions. The same `AllternitHarness` class works in BYOK, cloud, local
(Ollama), and subprocess modes.

## Install

```bash
npm install @allternit/sdk
```

## First chat completion

```typescript
import { AllternitHarness } from '@allternit/sdk';

const harness = new AllternitHarness({
  mode: 'byok',
  byok: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  },
});

const response = await harness.complete({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'What is the capital of France?' }],
});

console.log(response);
```

`complete()` returns the full response text. For structured output with usage,
citations, and stop reason, use `run()` instead.

## Tool use

```typescript
import { AllternitHarness } from '@allternit/sdk';

const harness = new AllternitHarness({
  mode: 'byok',
  byok: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  },
});

const weatherTool = {
  name: 'get_weather',
  description: 'Get the current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' },
    },
    required: ['city'],
  },
};

const stream = harness.stream({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'What is the weather in Paris?' }],
  tools: [weatherTool],
});

for await (const chunk of stream) {
  switch (chunk.type) {
    case 'text':
      process.stdout.write(chunk.text);
      break;
    case 'tool_call':
      console.log(`\nTool call: ${chunk.name}(${chunk.arguments})`);
      break;
    case 'tool_call_complete':
      console.log(`\nCompleted tool call: ${chunk.name}`, chunk.arguments);
      break;
    case 'done':
      console.log('\nUsage:', chunk.usage);
      break;
  }
}
```

## Streaming

```typescript
import { AllternitHarness } from '@allternit/sdk';

const harness = new AllternitHarness({
  mode: 'byok',
  byok: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  },
});

const stream = harness.stream({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Write a haiku about TypeScript.' }],
});

for await (const chunk of stream) {
  if (chunk.type === 'text') {
    process.stdout.write(chunk.text);
  }
  if (chunk.type === 'done') {
    console.log('\n\nUsage:', chunk.usage);
  }
}
```

## Modes

| Mode        | Configuration                                           |
| ----------- | ------------------------------------------------------- |
| `byok`      | Use your own provider API keys.                         |
| `cloud`     | Connect to Allternit's managed cloud service.           |
| `local`     | Connect to a local model server such as Ollama.         |
| `subprocess`| Spawn a custom model runner as a subprocess.            |

BYOK mode currently supports streaming completions for `anthropic`. Other
providers expose the same interface and are wired through the harness routing
layer.

## Next steps

See the runnable examples in [`examples/`](./examples/):

- `chat-with-tools.ts` — call a function-style tool during a chat
- `stream-events.ts` — consume every event type from the stream
- `run-batch.ts` — run multiple prompts concurrently
