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

## Middleware

`AllternitHarness` supports middleware hooks that run on every request:
`beforeRequest`, `afterResponse`, and `onError`. A retry middleware is enabled by
default; the legacy `retry` option configures it.

```typescript
import { AllternitHarness } from '@allternit/sdk';

const harness = new AllternitHarness({
  mode: 'byok',
  byok: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  },
  middleware: {
    beforeRequest: async (request) => {
      console.log('Sending request to', request.provider, request.model);
      return request;
    },
    afterResponse: async (response) => {
      console.log('Tokens used:', response.usage);
      return response;
    },
    onError: async (error) => {
      console.error('Harness error:', error.code, error.message);
      // Returning/yielding an async generator substitutes a replacement stream.
      // Returning undefined lets the next middleware handle it.
    },
  },
  // Retry up to 3 times with a 500 ms base delay (default).
  retry: { maxRetries: 3, initialDelayMs: 500 },
});
```

### Refusal fallback

If a provider refuses or content-filters a request, you can automatically fall
back to another configured provider or model:

```typescript
const harness = new AllternitHarness({
  mode: 'byok',
  byok: {
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
    openai: { apiKey: process.env.OPENAI_API_KEY! },
  },
  fallbackModels: [
    { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
    { provider: 'openai', model: 'gpt-4o-mini' },
  ],
});
```

## Next steps

See the runnable examples in [`examples/`](./examples/):

- `chat-with-tools.ts` — call a function-style tool during a chat
- `stream-events.ts` — consume every event type from the stream
- `run-batch.ts` — run multiple prompts concurrently
