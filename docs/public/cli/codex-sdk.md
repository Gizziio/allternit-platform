# Codex SDK

The Allternit SDK provides a TypeScript library for building agentic applications on top of the Allternit platform. It is the programmatic counterpart to the `gizzi-code` CLI.

## Installation

Install the SDK from npm:

```bash
npm install @allternit/sdk
```

Or with Bun:

```bash
bun add @allternit/sdk
```

## TypeScript library

Import the runtime harness and create a client:

```typescript
import { AllternitRuntime } from '@allternit/sdk'

const runtime = new AllternitRuntime({
  apiKey: process.env.ALLTERNIT_API_KEY,
  baseURL: 'https://api.allternit.com',
  model: 'anthropic/claude-4',
})

const result = await runtime.run({
  messages: [{ role: 'user', content: 'Explain the SDK' }],
})

for (const message of result.messages) {
  console.log(message.content)
}
```

### Tools

Register tools and let the model call them:

```typescript
runtime.registerTool({
  name: 'weather',
  description: 'Get the current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string' },
    },
    required: ['city'],
  },
  async execute(args) {
    return { temperature: 72, condition: 'sunny' }
  },
})
```

### Sessions and threads

Create persistent sessions with threaded conversations:

```typescript
const session = await runtime.createSession({
  name: 'Customer support bot',
})

const thread = await session.createThread({
  parentThreadId: session.id,
})

await thread.send('What is the refund policy?')
```

## Sandbox presets

The SDK supports the same sandbox presets as the CLI. Configure them when creating a runtime or per-run:

```typescript
const runtime = new AllternitRuntime({
  sandbox: {
    mode: 'workspace-write',
    allowNetwork: true,
    allowedDomains: ['api.github.com'],
  },
})
```

Available modes:

- `read-only` — no writes or network.
- `workspace-write` — writes inside the workspace and optional network.
- `danger-full-access` — no restrictions; use only in isolated environments.

## Streaming

Responses can be streamed:

```typescript
const stream = await runtime.runStream({
  messages: [{ role: 'user', content: 'Write a poem' }],
})

for await (const event of stream) {
  if (event.type === 'content') {
    process.stdout.write(event.delta)
  }
}
```

## Related pages

- [OSS mode and local providers](./oss-mode.md)
- [Agent approvals and security](./agent-approvals-security.md)
- [Advanced configuration](./advanced-configuration.md)
