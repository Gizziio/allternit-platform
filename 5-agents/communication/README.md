# @a2r/communication

Agent communication primitives for a2rchitech.

## Features

- **@mention Parser**: Parse and route @mentions in messages
- **MCP Proxy**: Per-instance MCP proxy with sender identity injection
- **Terminal Injection**: Inject keystrokes into tmux (Unix) or Win32 (Windows) sessions
- **Loop Guard**: Prevent runaway agent-to-agent communication chains
- **Escalation Handler**: Handle escalations when agent chains are blocked

## Installation

```bash
pnpm install
```

## Usage

### @mention Parser

```typescript
import { MentionParser, parseMentions } from '@a2r/communication';

const parser = new MentionParser({
  knownRoles: ['builder', 'validator', 'reviewer'],
});

const result = parser.parse('@builder please review this PR');
console.log(result.mentions);
// [{ name: 'builder', type: 'role', index: 0, full: '@builder' }]
```

### MCP Proxy

```typescript
import { createMCPProxy } from '@a2r/communication';

const proxy = createMCPProxy({
  agentName: 'builder-1',
  sessionId: 'session_123',
  agentRole: 'builder',
  injectSender: true,
  injectChannel: true,
});

// Forward tool call with injected identity
const result = await proxy.forward({
  name: 'chat_send',
  arguments: { room_id: 'general', content: 'Hello' },
  callId: 'call_1',
});
```

### Terminal Injection

```typescript
import { createTmuxInjector } from '@a2r/communication';

const injector = createTmuxInjector();

// Inject command into tmux session
await injector.inject('agent-session-1', 'mcp read #general');

// Capture session output
const output = await injector.captureOutput('agent-session-1', 100);
```

### Loop Guard

```typescript
import { createLoopGuard } from '@a2r/communication';

const guard = createLoopGuard({
  maxAgentHops: 4,
  cooldownMs: 5000,
  humanPassthrough: true,
});

// Check if action is allowed
const result = await guard.check(
  'agent-1',
  'agent-2',
  'correlation_123',
  false // isHuman
);

if (!result.allowed) {
  console.log(result.reason);
  // "Maximum agent hops exceeded (4/4)"
}
```

## Architecture

```
Message → @mention Parser → Loop Guard → MCP Proxy → Terminal Injector → Agent
                                    ↓
                            Escalation Handler (if blocked)
```

## License

MIT
